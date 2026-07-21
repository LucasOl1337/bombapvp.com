import type { CharacterDefinition } from "../contracts";
import { CHAMPION_MEMBERSHIP } from "../membership";
import { deepFreeze } from "../deep-freeze.ts";
import portraitUrl from "./assets/portrait.png?url";

export const NIX_EMBER_CHARACTER_ID = CHAMPION_MEMBERSHIP["nix-ember"].characterId;
export const NIX_EMBER_SKILL_ID = CHAMPION_MEMBERSHIP["nix-ember"].skillId;
export const NIX_EMBER_SKILL_COOLDOWN_MS = 7_000;

export const NIX_EMBER_DEFINITION = deepFreeze({
  id: NIX_EMBER_CHARACTER_ID,
  name: "Nix Ember",
  roster: { order: 4 },
  presentation: {
    portraitPath: portraitUrl,
    accent: "red",
    localized: {
      "pt-BR": {
        label: "Sobrevivência",
        description:
          "Sabotador de brasas. Vive no limite do fogo: planta bombas, provoca e salta quando o mapa fecha.",
        skillName: "Ember Vault",
        skillSummary:
          "Salto de sobrevivência sobre uma bomba ou linha de chamas para alcançar uma posição segura do outro lado.",
        analysis:
          "É uma forte rota de fuga; guarde o salto para quando as saídas normais realmente desaparecerem.",
      },
      en: {
        label: "Survival",
        description:
          "Ember saboteur. Lives on the fire line: plant, bait, then hop the death row when the map shrinks.",
        skillName: "Ember Vault",
        skillSummary:
          "Survival hop over a bomb or flame line. Crosses the threat and lands on the far side still standing.",
        analysis:
          "A strong escape route; save the vault for when normal exits truly disappear.",
      },
    },
  },
  skill: {
    id: NIX_EMBER_SKILL_ID,
    cooldownMs: NIX_EMBER_SKILL_COOLDOWN_MS,
  },
} as const satisfies CharacterDefinition);
export const CHAMPION_DEFINITION = NIX_EMBER_DEFINITION;
