import type {
  CharacterId as MembershipCharacterId,
  CharacterSkillId as MembershipCharacterSkillId,
} from "./membership";

export type CharacterLocale = "pt-BR" | "en";
export type CharacterDefaultSlot = 1 | 2 | 3 | 4;
export type CharacterSkillId = MembershipCharacterSkillId;
export type CharacterId = MembershipCharacterId;
export type CharacterLocalizedCopy = Readonly<{
  /** Short role tag shown above the name (e.g. "Controle espacial"). */
  label: string;
  /** Playstyle / how the fighter works. */
  description: string;
  /** Display name of the ultimate. */
  skillName: string;
  /** How the ultimate works in plain language. */
  skillSummary: string;
  /** One-line tactical read. */
  analysis: string;
}>;

export type CharacterDefinition = Readonly<{
  id: CharacterId;
  name: string;
  roster: Readonly<{ order: number; defaultSlot?: CharacterDefaultSlot }>;
  presentation: Readonly<{
    portraitPath: string;
    accent: "blue" | "gold" | "green" | "red" | "orange";
    localized: Readonly<Record<CharacterLocale, CharacterLocalizedCopy>>;
  }>;
  skill: Readonly<{ id: CharacterSkillId; cooldownMs: number }>;
}>;
export type CharacterPresentation = Readonly<{
  id: CharacterId;
  name: string;
  assetPath: string;
  accent: CharacterDefinition["presentation"]["accent"];
  label: string;
  description: string;
  skillName: string;
  skillSummary: string;
  analysis: string;
  skillCooldownMs: number;
}>;
export type CharacterRosterEntry = Readonly<{
  id: CharacterId;
  name: string;
  defaultSlot?: CharacterDefaultSlot;
  order: number;
}>;
export type CharacterSkillDefinition = Readonly<{
  characterId: CharacterId;
  skillId: CharacterSkillId;
  cooldownMs: number;
}>;
