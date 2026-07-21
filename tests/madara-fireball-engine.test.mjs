// @vitest-environment node
// Engine scenarios: Madara Fireball Jutsu in the real GameApp.
import { describe, expect, it } from "vitest";
import { GameApp } from "../src/original-game/Engine/game-app.ts";

const STEP_MS = 1_000 / 60;
const MADARA_ID = "c155b0d5-644c-4b43-8d02-890e76574eff";

function assets() {
  return {
    players: {},
    characterRoster: [
      { id: MADARA_ID, name: "Madara", size: null, selectionIndex: 10 },
      { id: "03a976fb-7313-4064-a477-5bb9b0760034", name: "Ranni", size: null, selectionIndex: 0 },
    ],
    characterSpriteLoader: async () => null,
    arenaTheme: {},
    floor: { base: null, lane: null, spawn: null },
    props: { wall: null, crate: null, bomb: null, flame: null },
    powerUps: {},
  };
}

function arena(breakable = [], victimTile = { x: 6, y: 5 }) {
  return {
    id: "madara-fireball-engine",
    name: "Madara fireball engine",
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
  const definition = arena(opts.breakable ?? [], opts.victimTile);
  const app = new GameApp({}, assets(), definition);
  app.startServerAuthoritativeMatch(
    [1, 2],
    { 1: 10, 2: 0, 3: 0, 4: 0 },
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

describe("madara fireball engine scenarios", () => {
  it("A: fireball burns three crates in a line", () => {
    const app = setup({ breakable: ["3,5", "4,5", "5,5"] });
    const before = app.arena.breakable.size;
    pressSkill(app);
    app.advanceServerSimulation(400);
    expect(app.players[1].skill.phase).toBe("cooldown");
    expect(app.arena.breakable.size).toBe(before - 3);
    expect(app.players[2].alive).toBe(true);
  });

  it("B: fireball kills an enemy in the lane and stops there", () => {
    const app = setup({ victimTile: { x: 4, y: 5 } });
    pressSkill(app);
    app.advanceServerSimulation(400);
    expect(app.players[1].skill.phase).toBe("cooldown");
    expect(app.players[2].alive).toBe(false);
  });

  it("C: lateral flames spawn at the end of the fireball", () => {
    const app = setup({ breakable: ["3,5"] });
    pressSkill(app);
    app.advanceServerSimulation(400);
    const flameTiles = app.flames.map((f) => `${f.tile.x},${f.tile.y}`);
    expect(flameTiles.length).toBeGreaterThan(0);
    expect(flameTiles).toContain("6,5");
    expect(flameTiles).toContain("6,4");
    expect(flameTiles).toContain("6,6");
  });

  it("D: solid wall truncates the fireball before impact", () => {
    const app = setup({ breakable: ["3,5"], victimTile: { x: 9, y: 5 } });
    app.arena.solid.add("5,5");
    app.invalidateArenaCache();
    pressSkill(app);
    app.advanceServerSimulation(400);
    expect(app.players[2].alive).toBe(true);
    expect(app.arena.breakable.has("3,5")).toBe(false);
    expect(app.arena.breakable.has("4,5")).toBe(false);
    expect(app.arena.solid.has("5,5")).toBe(true);
  });

  it("E: bomb blocks the fireball and protects crates beyond", () => {
    const app = setup({ breakable: ["5,5", "6,5"] });
    // Inject a bomb at (4,5) into the live state.
    app.bombs.push({
      id: 999,
      ownerId: 1,
      tile: { x: 4, y: 5 },
      fuseMs: 3_000,
      ownerCanPass: false,
      flameRange: 2,
    });
    app.advanceServerSimulation(STEP_MS);
    pressSkill(app);
    app.advanceServerSimulation(400);
    expect(app.arena.breakable.has("5,5")).toBe(true);
    expect(app.arena.breakable.has("6,5")).toBe(true);
  });
});
