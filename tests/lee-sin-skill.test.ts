import { beforeEach, describe, expect, it, vi } from "vitest";
import { TILE_SIZE } from "../src/original-game/PersonalConfig/config";
import {
  findKickVictim,
  fireDragonRageKick,
  knockbackPlayer,
  LEE_SIN_SKILL_ID,
  startLeeSinDragonRage,
  updateLeeSinDragonRage,
  finishLeeSinDragonRage,
  resetLeeSinDashTrackingForTests,
} from "../Champions/lee-sin/skill";
import type { PlayerState } from "../src/original-game/Gameplay/types";

const TS = TILE_SIZE;

function makePlayer(
  id: number,
  tileX: number,
  tileY: number,
  skillId: string = LEE_SIN_SKILL_ID,
): PlayerState {
  return {
    id,
    alive: true,
    position: {
      x: tileX * TS + TS * 0.5,
      y: tileY * TS + TS * 0.5,
    },
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

function baseContext(players: Record<number, PlayerState>, extra: Record<string, unknown> = {}) {
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
    getWrappedDelta: (to: number, from: number) => to - from,
    isPositionOverlappingTile: (
      position: { x: number; y: number },
      tile: { x: number; y: number },
    ) =>
      Math.floor(position.x / TS) === tile.x &&
      Math.floor(position.y / TS) === tile.y,
    tryAbsorbInstantHit: vi.fn(),
    breakCrateAtKey: vi.fn(() => false),
    soundManager: { playOneShot: vi.fn() },
    ...extra,
  } as never;
}

describe("Lee Sin Dragon's Rage", () => {
  beforeEach(() => {
    resetLeeSinDashTrackingForTests();
  });

  it("finds the nearest enemy on the kick ray from path origin", () => {
    const caster = makePlayer(1, 3, 5);
    const near = makePlayer(2, 5, 5);
    const far = makePlayer(3, 8, 5);
    const offAxis = makePlayer(4, 5, 6);
    const context = baseContext({ 1: caster, 2: near, 3: far, 4: offAxis });
    const victim = findKickVictim(caster, "right", context);
    expect(victim?.id).toBe(2);
  });

  it("still hits an enemy the dash already passed (path origin behind caster)", () => {
    // Lee Sin finished at tile 7 after dashing through the enemy at tile 5.
    const caster = makePlayer(1, 7, 4);
    const victim = makePlayer(2, 5, 4);
    const pathOrigin = {
      x: 3 * TS + TS * 0.5,
      y: 4 * TS + TS * 0.5,
    };
    const context = baseContext({ 1: caster, 2: victim });
    const found = findKickVictim(caster, "right", context, pathOrigin);
    expect(found?.id).toBe(2);
  });

  it("knocks the victim, applies instant lethal hit, and spawns the world effect", () => {
    const caster = makePlayer(1, 4, 4);
    const victim = makePlayer(2, 6, 4);
    const effects: unknown[] = [];
    const playOneShot = vi.fn();
    const tryAbsorbInstantHit = vi.fn();
    const context = baseContext(
      { 1: caster, 2: victim },
      {
        addChampionWorldEffect: (e: unknown) => effects.push(e),
        soundManager: { playOneShot },
        tryAbsorbInstantHit,
      },
    );

    const hit = fireDragonRageKick(caster, "right", context);
    expect(hit).toBe(true);
    expect(victim.tile.x).toBeGreaterThan(6);
    expect(tryAbsorbInstantHit).toHaveBeenCalledWith(victim, caster.id);
    expect(effects[0]).toMatchObject({
      kind: "lee-sin-dragon-rage",
      hit: true,
      direction: { x: 1, y: 0 },
    });
    expect(playOneShot).toHaveBeenCalledWith("bombExplode");
  });

  it("counts a wall-pin as a combat hit (no free tiles to knock into)", () => {
    const caster = makePlayer(1, 4, 4);
    const victim = makePlayer(2, 5, 4);
    const arena = emptyArena();
    arena.solid.add("6,4");
    arena.solid.add("7,4");
    arena.solid.add("8,4");
    const effects: unknown[] = [];
    const context = baseContext(
      { 1: caster, 2: victim },
      {
        arena,
        addChampionWorldEffect: (e: unknown) => effects.push(e),
      },
    );
    const hit = fireDragonRageKick(caster, "right", context);
    expect(hit).toBe(true);
    expect(effects[0]).toMatchObject({ hit: true });
    // Victim stayed put but was contacted.
    expect(victim.tile.x).toBe(5);
  });

  it("starts a dash channel when path is open", () => {
    const player = makePlayer(1, 2, 2);
    const context = baseContext({ 1: player });
    startLeeSinDragonRage(player, "right", context);
    expect(player.skill.phase).toBe("channeling");
    expect(player.skill.projectedPosition).not.toBeNull();
    expect(player.skill.projectedLastMoveDirection).toBe("right");
  });

  it("applies knockback + lethal hit after a full dash that overshoots the victim", () => {
    const caster = makePlayer(1, 3, 5);
    const victim = makePlayer(2, 5, 5);
    const effects: unknown[] = [];
    const tryAbsorbInstantHit = vi.fn();
    const context = baseContext(
      { 1: caster, 2: victim },
      {
        addChampionWorldEffect: (e: unknown) => effects.push(e),
        tryAbsorbInstantHit,
      },
    );
    startLeeSinDragonRage(caster, "right", context);
    // Simulate the dash completing past the victim.
    for (let i = 0; i < 20 && caster.skill.phase === "channeling"; i += 1) {
      updateLeeSinDragonRage(caster, 40, context);
    }
    if (caster.skill.phase === "channeling") {
      finishLeeSinDragonRage(caster, context);
    }
    expect(caster.skill.phase).toBe("cooldown");
    expect(effects.some((e) => (e as { kind: string }).kind === "lee-sin-dragon-rage")).toBe(
      true,
    );
    expect(victim.tile.x).toBeGreaterThan(5);
    expect(tryAbsorbInstantHit).toHaveBeenCalledWith(victim, caster.id);
  });

  it("knockback stops before a solid wall", () => {
    const victim = makePlayer(2, 5, 4);
    const arena = emptyArena();
    arena.solid.add("7,4");
    const reserved = new Set<string>(["5,4"]);
    const context = baseContext(
      { 2: victim },
      { arena },
    );
    const moved = knockbackPlayer(victim, "right", context, reserved);
    expect(moved).toBeGreaterThan(0);
    expect(victim.tile.x).toBe(6);
  });
});
