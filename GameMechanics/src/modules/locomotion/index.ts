import type {
  CompetitorId,
  Direction,
  GameEvent,
  MatchConfig,
} from "../../contracts.ts";
import type {
  ModuleSpec,
  SystemRunContext,
  SystemRunResult,
} from "../../kernel/protocol.ts";
import {
  activeDirection,
  ARENA_HEIGHT,
  ARENA_WIDTH,
  assertCompetitorOrder,
  assertPosition,
  assertSafeInteger,
  assertVelocity,
  BASE_SPEED_UNITS_PER_TICK,
  BODY_HALF_EXTENT,
  bodiesOverlap,
  bodyOverlapsTile,
  bodyWithinBounds,
  CANONICAL_SPAWNS,
  crateKeySet,
  effectiveSolidKeySet,
  freezePosition,
  freezeVelocity,
  LANE_ASSIST_MAX_OFFSET,
  LANE_CORRECTION_MAX,
  LANE_LONGITUDINAL_LOCK,
  tileCenter,
  tileKey,
  tileOf,
  UNITS_PER_TILE,
  type BombEntry,
  type BombsSlice,
  type LocomotionEntry,
  type LocomotionSlice,
  type PressureSlice,
  type Velocity,
  type WorldPosition,
  isGameplayActive,
} from "../../kernel/world-state.ts";
import { factsOfKind } from "../../kernel/facts.ts";

/** Bump: effective solid includes pressure closed tiles (Decision 008). */
const MODULE_VERSION = "2.3.0";

const ZERO_VELOCITY = freezeVelocity({ x: 0, y: 0 });
const DIRECTIONS = new Set<Direction>(["up", "down", "left", "right"]);

export type MovementCandidate = Readonly<{
  competitorId: CompetitorId;
  from: WorldPosition;
  to: WorldPosition;
  direction: Direction;
}>;

function isHorizontal(direction: Direction): boolean {
  return direction === "left" || direction === "right";
}

/** True when axes differ (H↔V). Opposite and identical directions are not perpendicular. */
function arePerpendicular(a: Direction, b: Direction): boolean {
  return isHorizontal(a) !== isHorizontal(b);
}

function longitudinalDelta(direction: Direction): Readonly<{ x: number; y: number }> {
  switch (direction) {
    case "right":
      return { x: BASE_SPEED_UNITS_PER_TICK, y: 0 };
    case "left":
      return { x: -BASE_SPEED_UNITS_PER_TICK, y: 0 };
    case "down":
      return { x: 0, y: BASE_SPEED_UNITS_PER_TICK };
    case "up":
      return { x: 0, y: -BASE_SPEED_UNITS_PER_TICK };
  }
}

/**
 * Velocity restored/written by this vertical module must be a safe integer pair
 * whose absolute components stay within the contract max step (LANE_CORRECTION_MAX).
 * Does not alter the generic assertVelocity helper.
 */
function assertLocomotionVelocity(value: unknown, label: string): Velocity {
  const velocity = assertVelocity(value, label);
  if (
    Math.abs(velocity.x) > LANE_CORRECTION_MAX
    || Math.abs(velocity.y) > LANE_CORRECTION_MAX
  ) {
    throw new Error(
      `${label} components must have abs <= ${LANE_CORRECTION_MAX} (contract max step).`,
    );
  }
  return velocity;
}

/** Candidate step is legal only when each component stays within contract max. */
function isWithinContractStep(from: WorldPosition, to: WorldPosition): boolean {
  return (
    Math.abs(to.x - from.x) <= LANE_CORRECTION_MAX
    && Math.abs(to.y - from.y) <= LANE_CORRECTION_MAX
  );
}

/**
 * Bomb tiles the body already overlaps in pre-state (egress entitlement by geometry,
 * not by owner secret).
 */
export function preOverlappingBombKeys(
  position: WorldPosition,
  bombs: readonly BombEntry[],
): ReadonlySet<string> {
  const keys = new Set<string>();
  for (const bomb of bombs) {
    if (bodyOverlapsTile(position, bomb.tile)) {
      keys.add(tileKey(bomb.tile));
    }
  }
  return keys;
}

/**
 * Monotone egress from a pre-overlapped bomb tile:
 * - must not approach the tile center
 * - must not cross the tile center on either axis
 * Re-entry into a non-pre-overlapped bomb is blocked by static validation.
 */
