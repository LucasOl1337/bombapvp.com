/**
 * Pure competitive brawler bot.
 *
 * Observes a frozen GameSnapshot, the SeatId it controls, and a caller-supplied
 * BotPrng, and returns ordinary GameCommands (the same movement press/release +
 * place-bomb envelope a human produces). It never mutates the kernel and has no
 * privileged path into the simulation; the facade queues these commands like any
 * other input. A typed BotDecision is the internal currency, translated to
 * commands by the thin translateDecision adapter.
 *
 * Priorities, highest first:
 *   1. Survive  - step out of any tile a live bomb blast or flame covers.
 *   2. Strike   - bomb an adjacent crate or an aligned, in-range opponent, but
 *                 only when a reachable safe tile still exists afterwards.
 *   3. Retreat  - immediately after bombing, step toward that safe tile.
 *   4. Pursue   - otherwise walk one step along the shortest clear path toward
 *                 the nearest opponent, falling back to the nearest crate.
 */
import {
  BASE_SPEED_UNITS_PER_TICK,
  BODY_HALF_EXTENT,
  BOMB_FUSE_MS,
  DIRECTION_DELTA,
  FLAME_DURATION_MS,
  TICK_DURATION_MS,
  UNITS_PER_TILE,
  tileCenter,
  tileOf,
} from "../kernel/world-state.ts";
import type {
  BombSnapshot,
  CompetitorId,
  CompetitorSnapshot,
  Direction,
  GameCommand,
  GameSnapshot,
  SeatId,
  TileCoord,
} from "../contracts.ts";
import type { BotPrng } from "./prng.ts";

const BOMB_COOLDOWN_TICKS = 12;

export type BotIntent =
  | Readonly<{ kind: "idle" }>
  | Readonly<{ kind: "move"; direction: Direction }>;

export type BotDecision = Readonly<{
  intent: BotIntent;
  placeBomb: boolean;
}>;

export type BotMemory = {
  pressed: Direction | null;
  cooldownTicks: number;
  retreat: Direction | null;
  roundNumber: number;
};

export function createBotMemory(): BotMemory {
  return { pressed: null, cooldownTicks: 0, retreat: null, roundNumber: 0 };
}

type DangerWindow = Readonly<{ startsMs: number; endsMs: number }>;

type Grid = Readonly<{
  width: number;
  height: number;
  solid: ReadonlySet<string>;
  blocked: ReadonlySet<string>;
  occupied: ReadonlySet<string>;
  danger: ReadonlySet<string>;
  dangerWindows: ReadonlyMap<string, readonly DangerWindow[]>;
  bombTiles: ReadonlySet<string>;
  crates: ReadonlySet<string>;
  /** Arena centre in tile space — the last region the pressure spiral closes. */
  center: TileCoord;
}>;

const STEP_DIRECTIONS: readonly Direction[] = ["up", "down", "left", "right"];
const TILE_TRAVEL_MS = (UNITS_PER_TILE / BASE_SPEED_UNITS_PER_TICK) * TICK_DURATION_MS;
const BLAST_CLEARANCE_MS = Math.ceil(
  (BODY_HALF_EXTENT / BASE_SPEED_UNITS_PER_TICK) * TICK_DURATION_MS,
);

function key(x: number, y: number): string {
  return x + "," + y;
}

function tileKey(tile: TileCoord): string {
  return key(tile.x, tile.y);
}

function inBounds(grid: Grid, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < grid.width && y < grid.height;
}

/** Torus wrap of a tile coordinate (Decision 011) — open border gaps re-enter on the opposite edge. */
function wrapCoord(grid: Grid, x: number, y: number): TileCoord {
  return {
    x: ((x % grid.width) + grid.width) % grid.width,
    y: ((y % grid.height) + grid.height) % grid.height,
  };
}

