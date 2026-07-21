import type { BotModel } from "../../../src/browser/bot-mastery/contracts.ts";
import { V1_KILLER_BEE_MASTERY } from "./mastery/killer-bee.ts";

export const V1_BOT_MODEL = Object.freeze({
  schemaVersion: 1,
  modelVersion: "v1-mastery-v1",
  identity: Object.freeze({
    id: "v1",
    label: "V1",
    personality: Object.freeze({ aggression: 560, patience: 560, curiosity: 480 }),
    preferences: Object.freeze([
      Object.freeze({ championSlug: "killer-bee", weight: 900 }),
      Object.freeze({ championSlug: "thresh", weight: 470 }),
    ]),
  }),
  mastery: Object.freeze({ "killer-bee": V1_KILLER_BEE_MASTERY }),
} as const satisfies BotModel);
