// @vitest-environment node
// Scratch repro: Thresh Death Sentence pull in the real engine — scenario matrix.
import { describe, expect, it } from "vitest";
import { GameApp } from "../src/original-game/Engine/game-app.ts";

const STEP_MS = 1_000 / 60;
const THRESH_ID = "e7a1c4d2-9f3b-4c5e-a8d1-2b6f8e0c4a7d";

function assets() {
  return {
    players: {},
    characterRoster: [
      { id: THRESH_ID, name: "Thresh", size: null, selectionIndex: 8 },
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
    id: "thresh-hook-repro",
    name: "Thresh hook repro",
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
    { 1: 8, 2: 0, 3: 0, 4: 0 },
    { roomMode: "endless", arena: definition },
  );
  app.advanceServerSimulation(1_300);
  return app;
}

function cast(app, direction, { victimInput = null, waitMs = 600 } = {}) {
  app.replaceServerPlayerInput(1, input(direction, { skillPressed: true }));
  app.advanceServerSimulation(STEP_MS);
  app.replaceServerPlayerInput(1, input(direction));
  if (victimInput) app.replaceServerPlayerInput(2, input(victimInput));
  app.advanceServerSimulation(waitMs);
}

describe("thresh hook scenarios", () => {
  it("A: standing still cast (no direction held)", () => {
    const app = setup();
    cast(app, null);
    console.log("A victim:", app.players[2].tile, "phase:", app.players[1].skill.phase);
    expect(app.players[2].tile.x).toBeLessThan(6);
  });

  it("B: victim walking across the line — live projectile grabs mid-flight", () => {
    const app = setup();
    cast(app, "right", { victimInput: "down" });
    console.log("B victim:", app.players[2].tile);
    expect(app.players[2].tile.x).toBeLessThan(6);
  });

  it("C: victim at max range (4 tiles)", () => {
    const app = setup({ victimTile: { x: 6, y: 5 } });
    cast(app, "right");
    expect(app.players[2].tile).toEqual({ x: 3, y: 5 });
  });

  it("D: victim beyond max range (5 tiles) — must NOT be hit", () => {
    const app = setup({ victimTile: { x: 7, y: 5 } });
    cast(app, "right");
    console.log("D victim:", app.players[2].tile);
    expect(app.players[2].tile).toEqual({ x: 7, y: 5 });
  });

  it("E: crate between — hook blocked", () => {
    const app = setup({ victimTile: { x: 6, y: 5 }, breakable: ["4,5"] });
    cast(app, "right");
    console.log("E victim:", app.players[2].tile);
    expect(app.players[2].tile).toEqual({ x: 6, y: 5 });
  });

  it("F: victim walking toward Thresh is grabbed and yanked adjacent", () => {
    const app = setup();
    app.replaceServerPlayerInput(1, input("right", { skillPressed: true }));
    app.advanceServerSimulation(STEP_MS);
    app.replaceServerPlayerInput(1, input("right"));
    app.replaceServerPlayerInput(2, input("left"));
    app.advanceServerSimulation(150);
    app.replaceServerPlayerInput(2, input(null));
    app.advanceServerSimulation(500);
    console.log("F victim:", app.players[2].tile);
    expect(app.players[2].tile).toEqual({ x: 3, y: 5 });
  });
});