function isBombEgressMonotone(
  from: WorldPosition,
  to: WorldPosition,
  bombTile: { x: number; y: number },
): boolean {
  const center = tileCenter(bombTile);
  const distFrom = Math.abs(from.x - center.x) + Math.abs(from.y - center.y);
  const distTo = Math.abs(to.x - center.x) + Math.abs(to.y - center.y);
  if (distTo < distFrom) return false;

  // Crossing the center on an axis is forbidden.
  if (from.x < center.x && to.x > center.x) return false;
  if (from.x > center.x && to.x < center.x) return false;
  if (from.y < center.y && to.y > center.y) return false;
  if (from.y > center.y && to.y < center.y) return false;

  // Landing exactly on the center counts as crossing when we started off-center.
  if (to.x === center.x && from.x !== center.x) return false;
  if (to.y === center.y && from.y !== center.y) return false;

  return true;
}

export function isStaticallyValid(
  position: WorldPosition,
  prePosition: WorldPosition,
  solid: ReadonlySet<string>,
  crates: ReadonlySet<string>,
  bombs: readonly BombEntry[],
  preBombKeys: ReadonlySet<string>,
): boolean {
  if (!bodyWithinBounds(position, ARENA_WIDTH, ARENA_HEIGHT)) return false;

  // Solid / crate: any positive-area body overlap blocks.
  const minTx = Math.floor((position.x - BODY_HALF_EXTENT) / UNITS_PER_TILE);
  const maxTx = Math.floor((position.x + BODY_HALF_EXTENT - 1) / UNITS_PER_TILE);
  const minTy = Math.floor((position.y - BODY_HALF_EXTENT) / UNITS_PER_TILE);
  const maxTy = Math.floor((position.y + BODY_HALF_EXTENT - 1) / UNITS_PER_TILE);
  for (let ty = minTy; ty <= maxTy; ty += 1) {
    for (let tx = minTx; tx <= maxTx; tx += 1) {
      const tile = { x: tx, y: ty };
      const key = tileKey(tile);
      if (!bodyOverlapsTile(position, tile)) continue;
      if (solid.has(key) || crates.has(key)) return false;
    }
  }

  for (const bomb of bombs) {
    const key = tileKey(bomb.tile);
    if (!bodyOverlapsTile(position, bomb.tile)) continue;
    if (!preBombKeys.has(key)) {
      // Fresh contact / re-entry blocked.
      return false;
    }
    if (!isBombEgressMonotone(prePosition, position, bomb.tile)) {
      return false;
    }
  }

  return true;
}

/**
 * Attempt one direction with lane assist (transverse then longitudinal).
 * Returns the candidate position (may equal `from` if fully blocked).
 */
export function attemptDirection(
  from: WorldPosition,
  direction: Direction,
  solid: ReadonlySet<string>,
  crates: ReadonlySet<string>,
  bombs: readonly BombEntry[],
  preBombKeys: ReadonlySet<string>,
): WorldPosition {
  const horizontal = isHorizontal(direction);
  const currentTile = tileOf(from);
  const laneCenter = horizontal
    ? currentTile.y * UNITS_PER_TILE + UNITS_PER_TILE / 2
    : currentTile.x * UNITS_PER_TILE + UNITS_PER_TILE / 2;

  let pos = freezePosition(from);

  // 1) Transverse correction toward lane center (before longitudinal).
  const transverse = horizontal ? pos.y - laneCenter : pos.x - laneCenter;
  const absTransverse = Math.abs(transverse);
  if (absTransverse > 0 && absTransverse <= LANE_ASSIST_MAX_OFFSET) {
    const step = Math.min(LANE_CORRECTION_MAX, absTransverse);
    const toward = transverse > 0 ? -step : step;
    const corrected = horizontal
      ? freezePosition({ x: pos.x, y: pos.y + toward })
      : freezePosition({ x: pos.x + toward, y: pos.y });
    // Integer clamp to center (no overshoot).
    const clamped = horizontal
      ? freezePosition({
          x: corrected.x,
          y:
            toward > 0
              ? Math.min(corrected.y, laneCenter)
              : Math.max(corrected.y, laneCenter),
        })
      : freezePosition({
          x:
            toward > 0
              ? Math.min(corrected.x, laneCenter)
              : Math.max(corrected.x, laneCenter),
          y: corrected.y,
        });
    if (isStaticallyValid(clamped, from, solid, crates, bombs, preBombKeys)) {
      pos = clamped;
    }
  }

  // 2) Longitudinal advance only when transverse offset is within lock.
  const offsetAfter = horizontal ? Math.abs(pos.y - laneCenter) : Math.abs(pos.x - laneCenter);
  if (offsetAfter <= LANE_LONGITUDINAL_LOCK) {
    const delta = longitudinalDelta(direction);
    const advanced = freezePosition({ x: pos.x + delta.x, y: pos.y + delta.y });
    if (isStaticallyValid(advanced, from, solid, crates, bombs, preBombKeys)) {
      pos = advanced;
    }
  }

  return pos;
}

