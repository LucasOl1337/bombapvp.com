import type {
  CompetitorId,
  GameEvent,
  MatchConfig,
  MatchPhase,
  RoundOutcome,
  ScoreEntry,
} from "../../contracts.ts";
import {
  ROUND_END_MS,
  ROUND_START_MS,
  TICK_DURATION_MS,
} from "../../contracts.ts";
import type {
  ModuleSpec,
  SystemRunContext,
  SystemRunResult,
} from "../../kernel/protocol.ts";
import {
  assertSafeInteger,
  cloneOutcome,
  cloneScores,
  emptyScores,
  isGameplayActive,
  type MatchSlice,
} from "../../kernel/world-state.ts";
import { roundSeedFor } from "../../match-config.ts";

/**
 * Owns the round clock, phases, outcomes, and scoreboard. Multi-owner resets
 * coordinate through facts; this module never writes foreign slices.
 */
const MODULE_VERSION = "2.1.1";

function assertTickAligned(value: number, label: string): void {
  if (value % TICK_DURATION_MS !== 0) {
    throw new Error(`${label} must be a multiple of ${TICK_DURATION_MS} ms.`);
  }
}

function freezeMatch(slice: MatchSlice): MatchSlice {
  return Object.freeze({
    phase: slice.phase,
    roundNumber: slice.roundNumber,
    phaseRemainingMs: slice.phaseRemainingMs,
    roundElapsedMs: slice.roundElapsedMs,
    roundRemainingMs: slice.roundRemainingMs,
    suddenDeathElapsedMs: slice.suddenDeathElapsedMs,
    scores: cloneScores(slice.scores),
    roundOutcome: slice.roundOutcome ? cloneOutcome(slice.roundOutcome) : null,
    matchWinner: slice.matchWinner,
  });
}

function withScores(
  scores: readonly ScoreEntry[],
  winner: CompetitorId,
): readonly ScoreEntry[] {
  return Object.freeze(
    scores.map((entry) =>
      entry.competitorId === winner
        ? Object.freeze({ competitorId: entry.competitorId, wins: entry.wins + 1 })
        : Object.freeze({ competitorId: entry.competitorId, wins: entry.wins }),
    ),
  );
}

function findFirstToK(
  scores: readonly ScoreEntry[],
  target: number,
): CompetitorId | null {
  for (const entry of scores) {
    if (entry.wins >= target) return entry.competitorId;
  }
  return null;
}

function assertNonNegativeSafeInteger(value: unknown, label: string): number {
  const n = assertSafeInteger(value, label);
  if (n < 0) {
    throw new Error(`${label} must be an integer >= 0.`);
  }
  return n;
}

/**
 * cycle phase: Match is the sole coordinator of phase boundaries that need
 * multi-owner reset or playing-open arming. Emits facts; never writes foreign slices.
 *
 * Boundary semantics:
 * - round-start: 59 ticks remain round-start; 60th opens playing.
 * - round-over: 79 ticks remain round-over; 80th advances or match-over.
 */
