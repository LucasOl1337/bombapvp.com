import { describe, expect, it } from "vitest";
import {
  FIXED_STEP_MS,
  ROUND_DURATION_MS,
  ROUND_END_DELAY_MS,
} from "../src/original-game/PersonalConfig/config.ts";
import { GameApp } from "../src/original-game/Engine/game-app.ts";

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

describe("integracao do ciclo autoritativo", () => {
  it("projeta eventos, placar e resultado pelo port publico do jogo", () => {
    const game = new GameApp({}, headlessAssets());
    game.startServerAuthoritativeMatch(
      [1],
      { 1: 0, 2: 0, 3: 0, 4: 0 },
      { roomMode: "classic" },
    );

    game.advanceServerSimulation(FIXED_STEP_MS);
    expect(game.exportOnlineSnapshot()).toMatchObject({
      mode: "match",
      roundNumber: 1,
      score: { 1: 1, 2: 0, 3: 0, 4: 0 },
      roundOutcome: { winner: 1, reason: "elimination" },
      matchWinner: null,
    });

    game.advanceServerSimulation(ROUND_END_DELAY_MS);
    expect(game.exportOnlineSnapshot()).toMatchObject({
      mode: "match",
      roundNumber: 2,
      score: { 1: 1, 2: 0, 3: 0, 4: 0 },
      roundOutcome: null,
    });

    game.advanceServerSimulation(FIXED_STEP_MS);
    game.advanceServerSimulation(ROUND_END_DELAY_MS);
    expect(game.exportOnlineSnapshot()).toMatchObject({
      mode: "match-result",
      roundNumber: 2,
      score: { 1: 2, 2: 0, 3: 0, 4: 0 },
      roundOutcome: null,
      matchWinner: 1,
    });

    game.startServerAuthoritativeMatch(
      [1],
      { 1: 0, 2: 0, 3: 0, 4: 0 },
      { roomMode: "classic" },
    );
    expect(game.exportOnlineSnapshot()).toMatchObject({
      mode: "match",
      roundNumber: 1,
      roundTimeMs: ROUND_DURATION_MS,
      score: { 1: 0, 2: 0, 3: 0, 4: 0 },
      roundOutcome: null,
      matchWinner: null,
    });
  });

  it("nao declara campeao um jogador removido durante o fim da rodada", () => {
    const game = new GameApp({}, headlessAssets());
    game.startServerAuthoritativeMatch(
      [1, 2],
      { 1: 0, 2: 0, 3: 0, 4: 0 },
      { roomMode: "classic" },
    );

    game.eliminateServerPlayer(2);
    game.advanceServerSimulation(ROUND_END_DELAY_MS);
    game.eliminateServerPlayer(2);
    expect(game.exportOnlineSnapshot()).toMatchObject({
      score: { 1: 2 },
      roundOutcome: { winner: 1 },
    });

    game.removeServerPlayer(1);
    const guest = new GameApp({}, headlessAssets());
    expect(() => guest.applyOnlineSnapshot(game.exportOnlineSnapshot())).not.toThrow();
    game.advanceServerSimulation(ROUND_END_DELAY_MS);
    expect(game.exportOnlineSnapshot()).toMatchObject({
      mode: "match",
      roundNumber: 3,
      matchWinner: null,
    });
  });
});
