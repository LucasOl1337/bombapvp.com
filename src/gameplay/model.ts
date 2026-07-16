export const BOARD_WIDTH = 13;
export const BOARD_HEIGHT = 11;
export const MOVE_INTERVAL_MS = 165;
export const BOT_THINK_INTERVAL_MS = 220;
export const BOMB_FUSE_MS = 1_900;
export const FLAME_DURATION_MS = 520;

export type Direction = "up" | "down" | "left" | "right";
export type PlayerId = 1 | 2 | 3 | 4;
export type RoundStatus = "playing" | "won" | "lost" | "draw";

export type Tile = Readonly<{ x: number; y: number }>;

export type ArenaPlayer = {
  id: PlayerId;
  kind: "human" | "bot";
  tile: Tile;
  alive: boolean;
  moveCooldownMs: number;
  bombCooldownMs: number;
  activeBombs: number;
};

export type ArenaBomb = {
  id: number;
  ownerId: PlayerId;
  tile: Tile;
  fuseMs: number;
  radius: number;
};

export type ArenaFlame = {
  tile: Tile;
  remainingMs: number;
};

export type GameState = {
  width: number;
  height: number;
  elapsedMs: number;
  status: RoundStatus;
  players: ArenaPlayer[];
  bombs: ArenaBomb[];
  flames: ArenaFlame[];
  crates: Set<string>;
};

export const DIRECTION_DELTAS: Readonly<Record<Direction, Tile>> = Object.freeze({
  up: Object.freeze({ x: 0, y: -1 }),
  down: Object.freeze({ x: 0, y: 1 }),
  left: Object.freeze({ x: -1, y: 0 }),
  right: Object.freeze({ x: 1, y: 0 }),
});

export const DIRECTIONS = Object.freeze(Object.keys(DIRECTION_DELTAS) as Direction[]);

export function tileKey(tile: Tile): string {
  return `${tile.x},${tile.y}`;
}

export function sameTile(left: Tile, right: Tile): boolean {
  return left.x === right.x && left.y === right.y;
}

export function moveTile(tile: Tile, direction: Direction): Tile {
  const delta = DIRECTION_DELTAS[direction];
  return { x: tile.x + delta.x, y: tile.y + delta.y };
}

export function isWall(tile: Tile): boolean {
  return (
    tile.x <= 0 ||
    tile.y <= 0 ||
    tile.x >= BOARD_WIDTH - 1 ||
    tile.y >= BOARD_HEIGHT - 1 ||
    (tile.x % 2 === 0 && tile.y % 2 === 0)
  );
}

export function isWalkable(
  state: GameState,
  tile: Tile,
  options: Readonly<{ ignorePlayers?: boolean }> = {},
): boolean {
  if (isWall(tile) || state.crates.has(tileKey(tile))) return false;
  if (state.bombs.some((bomb) => sameTile(bomb.tile, tile))) return false;
  if (!options.ignorePlayers && state.players.some((player) => player.alive && sameTile(player.tile, tile))) {
    return false;
  }
  return true;
}

export function blastTiles(state: GameState, origin: Tile, radius: number): Tile[] {
  const tiles: Tile[] = [{ ...origin }];
  for (const direction of DIRECTIONS) {
    let cursor = origin;
    for (let distance = 1; distance <= radius; distance += 1) {
      cursor = moveTile(cursor, direction);
      if (isWall(cursor)) break;
      tiles.push({ ...cursor });
      if (state.crates.has(tileKey(cursor))) break;
    }
  }
  return tiles;
}

const SPAWNS: ReadonlyArray<Readonly<{ id: PlayerId; kind: "human" | "bot"; tile: Tile }>> = [
  { id: 1, kind: "human", tile: { x: 1, y: 1 } },
  { id: 2, kind: "bot", tile: { x: BOARD_WIDTH - 2, y: BOARD_HEIGHT - 2 } },
  { id: 3, kind: "bot", tile: { x: BOARD_WIDTH - 2, y: 1 } },
  { id: 4, kind: "bot", tile: { x: 1, y: BOARD_HEIGHT - 2 } },
];

function safeSpawnTiles(): Set<string> {
  const safe = new Set<string>();
  for (const spawn of SPAWNS) {
    safe.add(tileKey(spawn.tile));
    const horizontal = spawn.tile.x === 1 ? "right" : "left";
    const vertical = spawn.tile.y === 1 ? "down" : "up";
    safe.add(tileKey(moveTile(spawn.tile, horizontal)));
    safe.add(tileKey(moveTile(spawn.tile, vertical)));
  }
  return safe;
}

function createCrates(): Set<string> {
  const crates = new Set<string>();
  const safe = safeSpawnTiles();
  for (let y = 1; y < BOARD_HEIGHT - 1; y += 1) {
    for (let x = 1; x < BOARD_WIDTH - 1; x += 1) {
      const tile = { x, y };
      const key = tileKey(tile);
      if (isWall(tile) || safe.has(key)) continue;
      if ((x * 17 + y * 29 + x * y * 3) % 7 < 3) crates.add(key);
    }
  }
  return crates;
}

export function createInitialGameState(): GameState {
  return {
    width: BOARD_WIDTH,
    height: BOARD_HEIGHT,
    elapsedMs: 0,
    status: "playing",
    players: SPAWNS.map((spawn) => ({
      id: spawn.id,
      kind: spawn.kind,
      tile: { ...spawn.tile },
      alive: true,
      moveCooldownMs: 0,
      bombCooldownMs: 0,
      activeBombs: 0,
    })),
    bombs: [],
    flames: [],
    crates: createCrates(),
  };
}
