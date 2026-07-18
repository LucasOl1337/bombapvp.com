import type { CharacterDefinition } from "../contracts";
import { deepFreeze } from "../../src/shared/deep-freeze";
import portraitUrl from "./assets/portrait.png?url";

export const NIX_EMBER_CHARACTER_ID = "9f3e2c1a-8b7d-4e6f-a0c1-2d3e4f5a6b7c";
export const NIX_EMBER_SKILL_ID = "nix-ember-vault";
export const NIX_EMBER_SKILL_COOLDOWN_MS = 7_000;

export const NIX_EMBER_DEFINITION = deepFreeze({
  id: NIX_EMBER_CHARACTER_ID,
  name: "Nix Ember",
  roster: { order: 4 },
  presentation: {
    portraitPath: portraitUrl,
    accent: "red",
    localized: {
      "pt-BR": {
        label: "Personagem 5",
        description: "Sabotador de brasas · vault de sobrevivência",
      },
      en: {
        label: "Character 5",
        description: "Ember saboteur · survival vault hop",
      },
    },
  },
  skill: {
    id: NIX_EMBER_SKILL_ID,
    cooldownMs: NIX_EMBER_SKILL_COOLDOWN_MS,
  },
} as const satisfies CharacterDefinition);
