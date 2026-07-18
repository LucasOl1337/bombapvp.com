import { describe, expect, it } from "vitest";
import type { ArenaState } from "../src/original-game/Gameplay/types";
import type { SkillContext } from "../src/original-game/ultimate/shared";
import {
  firePendulaShockwave,
  tryPushBombAway,
} from "../Champions/pendula/skill";
import { PENDULA_SKILL_ID } from "../Champions/pendula/definition";
import { createDefaultPlayerSkillState } from "../src/original-game/ultimate/shared";

function emptyArena(width = 7, height = 7): ArenaState {
  return {
    solid: new Set(),
    breakable: new Set(),
    config: {
      grid: { width, height, tileSize: 32 },
    },
  } as unknown as ArenaState;
}

function makeContext(overrides: Partial<SkillContext> & { bombs: SkillContext["bombs"] }): SkillContext {
  const arena = emptyArena();
  const player = {
    id: 1 as const,
    alive: true,
    position: { x: 32 * 3 + 16, y: 32 * 3 + 16 },
    tile: { x: 3, y: 3 },
    direction: "down" as const,
    lastMoveDirection: "down" as const,
    velocity: { x: 0, y: 0 },
    skill: {
      ...createDefaultPlayerSkillState(PENDULA_SKILL_ID),
      projectedLastMoveDirection: "down" as const,
    },
  };
  const base = {
    arena,
    bombs: overrides.bombs,
    players: { 1: player, 2: player, 3: player, 4: player } as unknown as SkillContext["players"],
    activePlayerIds: [1] as const,
    addChampionWorldEffect: (() => {}) as SkillContext["addChampionWorldEffect"],
    selectedCharacterIndex: { 1: 0, 2: 0, 3: 0, 4: 0 },
    characterRoster: [],
    canOccupyPosition: () => true,
    getTileFromPosition: (position: { x: number; y: number }) => ({
      x: Math.floor(position.x / 32),
      y: Math.floor(position.y / 32),
    }),
    normalizeArenaPosition: (p: { x: number; y: number }) => p,
    getWrappedDelta: (target: number, current: number) => target - current,
    resolveMovementDirection: (_p: unknown, d: "down" | null) => d ?? "down",
    movePlayerSimulated: () => {},
    isPositionOverlappingTile: (
      position: { x: number; y: number },
      tile: { x: number; y: number },
    ) =>
      Math.floor(position.x / 32) === tile.x &&
      Math.floor(position.y / 32) === tile.y,
    clonePlayerState: (p: typeof player) => structuredClone(p),
    tryAbsorbInstantHit: () => {},
    breakCrateAtKey: () => false,
    addFlame: () => {},
    soundManager: { playOneShot: () => {} },
  };
  return { ...base, ...overrides, bombs: overrides.bombs } as unknown as SkillContext;
}

describe("Pendula Command: Shockwave", () => {
  it("pushes a bomb one tile away from the epicenter", () => {
    const bombs = [
      {
        id: 10,
        ownerId: 1 as const,
        tile: { x: 4, y: 3 },
        fuseMs: 2000,
        ownerCanPass: true,
        flameRange: 2,
      },
    ];
    const context = makeContext({ bombs });
    const moved = tryPushBombAway(10, { x: 3, y: 3 }, "down", context);
    expect(moved).toBe(true);
    expect(bombs[0]!.tile).toEqual({ x: 5, y: 3 });
    expect(bombs[0]!.ownerCanPass).toBe(false);
  });

  it("does not push into solid tiles", () => {
    const bombs = [
      {
        id: 11,
        ownerId: 1 as const,
        tile: { x: 4, y: 3 },
        fuseMs: 2000,
        ownerCanPass: true,
        flameRange: 2,
      },
    ];
    const context = makeContext({ bombs });
    context.arena.solid.add("5,3");
    expect(tryPushBombAway(11, { x: 3, y: 3 }, "down", context)).toBe(false);
    expect(bombs[0]!.tile).toEqual({ x: 4, y: 3 });
  });

  it("fires a radial scatter and spawns a visual ring effect", () => {
    const effects: unknown[] = [];
    const bombs = [
      {
        id: 1,
        ownerId: 1 as const,
        tile: { x: 3, y: 2 },
        fuseMs: 1500,
        ownerCanPass: true,
        flameRange: 1,
      },
      {
        id: 2,
        ownerId: 2 as const,
        tile: { x: 5, y: 3 },
        fuseMs: 1500,
        ownerCanPass: true,
        flameRange: 1,
      },
      {
        id: 3,
        ownerId: 1 as const,
        tile: { x: 0, y: 0 },
        fuseMs: 1500,
        ownerCanPass: true,
        flameRange: 1,
      },
    ];
    const context = makeContext({
      bombs,
      addChampionWorldEffect: (effect) => {
        effects.push(effect);
      },
    });
    const player = context.players[1]!;
    const pushed = firePendulaShockwave(player, context);
    expect(pushed).toBe(2);
    expect(bombs[0]!.tile).toEqual({ x: 3, y: 1 });
    expect(bombs[1]!.tile).toEqual({ x: 6, y: 3 });
    expect(bombs[2]!.tile).toEqual({ x: 0, y: 0 });
    expect(effects).toHaveLength(1);
    expect(effects[0]).toMatchObject({
      kind: "pendula-shockwave",
      origin: { x: 3, y: 3 },
    });
  });
});
