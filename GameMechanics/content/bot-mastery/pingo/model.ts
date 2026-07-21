import type { BotModel } from "../../../src/browser/bot-mastery/contracts.ts";
import { PINGO_CROCODILO_MASTERY } from "./mastery/crocodilo-arcano.ts";

export const PINGO_BOT_MODEL = Object.freeze({
  schemaVersion: 1,
  modelVersion: "pingo-mastery-v1",
  identity: Object.freeze({
    id: "pingo",
    label: "Pingo",
    personality: Object.freeze({ aggression: 330, patience: 850, curiosity: 610 }),
    preferences: Object.freeze([
      Object.freeze({ championSlug: "crocodilo-arcano", weight: 920 }),
      Object.freeze({ championSlug: "ranni", weight: 680 }),
    ]),
  }),
  mastery: Object.freeze({ "crocodilo-arcano": PINGO_CROCODILO_MASTERY }),
} as const satisfies BotModel);
