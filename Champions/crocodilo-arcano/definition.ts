import type { CharacterDefinition } from "../contracts";
import { deepFreeze } from "../../src/shared/deep-freeze";
import portraitUrl from "./assets/portrait.png?url";
export const CROCODILO_CHARACTER_ID = "d083c3dc-7162-4391-8628-6adde0b8d8d6",
  CROCODILO_SKILL_ID = "crocodilo-emerald-surge",
  CROCODILO_SKILL_COOLDOWN_MS = 6000;
export const CROCODILO_DEFINITION = deepFreeze({
  id: CROCODILO_CHARACTER_ID,
  name: "Crocodilo Arcano",
  roster: { order: 2 },
  presentation: {
    portraitPath: portraitUrl,
    accent: "green",
    localized: {
      "pt-BR": {
        label: "Personagem 3",
        description: "Combatente 03 · personagem canônico",
      },
      en: {
        label: "Character 3",
        description: "Fighter 03 · canonical character",
      },
    },
  },
  skill: { id: CROCODILO_SKILL_ID, cooldownMs: CROCODILO_SKILL_COOLDOWN_MS },
} as const satisfies CharacterDefinition);
