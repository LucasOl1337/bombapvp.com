import {
  CHAMPION_MEMBERSHIP,
  type ChampionSlug,
} from "../../../Champions/membership.ts";
import {
  DEFAULT_TRAINING_BOT_ID,
  resolveBotProfile,
  type BotProfile,
  type BotProfileId,
} from "../bots/index.ts";
import { DEFAULT_SEED } from "../match-config.ts";

export const BROWSER_GAME_MODES = ["local-duel", "bot-training", "bot-lab"] as const;
export type BrowserGameMode = (typeof BROWSER_GAME_MODES)[number];

export const DEFAULT_P1_SLUG: ChampionSlug = "ranni";
export const DEFAULT_P2_SLUG: ChampionSlug = "nico";
export const DEFAULT_LAB_BOT_PROFILE_IDS = Object.freeze([
  "bomb",
  "pingo",
] as const satisfies readonly [BotProfileId, BotProfileId]);

export type HumanPlayerConfiguration = Readonly<{
  control: "human";
  championSlug: ChampionSlug;
}>;

export type BotPlayerConfiguration = Readonly<{
  control: "bot";
  championSlug: ChampionSlug;
  profileId: BotProfileId;
}>;

export type BrowserMatchConfiguration =
  | Readonly<{
      mode: "local-duel";
      players: readonly [HumanPlayerConfiguration, HumanPlayerConfiguration];
    }>
  | Readonly<{
      mode: "bot-training";
      players: readonly [HumanPlayerConfiguration, BotPlayerConfiguration];
    }>
  | Readonly<{
      mode: "bot-lab";
      players: readonly [BotPlayerConfiguration, BotPlayerConfiguration];
    }>;

export type BrowserMatchConfigurationInput = Readonly<{
  mode: BrowserGameMode;
  champion1?: string | null;
  champion2?: string | null;
  bot1?: string | null;
  bot2?: string | null;
}>;

export type BrowserLaunchState = Readonly<{
  configuration: BrowserMatchConfiguration;
  skipSelection: boolean;
}>;

const CHAMPION_SLUG_BY_ID = new Map<string, ChampionSlug>(
  Object.entries(CHAMPION_MEMBERSHIP).map(([slug, entry]) => [
    entry.characterId.toLowerCase(),
    slug as ChampionSlug,
  ]),
);

export function resolveChampionSlug(
  raw: string | null | undefined,
  fallback: ChampionSlug,
): ChampionSlug {
  const normalized = raw?.trim().toLowerCase();
  if (!normalized) return fallback;
  if (normalized in CHAMPION_MEMBERSHIP) return normalized as ChampionSlug;
  return CHAMPION_SLUG_BY_ID.get(normalized) ?? fallback;
}

function human(championSlug: ChampionSlug): HumanPlayerConfiguration {
  return Object.freeze({ control: "human", championSlug });
}

function bot(championSlug: ChampionSlug, profile: BotProfile): BotPlayerConfiguration {
  return Object.freeze({
    control: "bot",
    championSlug,
    profileId: profile.id,
  });
}

export function createBrowserMatchConfiguration(
  input: BrowserMatchConfigurationInput,
): BrowserMatchConfiguration {
  const champion1 = resolveChampionSlug(input.champion1, DEFAULT_P1_SLUG);
  const champion2 = resolveChampionSlug(
    input.champion2,
    champion1 === DEFAULT_P2_SLUG ? DEFAULT_P1_SLUG : DEFAULT_P2_SLUG,
  );

  if (input.mode === "local-duel") {
    const players: readonly [HumanPlayerConfiguration, HumanPlayerConfiguration] =
      Object.freeze([human(champion1), human(champion2)]);
    return Object.freeze({
      mode: input.mode,
      players,
    });
  }

  const profile2 = resolveBotProfile(
    input.bot2,
    input.mode === "bot-lab" ? DEFAULT_LAB_BOT_PROFILE_IDS[1] : DEFAULT_TRAINING_BOT_ID,
  );
  if (input.mode === "bot-training") {
    const players: readonly [HumanPlayerConfiguration, BotPlayerConfiguration] =
      Object.freeze([human(champion1), bot(champion2, profile2)]);
    return Object.freeze({
      mode: input.mode,
      players,
    });
  }

  const profile1 = resolveBotProfile(input.bot1, DEFAULT_LAB_BOT_PROFILE_IDS[0]);
  const players: readonly [BotPlayerConfiguration, BotPlayerConfiguration] =
    Object.freeze([
      bot(champion1, profile1),
      bot(champion2, profile2),
    ]);
  return Object.freeze({
    mode: input.mode,
    players,
  });
}

