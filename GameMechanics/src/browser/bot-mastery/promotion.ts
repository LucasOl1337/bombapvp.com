import type {
  ActiveTechnique,
  PromotionDecision,
  PromotionGate,
  TechniqueCandidate,
  TechniqueEvaluationSummary,
  CuratedTechniqueDecision,
  TechniqueCurationReview,
  TechniquePortfolioDecision,
  TechniquePortfolioEntry,
} from "./contracts.ts";
import { validateTechniqueCandidate } from "./validation.ts";

export const DEFAULT_PROMOTION_GATE: PromotionGate = Object.freeze({
  minimumMatches: 12,
  minimumWinRateDeltaBasisPoints: 500,
  minimumObjectiveDeltaBasisPoints: 500,
  minimumCandidateObjectiveBasisPoints: 5_000,
  minimumCandidateSuccessfulOutcomes: 1,
  minimumDistinctSuccessfulTrajectories: 2,
  maximumWinRateRegressionBasisPoints: 500,
  maximumSafetyRegressions: 0,
});

function rateBasisPoints(wins: number, matches: number): number {
  if (matches <= 0) return 0;
  return Math.trunc((wins * 10_000) / matches);
}

function objectiveDeltaBasisPoints(baseline: number, candidate: number): number {
  if (baseline === 0) return candidate === 0 ? 0 : 10_000;
  return Math.trunc(((candidate - baseline) * 10_000) / Math.abs(baseline));
}

export function evaluateTechniquePromotion(
  candidate: TechniqueCandidate,
  evidence: TechniqueEvaluationSummary,
  promotedBy: string,
  gate: PromotionGate = DEFAULT_PROMOTION_GATE,
): PromotionDecision {
  const validation = validateTechniqueCandidate(candidate, candidate.compatibility.championSlug);
  const reasons = [...validation.issues];
  if (candidate.id !== evidence.candidateId) {
    reasons.push("Candidate id does not match the evaluation summary.");
  }
  if (evidence.baselineMatches < gate.minimumMatches) {
    reasons.push(`Baseline requires at least ${gate.minimumMatches} matches.`);
  }
  if (evidence.candidateMatches < gate.minimumMatches) {
    reasons.push(`Candidate requires at least ${gate.minimumMatches} matches.`);
  }
  if (evidence.seedManifest.length !== evidence.baselineMatches) {
    reasons.push("Seed manifest must enumerate every paired baseline match.");
  }
  if (evidence.candidateMatches !== evidence.baselineMatches) {
    reasons.push("Baseline and candidate match counts must be paired.");
  }
  if (!evidence.deterministicReplaysVerified) reasons.push("Every seed must pass replay parity.");
  if (evidence.commandRejections !== 0) reasons.push("Evaluation produced command rejections.");
  if (evidence.safetyRegressions > gate.maximumSafetyRegressions) {
    reasons.push("Evaluation exceeded the safety-regression gate.");
  }

  const winRateDelta = rateBasisPoints(evidence.candidateWins, evidence.candidateMatches)
    - rateBasisPoints(evidence.baselineWins, evidence.baselineMatches);
  const objectiveDelta = objectiveDeltaBasisPoints(
    evidence.baselineObjectivePoints,
    evidence.candidateObjectivePoints,
  );
  if (winRateDelta < -gate.maximumWinRateRegressionBasisPoints) {
    reasons.push(
      `Win-rate regression ${winRateDelta}bp exceeds ${gate.maximumWinRateRegressionBasisPoints}bp.`,
    );
  }
  if (
    winRateDelta < gate.minimumWinRateDeltaBasisPoints
    && objectiveDelta < gate.minimumObjectiveDeltaBasisPoints
  ) {
    reasons.push(
      `Evidence misses both improvement gates (win ${winRateDelta}bp, objective ${objectiveDelta}bp).`,
    );
  }
  if (evidence.candidateObjectivePoints < gate.minimumCandidateObjectiveBasisPoints) {
    reasons.push(
      `Candidate outcome rate ${evidence.candidateObjectivePoints}bp is below ${gate.minimumCandidateObjectiveBasisPoints}bp.`,
    );
  }
  if (evidence.candidateSuccessfulOutcomes < gate.minimumCandidateSuccessfulOutcomes) {
    reasons.push(
      `Candidate requires at least ${gate.minimumCandidateSuccessfulOutcomes} successful declared outcomes.`,
    );
  }
  if (evidence.distinctSuccessfulTrajectories < gate.minimumDistinctSuccessfulTrajectories) {
    reasons.push(
      `Candidate requires at least ${gate.minimumDistinctSuccessfulTrajectories} distinct successful trajectories.`,
    );
  }

  if (reasons.length > 0) {
    return Object.freeze({ accepted: false, reasons: Object.freeze(reasons), technique: null });
  }

  const confidence = Math.min(
    9_500,
    5_000 + Math.max(0, winRateDelta) + Math.min(2_000, Math.max(0, objectiveDelta)),
  );
  const technique: ActiveTechnique = Object.freeze({
    schemaVersion: candidate.schemaVersion,
    id: candidate.id,
    status: "active",
    compatibility: candidate.compatibility,
    provenance: candidate.provenance,
    condition: candidate.condition,
    action: candidate.action,
    score: Object.freeze({
      priority: candidate.proposedPriority,
      confidenceBasisPoints: confidence,
      utilityBasisPoints: Math.min(10_000, 5_000 + Math.max(winRateDelta, objectiveDelta)),
      evidenceMatches: evidence.candidateMatches,
      evaluationEpoch: 1,
      decayPerEpochBasisPoints: 250,
      floorBasisPoints: 2_500,
    }),
    promotion: Object.freeze({
      campaignId: evidence.campaignId,
      seedManifest: Object.freeze([...evidence.seedManifest]),
      baselineMatches: evidence.baselineMatches,
      candidateMatches: evidence.candidateMatches,
      baselineWins: evidence.baselineWins,
      candidateWins: evidence.candidateWins,
      winRateDeltaBasisPoints: winRateDelta,
      objectiveDeltaBasisPoints: objectiveDelta,
      candidateOpportunities: evidence.candidateOpportunities,
      candidateSuccessfulOutcomes: evidence.candidateSuccessfulOutcomes,
      distinctSuccessfulTrajectories: evidence.distinctSuccessfulTrajectories,
      deterministicReplaysVerified: evidence.deterministicReplaysVerified,
      commandRejections: evidence.commandRejections,
      safetyRegressions: evidence.safetyRegressions,
      promotedBy,
    }),
  });
  return Object.freeze({
    accepted: true,
    reasons: Object.freeze([
      `Passed paired evidence gates (win ${winRateDelta}bp, objective ${objectiveDelta}bp).`,
    ]),
    technique,
  });
}

