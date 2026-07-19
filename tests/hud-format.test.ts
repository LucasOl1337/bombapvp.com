import { describe, expect, it } from "vitest";
import {
  computeRivalSlotWidth,
  ellipsisText,
  formatHudScoreLine,
  formatHudStatLine,
  HUD_LAYOUT,
  partitionHudPlayers,
} from "../src/original-game/Engine/hud-format";
import { HUD_HEIGHT, ARENA_OFFSET_Y } from "../src/original-game/PersonalConfig/config";

describe("ellipsisText", () => {
  it("returns the original string when within budget", () => {
    expect(ellipsisText("Nico", 12)).toBe("Nico");
  });

  it("uses a single ellipsis character for long names", () => {
    expect(ellipsisText("Crocodilo Arcano", 12)).toBe("Crocodilo A…");
    expect(ellipsisText("Crocodilo Arcano", 12).endsWith("…")).toBe(true);
    expect(ellipsisText("Crocodilo Arcano", 12).includes("...")).toBe(false);
  });

  it("handles tiny budgets without overflowing", () => {
    expect(ellipsisText("Ranni", 1)).toBe("…");
    expect(ellipsisText("Ranni", 2).length).toBe(2);
    expect(ellipsisText("", 8)).toBe("");
  });
});

describe("formatHudStatLine", () => {
  it("spaces B/F/S tokens so levels never glue to letters", () => {
    expect(
      formatHudStatLine(
        { maxBombs: 2, flameRange: 3, speedLevel: 0, shortFuseLevel: 0 },
        false,
      ),
    ).toBe("B 2 · F 3 · S 0");
  });

  it("optionally appends short-fuse level", () => {
    expect(
      formatHudStatLine(
        { maxBombs: 1, flameRange: 1, speedLevel: 1, shortFuseLevel: 2 },
        true,
      ),
    ).toBe("B 1 · F 1 · S 1 · Q 2");
  });
});

describe("formatHudScoreLine", () => {
  it("formats endless K/W and standard wins", () => {
    expect(formatHudScoreLine("endless", { kills: 3, wins: 1 })).toBe("K3 W1");
    expect(formatHudScoreLine("standard", { wins: 2 })).toBe("W2");
  });
});

describe("partitionHudPlayers", () => {
  it("keeps local out of rival gutters", () => {
    const result = partitionHudPlayers([1, 2, 3, 4], 1);
    expect(result.localPlayerId).toBe(1);
    expect(result.leftRivals).toEqual([2, 3]);
    expect(result.rightRivals).toEqual([4]);
    expect([...result.leftRivals, ...result.rightRivals]).not.toContain(1);
  });

  it("places a single rival on the right of center meta", () => {
    expect(partitionHudPlayers([1, 2], 1)).toEqual({
      localPlayerId: 1,
      leftRivals: [],
      rightRivals: [2],
    });
  });

  it("supports non-P1 local seats (online guest)", () => {
    const result = partitionHudPlayers([1, 2, 3, 4], 3);
    expect(result.localPlayerId).toBe(3);
    expect([...result.leftRivals, ...result.rightRivals].sort()).toEqual([1, 2, 4]);
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
  it("keeps visual HUD growth independent from world-space geometry", () => {
    expect(HUD_LAYOUT.height).toBeGreaterThan(HUD_HEIGHT);
    expect(ARENA_OFFSET_Y).toBe(HUD_HEIGHT + 6);
    expect(HUD_LAYOUT.localPanelY + HUD_LAYOUT.localPanelHeight).toBeLessThanOrEqual(HUD_LAYOUT.height);
    expect(HUD_LAYOUT.topRowY + HUD_LAYOUT.topRowHeight).toBeLessThanOrEqual(HUD_LAYOUT.localPanelY);
  });
});
