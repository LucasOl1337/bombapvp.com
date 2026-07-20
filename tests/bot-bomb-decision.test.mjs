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

function context(players, testArena, bombs = [], overrides = {}) {
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
    roomBombPlacementThrottleMs: 0,
    botCommittedDirection: { 1: null, 2: null, 3: null, 4: null },
    botPendingReverseDirection: { 1: null, 2: null, 3: null, 4: null },
    botPendingReverseFrames: { 1: 0, 2: 0, 3: 0, 4: 0 },
    canOccupyPosition: () => true,
    evaluateMovementOption: () => ({}),
    evaluateProjectedMovementOption: () => ({}),
    projectSkillTarget: (candidate) => candidate.position,
    canMovementOptionAdvance: () => true,
    areOppositeDirections: () => false,
    isPlayerOverlappingTile: (candidate, tile) => (
      candidate.tile.x === tile.x && candidate.tile.y === tile.y
    ),
    ...overrides,
  };
}

function overlapsContinuously(candidate, tile) {
  const half = TILE_SIZE / 2;
  const left = candidate.position.x - half;
  const right = candidate.position.x + half;
  const top = candidate.position.y - half;
  const bottom = candidate.position.y + half;
  const tileLeft = tile.x * TILE_SIZE;
  const tileRight = tileLeft + TILE_SIZE;
  const tileTop = tile.y * TILE_SIZE;
  const tileBottom = tileTop + TILE_SIZE;
  return left < tileRight && right > tileLeft && top < tileBottom && bottom > tileTop;
}

