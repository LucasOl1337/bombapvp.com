// @vitest-environment node

import { describe, it } from "vitest";
import { getBombDecision } from "../../../src/original-game/Engine/bot-bomb.ts";
import { getBotPingoDecision } from "../../../src/original-game/Engine/bot-pingo.ts";
import { runMirroredSeries } from "../../../tests/support/adversarial-bot-league.mjs";

describe.each(["standard", "open-no-drops", "sparse-breakables"])(
  "diagnóstico temporário Bomb/Pingo · %s",
  (arenaVariant) => {
  it("lista somente as autoeliminações", () => {
    const cases = Array.from({ length: 12 }, (_, index) => ({
      arenaVariant,
      seed: `bomb-pingo-development-v1-final:${arenaVariant}:${index}`,
    }));
    const outcomes = runMirroredSeries({
      policies: { Bomb: getBombDecision, Pingo: getBotPingoDecision },
      cases,
    });
    console.log(JSON.stringify(outcomes.flatMap((outcome) => (
      Object.entries(outcome.metrics)
        .filter(([, metrics]) => metrics.deathCause === "self")
        .map(([identity, metrics]) => ({
          seed: outcome.seed,
          arenaVariant: outcome.arenaVariant,
          spawnOrder: outcome.spawnOrder,
          identity,
          playerId: metrics.playerId,
          durationMs: outcome.durationMs,
        }))
    )), null, 2));
  }, 60_000);
  },
);
