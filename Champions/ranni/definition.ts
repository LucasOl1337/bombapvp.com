import type { CharacterDefinition } from "../contracts";
import { CHAMPION_MEMBERSHIP } from "../membership";
import { deepFreeze } from "../deep-freeze.ts";
import portraitUrl from "./assets/portrait.png?url";
export const RANNI_CHARACTER_ID = CHAMPION_MEMBERSHIP.ranni.characterId,
  RANNI_SKILL_ID = CHAMPION_MEMBERSHIP.ranni.skillId,
  RANNI_SKILL_COOLDOWN_MS = 8000;
export const RANNI_DEFINITION = deepFreeze({
  id: RANNI_CHARACTER_ID,
  name: "Ranni",
  roster: { order: 0, defaultSlot: 1 },
  presentation: {
    portraitPath: portraitUrl,
    accent: "blue",
    localized: {
      "pt-BR": {
        label: "Controle espacial",
        description:
          "Feiticeira do gelo que joga com tempo e posição. Usa o mapa como arma: entra em cantos perigosos e sai quando o cerco fecha.",
        skillName: "Ice Blink",
        skillSummary:
          "Projeta o movimento por até 1,5 s e reaparece na posição segura escolhida. Fica imune enquanto canaliza.",
        analysis:
          "Use para escapar de cercos ou invadir uma rota protegida; ativar sem um destino seguro desperdiça a recarga.",
      },
      en: {
        label: "Space control",
        description:
          "Ice sorceress who wins with timing and position. She steps into tight spots and leaves the moment the net closes.",
        skillName: "Ice Blink",
        skillSummary:
          "Projects movement for up to 1.5 seconds, then reappears at the chosen safe position. She is immune while channeling.",
        analysis:
          "Use it to escape a trap or breach a guarded lane; casting without a safe destination wastes the cooldown.",
      },
    },
  },
  skill: { id: RANNI_SKILL_ID, cooldownMs: RANNI_SKILL_COOLDOWN_MS },
} as const satisfies CharacterDefinition);
export const CHAMPION_DEFINITION = RANNI_DEFINITION;
