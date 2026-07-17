import type { PlayerId } from "../Gameplay/types";
import {
  DEFAULT_CONTINUOUS_BOT_ID,
  DEFAULT_TRAINING_BOT_ID,
  getLocalBotMetadataById,
  getLocalBotMetadataByModel,
  LOCAL_BOT_CATALOG,
  type LocalBotId,
  type LocalBotMetadata,
} from "./bot-catalog";
import { getBotDecision } from "./bot-ai";
import { BOMB_CHARACTER_INDEX, getBombDecision } from "./bot-bomb";
import { getBotPingoDecision } from "./bot-pingo";
import { BOT_V2_CHARACTER_INDEX, getBotV2Decision } from "./bot-v2";
import { BOT_V3_CHARACTER_INDEX, getBotV3Decision } from "./bot-v3";
import type { BotDecisionPolicy } from "./game-app";

export type { LocalBotId } from "./bot-catalog";

export type LocalBotDefinition = LocalBotMetadata & Readonly<{
  policy: BotDecisionPolicy;
  characterIndex: (playerId: PlayerId) => number;
}>;

const fixedCharacter = (characterIndex: number): ((playerId: PlayerId) => number) => (
  () => characterIndex
);

type LocalBotRuntime = Pick<LocalBotDefinition, "policy" | "characterIndex">;

const LOCAL_BOT_RUNTIME: Record<LocalBotId, LocalBotRuntime> = {
  bomb: { policy: getBombDecision, characterIndex: fixedCharacter(BOMB_CHARACTER_INDEX) },
  pingo: { policy: getBotPingoDecision, characterIndex: fixedCharacter(BOMB_CHARACTER_INDEX) },
  v1: { policy: getBotDecision, characterIndex: (playerId) => playerId - 1 },
  v2: { policy: getBotV2Decision, characterIndex: fixedCharacter(BOT_V2_CHARACTER_INDEX) },
  v3: { policy: getBotV3Decision, characterIndex: fixedCharacter(BOT_V3_CHARACTER_INDEX) },
};

export const LOCAL_BOTS: readonly LocalBotDefinition[] = Object.freeze(
  LOCAL_BOT_CATALOG.map((metadata) => ({
    ...metadata,
    ...LOCAL_BOT_RUNTIME[metadata.id],
  })),
);

const LOCAL_BOTS_BY_ID = Object.fromEntries(
  LOCAL_BOTS.map((bot) => [bot.id, bot]),
) as Record<LocalBotId, LocalBotDefinition>;

export function getLocalBotById(id: string | null | undefined): LocalBotDefinition | null {
  const metadata = getLocalBotMetadataById(id);
  return metadata ? LOCAL_BOTS_BY_ID[metadata.id] : null;
}

export function getLocalBotByModel(model: string | null | undefined): LocalBotDefinition | null {
  const metadata = getLocalBotMetadataByModel(model);
  return metadata ? LOCAL_BOTS_BY_ID[metadata.id] : null;
}

export type LocalBotAssignment = Readonly<{
  playerId: PlayerId;
  bot: LocalBotDefinition | null;
}>;

export type LocalBotAssignments = Readonly<{
  botDecisionPolicies: Partial<Record<PlayerId, BotDecisionPolicy>>;
  characterSelections: Partial<Record<PlayerId, number>>;
  playerLabels: Partial<Record<PlayerId, string>>;
}>;

export function createLocalBotAssignments(
  assignments: readonly LocalBotAssignment[],
): LocalBotAssignments {
  const botDecisionPolicies: Partial<Record<PlayerId, BotDecisionPolicy>> = {};
  const characterSelections: Partial<Record<PlayerId, number>> = {};
  const playerLabels: Partial<Record<PlayerId, string>> = {};

  for (const { playerId, bot } of assignments) {
    if (!bot) continue;
    botDecisionPolicies[playerId] = bot.policy;
    characterSelections[playerId] = bot.characterIndex(playerId);
    playerLabels[playerId] = bot.label;
  }

  return { botDecisionPolicies, characterSelections, playerLabels };
}

export type OfflineBotMode = "training" | "continuous";

type OfflineBotModeConfig = Readonly<{
  defaultBotId: LocalBotId;
  playerIds: readonly PlayerId[];
  botFill: 1 | 3;
  roomMode: "classic" | "endless";
  preserveNativeDefault: boolean;
  formatLabel: (label: string) => string;
}>;

const OFFLINE_BOT_MODE_CONFIG: Record<OfflineBotMode, OfflineBotModeConfig> = {
  training: {
    defaultBotId: DEFAULT_TRAINING_BOT_ID,
    playerIds: [2],
    botFill: 1,
    roomMode: "classic",
    preserveNativeDefault: false,
    formatLabel: (label) => label.toUpperCase(),
  },
  continuous: {
    defaultBotId: DEFAULT_CONTINUOUS_BOT_ID,
    playerIds: [2, 3, 4],
    botFill: 3,
    roomMode: "endless",
    preserveNativeDefault: true,
    formatLabel: (label) => label,
  },
};

export type OfflineBotMatchSetup = Readonly<{
  bot: LocalBotDefinition;
  botFill: 1 | 3;
  roomMode: "classic" | "endless";
  options: Readonly<{
    botDecisionPolicies: Partial<Record<PlayerId, BotDecisionPolicy>>;
    botCharacterSelections: Partial<Record<PlayerId, number>>;
    playerLabels: Partial<Record<PlayerId, string>>;
  }>;
}>;

export function createOfflineBotMatchSetup(
  mode: OfflineBotMode,
  params: URLSearchParams,
): OfflineBotMatchSetup {
  const config = OFFLINE_BOT_MODE_CONFIG[mode];
  const requestedBot = getLocalBotById(params.get("bot"));
  const fallbackBot = getLocalBotById(config.defaultBotId);
  if (!fallbackBot) throw new Error("local_bot_default_missing");
  const bot = requestedBot ?? fallbackBot;
  const preserveNativeDefault = config.preserveNativeDefault && requestedBot === null;
  const assignments = preserveNativeDefault
    ? createLocalBotAssignments([])
    : createLocalBotAssignments(config.playerIds.map((playerId) => ({ playerId, bot })));
  const playerLabels = preserveNativeDefault
    ? {}
    : Object.fromEntries(config.playerIds.map((playerId) => [
        playerId,
        config.formatLabel(bot.label),
      ])) as Partial<Record<PlayerId, string>>;

  return {
    bot,
    botFill: config.botFill,
    roomMode: config.roomMode,
    options: {
      botDecisionPolicies: assignments.botDecisionPolicies,
      botCharacterSelections: assignments.characterSelections,
      playerLabels,
    },
  };
}
