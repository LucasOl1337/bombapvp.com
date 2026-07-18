import type { CharacterDefinition } from "../contracts";
import { CHAMPION_MEMBERSHIP } from "../membership";
import { deepFreeze } from "../../src/shared/deep-freeze";
import portraitUrl from "./assets/portrait.png?url";

export const NIX_EMBER_CHARACTER_ID = CHAMPION_MEMBERSHIP["nix-ember"].characterId;
export const NIX_EMBER_SKILL_ID = CHAMPION_MEMBERSHIP["nix-ember"].skillId;
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
export const CHAMPION_DEFINITION = NIX_EMBER_DEFINITION;