function runCycle(ctx: SystemRunContext): SystemRunResult {
  const match = ctx.read("match");

  if (match.phase === "round-start") {
    const nextRemaining = match.phaseRemainingMs - TICK_DURATION_MS;
    if (nextRemaining > 0) {
      return {
        writes: {
          match: freezeMatch({
            ...match,
            phaseRemainingMs: nextRemaining,
          }),
        },
      };
    }
    // Open playing on this tick (boundary).
    const events: GameEvent[] = [
      Object.freeze({
        type: "round-became-playable" as const,
        roundNumber: match.roundNumber,
      }),
    ];
    return {
      writes: {
        match: freezeMatch({
          ...match,
          phase: "playing",
          phaseRemainingMs: 0,
          // Competitive clock still at zero until timer runs this tick.
          roundElapsedMs: 0,
          roundRemainingMs: ctx.config.roundDurationMs,
          suddenDeathElapsedMs: 0,
          roundOutcome: null,
        }),
      },
      facts: [
        Object.freeze({
          kind: "spawn-protection-arm" as const,
          roundNumber: match.roundNumber,
        }),
      ],
      events,
    };
  }

  if (match.phase === "round-over") {
    const nextRemaining = match.phaseRemainingMs - TICK_DURATION_MS;
    if (nextRemaining > 0) {
      return {
        writes: {
          match: freezeMatch({
            ...match,
            phaseRemainingMs: nextRemaining,
          }),
        },
      };
    }

    // Interval complete: match-over if first-to-K, else next round + reset fact.
    const champion = findFirstToK(match.scores, ctx.config.targetRoundWins);
    if (champion) {
      const events: GameEvent[] = [
        Object.freeze({
          type: "match-ended" as const,
          winner: champion,
          scores: cloneScores(match.scores),
        }),
      ];
      return {
        writes: {
          match: freezeMatch({
            ...match,
            phase: "match-over",
            phaseRemainingMs: 0,
            matchWinner: champion,
          }),
        },
        events,
      };
    }

    const nextRound = match.roundNumber + 1;
    const seed = roundSeedFor(ctx.config.seed, nextRound);
    const events: GameEvent[] = [
      Object.freeze({
        type: "round-started" as const,
        roundNumber: nextRound,
        roundSeed: seed,
      }),
    ];
    return {
      writes: {
        match: freezeMatch({
          phase: "round-start",
          roundNumber: nextRound,
          phaseRemainingMs: ROUND_START_MS,
          roundElapsedMs: 0,
          roundRemainingMs: ctx.config.roundDurationMs,
          suddenDeathElapsedMs: 0,
          scores: match.scores,
          roundOutcome: null,
          matchWinner: null,
        }),
      },
      facts: [
        Object.freeze({
          kind: "round-reset" as const,
          roundNumber: nextRound,
          roundSeed: seed,
        }),
      ],
      events,
    };
  }

  // playing / sudden-death / match-over: cycle is idle.
  return {};
}

/**
 * Competitive clock. Also transitions playing → sudden-death on remaining=0
 * in the same tick (before damage), so protection can be zeroed for hazards.
 */
function runTimer(ctx: SystemRunContext): SystemRunResult {
  const match = ctx.read("match");

  if (match.phase === "playing") {
    const roundElapsedMs = match.roundElapsedMs + TICK_DURATION_MS;
    const roundRemainingMs = Math.max(0, ctx.config.roundDurationMs - roundElapsedMs);
    if (roundRemainingMs === 0) {
      const events: GameEvent[] = [
        Object.freeze({
          type: "sudden-death-started" as const,
          roundNumber: match.roundNumber,
        }),
      ];
      return {
        writes: {
          match: freezeMatch({
            ...match,
            phase: "sudden-death",
            phaseRemainingMs: 0,
            roundElapsedMs,
            roundRemainingMs: 0,
            suddenDeathElapsedMs: 0,
          }),
        },
        events,
      };
    }
    return {
      writes: {
        match: freezeMatch({
          ...match,
          roundElapsedMs,
          roundRemainingMs,
          phaseRemainingMs: 0,
        }),
      },
    };
  }

  if (match.phase === "sudden-death") {
    return {
      writes: {
        match: freezeMatch({
          ...match,
          suddenDeathElapsedMs: match.suddenDeathElapsedMs + TICK_DURATION_MS,
          roundRemainingMs: 0,
          phaseRemainingMs: 0,
        }),
      },
    };
  }

  return {};
}

/**
 * End-of-round by survivors only. Timeout never draws — sudden-death continues.
 * Scoring is applied once here; match-over waits for round-over interval.
 */
