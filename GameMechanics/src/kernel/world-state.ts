import type {
  CompetitorId,
  Direction,
  MatchConfig,
  MatchPhase,
  PowerUpType,
  RoundOutcome,
  ScoreEntry,
  SeatId,
  SkillId,
  TileCoord,
  Velocity,
  WorldPosition,
} from "../contracts.ts";
import {
  ROUND_END_MS,
  ROUND_START_MS,
  SPAWN_PROTECTION_MS,
  TICK_DURATION_MS,
} from "../contracts.ts";
import { cloneMatchConfig } from "../match-config.ts";

/** Re-export public fixed-point types from contracts (single structural source). */
export type { Velocity, WorldPosition, PowerUpType };

export const WORLD_FORMAT_VERSION = "world-5" as const;
export { ROUND_END_MS, ROUND_START_MS, SPAWN_PROTECTION_MS };
export const ARENA_WIDTH = 11;
export const ARENA_HEIGHT = 9;
/** Re-export of the neutral tick constant from contracts. */
export { TICK_DURATION_MS };
export const BOMB_FUSE_MS = 2_000;
export const FLAME_DURATION_MS = 600;
/**
 * Lethal window of a flame (Decision 012): a flame only kills while fresh —
 * `remainingMs > FLAME_DURATION_MS - FLAME_LETHAL_GRACE_MS`. After the grace
 * the tile keeps burning as residual VFX (fog) and walking into it is safe.
 * Chain reactions refresh remainingMs to FLAME_DURATION_MS, so a new blast on
 * the tile is lethal again.
 */
export const FLAME_LETHAL_GRACE_MS = 100;

/** True while a flame is fresh enough to kill (Decision 012). */
export function isFlameLethal(remainingMs: number): boolean {
  return remainingMs > FLAME_DURATION_MS - FLAME_LETHAL_GRACE_MS;
}

/** Fixed-point world units per arena tile (Decision 006). */
export const UNITS_PER_TILE = 1024;
/** Body AABB half-extent: 75% of a tile (384). Exact contact allowed. */
export const BODY_HALF_EXTENT = 384;
/** Base speed: 64 units/tick ⇒ exactly 1 tile in 16 ticks / 320 ms. */
export const BASE_SPEED_UNITS_PER_TICK = 64;
/** Lane assist activates only when transverse offset is at most this. */
export const LANE_ASSIST_MAX_OFFSET = 460;
/** Longitudinal advance requires transverse offset at most this. */
export const LANE_LONGITUDINAL_LOCK = 77;
/** Max transverse correction per tick (integer clamp to lane center). */
export const LANE_CORRECTION_MAX = 128;

/**
 * Four spawn-safe corner seats. Index 0/1 keep the classic 1v1 diagonal.
 * All four are always marked spawn-safe so arena crates stay seed-stable
 * regardless of roster size.
 */
export const CANONICAL_SPAWNS: readonly TileCoord[] = Object.freeze([
  Object.freeze({ x: 1, y: 1 }),
  Object.freeze({ x: ARENA_WIDTH - 2, y: ARENA_HEIGHT - 2 }),
  Object.freeze({ x: ARENA_WIDTH - 2, y: 1 }),
  Object.freeze({ x: 1, y: ARENA_HEIGHT - 2 }),
]);

export const DIRECTION_DELTA: Readonly<Record<Direction, TileCoord>> = Object.freeze({
  up: Object.freeze({ x: 0, y: -1 }),
  down: Object.freeze({ x: 0, y: 1 }),
  left: Object.freeze({ x: -1, y: 0 }),
  right: Object.freeze({ x: 1, y: 0 }),
});

export type FlameCause = Readonly<{
  bombId: number;
  ownerId: CompetitorId;
}>;

export type IntentEntry = Readonly<{
  competitorId: CompetitorId;
  pressedDirections: readonly Direction[];
}>;

/**
 * Continuous locomotion (Decision 006). Position is the sole spatial truth;
 * tile is always derived via {@link tileOf}. No moveElapsedMs.
 */
export type LocomotionEntry = Readonly<{
  competitorId: CompetitorId;
  position: WorldPosition;
  velocity: Velocity;
  lastDirection: Direction | null;
}>;

/** Identity-only roster (Decision 009). Power-up stats live in progression. */
export type RosterEntry = Readonly<{
  competitorId: CompetitorId;
  seatId: SeatId;
}>;

