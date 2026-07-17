// @vitest-environment node

import { describe, expect, it } from "vitest";
import { getBombDecision } from "../src/original-game/Engine/bot-bomb.ts";
import { getBotPingoDecision } from "../src/original-game/Engine/bot-pingo.ts";
import { playAdversarialMatch } from "./support/adversarial-bot-league.mjs";

const SELF_DEATH_REPLAYS = [
  {
    arenaVariant: "open-no-drops",
    seed: "bomb-post-ranni-hotfix-dev-a:open-no-drops:7",
    spawnOrder: ["Bomb", "Pingo"],
  },
  {
    arenaVariant: "sparse-breakables",
    seed: "bomb-post-ranni-hotfix-dev-a:sparse-breakables:6",
    spawnOrder: ["Pingo", "Bomb"],
  },
  {
    arenaVariant: "standard",
    seed: "bomb-post-ranni-hotfix-dev-b:standard:1",
    spawnOrder: ["Pingo", "Bomb"],
  },
  {
    arenaVariant: "sparse-breakables",
    seed: "bomb-post-ranni-hotfix-dev-b:sparse-breakables:3",
    spawnOrder: ["Bomb", "Pingo"],
  },
  {
    arenaVariant: "sparse-breakables",
    seed: "bomb-post-ranni-hotfix-dev-b:sparse-breakables:7",
    spawnOrder: ["Pingo", "Bomb"],
  },
  {
    arenaVariant: "sparse-breakables",
    seed: "reserved-8f149c2d-66f1-4d13-a3c4-8ce57fe6742b:sparse-breakables:9",
    spawnOrder: ["Pingo", "Bomb"],
  },
  {
    arenaVariant: "sparse-breakables",
    seed: "bomb-pingo-development-v1-final:sparse-breakables:8",
    spawnOrder: ["Bomb", "Pingo"],
  },
  {
    arenaVariant: "standard",
    seed: "pingo-v3-dev-b:standard:0",
    spawnOrder: ["Bomb", "Pingo"],
  },
  {
    arenaVariant: "standard",
    seed: "pingo-v3-dev-b:standard:9",
    spawnOrder: ["Pingo", "Bomb"],
  },
  {
    arenaVariant: "open-no-drops",
    seed: "pingo-v3-dev-b:open-no-drops:10",
    spawnOrder: ["Bomb", "Pingo"],
  },
  {
    arenaVariant: "sparse-breakables",
    seed: "pingo-v3-dev-b:sparse-breakables:8",
    spawnOrder: ["Pingo", "Bomb"],
  },
  {
    arenaVariant: "open-no-drops",
    seed: "bomb-pingo-development-v1-final:open-no-drops:3",
    spawnOrder: ["Bomb", "Pingo"],
  },
  {
    arenaVariant: "open-no-drops",
    seed: "bomb-pingo-development-v1-final:open-no-drops:11",
    spawnOrder: ["Bomb", "Pingo"],
  },
];

describe("regressões development do Bomb", () => {
  for (const replay of SELF_DEATH_REPLAYS) {
    it(`não repete self-death em ${replay.arenaVariant} ${replay.spawnOrder.join("-")}`, () => {
      const outcome = playAdversarialMatch({
        ...replay,
        characterIndex: 0,
        policies: { Bomb: getBombDecision, Pingo: getBotPingoDecision },
      });

      expect(outcome.metrics.Bomb.selfDeaths).toBe(0);
    });
  }
});
