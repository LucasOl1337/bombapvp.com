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
    roomBombPlacementThrottleMs: 0,
    botCommittedDirection: { 1: null, 2: null, 3: null, 4: null },
    botPendingReverseDirection: { 1: null, 2: null, 3: null, 4: null },
    botPendingReverseFrames: { 1: 0, 2: 0, 3: 0, 4: 0 },
    canOccupyPosition: () => false,
    evaluateMovementOption: () => ({}),
    projectKillerBeeDashTarget: (candidate) => ({ ...candidate.position }),
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

function safeDashContext() {
  const context = safeContactContext();
  const solid = new Set();
  for (let x = 0; x < 7; x += 1) {
    solid.add(`${x},0`);
    solid.add(`${x},4`);
  }
  for (let y = 0; y < 5; y += 1) {
    solid.add(`0,${y}`);
    solid.add(`6,${y}`);
  }
  context.arena.config.grid = { width: 7, height: 5 };
  context.arena.solid = solid;
  context.players[1].tile = { x: 1, y: 2 };
  context.players[1].position = { x: 1 * TILE_SIZE + TILE_SIZE / 2, y: 2 * TILE_SIZE + TILE_SIZE / 2 };
  context.players[2].tile = { x: 4, y: 2 };
  context.players[2].position = { x: 4 * TILE_SIZE + TILE_SIZE / 2, y: 2 * TILE_SIZE + TILE_SIZE / 2 };
  context.dangerMap = new Map();
  context.projectKillerBeeDashTarget = (candidate, direction) => {
    const delta = {
      up: { x: 0, y: -4 },
      down: { x: 0, y: 4 },
      left: { x: -4, y: 0 },
      right: { x: 4, y: 0 },
    }[direction];
    let position = { ...candidate.position };
    for (let distance = 0; distance < TILE_SIZE * 3; distance += 4) {
      const next = { x: position.x + delta.x, y: position.y + delta.y };
      const tile = { x: Math.floor(next.x / TILE_SIZE), y: Math.floor(next.y / TILE_SIZE) };
      const blocked = context.arena.solid.has(`${tile.x},${tile.y}`)
        || context.arena.breakable.has(`${tile.x},${tile.y}`)
        || context.bombs.some((bomb) => bomb.tile.x === tile.x && bomb.tile.y === tile.y);
      if (blocked) break;
      position = next;
    }
    return position;
  };
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

  it("usa o dash para fechar uma linha segura até o adversário", () => {
    const context = safeDashContext();

    expect(getBotV2Decision(context.players[1], context)).toMatchObject({
      direction: "right",
      useSkill: true,
      skillAction: "start",
      targetId: 2,
      intent: "chase-enemy",
    });
  });

  it.each(["2,2", "3,2", "4,2"])("não usa o dash quando %s do corredor está sob explosão iminente", (tile) => {
    const context = safeDashContext();
    context.dangerMap.set(tile, 300);

    expect(getBotV2Decision(context.players[1], context).useSkill).not.toBe(true);
  });

  it("não usa o dash quando uma bomba bloqueia o corredor", () => {
    const context = safeDashContext();
    context.bombs.push({ tile: { x: 3, y: 2 } });

    expect(getBotV2Decision(context.players[1], context).useSkill).not.toBe(true);
  });

  it("respeita a projeção de dash fornecida mesmo fora do centro da faixa", () => {
    const context = safeDashContext();
    context.players[1].position.y += TILE_SIZE / 3;

    expect(getBotV2Decision(context.players[1], context).useSkill).toBe(true);
  });

  it("não usa o dash quando a projeção canônica não consegue avançar", () => {
    const context = safeDashContext();
    context.projectKillerBeeDashTarget = (candidate) => ({ ...candidate.position });

    expect(getBotV2Decision(context.players[1], context).useSkill).not.toBe(true);
  });
});