export type PickupItem = Readonly<{
  tile: TileCoord;
  type: PowerUpType;
}>;

export type ProgressionEntry = Readonly<{
  competitorId: CompetitorId;
  maxBombs: number;
  flameRange: number;
}>;

export type VitalsEntry = Readonly<{
  competitorId: CompetitorId;
  alive: boolean;
  /** Spawn protection remaining (ms). 0 = unprotected. Tick-aligned. */
  spawnProtectionRemainingMs: number;
}>;

export type BombEntry = Readonly<{
  id: number;
  ownerId: CompetitorId;
  tile: TileCoord;
  fuseMs: number;
  flameRange: number;
  /**
   * Living Shadow echo plant: real ordnance that shares owner/fuse rules but
   * does not consume a maxBombs capacity slot.
   */
  echo: boolean;
}>;

export type FlameEntry = Readonly<{
  tile: TileCoord;
  remainingMs: number;
  /** All canonical causes, ordered by bombId then ownerId — never last-writer. */
  causes: readonly FlameCause[];
}>;

/**
 * Competitive cycle owner (Decision 007). All clocks are explicit and
 * tick-aligned; no secret adapter timers.
 */
export type MatchSlice = Readonly<{
  phase: MatchPhase;
  roundNumber: number;
  /** Countdown for round-start / round-over intervals; 0 otherwise. */
  phaseRemainingMs: number;
  /** Competitive clock elapsed this round. */
  roundElapsedMs: number;
  /** Competitive clock remaining; 0 in sudden-death and after. */
  roundRemainingMs: number;
  /** Elapsed while in sudden-death. */
  suddenDeathElapsedMs: number;
  /** Wins per competitor in config seat order. */
  scores: readonly ScoreEntry[];
  roundOutcome: RoundOutcome | null;
  /** Set only in match-over. */
  matchWinner: CompetitorId | null;
}>;

export type ArenaSlice = Readonly<{
  width: number;
  height: number;
  solid: readonly TileCoord[];
  crates: readonly TileCoord[];
}>;

export type RosterSlice = Readonly<{
  entries: readonly RosterEntry[];
}>;

export type VitalsSlice = Readonly<{
  entries: readonly VitalsEntry[];
}>;

export type IntentSlice = Readonly<{
  entries: readonly IntentEntry[];
}>;

export type LocomotionSlice = Readonly<{
  entries: readonly LocomotionEntry[];
}>;

export type BombsSlice = Readonly<{
  nextId: number;
  items: readonly BombEntry[];
}>;

export type FlamesSlice = Readonly<{
  items: readonly FlameEntry[];
}>;

/**
 * Sudden-death physical pressure (Decision 008 / single-source).
 * Only the impacted prefix is persisted. Spiral path and active warning
 * are pure functions of Arena base solid + Match phase/clock — never a
 * second serialized truth.
 */
export type PressureClosing = Readonly<{
  index: number;
  tile: TileCoord;
  remainingMs: number;
}>;

export type PressureSlice = Readonly<{
  closedTiles: readonly TileCoord[];
}>;

/** Visible, still-available power-ups only (Decision 009). */
export type PickupsSlice = Readonly<{
  items: readonly PickupItem[];
}>;

/** Mutable power-up granted attributes — sole source for maxBombs/flameRange. */
export type ProgressionSlice = Readonly<{
  entries: readonly ProgressionEntry[];
}>;

export type SkillEntry = Readonly<{
  competitorId: CompetitorId;
  skillId: SkillId;
  phase: "idle" | "channeling" | "cooldown";
  channelRemainingMs: number;
  cooldownRemainingMs: number;
  projection: WorldPosition | null;
  /** Bomb tiles overlapped by the projection before placement, for monotone egress. */
  bombEgressKeys: readonly string[];
  /** Facing locked at cast (dash/beam/hook aim). Null when idle. */
  aimDirection: Direction | null;
}>;

export type SkillsSlice = Readonly<{
  entries: readonly SkillEntry[];
}>;

/** Base progression restored every round and at match start. */
export const PROGRESSION_BASE_MAX_BOMBS = 1 as const;
export const PROGRESSION_BASE_FLAME_RANGE = 1 as const;
/** Inclusive caps for bomb-up / flame-up progression. */
export const PROGRESSION_MAX_CAP = 5 as const;

