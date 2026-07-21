import type { CharacterDefinition } from "../contracts";
import { CHAMPION_MEMBERSHIP } from "../membership";
import { deepFreeze } from "../deep-freeze.ts";
import portraitUrl from "./assets/portrait.png?url";
export const CROCODILO_CHARACTER_ID = CHAMPION_MEMBERSHIP["crocodilo-arcano"].characterId,
  CROCODILO_SKILL_ID = CHAMPION_MEMBERSHIP["crocodilo-arcano"].skillId,
  CROCODILO_SKILL_COOLDOWN_MS = 6000;
export const CROCODILO_DEFINITION = deepFreeze({
  id: CROCODILO_CHARACTER_ID,
  name: "Crocodilo Arcano",
  roster: { order: 2 },
  presentation: {
    portraitPath: portraitUrl,
    accent: "green",
    localized: {
      "pt-BR": {
        label: "Controle de área",
        description:
          "Guardião tóxico da região central. Bloqueia rotas, força passos ruins e vence pela pressão espacial.",
        skillName: "Emerald Surge",
        skillSummary:
          "Canaliza uma onda que incendeia com toxina até duas casas em cada direção e concede imunidade durante a canalização.",
        analysis:
          "Forte em mapas densos e duelos de corredor; combine a onda com bombas para fechar as saídas.",
      },
      en: {
        label: "Area control",
        description:
          "Toxic mid guardian. He blocks routes, forces bad footsteps, and wins through space denial.",
        skillName: "Emerald Surge",
        skillSummary:
          "Channels a surge that paints toxic tiles and grants a short immunity window while the skill is live.",
        analysis:
          "Strong on dense maps and corridor duels; pair the surge with bombs to seal exits.",
      },
    },
  },
  skill: { id: CROCODILO_SKILL_ID, cooldownMs: CROCODILO_SKILL_COOLDOWN_MS },
} as const satisfies CharacterDefinition);
export const CHAMPION_DEFINITION = CROCODILO_DEFINITION;
