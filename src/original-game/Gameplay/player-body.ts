/**
 * Canonical player collision body for Bomba PvP.
 *
 * Authoritative half-extent is strictly smaller than TILE/2 so corridors and
 * corners feel fair while flame/wall/bomb still use continuous AABB overlap
 * (not center-tile-only lethality).
 */
import { TILE_SIZE } from "../PersonalConfig/config";
import type { PixelCoord, TileCoord } from "./types";

/** Classic Bomberman-band body: ~76% of a tile (half = 0.38 * TILE). */
export const PLAYER_BODY_HALF_RATIO = 0.38;

/** Half-extent of the axis-aligned player body in pixels. */
export const PLAYER_BODY_HALF = TILE_SIZE * PLAYER_BODY_HALF_RATIO;

export interface BodyGeometryOptions {
  bodyHalf?: number;
  tileSize?: number;
  /** Arena pixel width for wrap-aware overlap; omit when wrap is not needed. */
  arenaPixelWidth?: number;
  /** Arena pixel height for wrap-aware overlap; omit when wrap is not needed. */
  arenaPixelHeight?: number;
}

export interface BodyRect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** Shortest signed delta from `from` to `to` on a toroidal axis of `span`. */
export function wrappedAxisDelta(to: number, from: number, span: number): number {
  let delta = to - from;
  if (span > 0) {
    if (delta > span * 0.5) {
      delta -= span;
    } else if (delta < -span * 0.5) {
      delta += span;
    }
  }
  return delta;
}

export function getPlayerBodyRect(
  position: PixelCoord,
  bodyHalf: number = PLAYER_BODY_HALF,
): BodyRect {
  return {
    left: position.x - bodyHalf,
    right: position.x + bodyHalf,
    top: position.y - bodyHalf,
    bottom: position.y + bodyHalf,
  };
}

export function tileCenter(
  tile: TileCoord,
  tileSize: number = TILE_SIZE,
): PixelCoord {
  return {
    x: tile.x * tileSize + tileSize * 0.5,
    y: tile.y * tileSize + tileSize * 0.5,
  };
}

/**
 * Continuous AABB overlap between the player body and a full tile.
 * When arena pixel spans are provided, uses wrap-aware center deltas so
 * portal edges match movement wrap.
 *
 * Canonical lethal/contact test for walls, flames, pickups, and kick blocks.
 */
export function bodyOverlapsTile(
  position: PixelCoord,
  tile: TileCoord,
  options: BodyGeometryOptions = {},
): boolean {
  return bodyTileOverlapArea(position, tile, options) > 0;
}

/**
 * Overlap area between body AABB and tile AABB (wrap-aware when spans given).
 * Used by bomb body-egress and any caller that needs partial-exit detection.
 * Prefer {@link bodyOverlapsTile} when only a boolean is needed.
 */
export function bodyTileOverlapArea(
  position: PixelCoord,
  tile: TileCoord,
  options: BodyGeometryOptions = {},
): number {
  const bodyHalf = options.bodyHalf ?? PLAYER_BODY_HALF;
  const tileSize = options.tileSize ?? TILE_SIZE;
  const tileHalf = tileSize * 0.5;
  const center = tileCenter(tile, tileSize);

  const deltaX = options.arenaPixelWidth !== undefined
    ? wrappedAxisDelta(center.x, position.x, options.arenaPixelWidth)
    : center.x - position.x;
  const deltaY = options.arenaPixelHeight !== undefined
    ? wrappedAxisDelta(center.y, position.y, options.arenaPixelHeight)
    : center.y - position.y;

  const overlapWidth = Math.max(
    0,
    Math.min(bodyHalf, deltaX + tileHalf) - Math.max(-bodyHalf, deltaX - tileHalf),
  );
  const overlapHeight = Math.max(
    0,
    Math.min(bodyHalf, deltaY + tileHalf) - Math.max(-bodyHalf, deltaY - tileHalf),
  );
  return overlapWidth * overlapHeight;
}

/**
 * Skill-projection overlap: same half-extent as the physical body, but uses a
 * strict center-distance test (open on the exact boundary). Prefer
 * {@link bodyOverlapsTile} for lethal/contact simulation; this variant matches
 * historical projection / bomb-on-ghost checks.
 */
