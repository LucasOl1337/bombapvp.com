import { describe, expect, it } from "vitest";

import {
  collectIntegratedAnimationOverrides,
  selectBombAnimationAction,
  selectFacingFrames,
  selectSkillAnimationAction,
} from "../src/browser/champion-animation-selection.ts";

describe("champion animation selection", () => {
  it("uses the integrated south sequence when that action overrides a legacy facing", () => {
    const frames = {
      south: ["new-south-0", "new-south-1"],
      north: ["legacy-north-0"],
      east: ["legacy-east-0"],
      west: ["legacy-west-0"],
    } as const;

    expect(selectFacingFrames(frames, "north", "south")).toEqual([
      "new-south-0",
      "new-south-1",
    ]);
  });

  it("uses an integrated attack for a skill instead of the legacy cast", () => {
    expect(
      selectSkillAnimationAction(
        { attack: true, cast: true, ultimate: false },
        ["attack"],
      ),
    ).toBe("attack");
  });

  it("keeps an integrated cast reachable when the skill uses an ultimate", () => {
    expect(
      selectBombAnimationAction(
        { attack: false, cast: true, ultimate: true },
        ["cast", "ultimate"],
      ),
    ).toBe("cast");
  });

  it("discovers every champion animation explicitly integrated by a manifest", () => {
    const overrides = collectIntegratedAnimationOverrides([
      {
        runtimeIntegration: true,
        runtimeAction: "idle",
        runtimeDirection: "south",
        champion: { slug: "madara" },
      },
      {
        runtimeIntegration: true,
        runtimeAction: "ultimate",
        runtimeDirection: "south",
        champion: { slug: "madara" },
      },
      {
        runtimeIntegration: false,
        runtimeAction: "attack",
        runtimeDirection: "south",
        champion: { slug: "discarded" },
      },
    ]);

    expect(overrides.get("madara")).toEqual({
      idle: "south",
      ultimate: "south",
    });
    expect(overrides.has("discarded")).toBe(false);
  });
});
