import type { CharacterDefinition } from "../contracts";
import { CHAMPION_MEMBERSHIP } from "../membership";
import { deepFreeze } from "../deep-freeze.ts";
import portraitUrl from "./assets/portrait.png?url";

export const MIRELLE_CHARACTER_ID = CHAMPION_MEMBERSHIP["mirelle"].characterId;
export const MIRELLE_SKILL_ID = CHAMPION_MEMBERSHIP["mirelle"].skillId;
export const MIRELLE_SKILL_COOLDOWN_MS = 8000;

export const MIRELLE_DEFINITION = deepFreeze({
  id: MIRELLE_CHARACTER_ID,
  name: "Mirelle",
  roster: { order: 6 },
  presentation: {
    portraitPath: portraitUrl,
    accent: "blue",
    localized: {
      "pt-BR": {
        label: "Troca tática",
        description:
          "Sereia das marés. Vira a mesa trocando de lugar com um rival ou reposicionando uma bomba.",
        skillName: "Tide Exchange",
        skillSummary:
          "Troca de posição com o adversário mais próximo ou, se não houver um alvo, com uma bomba no alcance.",
        analysis:
          "Exige leitura do alvo mais próximo: uma boa troca escapa do cerco, enquanto uma escolha ruim leva você ao perigo.",
      },
      en: {
        label: "Tactical swap",
        description:
          "Tide siren. She flips the board by trading places with an opponent or repositioning a bomb.",
        skillName: "Tide Exchange",
        skillSummary:
          "Swaps with the nearest opponent or, when no opponent is in range, with a nearby bomb.",
        analysis:
          "Target reading matters: a good exchange escapes a trap, while a poor choice places her in danger.",
      },
    },
  },
  skill: {
    id: MIRELLE_SKILL_ID,
    cooldownMs: MIRELLE_SKILL_COOLDOWN_MS,
  },
} as const satisfies CharacterDefinition);
export const CHAMPION_DEFINITION = MIRELLE_DEFINITION;
