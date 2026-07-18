import { describe, expect, it } from "vitest";
import {
  CHAMPION_MEMBERSHIP,
  listChampionMembership,
  listCharacterDefinitions,
} from "../Champions";
import { getChampionSkillAdapter } from "../Champions/runtime";
import { createChampionVisualRuntime } from "../Champions/visual-runtime";
import {
  getChampionAssets,
  listChampionAssetEntries,
} from "../Champions/assets-catalog";

const NICO_CHARACTER_ID = CHAMPION_MEMBERSHIP.nico.characterId;
const NIX_EMBER_CHARACTER_ID = CHAMPION_MEMBERSHIP["nix-ember"].characterId;
const PENDULA_CHARACTER_ID = CHAMPION_MEMBERSHIP.pendula.characterId;

describe("Champions module", () => {
  it("keeps each canonical champion definition, portrait and sprite bundle together", () => {
    const definitions = listCharacterDefinitions();
    const entries = listChampionAssetEntries();
    expect(definitions).toHaveLength(12);
    expect(entries).toHaveLength(12);
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
      { name: "Pendula", size: { width: 124, height: 124 }, fileCount: 156 },
      { name: "Mirelle", size: { width: 124, height: 124 }, fileCount: 116 },
      { name: "Bram", size: { width: 124, height: 124 }, fileCount: 116 },
      { name: "Zephyr", size: { width: 124, height: 124 }, fileCount: 116 },
      { name: "Hexa", size: { width: 124, height: 124 }, fileCount: 116 },
      { name: "Aegis", size: { width: 124, height: 124 }, fileCount: 116 },
      { name: "Lumen", size: { width: 124, height: 124 }, fileCount: 116 },
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
    expect(getChampionAssets(PENDULA_CHARACTER_ID).animations.walk.down.length).toBe(12);
    expect(getChampionAssets(PENDULA_CHARACTER_ID).animations.cast.down.length).toBe(6);
    expect(getChampionAssets(PENDULA_CHARACTER_ID).animations.idle.down.length).toBe(6);
    expect(getChampionAssets(PENDULA_CHARACTER_ID).animations.walk.right.length).toBe(12);
    expect(getChampionAssets(PENDULA_CHARACTER_ID).animations.walk.up.length).toBe(12);
  });

  it("projects every canonical membership into light and heavy registries", () => {
    const membership = listChampionMembership();
    const definitions = listCharacterDefinitions();
    const assetEntries = listChampionAssetEntries();

    expect(
      membership.map(({ slug, characterId, skillId }) => ({
        slug,
        characterId,
        skillId,
      })),
    ).toEqual(
      definitions.map((definition) => ({
        slug: membership.find((entry) => entry.characterId === definition.id)?.slug,
        characterId: definition.id,
        skillId: definition.skill.id,
      })),
    );
    expect(assetEntries.map(({ characterId }) => characterId)).toEqual(
      definitions.map(({ id }) => id),
    );
    for (const definition of definitions) {
      expect(getChampionSkillAdapter(definition.skill.id)?.skillId).toBe(
        definition.skill.id,
      );
    }
    expect(() => createChampionVisualRuntime()).not.toThrow();
  });
});
