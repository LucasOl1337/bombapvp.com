/**
 * Pure geometry for the instantaneous bomb blast. Persisted FlameState entries
 * are visual aftermath only and must never be projected into damage.
 */
import type { PixelCoord, TileCoord } from "./types";
import { TILE_SIZE } from "../PersonalConfig/config";
import { parseTileKey } from "./tile-key";
import {
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
