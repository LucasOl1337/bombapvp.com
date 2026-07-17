import type { CharacterSkillId } from "../Gameplay/types";
import {
  CROCODILO_CHARACTER_ID as CROCODILO_CHARACTER_CATALOG_ID,
  KILLER_BEE_CHARACTER_ID as KILLER_BEE_CHARACTER_CATALOG_ID,
  NICO_CHARACTER_ID as NICO_CHARACTER_CATALOG_ID,
  RANNI_CHARACTER_ID as RANNI_CHARACTER_CATALOG_ID,
  getCharacterDefinition,
  listCharacterSkillDefinitions,
} from "../../characters/catalog";

export interface CharacterSkillDefinition {
  characterId: string;
  skillId: CharacterSkillId;
  cooldownMs: number;
}

export const RANNI_CHARACTER_ID = RANNI_CHARACTER_CATALOG_ID;
export const KILLER_BEE_CHARACTER_ID = KILLER_BEE_CHARACTER_CATALOG_ID;
export const NICO_CHARACTER_ID = NICO_CHARACTER_CATALOG_ID;
export const CROCODILO_CHARACTER_ID = CROCODILO_CHARACTER_CATALOG_ID;

function getCooldownMs(characterId: string): number {
  const character = getCharacterDefinition(characterId);
  if (!character) {
    throw new Error(`Missing canonical character definition: ${characterId}`);
  }
  return character.skill.cooldownMs;
}

export const RANNI_SKILL_COOLDOWN_MS = getCooldownMs(RANNI_CHARACTER_ID);
export const KILLER_BEE_SKILL_COOLDOWN_MS = getCooldownMs(KILLER_BEE_CHARACTER_ID);
export const NICO_SKILL_COOLDOWN_MS = getCooldownMs(NICO_CHARACTER_ID);
export const CROCODILO_SKILL_COOLDOWN_MS = getCooldownMs(CROCODILO_CHARACTER_ID);

export const CHARACTER_SKILL_DEFINITIONS: readonly CharacterSkillDefinition[] = Object.freeze(
  listCharacterSkillDefinitions().map((definition) => Object.freeze({ ...definition })),
);

const SKILL_DEFINITION_BY_CHARACTER_ID = new Map(
  CHARACTER_SKILL_DEFINITIONS.map((definition) => [definition.characterId, definition]),
);

export function getCharacterSkillDefinition(characterId: string): CharacterSkillDefinition | null {
  return SKILL_DEFINITION_BY_CHARACTER_ID.get(characterId) ?? null;
}

export function getCharacterSkillId(characterId: string): CharacterSkillId | null {
  return getCharacterSkillDefinition(characterId)?.skillId ?? null;
}