/** Warning cadence: one new spiral target every 900 ms (45 ticks). */
export const PRESSURE_INTERVAL_MS = 900 as const;
/** Fall delay after warning: tile impacts 340 ms later (17 ticks). */
export const PRESSURE_FALL_MS = 340 as const;

export function warningAt(index: number): number {
  return index * PRESSURE_INTERVAL_MS;
}

export function impactAt(index: number): number {
  return index * PRESSURE_INTERVAL_MS + PRESSURE_FALL_MS;
}

/**
 * Outer-to-center rectangular spiral over the full grid, then filter base
 * solids. Starts at top-left of the outer ring; on the classic 11×9 toroidal
 * arena (Decision 011, 24 solids) the path has 75 tiles, first (1,0), last
 * center (5,4). Clockwise: top L→R, right T→B, bottom R→L, left B→T.
 */
export function buildPressurePath(
  width: number,
  height: number,
  solid: readonly TileCoord[],
): readonly TileCoord[] {
  const solidKeys = new Set(solid.map(tileKey));
  const spiral: TileCoord[] = [];
  let left = 0;
  let right = width - 1;
  let top = 0;
  let bottom = height - 1;

  while (left <= right && top <= bottom) {
    for (let x = left; x <= right; x += 1) {
      spiral.push(freezeTile({ x, y: top }));
    }
    for (let y = top + 1; y <= bottom; y += 1) {
      spiral.push(freezeTile({ x: right, y }));
    }
    if (bottom > top) {
      for (let x = right - 1; x >= left; x -= 1) {
        spiral.push(freezeTile({ x, y: bottom }));
      }
    }
    if (right > left) {
      for (let y = bottom - 1; y > top; y -= 1) {
        spiral.push(freezeTile({ x: left, y }));
      }
    }
    left += 1;
    right -= 1;
    top += 1;
    bottom -= 1;
  }

  return Object.freeze(spiral.filter((tile) => !solidKeys.has(tileKey(tile))));
}

/**
 * Canonical closed prefix + active warning from elapsed sudden-death clock.
 * Pure function of path + elapsed — no hidden cursor.
 */
export function derivePressureProgress(
  path: readonly TileCoord[],
  suddenDeathElapsedMs: number,
): Readonly<{
  closedTiles: readonly TileCoord[];
  closing: PressureClosing | null;
}> {
  const closed: TileCoord[] = [];
  for (let index = 0; index < path.length; index += 1) {
    const tile = path[index]!;
    const impactMs = impactAt(index);
    const warnMs = warningAt(index);
    if (suddenDeathElapsedMs >= impactMs) {
      closed.push(freezeTile(tile));
      continue;
    }
    if (suddenDeathElapsedMs >= warnMs) {
      return Object.freeze({
        closedTiles: Object.freeze(closed),
        closing: Object.freeze({
          index,
          tile: freezeTile(tile),
          remainingMs: impactMs - suddenDeathElapsedMs,
        }),
      });
    }
    break;
  }
  return Object.freeze({
    closedTiles: Object.freeze(closed),
    closing: null,
  });
}

/**
 * Active fall warning is only live during sudden-death. Terminal phases
 * freeze closedTiles and never carry an in-flight closing derivation.
 */
export function derivePressureClosing(
  path: readonly TileCoord[],
  match: MatchSlice,
): PressureClosing | null {
  if (match.phase !== "sudden-death") return null;
  return derivePressureProgress(path, match.suddenDeathElapsedMs).closing;
}

/**
 * Real competitive slices only. No meta/config phantoms.
 * config lives at the WorldState root (immutable match identity).
 */
export type WorldSlices = Readonly<{
  match: MatchSlice;
  arena: ArenaSlice;
  roster: RosterSlice;
  vitals: VitalsSlice;
  intent: IntentSlice;
  locomotion: LocomotionSlice;
  bombs: BombsSlice;
  flames: FlamesSlice;
  pressure: PressureSlice;
  pickups: PickupsSlice;
  progression: ProgressionSlice;
  skills: SkillsSlice;
}>;

/**
 * Deeply readonly, JSON-serializable world.
 * Only objects, arrays, and primitives — no Map/Set/function/symbol/clock/RNG.
 * mechanicsRevision identifies the executable gameplay rules for this world.
 */
export type WorldState = Readonly<{
  formatVersion: typeof WORLD_FORMAT_VERSION;
  mechanicsRevision: string;
  tick: number;
  stateRevision: number;
  config: MatchConfig;
  slices: WorldSlices;
}>;

