import type { CharacterDefinition } from "../contracts";
import { CHAMPION_MEMBERSHIP } from "../membership";
import { deepFreeze } from "../../src/shared/deep-freeze";
import portraitUrl from "./assets/portrait.png?url";

export const MIRELLE_CHARACTER_ID = CHAMPION_MEMBERSHIP["mirelle"].characterId;
export const MIRELLE_SKILL_ID = CHAMPION_MEMBERSHIP["mirelle"].skillId;
export const MIRELLE_SKILL_COOLDOWN_MS = 8000;

export const MIRELLE_DEFINITION = deepFreeze({
  id: MIRELLE_CHARACTER_ID,
  name: "Mirelle",
  roster: { order: 6 },
  presentation: {
    portraitPath: portraitUrl,
    accent: "blue",
    localized: {
      "pt-BR": {
        label: "Personagem 7",
        description: "Sereia das mares · Tide Swap",
      },
      en: {
        label: "Character 7",
        description: "Tide siren · Tide Swap",
      },
    },
  },
  skill: {
    id: MIRELLE_SKILL_ID,
    cooldownMs: MIRELLE_SKILL_COOLDOWN_MS,
  },
} as const satisfies CharacterDefinition);
export const CHAMPION_DEFINITION = MIRELLE_DEFINITION;
