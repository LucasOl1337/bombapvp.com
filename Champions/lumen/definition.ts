import type { CharacterDefinition } from "../contracts";
import { CHAMPION_MEMBERSHIP } from "../membership";
import { deepFreeze } from "../../src/shared/deep-freeze";
import portraitUrl from "./assets/portrait.png?url";

export const LUMEN_CHARACTER_ID = CHAMPION_MEMBERSHIP["lumen"].characterId;
export const LUMEN_SKILL_ID = CHAMPION_MEMBERSHIP["lumen"].skillId;
export const LUMEN_SKILL_COOLDOWN_MS = 7000;

export const LUMEN_DEFINITION = deepFreeze({
  id: LUMEN_CHARACTER_ID,
  name: "Lumen",
  roster: { order: 11 },
  presentation: {
    portraitPath: portraitUrl,
    accent: "blue",
    localized: {
      "pt-BR": {
        label: "Personagem 12",
        description: "Fada de luz · Flash Step",
      },
      en: {
        label: "Character 12",
        description: "Light fairy · Flash Step",
      },
    },
  },
  skill: {
    id: LUMEN_SKILL_ID,
    cooldownMs: LUMEN_SKILL_COOLDOWN_MS,
  },
} as const satisfies CharacterDefinition);
export const CHAMPION_DEFINITION = LUMEN_DEFINITION;
