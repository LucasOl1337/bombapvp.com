// @vitest-environment node

import { describe, expect, it } from "vitest";
import { GameApp } from "../src/original-game/Engine/game-app.ts";
import { createDefaultArenaDefinition } from "../src/original-game/Arenas/arena.ts";
import {
  CROCODILO_SURGE_DURATION_MS,
  fireCrocodiloEmeraldSurge,
} from "../src/original-game/Characters/CustomMechanics/crocodilo-skill.ts";

function arena(playerTwoTile = { x: 5, y: 5 }) {
  const border = [];
  for (let index = 0; index < 7; index += 1) {
    border.push(`${index},0`, `${index},6`, `0,${index}`, `6,${index}`);
  }
  return {
    id: "elimination-telemetry",
    name: "Elimination telemetry",
    status: "active",
    themeId: "default",
    grid: { width: 7, height: 7 },
    tiles: { solid: [...new Set(border)], breakable: [] },
    spawns: [
      { playerId: 1, tile: { x: 1, y: 1 }, direction: "right" },
      { playerId: 2, tile: playerTwoTile, direction: "left" },
      { playerId: 3, tile: { x: 1, y: 5 }, direction: "right" },
      { playerId: 4, tile: { x: 5, y: 1 }, direction: "left" },
    ],
    version: "test-v1",
    createdAt: "2026-07-16T00:00:00.000Z",
    updatedAt: "2026-07-16T00:00:00.000Z",
  };
}

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

function game(playerTwoTile, botPlayerIds = [], definition = arena(playerTwoTile), options = {}) {
  const app = new GameApp({}, assets(), definition);
  app.startServerAuthoritativeMatch(
    [1, 2],
    { 1: 0, 2: 1, 3: 0, 4: 1 },
    { roomMode: "endless", arena: definition, botPlayerIds, ...options },
  );
  return app;
}

describe("telemetria autoritativa de eliminações", () => {
  it("não acumula suicídios de V1 contra adversários ativos", () => {
    const directions = ["right", "down", "left", "up"];
    let bombPlacementDecisions = 0;
    const app = game(undefined, [2], createDefaultArenaDefinition(), {
      botDecisionObserver: (measurement) => {
        if (measurement.playerId === 2 && measurement.decision.placeBomb) {
          bombPlacementDecisions += 1;
        }
      },
    });
    let randomState = 2;
    const random = () => {
      randomState = (randomState * 1_664_525 + 1_013_904_223) >>> 0;
      return randomState / 0x1_0000_0000;
    };
    for (let step = 0; step < 360; step += 1) {
      app.setServerPlayerInput(1, {
        direction: directions[Math.floor(random() * directions.length)],
        bombPressed: random() < 0.12,
        detonatePressed: false,
        skillPressed: false,
      });
      app.advanceServerSimulation(250);
    }

    expect(bombPlacementDecisions).toBeGreaterThan(0);
    expect(app.exportOnlineSnapshot().endlessStats?.selfDeaths?.[2]).toBe(0);
  });

  it("classifica a morte causada pela própria bomba", () => {
    const app = game();
    app.advanceServerSimulation(1_300);
    app.setServerPlayerInput(1, {
      direction: null,
      bombPressed: true,
      detonatePressed: false,
      skillPressed: false,
    });
    app.advanceServerSimulation(2_200);

    const snapshot = app.exportOnlineSnapshot();
    expect(snapshot.players[1].alive).toBe(false);
    expect(snapshot.endlessStats).toMatchObject({
      deaths: { 1: 1 },
      selfDeaths: { 1: 1 },
      opponentDeaths: { 1: 0 },
      suddenDeathDeaths: { 1: 0 },
    });
  });

  it("classifica o fechamento da arena como sudden death", () => {
    const app = game();
    app.advanceServerSimulation(51_000);

    const snapshot = app.exportOnlineSnapshot();
    expect(snapshot.endlessStats).toMatchObject({
      deaths: { 1: 1 },
      selfDeaths: { 1: 0 },
      opponentDeaths: { 1: 0 },
      suddenDeathDeaths: { 1: 1 },
    });
  });

  it("credita a bomba ao atacante e a morte ao adversário", () => {
    const app = game({ x: 1, y: 2 });
    app.advanceServerSimulation(1_300);
    app.setServerPlayerInput(1, {
      direction: null,
      bombPressed: true,
      detonatePressed: false,
      skillPressed: false,
    });
    app.advanceServerSimulation(2_200);

    const snapshot = app.exportOnlineSnapshot();
    expect(snapshot.endlessStats).toMatchObject({
      kills: { 1: 1 },
      selfDeaths: { 1: 1, 2: 0 },
      opponentDeaths: { 1: 0, 2: 1 },
      deaths: { 1: 1, 2: 1 },
    });
  });

  it("não conta uma eliminação administrativa como morte competitiva", () => {
    const app = game();
    app.eliminateServerPlayer(1);

    expect(app.exportOnlineSnapshot().endlessStats).toMatchObject({
      deaths: { 1: 0 },
      selfDeaths: { 1: 0 },
      opponentDeaths: { 1: 0 },
      suddenDeathDeaths: { 1: 0 },
      environmentDeaths: { 1: 0 },
    });
  });

  it("preserva o autor das chamas persistentes de skill", () => {
    const flames = [];
    const player = {
      id: 1,
      alive: true,
      direction: "right",
      lastMoveDirection: "right",
      position: { x: 3, y: 3 },
      velocity: { x: 0, y: 0 },
      flameGuardMs: 0,
      skill: {
        id: "crocodilo-emerald-surge",
        phase: "channeling",
        projectedLastMoveDirection: "right",
      },
    };
    fireCrocodiloEmeraldSurge(player, {
      arena: {
        config: { grid: { width: 7, height: 7 } },
        solid: new Set(),
        breakable: new Set(),
      },
      bombs: [],
      players: { 1: player },
      activePlayerIds: [1],
      getTileFromPosition: () => ({ x: 3, y: 3 }),
      addFlame: (...args) => flames.push(args),
      breakCrateAtKey: () => false,
      soundManager: { playOneShot: () => undefined },
    });

    expect(flames).not.toHaveLength(0);
    expect(flames.every(([, durationMs, style, ownerId]) => (
      durationMs === CROCODILO_SURGE_DURATION_MS && style === "toxic" && ownerId === 1
    ))).toBe(true);
  });
});
