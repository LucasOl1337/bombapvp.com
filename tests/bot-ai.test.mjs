import { describe, expect, it } from "vitest";
import { getBotDecision } from "../src/original-game/Engine/bot-ai.ts";
import { TILE_SIZE } from "../src/original-game/PersonalConfig/config.ts";

function player(id, tile, active = true) {
  return {
    id,
    name: active ? `P${id}` : "",
    active,
    tile: { ...tile },
    position: {
      x: tile.x * TILE_SIZE + TILE_SIZE / 2,
      y: tile.y * TILE_SIZE + TILE_SIZE / 2,
    },
    velocity: { x: 0, y: 0 },
    alive: active,
    direction: "down",
    lastMoveDirection: null,
    maxBombs: 1,
    activeBombs: 0,
    flameRange: 1,
    speedLevel: 0,
    remoteLevel: 0,
    shieldCharges: 0,
    bombPassLevel: 0,
    kickLevel: 0,
    shortFuseLevel: 0,
    flameGuardMs: 0,
    spawnProtectionMs: 0,
    skill: {
      id: null,
      phase: "idle",
      channelRemainingMs: 0,
      cooldownRemainingMs: 0,
      castElapsedMs: 0,
      projectedPosition: null,
      projectedLastMoveDirection: null,
    },
  };
}

function corridorArena() {
  const open = new Set(["2,2", "2,3", "2,4", "5,5"]);
  const solid = new Set();
  for (let y = 0; y < 7; y += 1) {
    for (let x = 0; x < 7; x += 1) {
      const key = `${x},${y}`;
      if (!open.has(key) && key !== "3,2") solid.add(key);
    }
  }
  return {
    config: {
      id: "suicide-repro",
      name: "Suicide repro",
      status: "active",
      themeId: "default",
      grid: { width: 7, height: 7 },
      tiles: { solid: [...solid], breakable: ["3,2"] },
      spawns: [
        { playerId: 1, tile: { x: 2, y: 2 }, direction: "down" },
        { playerId: 2, tile: { x: 5, y: 5 }, direction: "up" },
      ],
      version: "test",
      createdAt: "2026-07-16T00:00:00.000Z",
      updatedAt: "2026-07-16T00:00:00.000Z",
      wrapPortals: [],
      suddenDeathPath: [],
      spawnMap: {
        1: { playerId: 1, tile: { x: 2, y: 2 }, direction: "down" },
        2: { playerId: 2, tile: { x: 5, y: 5 }, direction: "up" },
        3: { playerId: 3, tile: { x: 5, y: 5 }, direction: "up" },
        4: { playerId: 4, tile: { x: 5, y: 5 }, direction: "up" },
      },
    },
    solid,
    breakable: new Set(["3,2"]),
    powerUps: [],
  };
}

describe("segurança de bombas do bot determinístico", () => {
  it("não planta quando a única fuga cruza uma explosão antes da chegada", () => {
    const players = {
      1: player(1, { x: 2, y: 2 }),
      2: player(2, { x: 5, y: 5 }),
      3: player(3, { x: 5, y: 5 }, false),
      4: player(4, { x: 5, y: 5 }, false),
    };
    const context = {
      players,
      activePlayerIds: [1, 2],
      bombs: [{
        id: 7,
        ownerId: 2,
        tile: { x: 1, y: 3 },
        fuseMs: 300,
        ownerCanPass: false,
        flameRange: 1,
      }],
      flames: [],
      arena: corridorArena(),
      suddenDeathActive: false,
      suddenDeathTickMs: 900,
      suddenDeathIndex: 0,
      suddenDeathPath: [],
      suddenDeathClosureEffects: [],
      botBombCooldownMs: 0,
      botCommittedDirection: { 1: null, 2: null, 3: null, 4: null },
      botPendingReverseDirection: { 1: null, 2: null, 3: null, 4: null },
      botPendingReverseFrames: { 1: 0, 2: 0, 3: 0, 4: 0 },
      canOccupyPosition: () => true,
      evaluateMovementOption: () => ({}),
      canMovementOptionAdvance: () => true,
      areOppositeDirections: () => false,
      isPlayerOverlappingTile: (candidate, tile) => (
        candidate.tile.x === tile.x && candidate.tile.y === tile.y
      ),
    };

    expect(getBotDecision(players[1], context).placeBomb).toBe(false);
  });
});
