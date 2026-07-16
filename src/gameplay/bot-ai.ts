import {
  BOMB_FUSE_MS,
  DIRECTIONS,
  MOVE_INTERVAL_MS,
  blastTiles,
  isWalkable,
  moveTile,
  sameTile,
  tileKey,
  type ArenaPlayer,
  type Direction,
  type GameState,
  type Tile,
} from "./model.ts";

export type BotDecision = Readonly<{
  direction: Direction | null;
  placeBomb: boolean;
}>;

type SearchNode = Readonly<{
  tile: Tile;
  firstDirection: Direction | null;
  depth: number;
}>;

function dangerTimes(state: GameState): Map<string, number> {
  const danger = new Map<string, number>();
  for (const flame of state.flames) danger.set(tileKey(flame.tile), 0);
  for (const bomb of state.bombs) {
    for (const tile of blastTiles(state, bomb.tile, bomb.radius)) {
      const key = tileKey(tile);
      danger.set(key, Math.min(danger.get(key) ?? Number.POSITIVE_INFINITY, bomb.fuseMs));
    }
  }
  return danger;
}

function findFirstStep(
  state: GameState,
  player: ArenaPlayer,
  accept: (tile: Tile, depth: number) => boolean,
  danger: Map<string, number>,
  maxDepth = 12,
): Direction | null {
  const queue: SearchNode[] = [{ tile: player.tile, firstDirection: null, depth: 0 }];
  const visited = new Set([tileKey(player.tile)]);

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    if (current.depth > 0 && accept(current.tile, current.depth)) return current.firstDirection;
    if (current.depth >= maxDepth) continue;

    for (const direction of DIRECTIONS) {
      const next = moveTile(current.tile, direction);
      const key = tileKey(next);
      if (visited.has(key)) continue;
      if (!isWalkable(state, next, { ignorePlayers: true })) continue;
      const arrivalMs = (current.depth + 1) * MOVE_INTERVAL_MS;
      const dangerAt = danger.get(key);
      if (dangerAt !== undefined && dangerAt <= arrivalMs + 180) continue;
      visited.add(key);
      queue.push({
        tile: next,
        firstDirection: current.firstDirection ?? direction,
        depth: current.depth + 1,
      });
    }
  }
  return null;
}

function canEscapeOwnBomb(state: GameState, player: ArenaPlayer): boolean {
  const hypothetical = {
    id: -1,
    ownerId: player.id,
    tile: { ...player.tile },
    fuseMs: BOMB_FUSE_MS,
    radius: 2,
  };
  const projected: GameState = { ...state, bombs: [...state.bombs, hypothetical] };
  const projectedBlast = new Set(blastTiles(projected, player.tile, 2).map(tileKey));
  const projectedDanger = dangerTimes(projected);
  return findFirstStep(
    projected,
    player,
    (tile, depth) => !projectedBlast.has(tileKey(tile)) && depth * MOVE_INTERVAL_MS < BOMB_FUSE_MS - 300,
    projectedDanger,
    8,
  ) !== null;
}

function hasAdjacentCrate(state: GameState, tile: Tile): boolean {
  return DIRECTIONS.some((direction) => state.crates.has(tileKey(moveTile(tile, direction))));
}

function clearLineToHuman(state: GameState, player: ArenaPlayer): boolean {
  const human = state.players.find((candidate) => candidate.kind === "human" && candidate.alive);
  if (!human) return false;
  const aligned = human.tile.x === player.tile.x || human.tile.y === player.tile.y;
  const distance = Math.abs(human.tile.x - player.tile.x) + Math.abs(human.tile.y - player.tile.y);
  if (!aligned || distance > 3) return false;
  const direction: Direction = human.tile.x > player.tile.x
    ? "right"
    : human.tile.x < player.tile.x
      ? "left"
      : human.tile.y > player.tile.y
        ? "down"
        : "up";
  let cursor = player.tile;
  while (!sameTile(cursor, human.tile)) {
    cursor = moveTile(cursor, direction);
    if (!sameTile(cursor, human.tile) && !isWalkable(state, cursor, { ignorePlayers: true })) return false;
  }
  return true;
}

function chaseHuman(state: GameState, player: ArenaPlayer, danger: Map<string, number>): Direction | null {
  const human = state.players.find((candidate) => candidate.kind === "human" && candidate.alive);
  if (!human) return null;
  return findFirstStep(
    state,
    player,
    (tile) => Math.abs(tile.x - human.tile.x) + Math.abs(tile.y - human.tile.y) <= 1,
    danger,
    18,
  );
}

export function getBotDecision(state: GameState, player: ArenaPlayer): BotDecision {
  const danger = dangerTimes(state);
  const currentDangerAt = danger.get(tileKey(player.tile));

  if (currentDangerAt !== undefined && currentDangerAt <= 950) {
    const direction = findFirstStep(
      state,
      player,
      (tile, depth) => {
        const dangerAt = danger.get(tileKey(tile));
        return dangerAt === undefined || dangerAt > depth * MOVE_INTERVAL_MS + 900;
      },
      danger,
      10,
    );
    return { direction, placeBomb: false };
  }

  const wantsBomb = hasAdjacentCrate(state, player.tile) || clearLineToHuman(state, player);
  if (
    wantsBomb &&
    player.activeBombs === 0 &&
    player.bombCooldownMs <= 0 &&
    !state.bombs.some((bomb) => sameTile(bomb.tile, player.tile)) &&
    canEscapeOwnBomb(state, player)
  ) {
    return { direction: chaseHuman(state, player, danger), placeBomb: true };
  }

  const direction = chaseHuman(state, player, danger);
  if (direction) return { direction, placeBomb: false };

  const safeDirections = DIRECTIONS.filter((candidate) => {
    const next = moveTile(player.tile, candidate);
    const dangerAt = danger.get(tileKey(next));
    return isWalkable(state, next, { ignorePlayers: true }) && (dangerAt === undefined || dangerAt > 700);
  });
  const fallback = safeDirections[(Math.floor(state.elapsedMs / 1_000) + player.id) % safeDirections.length] ?? null;
  return { direction: fallback, placeBomb: false };
}
