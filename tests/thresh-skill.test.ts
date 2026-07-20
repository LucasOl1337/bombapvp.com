import { describe, expect, it, vi } from "vitest";
import { TILE_SIZE } from "../src/original-game/PersonalConfig/config";
import {
  computeThreshHookTarget,
  findHookVictim,
  fireDeathSentence,
  hookPathTiles,
  pullVictimAlongHookLine,
  startThreshDeathSentence,
  updateThreshDeathSentence,
  THRESH_HOOK_CHANNEL_MS,
  THRESH_HOOK_MISS_COOLDOWN_MS,
  THRESH_HOOK_RANGE_TILES,
  THRESH_SKILL_COOLDOWN_MS,
  THRESH_SKILL_ID,
} from "../Champions/thresh/skill";
import type { PlayerState } from "../src/original-game/Gameplay/types";

const TS = TILE_SIZE;

function makePlayer(
  id: number,
  tileX: number,
  tileY: number,
  skillId: string = THRESH_SKILL_ID,
): PlayerState {
  return {
    id,
    alive: true,
    position: { x: tileX * TS + TS * 0.5, y: tileY * TS + TS * 0.5 },
    tile: { x: tileX, y: tileY },
    velocity: { x: 0, y: 0 },
    direction: "right",
    lastMoveDirection: "right",
    skill: {
      id: skillId,
      phase: "idle",
      channelRemainingMs: 0,
      cooldownRemainingMs: 0,
      castElapsedMs: 0,
      projectedPosition: null,
      projectedLastMoveDirection: null,
    },
  } as PlayerState;
}

function emptyArena(w = 15, h = 13) {
  return {
    config: { grid: { width: w, height: h } },
    solid: new Set<string>(),
    breakable: new Set<string>(),
  };
}

function baseContext(
  players: Record<number, PlayerState>,
  extra: Record<string, unknown> = {},
) {
  return {
    arena: emptyArena(),
    bombs: [],
    players,
    activePlayerIds: Object.keys(players).map(Number),
    addChampionWorldEffect: vi.fn(),
    canOccupyPosition: () => true,
    getTileFromPosition: (p: { x: number; y: number }) => ({
      x: Math.floor(p.x / TS),
      y: Math.floor(p.y / TS),
    }),
    normalizeArenaPosition: (p: { x: number; y: number }) => ({ ...p }),
    isPositionOverlappingTile: (
      position: { x: number; y: number },
      tile: { x: number; y: number },
    ) =>
      Math.floor(position.x / TS) === tile.x &&
      Math.floor(position.y / TS) === tile.y,
    soundManager: { playOneShot: vi.fn() },
    ...extra,
  } as never;
}