function runRound(ctx: SystemRunContext): SystemRunResult {
  const match = ctx.read("match");
  if (!isGameplayActive(match.phase)) {
    return {};
  }

  const vitals = ctx.read("vitals");
  const alive = vitals.entries
    .filter((entry) => entry.alive)
    .map((entry) => entry.competitorId)
    .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));

  if (alive.length > 1) {
    return {};
  }

  let outcome: RoundOutcome;
  let scores = match.scores;
  if (alive.length === 1) {
    const winner = alive[0]!;
    outcome = cloneOutcome({ reason: "elimination", winner });
    scores = withScores(match.scores, winner);
  } else {
    outcome = cloneOutcome({ reason: "double-ko", winner: null });
  }

  const events: GameEvent[] = [
    Object.freeze({
      type: "round-ended" as const,
      roundNumber: match.roundNumber,
      outcome,
      scores: cloneScores(scores),
    }),
  ];

  return {
    writes: {
      match: freezeMatch({
        ...match,
        phase: "round-over",
        phaseRemainingMs: ROUND_END_MS,
        // Freeze competitive clocks at the values from earlier phases this tick.
        roundOutcome: outcome,
        scores,
        matchWinner: null,
      }),
    },
    events,
  };
}

function initialMatch(config: MatchConfig): MatchSlice {
  return freezeMatch({
    phase: "round-start",
    roundNumber: 1,
    phaseRemainingMs: ROUND_START_MS,
    roundElapsedMs: 0,
    roundRemainingMs: config.roundDurationMs,
    suddenDeathElapsedMs: 0,
    scores: emptyScores(config),
    roundOutcome: null,
    matchWinner: null,
  });
}

const VALID_PHASES = new Set<MatchPhase>([
  "round-start",
  "playing",
  "sudden-death",
  "round-over",
  "match-over",
]);