/** Blast walk stops at solid, at a crate, and at the grid edge — flames never wrap. */
function blastTiles(
  bomb: BombSnapshot,
  solid: ReadonlySet<string>,
  crates: ReadonlySet<string>,
  width: number,
  height: number,
): TileCoord[] {
  const tiles: TileCoord[] = [{ x: bomb.tile.x, y: bomb.tile.y }];
  for (const dir of STEP_DIRECTIONS) {
    const delta = DIRECTION_DELTA[dir];
    for (let step = 1; step <= bomb.flameRange; step += 1) {
      const tx = bomb.tile.x + delta.x * step;
      const ty = bomb.tile.y + delta.y * step;
      if (tx < 0 || ty < 0 || tx >= width || ty >= height) break;
      const k = key(tx, ty);
      if (solid.has(k)) break;
      tiles.push({ x: tx, y: ty });
      if (crates.has(k)) break;
    }
  }
  return tiles;
}

function addDangerWindow(
  danger: Set<string>,
  dangerWindows: Map<string, DangerWindow[]>,
  tile: TileCoord,
  startsMs: number,
  endsMs: number,
): void {
  const k = tileKey(tile);
  danger.add(k);
  const windows = dangerWindows.get(k) ?? [];
  windows.push({ startsMs, endsMs });
  dangerWindows.set(k, windows);
}

function buildGrid(snapshot: GameSnapshot, selfId: CompetitorId): Grid {
  const solid = new Set<string>();
  for (const tile of snapshot.arena.solid) solid.add(tileKey(tile));
  const crates = new Set<string>();
  for (const tile of snapshot.arena.crates) crates.add(tileKey(tile));
  const blocked = new Set<string>(solid);
  for (const k of crates) blocked.add(k);
  // A stationary body rejects an attempted move in the kernel. Keep occupied
  // tiles separate: bomb escape must honor them, while sudden-death routing can
  // still plan around a live moving opponent instead of treating it as a wall.
  const occupied = new Set<string>();
  for (const competitor of snapshot.competitors) {
    if (competitor.alive && competitor.id !== selfId) {
      occupied.add(tileKey(competitor.tile));
    }
  }
  const bombTiles = new Set<string>();
  for (const bomb of snapshot.bombs) bombTiles.add(tileKey(bomb.tile));
  const danger = new Set<string>();
  const dangerWindows = new Map<string, DangerWindow[]>();
  for (const flame of snapshot.flames) {
    addDangerWindow(danger, dangerWindows, flame.tile, 0, flame.remainingMs);
  }
  for (const bomb of snapshot.bombs) {
    for (const tile of blastTiles(bomb, solid, crates, snapshot.arena.width, snapshot.arena.height)) {
      addDangerWindow(
        danger,
        dangerWindows,
        tile,
        bomb.fuseMs,
        bomb.fuseMs + FLAME_DURATION_MS,
      );
    }
    if (bomb.ownerId === selfId) {
      addDangerWindow(
        danger,
        dangerWindows,
        bomb.tile,
        0,
        bomb.fuseMs + FLAME_DURATION_MS,
      );
    }
  }
  // Sudden-death pressure: the tile that is actively falling becomes lethal on
  // impact. Treat it as danger so the bot vacates before it closes; already
  // closed tiles are unioned into arena.solid and thus already blocked.
  if (snapshot.pressure.closing) {
    addDangerWindow(
      danger,
      dangerWindows,
      snapshot.pressure.closing.tile,
      snapshot.pressure.closing.remainingMs,
      Number.POSITIVE_INFINITY,
    );
  }
  return Object.freeze({
    width: snapshot.arena.width,
    height: snapshot.arena.height,
    solid,
    blocked,
    occupied,
    danger,
    dangerWindows,
    bombTiles,
    crates,
    center: {
      x: Math.floor(snapshot.arena.width / 2),
      y: Math.floor(snapshot.arena.height / 2),
    },
  });
}

function isWalkable(grid: Grid, tile: TileCoord): boolean {
  const k = tileKey(tile);
  return inBounds(grid, tile.x, tile.y) && !grid.blocked.has(k) && !grid.bombTiles.has(k);
}

