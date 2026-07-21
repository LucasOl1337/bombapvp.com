import { describe, expect, it } from "vitest";

import {
  getCharacterDefinition,
  listCharacterDefinitions,
  listCharacterPresentations,
  listCharacterRosterEntries,
  listCharacterSkillDefinitions,
} from "../Champions/index.ts";

describe("character catalog", () => {
  it("exposes a portable character definition through its stable ID", () => {
    expect(getCharacterDefinition("03a976fb-7313-4064-a477-5bb9b0760034")).toMatchObject({
      id: "03a976fb-7313-4064-a477-5bb9b0760034",
      name: "Ranni",
      roster: {
        order: 0,
        defaultSlot: 1,
      },
      presentation: {
        portraitPath: expect.stringContaining("/Champions/ranni/assets/portrait.png"),
        accent: "blue",
        localized: {
          "pt-BR": {
            label: "Controle espacial",
            skillName: "Ice Blink",
          },
          en: {
            label: "Space control",
            skillName: "Ice Blink",
          },
        },
      },
      skill: {
        id: "ranni-ice-blink",
        cooldownMs: 8_000,
      },
    });
  });

  it("protege a fonte canonica contra mutacao por consumidores", () => {
    const character = getCharacterDefinition("03a976fb-7313-4064-a477-5bb9b0760034");
    expect(character).not.toBeNull();
    if (!character) throw new Error("canonical_character_missing");

    expect(Object.isFrozen(character)).toBe(true);
    expect(Object.isFrozen(character.roster)).toBe(true);
    expect(Object.isFrozen(character.presentation.localized["pt-BR"])).toBe(true);
    expect(() => Object.assign(character.roster, { order: 99 })).toThrow(TypeError);
    expect(getCharacterDefinition(character.id)?.roster.order).toBe(0);
  });

  it("lists the complete roster in its canonical selection order", () => {
    expect(listCharacterDefinitions().map((character) => ({
      id: character.id,
      name: character.name,
      order: character.roster.order,
      defaultSlot: character.roster.defaultSlot,
    }))).toEqual([
      {
        id: "03a976fb-7313-4064-a477-5bb9b0760034",
        name: "Ranni",
        order: 0,
        defaultSlot: 1,
      },
      {
        id: "6ee8baa5-3277-413b-ae0e-2659b9cc52e9",
        name: "Killer Bee",
        order: 1,
        defaultSlot: 2,
      },
      {
        id: "d083c3dc-7162-4391-8628-6adde0b8d8d6",
        name: "Crocodilo Arcano",
        order: 2,
        defaultSlot: undefined,
      },
      {
        id: "5474c45c-2987-43e0-af2c-a6500c836881",
        name: "Nico",
        order: 3,
        defaultSlot: undefined,
      },
      {
        id: "9f3e2c1a-8b7d-4e6f-a0c1-2d3e4f5a6b7c",
        name: "Nix Ember",
        order: 4,
        defaultSlot: undefined,
      },
      {
        id: "c4a8e2f1-9b3d-4c7a-8e5f-1a2b3c4d5e6f",
        name: "Pendula",
        order: 5,
        defaultSlot: undefined,
      },
      {
        id: "a1b2c3d4-e5f6-4789-a012-3456789abc01",
        name: "Mirelle",
        order: 6,
        defaultSlot: undefined,
      },
      {
        id: "b7e4c2a1-5d6f-4a8b-9c0d-1e2f3a4b5c6d",
        name: "Lee Sin",
        order: 7,
        defaultSlot: undefined,
      },
      {
        id: "e7a1c4d2-9f3b-4c5e-a8d1-2b6f8e0c4a7d",
        name: "Thresh",
        order: 8,
        defaultSlot: undefined,
      },
      {
        id: "f2b8d4e6-1a3c-4b5d-9e7f-8c6a5b4d3e2f",
        name: "Katarina",
        order: 9,
        defaultSlot: undefined,
      },
      {
        id: "c155b0d5-644c-4b43-8d02-890e76574eff",
        name: "Madara",
        order: 10,
        defaultSlot: undefined,
      },
    ]);
  });

  it("projects localized launcher presentation from the same definitions", () => {
    const presentations = listCharacterPresentations("en");
    expect(presentations).toHaveLength(11);
    expect(presentations.map((entry) => entry.name)).toEqual([
      "Ranni",
      "Killer Bee",
      "Crocodilo Arcano",
      "Nico",
      "Nix Ember",
      "Pendula",
      "Mirelle",
      "Lee Sin",
      "Thresh",
      "Katarina",
      "Madara",
    ]);
    expect(presentations[0]).toMatchObject({
      id: "03a976fb-7313-4064-a477-5bb9b0760034",
      name: "Ranni",
      assetPath: expect.stringContaining("/Champions/ranni/assets/portrait.png"),
      accent: "blue",
      label: "Space control",
      skillName: "Ice Blink",
      skillCooldownMs: 8_000,
    });
    expect(presentations[0]?.description.length).toBeGreaterThan(20);
    expect(presentations[0]?.skillSummary.length).toBeGreaterThan(20);
    expect(presentations[0]?.analysis.length).toBeGreaterThan(20);
    expect(presentations.map((entry) => entry.skillName)).toEqual([
      "Ice Blink",
      "Wing Dash",
      "Emerald Surge",
      "Arcane Beam",
      "Ember Vault",
      "Command: Pull",
      "Tide Exchange",
      "Dragon's Rage",
      "Death Sentence",
      "Bouncing Blade",
      "Fireball Jutsu",
    ]);
  });

  it("projects the engine roster without duplicating character identity", () => {
    expect(listCharacterRosterEntries()).toEqual([
      {
        id: "03a976fb-7313-4064-a477-5bb9b0760034",
        name: "Ranni",
        defaultSlot: 1,
        order: 0,
      },
      {
        id: "6ee8baa5-3277-413b-ae0e-2659b9cc52e9",
        name: "Killer Bee",
        defaultSlot: 2,
        order: 1,
      },
      {
        id: "d083c3dc-7162-4391-8628-6adde0b8d8d6",
        name: "Crocodilo Arcano",
        order: 2,
      },
      {
        id: "5474c45c-2987-43e0-af2c-a6500c836881",
        name: "Nico",
        order: 3,
      },
      {
        id: "9f3e2c1a-8b7d-4e6f-a0c1-2d3e4f5a6b7c",
        name: "Nix Ember",
        order: 4,
      },
      {
        id: "c4a8e2f1-9b3d-4c7a-8e5f-1a2b3c4d5e6f",
        name: "Pendula",
        order: 5,
      },
      {
        id: "a1b2c3d4-e5f6-4789-a012-3456789abc01",
        name: "Mirelle",
        order: 6,
      },
      {
        id: "b7e4c2a1-5d6f-4a8b-9c0d-1e2f3a4b5c6d",
        name: "Lee Sin",
        order: 7,
      },
      {
        id: "e7a1c4d2-9f3b-4c5e-a8d1-2b6f8e0c4a7d",
        name: "Thresh",
        order: 8,
      },
      {
        id: "f2b8d4e6-1a3c-4b5d-9e7f-8c6a5b4d3e2f",
        name: "Katarina",
        order: 9,
      },
      {
        id: "c155b0d5-644c-4b43-8d02-890e76574eff",
        name: "Madara",
        order: 10,
      },
    ]);
  });

  it("projects every skill association from its owning character", () => {
    expect(listCharacterSkillDefinitions()).toEqual([
      {
        characterId: "03a976fb-7313-4064-a477-5bb9b0760034",
        skillId: "ranni-ice-blink",
        cooldownMs: 8_000,
      },
      {
        characterId: "6ee8baa5-3277-413b-ae0e-2659b9cc52e9",
        skillId: "killer-bee-wing-dash",
        cooldownMs: 4_000,
      },
      {
        characterId: "d083c3dc-7162-4391-8628-6adde0b8d8d6",
        skillId: "crocodilo-emerald-surge",
        cooldownMs: 6_000,
      },
      {
        characterId: "5474c45c-2987-43e0-af2c-a6500c836881",
        skillId: "nico-arcane-beam",
        cooldownMs: 8_000,
      },
      {
        characterId: "9f3e2c1a-8b7d-4e6f-a0c1-2d3e4f5a6b7c",
        skillId: "nix-ember-vault",
        cooldownMs: 7_000,
      },
      {
        characterId: "c4a8e2f1-9b3d-4c7a-8e5f-1a2b3c4d5e6f",
        skillId: "pendula-command-shockwave",
        cooldownMs: 7_500,
      },
      {
        characterId: "a1b2c3d4-e5f6-4789-a012-3456789abc01",
        skillId: "mirelle-tide-swap",
        cooldownMs: 8_000,
      },
      {
        characterId: "b7e4c2a1-5d6f-4a8b-9c0d-1e2f3a4b5c6d",
        skillId: "lee-sin-dragon-rage",
        cooldownMs: 6_500,
      },
      {
        characterId: "e7a1c4d2-9f3b-4c5e-a8d1-2b6f8e0c4a7d",
        skillId: "thresh-death-sentence",
        cooldownMs: 8_000,
      },
      {
        characterId: "f2b8d4e6-1a3c-4b5d-9e7f-8c6a5b4d3e2f",
        skillId: "katarina-bouncing-blade",
        cooldownMs: 8_000,
      },
      {
        characterId: "c155b0d5-644c-4b43-8d02-890e76574eff",
        skillId: "madara-fireball-jutsu",
        cooldownMs: 8_000,
      },
    ]);
  });
});
