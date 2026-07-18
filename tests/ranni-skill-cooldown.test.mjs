// @vitest-environment node

import { describe, expect, it } from "vitest";
import {
  finishRanniBlink,
  RANNI_SKILL_COOLDOWN_MS,
  startRanniIceBlink,
} from "../Champions/ranni/skill.ts";
import { advancePlayerSkillTimers } from "../src/original-game/ultimate/skill-system.ts";

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
    skill: {
      id: "ranni-ice-blink",
      phase: "idle",
      channelRemainingMs: 0,
      cooldownRemainingMs: 0,
      castElapsedMs: 0,
      projectedPosition: null,
      projectedLastMoveDirection: null,
    },
  };
}

const context = {
  canOccupyPosition: () => true,
  getTileFromPosition: (position) => ({
    x: Math.floor(position.x / 32),
    y: Math.floor(position.y / 32),
  }),
};

describe("cooldown da ultimate da Ranni", () => {
  it("cobra o cooldown completo após canalizar sem deslocamento", () => {
    const player = ranni();
    startRanniIceBlink(player);
    finishRanniBlink(player, context);

    expect(player.skill.phase).toBe("cooldown");
    expect(player.skill.cooldownRemainingMs).toBe(RANNI_SKILL_COOLDOWN_MS);
  });

  it("não libera outra ultimate antes dos 8 segundos completos", () => {
    const player = ranni();
    startRanniIceBlink(player);
    finishRanniBlink(player, context);

    advancePlayerSkillTimers(player, RANNI_SKILL_COOLDOWN_MS - 1);
    expect(player.skill.phase).toBe("cooldown");
    expect(player.skill.cooldownRemainingMs).toBe(1);

    advancePlayerSkillTimers(player, 1);
    expect(player.skill.phase).toBe("idle");
    expect(player.skill.cooldownRemainingMs).toBe(0);
  });
});
