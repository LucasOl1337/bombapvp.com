import type { CharacterDefinition } from "../contracts";
import { CHAMPION_MEMBERSHIP } from "../membership";
import { deepFreeze } from "../../src/shared/deep-freeze";
import portraitUrl from "./assets/portrait.png?url";
export const KILLER_BEE_CHARACTER_ID = CHAMPION_MEMBERSHIP["killer-bee"].characterId,
  KILLER_BEE_SKILL_ID = CHAMPION_MEMBERSHIP["killer-bee"].skillId,
  KILLER_BEE_SKILL_COOLDOWN_MS = 4000;
export const KILLER_BEE_DEFINITION = deepFreeze({
  id: KILLER_BEE_CHARACTER_ID,
  name: "Killer Bee",
  roster: { order: 1, defaultSlot: 2 },
  presentation: {
    portraitPath: portraitUrl,
    accent: "gold",
    localized: {
      "pt-BR": {
        label: "Assalto móvel",
        description:
          "Caçadora de ritmo alto. Pressiona rotas, coleta melhorias e foge antes da retaliação: vence pela velocidade.",
        skillName: "Wing Dash",
        skillSummary:
          "Avança rapidamente na direção atual enquanto o caminho estiver livre, cruzando corredores e escapando de ameaças.",
        analysis:
          "Recompensa agressão precisa, mas uma rota bloqueada ou sem saída transforma o avanço em armadilha.",
      },
      en: {
        label: "Mobile assault",
        description:
          "High-tempo hunter. She pressures lanes, steals power-ups, and leaves before the punish — speed over walls.",
        skillName: "Wing Dash",
        skillSummary:
          "Directional dash along open pathing. Crosses corridors, gaps, and fire if the line is clear.",
        analysis:
          "Rewards precise aggression, but a blocked route or dead end turns the dash into a trap.",
      },
    },
  },
  skill: { id: KILLER_BEE_SKILL_ID, cooldownMs: KILLER_BEE_SKILL_COOLDOWN_MS },
} as const satisfies CharacterDefinition);
export const CHAMPION_DEFINITION = KILLER_BEE_DEFINITION;
