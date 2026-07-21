import { CHAMPION_MEMBERSHIP } from "../../../../../Champions/membership.ts";
import type { CharacterMastery } from "../../../../src/browser/bot-mastery/contracts.ts";

const champion = CHAMPION_MEMBERSHIP["killer-bee"];

export const V1_KILLER_BEE_MASTERY = Object.freeze({
  schemaVersion: 1,
  knowledgeVersion: "v1-killer-bee-v1",
  championSlug: "killer-bee",
  characterId: champion.characterId,
  skillId: champion.skillId,
  masteryBasisPoints: 2_500,
  authoredKnowledge: Object.freeze([
    Object.freeze({
      id: "killer-bee-aligned-dash-hypothesis",
      author: "captain-supervised-codex",
      hypothesis: "Use Wing Dash on a clear aligned approach of at most three tiles.",
    }),
  ]),
  // The first campaign rejected both candidates at causal/curation review.
  techniques: Object.freeze([]),
} as const satisfies CharacterMastery);
