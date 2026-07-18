import type { CharacterDefinition } from "../contracts";
import { CHAMPION_MEMBERSHIP } from "../membership";
import { deepFreeze } from "../../src/shared/deep-freeze";
import portraitUrl from "./assets/portrait.png?url";

export const PENDULA_CHARACTER_ID = CHAMPION_MEMBERSHIP.pendula.characterId;
export const PENDULA_SKILL_ID = CHAMPION_MEMBERSHIP.pendula.skillId;
export const PENDULA_SKILL_COOLDOWN_MS = 7_500;

export const PENDULA_DEFINITION = deepFreeze({
  id: PENDULA_CHARACTER_ID,
  name: "Pendula",
  roster: { order: 5 },
  presentation: {
    portraitPath: portraitUrl,
    accent: "gold",
    localized: {
      "pt-BR": {
        label: "Personagem 6",
        description: "Autômata de relojoaria · Command: Pull",
      },
      en: {
        label: "Character 6",
        description: "Clockwork ballerina · Command: Pull",
      },
    },
  },
  skill: {
    id: PENDULA_SKILL_ID,
    cooldownMs: PENDULA_SKILL_COOLDOWN_MS,
  },
} as const satisfies CharacterDefinition);
export const CHAMPION_DEFINITION = PENDULA_DEFINITION;
