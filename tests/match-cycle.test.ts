import { describe, expect, it } from "vitest";
import { createMatchCycle } from "../src/original-game/Engine/match-cycle.ts";

describe("ciclo autoritativo da partida", () => {
  it("encerra uma partida classic quando um jogador conquista a segunda rodada", () => {
    const cycle = createMatchCycle({
      mode: "classic",
      activePlayerIds: [1, 2],
      roundDurationMs: 90_000,
      roundEndDelayMs: 1_600,
      targetWins: 2,
    });

    expect(cycle.dispatch({
      type: "finish-round",
      winner: 1,
      reason: "elimination",
    })).toEqual([
      { type: "round-finished", winner: 1, reason: "elimination", clinchesMatch: false },
    ]);
    expect(cycle.snapshot()).toMatchObject({
      phase: "round-end",
      roundNumber: 1,
      score: { 1: 1, 2: 0, 3: 0, 4: 0 },
      outcome: { winner: 1, reason: "elimination", countdownMs: 1_600 },
    });

    expect(cycle.dispatch({ type: "tick", deltaMs: 1_600 })).toEqual([
      { type: "round-started", roundNumber: 2 },
    ]);

    cycle.dispatch({ type: "finish-round", winner: 1, reason: "elimination" });
    expect(cycle.dispatch({ type: "tick", deltaMs: 1_600 })).toEqual([
      { type: "match-finished", winner: 1 },
    ]);
    expect(cycle.snapshot()).toMatchObject({
      phase: "match-result",
      roundNumber: 2,
      matchWinner: 1,
      score: { 1: 2, 2: 0, 3: 0, 4: 0 },
      outcome: null,
    });
  });

  it("emite o vencimento do cronometro uma unica vez e aguarda o resultado calculado pela simulacao", () => {
    const cycle = createMatchCycle({
      mode: "classic",
      activePlayerIds: [1, 2],
      roundDurationMs: 1_000,
      roundEndDelayMs: 250,
      targetWins: 2,
    });

    expect(cycle.dispatch({ type: "tick", deltaMs: 999 })).toEqual([]);
    expect(cycle.dispatch({ type: "tick", deltaMs: 1 })).toEqual([
      { type: "round-timer-expired" },
    ]);
    expect(cycle.dispatch({ type: "tick", deltaMs: 50 })).toEqual([]);
    expect(cycle.snapshot()).toMatchObject({
      phase: "round",
      roundTimeMs: 0,
    });

    expect(cycle.dispatch({ type: "finish-round", winner: null, reason: "timer" })).toEqual([
      { type: "round-finished", winner: null, reason: "timer", clinchesMatch: false },
    ]);
  });

  it("restaura um snapshot autoritativo sem compartilhar referencias mutaveis", () => {
    const cycle = createMatchCycle({
      mode: "endless",
      activePlayerIds: [1, 2, 3],
      roundDurationMs: 90_000,
      roundEndDelayMs: 1_600,
      targetWins: 2,
    });
    const score = { 1: 3, 2: 1, 3: 2, 4: 0 };

    cycle.restore({
      roundNumber: 7,
      roundTimeMs: 12_500,
      score,
      outcome: { winner: 3, reason: "elimination", countdownMs: 400 },
      matchWinner: null,
    });
    score[3] = 99;

    expect(cycle.snapshot()).toMatchObject({
      phase: "round-end",
      roundNumber: 7,
      roundTimeMs: 12_500,
      score: { 1: 3, 2: 1, 3: 2, 4: 0 },
      outcome: { winner: 3, reason: "elimination", countdownMs: 400 },
      matchWinner: null,
    });
    expect(cycle.dispatch({ type: "tick", deltaMs: 400 })).toEqual([
      { type: "round-started", roundNumber: 8 },
    ]);
  });

  it("mantem o vencedor historico mas nao coroa quem saiu durante o countdown", () => {
    const cycle = createMatchCycle({
      mode: "classic",
      activePlayerIds: [1, 2],
      roundDurationMs: 90_000,
      roundEndDelayMs: 1_600,
      targetWins: 1,
    });

    cycle.dispatch({ type: "finish-round", winner: 1, reason: "elimination" });
    expect(cycle.dispatch({ type: "set-active-players", activePlayerIds: [2] })).toEqual([]);
    expect(cycle.snapshot()).toMatchObject({
      activePlayerIds: [2],
      outcome: { winner: 1 },
    });
    expect(cycle.dispatch({ type: "tick", deltaMs: 1_600 })).toEqual([
      { type: "round-started", roundNumber: 2 },
    ]);
    expect(cycle.snapshot()).toMatchObject({
      phase: "round",
      activePlayerIds: [2],
      matchWinner: null,
    });
  });

  it("restaura identidades historicas que ja nao estao no roster atual", () => {
    const cycle = createMatchCycle({
      mode: "classic",
      activePlayerIds: [2],
      roundDurationMs: 90_000,
      roundEndDelayMs: 1_600,
      targetWins: 2,
    });

    expect(() => cycle.restore({
      roundNumber: 2,
      roundTimeMs: 80_000,
      score: { 1: 2, 2: 0, 3: 0, 4: 0 },
      outcome: { winner: 1, reason: "elimination", countdownMs: 800 },
      matchWinner: null,
    })).not.toThrow();
    expect(cycle.snapshot().outcome?.winner).toBe(1);

    expect(() => cycle.restore({
      roundNumber: 2,
      roundTimeMs: 80_000,
      score: { 1: 2, 2: 0, 3: 0, 4: 0 },
      outcome: null,
      matchWinner: 1,
    })).not.toThrow();
    expect(cycle.snapshot().matchWinner).toBe(1);
  });
});
