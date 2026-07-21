import type { BotModel } from "../../../src/browser/bot-mastery/contracts.ts";
import { BOMB_RANNI_MASTERY } from "./mastery/ranni.ts";

export const BOMB_BOT_MODEL = Object.freeze({
  schemaVersion: 1,
  modelVersion: "bomb-mastery-v1",
  identity: Object.freeze({
    id: "bomb",
    label: "Bomb",
    personality: Object.freeze({ aggression: 820, patience: 260, curiosity: 420 }),
    preferences: Object.freeze([
      Object.freeze({ championSlug: "ranni", weight: 900 }),
      Object.freeze({ championSlug: "killer-bee", weight: 520 }),
    ]),
  }),
  mastery: Object.freeze({ ranni: BOMB_RANNI_MASTERY }),
} as const satisfies BotModel);
