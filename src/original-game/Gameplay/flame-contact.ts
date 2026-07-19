/**
 * Pure flame/body contact queries. GameApp projects results into damage;
 * bots and tests can share the same geometry without canvas or audio.
 */
import type { FlameState, PixelCoord, PlayerState, TileCoord } from "./types";
import { TILE_SIZE } from "../PersonalConfig/config";
import { parseTileKey } from "./tile-key";
import {
  bodyOverlapsTile,
  tileCenter,
  type BodyGeometryOptions,
  wrappedAxisDelta,
} from "./player-body";

/** Half-extent of the vulnerable core as a fraction of one tile. */
export const FLAME_HURTBOX_HALF_RATIO = 0.2;

export interface FlameGeometryOptions extends BodyGeometryOptions {
  flameHurtboxHalf?: number;
}

export function flameHurtboxOverlapsTile(
  position: PixelCoord,
  tile: TileCoord,
  options: FlameGeometryOptions = {},
): boolean {
  const tileSize = options.tileSize ?? TILE_SIZE;
  const hurtboxHalf = options.flameHurtboxHalf
    ?? tileSize * FLAME_HURTBOX_HALF_RATIO;
  const lethalCenterDistance = tileSize * 0.5 - hurtboxHalf;
  const center = tileCenter(tile, tileSize);
  const deltaX = Math.abs(options.arenaPixelWidth === undefined
    ? position.x - center.x
    : wrappedAxisDelta(position.x, center.x, options.arenaPixelWidth));
  const deltaY = Math.abs(options.arenaPixelHeight === undefined
    ? position.y - center.y
    : wrappedAxisDelta(position.y, center.y, options.arenaPixelHeight));
  return deltaX <= lethalCenterDistance && deltaY <= lethalCenterDistance;
}

export type FlameLike = Readonly<{
  tile: TileCoord;
  remainingMs: number;
  ownerId?: number | null;
}>;

/** True when an active flame's tile overlaps the vulnerable core at `position`. */
export function bodyOverlapsActiveFlame(
  position: PixelCoord,
  flame: FlameLike,
  options: FlameGeometryOptions = {},
): boolean {
  if (flame.remainingMs <= 0) return false;
  return flameHurtboxOverlapsTile(position, flame.tile, options);
}

/** First active flame whose tile overlaps the vulnerable core, or null. */
export function findActiveFlameHittingBody(
  position: PixelCoord,
  flames: readonly FlameLike[],
  options: FlameGeometryOptions = {},
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

/** True when any listed flame tile overlaps the vulnerable core. */
export function flameHurtboxOverlapsAnyTile(
  position: PixelCoord,
  tiles: readonly TileCoord[],
  options: FlameGeometryOptions = {},
): boolean {
  return tiles.some((tile) => flameHurtboxOverlapsTile(position, tile, options));
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

/** Alive players whose flame hurtbox overlaps any of the given tiles. */
export function findPlayersOverlappingTiles(
  players: readonly PlayerState[],
  tiles: readonly TileCoord[],
  options: FlameGeometryOptions = {},
): PlayerState[] {
  if (tiles.length === 0) return [];
  return players.filter(
    (player) => player.alive && flameHurtboxOverlapsAnyTile(player.position, tiles, options),
  );
}

/** Alive players hit by any active flame. */
export function findPlayersHitByFlames(
  players: readonly PlayerState[],
  flames: readonly FlameState[],
  options: FlameGeometryOptions = {},
): Array<{ player: PlayerState; flame: FlameLike }> {
  const hits: Array<{ player: PlayerState; flame: FlameLike }> = [];
  for (const player of players) {
    if (!player.alive) continue;
    const flame = findActiveFlameHittingBody(player.position, flames, options);
    if (flame) hits.push({ player, flame });
  }
  return hits;
}
