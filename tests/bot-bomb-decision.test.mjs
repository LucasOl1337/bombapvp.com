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
    },
    ...overrides,
  };
}

function arena(openTiles) {
  const open = new Set(openTiles);
  const solid = new Set();
  for (let y = 0; y < 7; y += 1) {
    for (let x = 0; x < 7; x += 1) {
      const key = `${x},${y}`;
      if (!open.has(key)) solid.add(key);
    }
  }
  return {
    config: {
      id: "bomb-decision-test",
      name: "Bomb decision test",
      status: "active",
      themeId: "default",
      grid: { width: 7, height: 7 },
      tiles: { solid: [...solid], breakable: [] },
      spawns: [],
      version: "test",
      createdAt: "2026-07-16T00:00:00.000Z",
      updatedAt: "2026-07-16T00:00:00.000Z",
      wrapPortals: [],
      suddenDeathPath: [],
      spawnMap: {},
    },
    solid,
    breakable: new Set(),
    powerUps: [],
  };
}

function context(players, testArena, bombs = []) {
  return {
    players,
    activePlayerIds: [1, 2],
    bombs,
    flames: [],
    arena: testArena,
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
    projectKillerBeeDashTarget: (candidate) => candidate.position,
    canMovementOptionAdvance: () => true,
    areOppositeDirections: () => false,
    isPlayerOverlappingTile: (candidate, tile) => (
      candidate.tile.x === tile.x && candidate.tile.y === tile.y
    ),
  };
}

