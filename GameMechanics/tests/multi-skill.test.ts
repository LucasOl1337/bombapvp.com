import { describe, expect, it } from "vitest";
import {
  SKILL_IDS,
  TICK_DURATION_MS,
  type GameEvent,
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

/**
 * The kernel is the sole authority on how a channel ended. These tests exist so
 * the outcome is verifiable here — presentation used to infer it from cooldown
 * magnitude, where nothing could assert it.
 */
describe("skill events carry authoritative outcomes", () => {
  type ChannelStarted = Extract<GameEvent, { type: "skill-channel-started" }>;
  type Resolved = Extract<GameEvent, { type: "skill-resolved" }>;

  /** Cast, then run to cooldown, collecting every skill event on the way. */
  function castAndCollect(skillId: SkillId, seed: string) {
    const program = createDefaultMechanicsProgram();
    const config = skillDuel(skillId, seed);
    let state = enterPlaying(program, program.initial(config));
    const events: GameEvent[] = [];

    state = program.step(state, { commands: [press(state, config, "right", 0)] }).state;
    const activated = program.step(state, { commands: [useSkill(state, config, 1)] });
    state = activated.state;
    events.push(...activated.events);

    for (let i = 0; i < 200; i += 1) {
      if (events.some((event) => event.type === "skill-resolved")) break;
      const stepped = program.step(state, { commands: [] });
      state = stepped.state;
      events.push(...stepped.events);
    }

    return {
      state,
      started: events.filter((e): e is ChannelStarted => e.type === "skill-channel-started"),
      resolved: events.filter((e): e is Resolved => e.type === "skill-resolved"),
    };
  }

  it("opens exactly one channel and closes it exactly once, for every skill id", () => {
    for (const skillId of SKILL_IDS) {
      const { started, resolved } = castAndCollect(skillId, `events-${skillId}`);
      expect(started, skillId).toHaveLength(1);
      expect(started[0]!.skillId, skillId).toBe(skillId);
      expect(started[0]!.aim, skillId).toBe("right");
      expect(started[0]!.channelMs, skillId).toBeGreaterThanOrEqual(0);

      expect(resolved, skillId).toHaveLength(1);
      const end = resolved[0]!;
      expect(end.skillId, skillId).toBe(skillId);
      // The aim the kernel actually used — not resampled from a later snapshot.
      expect(end.aim, skillId).toBe(started[0]!.aim);
      // Origin is the resolution tile; skills that move mid-channel may differ.
      expect(Number.isInteger(end.origin.x), skillId).toBe(true);
      expect(Number.isInteger(end.origin.y), skillId).toBe(true);
      expect(["hit", "miss", "cancelled"], skillId).toContain(end.outcome);
    }
  });

  it("reports a Thresh hook that catches nobody as a miss with no targets", () => {
    // Opposite corners in the default duel: nothing stands in the hook's path.
    const { resolved } = castAndCollect("thresh-death-sentence", "hook-whiff");
    expect(resolved).toHaveLength(1);
    expect(resolved[0]!.outcome).toBe("miss");
    expect(resolved[0]!.targets).toEqual([]);
  });

  it("reports a committed dash as a hit", () => {
    const { resolved } = castAndCollect("killer-bee-wing-dash", "dash-outcome");
    expect(resolved).toHaveLength(1);
    expect(resolved[0]!.outcome).toBe("hit");
  });

  it("reports a Living Shadow that is never re-triggered as cancelled", () => {
    // Zed's channel expires untouched — a cancel, never a miss.
    const { resolved } = castAndCollect("zed-living-shadow", "shadow-timeout");
    expect(resolved).toHaveLength(1);
    expect(resolved[0]!.outcome).toBe("cancelled");
  });
});
