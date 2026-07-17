// @vitest-environment node

import { describe, expect, it } from "vitest";
import { createDefaultArenaDefinition } from "../src/original-game/Arenas/arena.ts";
import { buildExplosionFeedbackGeometry, GameApp } from "../src/original-game/Engine/game-app.ts";

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

describe("geometria visual das explosoes", () => {
  it("marca a celula letal inteira, preservando apenas um pixel de respiro", () => {
    const geometry = buildExplosionFeedbackGeometry([
      { tile: { x: 3, y: 6 }, style: "normal", remainingMs: 500 },
    ]);

    expect(geometry.cells).toEqual([
      {
        x: 121,
        y: 241,
        width: 38,
        height: 38,
        style: "normal",
        remainingMs: 500,
      },
    ]);
  });

  it("conecta somente celulas ortogonais contiguas do mesmo blast", () => {
    const geometry = buildExplosionFeedbackGeometry([
      { tile: { x: 3, y: 6 }, style: "normal", remainingMs: 500 },
      { tile: { x: 4, y: 6 }, style: "normal", remainingMs: 450 },
      { tile: { x: 4, y: 7 }, style: "normal", remainingMs: 400 },
      { tile: { x: 5, y: 7 }, style: "toxic", remainingMs: 350 },
      { tile: { x: 8, y: 8 }, style: "normal", remainingMs: 300 },
    ]);

    expect(geometry.connectors).toEqual([
      { fromX: 140, fromY: 260, toX: 180, toY: 260, style: "normal" },
      { fromX: 180, fromY: 260, toX: 180, toY: 300, style: "normal" },
    ]);
  });

  it("projeta a chain reaction autoritativa no feedback do GameApp", () => {
    const arena = createDefaultArenaDefinition();
    const app = new GameApp({}, assets(), arena);
    app.startServerAuthoritativeMatch(
      [1, 2],
      { 1: 0, 2: 0, 3: 0, 4: 0 },
      { roomMode: "endless", arena },
    );
    app.advanceServerSimulation(1_300);

    const snapshot = app.exportOnlineSnapshot();
    snapshot.breakableTiles = [];
    snapshot.players[1].activeBombs = 2;
    snapshot.bombs = [
      {
        id: 1,
        ownerId: 1,
        tile: { x: 1, y: 1 },
        fuseMs: 0,
        ownerCanPass: false,
        bodyEgressPlayerIds: [],
        flameRange: 2,
      },
      {
        id: 2,
        ownerId: 1,
        tile: { x: 2, y: 1 },
        fuseMs: 2_000,
        ownerCanPass: false,
        bodyEgressPlayerIds: [],
        flameRange: 1,
      },
    ];
    snapshot.nextBombId = 3;
    app.applyOnlineSnapshot(snapshot);

    app.advanceServerSimulation(1_000 / 60);

    expect(app.getExplosionFeedbackReadModel().chainReactions).toEqual([{
      fromTile: { x: 1, y: 1 },
      toTile: { x: 2, y: 1 },
      elapsedMs: 0,
    }]);
    expect(app.exportOnlineSnapshot().bombs).toEqual([]);
  });

});