function neighbours(
  grid: Grid,
  tile: TileCoord,
): { tile: TileCoord; direction: Direction }[] {
  const out: { tile: TileCoord; direction: Direction }[] = [];
  for (const direction of STEP_DIRECTIONS) {
    const delta = DIRECTION_DELTA[direction];
    // Torus (Decision 011): stepping off an open border gap re-enters on the
    // opposite edge; solid border tiles still block.
    const next = wrapCoord(grid, tile.x + delta.x, tile.y + delta.y);
    if (isWalkable(grid, next)) {
      out.push({ tile: next, direction });
    }
  }
  return out;
}

function bfsStep(
  grid: Grid,
  start: TileCoord,
  isGoal: (tile: TileCoord) => boolean,
  passDanger: boolean,
): Direction | null {
  if (isGoal(start)) return null;
  const visited = new Set<string>([tileKey(start)]);
  const queue: { tile: TileCoord; first: Direction }[] = [];
  for (const entry of neighbours(grid, start)) {
    const k = tileKey(entry.tile);
    if (visited.has(k)) continue;
    if (!passDanger && grid.danger.has(k)) continue;
    visited.add(k);
    if (isGoal(entry.tile)) return entry.direction;
    queue.push({ tile: entry.tile, first: entry.direction });
  }
  let head = 0;
  while (head < queue.length) {
    const current = queue[head]!;
    head += 1;
    for (const entry of neighbours(grid, current.tile)) {
      const k = tileKey(entry.tile);
      if (visited.has(k)) continue;
      if (!passDanger && grid.danger.has(k)) continue;
      visited.add(k);
      if (isGoal(entry.tile)) return current.first;
      queue.push({ tile: entry.tile, first: current.first });
    }
  }
  return null;
}

function isDanger(grid: Grid, tile: TileCoord): boolean {
  return grid.danger.has(tileKey(tile));
}

function isTileSafeDuring(
  grid: Grid,
  tile: TileCoord,
  entersMs: number,
  leavesMs: number,
): boolean {
  const windows = grid.dangerWindows.get(tileKey(tile));
  if (!windows) return true;
  return windows.every((window) => leavesMs <= window.startsMs || entersMs >= window.endsMs);
}

/**
 * A tile is safe to *rest* on only if neither it nor any orthogonally adjacent
 * tile is dangerous. The body can clip an adjacent blast tile even when its
 * centre tile is clear, so resting flush against a blast counts as unsafe.
 */
function isRestSafe(grid: Grid, tile: TileCoord): boolean {
  if (isDanger(grid, tile)) return false;
  for (const direction of STEP_DIRECTIONS) {
    const delta = DIRECTION_DELTA[direction];
    const adjacent = wrapCoord(grid, tile.x + delta.x, tile.y + delta.y);
    if (isDanger(grid, adjacent)) return false;
  }
  return true;
}

/**
 * Direction toward a rest-safe tile without occupying any route tile while one
 * of its active or pending danger windows is live. BFS depth is converted to
 * the bot's real tile traversal time, so a blast line may only be crossed when
 * the body clears it before the fuse expires (or after an existing flame ends).
 */
function stepToSafety(grid: Grid, start: TileCoord): Direction | null {
  if (isRestSafe(grid, start)) return null;
  const visited = new Set<string>([tileKey(start)]);
  const queue: { tile: TileCoord; first: Direction; depth: number }[] = [];
  for (const entry of neighbours(grid, start)) {
    const entersMs = 0;
    const leavesMs = TILE_TRAVEL_MS + BLAST_CLEARANCE_MS;
    const k = tileKey(entry.tile);
    if (visited.has(k) || !isTileSafeDuring(grid, entry.tile, entersMs, leavesMs)) continue;
    visited.add(k);
    if (isRestSafe(grid, entry.tile)) return entry.direction;
    queue.push({ tile: entry.tile, first: entry.direction, depth: 1 });
  }
  let head = 0;
  while (head < queue.length) {
    const current = queue[head]!;
    head += 1;
    for (const entry of neighbours(grid, current.tile)) {
      const k = tileKey(entry.tile);
      if (visited.has(k)) continue;
      const entersMs = current.depth * TILE_TRAVEL_MS - BLAST_CLEARANCE_MS;
      const leavesMs = (current.depth + 1) * TILE_TRAVEL_MS + BLAST_CLEARANCE_MS;
      if (!isTileSafeDuring(grid, entry.tile, entersMs, leavesMs)) continue;
      visited.add(k);
      if (isRestSafe(grid, entry.tile)) return current.first;
      queue.push({ tile: entry.tile, first: current.first, depth: current.depth + 1 });
    }
  }
  return null;
}