function positionsEqual(a: WorldPosition, b: WorldPosition): boolean {
  return a.x === b.x && a.y === b.y;
}

/**
 * Batch-resolve simultaneous body candidates against a shared pre-state.
 * Order-independent: mutual positive overlap rejects both; invading a
 * stationary or already-rejected body rejects the invader. Fixpoint.
 * Rejected competitors keep pre-state position and receive velocity zero
 * at the write site.
 */
export function resolveMovementBatch(
  livingEntries: readonly LocomotionEntry[],
  candidates: readonly MovementCandidate[],
): ReadonlySet<CompetitorId> {
  if (candidates.length === 0) return new Set();

  const preById = new Map<CompetitorId, WorldPosition>();
  for (const entry of livingEntries) {
    preById.set(entry.competitorId, entry.position);
  }

  let remaining = new Map<CompetitorId, MovementCandidate>();
  for (const candidate of candidates) {
    // Contract max step is 128 per component; larger candidates are never accepted
    // (would need swept collision / substeps and an explicit bump).
    if (!isWithinContractStep(candidate.from, candidate.to)) {
      continue;
    }
    remaining.set(candidate.competitorId, candidate);
  }

  let changed = true;
  while (changed) {
    changed = false;
    const reject = new Set<CompetitorId>();
    const list = [...remaining.values()];

    // Mutual positive overlap between candidate finals → both out.
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        const a = list[i]!;
        const b = list[j]!;
        if (bodiesOverlap(a.to, b.to)) {
          reject.add(a.competitorId);
          reject.add(b.competitorId);
        }
      }
    }

    // Invade stationary or already-rejected body (pre-state position).
    for (const candidate of list) {
      if (reject.has(candidate.competitorId)) continue;
      for (const [otherId, prePos] of preById) {
        if (otherId === candidate.competitorId) continue;
        if (remaining.has(otherId) && !reject.has(otherId)) {
          // Other is still a live candidate this iteration — resolved via mutual to-to.
          continue;
        }
        if (bodiesOverlap(candidate.to, prePos)) {
          reject.add(candidate.competitorId);
          break;
        }
      }
    }

    if (reject.size > 0) {
      changed = true;
      for (const id of reject) remaining.delete(id);
    }
  }

  return new Set(remaining.keys());
}

function runLocomotionReset(ctx: SystemRunContext): SystemRunResult {
  const resets = factsOfKind(ctx.facts, "round-reset");
  if (resets.length === 0) return {};
  return {
    writes: {
      locomotion: initialLocomotion(ctx.config),
    },
  };
}

