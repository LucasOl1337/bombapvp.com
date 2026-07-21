import { CHAMPION_MEMBERSHIP } from "../../../../../Champions/membership.ts";
import type { CharacterMastery } from "../../../../src/browser/bot-mastery/contracts.ts";

const champion = CHAMPION_MEMBERSHIP["crocodilo-arcano"];

export const PINGO_CROCODILO_MASTERY = Object.freeze({
  schemaVersion: 1,
  knowledgeVersion: "pingo-crocodilo-v1",
  championSlug: "crocodilo-arcano",
  characterId: champion.characterId,
  skillId: champion.skillId,
  masteryBasisPoints: 2_500,
  authoredKnowledge: Object.freeze([
    Object.freeze({
      id: "crocodilo-close-surge-hypothesis",
      author: "captain-supervised-codex",
      hypothesis: "Use Emerald Surge only when a live opponent is inside its radius-two threat area.",
    }),
  ]),
  // The first campaign rejected both candidates at causal/curation review.
  techniques: Object.freeze([]),
} as const satisfies CharacterMastery);
