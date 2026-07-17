import { describe, expect, it } from "vitest";

import { GameApp } from "../src/original-game/Engine/game-app.ts";
import { FIXED_STEP_MS } from "../src/original-game/PersonalConfig/config.ts";

const headlessAssets = () => ({
  players: {},
  characterRoster: [
    { id: "test-player", name: "Test Player", size: null, selectionIndex: 0 },
  ],
  characterSpriteLoader: async () => null,
  arenaTheme: {},
  floor: { base: null, lane: null, spawn: null },
  props: { wall: null, crate: null, bomb: null, flame: null },
  powerUps: {},
});

describe("integracao do runtime dos bots", () => {
  it("explicita o throttle de bomba compartilhado pela sala no mesmo tick", () => {
    const observedThrottles = [];
    const policy = (player, context) => {
      observedThrottles.push({
        playerId: player.id,
        throttleMs: context.roomBombPlacementThrottleMs,
      });
      return { direction: null, placeBomb: true };
    };
    const game = new GameApp({}, headlessAssets());
    game.startServerAuthoritativeMatch(
      [1, 2],
      { 1: 0, 2: 0, 3: 0, 4: 0 },
      {
        botPlayerIds: [1, 2],
        botDecisionPolicies: { 1: policy, 2: policy },
      },
    );

    game.advanceServerSimulation(FIXED_STEP_MS);

    expect(observedThrottles.slice(0, 2)).toEqual([
      { playerId: 1, throttleMs: 0 },
      { playerId: 2, throttleMs: 900 },
    ]);
  });
});