/**
 * Classic toroidal wrap portals (Decision 011). Mid-edge border tiles that are
 * kept open even though the sparse border parity would make them solid.
 */
export const WRAP_PORTAL_TILES: readonly TileCoord[] = Object.freeze([
  Object.freeze({ x: 0, y: Math.floor(ARENA_HEIGHT / 2) }),
  Object.freeze({ x: ARENA_WIDTH - 1, y: Math.floor(ARENA_HEIGHT / 2) }),
  Object.freeze({ x: Math.floor(ARENA_WIDTH / 2), y: 0 }),
  Object.freeze({ x: Math.floor(ARENA_WIDTH / 2), y: ARENA_HEIGHT - 1 }),
]);

/** Positive modulo — the single torus normalization primitive. */
export function wrapAxis(value: number, span: number): number {
  const wrapped = value % span;
  return wrapped < 0 ? wrapped + span : wrapped;
}

/**
 * Canonical torus position: always in [0, width*UNITS) x [0, height*UNITS).
 * Bodies may straddle the seam; only the center is normalized (Decision 011).
 */
export function wrapPosition(
  position: WorldPosition,
  width: number = ARENA_WIDTH,
  height: number = ARENA_HEIGHT,
): WorldPosition {
  return freezePosition({
    x: wrapAxis(position.x, width * UNITS_PER_TILE),
    y: wrapAxis(position.y, height * UNITS_PER_TILE),
  });
}

/** Canonical torus tile: always inside [0,width) x [0,height). */
export function wrapTile(
  tile: TileCoord,
  width: number = ARENA_WIDTH,
  height: number = ARENA_HEIGHT,
): TileCoord {
  return freezeTile({
    x: wrapAxis(tile.x, width),
    y: wrapAxis(tile.y, height),
  });
}

/**
 * Shortest signed delta between two axis coordinates on the torus
 * (current - previous, chosen across the seam when shorter). Consistent
 * velocity/delta reporting across the wrap seam (Decision 011).
 */
export function wrapDelta(current: number, previous: number, span: number): number {
  let delta = current - previous;
  if (delta > span * 0.5) {
    delta -= span;
  } else if (delta < -span * 0.5) {
    delta += span;
  }
  return delta;
}

export function tileKey(tile: TileCoord): string {
  return `${tile.x},${tile.y}`;
}

export function compareTiles(left: TileCoord, right: TileCoord): number {
  return left.y - right.y || left.x - right.x;
}

export function freezeTile(tile: TileCoord): TileCoord {
  return Object.freeze({ x: tile.x, y: tile.y });
}

export function freezePosition(position: WorldPosition): WorldPosition {
  return Object.freeze({ x: position.x, y: position.y });
}

export function freezeVelocity(velocity: Velocity): Velocity {
  return Object.freeze({ x: velocity.x, y: velocity.y });
}

/** Derive tile from body-center position. Sole tile derivation path. */
export function tileOf(position: WorldPosition): TileCoord {
  return freezeTile({
    x: Math.floor(position.x / UNITS_PER_TILE),
    y: Math.floor(position.y / UNITS_PER_TILE),
  });
}

/** Spawn/center of a tile in fixed-point units. */
export function tileCenter(tile: TileCoord): WorldPosition {
  return freezePosition({
    x: tile.x * UNITS_PER_TILE + UNITS_PER_TILE / 2,
    y: tile.y * UNITS_PER_TILE + UNITS_PER_TILE / 2,
  });
}

/** Positive-area AABB overlap between two equal half-extent bodies. Exact contact is not overlap. */
export function bodiesOverlap(
  a: WorldPosition,
  b: WorldPosition,
  halfExtent: number = BODY_HALF_EXTENT,
): boolean {
  return (
    Math.abs(a.x - b.x) < halfExtent * 2
    && Math.abs(a.y - b.y) < halfExtent * 2
  );
}

/**
 * Integer overlap area between body AABB and a full tile square.
 * Exact edge contact has area 0 (not a hit). Shared neutral helper —
 * geometry constants BODY_HALF_EXTENT / UNITS_PER_TILE stay fixed.
 */
