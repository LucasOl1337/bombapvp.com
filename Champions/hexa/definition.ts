import type { CharacterDefinition } from "../contracts";
import { CHAMPION_MEMBERSHIP } from "../membership";
import { deepFreeze } from "../../src/shared/deep-freeze";
import portraitUrl from "./assets/portrait.png?url";

export const HEXA_CHARACTER_ID = CHAMPION_MEMBERSHIP["hexa"].characterId;
export const HEXA_SKILL_ID = CHAMPION_MEMBERSHIP["hexa"].skillId;
export const HEXA_SKILL_COOLDOWN_MS = 8000;

export const HEXA_DEFINITION = deepFreeze({
  id: HEXA_CHARACTER_ID,
  name: "Hexa",
  roster: { order: 9 },
  presentation: {
    portraitPath: portraitUrl,
    accent: "red",
    localized: {
      "pt-BR": {
        label: "Personagem 10",
        description: "Bruxa do pavio · Fuse Hex",
      },
      en: {
        label: "Character 10",
        description: "Fuse witch · Fuse Hex",
      },
    },
  },
  skill: {
    id: HEXA_SKILL_ID,
    cooldownMs: HEXA_SKILL_COOLDOWN_MS,
  },
} as const satisfies CharacterDefinition);
export const CHAMPION_DEFINITION = HEXA_DEFINITION;
