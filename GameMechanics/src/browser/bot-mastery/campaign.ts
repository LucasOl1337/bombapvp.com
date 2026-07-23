import { CHAMPION_MEMBERSHIP, type ChampionSlug } from "../../../../Champions/membership.ts";
import type { BotProfileId } from "../../bots/index.ts";
import type {
  CompetitorId,
  GameEvent,
  GameSnapshot,
  TileCoord,
} from "../../contracts.ts";
import { createGameMechanics } from "../../game-mechanics.ts";
import {
  createLocalDuel1v1MatchConfig,
  createMatchConfig,
} from "../../match-config.ts";
import {
  ROUND_START_MS,
  TICK_DURATION_MS,
} from "../../contracts.ts";
import { FILE_BACKED_BOT_MODEL_REPOSITORY } from "../../../content/bot-mastery/catalog.ts";
import {
  createBrowserBotDrivers,
  driveBrowserBotsForTick,
  recordBrowserBotTickOutcome,
} from "../bot-drivers.ts";
import { createBrowserMatchConfiguration } from "../match-mode.ts";
import {
  createInMemoryExperienceSink,
  evaluateTechniquePromotion,
  selectTechnique,
} from "./index.ts";
import type {
  BotExperienceEvent,
  BotModel,
  BotModelRepository,
  PromotionDecision,
  TechniqueCandidate,
  TechniqueEvaluationSummary,
} from "./contracts.ts";

export type CampaignCandidateSpec = Readonly<{
  campaignId: string;
  championSlug: ChampionSlug;
  learnerProfileId: BotProfileId;
  opponentProfileId: BotProfileId;
  candidate: TechniqueCandidate;
}>;

export type CampaignOpportunity = Readonly<{
  revision: number;
  dueRevision: number;
  selfTile: TileCoord;
  opponentTile: TileCoord;
  success: boolean;
}>;

export type CampaignMatchSummary = Readonly<{
  seed: string;
  learnerSide: 0 | 1;
  won: boolean;
  winnerId: CompetitorId | null;
  completionRevision: number;
  decisions: number;
  techniqueSelections: number;
  opportunities: number;
  successfulOutcomes: number;
  selfEliminations: number;
  commandRejections: number;
  experienceEvents: number;
  opportunityTrace: readonly CampaignOpportunity[];
}>;

export type CampaignResult = Readonly<{
  spec: CampaignCandidateSpec;
  baseline: readonly CampaignMatchSummary[];
  candidate: readonly CampaignMatchSummary[];
  evaluation: TechniqueEvaluationSummary;
  promotion: PromotionDecision;
}>;

type PendingOpportunity = {
  revision: number;
  dueRevision: number;
  selfTile: TileCoord;
  opponentTile: TileCoord;
};

const CHANNEL_TICKS: Readonly<Record<ChampionSlug, number>> = Object.freeze({
  ranni: 125,
  "killer-bee": 12,
  "crocodilo-arcano": 80,
  thresh: 15,
  /** Living Shadow free-move window: ZED_CHANNEL_MS / TICK_DURATION_MS. */
  zed: 100,
});

function stripTechniques(model: BotModel): BotModel {
  return Object.freeze({
    ...model,
    mastery: Object.freeze(Object.fromEntries(
      Object.entries(model.mastery).map(([slug, mastery]) => [
        slug,
        mastery ? Object.freeze({ ...mastery, techniques: Object.freeze([]) }) : mastery,
      ]),
    )),
  });
}

const CAMPAIGN_MODEL_REPOSITORY: BotModelRepository = Object.freeze({
  get(botId: string): BotModel | null {
    const model = FILE_BACKED_BOT_MODEL_REPOSITORY.get(botId);
    return model ? stripTechniques(model) : null;
  },
});

function distance(left: TileCoord, right: TileCoord): number {
  return Math.abs(left.x - right.x) + Math.abs(left.y - right.y);
}

function competitor(snapshot: GameSnapshot, id: CompetitorId) {
  return snapshot.competitors.find((entry) => entry.id === id) ?? null;
}

function opportunitySucceeded(
  slug: ChampionSlug,
  pending: PendingOpportunity,
  snapshot: GameSnapshot,
  learnerId: CompetitorId,
  opponentId: CompetitorId,
): boolean {
  const learner = competitor(snapshot, learnerId);
  const opponent = competitor(snapshot, opponentId);
  if (slug === "ranni") return learner?.alive === true;
  if (slug === "killer-bee") {
    return learner?.alive === true && distance(pending.selfTile, learner.tile) >= 2;
  }
  if (slug === "crocodilo-arcano") return opponent?.alive === false;
  if (!learner || !opponent) return false;
  const before = distance(pending.selfTile, pending.opponentTile);
  return distance(learner.tile, opponent.tile) < before;
}

