// @vitest-environment node

import { describe, expect, it } from "vitest";
import { createDefaultArenaDefinition } from "../src/original-game/Arenas/arena.ts";
import { GameApp } from "../src/original-game/Engine/game-app.ts";

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

function createMatch(playerIds = [1, 2]) {
  const arena = createDefaultArenaDefinition();
  const app = new GameApp({}, assets(), arena);
  app.startServerAuthoritativeMatch(
    playerIds,
    { 1: 0, 2: 0, 3: 0, 4: 0 },
    { roomMode: "endless", arena },
  );
  app.advanceServerSimulation(1_300);
  return app;
}

function activeFlame(ownerId = 2, remainingMs = 500) {
  return {
    tile: { x: 2, y: 1 },
    remainingMs,
    style: "normal",
    ownerId,
  };
}

describe("letalidade autoritativa da chama residual", () => {
  it("mata e atribui ao owner quem entra depois numa chama ainda visivel", () => {
    const app = createMatch();
    const snapshot = app.exportOnlineSnapshot();
    snapshot.players[1].position = { x: 60, y: 60 };
    snapshot.players[1].tile = { x: 1, y: 1 };
    snapshot.players[1].spawnProtectionMs = 0;
    snapshot.players[2].position = { x: 220, y: 220 };
    snapshot.players[2].tile = { x: 5, y: 5 };
    snapshot.flames = [activeFlame()];
    app.applyOnlineSnapshot(snapshot);

    app.replaceServerPlayerInput(1, input({ direction: "right" }));
    app.advanceServerSimulation(200);

    const result = app.exportOnlineSnapshot();
    expect(result.flames[0].remainingMs).toBeGreaterThan(0);
    // Death uses hitbox overlap: player may die as soon as the body touches the
    // flame tile, before floor(position) reports that discrete tile.
    expect(result.players[1].alive).toBe(false);
    expect(result.endlessStats.kills[2]).toBe(1);
    expect(result.endlessStats.opponentDeaths[1]).toBe(1);
  });

  it("nao mata quando a chama ja expirou", () => {
    const app = createMatch();
    const snapshot = app.exportOnlineSnapshot();
    snapshot.players[1].position = { x: 100, y: 60 };
    snapshot.players[1].tile = { x: 2, y: 1 };
    snapshot.players[1].spawnProtectionMs = 0;
    snapshot.flames = [activeFlame(2, 0)];
    app.applyOnlineSnapshot(snapshot);

    app.advanceServerSimulation(1_000 / 60);

    const result = app.exportOnlineSnapshot();
    expect(result.flames).toEqual([]);
    expect(result.players[1].alive).toBe(true);
    expect(result.endlessStats.kills[2]).toBe(0);
  });

  it("nao aplica segundo hit quando o shield absorve a explosao que criou a chama", () => {
    const app = createMatch([1, 2, 3]);
    const snapshot = app.exportOnlineSnapshot();
    snapshot.players[1].position = { x: 100, y: 60 };
    snapshot.players[1].tile = { x: 2, y: 1 };
    snapshot.players[1].spawnProtectionMs = 0;
    snapshot.players[1].shieldCharges = 1;
    snapshot.players[1].flameGuardMs = 0;
    snapshot.players[2].position = { x: 220, y: 220 };
    snapshot.players[2].tile = { x: 5, y: 5 };
    snapshot.bombs = [{
      id: 1,
      ownerId: 2,
      tile: { x: 2, y: 1 },
      fuseMs: 0,
      ownerCanPass: false,
      bodyEgressPlayerIds: [],
      flameRange: 1,
    }];
    snapshot.nextBombId = 2;
    app.applyOnlineSnapshot(snapshot);

    app.advanceServerSimulation(1_000 / 60);

    const explosionFrame = app.exportOnlineSnapshot();
    expect(explosionFrame.players[1].shieldCharges).toBe(0);
    expect(explosionFrame.players[1].flameGuardMs).toBe(600);
    expect(explosionFrame.players[1].alive).toBe(true);
    expect(explosionFrame.endlessStats.deaths[1]).toBe(0);

    app.advanceServerSimulation(650);

    const result = app.exportOnlineSnapshot();
    expect(result.flames).toEqual([]);
    expect(result.players[1].alive).toBe(true);
    expect(result.endlessStats.deaths[1]).toBe(0);
  });

  it.each([
    ["spawn protection", "spawnProtectionMs"],
    ["flame guard", "flameGuardMs"],
  ])("respeita %s enquanto ativo", (_label, protectionField) => {
    const app = createMatch([1, 2, 3]);
    const snapshot = app.exportOnlineSnapshot();
    snapshot.players[1].position = { x: 100, y: 60 };
    snapshot.players[1].tile = { x: 2, y: 1 };
    snapshot.players[1].spawnProtectionMs = 0;
    snapshot.players[1][protectionField] = 50;
    snapshot.flames = [activeFlame()];
    app.applyOnlineSnapshot(snapshot);

    app.advanceServerSimulation(1_000 / 60);
    expect(app.exportOnlineSnapshot().players[1].alive).toBe(true);

    app.advanceServerSimulation(50);
    const result = app.exportOnlineSnapshot();
    expect(result.players[1].alive).toBe(false);
    expect(result.endlessStats.kills[2]).toBe(1);
  });

  it("mata quando o hitbox sobrepoe a chama mesmo com tile discreto em vizinho", () => {
    // TILE_SIZE=40, hitbox half=20. Center of tile (2,1) is (100,60).
    // Position x=119 still floors to tile x=2, but body overlaps tile x=3 (120..160).
    const app = createMatch();
    const snapshot = app.exportOnlineSnapshot();
    snapshot.players[1].position = { x: 119, y: 60 };
    snapshot.players[1].tile = { x: 2, y: 1 };
    snapshot.players[1].spawnProtectionMs = 0;
    snapshot.players[1].flameGuardMs = 0;
    snapshot.players[1].shieldCharges = 0;
    snapshot.players[2].position = { x: 220, y: 220 };
    snapshot.players[2].tile = { x: 5, y: 5 };
    snapshot.flames = [{
      tile: { x: 3, y: 1 },
      remainingMs: 500,
      style: "normal",
      ownerId: 2,
    }];
    app.applyOnlineSnapshot(snapshot);

    app.advanceServerSimulation(1_000 / 60);

    const result = app.exportOnlineSnapshot();
    expect(result.players[1].tile).toEqual({ x: 2, y: 1 });
    expect(result.players[1].alive).toBe(false);
    expect(result.endlessStats.kills[2]).toBe(1);
  });

  it("mata no instante da explosao se o corpo so sobrepoe tile de blast adjacente", () => {
    const app = createMatch([1, 2, 3]);
    const snapshot = app.exportOnlineSnapshot();
    // Standing near right edge of (1,1); bomb on (2,1) range 1 covers (1,1) and (2,1) and (3,1)...
    // Place player so discrete tile is (1,1) but body overlaps bomb tile (2,1) which will flame.
    snapshot.players[1].position = { x: 79, y: 60 }; // tile 1,1 center-ish right edge (tile1: 40-80)
    snapshot.players[1].tile = { x: 1, y: 1 };
    snapshot.players[1].spawnProtectionMs = 0;
    snapshot.players[1].flameGuardMs = 0;
    snapshot.players[1].shieldCharges = 0;
    snapshot.players[2].position = { x: 220, y: 220 };
    snapshot.players[2].tile = { x: 5, y: 5 };
    snapshot.bombs = [{
      id: 1,
      ownerId: 2,
      tile: { x: 2, y: 1 },
      fuseMs: 0,
      ownerCanPass: false,
      bodyEgressPlayerIds: [],
      flameRange: 1,
    }];
    snapshot.nextBombId = 2;
    app.applyOnlineSnapshot(snapshot);

    app.advanceServerSimulation(1_000 / 60);

    const result = app.exportOnlineSnapshot();
    expect(result.players[1].alive).toBe(false);
    expect(result.endlessStats.kills[2]).toBe(1);
  });

  it("preserva Ranni durante channeling e resolve a chama ao entrar em cooldown", () => {
    const app = createMatch([1, 2, 3]);
    const snapshot = app.exportOnlineSnapshot();
    snapshot.players[1].position = { x: 100, y: 60 };
    snapshot.players[1].tile = { x: 2, y: 1 };
    snapshot.players[1].spawnProtectionMs = 0;
    snapshot.players[1].skill = {
      id: "ranni-ice-blink",
      phase: "channeling",
      channelRemainingMs: 30,
      cooldownRemainingMs: 0,
      castElapsedMs: 100,
      projectedPosition: { x: 100, y: 60 },
      projectedLastMoveDirection: null,
      projectedBombEgressIds: [],
    };
    snapshot.flames = [activeFlame()];
    app.applyOnlineSnapshot(snapshot);

    app.advanceServerSimulation(1_000 / 60);
    const channeling = app.exportOnlineSnapshot();
    expect(channeling.players[1].alive).toBe(true);
    expect(channeling.players[1].skill.phase).toBe("channeling");

    app.advanceServerSimulation(1_000 / 60);
    const result = app.exportOnlineSnapshot();
    expect(result.players[1].alive).toBe(false);
    expect(result.endlessStats.kills[2]).toBe(1);
  });
});