/**
 * Sudden-death drift: one step along the shortest clear, non-dangerous path
 * toward the arena centre — the region the pressure spiral closes last. When
 * already resting safely near the centre this yields null and the caller idles.
 * Keeping the body flowing inward is what lets the bot outlast the shrinking
 * safe region right up to the tick no open tile survives.
 */
function stepTowardCenter(grid: Grid, start: TileCoord): Direction | null {
  const target = grid.center;
  const toward = bfsStep(grid, start, (tile) => sameTile(tile, target), false);
  if (toward) return toward;
  // Centre itself may be blocked/closed; approach its immediate ring instead.
  return bfsStep(grid, start, (tile) => manhattan(tile, target) <= 1, false);
}

function manhattan(a: TileCoord, b: TileCoord): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function sameTile(a: TileCoord, b: TileCoord): boolean {
  return a.x === b.x && a.y === b.y;
}

function nearestOpponent(
  snapshot: GameSnapshot,
  selfId: CompetitorId,
  selfTile: TileCoord,
): CompetitorSnapshot | null {
  let best: CompetitorSnapshot | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const competitor of snapshot.competitors) {
    if (competitor.id === selfId || !competitor.alive) continue;
    const score =
      manhattan(selfTile, competitor.tile) * 1_000 + competitor.tile.y * 32 + competitor.tile.x;
    if (score < bestScore) {
      bestScore = score;
      best = competitor;
    }
  }
  return best;
}

function alignedWithinRange(
  grid: Grid,
  origin: TileCoord,
  target: TileCoord,
  range: number,
): boolean {
  if (origin.x !== target.x && origin.y !== target.y) return false;
  const distance = manhattan(origin, target);
  if (distance === 0 || distance > range) return false;
  const dx = Math.sign(target.x - origin.x);
  const dy = Math.sign(target.y - origin.y);
  for (let step = 1; step < distance; step += 1) {
    if (grid.blocked.has(key(origin.x + dx * step, origin.y + dy * step))) return false;
  }
  return true;
}

function adjacentCrate(grid: Grid, tile: TileCoord): boolean {
  for (const direction of STEP_DIRECTIONS) {
    const delta = DIRECTION_DELTA[direction];
    const adjacent = wrapCoord(grid, tile.x + delta.x, tile.y + delta.y);
    if (grid.crates.has(key(adjacent.x, adjacent.y))) return true;
  }
  return false;
}

function projectBomb(grid: Grid, tile: TileCoord, flameRange: number): Grid {
  const hypothetical: BombSnapshot = {
    id: -1,
    ownerId: "" as CompetitorId,
    tile,
    fuseMs: BOMB_FUSE_MS,
    flameRange,
  };
  const danger = new Set(grid.danger);
  const dangerWindows = new Map<string, DangerWindow[]>();
  for (const [k, windows] of grid.dangerWindows) dangerWindows.set(k, [...windows]);
  for (const t of blastTiles(hypothetical, grid.solid, grid.crates, grid.width, grid.height)) {
    addDangerWindow(
      danger,
      dangerWindows,
      t,
      hypothetical.fuseMs,
      hypothetical.fuseMs + FLAME_DURATION_MS,
    );
  }
  return Object.freeze({
    ...grid,
    blocked: new Set([...grid.blocked, ...grid.occupied]),
    danger,
    dangerWindows,
    bombTiles: new Set([...grid.bombTiles, tileKey(tile)]),
  });
}