export function bodyTileOverlapArea(
  position: WorldPosition,
  tile: TileCoord,
  halfExtent: number = BODY_HALF_EXTENT,
): number {
  const left = position.x - halfExtent;
  const right = position.x + halfExtent;
  const top = position.y - halfExtent;
  const bottom = position.y + halfExtent;
  const tileLeft = tile.x * UNITS_PER_TILE;
  const tileRight = (tile.x + 1) * UNITS_PER_TILE;
  const tileTop = tile.y * UNITS_PER_TILE;
  const tileBottom = (tile.y + 1) * UNITS_PER_TILE;
  const width = Math.min(right, tileRight) - Math.max(left, tileLeft);
  const height = Math.min(bottom, tileBottom) - Math.max(top, tileTop);
  if (width <= 0 || height <= 0) return 0;
  return width * height;
}

/**
 * Positive-area overlap between body AABB and a full tile square.
 * Exact edge contact is allowed (not a hit).
 */
export function bodyOverlapsTile(
  position: WorldPosition,
  tile: TileCoord,
  halfExtent: number = BODY_HALF_EXTENT,
): boolean {
  return bodyTileOverlapArea(position, tile, halfExtent) > 0;
}

/**
 * Positive-area overlap between body AABB and a full tile square on the torus
 * (Decision 011). Uses the shortest wrapped delta per axis; unambiguous
 * because BODY_HALF_EXTENT + UNITS_PER_TILE/2 < span/2 on both axes.
 * Exact edge contact is allowed (not a hit).
 */
export function bodyOverlapsTileToroidal(
  position: WorldPosition,
  tile: TileCoord,
  halfExtent: number = BODY_HALF_EXTENT,
): boolean {
  const center = tileCenter(tile);
  const dx = wrapDelta(position.x, center.x, ARENA_WIDTH * UNITS_PER_TILE);
  const dy = wrapDelta(position.y, center.y, ARENA_HEIGHT * UNITS_PER_TILE);
  const reach = halfExtent + UNITS_PER_TILE / 2;
  return Math.abs(dx) < reach && Math.abs(dy) < reach;
}

/**
 * Strict full-body containment inside [0, w*UNITS) x [0, h*UNITS).
 * Legacy predicate only: on the toroidal arena (Decision 011) runtime
 * positions are kept canonical by wrapPosition and a body near the seam
 * legitimately straddles the edge, so locomotion no longer uses this.
 */
export function bodyWithinBounds(
  position: WorldPosition,
  width: number = ARENA_WIDTH,
  height: number = ARENA_HEIGHT,
  halfExtent: number = BODY_HALF_EXTENT,
): boolean {
  const maxX = width * UNITS_PER_TILE;
  const maxY = height * UNITS_PER_TILE;
  return (
    position.x - halfExtent >= 0
    && position.y - halfExtent >= 0
    && position.x + halfExtent <= maxX
    && position.y + halfExtent <= maxY
  );
}

export function assertSafeInteger(value: unknown, label: string): number {
  if (
    typeof value !== "number"
    || !Number.isInteger(value)
    || !Number.isSafeInteger(value)
  ) {
    throw new Error(`${label} must be a safe integer.`);
  }
  return value;
}

export function assertPosition(value: unknown, label: string): WorldPosition {
  if (!value || typeof value !== "object") {
    throw new Error(`${label} must be a position object.`);
  }
  const pos = value as { x?: unknown; y?: unknown };
  return freezePosition({
    x: assertSafeInteger(pos.x, `${label}.x`),
    y: assertSafeInteger(pos.y, `${label}.y`),
  });
}

export function assertVelocity(value: unknown, label: string): Velocity {
  if (!value || typeof value !== "object") {
    throw new Error(`${label} must be a velocity object.`);
  }
  const vel = value as { x?: unknown; y?: unknown };
  return freezeVelocity({
    x: assertSafeInteger(vel.x, `${label}.x`),
    y: assertSafeInteger(vel.y, `${label}.y`),
  });
}

export function cloneOutcome(outcome: RoundOutcome): RoundOutcome {
  return Object.freeze({ reason: outcome.reason, winner: outcome.winner });
}

export function cloneScores(scores: readonly ScoreEntry[]): readonly ScoreEntry[] {
  return Object.freeze(
    scores.map((entry) =>
      Object.freeze({ competitorId: entry.competitorId, wins: entry.wins }),
    ),
  );
}

/** Gameplay systems run in playing and sudden-death only. */
export function isGameplayActive(phase: MatchPhase): boolean {
  return phase === "playing" || phase === "sudden-death";
}

