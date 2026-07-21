import type { BotModel, BotModelRepository } from "../../src/browser/bot-mastery/contracts.ts";
import { BOMB_BOT_MODEL } from "./bomb/model.ts";
import { PINGO_BOT_MODEL } from "./pingo/model.ts";
import { V1_BOT_MODEL } from "./v1/model.ts";
import { V2_BOT_MODEL } from "./v2/model.ts";
import { V3_BOT_MODEL } from "./v3/model.ts";

export const BOT_MODELS: readonly BotModel[] = Object.freeze([
  BOMB_BOT_MODEL,
  PINGO_BOT_MODEL,
  V1_BOT_MODEL,
  V2_BOT_MODEL,
  V3_BOT_MODEL,
]);

const BY_ID = new Map(BOT_MODELS.map((model) => [model.identity.id, model]));

export function getBotModel(botId: string): BotModel | null {
  return BY_ID.get(botId) ?? null;
}

export const FILE_BACKED_BOT_MODEL_REPOSITORY: BotModelRepository = Object.freeze({
  get: getBotModel,
});