function runLocomotion(ctx: SystemRunContext): SystemRunResult {
  const match = ctx.read("match");
  if (!isGameplayActive(match.phase)) {
    return {};
  }

  const arena = ctx.read("arena");
  const pressure = ctx.read("pressure") as PressureSlice;
  const bombsSlice = ctx.read("bombs") as BombsSlice;
  const intent = ctx.read("intent");
  const locomotion = ctx.read("locomotion");
  const vitals = ctx.read("vitals");

  // Effective solid = Arena base + Pressure closed (not persisted).
  const solid = effectiveSolidKeySet(arena, pressure);
  const crates = crateKeySet(arena);
  const bombs = bombsSlice.items;

  const alive = new Set(
    vitals.entries.filter((entry) => entry.alive).map((entry) => entry.competitorId),
  );
  const skillMoves = new Map(
    factsOfKind(ctx.facts, "skill-movement").map((fact) => [fact.competitorId, fact] as const),
  );

  const candidates: MovementCandidate[] = [];

  for (const entry of locomotion.entries) {
    if (!alive.has(entry.competitorId)) continue;

    const skillMove = skillMoves.get(entry.competitorId);
    if (skillMove?.teleport) {
      candidates.push(
        Object.freeze({
          competitorId: entry.competitorId,
          from: freezePosition(entry.position),
          to: freezePosition(skillMove.teleport),
          direction: entry.lastDirection ?? "down",
        }),
      );
      continue;
    }
    if (skillMove?.suppress) continue;

    const intentEntry = intent.entries.find(
      (item) => item.competitorId === entry.competitorId,
    );
    const intentDirection = intentEntry ? activeDirection(intentEntry) : null;
    if (!intentDirection) continue;

    const preBombKeys = preOverlappingBombKeys(entry.position, bombs);

    let usedDirection = intentDirection;
    let to = attemptDirection(
      entry.position,
      intentDirection,
      solid,
      crates,
      bombs,
      preBombKeys,
    );

    // Perpendicular blocked only: continue lastDirection if it still advances.
    // Opposite (or same) intent must not fall back — a blocked reverse stays put.
    if (
      positionsEqual(to, entry.position)
      && entry.lastDirection
      && arePerpendicular(entry.lastDirection, intentDirection)
    ) {
      const continued = attemptDirection(
        entry.position,
        entry.lastDirection,
        solid,
        crates,
        bombs,
        preBombKeys,
      );
      if (!positionsEqual(continued, entry.position)) {
        to = continued;
        usedDirection = entry.lastDirection;
      }
    }

    if (positionsEqual(to, entry.position)) continue;

    candidates.push(
      Object.freeze({
        competitorId: entry.competitorId,
        from: freezePosition(entry.position),
        to: freezePosition(to),
        direction: usedDirection,
      }),
    );
  }

  const livingEntries = locomotion.entries.filter((entry) =>
    alive.has(entry.competitorId),
  );
  const teleports = new Set(
    factsOfKind(ctx.facts, "skill-movement")
      .filter((fact) => fact.teleport !== null)
      .map((fact) => fact.competitorId),
  );
  const accepted = new Set([
    ...resolveMovementBatch(
      livingEntries,
      candidates.filter((candidate) => !teleports.has(candidate.competitorId)),
    ),
    ...teleports,
  ]);
  const candidateById = new Map(
    candidates.map((candidate) => [candidate.competitorId, candidate] as const),
  );

  const moveEvents: GameEvent[] = [];
  const nextEntries = locomotion.entries.map((entry) => {
    const candidate = candidateById.get(entry.competitorId);
    if (!candidate || !accepted.has(entry.competitorId)) {
      // No applied displacement this locomotion phase → velocity zero.
      // Dead competitors also clear velocity (no locomotion write of intent).
      return Object.freeze({
        competitorId: entry.competitorId,
        position: freezePosition(entry.position),
        velocity: ZERO_VELOCITY,
        lastDirection: entry.lastDirection,
      });
    }

    const velocity = teleports.has(entry.competitorId)
      ? ZERO_VELOCITY
      : freezeVelocity({
          x: candidate.to.x - candidate.from.x,
          y: candidate.to.y - candidate.from.y,
        });
    const tile = tileOf(candidate.to);
    moveEvents.push(
      Object.freeze({
        type: "competitor-moved" as const,
        competitorId: entry.competitorId,
        position: freezePosition(candidate.to),
        tile: tile,
      }),
    );

    return Object.freeze({
      competitorId: entry.competitorId,
      position: freezePosition(candidate.to),
      velocity,
      lastDirection: candidate.direction,
    });
  });

  moveEvents.sort((left, right) => {
    if (left.type !== "competitor-moved" || right.type !== "competitor-moved") return 0;
    return left.competitorId < right.competitorId
      ? -1
      : left.competitorId > right.competitorId
        ? 1
        : 0;
  });

  const byId = new Map(nextEntries.map((entry) => [entry.competitorId, entry]));
  const ordered = ctx.config.seats.map((seat) => {
    const entry = byId.get(seat.competitorId);
    if (!entry) throw new Error(`Missing locomotion for ${seat.competitorId}`);
    return entry;
  });

  return {
    writes: {
      locomotion: Object.freeze({ entries: Object.freeze(ordered) }),
    },
    events: moveEvents,
  };
}

