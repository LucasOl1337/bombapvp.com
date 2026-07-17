// @vitest-environment node

import { describe, expect, it } from "vitest";
import { getBombDecision } from "../src/original-game/Engine/bot-bomb.ts";
import { getBotPingoDecision } from "../src/original-game/Engine/bot-pingo.ts";
import {
  runMirroredSeries,
  summarizeSeries,
} from "./support/adversarial-bot-league.mjs";

const VARIANTS = ["standard", "open-no-drops", "sparse-breakables"];

describe("liga adversarial Bomb vs Pingo", () => {
  it("executa o lote de desenvolvimento com lados espelhados e telemetria integral", () => {
    const cases = VARIANTS.flatMap((arenaVariant) => (
      Array.from({ length: 12 }, (_, index) => ({
        arenaVariant,
        seed: `bomb-pingo-development-v1-final:${arenaVariant}:${index}`,
      }))
    ));
    const policies = { Bomb: getBombDecision, Pingo: getBotPingoDecision };
    const outcomes = runMirroredSeries({ policies, cases });
    const summary = summarizeSeries(outcomes, Object.keys(policies));
    const byVariant = Object.fromEntries(VARIANTS.map((arenaVariant) => [
      arenaVariant,
      summarizeSeries(
        outcomes.filter((outcome) => outcome.arenaVariant === arenaVariant),
        Object.keys(policies),
      ),
    ]));
    const deathCauses = Object.fromEntries(Object.keys(policies).map((identity) => [
      identity,
      outcomes.reduce((counts, outcome) => {
        const cause = outcome.metrics[identity].deathCause ?? "none";
        counts[cause] = (counts[cause] ?? 0) + 1;
        return counts;
      }, {}),
    ]));
    const matches = outcomes.map((outcome) => ({
      seed: outcome.seed,
      arenaVariant: outcome.arenaVariant,
      spawnOrder: outcome.spawnOrder,
      spawnTiles: outcome.spawnTiles,
      winner: outcome.winner,
      durationMs: outcome.durationMs,
      deaths: Object.fromEntries(Object.entries(outcome.metrics).map(([identity, metrics]) => [
        identity,
        metrics.deathCause,
      ])),
    }));

    const report = { suite: "development-v1-final", summary, byVariant, deathCauses, matches };
    const output = process.env.BOT_LEAGUE_COMPACT
      ? { suite: report.suite, summary, byVariant, deathCauses }
      : report;
    console.log(JSON.stringify(output, null, 2));
    expect(outcomes).toHaveLength(72);
    for (const arenaVariant of VARIANTS) {
      const variantOutcomes = outcomes.filter((outcome) => outcome.arenaVariant === arenaVariant);
      expect(variantOutcomes).toHaveLength(24);
      expect(variantOutcomes.filter((outcome) => outcome.spawnOrder[0] === "Bomb")).toHaveLength(12);
      expect(variantOutcomes.filter((outcome) => outcome.spawnOrder[0] === "Pingo")).toHaveLength(12);
    }
    expect(outcomes.every((outcome) => outcome.characterIndex === 0)).toBe(true);
    expect(new Set(outcomes.flatMap((outcome) => (
      Object.values(outcome.spawnTiles).map((tile) => `${tile.x},${tile.y}`)
    ))).size).toBe(4);
    for (let index = 0; index < outcomes.length; index += 2) {
      expect(outcomes[index].seed).toBe(outcomes[index + 1].seed);
      expect(outcomes[index].spawnTiles.Bomb).toEqual(outcomes[index + 1].spawnTiles.Pingo);
      expect(outcomes[index].spawnTiles.Pingo).toEqual(outcomes[index + 1].spawnTiles.Bomb);
    }
    expect(outcomes.every((outcome) => outcome.metrics.Bomb.decisions > 0)).toBe(true);
    expect(outcomes.every((outcome) => outcome.metrics.Pingo.decisions > 0)).toBe(true);
    expect(summary.Bomb.selfDeaths).toBe(0);
    expect(summary.Pingo.selfDeaths).toBe(0);
  }, 120_000);
});
