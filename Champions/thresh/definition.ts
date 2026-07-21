import type { CharacterDefinition } from "../contracts";
import { CHAMPION_MEMBERSHIP } from "../membership";
import { deepFreeze } from "../deep-freeze.ts";
import portraitUrl from "./assets/portrait.png?url";

export const THRESH_CHARACTER_ID = CHAMPION_MEMBERSHIP["thresh"].characterId;
export const THRESH_SKILL_ID = CHAMPION_MEMBERSHIP["thresh"].skillId;
export const THRESH_SKILL_COOLDOWN_MS = 8_000;

export const THRESH_DEFINITION = deepFreeze({
  id: THRESH_CHARACTER_ID,
  name: "Thresh",
  roster: { order: 3 },
  presentation: {
    portraitPath: portraitUrl,
    accent: "green",
    localized: {
      "pt-BR": {
        label: "Controle de gancho",
        description:
          "Carcereiro espectral. Pesca rivais com a corrente e arrasta para a zona de perigo das bombas.",
        skillName: "Sentença de Morte",
        skillSummary:
          "Arremessa o gancho em linha reta (até 4 tiles). O primeiro inimigo atingido é puxado até perto do Thresh. Paredes bloqueiam o gancho.",
        analysis:
          "Mire na linha do rival que foge da bomba. Errou o gancho, metade do cooldown volta de graça.",
      },
      en: {
        label: "Hook control",
        description:
          "Spectral chain warden. He fishes rivals with his hook and drags them into the bomb danger zone.",
        skillName: "Death Sentence",
        skillSummary:
          "Throws the hook in a straight line (up to 4 tiles). The first enemy hit is pulled next to Thresh. Walls block the hook.",
        analysis:
          "Aim down the lane of a rival fleeing a bomb. A missed hook refunds half the cooldown.",
      },
    },
  },
  skill: {
    id: THRESH_SKILL_ID,
    cooldownMs: THRESH_SKILL_COOLDOWN_MS,
  },
} as const satisfies CharacterDefinition);
export const CHAMPION_DEFINITION = THRESH_DEFINITION;