function initialLocomotion(config: MatchConfig): LocomotionSlice {
  const entries: LocomotionEntry[] = [];
  config.seats.forEach((assignment, index) => {
    const spawn = CANONICAL_SPAWNS[index];
    if (!spawn) {
      throw new Error(`No spawn defined for seat index ${index}.`);
    }
    entries.push(
      Object.freeze({
        competitorId: assignment.competitorId,
        position: tileCenter(spawn),
        velocity: ZERO_VELOCITY,
        lastDirection: null,
      }),
    );
  });
  return Object.freeze({ entries: Object.freeze(entries) });
}

function restoreLocomotion(raw: unknown, config: MatchConfig): LocomotionSlice {
  if (!raw || typeof raw !== "object") {
    throw new Error("slices.locomotion must be an object.");
  }
  const locoRaw = raw as { entries?: unknown };
  if (!Array.isArray(locoRaw.entries)) {
    throw new Error("slices.locomotion.entries must be an array.");
  }
  const seatOrder = config.seats.map((seat) => seat.competitorId);
  const seatSet = new Set(seatOrder);
  const locoEntries = locoRaw.entries.map((entry, index) => {
    if (!entry || typeof entry !== "object") {
      throw new Error(`slices.locomotion.entries[${index}] is invalid.`);
    }
    const row = entry as Record<string, unknown>;
    if (typeof row.competitorId !== "string" || !seatSet.has(row.competitorId as CompetitorId)) {
      throw new Error(`slices.locomotion.entries[${index}].competitorId is invalid.`);
    }
    // Reject legacy tile / moveElapsedMs canonical fields.
    if ("tile" in row) {
      throw new Error(
        `slices.locomotion.entries[${index}] must not carry canonical tile (use position; tile is derived).`,
      );
    }
    if ("moveElapsedMs" in row) {
      throw new Error(
        `slices.locomotion.entries[${index}] must not carry moveElapsedMs (removed in world-2).`,
      );
    }
    const position = assertPosition(
      row.position,
      `slices.locomotion.entries[${index}].position`,
    );
    if (!bodyWithinBounds(position, ARENA_WIDTH, ARENA_HEIGHT)) {
      throw new Error(
        `slices.locomotion.entries[${index}].position body is out of arena bounds.`,
      );
    }
    const velocity = assertLocomotionVelocity(
      row.velocity,
      `slices.locomotion.entries[${index}].velocity`,
    );
    let lastDirection: Direction | null = null;
    if (row.lastDirection !== null && row.lastDirection !== undefined) {
      if (
        typeof row.lastDirection !== "string"
        || !DIRECTIONS.has(row.lastDirection as Direction)
      ) {
        throw new Error(
          `slices.locomotion.entries[${index}].lastDirection is invalid.`,
        );
      }
      lastDirection = row.lastDirection as Direction;
    }
    // Touch safe-integer already enforced; keep assert for clarity on future fields.
    assertSafeInteger(position.x, `slices.locomotion.entries[${index}].position.x`);
    return Object.freeze({
      competitorId: row.competitorId as CompetitorId,
      position,
      velocity,
      lastDirection,
    });
  });
  assertCompetitorOrder(locoEntries, seatOrder, "slices.locomotion.entries");
  return Object.freeze({ entries: Object.freeze(locoEntries) });
}


export const locomotionModule: ModuleSpec = Object.freeze({
  id: "locomotion",
  version: MODULE_VERSION,
  owns: Object.freeze(["locomotion"] as const),
  systems: Object.freeze([
    Object.freeze({
      id: "locomotion-reset-system",
      phase: "round-reset" as const,
      reads: Object.freeze(["locomotion"] as const),
      writes: Object.freeze(["locomotion"] as const),
      run: runLocomotionReset,
    }),
    Object.freeze({
      id: "locomotion-system",
      phase: "locomotion" as const,
      reads: Object.freeze([
        "intent",
        "locomotion",
        "arena",
        "bombs",
        "vitals",
        "match",
        "pressure",
      ] as const),
      writes: Object.freeze(["locomotion"] as const),
      run: runLocomotion,
    }),
  ]),
  codecs: Object.freeze({
    initial(config: MatchConfig) {
      return Object.freeze({ locomotion: initialLocomotion(config) });
    },
    restore(
      rawOwned: Readonly<Partial<Record<"locomotion", unknown>>>,
      config: MatchConfig,
    ) {
      return Object.freeze({ locomotion: restoreLocomotion(rawOwned.locomotion, config) });
    },
  }),
});