describe("política competitiva do Bomb", () => {
  it("abandona imediatamente uma linha de explosão pela única rota temporalmente segura", () => {
    const players = {
      1: player(1, { x: 2, y: 2 }),
      2: player(2, { x: 2, y: 4 }),
      3: player(3, { x: 6, y: 6 }, { active: false, alive: false }),
      4: player(4, { x: 6, y: 6 }, { active: false, alive: false }),
    };
    const testArena = arena(["1,2", "2,2", "3,2", "2,3", "2,4"]);
    const bombs = [{
      id: 7,
      ownerId: 2,
      tile: { x: 1, y: 2 },
      fuseMs: 400,
      ownerCanPass: false,
      flameRange: 2,
    }];

    expect(getBombDecision(players[1], context(players, testArena, bombs))).toMatchObject({
      direction: "down",
      placeBomb: false,
    });
  });

  it("planta para fechar um alvo encurralado somente quando conserva uma fuga própria", () => {
    const players = {
      1: player(1, { x: 2, y: 2 }),
      2: player(2, { x: 2, y: 3 }),
      3: player(3, { x: 6, y: 6 }, { active: false, alive: false }),
      4: player(4, { x: 6, y: 6 }, { active: false, alive: false }),
    };
    const testArena = arena(["1,1", "1,2", "2,2", "2,3", "2,4"]);

    expect(getBombDecision(players[1], context(players, testArena))).toMatchObject({
      direction: "left",
      placeBomb: true,
      targetId: 2,
      intent: "bomb-attack",
    });
  });

  it("pressiona um alvo com rota de fuga e já abandona a bomba no mesmo frame", () => {
    const players = {
      1: player(1, { x: 2, y: 2 }),
      2: player(2, { x: 2, y: 4 }),
      3: player(3, { x: 6, y: 6 }, { active: false, alive: false }),
      4: player(4, { x: 6, y: 6 }, { active: false, alive: false }),
    };
    const testArena = arena(["1,1", "1,2", "2,2", "2,3", "2,4", "3,4", "4,4"]);

    expect(getBombDecision(players[1], context(players, testArena))).toMatchObject({
      direction: "left",
      placeBomb: true,
      targetId: 2,
      intent: "bomb-attack",
    });
  });

  it("abre uma caixa adjacente para criar território sem sacrificar a rota de fuga", () => {
    const players = {
      1: player(1, { x: 2, y: 2 }),
      2: player(2, { x: 5, y: 2 }),
      3: player(3, { x: 6, y: 6 }, { active: false, alive: false }),
      4: player(4, { x: 6, y: 6 }, { active: false, alive: false }),
    };
    const testArena = arena(["1,1", "1,2", "2,2", "3,2", "4,2", "5,2"]);
    testArena.solid.delete("3,2");
    testArena.breakable.add("3,2");
    testArena.config.tiles.solid = [...testArena.solid];
    testArena.config.tiles.breakable = ["3,2"];

    expect(getBombDecision(players[1], context(players, testArena))).toMatchObject({
      direction: "left",
      placeBomb: true,
      targetId: 2,
    });
  });

  it("desvia da perseguição para coletar um power-up defensivo visível", () => {
    const players = {
      1: player(1, { x: 1, y: 1 }),
      2: player(2, { x: 5, y: 1 }),
      3: player(3, { x: 6, y: 6 }, { active: false, alive: false }),
      4: player(4, { x: 6, y: 6 }, { active: false, alive: false }),
    };
    const testArena = arena(["1,1", "1,2", "1,3", "2,1", "3,1", "4,1", "5,1"]);
    testArena.powerUps.push({
      type: "shield-up",
      tile: { x: 1, y: 3 },
      revealed: true,
      collected: false,
    });

    expect(getBombDecision(players[1], context(players, testArena))).toMatchObject({
      direction: "down",
      placeBomb: false,
    });
  });

  it("detona remotamente quando a explosão alcança o alvo sem alcançar o próprio Bomb", () => {
    const players = {
      1: player(1, { x: 1, y: 2 }, { remoteLevel: 1, activeBombs: 1 }),
      2: player(2, { x: 2, y: 4 }),
      3: player(3, { x: 6, y: 6 }, { active: false, alive: false }),
      4: player(4, { x: 6, y: 6 }, { active: false, alive: false }),
    };
    const testArena = arena(["1,2", "2,2", "2,3", "2,4", "3,3"]);
    const bombs = [{
      id: 11,
      ownerId: 1,
      tile: { x: 2, y: 3 },
      fuseMs: 1_800,
      ownerCanPass: false,
      flameRange: 2,
    }];

    expect(getBombDecision(players[1], context(players, testArena, bombs))).toMatchObject({
      direction: null,
      placeBomb: false,
      detonate: true,
      targetId: 2,
      intent: "remote-detonation",
    });
  });

  it("avança para uma casa de pressão quando ainda não existe ataque seguro", () => {
    const players = {
      1: player(1, { x: 1, y: 1 }),
      2: player(2, { x: 4, y: 2 }),
      3: player(3, { x: 6, y: 6 }, { active: false, alive: false }),
      4: player(4, { x: 6, y: 6 }, { active: false, alive: false }),
    };
    const testArena = arena(["1,1", "1,2", "2,1", "2,2", "3,2", "4,2"]);

    expect(getBombDecision(players[1], context(players, testArena))).toMatchObject({
      direction: "down",
      placeBomb: false,
      targetId: 2,
      intent: "attack-position",
    });
  });

  it("usa a fase da Ranni quando a explosão é inevitável por movimento", () => {
    const players = {
      1: player(1, { x: 2, y: 2 }, {
        skill: {
          id: "ranni-ice-blink",
          phase: "idle",
          channelRemainingMs: 0,
          cooldownRemainingMs: 0,
          castElapsedMs: 0,
          projectedPosition: null,
          projectedLastMoveDirection: null,
        },
      }),
      2: player(2, { x: 5, y: 5 }),
      3: player(3, { x: 6, y: 6 }, { active: false, alive: false }),
      4: player(4, { x: 6, y: 6 }, { active: false, alive: false }),
    };
    const testArena = arena(["1,2", "2,2", "3,2", "5,5"]);
    const bombs = [{
      id: 19,
      ownerId: 2,
      tile: { x: 1, y: 2 },
      fuseMs: 350,
      ownerCanPass: false,
      flameRange: 2,
    }];

    expect(getBombDecision(players[1], context(players, testArena, bombs))).toMatchObject({
      direction: null,
      placeBomb: false,
      useSkill: true,
    });
  });
});