describe("política competitiva do Bomb", () => {
  it("alinha ao centro antes de virar para a fuga horizontal", () => {
    const players = {
      1: player(1, { x: 3, y: 3 }, {
        position: {
          x: 3 * TILE_SIZE + TILE_SIZE / 2,
          y: 3 * TILE_SIZE + TILE_SIZE / 2 + 18.4,
        },
      }),
      2: player(2, { x: 3, y: 1 }),
      3: player(3, { x: 6, y: 6 }, { active: false, alive: false }),
      4: player(4, { x: 6, y: 6 }, { active: false, alive: false }),
    };
    const testArena = arena(["2,3", "3,1", "3,2", "3,3", "3,4"]);
    const bombs = [{
      id: 30,
      ownerId: 2,
      tile: { x: 3, y: 4 },
      fuseMs: 1_300,
      ownerCanPass: false,
      flameRange: 1,
    }];

    expect(getBombDecision(players[1], context(players, testArena, bombs))).toMatchObject({
      direction: "up",
      placeBomb: false,
    });
  });

  it("só usa a Ranni bloqueada quando a canalização cobre a chama e a margem do passo final", () => {
    const players = {
      1: player(1, { x: 3, y: 3 }, {
        position: {
          x: 3 * TILE_SIZE + TILE_SIZE / 2,
          y: 3 * TILE_SIZE + TILE_SIZE / 2 + 18.4,
        },
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
      2: player(2, { x: 3, y: 1 }),
      3: player(3, { x: 6, y: 6 }, { active: false, alive: false }),
      4: player(4, { x: 6, y: 6 }, { active: false, alive: false }),
    };
    const testArena = arena(["2,3", "3,1", "3,2", "3,3", "3,4"]);
    const bombs = [{
      id: 31,
      ownerId: 2,
      tile: { x: 3, y: 4 },
      fuseMs: 1_300,
      ownerCanPass: false,
      flameRange: 1,
    }];
    const blockedContext = context(players, testArena, bombs, {
      evaluateMovementOption: (_candidate, direction) => ({ direction }),
      canMovementOptionAdvance: () => false,
    });

    expect(getBombDecision(players[1], blockedContext)).toEqual({
      direction: null,
      placeBomb: false,
    });
    const committedContext = context(players, testArena, [{
      ...bombs[0],
      fuseMs: 800,
    }], {
      evaluateMovementOption: (_candidate, direction) => ({ direction }),
      canMovementOptionAdvance: () => false,
    });
    expect(getBombDecision(players[1], committedContext)).toMatchObject({
      direction: null,
      placeBomb: false,
      useSkill: true,
    });
  });

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

  it("não planta se a Ranni continuará em cooldown quando o fuse terminar", () => {
    const players = {
      1: player(1, { x: 2, y: 2 }, {
        skill: {
          id: "ranni-ice-blink",
          phase: "cooldown",
          channelRemainingMs: 0,
          cooldownRemainingMs: 2_500,
          castElapsedMs: 0,
          projectedPosition: null,
          projectedLastMoveDirection: null,
        },
      }),
      2: player(2, { x: 2, y: 3 }),
      3: player(3, { x: 6, y: 6 }, { active: false, alive: false }),
      4: player(4, { x: 6, y: 6 }, { active: false, alive: false }),
    };
    const testArena = arena(["1,1", "1,2", "2,2", "2,3", "2,4"]);

    expect(getBombDecision(players[1], context(players, testArena))).toMatchObject({
      placeBomb: false,
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

  it("continua fugindo enquanto permanece no alcance da própria bomba", () => {
    const players = {
      1: player(1, { x: 2, y: 2 }, { activeBombs: 1 }),
      2: player(2, { x: 4, y: 2 }),
      3: player(3, { x: 6, y: 6 }, { active: false, alive: false }),
      4: player(4, { x: 6, y: 6 }, { active: false, alive: false }),
    };
    const testArena = arena(["1,2", "2,2", "3,2", "4,2"]);
    const bombs = [{
      id: 13,
      ownerId: 1,
      tile: { x: 2, y: 3 },
      fuseMs: 1_800,
      ownerCanPass: false,
      flameRange: 1,
    }];

    expect(getBombDecision(players[1], context(players, testArena, bombs))).toMatchObject({
      direction: "left",
      placeBomb: false,
    });
  });

  it("continua fugindo depois que o tile muda mas a hitbox ainda cruza o blast próprio", () => {
    const players = {
      1: player(1, { x: 1, y: 2 }, {
        position: { x: 79.75, y: 100 },
        activeBombs: 1,
      }),
      2: player(2, { x: 4, y: 2 }),
      3: player(3, { x: 6, y: 6 }, { active: false, alive: false }),
      4: player(4, { x: 6, y: 6 }, { active: false, alive: false }),
    };
    const testArena = arena(["0,2", "1,2", "2,2", "2,3", "4,2"]);
    const bombs = [{
      id: 25,
      ownerId: 1,
      tile: { x: 2, y: 3 },
      fuseMs: 500,
      ownerCanPass: false,
      flameRange: 1,
    }];

    expect(getBombDecision(players[1], context(players, testArena, bombs, {
      isPlayerOverlappingTile: overlapsContinuously,
    }))).toMatchObject({
      direction: "left",
      placeBomb: false,
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

  it("não inicia a Ranni cedo demais quando a projeção imóvel terminaria antes da bomba", () => {
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
          projectedBombEgressIds: [],
        },
      }),
      2: player(2, { x: 5, y: 5 }),
      3: player(3, { x: 6, y: 6 }, { active: false, alive: false }),
      4: player(4, { x: 6, y: 6 }, { active: false, alive: false }),
    };
    const testArena = arena(["2,2", "5,5"]);
    const bombs = [{
      id: 20,
      ownerId: 1,
      tile: { x: 2, y: 2 },
      fuseMs: 1_900,
      ownerCanPass: false,
      flameRange: 1,
    }];

    expect(getBombDecision(players[1], context(players, testArena, bombs))).toEqual({
      direction: null,
      placeBomb: false,
    });
  });

  it("usa a Ranni quando o fuse vence antes de o centro sair da célula letal", () => {
    const players = {
      1: player(1, { x: 3, y: 3 }, {
        position: { x: 140, y: 141.7 },
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
    const testArena = arena(["3,2", "3,3", "3,4", "5,5"]);
    const bombs = [{
      id: 32,
      ownerId: 1,
      tile: { x: 3, y: 4 },
      fuseMs: 233,
      ownerCanPass: false,
      flameRange: 1,
    }];

    expect(getBombDecision(players[1], context(players, testArena, bombs))).toMatchObject({
      direction: null,
      placeBomb: false,
      useSkill: true,
    });
  });

  it("usa a Ranni quando só a fuga por sobreposição resta e o centro não tem tempo", () => {
    const players = {
      1: player(1, { x: 3, y: 3 }, {
        position: { x: 140, y: 141.7 },
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
    const testArena = arena(["3,3", "3,4", "5,5"]);
    const bombs = [{
      id: 33,
      ownerId: 1,
      tile: { x: 3, y: 4 },
      fuseMs: 233,
      ownerCanPass: false,
      flameRange: 1,
    }];

    expect(getBombDecision(players[1], context(players, testArena, bombs, {
      isPlayerOverlappingTile: overlapsContinuously,
    }))).toMatchObject({
      direction: null,
      placeBomb: false,
      useSkill: true,
    });
  });

  it("não inicia uma nova explosão durante o fechamento do sudden death", () => {
    const players = {
      1: player(1, { x: 2, y: 2 }),
      2: player(2, { x: 2, y: 3 }),
      3: player(3, { x: 6, y: 6 }, { active: false, alive: false }),
      4: player(4, { x: 6, y: 6 }, { active: false, alive: false }),
    };
    const testArena = arena(["1,1", "1,2", "2,2", "2,3", "2,4"]);

    expect(getBombDecision(players[1], context(players, testArena, [], {
      suddenDeathActive: true,
    }))).toMatchObject({ placeBomb: false });
  });

  it("não planta uma segunda bomba sem um plano conjunto para as duas explosões", () => {
    const players = {
      1: player(1, { x: 2, y: 2 }, { activeBombs: 1, maxBombs: 2 }),
      2: player(2, { x: 2, y: 3 }),
      3: player(3, { x: 6, y: 6 }, { active: false, alive: false }),
      4: player(4, { x: 6, y: 6 }, { active: false, alive: false }),
    };
    const testArena = arena(["1,1", "1,2", "2,2", "2,3", "2,4"]);
    const bombs = [{
      id: 12,
      ownerId: 1,
      tile: { x: 5, y: 5 },
      fuseMs: 1_500,
      ownerCanPass: false,
      flameRange: 1,
    }];

    expect(getBombDecision(players[1], context(players, testArena, bombs))).toMatchObject({
      placeBomb: false,
    });
  });

  it("aguarda a chama própria terminar antes de iniciar outro plano de bomba", () => {
    const players = {
      1: player(1, { x: 2, y: 2 }, { maxBombs: 2 }),
      2: player(2, { x: 2, y: 3 }),
      3: player(3, { x: 6, y: 6 }, { active: false, alive: false }),
      4: player(4, { x: 6, y: 6 }, { active: false, alive: false }),
    };
    const testArena = arena(["1,1", "1,2", "2,2", "2,3", "2,4"]);

    expect(getBombDecision(players[1], context(players, testArena, [], {
      flames: [{ ownerId: 1, tile: { x: 5, y: 5 }, remainingMs: 300 }],
    }))).toMatchObject({ placeBomb: false });
  });

  it("reage ao blast adjacente que já alcança o corpo mesmo com o centro fora da linha", () => {
    const players = {
      1: player(1, { x: 5, y: 0 }, {
        position: { x: 220, y: 25.9 },
        activeBombs: 1,
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
      }),
      2: player(2, { x: 5, y: 0 }),
      3: player(3, { x: 6, y: 6 }, { active: false, alive: false }),
      4: player(4, { x: 6, y: 6 }, { active: false, alive: false }),
    };
    const testArena = arena(["5,0", "5,1", "6,0", "6,1", "6,2"]);
    const bombs = [{
      id: 34,
      ownerId: 1,
      tile: { x: 6, y: 1 },
      fuseMs: 500,
      ownerCanPass: false,
      flameRange: 1,
    }];

    expect(getBombDecision(players[1], context(players, testArena, bombs, {
      isPlayerOverlappingTile: overlapsContinuously,
    }))).toMatchObject({
      direction: null,
      placeBomb: false,
      useSkill: true,
    });
  });

  it("move a projeção da Ranni para fora do blast durante a canalização", () => {
    const players = {
      1: player(1, { x: 2, y: 2 }, {
        skill: {
          id: "ranni-ice-blink",
          phase: "channeling",
          channelRemainingMs: 900,
          cooldownRemainingMs: 0,
          castElapsedMs: 600,
          projectedPosition: {
            x: 2 * TILE_SIZE + TILE_SIZE / 2,
            y: 2 * TILE_SIZE + TILE_SIZE / 2,
          },
          projectedLastMoveDirection: null,
        },
      }),
      2: player(2, { x: 5, y: 5 }),
      3: player(3, { x: 6, y: 6 }, { active: false, alive: false }),
      4: player(4, { x: 6, y: 6 }, { active: false, alive: false }),
    };
    const testArena = arena(["2,2", "2,3", "2,4", "5,5"]);
    const bombs = [{
      id: 21,
      ownerId: 1,
      tile: { x: 2, y: 2 },
      fuseMs: 700,
      ownerCanPass: false,
      flameRange: 1,
    }];

    expect(getBombDecision(players[1], context(players, testArena, bombs))).toMatchObject({
      direction: "down",
      placeBomb: false,
    });
  });

  it("usa a colisão projetada autoritativa ao sair de uma bomba sobre o ghost", () => {
    const players = {
      1: player(1, { x: 2, y: 2 }, {
        skill: {
          id: "ranni-ice-blink",
          phase: "channeling",
          channelRemainingMs: 900,
          cooldownRemainingMs: 0,
          castElapsedMs: 600,
          projectedPosition: {
            x: 2 * TILE_SIZE + TILE_SIZE / 2,
            y: 2 * TILE_SIZE + TILE_SIZE / 2,
          },
          projectedLastMoveDirection: null,
          projectedBombEgressIds: [21],
        },
      }),
      2: player(2, { x: 5, y: 5 }),
      3: player(3, { x: 6, y: 6 }, { active: false, alive: false }),
      4: player(4, { x: 6, y: 6 }, { active: false, alive: false }),
    };
    const testArena = arena(["2,2", "2,3", "2,4", "5,5"]);
    const bombs = [{
      id: 21,
      ownerId: 2,
      tile: { x: 2, y: 2 },
      fuseMs: 700,
      ownerCanPass: false,
      flameRange: 1,
    }];
    let projectedEvaluations = 0;

    expect(getBombDecision(players[1], context(players, testArena, bombs, {
      evaluateProjectedMovementOption: () => {
        projectedEvaluations += 1;
        return { projected: true };
      },
      canMovementOptionAdvance: (_position, option) => option.projected !== true,
    }))).toMatchObject({
      direction: null,
      placeBomb: false,
    });
    expect(projectedEvaluations).toBeGreaterThan(0);
  });

  it("continua movendo a projeção quando a hitbox ainda cruza um blast adjacente", () => {
    const players = {
      1: player(1, { x: 2, y: 0 }, {
        position: { x: 100, y: 38.57 },
        skill: {
          id: "ranni-ice-blink",
          phase: "channeling",
          channelRemainingMs: 150,
          cooldownRemainingMs: 0,
          castElapsedMs: 1_350,
          projectedPosition: { x: 100, y: 38.57 },
          projectedLastMoveDirection: "up",
        },
      }),
      2: player(2, { x: 5, y: 0 }),
      3: player(3, { x: 6, y: 6 }, { active: false, alive: false }),
      4: player(4, { x: 6, y: 6 }, { active: false, alive: false }),
    };
    const testArena = arena(["2,0", "2,1", "5,0"]);
    const bombs = [{
      id: 24,
      ownerId: 1,
      tile: { x: 2, y: 1 },
      fuseMs: 500,
      ownerCanPass: false,
      flameRange: 1,
    }];
    expect(getBombDecision(players[1], context(players, testArena, bombs, {
      isPlayerOverlappingTile: overlapsContinuously,
    }))).toMatchObject({
      direction: "up",
      placeBomb: false,
    });
  });

  it("reconhece o portal de borda como rota de fuga durante a Ranni", () => {
    const players = {
      1: player(1, { x: 0, y: 3 }, {
        skill: {
          id: "ranni-ice-blink",
          phase: "channeling",
          channelRemainingMs: 900,
          cooldownRemainingMs: 0,
          castElapsedMs: 600,
          projectedPosition: {
            x: TILE_SIZE / 2,
            y: 3 * TILE_SIZE + TILE_SIZE / 2,
          },
          projectedLastMoveDirection: null,
        },
      }),
      2: player(2, { x: 5, y: 5 }),
      3: player(3, { x: 6, y: 6 }, { active: false, alive: false }),
      4: player(4, { x: 6, y: 6 }, { active: false, alive: false }),
    };
    const testArena = arena(["0,3", "6,3", "5,5"]);
    testArena.config.wrapPortals = [{ x: 0, y: 3 }, { x: 6, y: 3 }];
    const bombs = [{
      id: 23,
      ownerId: 1,
      tile: { x: 0, y: 3 },
      fuseMs: 700,
      ownerCanPass: false,
      flameRange: 1,
    }];

    expect(getBombDecision(players[1], context(players, testArena, bombs))).toMatchObject({
      direction: "left",
      placeBomb: false,
    });
  });

  it("libera a Ranni cedo quando a projeção já está fora de todos os blasts", () => {
    const players = {
      1: player(1, { x: 2, y: 2 }, {
        skill: {
          id: "ranni-ice-blink",
          phase: "channeling",
          channelRemainingMs: 900,
          cooldownRemainingMs: 0,
          castElapsedMs: 600,
          projectedPosition: {
            x: 4 * TILE_SIZE + TILE_SIZE / 2,
            y: 2 * TILE_SIZE + TILE_SIZE / 2,
          },
          projectedLastMoveDirection: "right",
        },
      }),
      2: player(2, { x: 5, y: 5 }),
      3: player(3, { x: 6, y: 6 }, { active: false, alive: false }),
      4: player(4, { x: 6, y: 6 }, { active: false, alive: false }),
    };
    const testArena = arena(["2,2", "3,2", "4,2", "5,5"]);
    const bombs = [{
      id: 22,
      ownerId: 1,
      tile: { x: 2, y: 2 },
      fuseMs: 700,
      ownerCanPass: false,
      flameRange: 1,
    }];

    expect(getBombDecision(players[1], context(players, testArena, bombs))).toMatchObject({
      direction: null,
      placeBomb: false,
      useSkill: true,
      skillAction: "release",
    });
  });

  it("não libera a Ranni no mesmo passo em que a pose física vai explodir", () => {
    const players = {
      1: player(1, { x: 5, y: 1 }, {
        position: { x: 225.46, y: 60 },
        activeBombs: 1,
        skill: {
          id: "ranni-ice-blink",
          phase: "channeling",
          channelRemainingMs: 1_150,
          cooldownRemainingMs: 0,
          castElapsedMs: 350,
          projectedPosition: { x: 220, y: 20 },
          projectedLastMoveDirection: "up",
          projectedBombEgressIds: [],
        },
      }),
      2: player(2, { x: 5, y: 0 }),
      3: player(3, { x: 6, y: 6 }, { active: false, alive: false }),
      4: player(4, { x: 6, y: 6 }, { active: false, alive: false }),
    };
    const testArena = arena(["5,0", "5,1", "6,1", "5,2"]);
    const bombs = [{
      id: 37,
      ownerId: 1,
      tile: { x: 6, y: 1 },
      fuseMs: 17,
      ownerCanPass: false,
      flameRange: 3,
    }];

    expect(getBombDecision(players[1], context(players, testArena, bombs, {
      isPlayerOverlappingTile: overlapsContinuously,
    }))).not.toMatchObject({ skillAction: "release" });
  });

  it("mantém o refúgio corporal seguro até a própria bomba iminente explodir", () => {
    const players = {
      1: player(1, { x: 5, y: 0 }, {
        position: { x: 220, y: 20 },
        activeBombs: 1,
        skill: {
          id: "ranni-ice-blink",
          phase: "cooldown",
          channelRemainingMs: 0,
          cooldownRemainingMs: 7_800,
          castElapsedMs: 0,
          projectedPosition: null,
          projectedLastMoveDirection: null,
          projectedBombEgressIds: [],
        },
      }),
      2: player(2, { x: 5, y: 0 }),
      3: player(3, { x: 6, y: 6 }, { active: false, alive: false }),
      4: player(4, { x: 6, y: 6 }, { active: false, alive: false }),
    };
    const testArena = arena(["4,0", "5,0", "5,1", "6,0", "6,1", "6,2"]);
    const bombs = [{
      id: 35,
      ownerId: 1,
      tile: { x: 6, y: 1 },
      fuseMs: 200,
      ownerCanPass: false,
      flameRange: 1,
    }];

    expect(getBombDecision(players[1], context(players, testArena, bombs, {
      isPlayerOverlappingTile: overlapsContinuously,
    }))).toEqual({
      direction: null,
      placeBomb: false,
    });
  });

  it("mantém o refúgio próprio mesmo após a habilidade voltar ao estado idle", () => {
    const players = {
      1: player(1, { x: 1, y: 6 }, {
        position: { x: 63.81, y: 260 },
        activeBombs: 1,
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
      }),
      2: player(2, { x: 1, y: 5 }),
      3: player(3, { x: 6, y: 6 }, { active: false, alive: false }),
      4: player(4, { x: 6, y: 6 }, { active: false, alive: false }),
    };
    const testArena = arena(["1,5", "1,6", "1,7", "2,6", "2,7"]);
    const bombs = [{
      id: 36,
      ownerId: 1,
      tile: { x: 2, y: 7 },
      fuseMs: 17,
      ownerCanPass: false,
      flameRange: 1,
    }];

    expect(getBombDecision(players[1], context(players, testArena, bombs, {
      isPlayerOverlappingTile: overlapsContinuously,
    }))).toEqual({ direction: null, placeBomb: false });
  });

  it("não libera a Ranni enquanto a projeção ainda usa egress de bomba", () => {
    const players = {
      1: player(1, { x: 2, y: 2 }, {
        skill: {
          id: "ranni-ice-blink",
          phase: "channeling",
          channelRemainingMs: 900,
          cooldownRemainingMs: 0,
          castElapsedMs: 600,
          projectedPosition: {
            x: 4 * TILE_SIZE + TILE_SIZE / 2,
            y: 2 * TILE_SIZE + TILE_SIZE / 2,
          },
          projectedLastMoveDirection: "right",
          projectedBombEgressIds: [22],
        },
      }),
      2: player(2, { x: 5, y: 5 }),
      3: player(3, { x: 6, y: 6 }, { active: false, alive: false }),
      4: player(4, { x: 6, y: 6 }, { active: false, alive: false }),
    };
    const testArena = arena(["2,2", "3,2", "4,2", "5,5"]);
    const bombs = [{
      id: 22,
      ownerId: 1,
      tile: { x: 2, y: 2 },
      fuseMs: 700,
      ownerCanPass: false,
      flameRange: 1,
    }];

    expect(getBombDecision(players[1], context(players, testArena, bombs))).not.toMatchObject({
      skillAction: "release",
    });
  });

  it("continua saindo enquanto o corpo ainda sobrepõe a casa do adversário", () => {
    const players = {
      1: player(1, { x: 2, y: 1 }, {
        position: { x: 81.63, y: 60 },
      }),
      2: player(2, { x: 1, y: 1 }, {
        position: { x: 60, y: 41.88 },
      }),
      3: player(3, { x: 6, y: 6 }, { active: false, alive: false }),
      4: player(4, { x: 6, y: 6 }, { active: false, alive: false }),
    };
    const testArena = arena(["1,1", "2,1", "3,1"]);

    expect(getBombDecision(players[1], context(players, testArena, [], {
      isPlayerOverlappingTile: overlapsContinuously,
    }))).toMatchObject({
      direction: "right",
      placeBomb: false,
    });
  });
});
