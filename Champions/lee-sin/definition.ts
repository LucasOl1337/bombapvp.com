import type { CharacterDefinition } from "../contracts";
import { CHAMPION_MEMBERSHIP } from "../membership";
import { deepFreeze } from "../deep-freeze.ts";
import portraitUrl from "./assets/portrait.png?url";

export const LEE_SIN_CHARACTER_ID = CHAMPION_MEMBERSHIP["lee-sin"].characterId;
export const LEE_SIN_SKILL_ID = CHAMPION_MEMBERSHIP["lee-sin"].skillId;
export const LEE_SIN_SKILL_COOLDOWN_MS = 6_500;

export const LEE_SIN_DEFINITION = deepFreeze({
  id: LEE_SIN_CHARACTER_ID,
  name: "Lee Sin",
  roster: { order: 7 },
  presentation: {
    portraitPath: portraitUrl,
    accent: "gold",
    localized: {
      "pt-BR": {
        label: "Kick ofensivo",
        description:
          "Monge cego do dragão. Fecha distância com um chute explosivo e joga rivais para longe da rota segura.",
        skillName: "Fúria do Dragão",
        skillSummary:
          "Avança com um chute na direção atual. O primeiro inimigo no caminho é arremessado e eliminado; quebra caixas na linha.",
        analysis:
          "Execute de perto na mesma linha. Errou o ângulo e o dash vira só deslocamento no fogo.",
      },
      en: {
        label: "Offensive kick",
        description:
          "Blind dragon monk. He closes gaps with an explosive kick and flings rivals off the safe path.",
        skillName: "Dragon's Rage",
        skillSummary:
          "Dashes with a kick in the facing direction. The first enemy on the path is knocked back and eliminated; breaks crates on the line.",
        analysis:
          "Execute on the same line. A missed angle turns the dash into free movement into fire.",
      },
    },
  },
  skill: {
    id: LEE_SIN_SKILL_ID,
    cooldownMs: LEE_SIN_SKILL_COOLDOWN_MS,
  },
} as const satisfies CharacterDefinition);
export const CHAMPION_DEFINITION = LEE_SIN_DEFINITION;
