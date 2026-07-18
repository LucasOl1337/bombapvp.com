import { describe, expect, it } from "vitest";
import {
  listCharacterDefinitions,
  NICO_CHARACTER_ID,
  NIX_EMBER_CHARACTER_ID,
  PENDULA_CHARACTER_ID,
} from "../Champions";
import {
  getChampionAssets,
  listChampionAssetEntries,
} from "../Champions/assets-catalog";

describe("Champions module", () => {
  it("keeps each canonical champion definition, portrait and sprite bundle together", () => {
    const definitions = listCharacterDefinitions();
    const entries = listChampionAssetEntries();
    expect(definitions).toHaveLength(6);
    expect(entries).toHaveLength(6);
    const assetsByDefinition = definitions.map((definition) => ({
      name: definition.name,
      assets: getChampionAssets(definition.id),
    }));
    expect(
      assetsByDefinition.map(({ name, assets }) => ({
        name,
        size: assets.size,
        fileCount: assets.sourceFileCount,
      })),
    ).toEqual([
      { name: "Ranni", size: { width: 160, height: 160 }, fileCount: 140 },
      { name: "Killer Bee", size: { width: 124, height: 124 }, fileCount: 154 },
      {
        name: "Crocodilo Arcano",
        size: { width: 156, height: 156 },
        fileCount: 152,
      },
      { name: "Nico", size: { width: 116, height: 116 }, fileCount: 130 },
      { name: "Nix Ember", size: { width: 124, height: 124 }, fileCount: 124 },
      { name: "Pendula", size: { width: 124, height: 124 }, fileCount: 124 },
    ]);
    for (const { assets } of entries) {
      expect(assets.portraitUrl).toContain("/Champions/");
      expect(Object.values(assets.staticSprites).every(Boolean)).toBe(true);
      expect(Object.isFrozen(assets.animations)).toBe(true);
    }
    expect(getChampionAssets(NICO_CHARACTER_ID).animations.attack).toEqual({
      up: [],
      down: [],
      left: [],
      right: [],
    });
    expect(getChampionAssets(NICO_CHARACTER_ID)).toHaveProperty(
      "effects.grimoire",
      expect.stringContaining("/Champions/nico/assets/effects/nico-grimoire.png"),
    );
    expect(getChampionAssets(NIX_EMBER_CHARACTER_ID).animations.attack.down.length).toBe(6);
    expect(getChampionAssets(NIX_EMBER_CHARACTER_ID).animations.cast.down.length).toBe(4);
    expect(getChampionAssets(NIX_EMBER_CHARACTER_ID).animations.walk.down.length).toBe(8);
    expect(getChampionAssets(PENDULA_CHARACTER_ID).animations.walk.down.length).toBe(8);
    expect(getChampionAssets(PENDULA_CHARACTER_ID).animations.cast.down.length).toBe(4);
    expect(getChampionAssets(PENDULA_CHARACTER_ID).animations.walk.right.length).toBe(8);
    expect(getChampionAssets(PENDULA_CHARACTER_ID).animations.walk.up.length).toBe(8);
  });
});
