export type CharacterLocale = "pt-BR" | "en";
export type CharacterDefaultSlot = 1 | 2 | 3 | 4;
export type CharacterSkillId =
  | "ranni-ice-blink"
  | "killer-bee-wing-dash"
  | "crocodilo-emerald-surge"
  | "nico-arcane-beam"
  | "nix-ember-vault";
export type CharacterId =
  | "03a976fb-7313-4064-a477-5bb9b0760034"
  | "6ee8baa5-3277-413b-ae0e-2659b9cc52e9"
  | "d083c3dc-7162-4391-8628-6adde0b8d8d6"
  | "5474c45c-2987-43e0-af2c-a6500c836881"
  | "9f3e2c1a-8b7d-4e6f-a0c1-2d3e4f5a6b7c";
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
