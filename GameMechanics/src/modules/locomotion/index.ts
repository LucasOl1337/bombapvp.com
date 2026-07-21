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
  bodyOverlapsTileToroidal,
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
  wrapDelta,
  wrapPosition,
  wrapTile,
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

/**
 * 3.2.0: living bodies never block each other — players pass through rivals
 * (Decision 012, parity with the original game). 3.1.0: bomb egress is free
 * pass-through while the body still overlaps the bomb tile (Decision 012).
 * 3.0.0: toroidal wrap arena (Decision 011).
 */
const MODULE_VERSION = "3.2.0";

const SPAN_X = ARENA_WIDTH * UNITS_PER_TILE;
const SPAN_Y = ARENA_HEIGHT * UNITS_PER_TILE;

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

/** Candidate step is legal only when each wrapped component stays within contract max. */
function isWithinContractStep(from: WorldPosition, to: WorldPosition): boolean {
  return (
    Math.abs(wrapDelta(to.x, from.x, SPAN_X)) <= LANE_CORRECTION_MAX
    && Math.abs(wrapDelta(to.y, from.y, SPAN_Y)) <= LANE_CORRECTION_MAX
  );
}

/**
 * Bomb tiles the body already overlaps in pre-state (egress entitlement by
 * geometry, not by owner secret). While any overlap persists the body moves
 * freely across the bomb tile (Decision 012); once fully clear, the key drops
 * out of the pre-state set and re-entry is blocked by static validation.
 */
export function preOverlappingBombKeys(
  position: WorldPosition,
  bombs: readonly BombEntry[],
): ReadonlySet<string> {
  const keys = new Set<string>();
  for (const bomb of bombs) {
    if (bodyOverlapsTileToroidal(position, bomb.tile)) {
      keys.add(tileKey(bomb.tile));
    }
  }
  return keys;
}

/**
 * Static legality of a canonical (torus-normalized) body position.
 * Positions are always in-bounds modulo the torus (Decision 011), so there
 * is no bounds rejection: a body near the seam legitimately overlaps the
 * wrapped corner tiles on the opposite edge, which are evaluated via
 * wrapTile + toroidal overlap (body half extent < 1 tile, so the ≤2×2
 * wrapped corner tiles suffice).
 */
export function isStaticallyValid(
  position: WorldPosition,
  solid: ReadonlySet<string>,
  crates: ReadonlySet<string>,
  bombs: readonly BombEntry[],
  preBombKeys: ReadonlySet<string>,
): boolean {
  // Solid / crate: any positive-area body overlap blocks (wrap-aware).
  const minTx = Math.floor((position.x - BODY_HALF_EXTENT) / UNITS_PER_TILE);
  const maxTx = Math.floor((position.x + BODY_HALF_EXTENT - 1) / UNITS_PER_TILE);
  const minTy = Math.floor((position.y - BODY_HALF_EXTENT) / UNITS_PER_TILE);
  const maxTy = Math.floor((position.y + BODY_HALF_EXTENT - 1) / UNITS_PER_TILE);
  for (let ty = minTy; ty <= maxTy; ty += 1) {
    for (let tx = minTx; tx <= maxTx; tx += 1) {
      const tile = wrapTile({ x: tx, y: ty });
      const key = tileKey(tile);
      if (!bodyOverlapsTileToroidal(position, tile)) continue;
      if (solid.has(key) || crates.has(key)) return false;
    }
  }

  for (const bomb of bombs) {
    const key = tileKey(bomb.tile);
    if (!bodyOverlapsTileToroidal(position, bomb.tile)) continue;
    if (!preBombKeys.has(key)) {
      // Fresh contact / re-entry blocked.
      return false;
    }
    // Pre-overlapped bomb: free pass-through while any overlap persists
    // (Decision 012). No monotone restriction — it trapped off-center bodies.
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
    if (isStaticallyValid(wrapPosition(clamped), solid, crates, bombs, preBombKeys)) {
      pos = wrapPosition(clamped);
    }
  }

  // 2) Longitudinal advance only when transverse offset is within lock.
  const offsetAfter = horizontal ? Math.abs(pos.y - laneCenter) : Math.abs(pos.x - laneCenter);
  if (offsetAfter <= LANE_LONGITUDINAL_LOCK) {
    const delta = longitudinalDelta(direction);
    // Torus: advance modulo the arena span so seam crossings re-enter canonically.
    const advanced = wrapPosition(freezePosition({ x: pos.x + delta.x, y: pos.y + delta.y }));
    if (isStaticallyValid(advanced, solid, crates, bombs, preBombKeys)) {
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
 * Living bodies never block each other (Decision 012): players pass through
 * rivals exactly like the original game, so the batch only filters candidates
 * whose per-component step exceeds the contract max (would need swept
 * collision / substeps and an explicit bump). Order-independent by
 * construction. Candidates outside `livingEntries` (dead) are ignored.
 */
export function resolveMovementBatch(
  livingEntries: readonly LocomotionEntry[],
  candidates: readonly MovementCandidate[],
): ReadonlySet<CompetitorId> {
  const living = new Set(livingEntries.map((entry) => entry.competitorId));
  const accepted = new Set<CompetitorId>();
  for (const candidate of candidates) {
    if (!living.has(candidate.competitorId)) continue;
    if (!isWithinContractStep(candidate.from, candidate.to)) continue;
    accepted.add(candidate.competitorId);
  }
  return accepted;
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
          // Blink destination normalized onto the torus (Decision 011).
          to: wrapPosition(skillMove.teleport),
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
          // Shortest wrapped delta keeps velocity consistent across the seam.
          x: wrapDelta(candidate.to.x, candidate.from.x, SPAN_X),
          y: wrapDelta(candidate.to.y, candidate.from.y, SPAN_Y),
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
    // Torus (Decision 011): out-of-range positions are normalized modulo the
    // arena span instead of rejected. Structural validation (safe integers,
    // velocity contract, seat order) stays strict.
    const position = wrapPosition(assertPosition(
      row.position,
      `slices.locomotion.entries[${index}].position`,
    ));
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