export function emptyScores(config: MatchConfig): readonly ScoreEntry[] {
  return Object.freeze(
    config.seats.map((seat) =>
      Object.freeze({ competitorId: seat.competitorId, wins: 0 }),
    ),
  );
}

/**
 * Stable 32-bit string hash (uint32). Shared by Arena crate density
 * and Powerups drop plan — do not reimplement per-module RNG cursors.
 */
export function hashUint32(value: string): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

function hashToUnit(value: string): number {
  return hashUint32(value) / 4_294_967_296;
}

function mirrorTile(tile: TileCoord): TileCoord {
  return {
    x: ARENA_WIDTH - 1 - tile.x,
    y: ARENA_HEIGHT - 1 - tile.y,
  };
}

/** Central-symmetry partner of a tile on the canonical arena. */
export function centralMirrorTile(tile: TileCoord): TileCoord {
  return freezeTile(mirrorTile(tile));
}

/** Stable pair key for two tiles (order-independent). */
export function symmetryPairKey(a: TileCoord, b: TileCoord): string {
  const ka = tileKey(a);
  const kb = tileKey(b);
  return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
}

/**
 * Sparse border parity (Decision 011): top/bottom rows are solid at even x,
 * left/right columns at even y; odd border tiles are open wrap gaps.
 * The four WRAP_PORTAL_TILES are never solid.
 */
function isSparseBorderSolid(x: number, y: number): boolean {
  const isBorder = x === 0 || y === 0 || x === ARENA_WIDTH - 1 || y === ARENA_HEIGHT - 1;
  if (!isBorder) return false;
  if (WRAP_PORTAL_TILES.some((tile) => tile.x === x && tile.y === y)) return false;
  if (y === 0 || y === ARENA_HEIGHT - 1) return x % 2 === 0;
  return y % 2 === 0;
}

function isInteriorCoord(x: number, y: number): boolean {
  return x > 0 && y > 0 && x < ARENA_WIDTH - 1 && y < ARENA_HEIGHT - 1;
}

/** Classic pillar seeds; central mirrors complete the 8-pillar set. */
const PILLAR_SEEDS: readonly TileCoord[] = Object.freeze([
  Object.freeze({ x: 3, y: 3 }),
  Object.freeze({ x: 5, y: 3 }),
  Object.freeze({ x: 2, y: 4 }),
  Object.freeze({ x: 4, y: 2 }),
]);

/** Classic forced crates (D2-symmetric as a set). */
const FORCED_CRATE_TILES: readonly TileCoord[] = Object.freeze([
  Object.freeze({ x: 2, y: 3 }),
  Object.freeze({ x: ARENA_WIDTH - 3, y: 3 }),
  Object.freeze({ x: 2, y: ARENA_HEIGHT - 4 }),
  Object.freeze({ x: ARENA_WIDTH - 3, y: ARENA_HEIGHT - 4 }),
]);

/** Spawn + x±1 + one tile vertically toward center (interior only). */
function spawnSafeKeys(): ReadonlySet<string> {
  const safe = new Set<string>();
  const add = (x: number, y: number): void => {
    if (isInteriorCoord(x, y)) safe.add(tileKey({ x, y }));
  };
  for (const spawn of CANONICAL_SPAWNS) {
    const towardCenterY = spawn.y < ARENA_HEIGHT / 2 ? 1 : -1;
    add(spawn.x, spawn.y);
    add(spawn.x + 1, spawn.y);
    add(spawn.x - 1, spawn.y);
    add(spawn.x, spawn.y + towardCenterY);
  }
  return safe;
}

/** Center cross + portal lane tiles, kept crate-free (interior only). */
function strategicOpenKeys(): ReadonlySet<string> {
  const open = new Set<string>();
  const add = (x: number, y: number): void => {
    if (isInteriorCoord(x, y)) open.add(tileKey({ x, y }));
  };
  const middleX = Math.floor(ARENA_WIDTH / 2);
  const middleY = Math.floor(ARENA_HEIGHT / 2);
  for (const tile of [
    { x: middleX, y: middleY },
    { x: middleX - 1, y: middleY },
    { x: middleX + 1, y: middleY },
    { x: middleX, y: middleY - 1 },
    { x: middleX, y: middleY + 1 },
    { x: 1, y: middleY },
    { x: Math.min(2, ARENA_WIDTH - 2), y: middleY },
    { x: ARENA_WIDTH - 2, y: middleY },
    { x: Math.max(ARENA_WIDTH - 3, 1), y: middleY },
    { x: middleX, y: 1 },
    { x: middleX, y: ARENA_HEIGHT - 2 },
  ]) {
    add(tile.x, tile.y);
  }
  return open;
}

