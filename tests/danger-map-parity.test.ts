import { describe, expect, it } from "vitest";
import { buildDangerMap } from "../src/original-game/Engine/danger-map.ts";

describe("paridade da previsao de perigo", () => {
  it("projeta uma bomba encadeada atraves da caixa removida antes dela", () => {
    const arena = {
      config: { grid: { width: 7, height: 3 } },
      solid: new Set<string>(),
      breakable: new Set(["4,1"]),
      powerUps: [],
    };

    const danger = buildDangerMap({
      bombs: [
        {
          id: 1,
          ownerId: 1,
          tile: { x: 1, y: 1 },
          fuseMs: 100,
          ownerCanPass: false,
          flameRange: 4,
        },
        {
          id: 2,
          ownerId: 2,
          tile: { x: 3, y: 1 },
          fuseMs: 900,
          ownerCanPass: false,
          flameRange: 3,
        },
      ],
      flames: [],
      arena,
      suddenDeathActive: false,
      suddenDeathTickMs: 0,
      suddenDeathIndex: 0,
      suddenDeathPath: [],
      suddenDeathClosureEffects: [],
    });

    expect(danger.get("5,1")).toBe(100);
  });

  it("mantem caixas destruidas ao projetar ondas futuras independentes", () => {
    const danger = buildDangerMap({
      bombs: [
        {
          id: 1,
          ownerId: 1,
          tile: { x: 3, y: 0 },
          fuseMs: 100,
          ownerCanPass: false,
          flameRange: 2,
        },
        {
          id: 2,
          ownerId: 2,
          tile: { x: 1, y: 2 },
          fuseMs: 900,
          ownerCanPass: false,
          flameRange: 4,
        },
      ],
      flames: [],
      arena: {
        config: { grid: { width: 7, height: 5 } },
        solid: new Set<string>(),
        breakable: new Set(["3,2"]),
      },
      suddenDeathActive: false,
      suddenDeathTickMs: 0,
      suddenDeathIndex: 0,
      suddenDeathPath: [],
      suddenDeathClosureEffects: [],
    });

    expect(danger.get("5,2")).toBe(900);
  });
});
