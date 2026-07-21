import type { BotModel } from "../../../src/browser/bot-mastery/contracts.ts";

export const V3_BOT_MODEL = Object.freeze({
  schemaVersion: 1,
  modelVersion: "v3-mastery-v1",
  identity: Object.freeze({
    id: "v3",
    label: "V3",
    personality: Object.freeze({ aggression: 680, patience: 610, curiosity: 900 }),
    preferences: Object.freeze([
      Object.freeze({ championSlug: "ranni", weight: 840 }),
      Object.freeze({ championSlug: "crocodilo-arcano", weight: 780 }),
      Object.freeze({ championSlug: "thresh", weight: 720 }),
    ]),
  }),
  mastery: Object.freeze({}),
} as const satisfies BotModel);
