import type { TileCoord } from "../Gameplay/types";
import { tileKey } from "../Gameplay/tile-key";

const CARDINAL_DIRECTIONS: readonly TileCoord[] = [
  { x: 0, y: -1 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: 1, y: 0 },
];

export interface ExplosionBomb {
  id: number;
  tile: TileCoord;
  fuseMs: number;
  flameRange: number;
}

export interface ExplosionArena {
  width: number;
  height: number;
  solid: ReadonlySet<string>;
  breakable: ReadonlySet<string>;
}

export interface ChainReaction {
  fromTile: TileCoord;
  toTile: TileCoord;
}

export interface BombExplosion {
  bombId: number;
  flameTiles: TileCoord[];
  brokenCrateKeys: string[];
  chainReactions: ChainReaction[];
}

interface BombBlast {
  tiles: TileCoord[];
  keys: string[];
}

function walkBombBlast(input: {
  origin: TileCoord;
  range: number;
  arena: ExplosionArena;
}, visit: (tile: TileCoord, key: string) => void): void {
  visit({ ...input.origin }, tileKey(input.origin.x, input.origin.y));
  for (const direction of CARDINAL_DIRECTIONS) {
    for (let step = 1; step <= input.range; step += 1) {
      const tile = {
        x: input.origin.x + direction.x * step,
        y: input.origin.y + direction.y * step,
      };
      if (tile.x < 0 || tile.y < 0 || tile.x >= input.arena.width || tile.y >= input.arena.height) {
        break;
      }
      const key = tileKey(tile.x, tile.y);
      if (input.arena.solid.has(key)) {
        break;
      }
      visit(tile, key);
      if (input.arena.breakable.has(key)) {
        break;
      }
    }
  }
}

function collectBombBlast(input: {
  origin: TileCoord;
  range: number;
  arena: ExplosionArena;
}): BombBlast {
  const tiles: TileCoord[] = [];
  const keys: string[] = [];
  walkBombBlast(input, (tile, key) => {
    tiles.push(tile);
    keys.push(key);
  });
  return { tiles, keys };
}

export function getBombBlastKeys(input: {
  origin: TileCoord;
  range: number;
  arena: ExplosionArena;
}): Set<string> {
  const keys = new Set<string>();
  walkBombBlast(input, (_tile, key) => keys.add(key));
  return keys;
}

export function resolveBombExplosions(input: {
  bombs: readonly ExplosionBomb[];
  arena: ExplosionArena;
}): BombExplosion[] {
  if (!input.bombs.some((bomb) => bomb.fuseMs <= 0)) return [];
  return walkBombExplosionWaves(input, false, true);
}

export function projectBombDanger(input: {
  bombs: readonly ExplosionBomb[];
  arena: ExplosionArena;
}): Map<string, number> {
  if (input.bombs.length === 0) return new Map();
  if (input.bombs.length === 1) {
    const [bomb] = input.bombs;
    if (!bomb) return new Map();
    const fuseMs = Math.max(0, bomb.fuseMs);
    const danger = new Map<string, number>();
    const blastKeys = getBombBlastKeys({
      origin: bomb.tile,
      range: bomb.flameRange,
      arena: input.arena,
    });
    for (const key of blastKeys) danger.set(key, fuseMs);
    return danger;
  }
  const danger = new Map<string, number>();
  walkBombExplosionWaves(input, true, false, (fuseMs, flameKeys) => {
    for (const key of flameKeys) {
      const previous = danger.get(key);
      if (previous === undefined || fuseMs < previous) danger.set(key, fuseMs);
    }
  });
  return danger;
}

function walkBombExplosionWaves(
  input: { bombs: readonly ExplosionBomb[]; arena: ExplosionArena },
  includeFutureWaves: boolean,
  collectEvents: boolean,
  visit?: (fuseMs: number, flameKeys: readonly string[]) => void,
): BombExplosion[] {
  const bombsById = new Map(input.bombs.map((bomb) => [bomb.id, bomb]));
  const bombsByTile = new Map(input.bombs.map((bomb) => [tileKey(bomb.tile.x, bomb.tile.y), bomb]));
  const effectiveFuseMs = new Map(input.bombs.map((bomb) => [bomb.id, Math.max(0, bomb.fuseMs)]));
  const explodedBombIds = new Set<number>();
  const remainingBreakable = new Set(input.arena.breakable);
  const explosions: BombExplosion[] = [];

  while (explodedBombIds.size < bombsById.size) {
    let waveFuseMs = Number.POSITIVE_INFINITY;
    for (const bomb of input.bombs) {
      if (!explodedBombIds.has(bomb.id)) {
        waveFuseMs = Math.min(waveFuseMs, effectiveFuseMs.get(bomb.id) ?? Number.POSITIVE_INFINITY);
      }
    }
    if (!Number.isFinite(waveFuseMs)) break;

    const queue = input.bombs
      .filter((bomb) => !explodedBombIds.has(bomb.id) && effectiveFuseMs.get(bomb.id) === waveFuseMs)
      .map((bomb) => bomb.id);
    const queuedBombIds = new Set(queue);

    while (queue.length > 0) {
      const bombId = queue.shift();
      if (bombId === undefined || explodedBombIds.has(bombId)) continue;
      const bomb = bombsById.get(bombId);
      if (!bomb) continue;
      explodedBombIds.add(bomb.id);

      const blast = collectBombBlast({
        origin: bomb.tile,
        range: bomb.flameRange,
        arena: {
          ...input.arena,
          breakable: remainingBreakable,
        },
      });
      const brokenCrateKeys: string[] | null = collectEvents ? [] : null;
      const chainReactions: ChainReaction[] | null = collectEvents ? [] : null;

      for (let index = 0; index < blast.tiles.length; index += 1) {
        const tile = blast.tiles[index];
        const key = blast.keys[index];
        if (!tile || key === undefined) continue;
        const chainedBomb = bombsByTile.get(key);
        if (chainedBomb && !explodedBombIds.has(chainedBomb.id)) {
          const chainedFuseMs = effectiveFuseMs.get(chainedBomb.id) ?? Math.max(0, chainedBomb.fuseMs);
          if (chainedFuseMs > waveFuseMs) {
            chainReactions?.push({
              fromTile: { ...bomb.tile },
              toTile: { ...chainedBomb.tile },
            });
            effectiveFuseMs.set(chainedBomb.id, waveFuseMs);
            if (!queuedBombIds.has(chainedBomb.id)) {
              queue.push(chainedBomb.id);
              queuedBombIds.add(chainedBomb.id);
            }
          }
        }
        if (remainingBreakable.delete(key)) brokenCrateKeys?.push(key);
      }

      visit?.(waveFuseMs, blast.keys);
      if (brokenCrateKeys && chainReactions) {
        explosions.push({
          bombId: bomb.id,
          flameTiles: blast.tiles,
          brokenCrateKeys,
          chainReactions,
        });
      }
    }

    if (!includeFutureWaves) break;
  }

  return explosions;
}