function canonicalMatchResult(
  summary: CampaignMatchSummary,
  finalSnapshot: GameSnapshot,
  events: readonly GameEvent[],
  experienceEvents: readonly BotExperienceEvent[],
): string {
  return JSON.stringify({ summary, finalSnapshot, events, experienceEvents });
}

function runMatch(
  spec: CampaignCandidateSpec,
  seed: string,
  learnerSide: 0 | 1,
  candidateEnabled: boolean,
): Readonly<{
  summary: CampaignMatchSummary;
  finalSnapshot: GameSnapshot;
  events: readonly GameEvent[];
  experienceEvents: readonly BotExperienceEvent[];
}> {
  const opponentSide: 0 | 1 = learnerSide === 0 ? 1 : 0;
  const profiles: [BotProfileId, BotProfileId] = learnerSide === 0
    ? [spec.learnerProfileId, spec.opponentProfileId]
    : [spec.opponentProfileId, spec.learnerProfileId];
  const configuration = createBrowserMatchConfiguration({
    mode: "bot-lab",
    champion1: spec.championSlug,
    champion2: spec.championSlug,
    bot1: profiles[0],
    bot2: profiles[1],
  });
  const base = createLocalDuel1v1MatchConfig({
    seed,
    roundDurationMs: 5_000,
    targetRoundWins: 1,
  });
  const config = createMatchConfig({
    ...base,
    seats: base.seats.map((seat) => ({
      ...seat,
      skillId: CHAMPION_MEMBERSHIP[spec.championSlug].skillId,
    })),
  });
  const game = createGameMechanics(config);
  const experienceSink = createInMemoryExperienceSink();
  const drivers = createBrowserBotDrivers(configuration, config, {
    modelRepository: CAMPAIGN_MODEL_REPOSITORY,
    experienceSink,
    recordExperience: true,
    evaluationCandidates: candidateEnabled ? { [learnerSide]: [spec.candidate] } : {},
  });
  const learnerDriver = drivers.find(({ playerIndex }) => playerIndex === learnerSide)!;
  const learnerId = config.seats[learnerSide]!.competitorId;
  const opponentId = config.seats[opponentSide]!.competitorId;
  const allEvents: GameEvent[] = [
    ...game.dispatch({ type: "advance", deltaMs: ROUND_START_MS }),
  ];
  const pending: PendingOpportunity[] = [];
  const opportunityTrace: CampaignOpportunity[] = [];
  let selfEliminations = 0;
  const maximumTicks = 5_000;

  for (let tick = 0; tick < maximumTicks; tick += 1) {
    const before = game.snapshot();
    if (before.phase === "match-over") break;
    const reports = driveBrowserBotsForTick(before, drivers);
    const learnerReport = reports.find(({ playerIndex }) => playerIndex === learnerSide);
    const observedSelection = candidateEnabled
      ? learnerReport?.selectedTechniqueId === spec.candidate.id
      : selectTechnique(
          before,
          learnerId,
          spec.championSlug,
          [spec.candidate],
          learnerReport?.commands ?? [],
        )?.selectedTechniqueId === spec.candidate.id;
    if (observedSelection) {
      const self = competitor(before, learnerId);
      const opponent = competitor(before, opponentId);
      if (self && opponent) {
        pending.push({
          revision: before.revision,
          dueRevision: before.revision + CHANNEL_TICKS[spec.championSlug],
          selfTile: Object.freeze({ ...self.tile }),
          opponentTile: Object.freeze({ ...opponent.tile }),
        });
      }
    }
    for (const report of reports) {
      for (const command of report.commands) game.dispatch(command);
    }
    const tickEvents = game.dispatch({ type: "advance", deltaMs: TICK_DURATION_MS });
    const after = game.snapshot();
    recordBrowserBotTickOutcome(after, drivers, tickEvents, game.rejections());
    allEvents.push(...tickEvents);
    for (const event of tickEvents) {
      if (event.type !== "competitor-eliminated" || event.competitorId !== learnerId) continue;
      if (event.causes.some((cause) => cause.kind === "bomb" && cause.ownerId === learnerId)) {
        selfEliminations += 1;
      }
    }
    for (let index = pending.length - 1; index >= 0; index -= 1) {
      const item = pending[index]!;
      if (after.revision < item.dueRevision && after.phase !== "match-over") continue;
      opportunityTrace.push(Object.freeze({
        ...item,
        success: opportunitySucceeded(spec.championSlug, item, after, learnerId, opponentId),
      }));
      pending.splice(index, 1);
    }
  }

  const finalSnapshot = game.snapshot();
  for (const item of pending) {
    opportunityTrace.push(Object.freeze({
      ...item,
      success: opportunitySucceeded(spec.championSlug, item, finalSnapshot, learnerId, opponentId),
    }));
  }
  const summary = Object.freeze({
    seed,
    learnerSide,
    won: finalSnapshot.matchWinner === learnerId,
    winnerId: finalSnapshot.matchWinner,
    completionRevision: finalSnapshot.revision,
    decisions: learnerDriver.decisions,
    techniqueSelections: learnerDriver.selectedTechniqueCounts[spec.candidate.id] ?? 0,
    opportunities: opportunityTrace.length,
    successfulOutcomes: opportunityTrace.filter(({ success }) => success).length,
    selfEliminations,
    commandRejections: drivers.reduce((sum, driver) => sum + driver.commandRejections, 0),
    experienceEvents: experienceSink.events().length,
    opportunityTrace: Object.freeze(opportunityTrace),
  } satisfies CampaignMatchSummary);
  return Object.freeze({
    summary,
    finalSnapshot,
    events: Object.freeze(allEvents),
    experienceEvents: experienceSink.events(),
  });
}

