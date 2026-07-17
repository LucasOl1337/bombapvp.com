import { deepFreeze } from "../shared/deep-freeze";

export type CharacterLocale = "pt-BR" | "en";

export type CharacterDefaultSlot = 1 | 2 | 3 | 4;

export type CharacterDefinition = Readonly<{
  id: string;
  name: string;
  roster: Readonly<{
    order: number;
    defaultSlot?: CharacterDefaultSlot;
  }>;
  presentation: Readonly<{
    portraitPath: string;
    accent: "blue" | "gold" | "green" | "red";
    localized: Readonly<Record<CharacterLocale, Readonly<{
      label: string;
      description: string;
    }>>>;
  }>;
  skill: Readonly<{
    id: "ranni-ice-blink" | "killer-bee-wing-dash" | "crocodilo-emerald-surge" | "nico-arcane-beam";
    cooldownMs: number;
  }>;
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
  skillId: CharacterDefinition["skill"]["id"];
  cooldownMs: number;
}>;

export const RANNI_CHARACTER_ID = "03a976fb-7313-4064-a477-5bb9b0760034";
export const KILLER_BEE_CHARACTER_ID = "6ee8baa5-3277-413b-ae0e-2659b9cc52e9";
export const CROCODILO_CHARACTER_ID = "d083c3dc-7162-4391-8628-6adde0b8d8d6";
export const NICO_CHARACTER_ID = "5474c45c-2987-43e0-af2c-a6500c836881";

const CHARACTER_DEFINITIONS_BY_ID = deepFreeze({
  [RANNI_CHARACTER_ID]: {
    id: RANNI_CHARACTER_ID,
    name: "Ranni",
    roster: {
      order: 0,
      defaultSlot: 1,
    },
    presentation: {
      portraitPath: "/characters/ranni.png",
      accent: "blue",
      localized: {
        "pt-BR": {
          label: "Personagem 1",
          description: "Combatente 01 · personagem canônico",
        },
        en: {
          label: "Character 1",
          description: "Fighter 01 · canonical character",
        },
      },
    },
    skill: {
      id: "ranni-ice-blink",
      cooldownMs: 8_000,
    },
  },
  [KILLER_BEE_CHARACTER_ID]: {
    id: KILLER_BEE_CHARACTER_ID,
    name: "Killer Bee",
    roster: {
      order: 1,
      defaultSlot: 2,
    },
    presentation: {
      portraitPath: "/characters/killer-bee.png",
      accent: "gold",
      localized: {
        "pt-BR": {
          label: "Personagem 2",
          description: "Combatente 02 · personagem canônico",
        },
        en: {
          label: "Character 2",
          description: "Fighter 02 · canonical character",
        },
      },
    },
    skill: {
      id: "killer-bee-wing-dash",
      cooldownMs: 4_000,
    },
  },
  [CROCODILO_CHARACTER_ID]: {
    id: CROCODILO_CHARACTER_ID,
    name: "Crocodilo Arcano",
    roster: {
      order: 2,
    },
    presentation: {
      portraitPath: "/characters/crocodilo-arcano.png",
      accent: "green",
      localized: {
        "pt-BR": {
          label: "Personagem 3",
          description: "Combatente 03 · personagem canônico",
        },
        en: {
          label: "Character 3",
          description: "Fighter 03 · canonical character",
        },
      },
    },
    skill: {
      id: "crocodilo-emerald-surge",
      cooldownMs: 6_000,
    },
  },
  [NICO_CHARACTER_ID]: {
    id: NICO_CHARACTER_ID,
    name: "Nico",
    roster: {
      order: 3,
    },
    presentation: {
      portraitPath: "/characters/nico.png",
      accent: "red",
      localized: {
        "pt-BR": {
          label: "Personagem 4",
          description: "Combatente 04 · personagem canônico",
        },
        en: {
          label: "Character 4",
          description: "Fighter 04 · canonical character",
        },
      },
    },
    skill: {
      id: "nico-arcane-beam",
      cooldownMs: 8_000,
    },
  },
} as const satisfies Readonly<Record<string, CharacterDefinition>>);

export type CharacterId = keyof typeof CHARACTER_DEFINITIONS_BY_ID;

const ORDERED_CHARACTER_DEFINITIONS = Object.freeze(
  Object.values(CHARACTER_DEFINITIONS_BY_ID).sort((left, right) => left.roster.order - right.roster.order),
);

function createCharacterPresentations(locale: CharacterLocale): readonly CharacterPresentation[] {
  return Object.freeze(ORDERED_CHARACTER_DEFINITIONS.map((character) => {
    const localized = character.presentation.localized[locale];
    return Object.freeze({
      id: character.id,
      name: character.name,
      assetPath: character.presentation.portraitPath,
      accent: character.presentation.accent,
      label: localized.label,
      description: localized.description,
    });
  }));
}

const CHARACTER_PRESENTATIONS_BY_LOCALE = Object.freeze({
  "pt-BR": createCharacterPresentations("pt-BR"),
  en: createCharacterPresentations("en"),
});

const CHARACTER_ROSTER_ENTRIES: readonly CharacterRosterEntry[] = Object.freeze(
  ORDERED_CHARACTER_DEFINITIONS.map((character) => Object.freeze({
    id: character.id,
    name: character.name,
    order: character.roster.order,
    ...(!("defaultSlot" in character.roster)
      ? {}
      : { defaultSlot: character.roster.defaultSlot }),
  })),
);

const CHARACTER_SKILL_DEFINITIONS: readonly CharacterSkillDefinition[] = Object.freeze(
  ORDERED_CHARACTER_DEFINITIONS.map((character) => Object.freeze({
    characterId: character.id,
    skillId: character.skill.id,
    cooldownMs: character.skill.cooldownMs,
  })),
);

export function getCharacterDefinition(characterId: string): CharacterDefinition | null {
  return CHARACTER_DEFINITIONS_BY_ID[characterId as keyof typeof CHARACTER_DEFINITIONS_BY_ID] ?? null;
}

export function listCharacterDefinitions(): readonly CharacterDefinition[] {
  return ORDERED_CHARACTER_DEFINITIONS;
}

export function listCharacterPresentations(locale: CharacterLocale): readonly CharacterPresentation[] {
  return CHARACTER_PRESENTATIONS_BY_LOCALE[locale];
}

export function listCharacterRosterEntries(): readonly CharacterRosterEntry[] {
  return CHARACTER_ROSTER_ENTRIES;
}

export function listCharacterSkillDefinitions(): readonly CharacterSkillDefinition[] {
  return CHARACTER_SKILL_DEFINITIONS;
}
