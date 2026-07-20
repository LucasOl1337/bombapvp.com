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
import type { BotDecisionPolicy } from "./bot-contracts";
import type { OfflineLaunchRequest } from "../../matches/launch-request";

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
    // Continuous always runs Bomb + Pingo Completers (see CONTINUOUS_BOT_SLOT_IDS).
    preserveNativeDefault: false,
    formatLabel: (label) => label,
  },
};

/**
 * Online PvP Completer lineup: three bot seats filled by Bomb and Pingo only.
 * Slot order matches lab-style variety without a bot picker on the landing CTA.
 */
const CONTINUOUS_BOT_SLOT_IDS: readonly LocalBotId[] = Object.freeze([
  "bomb",
  "pingo",
  "bomb",
]);

export type OfflineBotMatchSetup = Readonly<{
  bot: LocalBotDefinition;
  botFill: 1 | 3;
  roomMode: "classic" | "endless";
  options: Readonly<{
    botDecisionPolicies: Partial<Record<PlayerId, BotDecisionPolicy>>;
    botCharacterSelections: Partial<Record<PlayerId, number>>;
    playerLabels: Partial<Record<PlayerId, string>>;
    showWorldPlayerLabels?: boolean;
  }>;
}>;

export function createOfflineBotMatchSetup(
  request: OfflineLaunchRequest,
): OfflineBotMatchSetup {
  const config = OFFLINE_BOT_MODE_CONFIG[request.mode];
  const fallbackBot = getLocalBotById(config.defaultBotId);
  if (!fallbackBot) throw new Error("local_bot_default_missing");

  // Continuous online PvP always mixes Bomb + Pingo with world name tags
  // (same tag style as the bot-vs-bot lab). The URL bot param is ignored here.
  if (request.mode === "continuous") {
    const slotBots = CONTINUOUS_BOT_SLOT_IDS.map((id) => {
      const bot = getLocalBotById(id);
      if (!bot) throw new Error(`continuous_bot_missing:${id}`);
      return bot;
    });
    const assignments = createLocalBotAssignments(
      config.playerIds.map((playerId, index) => ({
        playerId,
        bot: slotBots[index] ?? slotBots[0]!,
      })),
    );
    const playerLabels = Object.fromEntries(
      config.playerIds.map((playerId, index) => [
        playerId,
        config.formatLabel((slotBots[index] ?? slotBots[0]!).label),
      ]),
    ) as Partial<Record<PlayerId, string>>;

    return {
      bot: slotBots[0]!,
      botFill: config.botFill,
      roomMode: config.roomMode,
      options: {
        botDecisionPolicies: assignments.botDecisionPolicies,
        botCharacterSelections: assignments.characterSelections,
        playerLabels,
        showWorldPlayerLabels: true,
      },
    };
  }

  const requestedBot = getLocalBotById(request.bot);
  const bot = requestedBot ?? fallbackBot;
  const assignments = createLocalBotAssignments(
    config.playerIds.map((playerId) => ({ playerId, bot })),
  );
  const playerLabels = Object.fromEntries(config.playerIds.map((playerId) => [
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
      showWorldPlayerLabels: false,
    },
  };
}
