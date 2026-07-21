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
const LEE_SIN_CHARACTER_ID = CHAMPION_MEMBERSHIP["lee-sin"].characterId;
const THRESH_CHARACTER_ID = CHAMPION_MEMBERSHIP["thresh"].characterId;
const KATARINA_CHARACTER_ID = CHAMPION_MEMBERSHIP["katarina"].characterId;
const MADARA_CHARACTER_ID = CHAMPION_MEMBERSHIP["madara"].characterId;

describe("Champions module", () => {
  it("keeps each canonical champion definition, portrait and sprite bundle together", () => {
    const definitions = listCharacterDefinitions();
    const entries = listChampionAssetEntries();
    expect(definitions).toHaveLength(11);
    expect(entries).toHaveLength(11);
    const assetsByDefinition = definitions.map((definition) => ({
      name: definition.name,
      assets: getChampionAssets(definition.id),
    }));
    // Mirelle fileCount is dynamic after art rebuild — assert ranges.
    const summary = assetsByDefinition.map(({ name, assets }) => ({
      name,
      size: assets.size,
      fileCount: assets.sourceFileCount,
    }));
    expect(summary.slice(0, 6)).toEqual([
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
    ]);
    expect(summary[6]).toMatchObject({
      name: "Mirelle",
      size: { width: 124, height: 124 },
    });
    expect(summary[6]!.fileCount).toBeGreaterThanOrEqual(80);
    expect(summary[6]!.fileCount).toBeLessThanOrEqual(280);
    expect(summary[7]).toMatchObject({
      name: "Lee Sin",
      size: { width: 160, height: 160 },
    });
    expect(summary[7]!.fileCount).toBe(179);
    expect(summary[8]).toMatchObject({
      name: "Thresh",
      size: { width: 160, height: 160 },
    });
    expect(summary[8]!.fileCount).toBe(124);
    expect(summary[9]).toMatchObject({
      name: "Katarina",
      size: { width: 160, height: 160 },
    });
    expect(summary[9]!.fileCount).toBe(124);
    expect(summary[10]).toMatchObject({
      name: "Madara",
      size: { width: 160, height: 160 },
    });
    expect(summary[10]!.fileCount).toBe(124);
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
    expect(getChampionAssets(LEE_SIN_CHARACTER_ID).animations.walk.down.length).toBe(8);
    expect(getChampionAssets(LEE_SIN_CHARACTER_ID).animations.cast.down.length).toBe(7);
    expect(getChampionAssets(LEE_SIN_CHARACTER_ID).animations.run.right.length).toBe(6);
    expect(getChampionAssets(LEE_SIN_CHARACTER_ID).animations.walk.left.length).toBe(8);
    expect(getChampionAssets(LEE_SIN_CHARACTER_ID).animations.walk.up.length).toBe(8);
    expect(getChampionAssets(THRESH_CHARACTER_ID).animations.idle.down.length).toBe(8);
    expect(getChampionAssets(THRESH_CHARACTER_ID).animations.walk.down.length).toBe(8);
    expect(getChampionAssets(THRESH_CHARACTER_ID).animations.walk.right.length).toBe(8);
    expect(getChampionAssets(THRESH_CHARACTER_ID).animations.walk.up.length).toBe(8);
    expect(getChampionAssets(THRESH_CHARACTER_ID).animations.walk.left.length).toBe(8);
    expect(getChampionAssets(THRESH_CHARACTER_ID).animations.cast.down.length).toBe(6);
    expect(getChampionAssets(THRESH_CHARACTER_ID).animations.attack.down.length).toBe(4);
    expect(getChampionAssets(THRESH_CHARACTER_ID).animations.death.down.length).toBe(4);
    expect(getChampionAssets(KATARINA_CHARACTER_ID).animations.idle.down.length).toBe(8);
    expect(getChampionAssets(KATARINA_CHARACTER_ID).animations.walk.down.length).toBe(8);
    expect(getChampionAssets(KATARINA_CHARACTER_ID).animations.walk.right.length).toBe(8);
    expect(getChampionAssets(KATARINA_CHARACTER_ID).animations.walk.up.length).toBe(8);
    expect(getChampionAssets(KATARINA_CHARACTER_ID).animations.walk.left.length).toBe(8);
    expect(getChampionAssets(KATARINA_CHARACTER_ID).animations.cast.down.length).toBe(6);
    expect(getChampionAssets(KATARINA_CHARACTER_ID).animations.attack.down.length).toBe(4);
    expect(getChampionAssets(KATARINA_CHARACTER_ID).animations.death.down.length).toBe(4);
    expect(getChampionAssets(MADARA_CHARACTER_ID).animations.idle.down.length).toBe(8);
    expect(getChampionAssets(MADARA_CHARACTER_ID).animations.walk.down.length).toBe(8);
    expect(getChampionAssets(MADARA_CHARACTER_ID).animations.walk.right.length).toBe(8);
    expect(getChampionAssets(MADARA_CHARACTER_ID).animations.walk.up.length).toBe(8);
    expect(getChampionAssets(MADARA_CHARACTER_ID).animations.walk.left.length).toBe(8);
    expect(getChampionAssets(MADARA_CHARACTER_ID).animations.cast.down.length).toBe(6);
    expect(getChampionAssets(MADARA_CHARACTER_ID).animations.attack.down.length).toBe(4);
    expect(getChampionAssets(MADARA_CHARACTER_ID).animations.death.down.length).toBe(4);
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
