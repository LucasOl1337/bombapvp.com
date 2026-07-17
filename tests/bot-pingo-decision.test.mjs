// @vitest-environment node

import { describe, expect, it } from "vitest";
import { createDefaultArenaDefinition } from "../src/original-game/Arenas/arena.ts";
import { getBotPingoDecision } from "../src/original-game/Engine/bot-pingo.ts";

const TILE_SIZE = 40;
const STANDARD_SOLID = createDefaultArenaDefinition().tiles.solid.map((entry) => {
  const [x, y] = entry.split(",").map(Number);
  return { x, y };
});
const STANDARD_BREAKABLE = createDefaultArenaDefinition().tiles.breakable.map((entry) => {
  const [x, y] = entry.split(",").map(Number);
  return { x, y };
});

function tileKey(x, y) {
  return `${x},${y}`;
}

function player(id, x, y, overrides = {}) {
  return {
    id,
    name: `P${id}`,
    active: true,
    tile: { x, y },
    position: { x: x * TILE_SIZE + TILE_SIZE / 2, y: y * TILE_SIZE + TILE_SIZE / 2 },
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
      id: null,
      phase: "idle",
      channelRemainingMs: 0,
      cooldownRemainingMs: 0,
      castElapsedMs: 0,
      projectedPosition: null,
      projectedLastMoveDirection: null,
      projectedBombEgressIds: [],
    },
    ...overrides,
  };
}

function context({
  players,
  bombs = [],
  powerUps = [],
  solid = [],
  breakable = [],
  width = 7,
  height = 5,
  wrapPortals = [],
  suddenDeathActive = false,
  suddenDeathTickMs = 0,
  suddenDeathIndex = 0,
  suddenDeathPath = [],
  suddenDeathClosureEffects = [],
  evaluateMovementOption = (_subject, direction) => ({ direction }),
  evaluateProjectedMovementOption = evaluateMovementOption,
  canMovementOptionAdvance = () => true,
  isPlayerOverlappingTile = (subject, tile) => {
    const half = TILE_SIZE / 2;
    const tileLeft = tile.x * TILE_SIZE;
    const tileTop = tile.y * TILE_SIZE;
    return subject.position.x - half < tileLeft + TILE_SIZE
      && subject.position.x + half > tileLeft
      && subject.position.y - half < tileTop + TILE_SIZE
      && subject.position.y + half > tileTop;
  },
}) {
  const solidTiles = new Set(solid.map(({ x, y }) => tileKey(x, y)));
  const breakableTiles = new Set(breakable.map(({ x, y }) => tileKey(x, y)));
  return {
    players,
    activePlayerIds: Object.keys(players).map(Number),
    bombs,
    flames: [],
    arena: {
      config: {
        grid: { width, height },
        wrapPortals,
        suddenDeathPath: [],
      },
      solid: solidTiles,
      breakable: breakableTiles,
      powerUps,
    },
    suddenDeathActive,
    suddenDeathTickMs,
    suddenDeathIndex,
    suddenDeathPath,
    suddenDeathClosureEffects,
    botBombCooldownMs: 0,
    botCommittedDirection: { 1: null, 2: null, 3: null, 4: null },
    botPendingReverseDirection: { 1: null, 2: null, 3: null, 4: null },
    botPendingReverseFrames: { 1: 0, 2: 0, 3: 0, 4: 0 },
    canOccupyPosition: (_position, tile) => (
      tile.x >= 0
      && tile.y >= 0
      && tile.x < width
      && tile.y < height
      && !solidTiles.has(tileKey(tile.x, tile.y))
      && !breakableTiles.has(tileKey(tile.x, tile.y))
    ),
    evaluateMovementOption,
    evaluateProjectedMovementOption,
    projectKillerBeeDashTarget: (subject) => subject.position,
    canMovementOptionAdvance,
    areOppositeDirections: () => false,
    isPlayerOverlappingTile,
  };
}

function projectedBombEgressDecision({
  egressIds,
  projectedPosition = { x: 220, y: 39.17 },
  projectedLastMoveDirection = "up",
  solid = [{ x: 4, y: 0 }, { x: 6, y: 0 }, { x: 5, y: 1 }],
  wrapPortals = [{ x: 5, y: 0 }],
}) {
  const pingo = player(1, 5, 0, {
    skill: {
      id: "ranni-ice-blink",
      phase: "channeling",
      channelRemainingMs: 900,
      cooldownRemainingMs: 0,
      castElapsedMs: 600,
      projectedPosition,
      projectedLastMoveDirection,
      projectedBombEgressIds: egressIds,
    },
  });
  const enemy = player(2, 9, 7);
  return getBotPingoDecision(pingo, context({
    players: { 1: pingo, 2: enemy },
    width: 11,
    height: 9,
    wrapPortals,
    solid,
    bombs: [
      { id: 22, ownerId: 2, tile: { x: 5, y: 0 }, fuseMs: 600, ownerCanPass: false, flameRange: 1 },
    ],
    evaluateMovementOption: (_subject, direction) => ({ direction, projected: false }),
    evaluateProjectedMovementOption: (subject, direction) => ({
      direction,
      projected: true,
      egressIds: subject.skill.projectedBombEgressIds,
    }),
    canMovementOptionAdvance: (_position, option) => (
      option.projected
      && option.direction === projectedLastMoveDirection
      && option.egressIds.includes(22)
    ),
  }));
}

function controlledPocketDecision({
  pingoOverrides = {},
  enemyTile = { x: 2, y: 2 },
  enemyOverrides = {},
  solid = [{ x: 1, y: 1 }, { x: 2, y: 0 }, { x: 3, y: 1 }],
} = {}) {
  const pingo = player(1, 2, 2, {
    skill: {
      id: "ranni-ice-blink",
      phase: "cooldown",
      channelRemainingMs: 0,
      cooldownRemainingMs: 5_000,
      castElapsedMs: 0,
      projectedPosition: null,
      projectedLastMoveDirection: null,
      projectedBombEgressIds: [],
    },
    ...pingoOverrides,
  });
  const enemy = player(2, enemyTile.x, enemyTile.y, enemyOverrides);
  return getBotPingoDecision(pingo, context({
    players: { 1: pingo, 2: enemy },
    solid,
    powerUps: [{ tile: { x: 2, y: 1 }, revealed: true, collected: false }],
  }));
}