describe("Thresh Death Sentence", () => {
  it("travels up to range and stops before walls", () => {
    const caster = makePlayer(1, 3, 5);
    const context = baseContext({ 1: caster });
    const path = hookPathTiles({ x: 3, y: 5 }, "right", context);
    expect(path).toHaveLength(THRESH_HOOK_RANGE_TILES);
    expect(path.at(-1)).toEqual({ x: 3 + THRESH_HOOK_RANGE_TILES, y: 5 });
  });

  it("wall truncates the hook path", () => {
    const caster = makePlayer(1, 3, 5);
    const arena = emptyArena();
    arena.solid.add(`${5},${5}`);
    const context = baseContext({ 1: caster }, { arena });
    const path = hookPathTiles({ x: 3, y: 5 }, "right", context);
    expect(path).toEqual([{ x: 4, y: 5 }]);
  });

  it("finds the nearest enemy on the hook line and ignores off-axis", () => {
    const caster = makePlayer(1, 3, 5);
    const near = makePlayer(2, 5, 5);
    const far = makePlayer(3, 7, 5);
    const offAxis = makePlayer(4, 5, 6);
    const context = baseContext({ 1: caster, 2: near, 3: far, 4: offAxis });
    const found = findHookVictim(caster, "right", context);
    expect(found?.victim.id).toBe(2);
    expect(found?.distance).toBe(2);
  });

  it("does not hit an enemy hiding behind a wall", () => {
    const caster = makePlayer(1, 3, 5);
    const victim = makePlayer(2, 6, 5);
    const arena = emptyArena();
    arena.solid.add(`${4},${5}`);
    const context = baseContext({ 1: caster, 2: victim }, { arena });
    expect(findHookVictim(caster, "right", context)).toBeNull();
  });

  it("pulls the victim to the tile adjacent to Thresh along the line", () => {
    const caster = makePlayer(1, 3, 5);
    const victim = makePlayer(2, 7, 5);
    const context = baseContext({ 1: caster, 2: victim });
    const moved = pullVictimAlongHookLine(
      victim,
      { x: 3, y: 5 },
      "right",
      4,
      context,
      new Set(),
    );
    expect(moved).toBe(true);
    expect(victim.tile).toEqual({ x: 4, y: 5 });
    expect(victim.velocity).toEqual({ x: 0, y: 0 });
  });

  it("pull stops at the nearest free tile when adjacent is occupied", () => {
    const caster = makePlayer(1, 3, 5);
    const blocker = makePlayer(3, 4, 5, "other-skill");
    const victim = makePlayer(2, 7, 5);
    const context = baseContext({ 1: caster, 2: victim, 3: blocker });
    const moved = pullVictimAlongHookLine(
      victim,
      { x: 3, y: 5 },
      "right",
      4,
      context,
      new Set(),
    );
    expect(moved).toBe(true);
    expect(victim.tile).toEqual({ x: 5, y: 5 });
  });

  it("fire hits: yanks victim, spawns effect with hit=true, plays hit sound", () => {
    const caster = makePlayer(1, 3, 5);
    const victim = makePlayer(2, 6, 5);
    const effects: unknown[] = [];
    const playOneShot = vi.fn();
    const context = baseContext(
      { 1: caster, 2: victim },
      {
        addChampionWorldEffect: (e: unknown) => effects.push(e),
        soundManager: { playOneShot },
      },
    );
    const hit = fireDeathSentence(caster, "right", context);
    expect(hit).toBe(true);
    expect(victim.tile).toEqual({ x: 4, y: 5 });
    expect(effects).toHaveLength(1);
    expect(effects[0]).toMatchObject({
      kind: "thresh-death-sentence",
      hit: true,
      reachTiles: 3,
    });
    expect(playOneShot).toHaveBeenCalledWith("bombExplode");
  });

  it("fire misses empty lane: effect hit=false and miss sound", () => {
    const caster = makePlayer(1, 3, 5);
    const effects: unknown[] = [];
    const playOneShot = vi.fn();
    const context = baseContext(
      { 1: caster },
      {
        addChampionWorldEffect: (e: unknown) => effects.push(e),
        soundManager: { playOneShot },
      },
    );
    const hit = fireDeathSentence(caster, "right", context);
    expect(hit).toBe(false);
    expect(effects[0]).toMatchObject({
      kind: "thresh-death-sentence",
      hit: false,
      reachTiles: THRESH_HOOK_RANGE_TILES,
    });
    expect(playOneShot).toHaveBeenCalledWith("powerCollect");
  });

  it("channel completion applies full cooldown on hit", () => {
    const caster = makePlayer(1, 3, 5);
    const victim = makePlayer(2, 6, 5);
    const context = baseContext({ 1: caster, 2: victim });
    startThreshDeathSentence(caster, "right");
    expect(caster.skill.phase).toBe("channeling");
    updateThreshDeathSentence(caster, null, THRESH_HOOK_CHANNEL_MS + 1, context);
    expect(caster.skill.phase).toBe("cooldown");
    expect(caster.skill.cooldownRemainingMs).toBe(THRESH_SKILL_COOLDOWN_MS);
    expect(victim.tile).toEqual({ x: 4, y: 5 });
  });

  it("channel completion refunds half cooldown on miss", () => {
    const caster = makePlayer(1, 3, 5);
    const context = baseContext({ 1: caster });
    startThreshDeathSentence(caster, "right");
    updateThreshDeathSentence(caster, null, THRESH_HOOK_CHANNEL_MS + 1, context);
    expect(caster.skill.cooldownRemainingMs).toBe(THRESH_HOOK_MISS_COOLDOWN_MS);
  });

  it("ignores players carrying a different skill", () => {
    const caster = makePlayer(1, 3, 5, "other-skill");
    const context = baseContext({ 1: caster });
    startThreshDeathSentence(caster, "right");
    expect(caster.skill.phase).toBe("idle");
    expect(
      updateThreshDeathSentence(caster, null, 100, context),
    ).toBe(false);
  });

  it("projectTarget aims at the farthest free tile center", () => {
    const caster = makePlayer(1, 3, 5);
    const context = baseContext({ 1: caster });
    const target = computeThreshHookTarget(caster, "right", context);
    expect(target).toEqual({
      x: (3 + THRESH_HOOK_RANGE_TILES) * TS + TS * 0.5,
      y: 5 * TS + TS * 0.5,
    });
  });
});
