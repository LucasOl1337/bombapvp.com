import type { CharacterDefinition } from "../contracts";
import { CHAMPION_MEMBERSHIP } from "../membership";
import { deepFreeze } from "../../src/shared/deep-freeze";
import portraitUrl from "./assets/portrait.png?url";

export const BRAM_CHARACTER_ID = CHAMPION_MEMBERSHIP["bram"].characterId;
export const BRAM_SKILL_ID = CHAMPION_MEMBERSHIP["bram"].skillId;
export const BRAM_SKILL_COOLDOWN_MS = 9000;

export const BRAM_DEFINITION = deepFreeze({
  id: BRAM_CHARACTER_ID,
  name: "Bram",
  roster: { order: 7 },
  presentation: {
    portraitPath: portraitUrl,
    accent: "gold",
    localized: {
      "pt-BR": {
        label: "Personagem 8",
        description: "Golem de pedra · Seismic Crack",
      },
      en: {
        label: "Character 8",
        description: "Stone golem · Seismic Crack",
      },
    },
  },
  skill: {
    id: BRAM_SKILL_ID,
    cooldownMs: BRAM_SKILL_COOLDOWN_MS,
  },
} as const satisfies CharacterDefinition);
export const CHAMPION_DEFINITION = BRAM_DEFINITION;
