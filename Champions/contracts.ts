import type {
  CharacterId as MembershipCharacterId,
  CharacterSkillId as MembershipCharacterSkillId,
} from "./membership";

export type CharacterLocale = "pt-BR" | "en";
export type CharacterDefaultSlot = 1 | 2 | 3 | 4;
export type CharacterSkillId = MembershipCharacterSkillId;
export type CharacterId = MembershipCharacterId;
export type CharacterDefinition = Readonly<{
  id: CharacterId;
  name: string;
  roster: Readonly<{ order: number; defaultSlot?: CharacterDefaultSlot }>;
  presentation: Readonly<{
    portraitPath: string;
    accent: "blue" | "gold" | "green" | "red";
    localized: Readonly<
      Record<CharacterLocale, Readonly<{ label: string; description: string }>>
    >;
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
