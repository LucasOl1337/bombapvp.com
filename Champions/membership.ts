export const CHAMPION_MEMBERSHIP = Object.freeze({
  ranni: Object.freeze({
    characterId: "03a976fb-7313-4064-a477-5bb9b0760034",
    skillId: "ranni-ice-blink",
  }),
  "killer-bee": Object.freeze({
    characterId: "6ee8baa5-3277-413b-ae0e-2659b9cc52e9",
    skillId: "killer-bee-wing-dash",
  }),
  "crocodilo-arcano": Object.freeze({
    characterId: "d083c3dc-7162-4391-8628-6adde0b8d8d6",
    skillId: "crocodilo-emerald-surge",
  }),
  nico: Object.freeze({
    characterId: "5474c45c-2987-43e0-af2c-a6500c836881",
    skillId: "nico-arcane-beam",
  }),
  "nix-ember": Object.freeze({
    characterId: "9f3e2c1a-8b7d-4e6f-a0c1-2d3e4f5a6b7c",
    skillId: "nix-ember-vault",
  }),
  pendula: Object.freeze({
    characterId: "c4a8e2f1-9b3d-4c7a-8e5f-1a2b3c4d5e6f",
    skillId: "pendula-command-shockwave",
  }),
  mirelle: Object.freeze({
    characterId: "a1b2c3d4-e5f6-4789-a012-3456789abc01",
    skillId: "mirelle-tide-swap",
  }),
  bram: Object.freeze({
    characterId: "b2c3d4e5-f6a7-4890-b123-456789abcde2",
    skillId: "bram-seismic-crack",
  }),
  zephyr: Object.freeze({
    characterId: "c3d4e5f6-a7b8-4901-c234-56789abcdef3",
    skillId: "zephyr-gale-scatter",
  }),
  hexa: Object.freeze({
    characterId: "d4e5f6a7-b8c9-4012-d345-6789abcdef01",
    skillId: "hexa-fuse-hex",
  }),
  aegis: Object.freeze({
    characterId: "e5f6a7b8-c9d0-4123-e456-789abcdef012",
    skillId: "aegis-bastion-pulse",
  }),
  lumen: Object.freeze({
    characterId: "f6a7b8c9-d0e1-4234-f567-89abcdef0123",
    skillId: "lumen-flash-step",
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
}>;

const MEMBERSHIP_ENTRIES = Object.freeze(
  Object.entries(CHAMPION_MEMBERSHIP).map(([slug, identity]) =>
    Object.freeze({
      slug: slug as ChampionSlug,
      characterId: identity.characterId,
      skillId: identity.skillId,
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
