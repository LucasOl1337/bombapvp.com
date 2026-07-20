// @vitest-environment node

import { describe, it } from "vitest";
import { getBombDecision } from "../src/original-game/Engine/bot-bomb.ts";
import { getBotPingoDecision } from "../src/original-game/Engine/bot-pingo.ts";
import { runBombPingoVariantGate } from "./support/bomb-pingo-league-gate.mjs";

describe("liga adversarial Bomb vs Pingo · standard", () => {
  it("executa 12 seeds com lados espelhados e telemetria integral", () => {
    runBombPingoVariantGate("standard", {
      Bomb: getBombDecision,
      Pingo: getBotPingoDecision,
    });
  }, 60_000);
});