function objectiveRate(matches: readonly CampaignMatchSummary[]): number {
  const opportunities = matches.reduce((sum, match) => sum + match.opportunities, 0);
  const successes = matches.reduce((sum, match) => sum + match.successfulOutcomes, 0);
  return opportunities === 0 ? 0 : Math.trunc((successes * 10_000) / opportunities);
}

function distinctSuccessfulTrajectories(matches: readonly CampaignMatchSummary[]): number {
  return new Set(matches.flatMap((match) => match.opportunityTrace
    .filter(({ success }) => success)
    .map(({ selfTile, opponentTile }) =>
      `${selfTile.x},${selfTile.y}->${opponentTile.x},${opponentTile.y}`))).size;
}

export function runTechniqueCampaign(
  spec: CampaignCandidateSpec,
  seeds: readonly string[],
): CampaignResult {
  const baseline: CampaignMatchSummary[] = [];
  const candidate: CampaignMatchSummary[] = [];
  let replayVerified = true;
  for (const [index, seed] of seeds.entries()) {
    const learnerSide: 0 | 1 = index % 2 === 0 ? 0 : 1;
    const baselineRun = runMatch(spec, seed, learnerSide, false);
    const baselineReplay = runMatch(spec, seed, learnerSide, false);
    const candidateRun = runMatch(spec, seed, learnerSide, true);
    const candidateReplay = runMatch(spec, seed, learnerSide, true);
    replayVerified &&= canonicalMatchResult(
      baselineRun.summary,
      baselineRun.finalSnapshot,
      baselineRun.events,
      baselineRun.experienceEvents,
    ) === canonicalMatchResult(
      baselineReplay.summary,
      baselineReplay.finalSnapshot,
      baselineReplay.events,
      baselineReplay.experienceEvents,
    );
    replayVerified &&= canonicalMatchResult(
      candidateRun.summary,
      candidateRun.finalSnapshot,
      candidateRun.events,
      candidateRun.experienceEvents,
    ) === canonicalMatchResult(
      candidateReplay.summary,
      candidateReplay.finalSnapshot,
      candidateReplay.events,
      candidateReplay.experienceEvents,
    );
    baseline.push(baselineRun.summary);
    candidate.push(candidateRun.summary);
  }
  const evaluation = Object.freeze({
    campaignId: spec.campaignId,
    candidateId: spec.candidate.id,
    seedManifest: Object.freeze([...seeds]),
    baselineMatches: baseline.length,
    candidateMatches: candidate.length,
    baselineWins: baseline.filter(({ won }) => won).length,
    candidateWins: candidate.filter(({ won }) => won).length,
    baselineObjectivePoints: objectiveRate(baseline),
    candidateObjectivePoints: objectiveRate(candidate),
    candidateOpportunities: candidate.reduce((sum, match) => sum + match.opportunities, 0),
    candidateSuccessfulOutcomes: candidate.reduce(
      (sum, match) => sum + match.successfulOutcomes,
      0,
    ),
    distinctSuccessfulTrajectories: distinctSuccessfulTrajectories(candidate),
    deterministicReplaysVerified: replayVerified,
    commandRejections: candidate.reduce((sum, match) => sum + match.commandRejections, 0),
    safetyRegressions: Math.max(
      0,
      candidate.reduce((sum, match) => sum + match.selfEliminations, 0)
        - baseline.reduce((sum, match) => sum + match.selfEliminations, 0),
    ),
  } satisfies TechniqueEvaluationSummary);
  return Object.freeze({
    spec,
    baseline: Object.freeze(baseline),
    candidate: Object.freeze(candidate),
    evaluation,
    promotion: evaluateTechniquePromotion(
      spec.candidate,
      evaluation,
      "captain-supervised-codex",
    ),
  });
}
