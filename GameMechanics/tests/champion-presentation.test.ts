import { describe, expect, it } from "vitest";
import {
  CHAMPION_PRESENTATIONS,
  championPresentationFor,
  type PresentationCue,
} from "../src/browser/champion-presentation.ts";
import type { GameEvent, SkillId } from "../src/contracts.ts";
import {
  CROCODILO_EMERALD_SURGE_SKILL_ID,
  KILLER_BEE_WING_DASH_SKILL_ID,
  RANNI_ICE_BLINK_SKILL_ID,
  THRESH_DEATH_SENTENCE_SKILL_ID,
  ZED_LIVING_SHADOW_SKILL_ID,
} from "../src/contracts.ts";

/**
 * Each champion answers only for itself. These tests read one champion at a
 * time through the registry, so adding a champion cannot silently change how
 * another one reads on screen — the point of the per-champion split.
 */

function channelStart(skillId: SkillId): Extract<GameEvent, { type: "skill-channel-started" }> {
  return {
    type: "skill-channel-started",
    competitorId: "competitor-a" as never,
    skillId,
    aim: "right",
    origin: { x: 1, y: 1 },
    channelMs: 400,
  } as Extract<GameEvent, { type: "skill-channel-started" }>;
}

function resolved(
  skillId: SkillId,
  outcome: "hit" | "miss" | "cancelled",
): Extract<GameEvent, { type: "skill-resolved" }> {
  return {
    type: "skill-resolved",
    competitorId: "competitor-a" as never,
    skillId,
    outcome,
    aim: "right",
    origin: { x: 1, y: 1 },
    targets: [],
  } as Extract<GameEvent, { type: "skill-resolved" }>;
}

function playAction(cue: PresentationCue | undefined) {
  return cue?.kind === "play-action" ? cue : null;
}

describe("champion presentation registry", () => {
  it("resolves every registered champion by its own skill id", () => {
    for (const presentation of CHAMPION_PRESENTATIONS) {
      expect(championPresentationFor(presentation.skillId)).toBe(presentation);
    }
  });

  it("registers each skill id exactly once", () => {
    const ids = CHAMPION_PRESENTATIONS.map((presentation) => presentation.skillId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("stays silent for a skill no champion claims", () => {
    expect(championPresentationFor("not-a-skill" as SkillId)).toBeNull();
  });
});

describe("Ranni — Ice Blink", () => {
  const ranni = championPresentationFor(RANNI_ICE_BLINK_SKILL_ID)!;

  it("holds the frozen body for the whole channel, building first", () => {
    const cue = playAction(ranni.onChannelStart?.(channelStart(RANNI_ICE_BLINK_SKILL_ID))?.[0]);
    expect(cue?.prefer).toEqual(["skill"]);
    expect(cue?.buildMs).toBeGreaterThan(0);
    expect(cue!.durationMs!).toBeGreaterThan(cue!.buildMs!);
  });

  it("drops the pose outright when the blink lands", () => {
    const cues = ranni.onResolved?.(resolved(RANNI_ICE_BLINK_SKILL_ID, "hit"));
    expect(cues).toEqual([{ kind: "clear-action" }]);
  });
});

describe("Zed — Living Shadow", () => {
  const zed = championPresentationFor(ZED_LIVING_SHADOW_SKILL_ID)!;

  it("telegraphs the cast without locking the whole channel", () => {
    const cue = playAction(zed.onChannelStart?.(channelStart(ZED_LIVING_SHADOW_SKILL_ID))?.[0]);
    // Shorter than the 2000 ms channel so free-move locomotion still reads.
    expect(cue!.durationMs!).toBeLessThan(2_000);
    expect(cue!.buildMs!).toBeLessThan(cue!.durationMs!);
  });

  it("recovers through the bomb sequence on a committed swap", () => {
    const cue = playAction(zed.onResolved?.(resolved(ZED_LIVING_SHADOW_SKILL_ID, "hit"))?.[0]);
    expect(cue?.prefer).toEqual(["bomb", "skill"]);
  });

  it("uses a shorter cast-only pose on every non-hit outcome", () => {
    const swap = playAction(zed.onResolved?.(resolved(ZED_LIVING_SHADOW_SKILL_ID, "hit"))?.[0]);
    for (const outcome of ["miss", "cancelled"] as const) {
      const cue = playAction(zed.onResolved?.(resolved(ZED_LIVING_SHADOW_SKILL_ID, outcome))?.[0]);
      expect(cue?.prefer).toEqual(["skill"]);
      expect(cue!.durationMs!).toBeLessThan(swap!.durationMs!);
    }
  });
});

describe("Thresh — Death Sentence", () => {
  const thresh = championPresentationFor(THRESH_DEATH_SENTENCE_SKILL_ID)!;

  it("flies the chain on every cast, hit or whiff", () => {
    for (const outcome of ["hit", "miss", "cancelled"] as const) {
      expect(thresh.onResolved?.(resolved(THRESH_DEATH_SENTENCE_SKILL_ID, outcome)))
        .toEqual([{ kind: "hook-shot" }]);
    }
  });
});

describe("champions with no closing pose", () => {
  it("Killer Bee and Crocodilo cast plainly and let the skill's own effect close it", () => {
    for (const skillId of [KILLER_BEE_WING_DASH_SKILL_ID, CROCODILO_EMERALD_SURGE_SKILL_ID]) {
      const champion = championPresentationFor(skillId)!;
      const cue = playAction(champion.onChannelStart?.(channelStart(skillId))?.[0]);
      expect(cue?.prefer).toEqual(["skill"]);
      // No kernel-owned duration: the sequence free-runs.
      expect(cue?.durationMs).toBeUndefined();
      expect(champion.onResolved).toBeUndefined();
    }
  });
});
