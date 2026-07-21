export const CHAMPION_MEMBERSHIP = Object.freeze({
  ranni: Object.freeze({
    characterId: "03a976fb-7313-4064-a477-5bb9b0760034",
    skillId: "ranni-ice-blink",
    name: "Ranni",
    rosterOrder: 0,
    defaultSlot: 1,
    skillCooldownMs: 8_000,
  }),
  "killer-bee": Object.freeze({
    characterId: "6ee8baa5-3277-413b-ae0e-2659b9cc52e9",
    skillId: "killer-bee-wing-dash",
    name: "Killer Bee",
    rosterOrder: 1,
    defaultSlot: 2,
    skillCooldownMs: 4_000,
  }),
  "crocodilo-arcano": Object.freeze({
    characterId: "d083c3dc-7162-4391-8628-6adde0b8d8d6",
    skillId: "crocodilo-emerald-surge",
    name: "Crocodilo Arcano",
    rosterOrder: 2,
    defaultSlot: undefined,
    skillCooldownMs: 6_000,
  }),
  nico: Object.freeze({
    characterId: "5474c45c-2987-43e0-af2c-a6500c836881",
    skillId: "nico-arcane-beam",
    name: "Nico",
    rosterOrder: 3,
    defaultSlot: undefined,
    skillCooldownMs: 8_000,
  }),
  "nix-ember": Object.freeze({
    characterId: "9f3e2c1a-8b7d-4e6f-a0c1-2d3e4f5a6b7c",
    skillId: "nix-ember-vault",
    name: "Nix Ember",
    rosterOrder: 4,
    defaultSlot: undefined,
    skillCooldownMs: 7_000,
  }),
  pendula: Object.freeze({
    characterId: "c4a8e2f1-9b3d-4c7a-8e5f-1a2b3c4d5e6f",
    skillId: "pendula-command-shockwave",
    name: "Pendula",
    rosterOrder: 5,
    defaultSlot: undefined,
    skillCooldownMs: 7_500,
  }),
  mirelle: Object.freeze({
    characterId: "a1b2c3d4-e5f6-4789-a012-3456789abc01",
    skillId: "mirelle-tide-swap",
    name: "Mirelle",
    rosterOrder: 6,
    defaultSlot: undefined,
    skillCooldownMs: 8_000,
  }),
  "lee-sin": Object.freeze({
    characterId: "b7e4c2a1-5d6f-4a8b-9c0d-1e2f3a4b5c6d",
    skillId: "lee-sin-dragon-rage",
    name: "Lee Sin",
    rosterOrder: 7,
    defaultSlot: undefined,
    skillCooldownMs: 6_500,
  }),
  thresh: Object.freeze({
    characterId: "e7a1c4d2-9f3b-4c5e-a8d1-2b6f8e0c4a7d",
    skillId: "thresh-death-sentence",
    name: "Thresh",
    rosterOrder: 8,
    defaultSlot: undefined,
    skillCooldownMs: 8_000,
  }),
  katarina: Object.freeze({
    characterId: "f2b8d4e6-1a3c-4b5d-9e7f-8c6a5b4d3e2f",
    skillId: "katarina-bouncing-blade",
    name: "Katarina",
    rosterOrder: 9,
    defaultSlot: undefined,
    skillCooldownMs: 8_000,
  }),
  madara: Object.freeze({
    characterId: "c155b0d5-644c-4b43-8d02-890e76574eff",
    skillId: "madara-fireball-jutsu",
    name: "Madara",
    rosterOrder: 10,
    defaultSlot: undefined,
    skillCooldownMs: 8_000,
  }),
} as const);

export type ChampionSlug = keyof typeof CHAMPION_MEMBERSHIP;
export type CharacterId =
  (typeof CHAMPION_MEMBERSHIP)[ChampionSlug]["characterId"];
export type CharacterSkillId =
  (typeof CHAMPION_MEMBERSHIP)[ChampionSlug]["skillId"];
export type ChampionMembershipEntry = Readonly<{
  slug: ChampionSlug;
  characterId: CharacterId;
  skillId: CharacterSkillId;
  name: string;
  rosterOrder: number;
  defaultSlot?: 1 | 2 | 3 | 4;
  skillCooldownMs: number;
}>;

const MEMBERSHIP_ENTRIES = Object.freeze(
  Object.entries(CHAMPION_MEMBERSHIP).map(([slug, identity]) =>
    Object.freeze({
      slug: slug as ChampionSlug,
      characterId: identity.characterId,
      skillId: identity.skillId,
      name: identity.name,
      rosterOrder: identity.rosterOrder,
      ...(identity.defaultSlot === undefined ? {} : { defaultSlot: identity.defaultSlot }),
      skillCooldownMs: identity.skillCooldownMs,
    }),
  ),
) as readonly ChampionMembershipEntry[];

export function listChampionMembership(): readonly ChampionMembershipEntry[] {
  return MEMBERSHIP_ENTRIES;
}

/** Resolve the owning Champion folder for one discovered projection module. */
export function getChampionSlugFromModulePath(
  modulePath: string,
  moduleName: "definition" | "skill" | "visuals" | "assets",
): ChampionSlug | null {
  const match = new RegExp(`^\\./([^/]+)/${moduleName}\\.ts$`).exec(modulePath);
  const slug = match?.[1];
  return slug && slug in CHAMPION_MEMBERSHIP ? (slug as ChampionSlug) : null;
}
