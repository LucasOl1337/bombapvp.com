// @vitest-environment node
// Engine scenarios: Katarina Bouncing Blade → Shunpo in the real GameApp.
import { describe, expect, it } from "vitest";
import { GameApp } from "../src/original-game/Engine/game-app.ts";

const STEP_MS = 1_000 / 60;
const KATARINA_ID = "f2b8d4e6-1a3c-4b5d-9e7f-8c6a5b4d3e2f";

function assets() {
  return {
    players: {},
    characterRoster: [
      { id: KATARINA_ID, name: "Katarina", size: null, selectionIndex: 9 },
      { id: "03a976fb-7313-4064-a477-5bb9b0760034", name: "Ranni", size: null, selectionIndex: 0 },
    ],
    characterSpriteLoader: async () => null,
    arenaTheme: {},
    floor: { base: null, lane: null, spawn: null },
    props: { wall: null, crate: null, bomb: null, flame: null },
    powerUps: {},
  };
}

function arena(victimTile = { x: 6, y: 5 }, breakable = []) {
  return {
    id: "katarina-blade-engine",
    name: "Katarina blade engine",
    status: "active",
    themeId: "default",
    grid: { width: 11, height: 11 },
    tiles: { solid: [], breakable },
    spawns: [
      { playerId: 1, tile: { x: 2, y: 5 }, direction: "right" },
      { playerId: 2, tile: victimTile, direction: "left" },
    ],
    version: "test-v1",
    createdAt: "2026-07-20T00:00:00.000Z",
    updatedAt: "2026-07-20T00:00:00.000Z",
  };
}

function input(direction = null, overrides = {}) {
  return {
    direction,
    bombPressed: false,
    detonatePressed: false,
    skillPressed: false,
    skillHeld: false,
    ...overrides,
  };
}

function setup(opts = {}) {
  const definition = arena(opts.victimTile, opts.breakable);
  const app = new GameApp({}, assets(), definition);
  app.startServerAuthoritativeMatch(
    [1, 2],
    { 1: 9, 2: 0, 3: 0, 4: 0 },
    { roomMode: "endless", arena: definition },
  );
  app.advanceServerSimulation(2_500);
  return app;
}

function pressSkill(app, direction = "right") {
  app.replaceServerPlayerInput(1, input(direction, { skillPressed: true }));
  app.advanceServerSimulation(STEP_MS);
  app.replaceServerPlayerInput(1, input(null));
}

describe("katarina blade engine scenarios", () => {
  it("A: throw arms the dagger at the lane end, Katarina stays put", () => {
    const app = setup();
    pressSkill(app);
    app.advanceServerSimulation(400);
    expect(app.players[1].skill.phase).toBe("releasing");
    expect(app.players[1].tile).toEqual({ x: 2, y: 5 });
  });

  it("B: re-cast blinks next to the dagger and kills the enemy on it", () => {
    const app = setup({ victimTile: { x: 6, y: 5 } });
    pressSkill(app);
    app.advanceServerSimulation(400);
    pressSkill(app);
    app.advanceServerSimulation(200);
    const kat = app.players[1];
    // Dagger stuck at (6,5) under the victim; blink lands on a ring-1 tile.
    const dist = Math.max(Math.abs(kat.tile.x - 6), Math.abs(kat.tile.y - 5));
    expect(dist).toBeLessThanOrEqual(1);
    expect(kat.skill.phase).toBe("cooldown");
    expect(app.players[2].alive).toBe(false);
  });

  it("C: Katarina walks freely while the dagger is armed", () => {
    const app = setup();
    pressSkill(app);
    app.advanceServerSimulation(300);
    app.replaceServerPlayerInput(1, input("down"));
    app.advanceServerSimulation(400);
    app.replaceServerPlayerInput(1, input(null));
    expect(app.players[1].tile.y).toBeGreaterThan(5);
    expect(app.players[1].skill.phase).toBe("releasing");
  });

  it("D: dagger expires without re-cast and refunds half cooldown", () => {
    const app = setup();
    pressSkill(app);
    app.advanceServerSimulation(5_400);
    const kat = app.players[1];
    expect(kat.skill.phase).toBe("cooldown");
    expect(kat.skill.cooldownRemainingMs).toBeLessThanOrEqual(4_000);
    expect(kat.tile).toEqual({ x: 2, y: 5 });
  });

  it("E: crate truncates the dagger lane (blink lands before it)", () => {
    const app = setup({ victimTile: { x: 9, y: 5 }, breakable: ["5,5"] });
    pressSkill(app);
    app.advanceServerSimulation(400);
    pressSkill(app);
    app.advanceServerSimulation(200);
    expect(app.players[1].tile).toEqual({ x: 4, y: 5 });
    expect(app.players[2].alive).toBe(true);
  });

  it("F: blink escape — throw over a bomb zone and blink away", () => {
    const app = setup({ victimTile: { x: 9, y: 9 } });
    pressSkill(app, "down");
    app.advanceServerSimulation(400);
    pressSkill(app, "down");
    app.advanceServerSimulation(200);
    expect(app.players[1].tile).toEqual({ x: 2, y: 9 });
  });
});
