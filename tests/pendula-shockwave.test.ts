import { describe, expect, it } from "vitest";
import type { ArenaState, PlayerState } from "../src/original-game/Gameplay/types";
import type { SkillContext } from "../src/original-game/ultimate/shared";
import {
  firePendulaPull,
  pullPlayerToward,
  PENDULA_SKILL_CHANNEL_MS,
} from "../Champions/pendula/skill";
import { PENDULA_SKILL_ID } from "../Champions/pendula/definition";
import { createDefaultPlayerSkillState } from "../src/original-game/ultimate/shared";

const TS = 40;

function emptyArena(width = 9, height = 9): ArenaState {
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

  it("pulls an enemy adjacent to Pendula", () => {
    const pendula = makePlayer(1, 4, 4);
    const enemy = makePlayer(2, 7, 4);
    const context = makeContext({ 1: pendula, 2: enemy });
    const reserved = new Set<string>(["4,4"]);
    reserved.add("7,4");
    reserved.delete("7,4");
    const moved = pullPlayerToward(enemy, { x: 4, y: 4 }, context, reserved);
    expect(moved).toBe(true);
    expect(enemy.tile).toEqual({ x: 5, y: 4 });
  });

  it("does not pull through solid tiles", () => {
    const pendula = makePlayer(1, 4, 4);
    const enemy = makePlayer(2, 7, 4);
    const context = makeContext({ 1: pendula, 2: enemy });
    context.arena.solid.add("6,4");
    context.arena.solid.add("5,4");
    const reserved = new Set<string>(["4,4"]);
    expect(pullPlayerToward(enemy, { x: 4, y: 4 }, context, reserved)).toBe(
      false,
    );
    expect(enemy.tile).toEqual({ x: 7, y: 4 });
  });

  it("fires a radial pull and spawns an inward ring effect", () => {
    const effects: unknown[] = [];
    const pendula = makePlayer(1, 4, 4);
    const near = makePlayer(2, 6, 4);
    const far = makePlayer(3, 4, 7);
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
    expect(pulled).toBe(2);
    expect(near.tile).toEqual({ x: 5, y: 4 });
    expect(far.tile).toEqual({ x: 4, y: 5 });
    expect(outOfRange.tile).toEqual({ x: 0, y: 0 });
    expect(effects).toHaveLength(1);
    expect(effects[0]).toMatchObject({
      kind: "pendula-pull",
      origin: { x: 4, y: 4 },
    });
  });
});
