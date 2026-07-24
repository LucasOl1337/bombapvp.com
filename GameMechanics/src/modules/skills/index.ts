import type {
  CompetitorId,
  Direction,
  GameEvent,
  MatchConfig,
  SkillId,
  SkillOutcome,
  TileCoord,
  WorldPosition,
} from "../../contracts.ts";
import {
  CROCODILO_EMERALD_SURGE_SKILL_ID,
  isSkillId,
  KILLER_BEE_WING_DASH_SKILL_ID,
  RANNI_ICE_BLINK_SKILL_ID,
  THRESH_DEATH_SENTENCE_SKILL_ID,
  TICK_DURATION_MS,
  ZED_LIVING_SHADOW_SKILL_ID,
} from "../../contracts.ts";
import type { CommandRejection } from "../../kernel/commands.ts";
import type { TickFact } from "../../kernel/facts.ts";
import { factsOfKind } from "../../kernel/facts.ts";
import type {
  ModuleSpec,
  SystemRunContext,
  SystemRunResult,
} from "../../kernel/protocol.ts";
import {
  activeDirection,
  assertInteger,
  assertPosition,
  BASE_SPEED_UNITS_PER_TICK,
  DIRECTION_DELTA,
  effectiveSolidKeySet,
  findIntent,
  findLocomotion,
  findVitals,
  freezePosition,
  freezeTile,
  isGameplayActive,
  tileCenter,
  tileKey,
  tileOf,
  wrapPosition,
  wrapTile,
  type BombEntry,
  type SkillEntry,
  type SkillsSlice,
} from "../../kernel/world-state.ts";
import {
  attemptDirection,
  isStaticallyValid,
  preOverlappingBombKeys,
} from "../locomotion/index.ts";

// ── Timing / range constants (aligned with roster skill fantasy) ────────────

/**
 * Ice Blink leaves enough time to read the frozen body, steer the spirit
 * through terrain, and choose a valid landing point. A second cast still
 * completes immediately.
 */
export const RANNI_CHANNEL_MS = 2_500 as const;
export const RANNI_COOLDOWN_MS = 8_000 as const;

export const KILLER_BEE_CHANNEL_MS = 240 as const;
export const KILLER_BEE_COOLDOWN_MS = 4_000 as const;
export const KILLER_BEE_DASH_TILES = 3 as const;

export const CROCODILO_CHANNEL_MS = 1_600 as const;
export const CROCODILO_COOLDOWN_MS = 6_000 as const;
export const CROCODILO_SURGE_RANGE = 2 as const;

export const THRESH_CHANNEL_MS = 300 as const;
export const THRESH_COOLDOWN_MS = 8_000 as const;
export const THRESH_HOOK_RANGE = 4 as const;
export const THRESH_MISS_COOLDOWN_MS = 4_000 as const;

/**
 * Living Shadow: place a fixed projection, free-move body for the window,
 * recast swap. Success CD 7s; timeout / invalid swap fail CD 4s.
 * Body stays vulnerable (no channel immunity) during the free-move window.
 */
export const ZED_CHANNEL_MS = 2_000 as const;
export const ZED_COOLDOWN_MS = 7_000 as const;
export const ZED_FAIL_COOLDOWN_MS = 4_000 as const;
export const ZED_SHADOW_RANGE = 3 as const;

const MODULE_VERSION = "2.3.0";
const DIRECTIONS = new Set<Direction>(["up", "down", "left", "right"]);
const PHASES = new Set<SkillEntry["phase"]>(["idle", "channeling", "cooldown"]);

const COOLDOWN_BY_SKILL: Readonly<Record<SkillId, number>> = Object.freeze({
  [RANNI_ICE_BLINK_SKILL_ID]: RANNI_COOLDOWN_MS,
  [KILLER_BEE_WING_DASH_SKILL_ID]: KILLER_BEE_COOLDOWN_MS,
  [CROCODILO_EMERALD_SURGE_SKILL_ID]: CROCODILO_COOLDOWN_MS,
  [THRESH_DEATH_SENTENCE_SKILL_ID]: THRESH_COOLDOWN_MS,
  [ZED_LIVING_SHADOW_SKILL_ID]: ZED_COOLDOWN_MS,
});

const CHANNEL_BY_SKILL: Readonly<Record<SkillId, number>> = Object.freeze({
  [RANNI_ICE_BLINK_SKILL_ID]: RANNI_CHANNEL_MS,
  [KILLER_BEE_WING_DASH_SKILL_ID]: KILLER_BEE_CHANNEL_MS,
  [CROCODILO_EMERALD_SURGE_SKILL_ID]: CROCODILO_CHANNEL_MS,
  [THRESH_DEATH_SENTENCE_SKILL_ID]: THRESH_CHANNEL_MS,
  [ZED_LIVING_SHADOW_SKILL_ID]: ZED_CHANNEL_MS,
});

export function skillCooldownMs(skillId: SkillId): number {
  return COOLDOWN_BY_SKILL[skillId];
}

