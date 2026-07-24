import { describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { CHAMPION_MEMBERSHIP, type ChampionSlug } from "../../Champions/membership.ts";
import { BOT_MODELS } from "../content/bot-mastery/catalog.ts";
import { createJsonlExperienceSink } from "../src/browser/bot-mastery/node-jsonl-store.ts";
import {
  DEFAULT_PROMOTION_GATE,
  applyTechniqueCuration,
  createInMemoryExperienceSink,
  currentTechniqueCompatibility,
  decayedTechniqueConfidence,
  evaluateTechniquePromotion,
  selectTechniquePortfolio,
  selectTechnique,
  validateActiveTechnique,
  validateBotModel,
  validateTechniqueCandidate,
  type TechniqueCandidate,
  type TechniquePredicate,
} from "../src/browser/bot-mastery/index.ts";
import {
  createBrowserBotDrivers,
  driveBrowserBotsForTick,
  recordBrowserBotTickOutcome,
} from "../src/browser/bot-drivers.ts";
import { createBrowserMatchConfiguration } from "../src/browser/match-mode.ts";
import type {
  CompetitorId,
  GameSnapshot,
  SkillId,
  TileCoord,
} from "../src/contracts.ts";
import { createGameMechanics } from "../src/game-mechanics.ts";
import { createLocalDuel1v1MatchConfig, createMatchConfig } from "../src/match-config.ts";
import { ROUND_START_MS, tileCenter } from "../src/index.ts";

function candidate(
  slug: ChampionSlug,
  id: string,
  predicate: TechniquePredicate,
): TechniqueCandidate {
  return Object.freeze({
    schemaVersion: 1,
    id,
    status: "candidate",
    compatibility: currentTechniqueCompatibility(slug),
    provenance: Object.freeze({
      kind: "authored-hypothesis",
      hypothesisId: `${id}.hypothesis`,
      proposedBy: "captain-supervised-codex",
      sourceEventIds: Object.freeze([]),
    }),
    condition: Object.freeze({ all: Object.freeze([predicate]) }),
    action: Object.freeze({ kind: "use-skill" }),
    proposedPriority: 700,
  });
}

function tacticalSnapshot(
  slug: ChampionSlug,
  selfTile: TileCoord,
  opponentTile: TileCoord,
  danger = false,
): GameSnapshot {
  const base = createLocalDuel1v1MatchConfig({ roundDurationMs: 5_000, targetRoundWins: 1 });
  const config = createMatchConfig({
    ...base,
    seats: base.seats.map((seat, index) => ({
      ...seat,
      skillId: index === 0
        ? CHAMPION_MEMBERSHIP[slug].skillId
        : CHAMPION_MEMBERSHIP.ranni.skillId,
    })),
  });
  const snapshot = createGameMechanics(config).snapshot();
  const self = snapshot.competitors[0]!;
  const opponent = snapshot.competitors[1]!;
  return Object.freeze({
    ...snapshot,
    phase: "playing",
    arena: Object.freeze({
      ...snapshot.arena,
      solid: Object.freeze([]),
      crates: Object.freeze([]),
    }),
    competitors: Object.freeze([
      Object.freeze({
        ...self,
        tile: Object.freeze({ ...selfTile }),
        position: tileCenter(selfTile),
        skill: Object.freeze({
          id: CHAMPION_MEMBERSHIP[slug].skillId as SkillId,
          phase: "idle",
          cooldownRemainingMs: 0,
          channelRemainingMs: 0,
          projection: null,
          aimDirection: "right",
        }),
      }),
      Object.freeze({
        ...opponent,
        tile: Object.freeze({ ...opponentTile }),
        position: tileCenter(opponentTile),
      }),
    ]),
    bombs: danger
      ? Object.freeze([Object.freeze({
          id: 1,
          ownerId: opponent.id,
          tile: Object.freeze({ ...selfTile }),
          fuseMs: 1_000,
          flameRange: 2,
          echo: false,
        })])
      : Object.freeze([]),
  });
}

describe("private bot mastery models", () => {
  it("validates every file-backed identity and keeps one private initial mastery per approved Champion", () => {
    expect(BOT_MODELS.map(({ identity }) => identity.id)).toEqual(["bomb", "pingo", "v1", "v2", "v3"]);
    for (const model of BOT_MODELS) expect(validateBotModel(model)).toMatchObject({ valid: true });
    expect(BOT_MODELS.flatMap((model) => Object.keys(model.mastery)).sort()).toEqual([
      "crocodilo-arcano",
      "killer-bee",
      "ranni",
      "thresh",
    ]);
    expect(BOT_MODELS.flatMap((model) =>
      Object.values(model.mastery).flatMap((mastery) => mastery?.techniques.map(({ id }) => id) ?? [])))
      .toEqual(["ranni.danger-blink.v1"]);
  });

  it("rejects executable/unknown data and stale compatibility instead of running it", () => {
    const draft = candidate("thresh", "thresh.aligned-hook.v1", {
      kind: "opponent-aligned",
      maxTiles: 4,
      clearPath: true,
    });
    const executable = { ...draft, run: () => "use-skill" };
    expect(validateTechniqueCandidate(executable).issues).toContain(
      "technique contains unsupported key \"run\".",
    );
    expect(validateTechniqueCandidate(executable).issues).toContain(
      "technique.run must contain only plain declarative data.",
    );

    const stale = {
      ...draft,
      compatibility: { ...draft.compatibility, mechanicsRevision: "mechanics-old" },
    };
    expect(validateTechniqueCandidate(stale).issues).toContain(
      "technique.compatibility.mechanicsRevision is stale or incompatible (expected mechanics-v8).",
    );
  });

  it("quarantines a stale private model and leaves the baseline driver usable", () => {
    const current = BOT_MODELS.find(({ identity }) => identity.id === "bomb")!;
    const ranni = current.mastery.ranni!;
    const staleModel = {
      ...current,
      mastery: {
        ...current.mastery,
        ranni: {
          ...ranni,
          techniques: ranni.techniques.map((technique) => ({
            ...technique,
            compatibility: { ...technique.compatibility, gameVersion: "kernel-stale" },
          })),
        },
      },
    } as unknown as typeof current;
    const configuration = createBrowserMatchConfiguration({
      mode: "bot-training",
      champion1: "ranni",
      champion2: "ranni",
      bot2: "bomb",
    });
    const config = createLocalDuel1v1MatchConfig({ seed: "stale-model-fallback" });
    const drivers = createBrowserBotDrivers(configuration, config, {
      modelRepository: { get: () => staleModel },
    });
    expect(drivers[0]).toMatchObject({ model: null, techniques: [], masteryBasisPoints: 0 });
    expect(drivers[0]?.compatibilityWarnings.some((issue) => issue.includes("gameVersion"))).toBe(
      true,
    );
    expect(() => driveBrowserBotsForTick(createGameMechanics(config).snapshot(), drivers)).not.toThrow();
  });
});

describe("declarative runtime consumption", () => {
  it.each([
    ["ranni", "ranni.danger-blink.v1", { kind: "self-in-danger" }, { x: 1, y: 1 }, { x: 7, y: 7 }, true],
    ["killer-bee", "killer-bee.aligned-dash.v1", { kind: "opponent-aligned", maxTiles: 3, clearPath: true }, { x: 1, y: 1 }, { x: 3, y: 1 }, false],
    ["crocodilo-arcano", "crocodilo.close-surge.v1", { kind: "opponent-within", radius: 2 }, { x: 1, y: 1 }, { x: 2, y: 2 }, false],
    ["thresh", "thresh.aligned-hook.v1", { kind: "opponent-aligned", maxTiles: 4, clearPath: true }, { x: 1, y: 1 }, { x: 4, y: 1 }, false],
  ] as const)("selects the closed %s technique and emits only an ordinary command", (
    slug,
    id,
    predicate,
    selfTile,
    opponentTile,
    danger,
  ) => {
    const snapshot = tacticalSnapshot(slug, selfTile, opponentTile, danger);
    const technique = candidate(slug, id, predicate);
    const selfId = snapshot.competitors[0]!.id;
    const selection = selectTechnique(snapshot, selfId, slug, [technique], []);
    expect(selection).toMatchObject({
      eligibleTechniqueIds: [id],
      selectedTechniqueId: id,
      additionalCommands: [{ type: "use-skill", competitorId: selfId }],
    });
  });

  it("does not replace an already-issued skill command", () => {
    const snapshot = tacticalSnapshot("ranni", { x: 1, y: 1 }, { x: 7, y: 7 }, true);
    const selfId = snapshot.competitors[0]!.id;
    const technique = candidate("ranni", "ranni.danger-blink.v1", { kind: "self-in-danger" });
    const selection = selectTechnique(
      snapshot,
      selfId,
      "ranni",
      [technique],
      [{ type: "use-skill", competitorId: selfId }],
    );
    expect(selection?.eligibleTechniqueIds).toEqual([technique.id]);
    expect(selection?.selectedTechniqueId).toBeNull();
    expect(selection?.additionalCommands).toEqual([]);
  });
});

describe("append-only observation and deterministic promotion", () => {
  it("records a structured decision without changing same-seed commands", () => {
    const configuration = createBrowserMatchConfiguration({
      mode: "bot-lab",
      champion1: "ranni",
      champion2: "killer-bee",
      bot1: "bomb",
      bot2: "v3",
    });
    const base = createLocalDuel1v1MatchConfig({ seed: "mastery-recording", targetRoundWins: 1 });
    const config = createMatchConfig({
      ...base,
      seats: base.seats.map((seat, index) => ({
        ...seat,
        skillId: CHAMPION_MEMBERSHIP[configuration.players[index]!.championSlug].skillId,
      })),
    });
    const evaluation = candidate("ranni", "ranni.observe-nearby.v1", {
      kind: "opponent-within",
      radius: 16,
    });

    const run = () => {
      const game = createGameMechanics(config);
      const sink = createInMemoryExperienceSink();
      const drivers = createBrowserBotDrivers(configuration, config, {
        experienceSink: sink,
        recordExperience: true,
        evaluationCandidates: { 0: [evaluation] },
      });
      game.dispatch({ type: "advance", deltaMs: ROUND_START_MS });
      const reports = driveBrowserBotsForTick(game.snapshot(), drivers);
      const final = Object.freeze({
        ...game.snapshot(),
        phase: "match-over" as const,
        matchWinner: config.seats[0]!.competitorId,
      });
      recordBrowserBotTickOutcome(final, drivers, [Object.freeze({
        type: "match-ended" as const,
        winner: config.seats[0]!.competitorId,
        scores: final.scores,
      })], []);
      return { reports, events: sink.events() };
    };
    const first = run();
    const replay = run();
    expect(replay).toEqual(first);
    expect(first.events).toHaveLength(4);
    expect(first.events[0]).toMatchObject({
      type: "bot-decision-observed",
      actor: { botId: "bomb", modelVersion: "bomb-mastery-v1", championSlug: "ranni" },
      selectedTechniqueId: evaluation.id,
    });
    expect(first.reports[0]?.commands.some(({ type }) => type === "use-skill")).toBe(true);
    expect(first.events.filter(({ type }) => type === "bot-match-completed")).toHaveLength(2);

    const directory = mkdtempSync(join(tmpdir(), "bombpvp-mastery-jsonl-"));
    const target = join(directory, "run.jsonl");
    try {
      const fileSink = createJsonlExperienceSink(target);
      first.events.slice(0, 2).forEach((event) => fileSink.append(event));
      const lines = readFileSync(target, "utf8").trim().split("\n");
      expect(lines).toHaveLength(2);
      expect(lines.map((line) => JSON.parse(line))).toEqual(first.events.slice(0, 2));
    } finally {
      rmSync(directory, { recursive: true });
    }
  });

  it("promotes sufficient paired evidence and preserves failed candidates as rejected decisions", () => {
    const draft = candidate("thresh", "thresh.aligned-hook.v1", {
      kind: "opponent-aligned",
      maxTiles: 4,
      clearPath: true,
    });
    const evidence = {
      campaignId: "thresh-campaign-v1",
      candidateId: draft.id,
      seedManifest: Object.freeze(Array.from({ length: 12 }, (_, index) => `thresh-seed-${index + 1}`)),
      baselineMatches: 12,
      candidateMatches: 12,
      baselineWins: 4,
      candidateWins: 6,
      baselineObjectivePoints: 4_000,
      candidateObjectivePoints: 6_000,
      candidateOpportunities: 12,
      candidateSuccessfulOutcomes: 8,
      distinctSuccessfulTrajectories: 3,
      deterministicReplaysVerified: true,
      commandRejections: 0,
      safetyRegressions: 0,
    } as const;
    const promoted = evaluateTechniquePromotion(draft, evidence, "captain-supervised-codex");
    expect(promoted).toMatchObject({ accepted: true, technique: { status: "active" } });
    if (promoted.accepted) {
      expect(validateActiveTechnique(promoted.technique)).toMatchObject({ valid: true });
      expect(decayedTechniqueConfidence(promoted.technique, 3)).toBe(
        promoted.technique.score.confidenceBasisPoints - 500,
      );
    }

    const rejected = evaluateTechniquePromotion(
      draft,
      { ...evidence, candidateWins: 4, candidateObjectivePoints: 4_000 },
      "captain-supervised-codex",
      DEFAULT_PROMOTION_GATE,
    );
    expect(rejected).toMatchObject({ accepted: false, technique: null });
    expect(rejected.reasons).toContain(
      "Evidence misses both improvement gates (win 0bp, objective 0bp).",
    );

    const closeDraft = candidate("thresh", "thresh.close-hook.v1", {
      kind: "opponent-within",
      radius: 1,
    });
    const closeEvidence = {
      ...evidence,
      campaignId: "thresh-close-campaign-v1",
      candidateId: closeDraft.id,
      candidateObjectivePoints: 5_500,
    };
    const closePromotion = evaluateTechniquePromotion(
      closeDraft,
      closeEvidence,
      "captain-supervised-codex",
    );
    const portfolio = selectTechniquePortfolio([
      { candidate: draft, evaluation: evidence, promotion: promoted },
      { candidate: closeDraft, evaluation: closeEvidence, promotion: closePromotion },
    ]);
    expect(portfolio).toMatchObject([
      { candidateId: draft.id, accepted: true },
      { candidateId: closeDraft.id, accepted: false, technique: null },
    ]);
    const curated = applyTechniqueCuration(portfolio, [
      {
        candidateId: draft.id,
        reviewer: "xhigh-review",
        approved: false,
        rationale: "Direct ability outcome was not causally established.",
      },
      {
        candidateId: closeDraft.id,
        reviewer: "xhigh-review",
        approved: false,
        rationale: "Portfolio evidence was weaker.",
      },
    ]);
    expect(curated.every(({ accepted, technique }) => !accepted && technique === null)).toBe(true);
  });
});