/** D2-stable hash input: smallest of the 4 reflected tile-key variants. */
function d2MinVariantKey(x: number, y: number): string {
  const variants = [
    tileKey({ x, y }),
    tileKey({ x: ARENA_WIDTH - 1 - x, y }),
    tileKey({ x, y: ARENA_HEIGHT - 1 - y }),
    tileKey({ x: ARENA_WIDTH - 1 - x, y: ARENA_HEIGHT - 1 - y }),
  ].sort();
  return variants[0]!;
}

const CLASSIC_CRATE_DENSITY = 0.97;

/**
 * Classic 11x9 arena (Decision 011): sparse border with 4 wrap portals,
 * 8 D2 pillars, spawn-safe corners and strategic-open lanes. Structure is
 * fixed; only crate selection uses the per-round seed hash (D2-preserved
 * via the min-of-4-variant key) so crates still vary per round.
 */
export function createArenaTiles(seed: string): Readonly<{
  solid: readonly TileCoord[];
  crates: readonly TileCoord[];
}> {
  const solidKeys = new Set<string>();
  for (let y = 0; y < ARENA_HEIGHT; y += 1) {
    for (let x = 0; x < ARENA_WIDTH; x += 1) {
      if (isSparseBorderSolid(x, y)) solidKeys.add(tileKey({ x, y }));
    }
  }
  for (const seedTile of PILLAR_SEEDS) {
    solidKeys.add(tileKey(seedTile));
    solidKeys.add(tileKey(mirrorTile(seedTile)));
  }

  const spawnSafe = spawnSafeKeys();
  const strategicOpen = strategicOpenKeys();
  const forced = new Set<string>();
  for (const tile of FORCED_CRATE_TILES) {
    const key = tileKey(tile);
    if (!solidKeys.has(key) && !spawnSafe.has(key) && !strategicOpen.has(key)) {
      forced.add(key);
    }
  }

  const crateKeys = new Set<string>();
  for (let y = 1; y < ARENA_HEIGHT - 1; y += 1) {
    for (let x = 1; x < ARENA_WIDTH - 1; x += 1) {
      const key = tileKey({ x, y });
      if (solidKeys.has(key) || spawnSafe.has(key) || strategicOpen.has(key)) continue;
      if (forced.has(key) || hashToUnit(`${seed}|${d2MinVariantKey(x, y)}|breakable`) < CLASSIC_CRATE_DENSITY) {
        crateKeys.add(key);
      }
    }
  }

  const solid = Object.freeze(
    [...solidKeys]
      .map((key) => {
        const [x = 0, y = 0] = key.split(",").map(Number);
        return freezeTile({ x, y });
      })
      .sort(compareTiles),
  );
  const crates = Object.freeze(
    [...crateKeys]
      .map((key) => {
        const [x = 0, y = 0] = key.split(",").map(Number);
        return freezeTile({ x, y });
      })
      .sort(compareTiles),
  );
  return { solid, crates };
}

export function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  Object.freeze(value);
  for (const key of Object.keys(value as object)) {
    deepFreeze((value as Record<string, unknown>)[key]);
  }
  return value;
}

export function solidKeySet(arena: ArenaSlice): ReadonlySet<string> {
  return new Set(arena.solid.map(tileKey));
}

/**
 * Effective movement/blast solid: Arena base solid union Pressure closed tiles.
 * Computed on demand — never persisted as a duplicated union.
 */
export function effectiveSolidKeySet(
  arena: ArenaSlice,
  pressure: PressureSlice,
): ReadonlySet<string> {
  const keys = new Set(arena.solid.map(tileKey));
  for (const tile of pressure.closedTiles) {
    keys.add(tileKey(tile));
  }
  return keys;
}

/** Effective solid tiles sorted uniquely for snapshot projection. */
export function effectiveSolidTiles(
  arena: ArenaSlice,
  pressure: PressureSlice,
): readonly TileCoord[] {
  const keys = effectiveSolidKeySet(arena, pressure);
  return Object.freeze(
    [...keys]
      .map((key) => {
        const [x = 0, y = 0] = key.split(",").map(Number);
        return freezeTile({ x, y });
      })
      .sort(compareTiles),
  );
}

