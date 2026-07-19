// @vitest-environment node

/**
 * Headless GameApp smoke: proves shipped movement / flame / kick blocking
 * use the professional body half (PLAYER_BODY_HALF < TILE/2), not a full-tile ghost.
 */
import { describe, expect, it } from "vitest";
import { createDefaultArenaDefinition } from "../src/original-game/Arenas/arena.ts";
import { GameApp } from "../src/original-game/Engine/game-app.ts";
import { TILE_SIZE } from "../src/original-game/PersonalConfig/config.ts";
import { PLAYER_BODY_HALF } from "../src/original-game/Gameplay/player-body.ts";

function assets() {
  return {
    players: {},
    characterRoster: [{
      id: "03a976fb-7313-4064-a477-5bb9b0760034",
      name: "Ranni",
      size: null,
      selectionIndex: 0,
    }],
    characterSpriteLoader: async () => null,
    arenaTheme: {},
    floor: { base: null, lane: null, spawn: null },
    props: { wall: null, crate: null, bomb: null, flame: null },
    powerUps: {},
  };
}

function input(overrides = {}) {
  return {
    direction: null,
    bombPressed: false,
    detonatePressed: false,
    skillPressed: false,
    skillHeld: false,
    ...overrides,
  };
}

function createMatch() {
  const arena = createDefaultArenaDefinition();
  const app = new GameApp({}, assets(), arena);
  app.startServerAuthoritativeMatch(
    [1, 2],
    { 1: 0, 2: 0, 3: 0, 4: 0 },
    { roomMode: "endless", arena },
  );
  app.advanceServerSimulation(1_300);
  return app;
}

const HALF_TILE = TILE_SIZE * 0.5;

describe("GameApp body integration smoke", () => {
  it("does not kill when only a full-tile ghost would touch residual flame", () => {
    const app = createMatch();
    const snapshot = app.exportOnlineSnapshot();
    const flameTile = { x: 2, y: 1 };
    const flameLeft = flameTile.x * TILE_SIZE;
    // Center just outside professional body reach; full-tile half would overlap.
    const safeX = flameLeft - PLAYER_BODY_HALF - 0.5;
    snapshot.players[1].position = { x: safeX, y: flameTile.y * TILE_SIZE + HALF_TILE };
    snapshot.players[1].tile = {
      x: Math.floor(safeX / TILE_SIZE),
      y: flameTile.y,
    };
    snapshot.players[1].spawnProtectionMs = 0;
    snapshot.players[1].shieldCharges = 0;
    snapshot.players[1].flameGuardMs = 0;
    snapshot.players[2].position = { x: 220, y: 220 };
    snapshot.flames = [{
      tile: flameTile,
      remainingMs: 500,
      style: "normal",
      ownerId: 2,
    }];
    app.applyOnlineSnapshot(snapshot);
    app.replaceServerPlayerInput(1, input());
    app.advanceServerSimulation(1_000 / 60);

    const result = app.exportOnlineSnapshot();
    expect(result.players[1].alive).toBe(true);
  });

  it("kills when professional body AABB actually overlaps residual flame", () => {
    const app = createMatch();
    const snapshot = app.exportOnlineSnapshot();
    const flameTile = { x: 2, y: 1 };
    const flameLeft = flameTile.x * TILE_SIZE;
    const lethalX = flameLeft - PLAYER_BODY_HALF + 1;
    snapshot.players[1].position = { x: lethalX, y: flameTile.y * TILE_SIZE + HALF_TILE };
    snapshot.players[1].tile = {
      x: Math.floor(lethalX / TILE_SIZE),
      y: flameTile.y,
    };
    snapshot.players[1].spawnProtectionMs = 0;
    snapshot.players[1].shieldCharges = 0;
    snapshot.players[1].flameGuardMs = 0;
    snapshot.players[2].position = { x: 220, y: 220 };
    snapshot.flames = [{
      tile: flameTile,
      remainingMs: 500,
      style: "normal",
      ownerId: 2,
    }];
    app.applyOnlineSnapshot(snapshot);
    app.replaceServerPlayerInput(1, input());
    app.advanceServerSimulation(1_000 / 60);

    const result = app.exportOnlineSnapshot();
    expect(result.players[1].alive).toBe(false);
  });

  it("collects power-ups by continuous body overlap, not center tile only", () => {
    const app = createMatch();
    const snapshot = app.exportOnlineSnapshot();
    const powerTile = { x: 2, y: 1 };
    // Center sits on neighbor tile 3, but body still clips power tile 2.
    const x = 3 * TILE_SIZE + HALF_TILE - (PLAYER_BODY_HALF - 1);
    expect(Math.floor(x / TILE_SIZE)).toBe(3);
    snapshot.players[1].position = { x, y: powerTile.y * TILE_SIZE + HALF_TILE };
    snapshot.players[1].tile = { x: 3, y: powerTile.y };
    snapshot.players[1].spawnProtectionMs = 0;
    snapshot.players[1].alive = true;
    snapshot.players[2].position = { x: 220, y: 220 };
    snapshot.powerUps = [{
      type: "bomb-up",
      tile: { ...powerTile },
      revealed: true,
      collected: false,
    }];
    snapshot.flames = [];
    app.applyOnlineSnapshot(snapshot);
    const bombsBefore = snapshot.players[1].maxBombs;
    app.replaceServerPlayerInput(1, input());
    app.advanceServerSimulation(1_000 / 60);

    const result = app.exportOnlineSnapshot();
    expect(result.powerUps.every((p) => p.collected || p.tile.x !== powerTile.x)).toBe(true);
    expect(result.players[1].maxBombs).toBeGreaterThan(bombsBefore);
  });
});
