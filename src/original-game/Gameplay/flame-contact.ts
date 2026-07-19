/**
 * Pure flame/body contact queries. GameApp projects results into damage;
 * bots and tests can share the same geometry without canvas or audio.
 */
import type { FlameState, PixelCoord, PlayerState, TileCoord } from "./types";
import { parseTileKey } from "./tile-key";
import {
  bodyOverlapsTile,
  type BodyGeometryOptions,
} from "./player-body";

export type FlameLike = Readonly<{
  tile: TileCoord;
  remainingMs: number;
  ownerId?: number | null;
}>;

/** True when an active flame's tile overlaps the body at `position`. */
export function bodyOverlapsActiveFlame(
  position: PixelCoord,
  flame: FlameLike,
  options: BodyGeometryOptions = {},
): boolean {
  if (flame.remainingMs <= 0) return false;
  return bodyOverlapsTile(position, flame.tile, options);
}

/** First active flame whose tile overlaps the body, or null. */
export function findActiveFlameHittingBody(
  position: PixelCoord,
  flames: readonly FlameLike[],
  options: BodyGeometryOptions = {},
): FlameLike | null {
  for (const flame of flames) {
    if (bodyOverlapsActiveFlame(position, flame, options)) {
      return flame;
    }
  }
  return null;
}

/** True when any listed tile overlaps the body at `position`. */
export function bodyOverlapsAnyTile(
  position: PixelCoord,
  tiles: readonly TileCoord[],
  options: BodyGeometryOptions = {},
): boolean {
  return tiles.some((tile) => bodyOverlapsTile(position, tile, options));
}

/**
 * Parse tile keys with the canonical codec, dropping non-finite entries.
 * Prefer this over ad-hoc `key.split(",")` in death / overlay paths.
 */
export function tilesFromKeys(keys: Iterable<string>): TileCoord[] {
  const tiles: TileCoord[] = [];
  for (const key of keys) {
    const tile = parseTileKey(key);
    if (Number.isFinite(tile.x) && Number.isFinite(tile.y)) {
      tiles.push(tile);
    }
  }
  return tiles;
}

/** Alive players whose body overlaps any of the given tiles. */
export function findPlayersOverlappingTiles(
  players: readonly PlayerState[],
  tiles: readonly TileCoord[],
  options: BodyGeometryOptions = {},
): PlayerState[] {
  if (tiles.length === 0) return [];
  return players.filter(
    (player) => player.alive && bodyOverlapsAnyTile(player.position, tiles, options),
  );
}

/** Alive players hit by any active flame. */
export function findPlayersHitByFlames(
  players: readonly PlayerState[],
  flames: readonly FlameState[],
  options: BodyGeometryOptions = {},
): Array<{ player: PlayerState; flame: FlameLike }> {
  const hits: Array<{ player: PlayerState; flame: FlameLike }> = [];
  for (const player of players) {
    if (!player.alive) continue;
    const flame = findActiveFlameHittingBody(player.position, flames, options);
    if (flame) hits.push({ player, flame });
  }
  return hits;
}
