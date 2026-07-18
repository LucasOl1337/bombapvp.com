import { describe, expect, it, vi } from "vitest";
import { getBotV3Decision } from "../src/original-game/Engine/bot-v3.ts";
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
    lastMoveDirection: "down",
    maxBombs: 1,
    activeBombs: 1,
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
      id: "ranni-ice-blink",
      phase: "channeling",
      channelRemainingMs: 500,
      cooldownRemainingMs: 0,
      castElapsedMs: 1_000,
      projectedPosition: { x: 2 * TILE_SIZE + TILE_SIZE / 2, y: 2 * TILE_SIZE + TILE_SIZE / 2 },
      projectedLastMoveDirection: "down",
      projectedBombEgressIds: [],
    },
  };
}

function threatenedProjectionContext() {
  const players = { 1: player(1), 2: player(2), 3: player(3), 4: player(4) };
  players[2].tile = { x: 4, y: 4 };
  players[2].position = { x: 4 * TILE_SIZE + TILE_SIZE / 2, y: 4 * TILE_SIZE + TILE_SIZE / 2 };
  players[2].skill.phase = "idle";
  players[3].active = players[3].alive = false;
  players[4].active = players[4].alive = false;
  const evaluateProjectedMovementOption = vi.fn((_candidate, direction) => ({ direction }));
  return {
    players,
    activePlayerIds: [1, 2],
    bombs: [{ id: 1, ownerId: 1, tile: { x: 2, y: 1 }, fuseMs: 150, ownerCanPass: false, flameRange: 1 }],
    flames: [],
    arena: {
      config: { grid: { width: 5, height: 5 }, wrapPortals: [] },
      solid: new Set(),
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
    canOccupyPosition: () => true,
    evaluateMovementOption: () => ({}),
    evaluateProjectedMovementOption,
    projectSkillTarget: (candidate) => ({ ...candidate.position }),
    canMovementOptionAdvance: (_position, option) => option.direction !== "up",
    areOppositeDirections: () => false,
    isPlayerOverlappingTile: () => false,
  };
}

describe("segurança projetada do bot V3", () => {
  it("move a projeção por uma saída autoritativa quando o término do cast está ameaçado", () => {
    const context = threatenedProjectionContext();

    const decision = getBotV3Decision(context.players[1], context);

    expect(decision.direction).not.toBeNull();
    expect(decision.placeBomb).toBe(false);
    expect(context.evaluateProjectedMovementOption).toHaveBeenCalledWith(
      expect.objectContaining({
        position: context.players[1].skill.projectedPosition,
        tile: context.players[1].tile,
      }),
      decision.direction,
      expect.any(Number),
    );
  });

  it("avalia a colisão a partir do fantasma quando corpo e projeção estão separados", () => {
    const context = threatenedProjectionContext();
    const projectedPosition = {
      x: 4 * TILE_SIZE + TILE_SIZE / 2,
      y: 4 * TILE_SIZE + TILE_SIZE / 2,
    };
    context.players[1].skill.projectedPosition = projectedPosition;
    context.bombs[0].tile = { x: 4, y: 3 };
    context.evaluateProjectedMovementOption = vi.fn((candidate, direction) => ({
      direction,
      startsAtProjection: candidate.position.x === projectedPosition.x
        && candidate.position.y === projectedPosition.y
        && candidate.tile.x === 4
        && candidate.tile.y === 4,
    }));
    context.canMovementOptionAdvance = (_position, option) => !option.startsAtProjection;

    expect(getBotV3Decision(context.players[1], context).direction).toBeNull();
    expect(context.evaluateProjectedMovementOption).toHaveBeenCalledWith(
      expect.objectContaining({
        position: projectedPosition,
        tile: { x: 4, y: 4 },
      }),
      expect.any(String),
      expect.any(Number),
    );
  });

  it("mantém a projeção parada quando o término do cast não está ameaçado", () => {
    const context = threatenedProjectionContext();
    context.bombs[0].fuseMs = 5_000;

    expect(getBotV3Decision(context.players[1], context).direction).toBeNull();
    expect(context.evaluateProjectedMovementOption).not.toHaveBeenCalled();
  });

  it("continua deslocando a projeção quando a ameaça passa a ser uma bomba rival", () => {
    const context = threatenedProjectionContext();
    context.bombs[0].ownerId = 2;

    expect(getBotV3Decision(context.players[1], context).direction).not.toBeNull();
    expect(context.evaluateProjectedMovementOption).toHaveBeenCalledOnce();
  });

  it("não ordena uma saída projetada que o evaluator autoritativo bloqueia", () => {
    const context = threatenedProjectionContext();
    context.canMovementOptionAdvance = () => false;

    expect(getBotV3Decision(context.players[1], context).direction).toBeNull();
    expect(context.evaluateProjectedMovementOption).toHaveBeenCalledOnce();
  });

  it("libera cedo quando só o corpo físico conserva egress da bomba sob a projeção", () => {
    const context = threatenedProjectionContext();
    context.bombs[0].fuseMs = 700;
    context.bombs.push({
      id: 2,
      ownerId: 2,
      tile: { x: context.players[1].tile.x - 1, y: context.players[1].tile.y },
      fuseMs: 700,
      ownerCanPass: false,
      bodyEgressPlayerIds: [1],
      flameRange: 1,
    });
    context.isPlayerOverlappingTile = (_player, tile) => tile.x === 1 && tile.y === 2;
    context.canMovementOptionAdvance = (_position, option) => option.direction === undefined;

    expect(getBotV3Decision(context.players[1], context)).toMatchObject({
      direction: null,
      placeBomb: false,
      useSkill: true,
      skillAction: "release",
    });
  });

  it("não libera cedo quando a única saída física continua ameaçada", () => {
    const context = threatenedProjectionContext();
    context.dangerMap = new Map([
      ["2,2", 700],
      ["2,1", 0],
      ["1,2", 0],
      ["2,3", 0],
      ["3,2", 0],
    ]);
    context.bombs.push({
      id: 2,
      ownerId: 2,
      tile: { x: context.players[1].tile.x - 1, y: context.players[1].tile.y },
      fuseMs: 700,
      ownerCanPass: false,
      bodyEgressPlayerIds: [1],
      flameRange: 1,
    });
    context.isPlayerOverlappingTile = (_player, tile) => tile.x === 1 && tile.y === 2;
    context.evaluateMovementOption = vi.fn((_player, direction) => ({ direction, physical: true }));
    context.canMovementOptionAdvance = (_position, option) => option.physical === true
      && option.direction === "left";

    expect(getBotV3Decision(context.players[1], context).useSkill).not.toBe(true);
  });

  it("mantém a imunidade quando não há tempo físico para sair após a liberação", () => {
    const context = threatenedProjectionContext();
    context.bombs.push({
      id: 2,
      ownerId: 2,
      tile: { x: context.players[1].tile.x - 1, y: context.players[1].tile.y },
      fuseMs: 700,
      ownerCanPass: false,
      bodyEgressPlayerIds: [1],
      flameRange: 1,
    });
    context.isPlayerOverlappingTile = (_player, tile) => tile.x === 1 && tile.y === 2;
    context.canMovementOptionAdvance = (_position, option) => option.direction === undefined;

    expect(getBotV3Decision(context.players[1], context).useSkill).not.toBe(true);
  });

  it("usa a única fuga física executável enquanto conserva egress da bomba", () => {
    const context = threatenedProjectionContext();
    const candidate = context.players[1];
    candidate.skill.phase = "cooldown";
    candidate.skill.projectedPosition = null;
    context.bombs.push({
      id: 2,
      ownerId: 2,
      tile: { x: candidate.tile.x - 1, y: candidate.tile.y },
      fuseMs: 700,
      ownerCanPass: false,
      bodyEgressPlayerIds: [1],
      flameRange: 1,
    });
    context.isPlayerOverlappingTile = (_player, tile) => tile.x === 1 && tile.y === 2;
    context.evaluateMovementOption = vi.fn((_player, direction) => ({ direction }));
    context.canMovementOptionAdvance = (_position, option) => option.direction === "left";

    expect(getBotV3Decision(candidate, context).direction).toBe("left");
  });

  it("planeja a fuga através da bomba que o corpo ainda pode atravessar", () => {
    const context = threatenedProjectionContext();
    const candidate = context.players[1];
    candidate.skill.phase = "cooldown";
    candidate.skill.projectedPosition = null;
    context.bombs = [{
      id: 2,
      ownerId: 2,
      tile: { x: candidate.tile.x - 1, y: candidate.tile.y },
      fuseMs: 700,
      ownerCanPass: false,
      bodyEgressPlayerIds: [1],
      flameRange: 1,
    }];
    context.arena.solid = new Set(["2,1", "2,3", "3,2"]);
    context.isPlayerOverlappingTile = (_player, tile) => tile.x === 1 && tile.y === 2;
    context.evaluateMovementOption = vi.fn((_player, direction) => ({ direction }));
    context.canMovementOptionAdvance = () => true;

    expect(getBotV3Decision(candidate, context).direction).toBe("left");
  });

  it("só inicia o blink quando a chama prevista termina até a liberação", () => {
    const context = threatenedProjectionContext();
    const candidate = context.players[1];
    candidate.skill.phase = "idle";
    candidate.skill.projectedPosition = null;
    context.bombs[0].fuseMs = 950;

    expect(getBotV3Decision(candidate, context).useSkill).not.toBe(true);

    context.bombs[0].fuseMs = 850;
    expect(getBotV3Decision(candidate, context).useSkill).toBe(true);
  });

  it("conclui a fuga da própria bomba antes de voltar à perseguição", () => {
    const context = threatenedProjectionContext();
    const candidate = context.players[1];
    candidate.skill.phase = "idle";
    candidate.skill.projectedPosition = null;
    context.bombs = [{
      id: 2,
      ownerId: 1,
      tile: { x: 2, y: 1 },
      fuseMs: 1_900,
      ownerCanPass: false,
      bodyEgressPlayerIds: [],
      flameRange: 1,
    }];
    context.players[2].tile = { x: 1, y: 2 };
    context.players[2].position = {
      x: TILE_SIZE + TILE_SIZE / 2,
      y: 2 * TILE_SIZE + TILE_SIZE / 2,
    };
    context.arena.solid = new Set(["2,3"]);
    context.dangerMap = new Map([["2,2", 1_900]]);

    expect(getBotV3Decision(candidate, context).direction).toBe("right");
  });

  it("não libera cedo sobre uma chama ativa que acaba antes do cast", () => {
    const context = threatenedProjectionContext();
    context.flames.push({
      tile: { ...context.players[1].tile },
      remainingMs: 500,
      style: "normal",
      ownerId: 1,
    });
    context.isPlayerOverlappingTile = () => true;
    context.canMovementOptionAdvance = () => false;

    expect(getBotV3Decision(context.players[1], context).useSkill).not.toBe(true);
  });

});
