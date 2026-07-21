import { describe, expect, it } from "vitest";

import {
  animationLabDestinationRect,
  animationLabSizeTiles,
} from "../src/browser/animation-lab-presentation.ts";

describe("animation-lab visibility", () => {
  it("caps each effect family to its gameplay footprint", () => {
    expect(animationLabSizeTiles("bomb")).toBe(1.45);
    expect(animationLabSizeTiles("hit")).toBe(0.9);
    expect(animationLabSizeTiles("power-up")).toBe(0.8);
    expect(animationLabSizeTiles("arena")).toBe(1.05);
    expect(animationLabSizeTiles("hud")).toBe(0.7);
  });

  it("centers trimmed content without exceeding the category cap", () => {
    const sizeTiles = animationLabSizeTiles("hit");
    const rect = animationLabDestinationRect(
      { width: 20, height: 32 },
      { centerX: 240, centerY: 240, tileSize: 48, sizeTiles },
    );

    expect(Math.max(rect.width, rect.height)).toBe(43.2);
    expect(rect.x + rect.width / 2).toBe(240);
    expect(rect.y + rect.height / 2).toBe(240);
  });
});
