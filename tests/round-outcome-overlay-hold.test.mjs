// @vitest-environment node

import { describe, expect, it } from "vitest";
import { GameApp } from "../src/original-game/Engine/game-app.ts";
import { createDefaultArenaDefinition } from "../src/original-game/Arenas/arena.ts";

function assets() {
  return {
    players: {},
    characterSpriteLoader: async () => null,
    arenaTheme: {},
    floor: { base: null, lane: null, spawn: null },
    props: { wall: null, crate: null, bomb: null, flame: null },
    powerUps: {},
  };
}

function createGame(prefersReducedMotion = false) {
  const arena = createDefaultArenaDefinition();
  const app = new GameApp({}, assets(), arena);
  app.startServerAuthoritativeMatch(
    [1, 2],
    { 1: 0, 2: 1, 3: 0, 4: 1 },
    { roomMode: "classic", arena },
  );
  app.prefersReducedMotion = prefersReducedMotion;
  return app;
}

function gameText(app) {
  return JSON.parse(app.renderGameToText());
}

function centerOverlay(app) {
  return gameText(app).match.centerOverlay;
}

describe("hold visual da eliminação antes do banner", () => {
  it("mantém o quadro final visível antes de revelar o resultado", () => {
    const app = createGame();

    app.eliminateServerPlayer(2);
    const decided = app.exportOnlineSnapshot();
    const accessibleState = gameText(app);

    expect(decided.roundOutcome).toMatchObject({ winner: 1, reason: "elimination" });
    expect(decided.score[1]).toBe(1);
    expect(accessibleState.match.roundOutcome).toMatchObject({ winner: 1, reason: "elimination" });
    expect(accessibleState.match.centerOverlay).toBeNull();

    app.advanceServerSimulation(300);
    const held = app.exportOnlineSnapshot();

    expect(centerOverlay(app)).toBeNull();
    expect(held.roundOutcome).toMatchObject({ winner: 1, reason: "elimination" });
    expect(held.roundOutcome.countdownMs).toBeLessThan(decided.roundOutcome.countdownMs);
    expect(held.score).toEqual(decided.score);

    app.advanceServerSimulation(100);

    expect(centerOverlay(app)).toMatchObject({ victoryEmblem: true });
    expect(app.exportOnlineSnapshot().score).toEqual(decided.score);
  });

  it("preserva o mesmo hold estático com movimento reduzido", () => {
    const app = createGame(true);

    app.eliminateServerPlayer(2);
    expect(centerOverlay(app)).toBeNull();

    app.advanceServerSimulation(300);
    expect(centerOverlay(app)).toBeNull();

    app.advanceServerSimulation(100);
    expect(centerOverlay(app)).toMatchObject({ victoryEmblem: true });
  });
});