export function projectedBodyOverlapsTile(
  position: PixelCoord,
  tile: TileCoord,
  options: BodyGeometryOptions = {},
): boolean {
  const bodyHalf = options.bodyHalf ?? PLAYER_BODY_HALF;
  const tileSize = options.tileSize ?? TILE_SIZE;
  const tileHalf = tileSize * 0.5;
  const center = tileCenter(tile, tileSize);

  const deltaX = Math.abs(
    options.arenaPixelWidth !== undefined
      ? wrappedAxisDelta(position.x, center.x, options.arenaPixelWidth)
      : position.x - center.x,
  );
  const deltaY = Math.abs(
    options.arenaPixelHeight !== undefined
      ? wrappedAxisDelta(position.y, center.y, options.arenaPixelHeight)
      : position.y - center.y,
  );
  return deltaX < bodyHalf + tileHalf && deltaY < bodyHalf + tileHalf;
}

/**
 * Integer tile indices (may be outside 0..grid before normalize) whose cells
 * the body AABB intersects. Mirrors movement occupation scanning.
 */
export function bodyTouchedTileIndices(
  position: PixelCoord,
  options: BodyGeometryOptions = {},
): { minTileX: number; maxTileX: number; minTileY: number; maxTileY: number } {
  const bodyHalf = options.bodyHalf ?? PLAYER_BODY_HALF;
  const tileSize = options.tileSize ?? TILE_SIZE;
  const left = position.x - bodyHalf;
  const right = position.x + bodyHalf;
  const top = position.y - bodyHalf;
  const bottom = position.y + bodyHalf;
  return {
    minTileX: Math.floor(left / tileSize),
    maxTileX: Math.floor((right - 0.001) / tileSize),
    minTileY: Math.floor(top / tileSize),
    maxTileY: Math.floor((bottom - 0.001) / tileSize),
  };
}

/** True when the body half-extent is strictly smaller than a full tile half. */
export function isBodyStrictlySmallerThanTile(
  bodyHalf: number = PLAYER_BODY_HALF,
  tileSize: number = TILE_SIZE,
): boolean {
  return bodyHalf < tileSize * 0.5;
}

/**
 * Bomb body-egress entitlement: the candidate pose must not approach the tile
 * center (wrap-aware) and must not cross the center. Prefer this over pure
 * overlap-area reduction — when the body is strictly smaller than a tile, a
 * short step from the exact center does not change overlap area but is still
 * a valid escape.
 */
export function isMonotonicBodyBombEgress(
  currentPosition: PixelCoord,
  candidatePosition: PixelCoord,
  tile: TileCoord,
  options: BodyGeometryOptions = {},
): boolean {
  const tileSize = options.tileSize ?? TILE_SIZE;
  const center = tileCenter(tile, tileSize);
  const width = options.arenaPixelWidth;
  const height = options.arenaPixelHeight;

  const currentDx = width !== undefined
    ? wrappedAxisDelta(currentPosition.x, center.x, width)
    : currentPosition.x - center.x;
  const currentDy = height !== undefined
    ? wrappedAxisDelta(currentPosition.y, center.y, height)
    : currentPosition.y - center.y;
  const candidateDx = width !== undefined
    ? wrappedAxisDelta(candidatePosition.x, center.x, width)
    : candidatePosition.x - center.x;
  const candidateDy = height !== undefined
    ? wrappedAxisDelta(candidatePosition.y, center.y, height)
    : candidatePosition.y - center.y;

  const currentDistSq = currentDx * currentDx + currentDy * currentDy;
  const candidateDistSq = candidateDx * candidateDx + candidateDy * candidateDy;
  if (candidateDistSq < currentDistSq - 1e-9) {
    return false;
  }

  if (doesWrappedAxisCross(currentPosition.x, candidatePosition.x, center.x, width)) {
    return false;
  }
  if (doesWrappedAxisCross(currentPosition.y, candidatePosition.y, center.y, height)) {
    return false;
  }
  return true;
}

/** True when the closed segment start→end crosses `coordinate` (wrap-aware when span set). */
export function doesWrappedAxisCross(
  start: number,
  end: number,
  coordinate: number,
  span?: number,
): boolean {
  if (span === undefined) {
    const startOffset = start - coordinate;
    const endOffset = end - coordinate;
    return (startOffset < 0 && endOffset > 0) || (startOffset > 0 && endOffset < 0);
  }
  const startOffset = wrappedAxisDelta(start, coordinate, span);
  const endOffset = startOffset + wrappedAxisDelta(end, start, span);
  return (startOffset < 0 && endOffset > 0) || (startOffset > 0 && endOffset < 0);
}
