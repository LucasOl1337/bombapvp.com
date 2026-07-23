import type { BotProfileId } from "../src/bots/index.ts";
import {
  currentTechniqueCompatibility,
  type TechniqueCandidate,
  type TechniquePredicate,
} from "../src/browser/bot-mastery/index.ts";
import type {
  CampaignCandidateSpec,
  CampaignChampionSlug,
} from "../src/browser/bot-mastery/campaign.ts";

function candidate(
  championSlug: CampaignChampionSlug,
  learnerProfileId: BotProfileId,
  opponentProfileId: BotProfileId,
  id: string,
  campaignId: string,
  hypothesisId: string,
  predicate: TechniquePredicate,
): CampaignCandidateSpec {
  const technique: TechniqueCandidate = Object.freeze({
    schemaVersion: 1,
    id,
    status: "candidate",
    compatibility: currentTechniqueCompatibility(championSlug),
    provenance: Object.freeze({
      kind: "authored-hypothesis",
      hypothesisId,
      proposedBy: "captain-supervised-codex",
      sourceEventIds: Object.freeze([]),
    }),
    condition: Object.freeze({ all: Object.freeze([predicate]) }),
    action: Object.freeze({ kind: "use-skill" }),
    proposedPriority: 700,
  });
  return Object.freeze({
    campaignId,
    championSlug,
    learnerProfileId,
    opponentProfileId,
    candidate: technique,
  });
}

export const BOT_MASTERY_CANDIDATES: readonly CampaignCandidateSpec[] = Object.freeze([
  candidate(
    "ranni",
    "bomb",
    "v3",
    "ranni.danger-blink.v1",
    "ranni-danger-blink-campaign-v1",
    "ranni-danger-blink-hypothesis",
    Object.freeze({ kind: "self-in-danger" }),
  ),
  candidate(
    "ranni",
    "bomb",
    "v3",
    "ranni.proximity-blink.v1",
    "ranni-proximity-blink-campaign-v1",
    "ranni-proximity-blink-hypothesis",
    Object.freeze({ kind: "opponent-within", radius: 2 }),
  ),
  candidate(
    "killer-bee",
    "v1",
    "v3",
    "killer-bee.aligned-dash.v1",
    "killer-bee-aligned-dash-campaign-v1",
    "killer-bee-aligned-dash-hypothesis",
    Object.freeze({ kind: "opponent-aligned", maxTiles: 3, clearPath: true }),
  ),
  candidate(
    "killer-bee",
    "v1",
    "v3",
    "killer-bee.close-dash.v1",
    "killer-bee-close-dash-campaign-v1",
    "killer-bee-close-dash-hypothesis",
    Object.freeze({ kind: "opponent-within", radius: 1 }),
  ),
  candidate(
    "crocodilo-arcano",
    "pingo",
    "v3",
    "crocodilo.close-surge.v1",
    "crocodilo-close-surge-campaign-v1",
    "crocodilo-close-surge-hypothesis",
    Object.freeze({ kind: "opponent-within", radius: 2 }),
  ),
  candidate(
    "crocodilo-arcano",
    "pingo",
    "v3",
    "crocodilo.danger-surge.v1",
    "crocodilo-danger-surge-campaign-v1",
    "crocodilo-danger-surge-hypothesis",
    Object.freeze({ kind: "self-in-danger" }),
  ),
  candidate(
    "thresh",
    "v2",
    "v3",
    "thresh.aligned-hook.v1",
    "thresh-aligned-hook-campaign-v1",
    "thresh-aligned-hook-hypothesis",
    Object.freeze({ kind: "opponent-aligned", maxTiles: 4, clearPath: true }),
  ),
  candidate(
    "thresh",
    "v2",
    "v3",
    "thresh.close-hook.v1",
    "thresh-close-hook-campaign-v1",
    "thresh-close-hook-hypothesis",
    Object.freeze({ kind: "opponent-within", radius: 1 }),
  ),
]);
