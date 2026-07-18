import type { CharacterDefinition } from "../contracts";
import { CHAMPION_MEMBERSHIP } from "../membership";
import { deepFreeze } from "../../src/shared/deep-freeze";
import portraitUrl from "./assets/portrait.png?url";
export const RANNI_CHARACTER_ID = CHAMPION_MEMBERSHIP.ranni.characterId,
  RANNI_SKILL_ID = CHAMPION_MEMBERSHIP.ranni.skillId,
  RANNI_SKILL_COOLDOWN_MS = 8000;
export const RANNI_DEFINITION = deepFreeze({
  id: RANNI_CHARACTER_ID,
  name: "Ranni",
  roster: { order: 0, defaultSlot: 1 },
  presentation: {
    portraitPath: portraitUrl,
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
  skill: { id: RANNI_SKILL_ID, cooldownMs: RANNI_SKILL_COOLDOWN_MS },
} as const satisfies CharacterDefinition);
export const CHAMPION_DEFINITION = RANNI_DEFINITION;