function bombLeavesEscape(grid: Grid, tile: TileCoord, flameRange: number): boolean {
  return stepToSafety(projectBomb(grid, tile, flameRange), tile) !== null;
}

function projectRetreat(grid: Grid, here: TileCoord, flameRange: number): Direction | null {
  return stepToSafety(projectBomb(grid, here, flameRange), here);
}

function directionTowardTileCenter(self: CompetitorSnapshot): Direction | null {
  const center = tileCenter(tileOf(self.position));
  const dx = center.x - self.position.x;
  const dy = center.y - self.position.y;
  if (dx === 0 && dy === 0) return null;
  if (Math.abs(dx) >= Math.abs(dy)) return dx < 0 ? "left" : "right";
  return dy < 0 ? "up" : "down";
}

function jitteredMove(
  grid: Grid,
  here: TileCoord,
  preferred: Direction,
  prng: BotPrng,
): BotDecision {
  const safeSteps: Direction[] = [];
  for (const direction of STEP_DIRECTIONS) {
    const delta = DIRECTION_DELTA[direction];
    const next = wrapCoord(grid, here.x + delta.x, here.y + delta.y);
    if (isWalkable(grid, next) && !grid.danger.has(tileKey(next))) safeSteps.push(direction);
  }
  let direction = preferred;
  if (!safeSteps.includes(preferred) && safeSteps.length > 0) {
    direction = prng.pick(safeSteps);
  }
  return Object.freeze({ intent: { kind: "move" as const, direction }, placeBomb: false });
}

const IDLE_DECISION: BotDecision = Object.freeze({ intent: { kind: "idle" as const }, placeBomb: false });