export function skillChannelMs(skillId: SkillId): number {
  return CHANNEL_BY_SKILL[skillId];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function freezeEntry(entry: SkillEntry): SkillEntry {
  return Object.freeze({
    competitorId: entry.competitorId,
    skillId: entry.skillId,
    phase: entry.phase,
    channelRemainingMs: entry.channelRemainingMs,
    cooldownRemainingMs: entry.cooldownRemainingMs,
    projection: entry.projection ? freezePosition(entry.projection) : null,
    bombEgressKeys: Object.freeze([...entry.bombEgressKeys]),
    aimDirection: entry.aimDirection,
  });
}

function idle(entry: SkillEntry): SkillEntry {
  return freezeEntry({
    ...entry,
    phase: "idle",
    channelRemainingMs: 0,
    cooldownRemainingMs: 0,
    projection: null,
    bombEgressKeys: Object.freeze([]),
    aimDirection: null,
  });
}

function cooldown(entry: SkillEntry, cooldownMs = skillCooldownMs(entry.skillId)): SkillEntry {
  return freezeEntry({
    ...entry,
    phase: "cooldown",
    channelRemainingMs: 0,
    cooldownRemainingMs: cooldownMs,
    projection: null,
    bombEgressKeys: Object.freeze([]),
    aimDirection: null,
  });
}

function reject(
  command: SystemRunContext["commands"][number],
  reason: CommandRejection["reason"],
): CommandRejection {
  return Object.freeze({
    sequence: command.envelope.sequence,
    seatId: command.envelope.seatId,
    reason,
  });
}

function chebyshev(a: TileCoord, b: TileCoord): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

function resolveAim(
  ctx: SystemRunContext,
  competitorId: CompetitorId,
  locoDirection: Direction | null,
): Direction {
  const intentEntry = findIntent(ctx.read("intent"), competitorId);
  const fromIntent = intentEntry ? activeDirection(intentEntry) : null;
  return fromIntent ?? locoDirection ?? "down";
}

function bombAt(tile: TileCoord, bombs: readonly BombEntry[]): boolean {
  return bombs.some((bomb) => bomb.tile.x === tile.x && bomb.tile.y === tile.y);
}

function computeDashLanding(
  from: WorldPosition,
  dir: Direction,
  maxTiles: number,
  solid: ReadonlySet<string>,
  crates: ReadonlySet<string>,
  bombs: readonly BombEntry[],
  options: Readonly<{ passBombs?: boolean }> = {},
): WorldPosition {
  let tile = tileOf(from);
  let lastGood = tile;
  for (let step = 0; step < maxTiles; step += 1) {
    const next = wrapTile({
      x: tile.x + DIRECTION_DELTA[dir].x,
      y: tile.y + DIRECTION_DELTA[dir].y,
    });
    const key = tileKey(next);
    if (solid.has(key) || crates.has(key)) break;
    if (!options.passBombs && bombAt(next, bombs)) break;
    lastGood = next;
    tile = next;
  }
  return tileCenter(lastGood);
}

/**
 * Living Shadow placement: furthest free cardinal tile within range.
 * Solids/crates stop the ray; bombs never block placement.
 * Returns null when no valid tile exists (e.g. wall immediately adjacent).
 */
function computeShadowPlacement(
  from: WorldPosition,
  dir: Direction,
  maxTiles: number,
  solid: ReadonlySet<string>,
  crates: ReadonlySet<string>,
): WorldPosition | null {
  let tile = tileOf(from);
  let lastGood: TileCoord | null = null;
  for (let step = 0; step < maxTiles; step += 1) {
    const next = wrapTile({
      x: tile.x + DIRECTION_DELTA[dir].x,
      y: tile.y + DIRECTION_DELTA[dir].y,
    });
    const key = tileKey(next);
    if (solid.has(key) || crates.has(key)) break;
    lastGood = next;
    tile = next;
  }
  return lastGood ? tileCenter(lastGood) : null;
}

/** Free tiles along a ray until wall/crate (and optional bomb). */
function rayFreeTiles(
  origin: TileCoord,
  dir: Direction,
  maxRange: number,
  solid: ReadonlySet<string>,
  crates: ReadonlySet<string>,
  bombs: readonly BombEntry[],
  options: Readonly<{ stopOnBomb?: boolean; includeOrigin?: boolean }> = {},
): TileCoord[] {
  const path: TileCoord[] = [];
  if (options.includeOrigin) path.push(freezeTile(origin));
  let tile = origin;
  for (let step = 0; step < maxRange; step += 1) {
    const next = wrapTile({
      x: tile.x + DIRECTION_DELTA[dir].x,
      y: tile.y + DIRECTION_DELTA[dir].y,
    });
    const key = tileKey(next);
    if (solid.has(key) || crates.has(key)) break;
    if (options.stopOnBomb && bombAt(next, bombs)) break;
    path.push(freezeTile(next));
    tile = next;
  }
  return path;
}

function competitorsOnTiles(
  ctx: SystemRunContext,
  tiles: readonly TileCoord[],
  excludeId: CompetitorId,
): CompetitorId[] {
  const tileSet = new Set(tiles.map(tileKey));
  const vitals = ctx.read("vitals");
  const locomotion = ctx.read("locomotion");
  const hits: CompetitorId[] = [];
  for (const loco of locomotion.entries) {
    if (loco.competitorId === excludeId) continue;
    if (findVitals(vitals, loco.competitorId)?.alive !== true) continue;
    const t = tileOf(loco.position);
    if (tileSet.has(tileKey(t))) hits.push(loco.competitorId);
  }
  hits.sort();
  return hits;
}

function competitorsInChebyshev(
  ctx: SystemRunContext,
  center: TileCoord,
  radius: number,
  excludeId: CompetitorId,
): CompetitorId[] {
  const vitals = ctx.read("vitals");
  const locomotion = ctx.read("locomotion");
  const hits: CompetitorId[] = [];
  for (const loco of locomotion.entries) {
    if (loco.competitorId === excludeId) continue;
    if (findVitals(vitals, loco.competitorId)?.alive !== true) continue;
    if (chebyshev(center, tileOf(loco.position)) <= radius) {
      hits.push(loco.competitorId);
    }
  }
  hits.sort();
  return hits;
}

function skillHitFacts(
  skillId: SkillId,
  ownerId: CompetitorId,
  targetIds: readonly CompetitorId[],
  at: TileCoord,
): TickFact[] {
  return targetIds.map((targetId) =>
    Object.freeze({
      kind: "skill-hit" as const,
      skillId,
      ownerId,
      targetId,
      at: freezeTile(at),
    }),
  );
}

function channelStartedEvent(
  entry: SkillEntry,
  aim: Direction,
  origin: TileCoord,
): GameEvent {
  return Object.freeze({
    type: "skill-channel-started" as const,
    competitorId: entry.competitorId,
    skillId: entry.skillId,
    aim,
    origin: freezeTile(origin),
    channelMs: skillChannelMs(entry.skillId),
  });
}

/**
 * The single place a channel outcome is decided. Presentation reads this event
 * instead of comparing `cooldownRemainingMs` against a magic threshold.
 */
function resolvedEvent(
  entry: SkillEntry,
  outcome: SkillOutcome,
  aim: Direction,
  origin: TileCoord,
  targets: readonly CompetitorId[] = [],
): GameEvent {
  return Object.freeze({
    type: "skill-resolved" as const,
    competitorId: entry.competitorId,
    skillId: entry.skillId,
    outcome,
    aim,
    origin: freezeTile(origin),
    targets: Object.freeze([...targets]),
  });
}

function movementFact(
  competitorId: CompetitorId,
  suppress: boolean,
  teleport: WorldPosition | null,
): TickFact {
  return Object.freeze({
    kind: "skill-movement" as const,
    competitorId,
    suppress,
    teleport: teleport ? freezePosition(teleport) : null,
  });
}

function pullLanding(
  origin: TileCoord,
  victim: TileCoord,
  solid: ReadonlySet<string>,
  crates: ReadonlySet<string>,
  bombs: readonly BombEntry[],
  reserved: ReadonlySet<string>,
): TileCoord {
  // Prefer adjacent tile toward caster; fallback to current if blocked.
  const dx = Math.sign(origin.x - victim.x);
  const dy = Math.sign(origin.y - victim.y);
  const candidates: TileCoord[] = [];
  if (dx !== 0 || dy !== 0) {
    candidates.push(wrapTile({ x: origin.x - dx, y: origin.y - dy }));
    candidates.push(wrapTile({ x: origin.x - dx, y: origin.y }));
    candidates.push(wrapTile({ x: origin.x, y: origin.y - dy }));
  }
  for (const d of ["up", "down", "left", "right"] as const) {
    candidates.push(wrapTile({
      x: origin.x + DIRECTION_DELTA[d].x,
      y: origin.y + DIRECTION_DELTA[d].y,
    }));
  }
  for (const tile of candidates) {
    const key = tileKey(tile);
    if (solid.has(key) || crates.has(key) || reserved.has(key) || bombAt(tile, bombs)) continue;
    return freezeTile(tile);
  }
  return freezeTile(victim);
}

function projectionCanFinish(
  ctx: SystemRunContext,
  projection: WorldPosition,
  bombEgressKeys: readonly string[],
): boolean {
  const arena = ctx.read("arena");
  const pressure = ctx.read("pressure");
  const bombs = ctx.read("bombs").items;
  const solid = effectiveSolidKeySet(arena, pressure);
  const crates = new Set(arena.crates.map(tileKey));
  return isStaticallyValid(
    projection,
    solid,
    crates,
    bombs,
    new Set(bombEgressKeys),
  );
}

// ── Skill lifecycle ──────────────────────────────────────────────────────────

type TickWork = {
  entry: SkillEntry;
  facts: TickFact[];
  events: GameEvent[];
  rejections: CommandRejection[];
};

function startChannel(
  entry: SkillEntry,
  channelMs: number,
  aim: Direction,
  projection: WorldPosition | null,
  bombEgressKeys: readonly string[] = [],
): SkillEntry {
  return freezeEntry({
    ...entry,
    phase: "channeling",
    channelRemainingMs: Math.max(0, channelMs - TICK_DURATION_MS),
    cooldownRemainingMs: 0,
    projection: projection ? freezePosition(projection) : null,
    bombEgressKeys: Object.freeze([...bombEgressKeys]),
    aimDirection: aim,
  });
}

function beginSkill(
  ctx: SystemRunContext,
  entry: SkillEntry,
  command: SystemRunContext["commands"][number] | undefined,
): TickWork {
  const rejections: CommandRejection[] = [];
  if (!command) return { entry, facts: [], events: [], rejections };

  const loco = findLocomotion(ctx.read("locomotion"), entry.competitorId);
  if (!loco) {
    rejections.push(reject(command, "skill-unavailable"));
    return { entry, facts: [], events: [], rejections };
  }

  const arena = ctx.read("arena");
  const pressure = ctx.read("pressure");
  const bombs = ctx.read("bombs").items;
  const solid = effectiveSolidKeySet(arena, pressure);
  const crates = new Set(arena.crates.map(tileKey));
  const aim = resolveAim(ctx, entry.competitorId, loco.lastDirection);
  const origin = tileOf(loco.position);
  const facts: TickFact[] = [];
  const events: GameEvent[] = [];

  switch (entry.skillId) {
    case RANNI_ICE_BLINK_SKILL_ID: {
      facts.push(movementFact(entry.competitorId, true, null));
      events.push(channelStartedEvent(entry, aim, origin));
      return {
        entry: startChannel(
          entry,
          RANNI_CHANNEL_MS,
          aim,
          loco.position,
          [...preOverlappingBombKeys(loco.position, bombs)].sort(),
        ),
        facts,
        events,
        rejections,
      };
    }
    case KILLER_BEE_WING_DASH_SKILL_ID: {
      const landing = computeDashLanding(
        loco.position, aim, KILLER_BEE_DASH_TILES, solid, crates, bombs,
      );
      facts.push(movementFact(entry.competitorId, true, null));
      events.push(channelStartedEvent(entry, aim, origin));
      return {
        entry: startChannel(entry, KILLER_BEE_CHANNEL_MS, aim, landing),
        facts,
        events,
        rejections,
      };
    }
    case CROCODILO_EMERALD_SURGE_SKILL_ID: {
      facts.push(movementFact(entry.competitorId, true, null));
      events.push(channelStartedEvent(entry, aim, origin));
      return {
        entry: startChannel(entry, CROCODILO_CHANNEL_MS, aim, null),
        facts,
        events,
        rejections,
      };
    }
    case THRESH_DEATH_SENTENCE_SKILL_ID: {
      facts.push(movementFact(entry.competitorId, true, null));
      events.push(channelStartedEvent(entry, aim, origin));
      return {
        entry: startChannel(entry, THRESH_CHANNEL_MS, aim, null),
        facts,
        events,
        rejections,
      };
    }
    case ZED_LIVING_SHADOW_SKILL_ID: {
      const landing = computeShadowPlacement(
        loco.position, aim, ZED_SHADOW_RANGE, solid, crates,
      );
      if (!landing) {
        rejections.push(reject(command, "skill-unavailable"));
        return { entry, facts: [], events: [], rejections };
      }
      events.push(channelStartedEvent(entry, aim, origin));
      // Free-move window: do not suppress locomotion. Projection is fixed.
      return {
        entry: startChannel(entry, ZED_CHANNEL_MS, aim, landing),
        facts: [],
        events,
        rejections,
      };
    }
    default: {
      rejections.push(reject(command, "skill-unavailable"));
      return { entry, facts: [], events: [], rejections };
    }
  }
}

function completeSkill(
  ctx: SystemRunContext,
  entry: SkillEntry,
  projection: WorldPosition | null,
): TickWork {
  const facts: TickFact[] = [];
  const arena = ctx.read("arena");
  const pressure = ctx.read("pressure");
  const bombs = ctx.read("bombs").items;
  const solid = effectiveSolidKeySet(arena, pressure);
  const crates = new Set(arena.crates.map(tileKey));
  const loco = findLocomotion(ctx.read("locomotion"), entry.competitorId);
  const origin = loco ? tileOf(loco.position) : freezeTile({ x: 0, y: 0 });
  const aim = entry.aimDirection ?? "down";

  switch (entry.skillId) {
    case RANNI_ICE_BLINK_SKILL_ID: {
      const dest = projection;
      // A blink "hits" when the spirit's landing survives validation.
      const committed = Boolean(dest && projectionCanFinish(ctx, dest, entry.bombEgressKeys));
      facts.push(movementFact(entry.competitorId, true, committed ? dest : null));
      return {
        entry: cooldown(entry),
        facts,
        events: [resolvedEvent(entry, committed ? "hit" : "miss", aim, origin)],
        rejections: [],
      };
    }
    case KILLER_BEE_WING_DASH_SKILL_ID: {
      facts.push(movementFact(entry.competitorId, true, projection));
      return {
        entry: cooldown(entry),
        facts,
        events: [resolvedEvent(entry, projection ? "hit" : "miss", aim, origin)],
        rejections: [],
      };
    }
    case CROCODILO_EMERALD_SURGE_SKILL_ID: {
      facts.push(movementFact(entry.competitorId, true, null));
      const hits = competitorsInChebyshev(
        ctx, origin, CROCODILO_SURGE_RANGE, entry.competitorId,
      );
      facts.push(...skillHitFacts(entry.skillId, entry.competitorId, hits, origin));
      return {
        entry: cooldown(entry),
        facts,
        events: [resolvedEvent(entry, hits.length > 0 ? "hit" : "miss", aim, origin, hits)],
        rejections: [],
      };
    }
    case THRESH_DEATH_SENTENCE_SKILL_ID: {
      facts.push(movementFact(entry.competitorId, true, null));
      const path = rayFreeTiles(
        origin, aim, THRESH_HOOK_RANGE, solid, crates, bombs, { stopOnBomb: false },
      );
      const hits = competitorsOnTiles(ctx, path, entry.competitorId);
      const victimId = hits[0];
      if (!victimId) {
        return {
          entry: cooldown(entry, THRESH_MISS_COOLDOWN_MS),
          facts,
          events: [resolvedEvent(entry, "miss", aim, origin)],
          rejections: [],
        };
      }
      const victimLoco = findLocomotion(ctx.read("locomotion"), victimId);
      if (victimLoco) {
        const landing = pullLanding(
          origin,
          tileOf(victimLoco.position),
          solid,
          crates,
          bombs,
          new Set([tileKey(origin)]),
        );
        facts.push(movementFact(victimId, false, tileCenter(landing)));
      }
      return {
        entry: cooldown(entry),
        facts,
        events: [resolvedEvent(entry, "hit", aim, origin, [victimId])],
        rejections: [],
      };
    }
    case ZED_LIVING_SHADOW_SKILL_ID: {
      // Completion is handled in tickChannel (swap vs timeout vs invalid).
      return {
        entry: cooldown(entry, ZED_FAIL_COOLDOWN_MS),
        facts,
        events: [resolvedEvent(entry, "cancelled", aim, origin)],
        rejections: [],
      };
    }
    default:
      return { entry: cooldown(entry), facts, events: [], rejections: [] };
  }
}

function tickChannel(
  ctx: SystemRunContext,
  entry: SkillEntry,
  ownCommands: readonly SystemRunContext["commands"][number][],
): TickWork {
  const rejections: CommandRejection[] = [];
  const facts: TickFact[] = [];
  const command = ownCommands[0];
  const loco = findLocomotion(ctx.read("locomotion"), entry.competitorId);
  const originTile = loco ? tileOf(loco.position) : freezeTile({ x: 0, y: 0 });
  const entryAim = entry.aimDirection ?? "down";
  for (const duplicate of ownCommands.slice(1)) {
    rejections.push(reject(duplicate, "skill-unavailable"));
  }

  // Ranni: steer projection while channeling.
  if (entry.skillId === RANNI_ICE_BLINK_SKILL_ID) {
    const projection = entry.projection;
    if (!projection) {
      return {
        entry: cooldown(entry),
        facts,
        events: [resolvedEvent(entry, "cancelled", entryAim, originTile)],
        rejections,
      };
    }
    const canCompleteManually = entry.channelRemainingMs < RANNI_CHANNEL_MS;
    const completionRequested = Boolean(command) && canCompleteManually;
    if (command && !canCompleteManually) {
      rejections.push(reject(command, "skill-unavailable"));
    }
    const intentEntry = findIntent(ctx.read("intent"), entry.competitorId);
    const direction = intentEntry ? activeDirection(intentEntry) : null;
    const attempted = direction
      ? wrapPosition({
          x: projection.x + DIRECTION_DELTA[direction].x * (BASE_SPEED_UNITS_PER_TICK / 2),
          y: projection.y + DIRECTION_DELTA[direction].y * (BASE_SPEED_UNITS_PER_TICK / 2),
        })
      : projection;
    const remaining = Math.max(0, entry.channelRemainingMs - TICK_DURATION_MS);
    const completes = completionRequested || remaining === 0;
    if (completes) {
      const work = completeSkill(ctx, entry, attempted);
      return { ...work, rejections: [...rejections, ...work.rejections] };
    }
    facts.push(movementFact(entry.competitorId, true, null));
    return {
      entry: freezeEntry({
        ...entry,
        channelRemainingMs: remaining,
        projection: attempted,
      }),
      facts,
      events: [],
      rejections,
    };
  }

  // Zed Living Shadow: fixed projection, free-move body, recast swap.
  if (entry.skillId === ZED_LIVING_SHADOW_SKILL_ID) {
    const projection = entry.projection;
    if (!projection) {
      return {
        entry: cooldown(entry, ZED_FAIL_COOLDOWN_MS),
        facts,
        events: [resolvedEvent(entry, "cancelled", entryAim, originTile)],
        rejections,
      };
    }
    const canCompleteManually = entry.channelRemainingMs < ZED_CHANNEL_MS;
    const swapRequested = Boolean(command) && canCompleteManually;
    if (command && !canCompleteManually) {
      rejections.push(reject(command, "skill-unavailable"));
    }
    const remaining = Math.max(0, entry.channelRemainingMs - TICK_DURATION_MS);

    if (swapRequested) {
      // Own bombs (body plant underfoot + free Living Shadow echo) never block
      // the swap landing — same-owner ordnance is intentional on the shadow tile.
      const ownBombKeys = ctx
        .read("bombs")
        .items.filter((bomb) => bomb.ownerId === entry.competitorId)
        .map((bomb) => tileKey(bomb.tile));
      const swapEgress = Object.freeze([
        ...new Set([...entry.bombEgressKeys, ...ownBombKeys]),
      ]);
      if (projectionCanFinish(ctx, projection, swapEgress)) {
        // Valid swap: body teleports to projection; clear projection; full CD.
        facts.push(movementFact(entry.competitorId, true, projection));
        return {
          entry: cooldown(entry, ZED_COOLDOWN_MS),
          facts,
          events: [resolvedEvent(entry, "hit", entryAim, originTile)],
          rejections,
        };
      }
      // Invalid swap: no teleport; fail CD (half of success window policy).
      return {
        entry: cooldown(entry, ZED_FAIL_COOLDOWN_MS),
        facts,
        events: [resolvedEvent(entry, "miss", entryAim, originTile)],
        rejections,
      };
    }

    if (remaining === 0) {
      // Timeout without swap: clear projection, fail CD, no teleport.
      return {
        entry: cooldown(entry, ZED_FAIL_COOLDOWN_MS),
        facts,
        events: [resolvedEvent(entry, "cancelled", entryAim, originTile)],
        rejections,
      };
    }

    // Free-move window: no skill-movement suppress; projection stays fixed.
    return {
      entry: freezeEntry({
        ...entry,
        channelRemainingMs: remaining,
      }),
      facts,
      events: [],
      rejections,
    };
  }

  // Early release for the surviving channel-then-fire skills.
  const earlyReleaseSkills = new Set<SkillId>([
    CROCODILO_EMERALD_SURGE_SKILL_ID,
    THRESH_DEATH_SENTENCE_SKILL_ID,
  ]);
  const remaining = Math.max(0, entry.channelRemainingMs - TICK_DURATION_MS);
  const early = Boolean(command) && earlyReleaseSkills.has(entry.skillId)
    && entry.channelRemainingMs < skillChannelMs(entry.skillId);
  if (command && !early) {
    // During first tick of channel, reject extra presses (dash family).
    if (!earlyReleaseSkills.has(entry.skillId)) {
      rejections.push(reject(command, "skill-unavailable"));
    } else if (entry.channelRemainingMs >= skillChannelMs(entry.skillId)) {
      rejections.push(reject(command, "skill-unavailable"));
    }
  }

  if (early || remaining === 0) {
    const work = completeSkill(ctx, entry, entry.projection);
    return { ...work, rejections: [...rejections, ...work.rejections] };
  }

  facts.push(movementFact(entry.competitorId, true, null));
  // Allow re-aim while channeling for beam-like skills.
  let aimDirection = entry.aimDirection;
  if (
    entry.skillId === THRESH_DEATH_SENTENCE_SKILL_ID
  ) {
    const intentEntry = findIntent(ctx.read("intent"), entry.competitorId);
    const dir = intentEntry ? activeDirection(intentEntry) : null;
    if (dir) aimDirection = dir;
  }
  return {
    entry: freezeEntry({ ...entry, channelRemainingMs: remaining, aimDirection }),
    facts,
    events: [],
    rejections,
  };
}

// ── Module systems ───────────────────────────────────────────────────────────

function initialSkills(config: MatchConfig): SkillsSlice {
  return Object.freeze({
    entries: Object.freeze(
      config.seats
        .filter((seat) => seat.skillId !== undefined)
        .map((seat) =>
          freezeEntry({
            competitorId: seat.competitorId,
            skillId: seat.skillId!,
            phase: "idle",
            channelRemainingMs: 0,
            cooldownRemainingMs: 0,
            projection: null,
            bombEgressKeys: Object.freeze([]),
            aimDirection: null,
          }),
        ),
    ),
  });
}

function runSkillsReset(ctx: SystemRunContext): SystemRunResult {
  if (factsOfKind(ctx.facts, "round-reset").length === 0) return {};
  return { writes: { skills: initialSkills(ctx.config) } };
}

function runSkillsDeathCleanup(ctx: SystemRunContext): SystemRunResult {
  const skills = ctx.read("skills");
  const vitals = ctx.read("vitals");
  const locomotion = ctx.read("locomotion");
  const events: GameEvent[] = [];
  const entries = skills.entries.map((entry) => {
    if (
      entry.skillId !== ZED_LIVING_SHADOW_SKILL_ID
      || entry.phase !== "channeling"
      || findVitals(vitals, entry.competitorId)?.alive !== false
    ) {
      return entry;
    }
    // Dying mid-channel is a cancel, not a miss — presentation must not play
    // the failed-swap recovery for a competitor who is already down.
    const loco = findLocomotion(locomotion, entry.competitorId);
    events.push(resolvedEvent(
      entry,
      "cancelled",
      entry.aimDirection ?? "down",
      loco ? tileOf(loco.position) : freezeTile({ x: 0, y: 0 }),
    ));
    return cooldown(entry, ZED_FAIL_COOLDOWN_MS);
  });
  if (events.length === 0) return {};
  return {
    writes: { skills: Object.freeze({ entries: Object.freeze(entries) }) },
    events: Object.freeze(events),
  };
}

function runSkills(ctx: SystemRunContext): SystemRunResult {
  const skills = ctx.read("skills");
  const match = ctx.read("match");
  const vitals = ctx.read("vitals");
  const commands = ctx.commands.filter(
    (command) => command.envelope.command.type === "use-skill",
  );
  type SkillCommand = (typeof commands)[number];
  const commandsByCompetitor = new Map<CompetitorId, SkillCommand[]>();
  for (const command of commands) {
    const list = commandsByCompetitor.get(command.competitorId) ?? [];
    list.push(command);
    commandsByCompetitor.set(command.competitorId, list);
  }
  const rejections: CommandRejection[] = [];
  const allFacts: TickFact[] = [];
  const allEvents: GameEvent[] = [];

  if (!isGameplayActive(match.phase)) {
    for (const command of commands) rejections.push(reject(command, "not-playing"));
    return { rejections };
  }

  const byCompetitor = new Map(
    skills.entries.map((entry) => [entry.competitorId, entry] as const),
  );

  const nextEntries = skills.entries.map((current) => {
    const alive = findVitals(vitals, current.competitorId)?.alive === true;
    const ownCommands = commandsByCompetitor.get(current.competitorId) ?? [];
    if (!alive) {
      for (const command of ownCommands) rejections.push(reject(command, "competitor-dead"));
      return current;
    }

    if (current.phase === "cooldown") {
      const remaining = Math.max(0, current.cooldownRemainingMs - TICK_DURATION_MS);
      if (remaining === 0) {
        for (const duplicate of ownCommands.slice(1)) {
          rejections.push(reject(duplicate, "skill-unavailable"));
        }
        if (!ownCommands[0]) return idle(current);
        // Cooldown just ended + press in same tick → activate.
        const work = beginSkill(ctx, idle(current), ownCommands[0]);
        rejections.push(...work.rejections);
        allFacts.push(...work.facts);
        allEvents.push(...work.events);
        return work.entry;
      }
      for (const command of ownCommands) rejections.push(reject(command, "skill-unavailable"));
      return freezeEntry({ ...current, cooldownRemainingMs: remaining });
    }

    if (current.phase === "idle") {
      for (const duplicate of ownCommands.slice(1)) {
        rejections.push(reject(duplicate, "skill-unavailable"));
      }
      if (!ownCommands[0]) return current;
      const work = beginSkill(ctx, current, ownCommands[0]);
      rejections.push(...work.rejections);
      allFacts.push(...work.facts);
      allEvents.push(...work.events);
      return work.entry;
    }

    // channeling
    const work = tickChannel(ctx, current, ownCommands);
    rejections.push(...work.rejections);
    allFacts.push(...work.facts);
    allEvents.push(...work.events);
    return work.entry;
  });

  for (const command of commands) {
    if (!byCompetitor.has(command.competitorId)) {
      const alive = findVitals(vitals, command.competitorId)?.alive === true;
      rejections.push(reject(command, alive ? "skill-unavailable" : "competitor-dead"));
    }
  }

  return {
    writes: { skills: Object.freeze({ entries: Object.freeze(nextEntries) }) },
    facts: Object.freeze(allFacts),
    events: Object.freeze(allEvents),
    rejections,
  };
}

function restoreSkills(raw: unknown, config: MatchConfig): SkillsSlice {
  if (!raw || typeof raw !== "object") throw new Error("slices.skills must be an object.");
  const rows = (raw as { entries?: unknown }).entries;
  if (!Array.isArray(rows)) throw new Error("slices.skills.entries must be an array.");
  const assigned = config.seats.filter((seat) => seat.skillId).map((seat) => ({
    competitorId: seat.competitorId,
    skillId: seat.skillId!,
  }));
  const entries = rows.map((value, index) => {
    if (!value || typeof value !== "object") {
      throw new Error(`slices.skills.entries[${index}] is invalid.`);
    }
    const row = value as Record<string, unknown>;
    const expected = assigned[index];
    if (!expected || row.competitorId !== expected.competitorId) {
      throw new Error("slices.skills.entries must follow assigned config seat order.");
    }
    if (typeof row.skillId !== "string" || !isSkillId(row.skillId) || row.skillId !== expected.skillId) {
      throw new Error(`slices.skills.entries[${index}].skillId is invalid.`);
    }
    if (typeof row.phase !== "string" || !PHASES.has(row.phase as SkillEntry["phase"])) {
      throw new Error(`slices.skills.entries[${index}].phase is invalid.`);
    }
    const phase = row.phase as SkillEntry["phase"];
    const channelRemainingMs = assertInteger(
      row.channelRemainingMs,
      `slices.skills.entries[${index}].channelRemainingMs`,
    );
    const cooldownRemainingMs = assertInteger(
      row.cooldownRemainingMs,
      `slices.skills.entries[${index}].cooldownRemainingMs`,
    );
    const maxChannel = skillChannelMs(row.skillId);
    const maxCooldown = skillCooldownMs(row.skillId);
    if (channelRemainingMs % TICK_DURATION_MS !== 0 || channelRemainingMs > maxChannel) {
      throw new Error(`slices.skills.entries[${index}].channelRemainingMs is invalid.`);
    }
    if (cooldownRemainingMs % TICK_DURATION_MS !== 0 || cooldownRemainingMs > maxCooldown) {
      throw new Error(`slices.skills.entries[${index}].cooldownRemainingMs is invalid.`);
    }
    const projection = row.projection === null ? null : wrapPosition(assertPosition(
      row.projection,
      `slices.skills.entries[${index}].projection`,
    ));
    if (!Array.isArray(row.bombEgressKeys) || row.bombEgressKeys.some((key) => typeof key !== "string")) {
      throw new Error(`slices.skills.entries[${index}].bombEgressKeys is invalid.`);
    }
    let aimDirection: Direction | null = null;
    if (row.aimDirection !== undefined && row.aimDirection !== null) {
      if (typeof row.aimDirection !== "string" || !DIRECTIONS.has(row.aimDirection as Direction)) {
        throw new Error(`slices.skills.entries[${index}].aimDirection is invalid.`);
      }
      aimDirection = row.aimDirection as Direction;
    }
    if (phase === "idle" && (projection || channelRemainingMs !== 0 || cooldownRemainingMs !== 0 || aimDirection)) {
      throw new Error(`slices.skills.entries[${index}] idle state is inconsistent.`);
    }
    if (phase === "channeling" && (channelRemainingMs === 0 || cooldownRemainingMs !== 0)) {
      throw new Error(`slices.skills.entries[${index}] channeling state is inconsistent.`);
    }
    if (phase === "cooldown" && (projection || channelRemainingMs !== 0 || cooldownRemainingMs === 0)) {
      throw new Error(`slices.skills.entries[${index}] cooldown state is inconsistent.`);
    }
    return freezeEntry({
      competitorId: row.competitorId as CompetitorId,
      skillId: row.skillId,
      phase,
      channelRemainingMs,
      cooldownRemainingMs,
      projection,
      bombEgressKeys: Object.freeze([...(row.bombEgressKeys as string[])]),
      aimDirection,
    });
  });
  if (entries.length !== assigned.length) {
    throw new Error("slices.skills.entries must list every assigned skill exactly once.");
  }
  return Object.freeze({ entries: Object.freeze(entries) });
}

export const skillsModule: ModuleSpec = Object.freeze({
  id: "skills",
  version: MODULE_VERSION,
  owns: Object.freeze(["skills"] as const),
  systems: Object.freeze([
    Object.freeze({
      id: "skills-reset-system",
      phase: "round-reset" as const,
      reads: Object.freeze(["skills"] as const),
      writes: Object.freeze(["skills"] as const),
      run: runSkillsReset,
    }),
    Object.freeze({
      id: "skills-system",
      phase: "skill" as const,
      reads: Object.freeze([
        "skills",
        "match",
        "vitals",
        "locomotion",
        "intent",
        "arena",
        "pressure",
        "bombs",
      ] as const),
      writes: Object.freeze(["skills"] as const),
      run: runSkills,
    }),
    Object.freeze({
      id: "skills-death-cleanup-system",
      phase: "round" as const,
      reads: Object.freeze(["skills", "vitals", "locomotion"] as const),
      writes: Object.freeze(["skills"] as const),
      run: runSkillsDeathCleanup,
    }),
  ]),
  codecs: Object.freeze({
    initial(config: MatchConfig) {
      return Object.freeze({ skills: initialSkills(config) });
    },
    restore(rawOwned: Readonly<Partial<Record<"skills", unknown>>>, config: MatchConfig) {
      return Object.freeze({ skills: restoreSkills(rawOwned.skills, config) });
    },
  }),
});
