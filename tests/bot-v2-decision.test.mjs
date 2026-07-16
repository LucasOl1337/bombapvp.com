import { describe, expect, it } from "vitest";
import { getBotV2Decision } from "../src/original-game/Engine/bot-v2.ts";
import { TILE_SIZE } from "../src/original-game/PersonalConfig/config.ts";

function player(id) {
  return {
    id,
    name: `P${id}`,
    active: true,
    tile: { x: 2, y: 2 },
    position: { x: 2 * TILE_SIZE + TILE_SIZE / 2, y: 2 * TILE_SIZE + TILE_SIZE / 2 },
    velocity: { x: 0, y: 0 },
    alive: true,
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
      id: "killer-bee-wing-dash",
      phase: "idle",
      channelRemainingMs: 0,
      cooldownRemainingMs: 0,
      castElapsedMs: 0,
      projectedPosition: null,
      projectedLastMoveDirection: null,
    },
  };
}

function trappedContactContext() {
  const solid = new Set();
  for (let y = 0; y < 5; y += 1) {
    for (let x = 0; x < 5; x += 1) {
      if (x !== 2 || y !== 2) solid.add(`${x},${y}`);
    }
  }
  const players = { 1: player(1), 2: player(2), 3: player(3), 4: player(4) };
  players[3].active = players[3].alive = false;
  players[4].active = players[4].alive = false;
  return {
    players,
    activePlayerIds: [1, 2],
    bombs: [],
    flames: [],
    arena: {
      config: { grid: { width: 5, height: 5 }, wrapPortals: [] },
      solid,
      breakable: new Set(),
      powerUps: [],
    },
    suddenDeathActive: false,
    suddenDeathTickMs: 900,
    suddenDeathIndex: 0,
    suddenDeathPath: [],
    suddenDeathClosureEffects: [],
    botBombCooldownMs: 0,
    botCommittedDirection: { 1: null, 2: null, 3: null, 4: null },
    botPendingReverseDirection: { 1: null, 2: null, 3: null, 4: null },
    botPendingReverseFrames: { 1: 0, 2: 0, 3: 0, 4: 0 },
    canOccupyPosition: () => false,
    evaluateMovementOption: () => ({}),
    canMovementOptionAdvance: () => false,
    areOppositeDirections: () => false,
    isPlayerOverlappingTile: (candidate, tile) => candidate.tile.x === tile.x && candidate.tile.y === tile.y,
  };
}

function safeContactContext() {
  const context = trappedContactContext();
  context.arena.solid.delete("2,3");
  context.arena.solid.delete("2,4");
  context.canOccupyPosition = () => true;
  context.canMovementOptionAdvance = () => true;
  return context;
}

describe("segurança do bot V2", () => {
  it("não força a bomba de contato quando não existe rota de fuga", () => {
    const context = trappedContactContext();

    expect(getBotV2Decision(context.players[1], context).placeBomb).toBe(false);
  });

  it("ataca no contato quando existe rota de fuga comprovada", () => {
    const context = safeContactContext();

    expect(getBotV2Decision(context.players[1], context)).toMatchObject({
      placeBomb: true,
      targetId: 2,
      intent: "bomb-attack",
    });
  });
});