function explicitMode(raw: string | null): BrowserGameMode | null {
  if (raw === "local" || raw === "local-duel") return "local-duel";
  if (raw === "training" || raw === "bot-training") return "bot-training";
  if (raw === "lab" || raw === "bot-lab") return "bot-lab";
  return null;
}

function isNamedBotProfile(raw: string | null): boolean {
  return raw !== null && resolveBotProfile(raw).id === raw.trim().toLowerCase();
}

/**
 * Resolve all launch/query compatibility at one boundary. Browser code consumes
 * only the typed configuration and never branches on scattered URL parameters.
 */
export function parseBrowserLaunchState(search: string): BrowserLaunchState {
  const params = new URLSearchParams(search);
  const rawBot = params.get("bot");
  const legacyTraining = rawBot === "1"
    || isNamedBotProfile(rawBot)
    || params.get("control2") === "bot"
    || params.get("p2") === "bot";
  const mode = explicitMode(params.get("mode")) ?? (legacyTraining ? "bot-training" : "local-duel");
  const rawP2 = params.get("char2") ?? params.get("p2");
  const champion2 = rawP2 === "bot" || rawP2 === "human" ? null : rawP2;
  const bot2 = params.get("bot2")
    ?? params.get("profile2")
    ?? (isNamedBotProfile(rawBot) ? rawBot : null);

  return Object.freeze({
    configuration: createBrowserMatchConfiguration({
      mode,
      champion1: params.get("p1") ?? params.get("character") ?? params.get("char1"),
      champion2,
      bot1: params.get("bot1") ?? params.get("profile1"),
      bot2,
    }),
    skipSelection: params.get("skipSelect") === "1",
  });
}

export function serializeBrowserMatchConfiguration(
  configuration: BrowserMatchConfiguration,
  currentSearch = "",
): URLSearchParams {
  const params = new URLSearchParams(currentSearch);
  for (const key of [
    "mode",
    "p1",
    "p2",
    "character",
    "char1",
    "char2",
    "bot",
    "control2",
    "bot1",
    "bot2",
    "profile1",
    "profile2",
  ]) {
    params.delete(key);
  }

  params.set("mode", configuration.mode === "local-duel"
    ? "local"
    : configuration.mode === "bot-training"
      ? "training"
      : "lab");
  params.set("p1", configuration.players[0].championSlug);
  params.set("p2", configuration.players[1].championSlug);
  if (configuration.mode === "bot-training") {
    params.set("bot", configuration.players[1].profileId);
  } else if (configuration.mode === "bot-lab") {
    params.set("bot1", configuration.players[0].profileId);
    params.set("bot2", configuration.players[1].profileId);
  }
  return params;
}

export function botProfileForPlayer(
  configuration: BrowserMatchConfiguration,
  playerIndex: 0 | 1,
): BotProfile | null {
  const player = configuration.players[playerIndex];
  return player.control === "bot" ? resolveBotProfile(player.profileId) : null;
}

export function seedForBrowserMatch(
  configuration: BrowserMatchConfiguration,
  matchNumber = 1,
): string {
  if (configuration.mode !== "bot-lab") return DEFAULT_SEED;
  const left = configuration.players[0].profileId;
  const right = configuration.players[1].profileId;
  const normalizedNumber = Math.max(1, Math.trunc(matchNumber));
  return `${DEFAULT_SEED}|lab:${left}-vs-${right}|match:${normalizedNumber}`;
}
