import { beforeEach, describe, expect, it, vi } from "vitest";
import { TILE_SIZE } from "../src/original-game/PersonalConfig/config";
import {
  computeBladeLanding,
  findSlashVictims,
  fireShunpo,
  resetKatarinaBladesForTests,
  startBouncingBlade,
  updateBouncingBlade,
  KATARINA_BLADE_ARMED_MS,
  KATARINA_BLADE_EXPIRE_COOLDOWN_MS,
  KATARINA_BLADE_RANGE_TILES,
  KATARINA_FIZZLE_COOLDOWN_MS,
  KATARINA_SKILL_COOLDOWN_MS,
  KATARINA_SKILL_ID,
  KATARINA_THROW_CHANNEL_MS,
} from "../Champions/katarina/skill";
import type { PlayerState } from "../src/original-game/Gameplay/types";

const TS = TILE_SIZE;

function makePlayer(
  id: number,
  tileX: number,
  tileY: number,
  skillId: string = KATARINA_SKILL_ID,
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
    tryAbsorbInstantHit: vi.fn(),
    soundManager: { playOneShot: vi.fn() },
    ...extra,
  } as never;
}

function throwBlade(
  katarina: PlayerState,
  context: never,
  direction: Parameters<typeof startBouncingBlade>[1] = "right",
) {
  startBouncingBlade(katarina, direction, context);
  updateBouncingBlade(katarina, null, false, KATARINA_THROW_CHANNEL_MS + 1, context);
}

describe("Katarina Bouncing Blade", () => {
  beforeEach(() => {
    resetKatarinaBladesForTests();
  });

  it("dagger lands on the farthest free tile before a wall", () => {
    const kat = makePlayer(1, 3, 5);
    const arena = emptyArena();
    arena.solid.add(`${6},${5}`);
    const context = baseContext({ 1: kat }, { arena });
    expect(computeBladeLanding({ x: 3, y: 5 }, "right", context)).toEqual({
      x: 5,
      y: 5,
    });
  });

  it("dagger flies the full range on an open lane", () => {
    const kat = makePlayer(1, 3, 5);
    const context = baseContext({ 1: kat });
    expect(computeBladeLanding({ x: 3, y: 5 }, "right", context)).toEqual({
      x: 3 + KATARINA_BLADE_RANGE_TILES,
      y: 5,
    });
  });

  it("bombs block the dagger landing", () => {
    const kat = makePlayer(1, 3, 5);
    const context = baseContext(
      { 1: kat },
      { bombs: [{ tile: { x: 5, y: 5 } }] },
    );
    expect(computeBladeLanding({ x: 3, y: 5 }, "right", context)).toEqual({
      x: 4,
      y: 5,
    });
  });

  it("fizzles with a short cooldown when the adjacent tile is blocked", () => {
    const kat = makePlayer(1, 3, 5);
    const arena = emptyArena();
    arena.solid.add(`${4},${5}`);
    const context = baseContext({ 1: kat }, { arena });
    startBouncingBlade(kat, "right", context);
    expect(kat.skill.phase).toBe("cooldown");
    expect(kat.skill.cooldownRemainingMs).toBe(KATARINA_FIZZLE_COOLDOWN_MS);
  });

  it("throw channel arms the dagger and enters the armed window", () => {
    const kat = makePlayer(1, 3, 5);
    const effects: unknown[] = [];
    const context = baseContext(
      { 1: kat },
      { addChampionWorldEffect: (e: unknown) => effects.push(e) },
    );
    throwBlade(kat, context);
    expect(kat.skill.phase).toBe("releasing");
    expect(kat.skill.channelRemainingMs).toBe(KATARINA_BLADE_ARMED_MS);
    expect(effects[0]).toMatchObject({
      kind: "katarina-bouncing-blade",
      tile: { x: 3 + KATARINA_BLADE_RANGE_TILES, y: 5 },
    });
  });

  it("armed window does not consume input (movement stays free)", () => {
    const kat = makePlayer(1, 3, 5);
    const context = baseContext({ 1: kat });
    throwBlade(kat, context);
    expect(updateBouncingBlade(kat, "left", false, 100, context)).toBe(false);
    expect(kat.skill.phase).toBe("releasing");
  });

  it("re-press blinks Katarina to the dagger and slashes adjacent enemies", () => {
    const kat = makePlayer(1, 3, 5);
    const victim = makePlayer(2, 6, 5, "other-skill");
    const tryAbsorbInstantHit = vi.fn();
    const context = baseContext({ 1: kat, 2: victim }, { tryAbsorbInstantHit });
    throwBlade(kat, context);
    // Blade at (7,5); victim at (6,5) is inside the slash radius.
    const consumed = updateBouncingBlade(kat, null, true, 16, context);
    expect(consumed).toBe(true);
    expect(kat.tile).toEqual({ x: 3 + KATARINA_BLADE_RANGE_TILES, y: 5 });
    expect(kat.skill.phase).toBe("cooldown");
    expect(kat.skill.cooldownRemainingMs).toBe(KATARINA_SKILL_COOLDOWN_MS);
    expect(tryAbsorbInstantHit).toHaveBeenCalledWith(victim, kat.id);
  });

  it("blink falls back to a free adjacent tile when the dagger tile is occupied", () => {
    const kat = makePlayer(1, 3, 5);
    const stander = makePlayer(2, 7, 5, "other-skill");
    const context = baseContext({ 1: kat, 2: stander });
    throwBlade(kat, context);
    // Blade landed at (7,5), occupied by stander — blink to a ring tile.
    updateBouncingBlade(kat, null, true, 16, context);
    expect(kat.tile).not.toEqual({ x: 7, y: 5 });
    expect(Math.max(Math.abs(kat.tile.x - 7), Math.abs(kat.tile.y - 5))).toBe(1);
  });

  it("slash hits every enemy around the dagger", () => {
    const kat = makePlayer(1, 3, 5);
    const near1 = makePlayer(2, 6, 5, "other-skill");
    const near2 = makePlayer(3, 7, 6, "other-skill");
    const far = makePlayer(4, 10, 5, "other-skill");
    const context = baseContext({ 1: kat, 2: near1, 3: near2, 4: far });
    const victims = findSlashVictims({ x: 7, y: 5 }, kat, context);
    expect(victims.map((v) => v.id).sort()).toEqual([2, 3]);
  });

  it("expiry without re-press refunds half the cooldown", () => {
    const kat = makePlayer(1, 3, 5);
    const context = baseContext({ 1: kat });
    throwBlade(kat, context);
    updateBouncingBlade(kat, null, false, KATARINA_BLADE_ARMED_MS + 1, context);
    expect(kat.skill.phase).toBe("cooldown");
    expect(kat.skill.cooldownRemainingMs).toBe(KATARINA_BLADE_EXPIRE_COOLDOWN_MS);
  });

  it("ignores players carrying a different skill", () => {
    const kat = makePlayer(1, 3, 5, "other-skill");
    const context = baseContext({ 1: kat });
    startBouncingBlade(kat, "right", context);
    expect(kat.skill.phase).toBe("idle");
    expect(updateBouncingBlade(kat, null, false, 100, context)).toBe(false);
  });
});
