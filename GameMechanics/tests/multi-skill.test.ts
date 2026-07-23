import { describe, expect, it } from "vitest";
import {
  SKILL_IDS,
  TICK_DURATION_MS,
  type MatchConfig,
  type SkillId,
} from "../src/contracts.ts";
import {
  createMatchConfig,
  DEFAULT_MECHANICS_REVISION,
} from "../src/match-config.ts";
import { createDefaultMechanicsProgram } from "../src/composition.ts";
import type { WorldState } from "../src/kernel/world-state.ts";
import { findLocomotion } from "../src/kernel/world-state.ts";

function skillDuel(skillId: SkillId, seed = `multi-${skillId}`): MatchConfig {
  return createMatchConfig({
    seed,
    mechanicsRevision: DEFAULT_MECHANICS_REVISION,
    contentRevision: "content-prototype-arena-v1",
    roundDurationMs: 90_000,
    targetRoundWins: 2,
    seats: [
      { seatId: "seat-0", competitorId: "competitor-a", skillId },
      { seatId: "seat-1", competitorId: "competitor-b" },
    ],
  });
}

function enterPlaying(program: ReturnType<typeof createDefaultMechanicsProgram>, state: WorldState): WorldState {
  let next = state;
  for (let i = 0; i < 100; i += 1) {
    if (next.slices.match.phase === "playing" || next.slices.match.phase === "sudden-death") {
      return next;
    }
    next = program.step(next, { commands: [] }).state;
  }
  throw new Error(`never entered playing (phase=${next.slices.match.phase})`);
}

function useSkill(state: WorldState, config: MatchConfig, sequence = 0) {
  return {
    tick: state.tick,
    sequence,
    seatId: config.seats[0]!.seatId,
    command: { type: "use-skill" as const },
  };
}

function press(state: WorldState, config: MatchConfig, direction: "up" | "down" | "left" | "right", sequence = 0) {
  return {
    tick: state.tick,
    sequence,
    seatId: config.seats[0]!.seatId,
    command: { type: "set-movement" as const, direction, pressed: true },
  };
}

describe("multi-skill roster (all ultimate IDs)", () => {
  it("assigns every skill id and activates without rejection", () => {
    const program = createDefaultMechanicsProgram();
    for (const skillId of SKILL_IDS) {
      const config = skillDuel(skillId);
      let state = enterPlaying(program, program.initial(config));
      expect(state.slices.skills.entries).toHaveLength(1);
      expect(state.slices.skills.entries[0]!.skillId).toBe(skillId);
      expect(state.slices.skills.entries[0]!.phase).toBe("idle");

      state = program.step(state, {
        commands: [press(state, config, "right", 0)],
      }).state;
      const activated = program.step(state, {
        commands: [useSkill(state, config, 1)],
      });
      expect(activated.rejections, skillId).toEqual([]);
      const entry = activated.state.slices.skills.entries[0]!;
      // Activate either channels or (same-tick complete) lands on cooldown.
      expect(["channeling", "cooldown"]).toContain(entry.phase);
      if (entry.phase === "channeling") {
        expect(entry.channelRemainingMs).toBeGreaterThan(0);
        expect(entry.channelRemainingMs % TICK_DURATION_MS).toBe(0);
      }
    }
  });

  it("dash skills teleport the caster forward", () => {
    const program = createDefaultMechanicsProgram();
    for (const skillId of ["killer-bee-wing-dash"] as const) {
      const config = skillDuel(skillId, `dash-${skillId}`);
      let state = enterPlaying(program, program.initial(config));
      // Clear crates so dash path is open.
      const raw = JSON.parse(JSON.stringify(state)) as {
        slices: { arena: { crates: unknown[] }; locomotion: { entries: unknown[] } };
      } & WorldState;
      (raw.slices as { arena: { crates: unknown[] } }).arena = {
        ...raw.slices.arena,
        crates: [],
      };
      state = program.restore(raw as unknown as WorldState);
      const alpha = config.seats[0]!.competitorId;
      const before = findLocomotion(state.slices.locomotion, alpha)!.position;
      state = program.step(state, { commands: [press(state, config, "right", 0)] }).state;
      state = program.step(state, { commands: [useSkill(state, config, 1)] }).state;
      for (let i = 0; i < 40; i += 1) {
        state = program.step(state, { commands: [] }).state;
        if (state.slices.skills.entries[0]!.phase === "cooldown") break;
      }
      const after = findLocomotion(state.slices.locomotion, alpha)!.position;
      expect(after.x, skillId).toBeGreaterThan(before.x);
      expect(state.slices.skills.entries[0]!.phase).toBe("cooldown");
    }
  });
});
