import type { CharacterDefinition } from "../contracts";
import { CHAMPION_MEMBERSHIP } from "../membership";
import { deepFreeze } from "../../src/shared/deep-freeze";
import portraitUrl from "./assets/portrait.png?url";
export const NICO_CHARACTER_ID = CHAMPION_MEMBERSHIP.nico.characterId,
  NICO_SKILL_ID = CHAMPION_MEMBERSHIP.nico.skillId,
  NICO_SKILL_COOLDOWN_MS = 8000;
export const NICO_DEFINITION = deepFreeze({
  id: NICO_CHARACTER_ID,
  name: "Nico",
  roster: { order: 3 },
  presentation: {
    portraitPath: portraitUrl,
    accent: "red",
    localized: {
      "pt-BR": {
        label: "Personagem 4",
        description: "Combatente 04 · personagem canônico",
      },
      en: {
        label: "Character 4",
        description: "Fighter 04 · canonical character",
      },
    },
  },
  skill: { id: NICO_SKILL_ID, cooldownMs: NICO_SKILL_COOLDOWN_MS },
} as const satisfies CharacterDefinition);
export const CHAMPION_DEFINITION = NICO_DEFINITION;
