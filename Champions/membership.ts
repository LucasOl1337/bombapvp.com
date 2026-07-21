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
  thresh: Object.freeze({
    characterId: "e7a1c4d2-9f3b-4c5e-a8d1-2b6f8e0c4a7d",
    skillId: "thresh-death-sentence",
    name: "Thresh",
    rosterOrder: 3,
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
