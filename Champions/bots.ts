import {
  CHAMPION_MEMBERSHIP,
  type ChampionSlug,
  type CharacterId,
  type CharacterSkillId,
} from "./membership.ts";

export const BOT_PROFILE_IDS = ["bomb", "pingo", "v1", "v2", "v3"] as const;
export type BotProfileId = (typeof BOT_PROFILE_IDS)[number];

export type BotProfile = Readonly<{
  id: BotProfileId;
  model: `bot-${BotProfileId}`;
  label: string;
  championSlug: ChampionSlug;
  characterId: CharacterId;
  skillId: CharacterSkillId;
  tuning: Readonly<{
    bombCooldownTicks: number;
    useSkillEveryTicks: number;
    pursueCrates: boolean;
  }>;
}>;

function profile(
  id: BotProfileId,
  label: string,
  championSlug: ChampionSlug,
  tuning: BotProfile["tuning"],
): BotProfile {
  const champion = CHAMPION_MEMBERSHIP[championSlug];
  return Object.freeze({
    id,
    model: `bot-${id}`,
    label,
    championSlug,
    characterId: champion.characterId,
    skillId: champion.skillId,
    tuning: Object.freeze({ ...tuning }),
  });
}

export const BOT_PROFILES: readonly BotProfile[] = Object.freeze([
  profile("bomb", "Bomb", "ranni", {
    bombCooldownTicks: 8,
    useSkillEveryTicks: 0,
    pursueCrates: true,
  }),
  profile("pingo", "Pingo", "ranni", {
    bombCooldownTicks: 18,
    useSkillEveryTicks: 160,
    pursueCrates: false,
  }),
  profile("v1", "V1", "killer-bee", {
    bombCooldownTicks: 12,
    useSkillEveryTicks: 140,
    pursueCrates: true,
  }),
  profile("v2", "V2", "killer-bee", {
    bombCooldownTicks: 6,
    useSkillEveryTicks: 100,
    pursueCrates: true,
  }),
  profile("v3", "V3", "ranni", {
    bombCooldownTicks: 10,
    useSkillEveryTicks: 80,
    pursueCrates: true,
  }),
]);

export const DEFAULT_TRAINING_BOT_ID: BotProfileId = "bomb";
export const DEFAULT_CONTINUOUS_BOT_ID: BotProfileId = "v1";

const BY_ID = new Map(BOT_PROFILES.map((entry) => [entry.id, entry]));
const BY_MODEL = new Map(BOT_PROFILES.map((entry) => [entry.model, entry]));

export function getBotProfile(id: string): BotProfile | null {
  return BY_ID.get(id as BotProfileId) ?? null;
}

export function getBotProfileByModel(model: string): BotProfile | null {
  return BY_MODEL.get(model as BotProfile["model"]) ?? null;
}

export function resolveBotProfile(
  id: string | null | undefined,
  fallback: BotProfileId = DEFAULT_TRAINING_BOT_ID,
): BotProfile {
  const normalized = id?.trim().toLowerCase();
  return (normalized ? getBotProfile(normalized) : null) ?? BY_ID.get(fallback)!;
}
