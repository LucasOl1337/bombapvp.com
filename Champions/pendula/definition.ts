import type { CharacterDefinition } from "../contracts";
import { deepFreeze } from "../../src/shared/deep-freeze";
import portraitUrl from "./assets/portrait.png?url";

export const PENDULA_CHARACTER_ID = "c4a8e2f1-9b3d-4c7a-8e5f-1a2b3c4d5e6f";
export const PENDULA_SKILL_ID = "pendula-command-shockwave";
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
