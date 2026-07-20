import { describe, expect, it } from "vitest";
import {
  bodyOverlapsActiveFlame,
  flameHurtboxOverlapsTile,
  findActiveFlameHittingBody,
  findPlayersHitByFlames,
  findPlayersOverlappingTiles,
  tilesFromKeys,
} from "../src/original-game/Gameplay/flame-contact.ts";
import { bodyOverlapsTile, PLAYER_BODY_HALF } from "../src/original-game/Gameplay/player-body.ts";
import { TILE_SIZE } from "../src/original-game/PersonalConfig/config.ts";
import type { PlayerState } from "../src/original-game/Gameplay/types.ts";

const HALF = TILE_SIZE * 0.5;

function playerAt(id: 1 | 2, x: number, y: number, alive = true): PlayerState {
  return {
    id,
    alive,
    position: { x, y },
    tile: { x: Math.floor(x / TILE_SIZE), y: Math.floor(y / TILE_SIZE) },
  } as PlayerState;
}

describe("flame-contact pure helpers", () => {
  it("uses the canonical physical player body for lethal flame contact", () => {
    const flameTile = { x: 3, y: 1 };
    const y = flameTile.y * TILE_SIZE + HALF;
    const flameEdge = flameTile.x * TILE_SIZE;

    expect(flameHurtboxOverlapsTile({ x: flameEdge - PLAYER_BODY_HALF - 0.5, y }, flameTile)).toBe(false);
    expect(flameHurtboxOverlapsTile({ x: flameEdge - PLAYER_BODY_HALF + 0.5, y }, flameTile)).toBe(true);
  });

  it("treats visible physical body overlap from a neighboring tile as lethal", () => {
    const flameTile = { x: 3, y: 1 };
    const y = flameTile.y * TILE_SIZE + HALF;
    const flameLeft = flameTile.x * TILE_SIZE;
    const pressedAgainstWallOverlap = { x: flameLeft - PLAYER_BODY_HALF + 0.5, y };

    expect(Math.floor(pressedAgainstWallOverlap.x / TILE_SIZE)).toBe(flameTile.x - 1);
    expect(bodyOverlapsTile(pressedAgainstWallOverlap, flameTile)).toBe(true);
    expect(flameHurtboxOverlapsTile(pressedAgainstWallOverlap, flameTile)).toBe(true);
  });

  it("parses tile keys through the canonical codec", () => {
    expect(tilesFromKeys(["2,3", "bad", "1,1"])).toEqual([
      { x: 2, y: 3 },
      { x: Number.NaN, y: Number.NaN },
      { x: 1, y: 1 },
    ].filter((tile) => Number.isFinite(tile.x) && Number.isFinite(tile.y)));
    expect(tilesFromKeys(["2,3", "1,1"])).toEqual([
      { x: 2, y: 3 },
      { x: 1, y: 1 },
    ]);
  });

  it("hits active flames by body overlap and ignores spent flames", () => {
    const flameTile = { x: 4, y: 1 };
    const center = {
      x: flameTile.x * TILE_SIZE + HALF,
      y: flameTile.y * TILE_SIZE + HALF,
    };
    expect(bodyOverlapsActiveFlame(center, {
      tile: flameTile,
      remainingMs: 100,
      ownerId: 2,
    })).toBe(true);
    expect(bodyOverlapsActiveFlame(center, {
      tile: flameTile,
      remainingMs: 0,
      ownerId: 2,
    })).toBe(false);

    const safe = {
      x: flameTile.x * TILE_SIZE - PLAYER_BODY_HALF - 0.5,
      y: center.y,
    };
    expect(findActiveFlameHittingBody(safe, [
      { tile: flameTile, remainingMs: 200, ownerId: 2 },
    ])).toBeNull();
  });

  it("selects living players overlapping tiles or flames", () => {
    const flameTile = { x: 2, y: 2 };
    const onFlame = playerAt(1, flameTile.x * TILE_SIZE + HALF, flameTile.y * TILE_SIZE + HALF);
    const away = playerAt(2, 300, 300);
    const dead = playerAt(1, flameTile.x * TILE_SIZE + HALF, flameTile.y * TILE_SIZE + HALF, false);

    expect(findPlayersOverlappingTiles([onFlame, away, dead], [flameTile]).map((p) => p.id)).toEqual([1]);
    expect(findPlayersHitByFlames([onFlame, away], [
      { tile: flameTile, remainingMs: 50, style: "normal", ownerId: 2 },
    ]).map(({ player }) => player.id)).toEqual([1]);
  });
});
