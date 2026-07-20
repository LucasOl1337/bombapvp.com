import { describe, expect, it } from "vitest";
import type { ArenaState, PlayerState } from "../src/original-game/Gameplay/types";
import { createDefaultPlayerSkillState } from "../src/original-game/ultimate/shared";
import {
  findTideSwapTarget,
  findTideSwapBomb,
  fireTideSwap,
  MIRELLE_SWAP_RANGE,
  MIRELLE_POST_SWAP_GUARD_MS,
} from "../Champions/mirelle/skill";
import { MIRELLE_SKILL_ID } from "../Champions/mirelle/definition";
import { listChampionMembership } from "../Champions/membership";
import { getChampionSkillAdapter } from "../Champions/runtime";

const TS = 40;

function makePlayer(
  id: number,
  tileX: number,
  tileY: number,
  skillId: string,
): PlayerState {
  return {
    id: id as PlayerState["id"],
    alive: true,
    position: { x: TS * tileX + TS / 2, y: TS * tileY + TS / 2 },
    tile: { x: tileX, y: tileY },
    direction: "right",
    lastMoveDirection: "right",
    velocity: { x: 0, y: 0 },
    flameGuardMs: 0,
    skill: {
      ...createDefaultPlayerSkillState(skillId as never),
      projectedLastMoveDirection: "right",
    },
  } as unknown as PlayerState;
}

function emptyArena(): ArenaState {
  return {
    solid: new Set<string>(),
    breakable: new Set<string>(["5,5", "6,5", "1,1"]),
    config: { grid: { width: 11, height: 11 } },
  } as unknown as ArenaState;
}

function tileFromPos(p: { x: number; y: number }) {
  return { x: Math.floor(p.x / TS), y: Math.floor(p.y / TS) };
}

describe("Mirelle Tide Exchange (kept wave-2 champion)", () => {
  it("registers Mirelle skill adapter and no deleted 8-12 slugs", () => {
    const slugs = listChampionMembership().map((m) => m.slug);
    expect(slugs).toContain("mirelle");
    expect(slugs).toContain("pendula");
    expect(slugs).toContain("lee-sin");
    for (const dead of ["bram", "zephyr", "hexa", "aegis", "lumen"]) {
      expect(slugs).not.toContain(dead);
    }
    expect(getChampionSkillAdapter(MIRELLE_SKILL_ID)?.skillId).toBe(
      MIRELLE_SKILL_ID,
    );
  });

  it("swaps nearest enemy and grants dual short guard", () => {
    const caster = makePlayer(1, 4, 4, MIRELLE_SKILL_ID);
    const near = makePlayer(2, 6, 4, MIRELLE_SKILL_ID);
    const far = makePlayer(3, 10, 10, MIRELLE_SKILL_ID);
    const players = { 1: caster, 2: near, 3: far } as never;
    const effects: unknown[] = [];
    const context = {
      players,
      activePlayerIds: [1, 2, 3] as number[],
      bombs: [],
      arena: emptyArena(),
      getTileFromPosition: tileFromPos,
      normalizeArenaPosition: (p: { x: number; y: number }) => p,
      canOccupyPosition: () => true,
      addChampionWorldEffect: (e: unknown) => {
        effects.push(e);
      },
      soundManager: { playOneShot: () => {} },
    };
    expect(findTideSwapTarget(caster, context as never)?.id).toBe(2);
    expect(MIRELLE_SWAP_RANGE).toBe(4);
    expect(fireTideSwap(caster, context as never)).toBe(true);
    expect(caster.tile).toEqual({ x: 6, y: 4 });
    expect(near.tile).toEqual({ x: 4, y: 4 });
    expect(far.tile).toEqual({ x: 10, y: 10 });
    expect(caster.flameGuardMs).toBe(MIRELLE_POST_SWAP_GUARD_MS);
    expect(near.flameGuardMs).toBe(MIRELLE_POST_SWAP_GUARD_MS);
    expect(effects).toHaveLength(1);
    expect(effects[0]).toMatchObject({ kind: "mirelle-tide-swap" });
  });

  it("falls back to bomb-tile exchange when no enemy is in range", () => {
    const caster = makePlayer(1, 4, 4, MIRELLE_SKILL_ID);
    const bombs = [
      {
        id: 9,
        ownerId: 1 as const,
        tile: { x: 6, y: 4 },
        fuseMs: 2000,
        ownerCanPass: true,
        bodyEgressPlayerIds: [] as number[],
        flameRange: 1,
      },
    ];
    const context = {
      players: { 1: caster } as never,
      activePlayerIds: [1] as number[],
      bombs,
      arena: emptyArena(),
      getTileFromPosition: tileFromPos,
      normalizeArenaPosition: (p: { x: number; y: number }) => p,
      canOccupyPosition: () => true,
      addChampionWorldEffect: () => {},
      soundManager: { playOneShot: () => {} },
    };
    expect(findTideSwapBomb(caster, context as never)?.id).toBe(9);
    expect(fireTideSwap(caster, context as never)).toBe(true);
    expect(caster.tile).toEqual({ x: 6, y: 4 });
    expect(bombs[0]!.tile).toEqual({ x: 4, y: 4 });
  });
});