function restoreMatch(raw: unknown, config: MatchConfig): MatchSlice {
  if (!raw || typeof raw !== "object") {
    throw new Error("slices.match must be an object.");
  }
  const matchRaw = raw as Record<string, unknown>;
  if (typeof matchRaw.phase !== "string" || !VALID_PHASES.has(matchRaw.phase as MatchPhase)) {
    throw new Error("slices.match.phase is invalid.");
  }
  const phase = matchRaw.phase as MatchPhase;
  const roundNumber = assertSafeInteger(matchRaw.roundNumber, "slices.match.roundNumber");
  if (roundNumber < 1) {
    throw new Error("slices.match.roundNumber must be an integer >= 1.");
  }
  const phaseRemainingMs = assertNonNegativeSafeInteger(
    matchRaw.phaseRemainingMs,
    "slices.match.phaseRemainingMs",
  );
  const roundElapsedMs = assertNonNegativeSafeInteger(
    matchRaw.roundElapsedMs,
    "slices.match.roundElapsedMs",
  );
  const roundRemainingMs = assertNonNegativeSafeInteger(
    matchRaw.roundRemainingMs,
    "slices.match.roundRemainingMs",
  );
  const suddenDeathElapsedMs = assertNonNegativeSafeInteger(
    matchRaw.suddenDeathElapsedMs,
    "slices.match.suddenDeathElapsedMs",
  );
  assertTickAligned(phaseRemainingMs, "slices.match.phaseRemainingMs");
  assertTickAligned(roundElapsedMs, "slices.match.roundElapsedMs");
  assertTickAligned(roundRemainingMs, "slices.match.roundRemainingMs");
  assertTickAligned(suddenDeathElapsedMs, "slices.match.suddenDeathElapsedMs");

  if (!Array.isArray(matchRaw.scores)) {
    throw new Error("slices.match.scores must be an array.");
  }
  if (matchRaw.scores.length !== config.seats.length) {
    throw new Error("slices.match.scores must cover every config seat exactly.");
  }
  const scores: ScoreEntry[] = matchRaw.scores.map((entry, index) => {
    if (!entry || typeof entry !== "object") {
      throw new Error(`slices.match.scores[${index}] is invalid.`);
    }
    const row = entry as Record<string, unknown>;
    const expectedId = config.seats[index]!.competitorId;
    if (row.competitorId !== expectedId) {
      throw new Error(
        `slices.match.scores[${index}] must follow config seat order (${expectedId}).`,
      );
    }
    const wins = assertNonNegativeSafeInteger(
      row.wins,
      `slices.match.scores[${index}].wins`,
    );
    if (wins > config.targetRoundWins) {
      throw new Error(
        `slices.match.scores[${index}].wins cannot exceed targetRoundWins.`,
      );
    }
    return Object.freeze({ competitorId: expectedId, wins });
  });

  let roundOutcome: RoundOutcome | null = null;
  if (matchRaw.roundOutcome != null) {
    if (typeof matchRaw.roundOutcome !== "object") {
      throw new Error("slices.match.roundOutcome is invalid.");
    }
    const o = matchRaw.roundOutcome as Record<string, unknown>;
    if (o.reason !== "elimination" && o.reason !== "double-ko") {
      throw new Error("slices.match.roundOutcome.reason is invalid.");
    }
    if (o.winner != null && typeof o.winner !== "string") {
      throw new Error("slices.match.roundOutcome.winner is invalid.");
    }
    roundOutcome = cloneOutcome({
      reason: o.reason,
      winner: (o.winner as RoundOutcome["winner"]) ?? null,
    });
  }

  let matchWinner: CompetitorId | null = null;
  if (matchRaw.matchWinner != null) {
    if (typeof matchRaw.matchWinner !== "string") {
      throw new Error("slices.match.matchWinner is invalid.");
    }
    matchWinner = matchRaw.matchWinner as CompetitorId;
  }

  // Reject legacy field names so old world-2 payloads fail loudly.
  if ("elapsedMs" in matchRaw || "remainingMs" in matchRaw || "outcome" in matchRaw) {
    throw new Error(
      "slices.match uses world-3 clocks (roundElapsedMs/roundRemainingMs/roundOutcome); legacy fields rejected.",
    );
  }

  if (roundElapsedMs > config.roundDurationMs) {
    throw new Error("slices.match.roundElapsedMs exceeds config.roundDurationMs.");
  }

  const expectedRemaining = Math.max(0, config.roundDurationMs - roundElapsedMs);
  if (phase === "playing" && roundRemainingMs !== expectedRemaining) {
    throw new Error("slices.match.roundRemainingMs is inconsistent with elapsed and config.");
  }
  if (phase === "sudden-death") {
    if (roundRemainingMs !== 0) {
      throw new Error("slices.match.roundRemainingMs must be 0 after competitive clock ends.");
    }
  }
  if (phase === "round-over" || phase === "match-over") {
    // Mid-round elimination freezes remaining = duration - elapsed; timeout path freezes 0.
    if (roundElapsedMs === config.roundDurationMs) {
      if (roundRemainingMs !== 0) {
        throw new Error("slices.match.roundRemainingMs must be 0 after competitive clock ends.");
      }
    } else if (roundRemainingMs !== expectedRemaining) {
      throw new Error("slices.match.roundRemainingMs is inconsistent with elapsed and config.");
    }
  }

  if (phase === "round-start") {
    if (phaseRemainingMs <= 0 || phaseRemainingMs > ROUND_START_MS) {
      throw new Error("round-start phaseRemainingMs must be in (0, ROUND_START_MS].");
    }
    if (roundElapsedMs !== 0) {
      throw new Error("round-start requires roundElapsedMs == 0.");
    }
    if (roundRemainingMs !== config.roundDurationMs) {
      throw new Error("round-start requires full roundRemainingMs.");
    }
    if (suddenDeathElapsedMs !== 0) {
      throw new Error("round-start requires suddenDeathElapsedMs == 0.");
    }
    if (roundOutcome) {
      throw new Error("round-start cannot carry roundOutcome.");
    }
    if (matchWinner) {
      throw new Error("round-start cannot carry matchWinner.");
    }
  }

  if (phase === "playing") {
    if (phaseRemainingMs !== 0) {
      throw new Error("playing requires phaseRemainingMs == 0.");
    }
    if (roundOutcome) {
      throw new Error("playing cannot carry roundOutcome.");
    }
    if (matchWinner) {
      throw new Error("playing cannot carry matchWinner.");
    }
    if (roundRemainingMs <= 0) {
      throw new Error("playing requires roundRemainingMs > 0.");
    }
    if (suddenDeathElapsedMs !== 0) {
      throw new Error("playing requires suddenDeathElapsedMs == 0.");
    }
  }

  if (phase === "sudden-death") {
    if (phaseRemainingMs !== 0) {
      throw new Error("sudden-death requires phaseRemainingMs == 0.");
    }
    if (roundRemainingMs !== 0) {
      throw new Error("sudden-death requires roundRemainingMs == 0.");
    }
    if (roundElapsedMs !== config.roundDurationMs) {
      throw new Error("sudden-death requires roundElapsedMs == roundDurationMs.");
    }
    if (roundOutcome) {
      throw new Error("sudden-death cannot carry roundOutcome.");
    }
    if (matchWinner) {
      throw new Error("sudden-death cannot carry matchWinner.");
    }
  }

  if (phase === "round-over") {
    if (!roundOutcome) {
      throw new Error("round-over requires roundOutcome.");
    }
    if (matchWinner) {
      throw new Error("round-over cannot carry matchWinner (waits for interval).");
    }
    if (phaseRemainingMs <= 0 || phaseRemainingMs > ROUND_END_MS) {
      throw new Error("round-over phaseRemainingMs must be in (0, ROUND_END_MS].");
    }
    // SD only starts once elapsed hits duration; pre-timeout terminals freeze at 0.
    if (roundElapsedMs < config.roundDurationMs && suddenDeathElapsedMs !== 0) {
      throw new Error(
        "terminal pre-timeout outcome requires suddenDeathElapsedMs == 0.",
      );
    }
  }

  if (phase === "match-over") {
    if (!matchWinner) {
      throw new Error("match-over requires matchWinner.");
    }
    if (phaseRemainingMs !== 0) {
      throw new Error("match-over requires phaseRemainingMs == 0.");
    }
    if (!roundOutcome) {
      throw new Error("match-over requires last roundOutcome.");
    }
    const scoreRow = scores.find((entry) => entry.competitorId === matchWinner);
    if (!scoreRow || scoreRow.wins < config.targetRoundWins) {
      throw new Error("matchWinner must have wins >= targetRoundWins.");
    }
    // Same terminal SD rule as round-over (match-over freezes the last outcome clocks).
    if (roundElapsedMs < config.roundDurationMs && suddenDeathElapsedMs !== 0) {
      throw new Error(
        "terminal pre-timeout outcome requires suddenDeathElapsedMs == 0.",
      );
    }
  }

  if (roundOutcome?.reason === "elimination") {
    if (roundOutcome.winner == null) {
      throw new Error("elimination outcome requires a winner.");
    }
  }
  if (roundOutcome?.reason === "double-ko") {
    if (roundOutcome.winner != null) {
      throw new Error("double-ko outcome winner must be null.");
    }
  }

  return freezeMatch({
    phase,
    roundNumber,
    phaseRemainingMs,
    roundElapsedMs,
    roundRemainingMs,
    suddenDeathElapsedMs,
    scores: Object.freeze(scores),
    roundOutcome,
    matchWinner,
  });
}


export const matchModule: ModuleSpec = Object.freeze({
  id: "match",
  version: MODULE_VERSION,
  owns: Object.freeze(["match"] as const),
  systems: Object.freeze([
    Object.freeze({
      id: "cycle-system",
      phase: "cycle" as const,
      reads: Object.freeze(["match"] as const),
      writes: Object.freeze(["match"] as const),
      run: runCycle,
    }),
    Object.freeze({
      id: "timer-system",
      phase: "timer" as const,
      reads: Object.freeze(["match"] as const),
      writes: Object.freeze(["match"] as const),
      run: runTimer,
    }),
    Object.freeze({
      id: "round-system",
      phase: "round" as const,
      reads: Object.freeze(["match", "vitals"] as const),
      writes: Object.freeze(["match"] as const),
      run: runRound,
    }),
  ]),
  codecs: Object.freeze({
    initial(config: MatchConfig) {
      return Object.freeze({ match: initialMatch(config) });
    },
    restore(rawOwned: Readonly<Partial<Record<"match", unknown>>>, config: MatchConfig) {
      return Object.freeze({ match: restoreMatch(rawOwned.match, config) });
    },
  }),
});
