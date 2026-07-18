import { describe, expect, it } from "vitest";
import type { ArenaState, PlayerState } from "../src/original-game/Gameplay/types";
import { createDefaultPlayerSkillState } from "../src/original-game/ultimate/shared";
import {
  findTideSwapTarget,
  fireTideSwap,
  MIRELLE_SWAP_RANGE,
} from "../Champions/mirelle/skill";
import { MIRELLE_SKILL_ID } from "../Champions/mirelle/definition";
import {
  fireSeismicCrack,
  listSeismicCrackTargets,
  BRAM_CRACK_RANGE,
} from "../Champions/bram/skill";
import { BRAM_SKILL_ID } from "../Champions/bram/definition";
import {
  fireGaleScatter,
  pushBombAwayFromCenter,
  ZEPHYR_GALE_RANGE,
} from "../Champions/zephyr/skill";
import { ZEPHYR_SKILL_ID } from "../Champions/zephyr/definition";
import { fireFuseHex, HEXA_FUSE_FLOOR_MS, HEXA_HEX_RANGE } from "../Champions/hexa/skill";
import { HEXA_SKILL_ID } from "../Champions/hexa/definition";
import {
  fireBastionPulse,
  isAegisImmuneDuringChannel,
  AEGIS_GUARD_MS,
} from "../Champions/aegis/skill";
import { AEGIS_SKILL_ID } from "../Champions/aegis/definition";
import {
  computeFlashStepLanding,
  fireFlashStep,
  LUMEN_FLASH_MAX_TILES,
} from "../Champions/lumen/skill";
import { LUMEN_SKILL_ID } from "../Champions/lumen/definition";
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

