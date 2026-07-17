import type { MatchScore, PlayerId, RoundOutcome } from "../Gameplay/types";
import type { LobbyMode } from "../NetCode/protocol";

export type MatchCyclePhase = "round" | "round-end" | "match-result";

export interface MatchCycleConfig {
  mode: LobbyMode;
  activePlayerIds: readonly PlayerId[];
  roundDurationMs: number;
  roundEndDelayMs: number;
  targetWins: number;
}

export type MatchCycleCommand =
  | {
      type: "finish-round";
      winner: PlayerId | null;
      reason: RoundOutcome["reason"];
    }
  | {
      type: "tick";
      deltaMs: number;
    }
  | {
      type: "set-active-players";
      activePlayerIds: readonly PlayerId[];
    };

export type MatchCycleEvent =
  | {
      type: "round-finished";
      winner: PlayerId | null;
      reason: RoundOutcome["reason"];
      clinchesMatch: boolean;
    }
  | {
      type: "round-started";
      roundNumber: number;
    }
  | {
      type: "match-finished";
      winner: PlayerId;
    }
  | {
      type: "round-timer-expired";
    };

export interface MatchCycleOutcome {
  winner: PlayerId | null;
  reason: RoundOutcome["reason"];
  countdownMs: number;
}

export interface MatchCycleSnapshot {
  phase: MatchCyclePhase;
  mode: LobbyMode;
  activePlayerIds: readonly PlayerId[];
  roundNumber: number;
  roundTimeMs: number;
  score: MatchScore;
  outcome: MatchCycleOutcome | null;
  matchWinner: PlayerId | null;
}

export type MatchCycleRestoreState = Readonly<{
  roundNumber: number;
  roundTimeMs: number;
  score: MatchScore;
  outcome: MatchCycleOutcome | null;
  matchWinner: PlayerId | null;
}>;

export interface MatchCycle {
  dispatch(command: MatchCycleCommand): MatchCycleEvent[];
  restore(state: MatchCycleRestoreState): void;
  snapshot(): MatchCycleSnapshot;
}

const createEmptyScore = (): MatchScore => ({ 1: 0, 2: 0, 3: 0, 4: 0 });

const requirePositiveFinite = (name: string, value: number): void => {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive finite number.`);
  }
};

export const createMatchCycle = (config: MatchCycleConfig): MatchCycle => {
  requirePositiveFinite("roundDurationMs", config.roundDurationMs);
  requirePositiveFinite("roundEndDelayMs", config.roundEndDelayMs);
  requirePositiveFinite("targetWins", config.targetWins);

  let activePlayerIds = [...new Set(config.activePlayerIds)];

  let phase: MatchCyclePhase = "round";
  let roundNumber = 1;
  let roundTimeMs = config.roundDurationMs;
  let score = createEmptyScore();
  let outcome: MatchCycleOutcome | null = null;
  let matchWinner: PlayerId | null = null;
  let timerExpirationEmitted = false;

  const finishRound = (
    winner: PlayerId | null,
    reason: RoundOutcome["reason"],
  ): MatchCycleEvent[] => {
    if (phase !== "round") {
      return [];
    }
    if (winner !== null && !activePlayerIds.includes(winner)) {
      throw new RangeError(`Player ${winner} is not active in this match.`);
    }

    if (winner !== null) {
      score[winner] += 1;
    }
    const clinchesMatch = config.mode === "classic"
      && winner !== null
      && score[winner] >= config.targetWins;

    phase = "round-end";
    outcome = {
      winner,
      reason,
      countdownMs: config.roundEndDelayMs,
    };

    return [{ type: "round-finished", winner, reason, clinchesMatch }];
  };

  const tick = (deltaMs: number): MatchCycleEvent[] => {
    if (!Number.isFinite(deltaMs) || deltaMs < 0) {
      throw new RangeError("deltaMs must be a non-negative finite number.");
    }
    if (phase === "round") {
      roundTimeMs = Math.max(0, roundTimeMs - deltaMs);
      if (roundTimeMs === 0 && !timerExpirationEmitted) {
        timerExpirationEmitted = true;
        return [{ type: "round-timer-expired" }];
      }
      return [];
    }
    if (phase !== "round-end" || !outcome) {
      return [];
    }

    outcome.countdownMs = Math.max(0, outcome.countdownMs - deltaMs);
    if (outcome.countdownMs > 0) {
      return [];
    }

    const winningPlayer = config.mode === "classic"
      ? activePlayerIds.find((playerId) => score[playerId] >= config.targetWins) ?? null
      : null;
    if (winningPlayer !== null) {
      matchWinner = winningPlayer;
      outcome = null;
      phase = "match-result";
      return [{ type: "match-finished", winner: winningPlayer }];
    }

    outcome = null;
    phase = "round";
    roundNumber += 1;
    roundTimeMs = config.roundDurationMs;
    timerExpirationEmitted = false;
    return [{ type: "round-started", roundNumber }];
  };

  const restore = (state: MatchCycleRestoreState): void => {
    if (!Number.isInteger(state.roundNumber) || state.roundNumber < 1) {
      throw new RangeError("roundNumber must be a positive integer.");
    }
    if (!Number.isFinite(state.roundTimeMs) || state.roundTimeMs < 0) {
      throw new RangeError("roundTimeMs must be a non-negative finite number.");
    }
    for (const playerId of [1, 2, 3, 4] as const) {
      const wins = state.score[playerId];
      if (!Number.isInteger(wins) || wins < 0) {
        throw new RangeError(`Score for player ${playerId} must be a non-negative integer.`);
      }
    }
    if (state.outcome && (!Number.isFinite(state.outcome.countdownMs) || state.outcome.countdownMs < 0)) {
      throw new RangeError("Outcome countdownMs must be a non-negative finite number.");
    }

    roundNumber = state.roundNumber;
    roundTimeMs = state.roundTimeMs;
    score = { ...state.score };
    outcome = state.outcome ? { ...state.outcome } : null;
    matchWinner = state.matchWinner;
    phase = matchWinner !== null ? "match-result" : outcome ? "round-end" : "round";
    timerExpirationEmitted = phase !== "round" || roundTimeMs === 0;
  };

  return {
    dispatch(command) {
      if (command.type === "finish-round") {
        return finishRound(command.winner, command.reason);
      }
      if (command.type === "set-active-players") {
        activePlayerIds = [...new Set(command.activePlayerIds)];
        return [];
      }
      return tick(command.deltaMs);
    },
    restore,
    snapshot() {
      return {
        phase,
        mode: config.mode,
        activePlayerIds: [...activePlayerIds],
        roundNumber,
        roundTimeMs,
        score: { ...score },
        outcome: outcome ? { ...outcome } : null,
        matchWinner,
      };
    },
  };
};
