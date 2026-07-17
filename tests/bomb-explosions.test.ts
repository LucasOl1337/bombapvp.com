import { describe, expect, it } from "vitest";
import { resolveBombExplosions } from "../src/original-game/Engine/bomb-explosions.ts";

describe("resolucao autoritativa de explosoes", () => {
  it("nao resolve uma onda antes de seu fuse vencer", () => {
    expect(resolveBombExplosions({
      bombs: [{ id: 1, tile: { x: 1, y: 1 }, fuseMs: 1, flameRange: 2 }],
      arena: {
        width: 5,
        height: 5,
        solid: new Set(),
        breakable: new Set(),
      },
    })).toEqual([]);
  });

  it("propaga chamas ate bloqueios e consome a primeira caixa de cada direcao", () => {
    const result = resolveBombExplosions({
      bombs: [{
        id: 1,
        tile: { x: 2, y: 2 },
        fuseMs: 0,
        flameRange: 3,
      }],
      arena: {
        width: 7,
        height: 5,
        solid: new Set(["4,2"]),
        breakable: new Set(["2,1"]),
      },
    });

    expect(result).toEqual([{
      bombId: 1,
      flameTiles: [
        { x: 2, y: 2 },
        { x: 2, y: 1 },
        { x: 2, y: 3 },
        { x: 2, y: 4 },
        { x: 1, y: 2 },
        { x: 0, y: 2 },
        { x: 3, y: 2 },
      ],
      brokenCrateKeys: ["2,1"],
      chainReactions: [],
    }]);
  });

  it("resolve reacoes em cadeia na ordem e usa as caixas ja quebradas pela mesma onda", () => {
    const breakable = new Set(["4,1"]);
    const result = resolveBombExplosions({
      bombs: [
        { id: 1, tile: { x: 1, y: 1 }, fuseMs: 0, flameRange: 4 },
        { id: 2, tile: { x: 3, y: 1 }, fuseMs: 900, flameRange: 3 },
      ],
      arena: {
        width: 7,
        height: 3,
        solid: new Set(),
        breakable,
      },
    });

    expect(result.map((explosion) => explosion.bombId)).toEqual([1, 2]);
    expect(result[0]).toMatchObject({
      brokenCrateKeys: ["4,1"],
      chainReactions: [{
        fromTile: { x: 1, y: 1 },
        toTile: { x: 3, y: 1 },
      }],
    });
    expect(result[1]?.flameTiles).toContainEqual({ x: 5, y: 1 });
    expect(breakable).toEqual(new Set(["4,1"]));
  });
});
