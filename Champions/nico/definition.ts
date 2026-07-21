import type { CharacterDefinition } from "../contracts";
import { CHAMPION_MEMBERSHIP } from "../membership";
import { deepFreeze } from "../deep-freeze.ts";
import portraitUrl from "./assets/portrait.png?url";
export const NICO_CHARACTER_ID = CHAMPION_MEMBERSHIP.nico.characterId,
  NICO_SKILL_ID = CHAMPION_MEMBERSHIP.nico.skillId,
  NICO_SKILL_COOLDOWN_MS = 8000;
export const NICO_DEFINITION = deepFreeze({
  id: NICO_CHARACTER_ID,
  name: "Nico",
  roster: { order: 3 },
  presentation: {
    portraitPath: portraitUrl,
    accent: "red",
    localized: {
      "pt-BR": {
        label: "Zona de fogo",
        description:
          "Maga de feixe que corta corredores. Joga de longe: mira a linha, canaliza e pune quem fica preso na rota.",
        skillName: "Arcane Beam",
        skillSummary:
          "Canaliza um feixe arcano na direção mirada. O disparo atravessa a rota até encontrar uma parede.",
        analysis:
          "Domina corredores longos, mas fica vulnerável durante a canalização; proteja os flancos antes de disparar.",
      },
      en: {
        label: "Lane pressure",
        description:
          "Beam mage who cuts corridors. She plays from range: aim the line, channel, punish whoever is stuck on the path.",
        skillName: "Arcane Beam",
        skillSummary:
          "Channels an arcane beam in the aimed direction. Tiles along the path take the beam effect while it lives.",
        analysis:
          "Dominant on long lanes and open mids. Weak if boxed during cast — clear your flank before you fire.",
      },
    },
  },
  skill: { id: NICO_SKILL_ID, cooldownMs: NICO_SKILL_COOLDOWN_MS },
} as const satisfies CharacterDefinition);
export const CHAMPION_DEFINITION = NICO_DEFINITION;
