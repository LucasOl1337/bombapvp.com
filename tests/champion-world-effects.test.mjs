import { describe, expect, it } from "vitest";
import { createChampionVisualRuntime } from "../Champions/visual-runtime.ts";

describe("Champion world effects", () => {
  it("delegates Nico effect lifetime to Nico's visual adapter", () => {
    const runtime = createChampionVisualRuntime();
    const effect = {
      ownerId: 1,
      origin: { x: 2, y: 3 },
      direction: "right",
      tiles: [{ x: 3, y: 3 }],
      remainingMs: 260,
    };

    const advanced = runtime.advanceWorldEffects([effect], 100);
    expect(advanced).toEqual([{ ...effect, remainingMs: 160 }]);
    expect(effect.remainingMs).toBe(260);
    expect(runtime.advanceWorldEffects(advanced, 160)).toEqual([]);
  });
});
