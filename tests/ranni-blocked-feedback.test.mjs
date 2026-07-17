// @vitest-environment node

import { describe, expect, it } from "vitest";
import {
  buildRanniProjectionFeedbackGeometry,
  GameApp,
} from "../src/original-game/Engine/game-app.ts";
import { RANNI_SKILL_COOLDOWN_MS } from "../src/original-game/ultimate/skill-system.ts";

function channelingRanni() {
  return {
    id: 1,
    active: true,
    alive: true,
    tile: { x: 5, y: 1 },
    position: { x: 220, y: 47.5 },
    velocity: { x: 0, y: 0 },
    direction: "down",
    lastMoveDirection: "down",
    skill: {
      id: "ranni-ice-blink",
      phase: "channeling",
      channelRemainingMs: 100,
      cooldownRemainingMs: 0,
      castElapsedMs: 1_400,
      projectedPosition: { x: 220, y: 47.5 },
      projectedLastMoveDirection: "down",
    },
  };
}

describe("feedback visual da Ranni bloqueada", () => {
  it("distingue tentativa bloqueada de uma projeção com deslocamento", () => {
    expect(buildRanniProjectionFeedbackGeometry(
      { x: 220, y: 47.5 },
      { x: 220, y: 47.5 },
      true,
    )).toEqual({
      originX: 220,
      originY: 47.5,
      targetX: 220,
      targetY: 47.5,
      distancePx: 0,
      hasDisplacement: false,
      blocked: true,
    });

    expect(buildRanniProjectionFeedbackGeometry(
      { x: 220, y: 47.5 },
      { x: 220, y: 87.5 },
      true,
    )).toMatchObject({
      distancePx: 40,
      hasDisplacement: true,
      blocked: false,
    });
  });

  it("registra falha visual sem mudar posição nem cooldown do cast", () => {
    const player = channelingRanni();
    const game = {
      ranniBlinkFeedback: { 1: null, 2: null, 3: null, 4: null },
      createSkillContext: () => ({
        canOccupyPosition: () => true,
        getTileFromPosition: (position) => ({
          x: Math.floor(position.x / 40),
          y: Math.floor(position.y / 40),
        }),
      }),
    };

    const handled = GameApp.prototype.updatePlayerSkillChannel.call(
      game,
      player,
      "down",
      true,
      false,
      16.67,
    );

    expect(handled).toBe(true);
    expect(player.position).toEqual({ x: 220, y: 47.5 });
    expect(player.skill.phase).toBe("cooldown");
    expect(player.skill.cooldownRemainingMs).toBe(RANNI_SKILL_COOLDOWN_MS);
    expect(game.ranniBlinkFeedback[1]).toEqual({
      kind: "failed",
      position: { x: 220, y: 47.5 },
      elapsedMs: 0,
    });
  });

  it("registra bloqueio enquanto uma direção não consegue mover o fantasma", () => {
    const player = channelingRanni();
    player.skill.channelRemainingMs = 1_000;
    const game = {
      ranniBlinkFeedback: { 1: null, 2: null, 3: null, 4: null },
      createSkillContext: () => ({
        clonePlayerState: (source) => structuredClone(source),
        getTileFromPosition: (position) => ({
          x: Math.floor(position.x / 40),
          y: Math.floor(position.y / 40),
        }),
        resolveMovementDirection: (_ghost, direction) => direction,
        movePlayerSimulated: () => {},
      }),
    };

    GameApp.prototype.updatePlayerSkillChannel.call(
      game,
      player,
      "down",
      false,
      false,
      16.67,
    );

    expect(player.skill.phase).toBe("channeling");
    expect(player.skill.projectedPosition).toEqual({ x: 220, y: 47.5 });
    expect(game.ranniBlinkFeedback[1]).toEqual({
      kind: "blocked",
      position: { x: 220, y: 47.5 },
      elapsedMs: 0,
    });
  });
});
