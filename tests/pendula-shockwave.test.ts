import { describe, expect, it } from "vitest";
import type { ArenaState, PlayerState } from "../src/original-game/Gameplay/types";
import type { SkillContext } from "../src/original-game/ultimate/shared";
import {
  firePendulaPull,
  pullPlayerToward,
  PENDULA_SKILL_CHANNEL_MS,
  PENDULA_PULL_RANGE,
} from "../Champions/pendula/skill";
import { PENDULA_SKILL_ID } from "../Champions/pendula/definition";
import { createDefaultPlayerSkillState } from "../src/original-game/ultimate/shared";

const TS = 40;

function emptyArena(width = 11, height = 11): ArenaState {
  return {
    solid: new Set(),
    breakable: new Set(),
    config: {
      grid: { width, height },
    },
  } as unknown as ArenaState;
}

function makePlayer(
  id: number,
  tileX: number,
  tileY: number,
): PlayerState {
  return {
    id: id as PlayerState["id"],
    alive: true,
    position: { x: TS * tileX + TS / 2, y: TS * tileY + TS / 2 },
    tile: { x: tileX, y: tileY },
    direction: "down",
    lastMoveDirection: "down",
    velocity: { x: 0, y: 0 },
    skill: {
      ...createDefaultPlayerSkillState(PENDULA_SKILL_ID),
      projectedLastMoveDirection: "down",
    },
  } as unknown as PlayerState;
}

function makeContext(
  players: Record<number, PlayerState>,
  overrides: Partial<SkillContext> = {},
): SkillContext {
  const arena = emptyArena();
  const activePlayerIds = Object.keys(players).map(Number) as SkillContext["activePlayerIds"];
  const base = {
    arena,
    bombs: [] as SkillContext["bombs"],
    players: players as unknown as SkillContext["players"],
    activePlayerIds,
    addChampionWorldEffect: (() => {}) as SkillContext["addChampionWorldEffect"],
    selectedCharacterIndex: Object.fromEntries(
      activePlayerIds.map((id) => [id, 0]),
    ) as SkillContext["selectedCharacterIndex"],
    characterRoster: [],
    canOccupyPosition: () => true,
    getTileFromPosition: (position: { x: number; y: number }) => ({
      x: Math.floor(position.x / TS),
      y: Math.floor(position.y / TS),
    }),
    normalizeArenaPosition: (p: { x: number; y: number }) => p,
    getWrappedDelta: (target: number, current: number) => target - current,
    resolveMovementDirection: (_p: unknown, d: "down" | null) => d ?? "down",
    movePlayerSimulated: () => {},
    isPositionOverlappingTile: (
      position: { x: number; y: number },
      tile: { x: number; y: number },
    ) =>
      Math.floor(position.x / TS) === tile.x &&
      Math.floor(position.y / TS) === tile.y,
    clonePlayerState: (p: PlayerState) => structuredClone(p),
    tryAbsorbInstantHit: () => {},
    breakCrateAtKey: () => false,
    addFlame: () => {},
    soundManager: { playOneShot: () => {} },
  };
  return { ...base, ...overrides } as unknown as SkillContext;
}

describe("Pendula Command: Pull", () => {
  it("uses a 300ms channel (3× faster than the old 900ms cast)", () => {
    expect(PENDULA_SKILL_CHANNEL_MS).toBe(300);
  });

  it("yanks an enemy to an adjacent tile (Orianna-style, through open space)", () => {
    const pendula = makePlayer(1, 4, 4);
    const enemy = makePlayer(2, 7, 4);
    const context = makeContext({ 1: pendula, 2: enemy });
    const reserved = new Set<string>(["4,4"]);
    const moved = pullPlayerToward(enemy, { x: 4, y: 4 }, context, reserved);
    expect(moved).toBe(true);
    // Adjacent ring around center.
    expect(Math.max(Math.abs(enemy.tile.x - 4), Math.abs(enemy.tile.y - 4))).toBe(1);
  });

  it("pulls through a solid wall when the landing tile is free", () => {
    const pendula = makePlayer(1, 4, 4);
    const enemy = makePlayer(2, 7, 4);
    const context = makeContext({ 1: pendula, 2: enemy });
    // Wall between them — old path-step pull failed here.
    context.arena.solid.add("6,4");
    context.arena.solid.add("5,4");
    const reserved = new Set<string>(["4,4"]);
    expect(pullPlayerToward(enemy, { x: 4, y: 4 }, context, reserved)).toBe(true);
    expect(Math.max(Math.abs(enemy.tile.x - 4), Math.abs(enemy.tile.y - 4))).toBe(1);
    // Not on the solid tiles.
    expect(context.arena.solid.has(`${enemy.tile.x},${enemy.tile.y}`)).toBe(false);
  });

  it("does not pull an enemy that is already adjacent", () => {
    const pendula = makePlayer(1, 4, 4);
    const enemy = makePlayer(2, 5, 4);
    const context = makeContext({ 1: pendula, 2: enemy });
    const reserved = new Set<string>(["4,4"]);
    expect(pullPlayerToward(enemy, { x: 4, y: 4 }, context, reserved)).toBe(
      false,
    );
    expect(enemy.tile).toEqual({ x: 5, y: 4 });
  });

  it("fires a radial pull and spawns an inward ring effect", () => {
    const effects: unknown[] = [];
    const pendula = makePlayer(1, 4, 4);
    const near = makePlayer(2, 6, 4);
    const far = makePlayer(3, 4, 7);
    // Chebyshev 8 from center — outside PENDULA_PULL_RANGE (4).
    const outOfRange = makePlayer(4, 0, 0);
    const context = makeContext(
      { 1: pendula, 2: near, 3: far, 4: outOfRange },
      {
        addChampionWorldEffect: (effect) => {
          effects.push(effect);
        },
      },
    );
    const pulled = firePendulaPull(pendula, context);
    // near (dist 2) + far (dist 3) in range; (0,0) dist 4 is also in range when RANGE=4
    expect(pulled).toBeGreaterThanOrEqual(2);
    expect(Math.max(Math.abs(near.tile.x - 4), Math.abs(near.tile.y - 4))).toBe(1);
    expect(Math.max(Math.abs(far.tile.x - 4), Math.abs(far.tile.y - 4))).toBe(1);
    expect(effects).toHaveLength(1);
    expect(effects[0]).toMatchObject({
      kind: "pendula-pull",
      origin: { x: 4, y: 4 },
      maxRadiusTiles: PENDULA_PULL_RANGE,
    });
  });
});
