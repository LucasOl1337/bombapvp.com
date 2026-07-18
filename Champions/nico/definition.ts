import type { CharacterDefinition } from "../contracts";
import { deepFreeze } from "../../src/shared/deep-freeze";
import portraitUrl from "./assets/portrait.png?url";
export const NICO_CHARACTER_ID = "5474c45c-2987-43e0-af2c-a6500c836881",
  NICO_SKILL_ID = "nico-arcane-beam",
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
