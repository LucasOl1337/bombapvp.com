// @vitest-environment node

import { describe, expect, it } from "vitest";
import { getBombDecision } from "../src/original-game/Engine/bot-bomb.ts";
import { getBotPingoDecision } from "../src/original-game/Engine/bot-pingo.ts";
import { playAdversarialMatch } from "./support/adversarial-bot-league.mjs";

const policies = { Bomb: getBombDecision, Pingo: getBotPingoDecision };

function play(seed, arenaVariant, spawnOrder) {
  return playAdversarialMatch({
    seed: `bomb-pingo-dev-v0:${arenaVariant}:${seed}`,
    arenaVariant,
    characterIndex: 0,
    policies,
    spawnOrder,
  });
}

describe("Pingo nas falhas do lote development-v0-final", () => {
  it("não se autoelimina nos sete replays sparse conhecidos", () => {
    const cases = [
      [0, ["Bomb", "Pingo"]],
      [1, ["Pingo", "Bomb"]],
      [2, ["Bomb", "Pingo"]],
      [2, ["Pingo", "Bomb"]],
      [3, ["Pingo", "Bomb"]],
      [5, ["Bomb", "Pingo"]],
      [10, ["Bomb", "Pingo"]],
    ];
    const outcomes = cases.map(([seed, spawnOrder]) => play(seed, "sparse-breakables", spawnOrder));

    expect(outcomes.map((outcome) => ({
      seed: outcome.seed,
      spawnOrder: outcome.spawnOrder,
      selfDeaths: outcome.metrics.Pingo.selfDeaths,
    }))).toEqual(cases.map(([seed, spawnOrder]) => ({
      seed: `bomb-pingo-dev-v0:sparse-breakables:${seed}`,
      spawnOrder,
      selfDeaths: 0,
    })));
  }, 30_000);

  it("não se autoelimina nas três descobertas da matriz development v1", () => {
    const cases = [
      [5, "standard", ["Bomb", "Pingo"]],
      [10, "open-no-drops", ["Bomb", "Pingo"]],
      [3, "sparse-breakables", ["Bomb", "Pingo"]],
    ];
    const outcomes = cases.map(([seed, arenaVariant, spawnOrder]) => (
      play(seed, arenaVariant, spawnOrder)
    ));

    expect(outcomes.map((outcome) => outcome.metrics.Pingo.selfDeaths)).toEqual([0, 0, 0]);
  }, 30_000);

  it("age no standard em vez de permanecer ocioso durante a partida", () => {
    const outcomes = [
      play(0, "standard", ["Bomb", "Pingo"]),
      play(0, "standard", ["Pingo", "Bomb"]),
    ];

    for (const outcome of outcomes) {
      expect(outcome.metrics.Pingo.idleMs).toBeLessThan(outcome.durationMs * 0.75);
    }
  }, 30_000);
});

describe("Pingo nas autoeliminações pós-hotfix da Ranni", () => {
  it("não detona enquanto a hitbox ainda sobrepõe a explosão no standard dev-b", () => {
    const outcome = playAdversarialMatch({
      seed: "pingo-v2-postfix-dev-b:standard:1",
      arenaVariant: "standard",
      characterIndex: 0,
      policies,
      spawnOrder: ["Pingo", "Bomb"],
    });

    expect(outcome.metrics.Pingo.selfDeaths).toBe(0);
  }, 30_000);

  it("encerra a fase numa projeção segura antes da própria explosão no sparse dev-c", () => {
    const outcome = playAdversarialMatch({
      seed: "pingo-v2-postfix-dev-c:sparse-breakables:4",
      arenaVariant: "sparse-breakables",
      characterIndex: 0,
      policies,
      spawnOrder: ["Pingo", "Bomb"],
    });

    expect(outcome.metrics.Pingo.selfDeaths).toBe(0);
  }, 30_000);
});
