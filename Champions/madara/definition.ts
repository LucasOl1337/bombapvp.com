import type { CharacterDefinition } from "../contracts";
import { CHAMPION_MEMBERSHIP } from "../membership";
import { deepFreeze } from "../deep-freeze.ts";
import portraitUrl from "./assets/portrait.png?url";

export const MADARA_CHARACTER_ID = CHAMPION_MEMBERSHIP["madara"].characterId;
export const MADARA_SKILL_ID = CHAMPION_MEMBERSHIP["madara"].skillId;
export const MADARA_SKILL_COOLDOWN_MS = CHAMPION_MEMBERSHIP["madara"].skillCooldownMs;

export const MADARA_DEFINITION = deepFreeze({
  id: MADARA_CHARACTER_ID,
  name: "Madara",
  roster: { order: 10 },
  presentation: {
    portraitPath: portraitUrl,
    accent: "orange",
    localized: {
      "pt-BR": {
        label: "Senhor do fogo",
        description:
          "A reencarnação do Uchiha. Dispara uma bola de fogo que quebra até 3 caixas em linha reta e deixa chamas laterais no fim do trajeto.",
        skillName: "Fireball Jutsu",
        skillSummary:
          "Bola de fogo viaja em linha reta, destrói até 3 caixas e, ao final, espalha chamas nos quadrados laterais.",
        analysis:
          "Use para abrir corredores de caixas ou forçar rivais a saírem do tile final. O fogo persiste por poucos segundos, negando a área.",
      },
      en: {
        label: "Lord of fire",
        description:
          "The Uchiha reborn. Hurls a fireball that burns up to 3 crates in a straight line and leaves lateral flames at the end of its path.",
        skillName: "Fireball Jutsu",
        skillSummary:
          "A fireball travels in a straight line, destroys up to 3 crates, and spreads flames to the side squares at the end.",
        analysis:
          "Use it to open crate corridors or force rivals off the final tile. The fire lingers for a few seconds, denying the area.",
      },
    },
  },
  skill: {
    id: MADARA_SKILL_ID,
    cooldownMs: MADARA_SKILL_COOLDOWN_MS,
  },
} as const satisfies CharacterDefinition);
export const CHAMPION_DEFINITION = MADARA_DEFINITION;
