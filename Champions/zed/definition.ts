import type { CharacterDefinition } from "../contracts";
import { CHAMPION_MEMBERSHIP } from "../membership";
import { deepFreeze } from "../deep-freeze.ts";
import portraitUrl from "./assets/portrait.png?url";

export const ZED_CHARACTER_ID = CHAMPION_MEMBERSHIP.zed.characterId;
export const ZED_SKILL_ID = CHAMPION_MEMBERSHIP.zed.skillId;
export const ZED_SKILL_COOLDOWN_MS = CHAMPION_MEMBERSHIP.zed.skillCooldownMs;

export const ZED_DEFINITION = deepFreeze({
  id: ZED_CHARACTER_ID,
  name: "Zed",
  roster: { order: 4 },
  presentation: {
    portraitPath: portraitUrl,
    accent: "orange",
    localized: {
      "pt-BR": {
        label: "Assassino de sombra",
        description:
          "Ninja de lâminas gêmeas que joga com presença dupla. Planta a sombra, reposiciona o corpo e troca no momento certo.",
        skillName: "Living Shadow",
        skillSummary:
          "Coloca uma projeção fixa no tile cardinal livre mais distante (até 3). O corpo se move livremente por 2 s sem imunidade. Recaste para trocar se o destino for válido (7 s de recarga); falha ou tempo esgotado usam 4 s.",
        analysis:
          "Use a sombra para cruzar bombas ou forçar ângulos ruins no rival; morrer limpa a projeção e aplica a recarga de falha.",
      },
      en: {
        label: "Shadow assassin",
        description:
          "Twin-blade ninja who wins with dual presence. Plant the shadow, free-move the body, and swap at the right beat.",
        skillName: "Living Shadow",
        skillSummary:
          "Places a fixed projection on the furthest free cardinal tile (up to 3). Body free-moves for 2 s with no channel immunity. Recast to swap if the landing is valid (7 s CD); fail or timeout use 4 s.",
        analysis:
          "Use the shadow to cross bombs or force bad angles; dying clears the projection and starts the fail cooldown.",
      },
    },
  },
  skill: { id: ZED_SKILL_ID, cooldownMs: ZED_SKILL_COOLDOWN_MS },
} as const satisfies CharacterDefinition);

export const CHAMPION_DEFINITION = ZED_DEFINITION;
