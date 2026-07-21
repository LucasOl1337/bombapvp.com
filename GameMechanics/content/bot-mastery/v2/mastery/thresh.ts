import { CHAMPION_MEMBERSHIP } from "../../../../../Champions/membership.ts";
import type { CharacterMastery } from "../../../../src/browser/bot-mastery/contracts.ts";

const champion = CHAMPION_MEMBERSHIP.thresh;

export const V2_THRESH_MASTERY = Object.freeze({
  schemaVersion: 1,
  knowledgeVersion: "v2-thresh-v1",
  championSlug: "thresh",
  characterId: champion.characterId,
  skillId: champion.skillId,
  masteryBasisPoints: 2_500,
  authoredKnowledge: Object.freeze([
    Object.freeze({
      id: "thresh-aligned-hook-hypothesis",
      author: "captain-supervised-codex",
      hypothesis: "Cast Death Sentence only on a clear cardinal line within four tiles.",
    }),
  ]),
  // The first campaign rejected both candidates at causal/curation review.
  techniques: Object.freeze([]),
} as const satisfies CharacterMastery);