export function decideBot(
  snapshot: GameSnapshot,
  seatId: SeatId,
  prng: BotPrng,
  memory: BotMemory,
): BotDecision {
  if (memory.roundNumber !== snapshot.roundNumber) {
    memory.roundNumber = snapshot.roundNumber;
    memory.pressed = null;
    memory.retreat = null;
    memory.cooldownTicks = 0;
  }
  if (memory.cooldownTicks > 0) memory.cooldownTicks -= 1;

  const self = snapshot.competitors.find((c) => c.seatId === seatId);
  if (!self || !self.alive) return IDLE_DECISION;
  if (snapshot.phase !== "playing" && snapshot.phase !== "sudden-death") return IDLE_DECISION;

  const grid = buildGrid(snapshot, self.id);
  const here = tileOf(self.position);

  if (!isRestSafe(grid, here)) {
    const flee = stepToSafety(grid, here);
    if (flee) {
      return Object.freeze({ intent: { kind: "move" as const, direction: flee }, placeBomb: false });
    }
    // A route that was viable when movement began can become impossible to
    // rediscover once its fuse window is nearly exhausted. Do not brake while
    // the body is still clearing the blast tile: preserving the post-plant
    // retreat is the only chance to finish crossing before ignition.
    if (isDanger(grid, here) && memory.retreat !== null) {
      const delta = DIRECTION_DELTA[memory.retreat];
      const next = wrapCoord(grid, here.x + delta.x, here.y + delta.y);
      if (isWalkable(grid, next)) {
        return Object.freeze({
          intent: { kind: "move" as const, direction: memory.retreat },
          placeBomb: false,
        });
      }
    }
    // No fully-safe tile reachable and no escape motion to preserve.
    if (isDanger(grid, here)) return IDLE_DECISION;
  } else {
    memory.retreat = null;
  }

  const opponent = nearestOpponent(snapshot, self.id, here);

  // Throughout sudden death, survival outranks every offensive goal. Pressure
  // has a quiet gap between one impact and the next warning; using `closing`
  // alone would let pursuit turn the body back toward the outer spiral during
  // that gap. Keep flowing toward the last-closing central region instead. The
  // imminent-tile escape above still has first priority.
  if (snapshot.phase === "sudden-death") {
    const inward = stepTowardCenter(grid, here);
    if (inward) return jitteredMove(grid, here, inward, prng);
  }

  // The kernel rejects a plant on an already-occupied tile (tile-occupied).
  // Rival bodies overlapping the tile no longer block placement (Decision
  // 012), but two players sharing one tile could both plant in the same tick —
  // the second is rejected. Mirror that: don't plant while sharing a tile.
  const canBomb =
    memory.cooldownTicks === 0 &&
    self.activeBombs < self.maxBombs &&
    !grid.bombTiles.has(tileKey(here)) &&
    !snapshot.competitors.some((competitor) =>
      competitor.id !== self.id
      && competitor.alive
      && tileKey(competitor.tile) === tileKey(here)
    );

  if (canBomb) {
    const opponentAligned =
      opponent !== null && alignedWithinRange(grid, here, opponent.tile, self.flameRange);
    if (
      (opponentAligned || adjacentCrate(grid, here)) &&
      bombLeavesEscape(grid, here, self.flameRange)
    ) {
      const retreat = projectRetreat(grid, here, self.flameRange);
      const centerStep = directionTowardTileCenter(self);
      if (centerStep) {
        return Object.freeze({
          intent: { kind: "move" as const, direction: centerStep },
          placeBomb: false,
        });
      }
      // Plant only from a settled tile centre. A key release is applied on the
      // next kernel tick, so wait for observed zero velocity before committing.
      if (self.velocity.x !== 0 || self.velocity.y !== 0) return IDLE_DECISION;
      if (!retreat) return IDLE_DECISION;
      memory.cooldownTicks = BOMB_COOLDOWN_TICKS;
      memory.retreat = retreat;
      return Object.freeze({
        intent: { kind: "move" as const, direction: retreat },
        placeBomb: true,
      });
    }
  }

  // Pursue every tick with a held direction, like a human; the kernel snaps
  // the body to tile lanes, so we do not gate movement on being tile-centred.
  if (opponent) {
    const toward = bfsStep(grid, here, (tile) => sameTile(tile, opponent.tile), false);
    if (toward) return jitteredMove(grid, here, toward, prng);
    const approach = bfsStep(grid, here, (tile) => manhattan(tile, opponent.tile) <= 1, false);
    if (approach) return jitteredMove(grid, here, approach, prng);
  }

  const toCrate = bfsStep(grid, here, (tile) => adjacentCrate(grid, tile), false);
  if (toCrate) return jitteredMove(grid, here, toCrate, prng);

  return IDLE_DECISION;
}

export function translateDecision(
  decision: BotDecision,
  competitorId: CompetitorId,
  memory: BotMemory,
): readonly GameCommand[] {
  const commands: GameCommand[] = [];
  const wanted = decision.intent.kind === "move" ? decision.intent.direction : null;

  if (memory.pressed !== null && memory.pressed !== wanted) {
    commands.push({
      type: "set-movement",
      competitorId,
      direction: memory.pressed,
      pressed: false,
    });
    memory.pressed = null;
  }
  if (wanted !== null && memory.pressed !== wanted) {
    commands.push({ type: "set-movement", competitorId, direction: wanted, pressed: true });
    memory.pressed = wanted;
  } else if (decision.placeBomb && wanted !== null) {
    // Re-arm an unchanged held direction on the placement tick. The kernel can
    // have a zero-velocity lane-centering frame while the adapter still
    // remembers the key as held; without this edge the bot plants, then never
    // receives a fresh press to begin its committed retreat.
    commands.push({ type: "set-movement", competitorId, direction: wanted, pressed: false });
    commands.push({ type: "set-movement", competitorId, direction: wanted, pressed: true });
  }
  if (decision.placeBomb) {
    commands.push({ type: "place-bomb", competitorId });
  }
  return Object.freeze(commands);
}

export function driveBot(
  snapshot: GameSnapshot,
  seatId: SeatId,
  competitorId: CompetitorId,
  prng: BotPrng,
  memory: BotMemory,
): readonly GameCommand[] {
  return translateDecision(decideBot(snapshot, seatId, prng, memory), competitorId, memory);
}