export function crateKeySet(arena: ArenaSlice): ReadonlySet<string> {
  return new Set(arena.crates.map(tileKey));
}

export function bombKeySet(bombs: BombsSlice): ReadonlySet<string> {
  return new Set(bombs.items.map((bomb) => tileKey(bomb.tile)));
}

export function activeDirection(entry: IntentEntry): Direction | null {
  return entry.pressedDirections[entry.pressedDirections.length - 1] ?? null;
}

export function findIntent(
  intent: IntentSlice,
  competitorId: CompetitorId,
): IntentEntry | undefined {
  return intent.entries.find((entry) => entry.competitorId === competitorId);
}

export function findLocomotion(
  locomotion: LocomotionSlice,
  competitorId: CompetitorId,
): LocomotionEntry | undefined {
  return locomotion.entries.find((entry) => entry.competitorId === competitorId);
}

export function findRoster(
  roster: RosterSlice,
  competitorId: CompetitorId,
): RosterEntry | undefined {
  return roster.entries.find((entry) => entry.competitorId === competitorId);
}

export function findProgression(
  progression: ProgressionSlice,
  competitorId: CompetitorId,
): ProgressionEntry | undefined {
  return progression.entries.find((entry) => entry.competitorId === competitorId);
}

export function findVitals(
  vitals: VitalsSlice,
  competitorId: CompetitorId,
): VitalsEntry | undefined {
  return vitals.entries.find((entry) => entry.competitorId === competitorId);
}

export function countActiveBombs(bombs: BombsSlice, competitorId: CompetitorId): number {
  // Echo bombs are free extras and must not fill maxBombs capacity.
  return bombs.items.filter(
    (bomb) => bomb.ownerId === competitorId && !bomb.echo,
  ).length;
}

export function competitorIdBySeat(config: MatchConfig, seatId: SeatId): CompetitorId | undefined {
  const assignment = config.seats.find((seat) => seat.seatId === seatId);
  return assignment?.competitorId;
}

// ── Shared restore primitives used by vertical codecs ──────────────────────

export function assertInteger(value: unknown, label: string, min = 0): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min) {
    throw new Error(`${label} must be an integer >= ${min}.`);
  }
  return value;
}

export function assertTile(value: unknown, label: string): TileCoord {
  if (!value || typeof value !== "object") {
    throw new Error(`${label} must be a tile object.`);
  }
  const tile = value as { x?: unknown; y?: unknown };
  return freezeTile({
    x: assertInteger(tile.x, `${label}.x`, Number.MIN_SAFE_INTEGER),
    y: assertInteger(tile.y, `${label}.y`, Number.MIN_SAFE_INTEGER),
  });
}

export function assertTileInBounds(
  tile: TileCoord,
  width: number,
  height: number,
  label: string,
): void {
  if (tile.x < 0 || tile.y < 0 || tile.x >= width || tile.y >= height) {
    throw new Error(`${label} is out of arena bounds.`);
  }
}

export function assertCompetitorOrder(
  entries: readonly { competitorId: string }[],
  seatOrder: readonly CompetitorId[],
  label: string,
): void {
  if (entries.length !== seatOrder.length) {
    throw new Error(`${label} must list every competitor exactly once.`);
  }
  for (let index = 0; index < seatOrder.length; index += 1) {
    if (entries[index]?.competitorId !== seatOrder[index]) {
      throw new Error(`${label} must follow config seat order.`);
    }
  }
}

export function tilesEqualSorted(
  left: readonly TileCoord[],
  right: readonly TileCoord[],
): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    const a = left[index]!;
    const b = right[index]!;
    if (a.x !== b.x || a.y !== b.y) return false;
  }
  return true;
}

export function assertTilesSortedUnique(
  tiles: readonly TileCoord[],
  label: string,
): void {
  const seen = new Set<string>();
  for (let index = 0; index < tiles.length; index += 1) {
    const tile = tiles[index]!;
    const key = tileKey(tile);
    if (seen.has(key)) {
      throw new Error(`${label} has duplicate tile ${key}.`);
    }
    seen.add(key);
    if (index > 0) {
      const prev = tiles[index - 1]!;
      if (compareTiles(prev, tile) >= 0) {
        throw new Error(`${label} must be sorted by tile (y,x) ascending.`);
      }
    }
  }
}

/** Root config clone used when assembling worlds. */
export function freezeConfig(config: MatchConfig): MatchConfig {
  return cloneMatchConfig(config);
}
