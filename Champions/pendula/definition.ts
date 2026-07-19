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
        label: "Controle de posição",
        description:
          "Autômata de relojoaria. Reorganiza o combate puxando adversários para perto e desmontando posições seguras.",
        skillName: "Command: Pull",
        skillSummary:
          "Após uma breve canalização, puxa adversários em um raio de quatro casas para posições livres próximas.",
        analysis:
          "Quebra formações e aproxima alvos das bombas; adversários já adjacentes não são movidos.",
      },
      en: {
        label: "Position control",
        description:
          "Clockwork ballerina. She reshapes fights by pulling opponents close and dismantling safe positions.",
        skillName: "Command: Pull",
        skillSummary:
          "After a short channel, pulls opponents within four tiles toward nearby open positions.",
        analysis:
          "Breaks formations and draws targets toward bombs; already adjacent opponents are not moved.",
      },
    },
  },
  skill: {
    id: PENDULA_SKILL_ID,
    cooldownMs: PENDULA_SKILL_COOLDOWN_MS,
  },
} as const satisfies CharacterDefinition);
export const CHAMPION_DEFINITION = PENDULA_DEFINITION;