/**
 * First-release portfolio gate: after individual evidence gates, keep one
 * non-redundant action technique per Champion. Ranking is deterministic and
 * favors match outcomes, then absolute objective success, then canonical id.
 */
export function selectTechniquePortfolio(
  entries: readonly TechniquePortfolioEntry[],
): readonly TechniquePortfolioDecision[] {
  const winningIdByGroup = new Map<string, string>();
  const accepted = entries.filter((entry) => entry.promotion.accepted);
  const groups = new Map<string, TechniquePortfolioEntry[]>();
  for (const entry of accepted) {
    const key = `${entry.candidate.compatibility.championSlug}|${entry.candidate.action.kind}`;
    const group = groups.get(key) ?? [];
    group.push(entry);
    groups.set(key, group);
  }
  for (const [key, group] of groups) {
    group.sort((left, right) => {
      const leftWinDelta = rateBasisPoints(left.evaluation.candidateWins, left.evaluation.candidateMatches)
        - rateBasisPoints(left.evaluation.baselineWins, left.evaluation.baselineMatches);
      const rightWinDelta = rateBasisPoints(right.evaluation.candidateWins, right.evaluation.candidateMatches)
        - rateBasisPoints(right.evaluation.baselineWins, right.evaluation.baselineMatches);
      return rightWinDelta - leftWinDelta
        || right.evaluation.candidateObjectivePoints - left.evaluation.candidateObjectivePoints
        || left.candidate.id.localeCompare(right.candidate.id);
    });
    winningIdByGroup.set(key, group[0]!.candidate.id);
  }
  return Object.freeze(entries.map((entry) => {
    if (!entry.promotion.accepted) {
      return Object.freeze({
        candidateId: entry.candidate.id,
        accepted: false,
        reasons: entry.promotion.reasons,
        technique: null,
      });
    }
    const key = `${entry.candidate.compatibility.championSlug}|${entry.candidate.action.kind}`;
    const winnerId = winningIdByGroup.get(key);
    if (winnerId !== entry.candidate.id) {
      return Object.freeze({
        candidateId: entry.candidate.id,
        accepted: false,
        reasons: Object.freeze([
          `Portfolio gate rejected redundant action; ${winnerId} has stronger paired evidence.`,
        ]),
        technique: null,
      });
    }
    return Object.freeze({
      candidateId: entry.candidate.id,
      accepted: true,
      reasons: entry.promotion.reasons,
      technique: entry.promotion.technique,
    });
  }));
}

/** Final reviewed release gate; numeric projection alone never edits runtime knowledge. */
export function applyTechniqueCuration(
  portfolio: readonly TechniquePortfolioDecision[],
  reviews: readonly TechniqueCurationReview[],
): readonly CuratedTechniqueDecision[] {
  const reviewById = new Map(reviews.map((review) => [review.candidateId, review]));
  return Object.freeze(portfolio.map((decision) => {
    const review = reviewById.get(decision.candidateId);
    if (!review) {
      return Object.freeze({
        ...decision,
        accepted: false,
        technique: null,
        reasons: Object.freeze([...decision.reasons, "Missing explicit curation review."]),
        reviewer: "missing",
      });
    }
    const accepted = decision.accepted && review.approved && decision.technique !== null;
    return Object.freeze({
      ...decision,
      accepted,
      technique: accepted ? decision.technique : null,
      reasons: Object.freeze([
        ...decision.reasons,
        `${review.approved ? "Curation approved" : "Curation rejected"}: ${review.rationale}`,
      ]),
      reviewer: review.reviewer,
    });
  }));
}
