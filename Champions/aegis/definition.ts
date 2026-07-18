import type { CharacterDefinition } from "../contracts";
import { CHAMPION_MEMBERSHIP } from "../membership";
import { deepFreeze } from "../../src/shared/deep-freeze";
import portraitUrl from "./assets/portrait.png?url";

export const AEGIS_CHARACTER_ID = CHAMPION_MEMBERSHIP["aegis"].characterId;
export const AEGIS_SKILL_ID = CHAMPION_MEMBERSHIP["aegis"].skillId;
export const AEGIS_SKILL_COOLDOWN_MS = 8500;

export const AEGIS_DEFINITION = deepFreeze({
  id: AEGIS_CHARACTER_ID,
  name: "Aegis",
  roster: { order: 10 },
  presentation: {
    portraitPath: portraitUrl,
    accent: "gold",
    localized: {
      "pt-BR": {
        label: "Personagem 11",
        description: "Cavaleiro bastiao · Bastion Pulse",
      },
      en: {
        label: "Character 11",
        description: "Bastion knight · Bastion Pulse",
      },
    },
  },
  skill: {
    id: AEGIS_SKILL_ID,
    cooldownMs: AEGIS_SKILL_COOLDOWN_MS,
  },
} as const satisfies CharacterDefinition);
export const CHAMPION_DEFINITION = AEGIS_DEFINITION;
