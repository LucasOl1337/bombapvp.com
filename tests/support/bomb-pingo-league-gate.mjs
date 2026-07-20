import { expect } from "vitest";
import {
  runMirroredSeries,
  summarizeSeries,
} from "./adversarial-bot-league.mjs";

export function runBombPingoVariantGate(arenaVariant, policies) {
  const cases = Array.from({ length: 12 }, (_, index) => ({
    arenaVariant,
    seed: `bomb-pingo-development-v1-final:${arenaVariant}:${index}`,
  }));
  const outcomes = runMirroredSeries({ policies, cases });
  const summary = summarizeSeries(outcomes, Object.keys(policies));
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
  const report = {
    suite: "development-v1-final",
    arenaVariant,
    summary,
    deathCauses,
    matches,
  };
  console.log(JSON.stringify(
    process.env.BOT_LEAGUE_COMPACT
      ? { suite: report.suite, arenaVariant, summary, deathCauses }
      : report,
    null,
    2,
  ));

  expect(outcomes).toHaveLength(24);
  expect(outcomes.every((outcome) => outcome.arenaVariant === arenaVariant)).toBe(true);
  expect(outcomes.filter((outcome) => outcome.spawnOrder[0] === "Bomb")).toHaveLength(12);
  expect(outcomes.filter((outcome) => outcome.spawnOrder[0] === "Pingo")).toHaveLength(12);
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
}
