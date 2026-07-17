// @vitest-environment node

import { describe, expect, it } from "vitest";
import {
  finishRanniBlink,
  grantRanniProjectedBombEgress,
  retainOverlappingRanniProjectedBombEgress,
  startRanniIceBlink,
} from "../src/original-game/Characters/CustomMechanics/ranni-skill.ts";
import {
  createDefaultPlayerSkillState,
  simulateProjectedMovement,
} from "../src/original-game/ultimate/skill-system.ts";

function ranni() {
  return {
    id: 1,
    active: true,
    alive: true,
    tile: { x: 2, y: 2 },
    position: { x: 80, y: 80 },
    velocity: { x: 0, y: 0 },
    direction: "right",
    lastMoveDirection: "right",
    skill: createDefaultPlayerSkillState("ranni-ice-blink"),
  };
}

describe("estado de egress da projeção da Ranni", () => {
  it("registra uma bomba plantada sobre o ghost sem duplicar o ID", () => {
    const player = ranni();
    startRanniIceBlink(player);

    grantRanniProjectedBombEgress(player, 41);
    grantRanniProjectedBombEgress(player, 41);

    expect(player.skill.projectedBombEgressIds).toEqual([41]);
  });

  it("leva somente IDs concedidos para a colisão simulada e retém apenas overlap", () => {
    const player = ranni();
    startRanniIceBlink(player);
    grantRanniProjectedBombEgress(player, 41);
    const ignoredByCollision = [];
    const context = {
      bombs: [{ id: 41, tile: { x: 2, y: 2 } }],
      clonePlayerState: (value) => structuredClone(value),
      getTileFromPosition: () => ({ x: 2, y: 2 }),
      resolveMovementDirection: (_ghost, direction) => direction,
      movePlayerSimulated: (ghost, _direction, _deltaMs, ignoredBombIds) => {
        ignoredByCollision.push(...ignoredBombIds);
        ghost.position.x += 32;
      },
      isPositionOverlappingTile: () => false,
    };

    const simulated = simulateProjectedMovement(player, player.position, "right", null, 16, context);

    expect(ignoredByCollision).toEqual([41]);
    expect(simulated.projectedBombEgressIds).toEqual([]);
    expect(player.skill.projectedBombEgressIds).toEqual([41]);
  });

  it("remove o ID ao limpar a bomba e nunca o readquire por proximidade", () => {
    const player = ranni();
    startRanniIceBlink(player);
    grantRanniProjectedBombEgress(player, 41);

    retainOverlappingRanniProjectedBombEgress(player, []);
    retainOverlappingRanniProjectedBombEgress(player, [41]);

    expect(player.skill.projectedBombEgressIds).toEqual([]);
  });

  it("limpa o entitlement no início e no fim de cada cast", () => {
    const player = ranni();
    player.skill.projectedBombEgressIds = [41];

    startRanniIceBlink(player);
    expect(player.skill.projectedBombEgressIds).toEqual([]);

    grantRanniProjectedBombEgress(player, 42);
    finishRanniBlink(player, {
      canOccupyPosition: () => true,
      getTileFromPosition: () => ({ x: 2, y: 2 }),
    });
    expect(player.skill.projectedBombEgressIds).toEqual([]);
  });
});