describe("wave-2 champion skills (real entry points)", () => {
  it("registers six new membership skill adapters", () => {
    const wave2 = listChampionMembership().filter((m) =>
      ["mirelle", "bram", "zephyr", "hexa", "aegis", "lumen"].includes(m.slug),
    );
    expect(wave2).toHaveLength(6);
    for (const entry of wave2) {
      expect(getChampionSkillAdapter(entry.skillId)?.skillId).toBe(entry.skillId);
    }
  });

  it("Mirelle Tide Swap swaps caster with nearest enemy in range", () => {
    const caster = makePlayer(1, 4, 4, MIRELLE_SKILL_ID);
    const near = makePlayer(2, 6, 4, MIRELLE_SKILL_ID);
    const far = makePlayer(3, 10, 10, MIRELLE_SKILL_ID);
    const players = { 1: caster, 2: near, 3: far } as never;
    const effects: unknown[] = [];
    const context = {
      players,
      activePlayerIds: [1, 2, 3] as number[],
      getTileFromPosition: (p: { x: number; y: number }) => ({
        x: Math.floor(p.x / TS),
        y: Math.floor(p.y / TS),
      }),
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
    expect(effects).toHaveLength(1);
    expect(effects[0]).toMatchObject({ kind: "mirelle-tide-swap" });
  });

  it("Bram Seismic Crack breaks crates within range only", () => {
    const player = makePlayer(1, 5, 5, BRAM_SKILL_ID);
    const arena = emptyArena();
    const broken: string[] = [];
    const context = {
      arena,
      getTileFromPosition: (p: { x: number; y: number }) => ({
        x: Math.floor(p.x / TS),
        y: Math.floor(p.y / TS),
      }),
      breakCrateAtKey: (key: string) => {
        if (!arena.breakable.has(key)) return false;
        arena.breakable.delete(key);
        broken.push(key);
        return true;
      },
      soundManager: { playOneShot: () => {} },
    };
    const targets = listSeismicCrackTargets({ x: 5, y: 5 }, context);
    expect(targets.some((t) => t.x === 5 && t.y === 5)).toBe(true);
    expect(targets.some((t) => t.x === 1 && t.y === 1)).toBe(false);
    expect(BRAM_CRACK_RANGE).toBe(2);
    expect(fireSeismicCrack(player, context)).toBeGreaterThanOrEqual(2);
    expect(broken).toEqual(expect.arrayContaining(["5,5", "6,5"]));
    expect(broken).not.toContain("1,1");
  });

  it("Zephyr Gale Scatter pushes nearby bombs away from caster", () => {
    const player = makePlayer(1, 4, 4, ZEPHYR_SKILL_ID);
    const bombs = [
      {
        id: 10,
        ownerId: 1 as const,
        tile: { x: 5, y: 4 },
        fuseMs: 2000,
        ownerCanPass: true,
        bodyEgressPlayerIds: [] as number[],
        flameRange: 1,
      },
      {
        id: 11,
        ownerId: 2 as const,
        tile: { x: 0, y: 0 },
        fuseMs: 2000,
        ownerCanPass: true,
        bodyEgressPlayerIds: [] as number[],
        flameRange: 1,
      },
    ];
    const arena = emptyArena();
    arena.breakable.clear();
    const context = {
      arena,
      bombs,
      players: { 1: player } as never,
      activePlayerIds: [1] as number[],
      getTileFromPosition: (p: { x: number; y: number }) => ({
        x: Math.floor(p.x / TS),
        y: Math.floor(p.y / TS),
      }),
      isPositionOverlappingTile: () => false,
      soundManager: { playOneShot: () => {} },
    };
    expect(ZEPHYR_GALE_RANGE).toBe(2);
    expect(
      pushBombAwayFromCenter(10, { x: 4, y: 4 }, "right", context as never),
    ).toBe(true);
    expect(bombs[0]!.tile).toEqual({ x: 6, y: 4 });
    // reset and fire full scatter
    bombs[0]!.tile = { x: 5, y: 4 };
    expect(fireGaleScatter(player, context as never)).toBe(1);
    expect(bombs[1]!.tile).toEqual({ x: 0, y: 0 });
  });

  it("Hexa Fuse Hex halves bomb fuses in range with floor", () => {
    const player = makePlayer(1, 4, 4, HEXA_SKILL_ID);
    const bombs = [
      {
        id: 1,
        ownerId: 1 as const,
        tile: { x: 5, y: 4 },
        fuseMs: 2000,
        ownerCanPass: true,
        flameRange: 1,
      },
      {
        id: 2,
        ownerId: 1 as const,
        tile: { x: 0, y: 0 },
        fuseMs: 2000,
        ownerCanPass: true,
        flameRange: 1,
      },
    ];
    const context = {
      bombs,
      getTileFromPosition: (p: { x: number; y: number }) => ({
        x: Math.floor(p.x / TS),
        y: Math.floor(p.y / TS),
      }),
      soundManager: { playOneShot: () => {} },
    };
    expect(HEXA_HEX_RANGE).toBe(3);
    expect(fireFuseHex(player, context)).toBe(1);
    expect(bombs[0]!.fuseMs).toBe(1000);
    expect(bombs[1]!.fuseMs).toBe(2000);
    bombs[0]!.fuseMs = 500;
    fireFuseHex(player, context);
    expect(bombs[0]!.fuseMs).toBe(HEXA_FUSE_FLOOR_MS);
  });

  it("Aegis Bastion Pulse grants flame guard and channel immunity", () => {
    const player = makePlayer(1, 3, 3, AEGIS_SKILL_ID);
    player.skill.phase = "channeling";
    expect(isAegisImmuneDuringChannel(player)).toBe(true);
    fireBastionPulse(player, { soundManager: { playOneShot: () => {} } });
    expect(player.flameGuardMs).toBe(AEGIS_GUARD_MS);
  });

  it("Lumen Flash Step blinks up to two free tiles along facing", () => {
    const player = makePlayer(1, 2, 2, LUMEN_SKILL_ID);
    const arena = emptyArena();
    arena.breakable.clear();
    arena.solid.add("5,2");
    const context = {
      arena,
      getTileFromPosition: (p: { x: number; y: number }) => ({
        x: Math.floor(p.x / TS),
        y: Math.floor(p.y / TS),
      }),
      normalizeArenaPosition: (p: { x: number; y: number }) => p,
      canOccupyPosition: () => true,
      soundManager: { playOneShot: () => {} },
    };
    expect(LUMEN_FLASH_MAX_TILES).toBe(2);
    expect(computeFlashStepLanding(player, "right", context)).toEqual({
      x: 4,
      y: 2,
    });
    expect(fireFlashStep(player, "right", context)).toBe(true);
    expect(player.tile).toEqual({ x: 4, y: 2 });
  });
});
