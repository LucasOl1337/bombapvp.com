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
            label: "Personagem 1",
            description: "Combatente 01 · personagem canônico",
          },
          en: {
            label: "Character 1",
            description: "Fighter 01 · canonical character",
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
    ]);
  });

  it("projects localized launcher presentation from the same definitions", () => {
    expect(listCharacterPresentations("en")).toEqual([
      {
        id: "03a976fb-7313-4064-a477-5bb9b0760034",
        name: "Ranni",
        assetPath: expect.stringContaining("/Champions/ranni/assets/portrait.png"),
        accent: "blue",
        label: "Character 1",
        description: "Fighter 01 · canonical character",
      },
      {
        id: "6ee8baa5-3277-413b-ae0e-2659b9cc52e9",
        name: "Killer Bee",
        assetPath: expect.stringContaining("/Champions/killer-bee/assets/portrait.png"),
        accent: "gold",
        label: "Character 2",
        description: "Fighter 02 · canonical character",
      },
      {
        id: "d083c3dc-7162-4391-8628-6adde0b8d8d6",
        name: "Crocodilo Arcano",
        assetPath: expect.stringContaining("/Champions/crocodilo-arcano/assets/portrait.png"),
        accent: "green",
        label: "Character 3",
        description: "Fighter 03 · canonical character",
      },
      {
        id: "5474c45c-2987-43e0-af2c-a6500c836881",
        name: "Nico",
        assetPath: expect.stringContaining("/Champions/nico/assets/portrait.png"),
        accent: "red",
        label: "Character 4",
        description: "Fighter 04 · canonical character",
      },
      {
        id: "9f3e2c1a-8b7d-4e6f-a0c1-2d3e4f5a6b7c",
        name: "Nix Ember",
        assetPath: expect.stringContaining("/Champions/nix-ember/assets/portrait.png"),
        accent: "red",
        label: "Character 5",
        description: "Ember saboteur · survival vault hop",
      },
      {
        id: "c4a8e2f1-9b3d-4c7a-8e5f-1a2b3c4d5e6f",
        name: "Pendula",
        assetPath: expect.stringContaining("/Champions/pendula/assets/portrait.png"),
        accent: "gold",
        label: "Character 6",
        description: "Clockwork ballerina · Command: Pull",
      },
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
    ]);
  });

});
