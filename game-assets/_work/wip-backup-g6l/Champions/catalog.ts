import type {
  CharacterDefinition,
  CharacterLocale,
  CharacterPresentation,
  CharacterRosterEntry,
  CharacterSkillDefinition,
} from "./contracts";
import { listChampionMembership, type ChampionSlug } from "./membership";
import { CHAMPION_DEFINITION as RANNI } from "./ranni/definition";
import { CHAMPION_DEFINITION as BEE } from "./killer-bee/definition";
import { CHAMPION_DEFINITION as CROCODILO } from "./crocodilo-arcano/definition";
import { CHAMPION_DEFINITION as NICO } from "./nico/definition";
import { CHAMPION_DEFINITION as NIX } from "./nix-ember/definition";
import { CHAMPION_DEFINITION as PENDULA } from "./pendula/definition";
import { CHAMPION_DEFINITION as MIRELLE } from "./mirelle/definition";

const definitionsBySlug: Readonly<Record<ChampionSlug, CharacterDefinition>> = {
  ranni: RANNI, "killer-bee": BEE, "crocodilo-arcano": CROCODILO, nico: NICO,
  "nix-ember": NIX, pendula: PENDULA, mirelle: MIRELLE,
};

const DEFINITIONS = Object.freeze(
  listChampionMembership().map(({ slug }) => {
    return definitionsBySlug[slug];
  }).sort((a, b) => a.roster.order - b.roster.order),
);
const BY_ID = new Map<string, CharacterDefinition>(
  DEFINITIONS.map((d) => [d.id, d]),
);
export function getCharacterDefinition(id: string): CharacterDefinition | null {
  return BY_ID.get(id) ?? null;
}
export function listCharacterDefinitions(): readonly CharacterDefinition[] {
  return DEFINITIONS;
}
export function listCharacterPresentations(
  locale: CharacterLocale,
): readonly CharacterPresentation[] {
  return Object.freeze(
    DEFINITIONS.map((c) =>
      Object.freeze({
        id: c.id,
        name: c.name,
        assetPath: c.presentation.portraitPath,
        accent: c.presentation.accent,
        skillCooldownMs: c.skill.cooldownMs,
        ...c.presentation.localized[locale],
      }),
    ),
  );
}
export function listCharacterRosterEntries(): readonly CharacterRosterEntry[] {
  return Object.freeze(
    DEFINITIONS.map((c) =>
      Object.freeze({
        id: c.id,
        name: c.name,
        order: c.roster.order,
        ...("defaultSlot" in c.roster
          ? { defaultSlot: c.roster.defaultSlot }
          : {}),
      }),
    ),
  );
}
export function listCharacterSkillDefinitions(): readonly CharacterSkillDefinition[] {
  return Object.freeze(
    DEFINITIONS.map((c) =>
      Object.freeze({
        characterId: c.id,
        skillId: c.skill.id,
        cooldownMs: c.skill.cooldownMs,
      }),
    ),
  );
}
export function getCharacterSkillDefinition(
  id: string,
): CharacterSkillDefinition | null {
  const c = getCharacterDefinition(id);
  return c
    ? { characterId: c.id, skillId: c.skill.id, cooldownMs: c.skill.cooldownMs }
    : null;
}
export function getCharacterSkillId(id: string) {
  return getCharacterDefinition(id)?.skill.id ?? null;
}
