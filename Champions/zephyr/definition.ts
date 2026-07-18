import type { CharacterDefinition } from "../contracts";
import { CHAMPION_MEMBERSHIP } from "../membership";
import { deepFreeze } from "../../src/shared/deep-freeze";
import portraitUrl from "./assets/portrait.png?url";

export const ZEPHYR_CHARACTER_ID = CHAMPION_MEMBERSHIP["zephyr"].characterId;
export const ZEPHYR_SKILL_ID = CHAMPION_MEMBERSHIP["zephyr"].skillId;
export const ZEPHYR_SKILL_COOLDOWN_MS = 7500;

export const ZEPHYR_DEFINITION = deepFreeze({
  id: ZEPHYR_CHARACTER_ID,
  name: "Zephyr",
  roster: { order: 8 },
  presentation: {
    portraitPath: portraitUrl,
    accent: "green",
    localized: {
      "pt-BR": {
        label: "Personagem 9",
        description: "Espirito do vento · Gale Scatter",
      },
      en: {
        label: "Character 9",
        description: "Wind spirit · Gale Scatter",
      },
    },
  },
  skill: {
    id: ZEPHYR_SKILL_ID,
    cooldownMs: ZEPHYR_SKILL_COOLDOWN_MS,
  },
} as const satisfies CharacterDefinition);
export const CHAMPION_DEFINITION = ZEPHYR_DEFINITION;
