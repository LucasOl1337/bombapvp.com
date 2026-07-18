import { describe, expect, it } from "vitest";
import { listCharacterDefinitions, NICO_CHARACTER_ID, NIX_EMBER_CHARACTER_ID } from "../Champions";
import {
  getChampionAssets,
  listChampionAssetEntries,
} from "../Champions/assets-catalog";

describe("Champions module", () => {
  it("keeps each canonical champion definition, portrait and sprite bundle together", () => {
    const definitions = listCharacterDefinitions();
    const entries = listChampionAssetEntries();
    expect(definitions).toHaveLength(5);
    expect(entries).toHaveLength(5);
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
    ]);
    for (const { assets } of entries) {
      expect(assets.portraitUrl).toContain("/Champions/");
      expect(Object.values(assets.staticSprites).every(Boolean)).toBe(true);
      expect(Object.isFrozen(assets.animations)).toBe(true);
    }
    // Nico still has empty attack clip and grimoire effect
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
    // Nix Ember has plant body frames mapped to attack + cast vault frames
    expect(getChampionAssets(NIX_EMBER_CHARACTER_ID).animations.attack.down.length).toBe(6);
    expect(getChampionAssets(NIX_EMBER_CHARACTER_ID).animations.cast.down.length).toBe(4);
    expect(getChampionAssets(NIX_EMBER_CHARACTER_ID).animations.walk.down.length).toBe(8);
  });
});
