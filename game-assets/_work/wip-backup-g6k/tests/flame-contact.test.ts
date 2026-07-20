import { describe, expect, it } from "vitest";
import {
  FLAME_HURTBOX_HALF_RATIO,
  flameHurtboxOverlapsTile,
  tilesFromKeys,
} from "../src/original-game/Gameplay/flame-contact.ts";
import { PLAYER_BODY_HALF } from "../src/original-game/Gameplay/player-body.ts";
import { TILE_SIZE } from "../src/original-game/PersonalConfig/config.ts";

const HALF = TILE_SIZE * 0.5;

describe("flame-contact pure helpers", () => {
  it("uses a forgiving hurtbox independent from physical collision", () => {
    const flameTile = { x: 3, y: 1 };
    const y = flameTile.y * TILE_SIZE + HALF;
    const flameEdge = flameTile.x * TILE_SIZE;

    expect(FLAME_HURTBOX_HALF_RATIO).toBeLessThan(PLAYER_BODY_HALF / TILE_SIZE);
    expect(flameHurtboxOverlapsTile({ x: flameEdge - 1, y }, flameTile)).toBe(false);
    expect(flameHurtboxOverlapsTile({ x: flameEdge + 9, y }, flameTile)).toBe(true);
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

  it("evaluates only instantaneous blast geometry", () => {
    const flameTile = { x: 4, y: 1 };
    const center = {
      x: flameTile.x * TILE_SIZE + HALF,
      y: flameTile.y * TILE_SIZE + HALF,
    };
    expect(flameHurtboxOverlapsTile(center, flameTile)).toBe(true);

    const safe = {
      x: flameTile.x * TILE_SIZE - PLAYER_BODY_HALF - 0.5,
      y: center.y,
    };
    expect(flameHurtboxOverlapsTile(safe, flameTile)).toBe(false);
  });
});
