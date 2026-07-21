import type { BotModel } from "../../../src/browser/bot-mastery/contracts.ts";
import { V2_THRESH_MASTERY } from "./mastery/thresh.ts";

export const V2_BOT_MODEL = Object.freeze({
  schemaVersion: 1,
  modelVersion: "v2-mastery-v1",
  identity: Object.freeze({
    id: "v2",
    label: "V2",
    personality: Object.freeze({ aggression: 760, patience: 430, curiosity: 700 }),
    preferences: Object.freeze([
      Object.freeze({ championSlug: "thresh", weight: 930 }),
      Object.freeze({ championSlug: "killer-bee", weight: 760 }),
    ]),
  }),
  mastery: Object.freeze({ thresh: V2_THRESH_MASTERY }),
} as const satisfies BotModel);
