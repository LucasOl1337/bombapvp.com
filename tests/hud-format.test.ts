/**
 * Pure HUD string / layout helpers — tests against shipped geometry.
 */
import { describe, expect, it } from "vitest";

import {
  computeRivalSlotWidth,
  ellipsisText,
  formatHudScoreLine,
  formatHudStatLine,
  HUD_LAYOUT,
  partitionHudPlayers,
} from "../src/original-game/Engine/hud-format";
import { ARENA_OFFSET_Y, HUD_HEIGHT } from "../src/original-game/PersonalConfig/config";

describe("ellipsisText", () => {
  it("returns the original string when within budget", () => {
    expect(ellipsisText("Ranni", 12)).toBe("Ranni");
  });

  it("uses a single ellipsis character for long names", () => {
    expect(ellipsisText("Crocodilo Arcano", 12)).toBe("Crocodilo A…");
  });

  it("handles tiny budgets without overflowing", () => {
    expect(ellipsisText("ABC", 1)).toBe("…");
    expect(ellipsisText("ABC", 2).length).toBeLessThanOrEqual(2);
  });
});

describe("formatHudStatLine", () => {
  it("spaces B/F/S tokens so levels never glue to letters", () => {
    const line = formatHudStatLine({
      maxBombs: 2,
      flameRange: 3,
      speedLevel: 1,
      shortFuseLevel: 0,
    });
    expect(line).toMatch(/B\s+2/);
    expect(line).toMatch(/F\s+3/);
    expect(line).toMatch(/S\s+1/);
  });

  it("optionally appends short-fuse level", () => {
    const line = formatHudStatLine(
      { maxBombs: 1, flameRange: 1, speedLevel: 0, shortFuseLevel: 2 },
      { includeShortFuse: true },
    );
    expect(line).toMatch(/Q\s+2|SF\s+2|Fuse/i);
  });
});

describe("formatHudScoreLine", () => {
  it("formats endless K/W and standard wins", () => {
    expect(formatHudScoreLine("endless", { kills: 3, wins: 1 })).toMatch(/K/);
    expect(formatHudScoreLine("standard", { kills: 0, wins: 2 })).toMatch(/2|W/);
  });
});

describe("partitionHudPlayers", () => {
  it("keeps local out of rival gutters", () => {
    const { leftRivals, rightRivals } = partitionHudPlayers(
      ["p1", "p2", "p3", "p4"] as any,
      "p1" as any,
    );
    expect(leftRivals).not.toContain("p1");
    expect(rightRivals).not.toContain("p1");
    expect([...leftRivals, ...rightRivals].sort()).toEqual(["p2", "p3", "p4"].sort());
  });

  it("places a single rival on the right of center meta", () => {
    const { leftRivals, rightRivals } = partitionHudPlayers(["p1", "p2"] as any, "p1" as any);
    expect(leftRivals.length + rightRivals.length).toBe(1);
  });

  it("supports non-P1 local seats (online guest)", () => {
    const { leftRivals, rightRivals } = partitionHudPlayers(
      ["p1", "p2", "p3"] as any,
      "p2" as any,
    );
    expect([...leftRivals, ...rightRivals]).not.toContain("p2");
  });
});

describe("computeRivalSlotWidth", () => {
  it("clamps between min and max and accounts for gaps", () => {
    const wide = computeRivalSlotWidth(400, 2);
    expect(wide).toBeGreaterThanOrEqual(HUD_LAYOUT.rivalSlotMinWidth);
    expect(wide).toBeLessThanOrEqual(HUD_LAYOUT.rivalSlotMaxWidth);

    const narrow = computeRivalSlotWidth(80, 2, 40, 200, 4);
    expect(narrow).toBe(40);
  });
});

describe("HUD geometry constants", () => {
  it("keeps config HUD_HEIGHT aligned with two-row layout", () => {
    expect(HUD_HEIGHT).toBe(HUD_LAYOUT.height);
    expect(HUD_HEIGHT).toBeGreaterThanOrEqual(72);
    // Arena origin stays fixed so HUD growth does not shift gameplay coordinates.
    expect(ARENA_OFFSET_Y).toBe(66);
    expect(HUD_LAYOUT.localPanelY + HUD_LAYOUT.localPanelHeight).toBeLessThanOrEqual(HUD_LAYOUT.height);
    expect(HUD_LAYOUT.topRowY + HUD_LAYOUT.topRowHeight).toBeLessThanOrEqual(HUD_LAYOUT.localPanelY);
  });
});
