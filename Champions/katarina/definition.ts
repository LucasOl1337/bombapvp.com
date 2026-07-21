import type { CharacterDefinition } from "../contracts";
import { CHAMPION_MEMBERSHIP } from "../membership";
import { deepFreeze } from "../../src/shared/deep-freeze";
import portraitUrl from "./assets/portrait.png?url";

export const KATARINA_CHARACTER_ID = CHAMPION_MEMBERSHIP["katarina"].characterId;
export const KATARINA_SKILL_ID = CHAMPION_MEMBERSHIP["katarina"].skillId;
export const KATARINA_SKILL_COOLDOWN_MS = 8_000;

export const KATARINA_DEFINITION = deepFreeze({
  id: KATARINA_CHARACTER_ID,
  name: "Katarina",
  roster: { order: 9 },
  presentation: {
    portraitPath: portraitUrl,
    accent: "red",
    localized: {
      "pt-BR": {
        label: "Assassina de adagas",
        description:
          "A Lâmina Sinistra. Planta a adaga no chão e pisca até ela para executar quem estiver por perto.",
        skillName: "Bouncing Blade",
        skillSummary:
          "Arremessa a adaga em linha reta: ela crava no último tile livre antes do obstáculo (até 5s). Reconjurar pisca Katarina até a adaga com um corte letal ao redor.",
        analysis:
          "Jogue a adaga além da bomba e pisque para escapar — ou crave perto do rival e execute. Adaga expirada devolve metade do cooldown.",
      },
      en: {
        label: "Dagger assassin",
        description:
          "The Sinister Blade. She plants a dagger on the ground and blinks to it to execute anyone nearby.",
        skillName: "Bouncing Blade",
        skillSummary:
          "Throws a dagger in a straight line: it sticks into the last free tile before an obstacle (up to 5s). Re-cast blinks Katarina to the dagger with a lethal slash around it.",
        analysis:
          "Throw the dagger past a bomb and blink out — or stick it next to a rival and execute. An expired dagger refunds half the cooldown.",
      },
    },
  },
  skill: {
    id: KATARINA_SKILL_ID,
    cooldownMs: KATARINA_SKILL_COOLDOWN_MS,
  },
} as const satisfies CharacterDefinition);
export const CHAMPION_DEFINITION = KATARINA_DEFINITION;
