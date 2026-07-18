import type { CharacterDefinition } from "../contracts";
import { CHAMPION_MEMBERSHIP } from "../membership";
import { deepFreeze } from "../../src/shared/deep-freeze";
import portraitUrl from "./assets/portrait.png?url";
export const KILLER_BEE_CHARACTER_ID = CHAMPION_MEMBERSHIP["killer-bee"].characterId,
  KILLER_BEE_SKILL_ID = CHAMPION_MEMBERSHIP["killer-bee"].skillId,
  KILLER_BEE_SKILL_COOLDOWN_MS = 4000;
export const KILLER_BEE_DEFINITION = deepFreeze({
  id: KILLER_BEE_CHARACTER_ID,
  name: "Killer Bee",
  roster: { order: 1, defaultSlot: 2 },
  presentation: {
    portraitPath: portraitUrl,
    accent: "gold",
    localized: {
      "pt-BR": {
        label: "Personagem 2",
        description: "Combatente 02 · personagem canônico",
      },
      en: {
        label: "Character 2",
        description: "Fighter 02 · canonical character",
      },
    },
  },
  skill: { id: KILLER_BEE_SKILL_ID, cooldownMs: KILLER_BEE_SKILL_COOLDOWN_MS },
} as const satisfies CharacterDefinition);
export const CHAMPION_DEFINITION = KILLER_BEE_DEFINITION;