describe("política Pingo", () => {
  it("reage imediatamente à bomba remota rival quando ficaria parado no choke", () => {
    const pingo = player(1, 3, 2, {
      skill: {
        id: "ranni-ice-blink",
        phase: "idle",
        channelRemainingMs: 0,
        cooldownRemainingMs: 0,
        castElapsedMs: 0,
        projectedPosition: null,
        projectedLastMoveDirection: null,
        projectedBombEgressIds: [],
      },
    });
    const enemy = player(2, 5, 4, { remoteLevel: 1 });
    const decision = getBotPingoDecision(pingo, context({
      players: { 1: pingo, 2: enemy },
      solid: [{ x: 2, y: 2 }, { x: 4, y: 2 }, { x: 3, y: 3 }],
      bombs: [
        { id: 30, ownerId: 2, tile: { x: 3, y: 1 }, fuseMs: 1_800, ownerCanPass: false, flameRange: 1 },
      ],
    }));

    expect(decision).toMatchObject({ direction: null, placeBomb: false, useSkill: true });
  });

  it("mantém o fuse real da própria bomba remota", () => {
    const pingo = player(1, 3, 2, {
      activeBombs: 1,
      remoteLevel: 1,
      skill: {
        id: "ranni-ice-blink",
        phase: "idle",
        channelRemainingMs: 0,
        cooldownRemainingMs: 0,
        castElapsedMs: 0,
        projectedPosition: null,
        projectedLastMoveDirection: null,
        projectedBombEgressIds: [],
      },
    });
    const enemy = player(2, 5, 4);
    const decision = getBotPingoDecision(pingo, context({
      players: { 1: pingo, 2: enemy },
      solid: [{ x: 2, y: 2 }, { x: 4, y: 2 }, { x: 3, y: 3 }],
      bombs: [
        { id: 31, ownerId: 1, tile: { x: 3, y: 1 }, fuseMs: 1_800, ownerCanPass: false, flameRange: 1 },
      ],
    }));

    expect(decision).toMatchObject({ direction: null, placeBomb: false, useSkill: false });
  });

  it("não antecipa a bomba remota de um dono inativo", () => {
    const pingo = player(1, 3, 2, {
      skill: {
        id: "ranni-ice-blink",
        phase: "idle",
        channelRemainingMs: 0,
        cooldownRemainingMs: 0,
        castElapsedMs: 0,
        projectedPosition: null,
        projectedLastMoveDirection: null,
        projectedBombEgressIds: [],
      },
    });
    const enemy = player(2, 5, 4, { active: false, remoteLevel: 1 });
    const decision = getBotPingoDecision(pingo, context({
      players: { 1: pingo, 2: enemy },
      solid: [{ x: 2, y: 2 }, { x: 4, y: 2 }, { x: 3, y: 3 }],
      bombs: [
        { id: 32, ownerId: 2, tile: { x: 3, y: 1 }, fuseMs: 1_800, ownerCanPass: false, flameRange: 1 },
      ],
    }));

    expect(decision).toMatchObject({ direction: null, placeBomb: false, useSkill: false });
  });

  it("não antecipa a bomba remota de um dono eliminado", () => {
    const pingo = player(1, 3, 2, {
      skill: {
        id: "ranni-ice-blink",
        phase: "idle",
        channelRemainingMs: 0,
        cooldownRemainingMs: 0,
        castElapsedMs: 0,
        projectedPosition: null,
        projectedLastMoveDirection: null,
        projectedBombEgressIds: [],
      },
    });
    const enemy = player(2, 5, 4, { alive: false, remoteLevel: 1 });
    const decision = getBotPingoDecision(pingo, context({
      players: { 1: pingo, 2: enemy },
      solid: [{ x: 2, y: 2 }, { x: 4, y: 2 }, { x: 3, y: 3 }],
      bombs: [
        { id: 33, ownerId: 2, tile: { x: 3, y: 1 }, fuseMs: 1_800, ownerCanPass: false, flameRange: 1 },
      ],
    }));

    expect(decision).toMatchObject({ direction: null, placeBomb: false, useSkill: false });
  });

  it("mantém o fuse real da bomba rival quando o dono não tem remote", () => {
    const pingo = player(1, 3, 2, {
      skill: {
        id: "ranni-ice-blink",
        phase: "idle",
        channelRemainingMs: 0,
        cooldownRemainingMs: 0,
        castElapsedMs: 0,
        projectedPosition: null,
        projectedLastMoveDirection: null,
        projectedBombEgressIds: [],
      },
    });
    const enemy = player(2, 5, 4);
    const decision = getBotPingoDecision(pingo, context({
      players: { 1: pingo, 2: enemy },
      solid: [{ x: 2, y: 2 }, { x: 4, y: 2 }, { x: 3, y: 3 }],
      bombs: [
        { id: 34, ownerId: 2, tile: { x: 3, y: 1 }, fuseMs: 1_800, ownerCanPass: false, flameRange: 1 },
      ],
    }));

    expect(decision).toMatchObject({ direction: null, placeBomb: false, useSkill: false });
  });

  it("mantém o fuse real quando o ownerId da bomba não resolve", () => {
    const pingo = player(1, 3, 2, {
      skill: {
        id: "ranni-ice-blink",
        phase: "idle",
        channelRemainingMs: 0,
        cooldownRemainingMs: 0,
        castElapsedMs: 0,
        projectedPosition: null,
        projectedLastMoveDirection: null,
        projectedBombEgressIds: [],
      },
    });
    const enemy = player(2, 5, 4);
    const decision = getBotPingoDecision(pingo, context({
      players: { 1: pingo, 2: enemy },
      solid: [{ x: 2, y: 2 }, { x: 4, y: 2 }, { x: 3, y: 3 }],
      bombs: [
        { id: 36, ownerId: 4, tile: { x: 3, y: 1 }, fuseMs: 1_800, ownerCanPass: false, flameRange: 1 },
      ],
    }));

    expect(decision).toMatchObject({ direction: null, placeBomb: false, useSkill: false });
  });

  it("ignora a detonação remota rival fora da rota e do blast", () => {
    const pingo = player(1, 1, 2);
    const enemy = player(2, 5, 2, { remoteLevel: 1 });
    const decision = getBotPingoDecision(pingo, context({
      players: { 1: pingo, 2: enemy },
      solid: [{ x: 1, y: 1 }, { x: 1, y: 3 }],
      bombs: [
        { id: 35, ownerId: 2, tile: { x: 6, y: 0 }, fuseMs: 1_800, ownerCanPass: false, flameRange: 1 },
      ],
    }));

    expect(decision).toMatchObject({ direction: "right", placeBomb: false, useSkill: false });
  });

  it("não avança para dentro do blast de uma bomba remota rival", () => {
    const pingo = player(1, 1, 2);
    const enemy = player(2, 3, 2, { remoteLevel: 1 });
    const decision = getBotPingoDecision(pingo, context({
      players: { 1: pingo, 2: enemy },
      solid: [{ x: 0, y: 2 }, { x: 1, y: 1 }, { x: 1, y: 3 }],
      bombs: [
        { id: 37, ownerId: 2, tile: { x: 2, y: 1 }, fuseMs: 1_800, ownerCanPass: false, flameRange: 1 },
      ],
    }));

    expect(decision).toMatchObject({ direction: null, placeBomb: false, useSkill: false });
  });

  it("propaga a ETA imediata da bomba remota pela reação em cadeia", () => {
    const pingo = player(1, 3, 2, {
      skill: {
        id: "ranni-ice-blink",
        phase: "idle",
        channelRemainingMs: 0,
        cooldownRemainingMs: 0,
        castElapsedMs: 0,
        projectedPosition: null,
        projectedLastMoveDirection: null,
        projectedBombEgressIds: [],
      },
    });
    const remoteEnemy = player(2, 5, 4, { remoteLevel: 1 });
    const otherEnemy = player(3, 6, 4);
    const decision = getBotPingoDecision(pingo, context({
      players: { 1: pingo, 2: remoteEnemy, 3: otherEnemy },
      solid: [{ x: 2, y: 2 }, { x: 4, y: 2 }, { x: 3, y: 3 }],
      bombs: [
        { id: 38, ownerId: 2, tile: { x: 1, y: 1 }, fuseMs: 1_800, ownerCanPass: false, flameRange: 2 },
        { id: 39, ownerId: 3, tile: { x: 3, y: 1 }, fuseMs: 1_900, ownerCanPass: false, flameRange: 1 },
      ],
    }));

    expect(decision).toMatchObject({ direction: null, placeBomb: false, useSkill: true });
  });

  it("abandona um corredor prestes a explodir pela única saída segura", () => {
    const pingo = player(1, 3, 2);
    const enemy = player(2, 5, 2);
    const decision = getBotPingoDecision(pingo, context({
      players: { 1: pingo, 2: enemy },
      solid: [{ x: 3, y: 1 }],
      bombs: [{ id: 1, ownerId: 2, tile: { x: 1, y: 2 }, fuseMs: 500, ownerCanPass: false, flameRange: 4 }],
    }));

    expect(decision).toMatchObject({ direction: "down", placeBomb: false, detonate: false });
  });

  it("continua a fuga da própria bomba mesmo quando o fuse ainda é longo", () => {
    const pingo = player(1, 5, 1, { activeBombs: 1 });
    const enemy = player(2, 5, 3);
    const decision = getBotPingoDecision(pingo, context({
      players: { 1: pingo, 2: enemy },
      solid: [
        { x: 6, y: 1 },
        ...Array.from({ length: 7 }, (_, x) => ({ x, y: 2 })),
      ],
      bombs: [{ id: 1, ownerId: 1, tile: { x: 5, y: 0 }, fuseMs: 1_800, ownerCanPass: false, flameRange: 1 }],
    }));

    expect(decision).toMatchObject({ direction: "left", placeBomb: false });
  });

  it("mantém a rota completa e não entra num bolsão durante a fuga", () => {
    const pingo = player(1, 1, 1, { activeBombs: 1, flameRange: 2 });
    const enemy = player(2, 6, 4);
    const decision = getBotPingoDecision(pingo, context({
      players: { 1: pingo, 2: enemy },
      solid: [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 2 }, { x: 1, y: 2 }],
      bombs: [{ id: 1, ownerId: 1, tile: { x: 1, y: 1 }, fuseMs: 1_800, ownerCanPass: true, flameRange: 2 }],
    }));

    expect(decision).toMatchObject({ direction: "right", placeBomb: false });
  });

  it("volta ao centro da casa antes de virar durante uma fuga", () => {
    const pingo = player(1, 6, 1, {
      activeBombs: 1,
      position: { x: 260, y: 76.67 },
      skill: {
        id: "ranni-ice-blink",
        phase: "cooldown",
        channelRemainingMs: 0,
        cooldownRemainingMs: 350,
        castElapsedMs: 0,
        projectedPosition: null,
        projectedLastMoveDirection: null,
      },
    });
    const enemy = player(2, 9, 7);
    const decision = getBotPingoDecision(pingo, context({
      players: { 1: pingo, 2: enemy },
      width: 11,
      height: 9,
      solid: STANDARD_SOLID,
      bombs: [
        { id: 11, ownerId: 1, tile: { x: 5, y: 1 }, fuseMs: 500, ownerCanPass: false, flameRange: 1 },
        { id: 12, ownerId: 2, tile: { x: 6, y: 2 }, fuseMs: 1_400, ownerCanPass: false, flameRange: 1 },
      ],
    }));

    expect(decision).toMatchObject({ direction: "up", placeBomb: false });
  });

  it("retoma o centro ameaçado quando a rota discreta fica sem saída", () => {
    const pingo = player(1, 3, 4, {
      activeBombs: 1,
      position: { x: 140, y: 198.75 },
      skill: {
        id: "ranni-ice-blink",
        phase: "cooldown",
        channelRemainingMs: 0,
        cooldownRemainingMs: 5_583,
        castElapsedMs: 0,
        projectedPosition: null,
        projectedLastMoveDirection: null,
      },
    });
    const enemy = player(2, 9, 7);
    const decision = getBotPingoDecision(pingo, context({
      players: { 1: pingo, 2: enemy },
      width: 11,
      height: 9,
      solid: STANDARD_SOLID,
      bombs: [
        { id: 3, ownerId: 1, tile: { x: 4, y: 4 }, fuseMs: 500, ownerCanPass: false, flameRange: 1 },
        { id: 4, ownerId: 2, tile: { x: 3, y: 5 }, fuseMs: 1_500, ownerCanPass: false, flameRange: 1 },
      ],
    }));

    expect(decision).toMatchObject({ direction: "up", placeBomb: false });
  });

  it("abandona a correção de centro bloqueada pelo sentido que realmente avança", () => {
    const pingo = player(1, 1, 5, {
      activeBombs: 1,
      position: { x: 60, y: 208.83 },
    });
    const enemy = player(2, 6, 4);
    const decision = getBotPingoDecision(pingo, context({
      players: { 1: pingo, 2: enemy },
      width: 11,
      height: 9,
      bombs: [{ id: 7, ownerId: 1, tile: { x: 1, y: 6 }, fuseMs: 500, ownerCanPass: false, flameRange: 1 }],
      canMovementOptionAdvance: (_position, option) => option.direction !== "down",
    }));

    expect(decision).toMatchObject({ direction: "up", placeBomb: false });
  });

  it("entra na fase da Ranni quando o impacto é inevitável por movimento", () => {
    const pingo = player(1, 1, 0, {
      activeBombs: 1,
      skill: {
        id: "ranni-ice-blink",
        phase: "idle",
        channelRemainingMs: 0,
        cooldownRemainingMs: 0,
        castElapsedMs: 0,
        projectedPosition: null,
        projectedLastMoveDirection: null,
      },
    });
    const enemy = player(2, 6, 4);
    const decision = getBotPingoDecision(pingo, context({
      players: { 1: pingo, 2: enemy },
      solid: [{ x: 0, y: 0 }, { x: 2, y: 0 }],
      bombs: [{ id: 1, ownerId: 1, tile: { x: 1, y: 1 }, fuseMs: 1_000, ownerCanPass: false, flameRange: 1 }],
    }));

    expect(decision).toMatchObject({ direction: null, placeBomb: false, useSkill: true });
  });

  it("entra na fase quando a saída existe mas não há tempo para limpar a casa atual", () => {
    const pingo = player(1, 5, 1, {
      activeBombs: 1,
      skill: {
        id: "ranni-ice-blink",
        phase: "idle",
        channelRemainingMs: 0,
        cooldownRemainingMs: 0,
        castElapsedMs: 0,
        projectedPosition: null,
        projectedLastMoveDirection: null,
      },
    });
    const enemy = player(2, 6, 4);
    const decision = getBotPingoDecision(pingo, context({
      players: { 1: pingo, 2: enemy },
      bombs: [{ id: 1, ownerId: 1, tile: { x: 4, y: 1 }, fuseMs: 200, ownerCanPass: false, flameRange: 1 }],
    }));

    expect(decision).toMatchObject({ placeBomb: false, useSkill: true });
  });

  it("trata a próxima casa do sudden death como ameaça temporal", () => {
    const pingo = player(1, 1, 5, {
      position: { x: 60, y: 234.64 },
      skill: {
        id: "ranni-ice-blink",
        phase: "idle",
        channelRemainingMs: 0,
        cooldownRemainingMs: 0,
        castElapsedMs: 0,
        projectedPosition: null,
        projectedLastMoveDirection: null,
      },
    });
    const enemy = player(2, 6, 4);
    const decision = getBotPingoDecision(pingo, context({
      players: { 1: pingo, 2: enemy },
      width: 11,
      height: 9,
      suddenDeathActive: true,
      suddenDeathTickMs: 233,
      suddenDeathPath: [{ x: 1, y: 5 }, { x: 1, y: 4 }, { x: 1, y: 3 }],
    }));

    expect(decision).toMatchObject({ direction: "up", placeBomb: false, useSkill: true });
  });

  it("se afasta de uma casa do sudden death que já começou a cair", () => {
    const pingo = player(1, 6, 2, {
      position: { x: 260, y: 96.81 },
      skill: {
        id: "ranni-ice-blink",
        phase: "cooldown",
        channelRemainingMs: 0,
        cooldownRemainingMs: 7_500,
        castElapsedMs: 0,
        projectedPosition: null,
        projectedLastMoveDirection: null,
      },
    });
    const enemy = player(2, 6, 0);
    const decision = getBotPingoDecision(pingo, context({
      players: { 1: pingo, 2: enemy },
      width: 11,
      height: 9,
      solid: [{ x: 5, y: 2 }, { x: 7, y: 2 }],
      suddenDeathActive: true,
      suddenDeathIndex: 1,
      suddenDeathPath: [{ x: 7, y: 1 }],
      suddenDeathClosureEffects: [
        { tile: { x: 6, y: 1 }, elapsedMs: 0, impacted: false },
      ],
    }));

    expect(decision).toMatchObject({ direction: "down", placeBomb: false });
  });

  it("encerra a fase da Ranni assim que a projeção já saiu de todas as explosões", () => {
    const pingo = player(1, 1, 2, {
      activeBombs: 1,
      position: { x: 60, y: 105.42 },
      skill: {
        id: "ranni-ice-blink",
        phase: "channeling",
        channelRemainingMs: 850,
        cooldownRemainingMs: 0,
        castElapsedMs: 650,
        projectedPosition: { x: 60, y: 180 },
        projectedLastMoveDirection: "down",
      },
    });
    const enemy = player(2, 5, 2);
    const decision = getBotPingoDecision(pingo, context({
      players: { 1: pingo, 2: enemy },
      width: 11,
      height: 9,
      bombs: [
        { id: 7, ownerId: 1, tile: { x: 1, y: 1 }, fuseMs: 867, ownerCanPass: false, flameRange: 2 },
      ],
    }));

    expect(decision).toMatchObject({ useSkill: true, skillAction: "release" });
  });

  it("não libera a Ranni sobre a fronteira entre duas casas", () => {
    const pingo = player(1, 0, 3, {
      skill: {
        id: "ranni-ice-blink",
        phase: "channeling",
        channelRemainingMs: 400,
        cooldownRemainingMs: 0,
        castElapsedMs: 1_100,
        projectedPosition: { x: 38.75, y: 140 },
        projectedLastMoveDirection: "left",
      },
    });
    const enemy = player(2, 9, 3);
    const decision = getBotPingoDecision(pingo, context({
      players: { 1: pingo, 2: enemy },
      width: 11,
      height: 9,
    }));

    expect(decision).toMatchObject({ useSkill: false });
    expect(decision.skillAction).toBeUndefined();
  });

  it("não libera a Ranni enquanto a projeção ainda usa egress de bomba", () => {
    const pingo = player(1, 5, 1, {
      skill: {
        id: "ranni-ice-blink",
        phase: "channeling",
        channelRemainingMs: 950,
        cooldownRemainingMs: 0,
        castElapsedMs: 550,
        projectedPosition: { x: 220, y: 340.83 },
        projectedLastMoveDirection: "up",
        projectedBombEgressIds: [22],
      },
    });
    const enemy = player(2, 9, 7);
    const decision = getBotPingoDecision(pingo, context({
      players: { 1: pingo, 2: enemy },
      width: 11,
      height: 9,
      bombs: [
        { id: 22, ownerId: 2, tile: { x: 5, y: 0 }, fuseMs: 1_533, ownerCanPass: false, flameRange: 1 },
      ],
    }));

    expect(decision).toMatchObject({ useSkill: false });
    expect(decision.skillAction).toBeUndefined();
  });

  it("mantém o sentido projetado até centralizar a nova casa", () => {
    const pingo = player(1, 0, 3, {
      skill: {
        id: "ranni-ice-blink",
        phase: "channeling",
        channelRemainingMs: 500,
        cooldownRemainingMs: 0,
        castElapsedMs: 1_000,
        projectedPosition: { x: 40.83, y: 140 },
        projectedLastMoveDirection: "right",
      },
    });
    const enemy = player(2, 9, 3);
    const decision = getBotPingoDecision(pingo, context({
      players: { 1: pingo, 2: enemy },
      width: 11,
      height: 9,
    }));

    expect(decision).toMatchObject({ direction: "right", useSkill: false });
  });

  it("navega a fase pela posição projetada quando o corpo real aponta para uma rota bloqueada", () => {
    const pingo = player(1, 6, 4, {
      activeBombs: 1,
      position: { x: 260.4, y: 180 },
      skill: {
        id: "ranni-ice-blink",
        phase: "channeling",
        channelRemainingMs: 500,
        cooldownRemainingMs: 0,
        castElapsedMs: 1_000,
        projectedPosition: { x: 220.81, y: 180 },
        projectedLastMoveDirection: "left",
      },
    });
    const enemy = player(2, 1, 1);
    const decision = getBotPingoDecision(pingo, context({
      players: { 1: pingo, 2: enemy },
      width: 11,
      height: 9,
      solid: STANDARD_SOLID,
      bombs: [
        { id: 8, ownerId: 1, tile: { x: 4, y: 4 }, fuseMs: 500, ownerCanPass: false, flameRange: 3 },
      ],
    }));

    expect(decision).toMatchObject({ direction: "right", useSkill: false });
  });

  it("descarta o primeiro passo da Ranni quando a projeção não consegue avançar", () => {
    const pingo = player(1, 2, 2, {
      activeBombs: 1,
      skill: {
        id: "ranni-ice-blink",
        phase: "channeling",
        channelRemainingMs: 900,
        cooldownRemainingMs: 0,
        castElapsedMs: 600,
        projectedPosition: { x: 100, y: 100 },
        projectedLastMoveDirection: "up",
      },
    });
    const enemy = player(2, 5, 2);
    const decision = getBotPingoDecision(pingo, context({
      players: { 1: pingo, 2: enemy },
      bombs: [
        { id: 20, ownerId: 2, tile: { x: 2, y: 1 }, fuseMs: 800, ownerCanPass: false, flameRange: 1 },
      ],
      canMovementOptionAdvance: (_position, option) => option.direction !== "left",
    }));

    expect(decision).toMatchObject({ direction: "down", useSkill: false });
  });

  it("atravessa o portal de borda quando é a única fuga projetada da Ranni", () => {
    const pingo = player(1, 5, 1, {
      skill: {
        id: "ranni-ice-blink",
        phase: "channeling",
        channelRemainingMs: 900,
        cooldownRemainingMs: 0,
        castElapsedMs: 600,
        projectedPosition: { x: 220, y: 39.17 },
        projectedLastMoveDirection: "up",
      },
    });
    const enemy = player(2, 9, 7);
    const decision = getBotPingoDecision(pingo, context({
      players: { 1: pingo, 2: enemy },
      width: 11,
      height: 9,
      wrapPortals: [{ x: 5, y: 0 }],
      solid: [{ x: 4, y: 0 }, { x: 6, y: 0 }, { x: 5, y: 1 }],
      bombs: [
        { id: 22, ownerId: 2, tile: { x: 5, y: 0 }, fuseMs: 600, ownerCanPass: false, flameRange: 1 },
      ],
    }));

    expect(decision).toMatchObject({ direction: "up", useSkill: false });
  });

  it("atravessa o portal inferior quando é a única fuga corporal da explosão", () => {
    const pingo = player(1, 5, 8, {
      skill: {
        id: "ranni-ice-blink",
        phase: "cooldown",
        channelRemainingMs: 0,
        cooldownRemainingMs: 5_000,
        castElapsedMs: 0,
        projectedPosition: null,
        projectedLastMoveDirection: null,
        projectedBombEgressIds: [],
      },
    });
    const enemy = player(2, 5, 7);
    const decision = getBotPingoDecision(pingo, context({
      players: { 1: pingo, 2: enemy },
      width: 11,
      height: 9,
      wrapPortals: [{ x: 5, y: 0 }, { x: 5, y: 8 }],
      solid: [{ x: 4, y: 8 }, { x: 6, y: 8 }],
      bombs: [
        { id: 23, ownerId: 2, tile: { x: 5, y: 7 }, fuseMs: 1_000, ownerCanPass: false, flameRange: 1 },
      ],
    }));

    expect(decision).toMatchObject({ direction: "down", placeBomb: false, useSkill: false });
  });

  it("não sai da arena quando a borda ameaçada não é um portal", () => {
    const pingo = player(1, 5, 8, {
      skill: {
        id: "ranni-ice-blink",
        phase: "cooldown",
        channelRemainingMs: 0,
        cooldownRemainingMs: 5_000,
        castElapsedMs: 0,
        projectedPosition: null,
        projectedLastMoveDirection: null,
        projectedBombEgressIds: [],
      },
    });
    const enemy = player(2, 5, 7);
    const decision = getBotPingoDecision(pingo, context({
      players: { 1: pingo, 2: enemy },
      width: 11,
      height: 9,
      solid: [{ x: 4, y: 8 }, { x: 6, y: 8 }],
      bombs: [
        { id: 23, ownerId: 2, tile: { x: 5, y: 7 }, fuseMs: 1_000, ownerCanPass: false, flameRange: 1 },
      ],
    }));

    expect(decision).toMatchObject({ direction: null, placeBomb: false, useSkill: false });
  });

  it("não atravessa o portal quando o destino também está ameaçado e sem saída", () => {
    const pingo = player(1, 5, 8, {
      skill: {
        id: "ranni-ice-blink",
        phase: "cooldown",
        channelRemainingMs: 0,
        cooldownRemainingMs: 5_000,
        castElapsedMs: 0,
        projectedPosition: null,
        projectedLastMoveDirection: null,
        projectedBombEgressIds: [],
      },
    });
    const enemy = player(2, 5, 7);
    const decision = getBotPingoDecision(pingo, context({
      players: { 1: pingo, 2: enemy },
      width: 11,
      height: 9,
      wrapPortals: [{ x: 5, y: 0 }, { x: 5, y: 8 }],
      solid: [
        { x: 4, y: 8 }, { x: 6, y: 8 },
        { x: 4, y: 0 }, { x: 6, y: 0 },
      ],
      bombs: [
        { id: 23, ownerId: 2, tile: { x: 5, y: 7 }, fuseMs: 1_000, ownerCanPass: false, flameRange: 1 },
        { id: 24, ownerId: 2, tile: { x: 5, y: 1 }, fuseMs: 1_000, ownerCanPass: false, flameRange: 1 },
      ],
    }));

    expect(decision).toMatchObject({ direction: null, placeBomb: false, useSkill: false });
  });

  it("usa o entitlement exato para sair da bomba criada sobre a projeção", () => {
    const pingo = player(1, 5, 0, {
      skill: {
        id: "ranni-ice-blink",
        phase: "channeling",
        channelRemainingMs: 900,
        cooldownRemainingMs: 0,
        castElapsedMs: 600,
        projectedPosition: { x: 220, y: 39.17 },
        projectedLastMoveDirection: "up",
        projectedBombEgressIds: [22],
      },
    });
    const enemy = player(2, 9, 7);
    const decision = getBotPingoDecision(pingo, context({
      players: { 1: pingo, 2: enemy },
      width: 11,
      height: 9,
      wrapPortals: [{ x: 5, y: 0 }],
      solid: [{ x: 4, y: 0 }, { x: 6, y: 0 }, { x: 5, y: 1 }],
      bombs: [
        { id: 22, ownerId: 2, tile: { x: 5, y: 0 }, fuseMs: 600, ownerCanPass: false, flameRange: 1 },
      ],
      evaluateMovementOption: (_subject, direction) => ({ direction, projected: false }),
      evaluateProjectedMovementOption: (subject, direction) => ({
        direction,
        projected: true,
        egressIds: subject.skill.projectedBombEgressIds,
      }),
      canMovementOptionAdvance: (_position, option) => (
        option.projected
        && option.direction === "up"
        && option.egressIds.includes(22)
      ),
    }));

    expect(decision).toMatchObject({ direction: "up", useSkill: false });
  });

  it("não usa o entitlement de outro bomb ID", () => {
    const decision = projectedBombEgressDecision({ egressIds: [99] });

    expect(decision).toMatchObject({ direction: null, useSkill: false });
  });

  it("não readquire entitlement apenas porque a projeção ainda sobrepõe a bomba", () => {
    const decision = projectedBombEgressDecision({ egressIds: [] });

    expect(decision).toMatchObject({ direction: null, useSkill: false });
  });

  it("não reentra na bomba depois que o entitlement foi limpo", () => {
    const decision = projectedBombEgressDecision({
      egressIds: [],
      projectedPosition: { x: 220, y: 60.83 },
      projectedLastMoveDirection: "up",
      solid: [{ x: 4, y: 1 }, { x: 6, y: 1 }, { x: 5, y: 2 }],
      wrapPortals: [],
    });

    expect(decision).toMatchObject({ direction: null, useSkill: false });
  });

  it("troca uma fuga discreta bloqueada por outra direção executável", () => {
    const pingo = player(1, 1, 3, {
      position: { x: 60, y: 140 },
      skill: {
        id: "ranni-ice-blink",
        phase: "cooldown",
        channelRemainingMs: 0,
        cooldownRemainingMs: 5_000,
        castElapsedMs: 0,
        projectedPosition: null,
        projectedLastMoveDirection: null,
      },
    });
    const enemy = player(2, 5, 3);
    const decision = getBotPingoDecision(pingo, context({
      players: { 1: pingo, 2: enemy },
      bombs: [
        { id: 21, ownerId: 2, tile: { x: 0, y: 3 }, fuseMs: 700, ownerCanPass: false, flameRange: 1 },
      ],
      canMovementOptionAdvance: (_position, option) => option.direction === "right",
    }));

    expect(decision).toMatchObject({ direction: "right", placeBomb: false, useSkill: false });
  });

  it("mantém o refúgio seguro da Ranni até a própria bomba iminente explodir", () => {
    const pingo = player(1, 2, 2, {
      activeBombs: 1,
      skill: {
        id: "ranni-ice-blink",
        phase: "cooldown",
        channelRemainingMs: 0,
        cooldownRemainingMs: 8_000,
        castElapsedMs: 0,
        projectedPosition: null,
        projectedLastMoveDirection: null,
      },
    });
    const enemy = player(2, 5, 2);
    const decision = getBotPingoDecision(pingo, context({
      players: { 1: pingo, 2: enemy },
      bombs: [
        { id: 14, ownerId: 1, tile: { x: 3, y: 1 }, fuseMs: 700, ownerCanPass: false, flameRange: 3 },
      ],
    }));

    expect(decision).toMatchObject({ direction: null, placeBomb: false, useSkill: false });
  });

  it("ataca um adversário no alcance quando consegue escapar da própria explosão", () => {
    const pingo = player(1, 2, 2, { flameRange: 2 });
    const enemy = player(2, 3, 2);
    const decision = getBotPingoDecision(pingo, context({ players: { 1: pingo, 2: enemy } }));

    expect(decision).toMatchObject({ direction: "up", placeBomb: true });
  });

  it("não cria uma nova ameaça própria enquanto a emergência da Ranni recarrega", () => {
    const pingo = player(1, 2, 2, {
      flameRange: 2,
      skill: {
        id: "ranni-ice-blink",
        phase: "cooldown",
        channelRemainingMs: 0,
        cooldownRemainingMs: 4_000,
        castElapsedMs: 0,
        projectedPosition: null,
        projectedLastMoveDirection: null,
      },
    });
    const enemy = player(2, 3, 2);
    const decision = getBotPingoDecision(pingo, context({ players: { 1: pingo, 2: enemy } }));

    expect(decision).toMatchObject({ placeBomb: false, useSkill: false });
  });

  it("avança pelo corredor seguro em direção ao adversário", () => {
    const pingo = player(1, 1, 2);
    const enemy = player(2, 5, 2);
    const decision = getBotPingoDecision(pingo, context({
      players: { 1: pingo, 2: enemy },
      solid: [{ x: 1, y: 1 }, { x: 1, y: 3 }],
    }));

    expect(decision).toMatchObject({ direction: "right", placeBomb: false });
  });

  it("evita entrar em pocket de uma saída controlada pelo rival enquanto a Ranni recarrega", () => {
    const decision = controlledPocketDecision();

    expect(decision).toMatchObject({ direction: "left", placeBomb: false, useSkill: false });
  });

  it("mantém a entrada quando o destino tem duas saídas corporais", () => {
    const decision = controlledPocketDecision({
      solid: [{ x: 1, y: 1 }, { x: 2, y: 0 }],
    });

    expect(decision).toMatchObject({ direction: "up", placeBomb: false, useSkill: false });
  });

  it("mantém a entrada quando o rival distante não alcança a saída antes da retirada", () => {
    const decision = controlledPocketDecision({ enemyTile: { x: 6, y: 4 } });

    expect(decision).toMatchObject({ direction: "up", placeBomb: false, useSkill: false });
  });

  it("evita o pocket quando o rival alcança a saída antes da retirada", () => {
    const decision = controlledPocketDecision({ enemyTile: { x: 1, y: 3 } });

    expect(decision).toMatchObject({ direction: "left", placeBomb: false, useSkill: false });
  });

  it("mantém a entrada quando o rival não pode plantar outra bomba", () => {
    const decision = controlledPocketDecision({ enemyOverrides: { activeBombs: 1 } });

    expect(decision).toMatchObject({ direction: "up", placeBomb: false, useSkill: false });
  });

  it.each([
    ["inativo", { active: false }],
    ["eliminado", { alive: false }],
  ])("mantém a entrada quando o rival está %s", (_label, enemyOverrides) => {
    const decision = controlledPocketDecision({ enemyOverrides });

    expect(decision).toMatchObject({ direction: null, placeBomb: false, useSkill: false });
  });

  it("mantém a entrada quando a Ranni está disponível", () => {
    const decision = controlledPocketDecision({
      enemyTile: { x: 1, y: 3 },
      pingoOverrides: {
        skill: {
          id: "ranni-ice-blink",
          phase: "idle",
          channelRemainingMs: 0,
          cooldownRemainingMs: 0,
          castElapsedMs: 0,
          projectedPosition: null,
          projectedLastMoveDirection: null,
          projectedBombEgressIds: [],
        },
      },
    });

    expect(decision).toMatchObject({ direction: "up", placeBomb: false, useSkill: false });
  });

  it("mantém a entrada quando o destino não é pocket", () => {
    const decision = controlledPocketDecision({ solid: [] });

    expect(decision).toMatchObject({ direction: "up", placeBomb: false, useSkill: false });
  });

  it("mantém a decisão-base quando não existe alternativa executável fora do pocket", () => {
    const decision = controlledPocketDecision({
      solid: [
        { x: 1, y: 1 }, { x: 2, y: 0 }, { x: 3, y: 1 },
        { x: 1, y: 2 }, { x: 2, y: 3 }, { x: 3, y: 2 },
      ],
    });

    expect(decision).toMatchObject({ direction: "up", placeBomb: false, useSkill: false });
  });

  it("conta o wrap do portal como uma segunda saída corporal real", () => {
    const pingo = player(1, 2, 1, {
      skill: {
        id: "ranni-ice-blink",
        phase: "cooldown",
        channelRemainingMs: 0,
        cooldownRemainingMs: 5_000,
        castElapsedMs: 0,
        projectedPosition: null,
        projectedLastMoveDirection: null,
        projectedBombEgressIds: [],
      },
    });
    const enemy = player(2, 2, 1);
    const decision = getBotPingoDecision(pingo, context({
      players: { 1: pingo, 2: enemy },
      solid: [{ x: 1, y: 0 }, { x: 3, y: 0 }],
      wrapPortals: [{ x: 2, y: 0 }],
      powerUps: [{ tile: { x: 2, y: 0 }, revealed: true, collected: false }],
    }));

    expect(decision).toMatchObject({ direction: "up", placeBomb: false, useSkill: false });
  });

  it("avança até uma fronteira destrutível quando as caixas isolam o adversário", () => {
    const pingo = player(1, 1, 1, { flameRange: 1 });
    const enemy = player(2, 9, 1);
    const decision = getBotPingoDecision(pingo, context({
      players: { 1: pingo, 2: enemy },
      width: 11,
      height: 9,
      solid: STANDARD_SOLID,
      breakable: STANDARD_BREAKABLE,
    }));

    expect(decision).toMatchObject({ direction: "down", placeBomb: false });
  });

  it("ignora power-up revelado inalcançável e continua abrindo a fronteira", () => {
    const pingo = player(1, 1, 2, { flameRange: 1 });
    const enemy = player(2, 5, 2);
    const decision = getBotPingoDecision(pingo, context({
      players: { 1: pingo, 2: enemy },
      width: 7,
      height: 5,
      breakable: Array.from({ length: 5 }, (_, y) => ({ x: 3, y })),
      powerUps: [{ tile: { x: 5, y: 0 }, revealed: true, collected: false }],
    }));

    expect(decision).toMatchObject({ direction: "right", placeBomb: false });
  });

  it("detona a bomba remota mais antiga quando atinge o adversário sem atingir a si", () => {
    const pingo = player(1, 1, 1, { activeBombs: 1, remoteLevel: 1 });
    const enemy = player(2, 5, 2);
    const decision = getBotPingoDecision(pingo, context({
      players: { 1: pingo, 2: enemy },
      bombs: [{ id: 7, ownerId: 1, tile: { x: 3, y: 2 }, fuseMs: 1_500, ownerCanPass: false, flameRange: 2 }],
    }));

    expect(decision).toMatchObject({ placeBomb: false, detonate: true });
  });

  it("não detona remotamente quando uma reação em cadeia atingiria o Pingo", () => {
    const pingo = player(1, 1, 1, { activeBombs: 1, remoteLevel: 1 });
    const enemy = player(2, 5, 2);
    const decision = getBotPingoDecision(pingo, context({
      players: { 1: pingo, 2: enemy },
      bombs: [
        { id: 7, ownerId: 1, tile: { x: 3, y: 2 }, fuseMs: 1_500, ownerCanPass: false, flameRange: 2 },
        { id: 8, ownerId: 2, tile: { x: 1, y: 2 }, fuseMs: 1_800, ownerCanPass: false, flameRange: 2 },
      ],
    }));

    expect(decision.detonate).toBe(false);
  });

  it("não detona quando o corpo ainda sobrepõe uma casa adjacente da própria chama", () => {
    const pingo = player(1, 3, 6, {
      activeBombs: 1,
      remoteLevel: 1,
      position: { x: 158.81, y: 260 },
    });
    const enemy = player(2, 4, 6);
    const decision = getBotPingoDecision(pingo, context({
      players: { 1: pingo, 2: enemy },
      width: 11,
      height: 9,
      bombs: [
        { id: 7, ownerId: 1, tile: { x: 4, y: 7 }, fuseMs: 817, ownerCanPass: false, flameRange: 1 },
      ],
    }));

    expect(decision.detonate).toBe(false);
  });

  it("não planta quando outra bomba anteciparia a explosão antes do fim da fuga", () => {
    const pingo = player(1, 1, 2, { flameRange: 2 });
    const enemy = player(2, 2, 2);
    const decision = getBotPingoDecision(pingo, context({
      players: { 1: pingo, 2: enemy },
      bombs: [
        { id: 9, ownerId: 2, tile: { x: 3, y: 2 }, fuseMs: 600, ownerCanPass: false, flameRange: 2 },
      ],
    }));

    expect(decision.placeBomb).toBe(false);
  });

  it("abre uma barreira de caixas quando ela bloqueia a perseguição e existe fuga", () => {
    const pingo = player(1, 1, 2, { flameRange: 2 });
    const enemy = player(2, 5, 2);
    const decision = getBotPingoDecision(pingo, context({
      players: { 1: pingo, 2: enemy },
      breakable: [0, 1, 2, 3, 4].map((y) => ({ x: 2, y })),
    }));

    expect(decision.placeBomb).toBe(true);
  });
});
