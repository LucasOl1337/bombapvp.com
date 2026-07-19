// @vitest-environment node

import { describe, expect, it } from "vitest";
import { TILE_SIZE } from "../src/original-game/PersonalConfig/config.ts";
import {
  PLAYER_BODY_HALF,
  PLAYER_BODY_HALF_RATIO,
  bodyOverlapsTile,
  bodyTileOverlapArea,
  bodyTouchedTileIndices,
  getPlayerBodyRect,
  isBodyStrictlySmallerThanTile,
  projectedBodyOverlapsTile,
  wrappedAxisDelta,
} from "../src/original-game/Gameplay/player-body.ts";

const HALF_TILE = TILE_SIZE * 0.5;

function centerOf(tileX, tileY) {
  return {
    x: tileX * TILE_SIZE + HALF_TILE,
    y: tileY * TILE_SIZE + HALF_TILE,
  };
}

describe("player body hitbox (shipped geometry)", () => {
  it("exports a body half-extent strictly smaller than a full tile half", () => {
    expect(PLAYER_BODY_HALF_RATIO).toBeLessThan(0.5);
    expect(PLAYER_BODY_HALF).toBe(TILE_SIZE * PLAYER_BODY_HALF_RATIO);
    expect(PLAYER_BODY_HALF).toBeLessThan(HALF_TILE);
    expect(isBodyStrictlySmallerThanTile()).toBe(true);
    expect(isBodyStrictlySmallerThanTile(HALF_TILE)).toBe(false);
  });

  it("keeps a centered body inside a single open corridor tile", () => {
    const position = centerOf(2, 2);
    const touched = bodyTouchedTileIndices(position);
    expect(touched).toEqual({
      minTileX: 2,
      maxTileX: 2,
      minTileY: 2,
      maxTileY: 2,
    });
    expect(bodyOverlapsTile(position, { x: 2, y: 2 })).toBe(true);
    expect(bodyOverlapsTile(position, { x: 3, y: 2 })).toBe(false);
    expect(bodyOverlapsTile(position, { x: 1, y: 2 })).toBe(false);
  });

  it("allows non-zero off-center tolerance before touching an adjacent solid tile", () => {
    // Full-tile half (TILE/2) would touch the neighbor as soon as offset > 0.
    // Professional body must tolerate a positive offset while still clear.
    const solidTile = { x: 3, y: 2 };
    const base = centerOf(2, 2);
    const freeOffset = HALF_TILE - PLAYER_BODY_HALF - 0.5;
    expect(freeOffset).toBeGreaterThan(1);

    const stillFree = { x: base.x + freeOffset, y: base.y };
    expect(bodyOverlapsTile(stillFree, solidTile)).toBe(false);

    const blocked = { x: base.x + freeOffset + 2, y: base.y };
    expect(bodyOverlapsTile(blocked, solidTile)).toBe(true);

    // Ghost full-tile body would already hit the solid at freeOffset.
    const ghostFullHalf = HALF_TILE;
    const ghostOverlap = bodyTileOverlapArea(stillFree, solidTile, { bodyHalf: ghostFullHalf });
    expect(ghostOverlap).toBeGreaterThan(0);
    expect(bodyTileOverlapArea(stillFree, solidTile)).toBe(0);
  });

  it("hits flame when body AABB overlaps the flame tile and misses when only the full-tile ghost would", () => {
    const flameTile = { x: 4, y: 1 };
    const flameLeftEdge = flameTile.x * TILE_SIZE;
    // Just outside professional body reach from the left corridor center.
    const safeX = flameLeftEdge - PLAYER_BODY_HALF - 0.25;
    const safe = { x: safeX, y: centerOf(3, 1).y };
    expect(bodyOverlapsTile(safe, flameTile)).toBe(false);

    // Same position with full-tile half would already be lethal.
    expect(bodyOverlapsTile(safe, flameTile, { bodyHalf: HALF_TILE })).toBe(true);

    // Nudge into the flame tile edge — professional body must hit.
    const lethal = { x: flameLeftEdge - PLAYER_BODY_HALF + 0.5, y: safe.y };
    expect(bodyOverlapsTile(lethal, flameTile)).toBe(true);
  });

  it("uses wrap-aware overlap at arena edges (portal strip)", () => {
    const arenaPixelWidth = 11 * TILE_SIZE;
    const arenaPixelHeight = 9 * TILE_SIZE;
    // Player near the right edge; tile 0 is the wrap neighbor.
    const position = {
      x: arenaPixelWidth - 2,
      y: centerOf(0, 4).y,
    };
    const wrapTile = { x: 0, y: 4 };
    const options = { arenaPixelWidth, arenaPixelHeight };

    // Without wrap, AABB math treats tile 0 as far left — no overlap.
    expect(bodyOverlapsTile(position, wrapTile)).toBe(false);
    // With wrap spans, body near the right border can touch tile 0.
    expect(bodyOverlapsTile(position, wrapTile, options)).toBe(true);
    expect(bodyTileOverlapArea(position, wrapTile, options)).toBeGreaterThan(0);

    // Far from the seam: still no wrap overlap with a distant tile.
    const mid = centerOf(5, 4);
    expect(bodyOverlapsTile(mid, wrapTile, options)).toBe(false);
  });

  it("pickup/kick continuous overlap matches body AABB, not center-tile only", () => {
    const powerTile = { x: 2, y: 2 };
    const base = centerOf(2, 2);
    // Off-center but still overlapping the power-up tile with the body.
    const edge = {
      x: base.x + PLAYER_BODY_HALF * 0.5,
      y: base.y + PLAYER_BODY_HALF * 0.5,
    };
    expect(bodyOverlapsTile(edge, powerTile)).toBe(true);

    // Center sits on the neighbor while the body still clips power tile — continuous pickup.
    const centerOnNeighbor = {
      x: (3 * TILE_SIZE) + HALF_TILE - (PLAYER_BODY_HALF - 1),
      y: base.y,
    };
    const discreteCenterTileX = Math.floor(centerOnNeighbor.x / TILE_SIZE);
    expect(discreteCenterTileX).toBe(3);
    expect(bodyOverlapsTile(centerOnNeighbor, powerTile)).toBe(true);
  });

  it("projected body uses the same half-extent as the physical body", () => {
    const tile = { x: 1, y: 1 };
    const center = centerOf(1, 1);
    expect(projectedBodyOverlapsTile(center, tile)).toBe(true);

    const justOutside = {
      x: center.x + PLAYER_BODY_HALF + HALF_TILE + 0.5,
      y: center.y,
    };
    expect(projectedBodyOverlapsTile(justOutside, tile)).toBe(false);

    const justInside = {
      x: center.x + PLAYER_BODY_HALF + HALF_TILE - 0.5,
      y: center.y,
    };
    expect(projectedBodyOverlapsTile(justInside, tile)).toBe(true);
  });

  it("getPlayerBodyRect is centered on position with 2*half extent", () => {
    const position = { x: 100, y: 80 };
    const rect = getPlayerBodyRect(position);
    expect(rect.right - rect.left).toBeCloseTo(PLAYER_BODY_HALF * 2);
    expect(rect.bottom - rect.top).toBeCloseTo(PLAYER_BODY_HALF * 2);
    expect((rect.left + rect.right) / 2).toBeCloseTo(position.x);
    expect((rect.top + rect.bottom) / 2).toBeCloseTo(position.y);
  });

  it("wrappedAxisDelta picks the shortest toroidal step", () => {
    const span = 400;
    expect(wrappedAxisDelta(10, 390, span)).toBeCloseTo(20);
    expect(wrappedAxisDelta(390, 10, span)).toBeCloseTo(-20);
    expect(wrappedAxisDelta(50, 40, span)).toBeCloseTo(10);
  });
});
