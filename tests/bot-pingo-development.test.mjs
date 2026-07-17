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

describe("Pingo contra a fuga contínua do Bomb v3", () => {
  it("não fica preso numa casa adjacente que já começou a fechar no sudden death", () => {
    const outcome = playAdversarialMatch({
      seed: "bomb-pingo-post-egress-dev-a:standard:7",
      arenaVariant: "standard",
      characterIndex: 0,
      policies,
      spawnOrder: ["Pingo", "Bomb"],
    });

    expect(outcome.metrics.Pingo.selfDeaths).toBe(0);
    expect(outcome.metrics.Pingo.longestStuckMs).toBeLessThan(5_000);
  }, 30_000);

  it.each([
    ["pingo-v3-dev-b:standard:8", { x: 1, y: 7 }],
    ["pingo-v3-dev-b:standard:9", { x: 9, y: 7 }],
  ])("não se autoelimina no replay %s", (seed, expectedSpawn) => {
    const outcome = playAdversarialMatch({
      seed,
      arenaVariant: "standard",
      characterIndex: 0,
      policies,
      spawnOrder: ["Bomb", "Pingo"],
    });

    expect(outcome.spawnTiles.Pingo).toEqual(expectedSpawn);
    expect(outcome.metrics.Pingo.selfDeaths).toBe(0);
  }, 30_000);

  it("rompe a oscilação da projeção Ranni no choke sparse dev-c", () => {
    const outcome = playAdversarialMatch({
      seed: "pingo-v3-dev-c:sparse-breakables:6",
      arenaVariant: "sparse-breakables",
      characterIndex: 0,
      policies,
      spawnOrder: ["Pingo", "Bomb"],
    });

    expect(outcome.metrics.Pingo.selfDeaths).toBe(0);
    expect(outcome.durationMs).toBeGreaterThan(7_750);
  }, 30_000);

  it("sai da bomba rival criada sobre a projeção Ranni no open dev-c", () => {
    const outcome = playAdversarialMatch({
      seed: "pingo-v3-dev-c:open-no-drops:10",
      arenaVariant: "open-no-drops",
      characterIndex: 0,
      policies,
      spawnOrder: ["Bomb", "Pingo"],
    });

    expect(outcome.metrics.Pingo.selfDeaths).toBe(0);
    expect(outcome.durationMs).toBeGreaterThan(4_450);
  }, 30_000);
});

describe("Pingo nas falhas development após body-egress", () => {
  it("usa o portal inferior para escapar da bomba rival no open", () => {
    const outcome = playAdversarialMatch({
      seed: "pingo-v3-body-egress-dev-a:open-no-drops:1",
      arenaVariant: "open-no-drops",
      characterIndex: 0,
      policies,
      spawnOrder: ["Pingo", "Bomb"],
    });

    expect(outcome.metrics.Pingo.selfDeaths).toBe(0);
    expect(outcome.durationMs).toBeGreaterThan(24_000);
  }, 30_000);

  it("preserva a vitória segura no choke sparse separado", () => {
    const outcome = playAdversarialMatch({
      seed: "pingo-v3-body-egress-dev-a:sparse-breakables:5",
      arenaVariant: "sparse-breakables",
      characterIndex: 0,
      policies,
      spawnOrder: ["Pingo", "Bomb"],
    });

    expect(outcome.metrics.Pingo.selfDeaths).toBe(0);
    expect(outcome.winner).toBe("Pingo");
  }, 30_000);
});
