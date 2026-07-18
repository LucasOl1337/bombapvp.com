// @vitest-environment node

import { describe, expect, it } from "vitest";
import { getBombDecision } from "../src/original-game/Engine/bot-bomb.ts";
import { TILE_SIZE } from "../src/original-game/PersonalConfig/config.ts";

function player(id, tile, overrides = {}) {
  return {
    id,
    name: `P${id}`,
    active: true,
    tile: { ...tile },
    position: {
      x: tile.x * TILE_SIZE + TILE_SIZE / 2,
      y: tile.y * TILE_SIZE + TILE_SIZE / 2,
    },
    velocity: { x: 0, y: 0 },
    alive: true,
    direction: "down",
    lastMoveDirection: null,
    maxBombs: 1,
    activeBombs: 0,
    flameRange: 2,
    speedLevel: 0,
    remoteLevel: 0,
    shieldCharges: 0,
    bombPassLevel: 0,
    kickLevel: 0,
    shortFuseLevel: 0,
    flameGuardMs: 0,
    spawnProtectionMs: 0,
    skill: {
      id: "ranni-ice-blink",
      phase: "cooldown",
      channelRemainingMs: 0,
      cooldownRemainingMs: 1_000,
      castElapsedMs: 0,
      projectedPosition: null,
      projectedLastMoveDirection: null,
      projectedBombEgressIds: [],
    },
    ...overrides,
  };
}

function arena() {
  return {
    config: {
      grid: { width: 7, height: 7 },
      wrapPortals: [{ x: 3, y: 0 }],
    },
    solid: new Set(),
    breakable: new Set(),
    powerUps: [],
  };
}

function context(players, overrides = {}) {
  return {
    players,
    activePlayerIds: [1, 2],
    bombs: [],
    flames: [{ ownerId: 1, tile: { x: 3, y: 6 }, remainingMs: 0 }],
    arena: arena(),
    suddenDeathActive: false,
    suddenDeathTickMs: 900,
    suddenDeathIndex: 0,
    suddenDeathPath: [],
    suddenDeathClosureEffects: [],
    roomBombPlacementThrottleMs: 0,
    botCommittedDirection: { 1: null, 2: null, 3: null, 4: null },
    botPendingReverseDirection: { 1: null, 2: null, 3: null, 4: null },
    botPendingReverseFrames: { 1: 0, 2: 0, 3: 0, 4: 0 },
    canOccupyPosition: () => true,
    evaluateMovementOption: (_candidate, direction) => ({ direction }),
    evaluateProjectedMovementOption: (_candidate, direction) => ({ direction }),
    projectSkillTarget: (candidate) => candidate.position,
    canMovementOptionAdvance: () => true,
    areOppositeDirections: (first, second) => (
      (first === "up" && second === "down")
      || (first === "down" && second === "up")
      || (first === "left" && second === "right")
      || (first === "right" && second === "left")
    ),
    isPlayerOverlappingTile: (candidate, tile) => (
      candidate.tile.x === tile.x && candidate.tile.y === tile.y
    ),
    ...overrides,
  };
}

describe("Bomb ignora FlameState expirada", () => {
  it("mantém a saída corporal pelo portal quando a chama própria já expirou", () => {
    const players = {
      1: player(1, { x: 3, y: 0 }, {
        position: { x: 3 * TILE_SIZE + TILE_SIZE / 2, y: 1 },
      }),
      2: player(2, { x: 3, y: 0 }),
    };

    expect(getBombDecision(players[1], context(players))).toMatchObject({
      direction: "up",
      placeBomb: false,
    });
  });

  it("não cancela o ataque por uma chama própria expirada na rota comprometida", () => {
    const players = {
      1: player(1, { x: 3, y: 0 }),
      2: player(2, { x: 3, y: 1 }),
    };
    const attackContext = context(players, {
      botCommittedDirection: { 1: "up", 2: null, 3: null, 4: null },
    });

    expect(getBombDecision(players[1], attackContext)).toMatchObject({
      placeBomb: true,
      intent: "bomb-attack",
    });
  });

  it("cancela o ataque quando a rota comprometida entra em chama ativa e não há saída", () => {
    const players = {
      1: player(1, { x: 3, y: 0 }),
      2: player(2, { x: 3, y: 1 }),
    };
    const trappedContext = context(players, {
      flames: [{ ownerId: 1, tile: { x: 3, y: 6 }, remainingMs: 300 }],
      botCommittedDirection: { 1: "up", 2: null, 3: null, 4: null },
      canMovementOptionAdvance: () => false,
    });

    expect(getBombDecision(players[1], trappedContext)).toMatchObject({
      direction: null,
      placeBomb: false,
    });
  });
});
