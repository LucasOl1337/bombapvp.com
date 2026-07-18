import type {
  CharacterDefinition,
  CharacterLocale,
  CharacterPresentation,
  CharacterRosterEntry,
  CharacterSkillDefinition,
} from "./contracts";
import {
  CHAMPION_MEMBERSHIP,
  getChampionSlugFromModulePath,
  listChampionMembership,
  type ChampionSlug,
} from "./membership";

type ChampionDefinitionModule = Readonly<{
  CHAMPION_DEFINITION: CharacterDefinition;
}>;

const definitionModules = import.meta.glob<ChampionDefinitionModule>(
  "./*/definition.ts",
  { eager: true },
);
const definitionsBySlug = new Map<ChampionSlug, CharacterDefinition>();

for (const [modulePath, module] of Object.entries(definitionModules)) {
  const championSlug = getChampionSlugFromModulePath(modulePath, "definition");
  if (!championSlug) continue;
  const identity = CHAMPION_MEMBERSHIP[championSlug];
  const definition = module.CHAMPION_DEFINITION;
  if (
    definition.id !== identity.characterId ||
    definition.skill.id !== identity.skillId
  ) {
    throw new Error(
      `Champion definition does not match membership: ${championSlug}`,
    );
  }
  definitionsBySlug.set(championSlug, definition);
}

const DEFINITIONS = Object.freeze(
  listChampionMembership().map(({ slug }) => {
    const definition = definitionsBySlug.get(slug);
    if (!definition) throw new Error(`Missing Champion definition: ${slug}`);
    return definition;
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
