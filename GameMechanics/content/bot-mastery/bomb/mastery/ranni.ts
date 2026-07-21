import { CHAMPION_MEMBERSHIP } from "../../../../../Champions/membership.ts";
import type {
  ActiveTechnique,
  CharacterMastery,
} from "../../../../src/browser/bot-mastery/contracts.ts";

const champion = CHAMPION_MEMBERSHIP.ranni;

export const RANNI_DANGER_BLINK_TECHNIQUE = Object.freeze({
  schemaVersion: 1,
  id: "ranni.danger-blink.v1",
  status: "active",
  compatibility: Object.freeze({
    gameVersion: "kernel-0.10.0",
    mechanicsRevision: "mechanics-v5",
    contentRevision: "content-prototype-arena-v1",
    championSlug: "ranni",
    characterId: champion.characterId,
    skillId: champion.skillId,
    techniqueSchemaVersion: 1,
  }),
  provenance: Object.freeze({
    kind: "authored-hypothesis",
    hypothesisId: "ranni-danger-blink-hypothesis",
    proposedBy: "captain-supervised-codex",
    sourceEventIds: Object.freeze([
      "mastery-ranni-v1-seed-01|seat-0|107|decision",
    ]),
  }),
  condition: Object.freeze({
    all: Object.freeze([Object.freeze({ kind: "self-in-danger" })]),
  }),
  action: Object.freeze({ kind: "use-skill" }),
  score: Object.freeze({
    priority: 700,
    confidenceBasisPoints: 7_000,
    utilityBasisPoints: 10_000,
    evidenceMatches: 12,
    evaluationEpoch: 1,
    decayPerEpochBasisPoints: 250,
    floorBasisPoints: 2_500,
  }),
  promotion: Object.freeze({
    campaignId: "ranni-danger-blink-campaign-v1",
    seedManifest: Object.freeze([
      "mastery-ranni-v1-seed-01", "mastery-ranni-v1-seed-02",
      "mastery-ranni-v1-seed-03", "mastery-ranni-v1-seed-04",
      "mastery-ranni-v1-seed-05", "mastery-ranni-v1-seed-06",
      "mastery-ranni-v1-seed-07", "mastery-ranni-v1-seed-08",
      "mastery-ranni-v1-seed-09", "mastery-ranni-v1-seed-10",
      "mastery-ranni-v1-seed-11", "mastery-ranni-v1-seed-12",
    ]),
    baselineMatches: 12,
    candidateMatches: 12,
    baselineWins: 5,
    candidateWins: 5,
    winRateDeltaBasisPoints: 0,
    objectiveDeltaBasisPoints: 5_664,
    candidateOpportunities: 18,
    candidateSuccessfulOutcomes: 18,
    distinctSuccessfulTrajectories: 8,
    deterministicReplaysVerified: true,
    commandRejections: 0,
    safetyRegressions: 0,
    promotedBy: "captain-supervised-codex",
  }),
} as const satisfies ActiveTechnique);

export const BOMB_RANNI_MASTERY = Object.freeze({
  schemaVersion: 1,
  knowledgeVersion: "bomb-ranni-v1",
  championSlug: "ranni",
  characterId: champion.characterId,
  skillId: champion.skillId,
  masteryBasisPoints: 7_000,
  authoredKnowledge: Object.freeze([
    Object.freeze({
      id: "ranni-danger-blink-hypothesis",
      author: "captain-supervised-codex",
      hypothesis: "Reserve Ice Blink for a live blast or pressure threat, then steer toward safety.",
    }),
  ]),
  techniques: Object.freeze([RANNI_DANGER_BLINK_TECHNIQUE]),
} as const satisfies CharacterMastery);
