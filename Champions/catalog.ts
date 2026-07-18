import type {
  CharacterDefinition,
  CharacterLocale,
  CharacterPresentation,
  CharacterRosterEntry,
  CharacterSkillDefinition,
} from "./contracts";
import { RANNI_DEFINITION } from "./ranni/definition";
import { KILLER_BEE_DEFINITION } from "./killer-bee/definition";
import { CROCODILO_DEFINITION } from "./crocodilo-arcano/definition";
import { NICO_DEFINITION } from "./nico/definition";
import { NIX_EMBER_DEFINITION } from "./nix-ember/definition";
import { PENDULA_DEFINITION } from "./pendula/definition";
const DEFINITIONS = Object.freeze(
  [
    RANNI_DEFINITION,
    KILLER_BEE_DEFINITION,
    CROCODILO_DEFINITION,
    NICO_DEFINITION,
    NIX_EMBER_DEFINITION,
    PENDULA_DEFINITION,
  ].sort((a, b) => a.roster.order - b.roster.order),
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
