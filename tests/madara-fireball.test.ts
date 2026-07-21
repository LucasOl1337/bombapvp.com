import { describe, expect, it, vi } from "vitest";
import { tileKey } from "../src/original-game/Arenas/arena";
import {
  computeFireballTarget,
  finishFireballJutsu,
  fireFireballJutsu,
  MADARA_CHANNEL_MS,
  MADARA_FIRE_LINGER_MS,
  MADARA_SKILL_COOLDOWN_MS,
  MADARA_SKILL_ID,
  resolveFireballPath,
  startFireballJutsu,
  updateFireballJutsu,
} from "../Champions/madara/skill";
import type { MadaraSkillContext } from "../Champions/madara/skill";
import type { Direction, PlayerState, TileCoord } from "../src/original-game/Gameplay/types";

function makeContext(opts: {
  solid?: string[];
  breakable?: string[];
  bombs?: TileCoord[];
  players?: PlayerState[];
}): MadaraSkillContext {
  const activePlayerIds = (opts.players ?? []).map((p) => p.id);
  const players: Record<number, PlayerState> = {};
  for (const p of opts.players ?? []) {
    players[p.id] = p;
  }
  const breakable = new Set(opts.breakable ?? []);
  return {
    arena: {
      config: { grid: { width: 11, height: 11 } },
      solid: new Set(opts.solid ?? []),
      breakable,
      powerUps: [],
    } as unknown as MadaraSkillContext["arena"],
    bombs: (opts.bombs ?? []).map((tile) => ({ tile })) as MadaraSkillContext["bombs"],
    players,
    activePlayerIds,
    addChampionWorldEffect: vi.fn(),
    canOccupyPosition: () => true,
    getTileFromPosition: (pos: { x: number; y: number }) => ({
      x: Math.floor(pos.x / 40),
      y: Math.floor(pos.y / 40),
    }),
    normalizeArenaPosition: (pos: { x: number; y: number }) => ({ ...pos }),
    tryAbsorbInstantHit: vi.fn(),
    breakCrateAtKey: vi.fn((key: string) => {
      breakable.delete(key);
      return true;
    }),
    addFlame: vi.fn(),
    soundManager: { playOneShot: vi.fn() },
  };
}

function makePlayer(id: number, tile: TileCoord): PlayerState {
  return {
    id,
    position: { x: tile.x * 40 + 20, y: tile.y * 40 + 20 },
    tile,
    alive: true,
    direction: "right",
    lastMoveDirection: "right",
    velocity: { x: 0, y: 0 },
    skill: {
      id: MADARA_SKILL_ID,
      phase: "idle",
      channelRemainingMs: 0,
      cooldownRemainingMs: 0,
      castElapsedMs: 0,
      projectedPosition: null,
      projectedLastMoveDirection: null,
    },
  } as unknown as PlayerState;
}

describe("madara fireball path resolution", () => {
  it("burns up to 3 breakable crates in a line", () => {
    const player = makePlayer(1, { x: 2, y: 5 });
    const context = makeContext({
      breakable: ["3,5", "4,5", "5,5", "6,5"],
    });
    const result = resolveFireballPath({ x: 2, y: 5 }, "right", 1, context);
    expect(result).not.toBeNull();
    expect(result!.boxesBurned).toBe(3);
    expect(result!.detonation).toEqual({ x: 5, y: 5 });
    expect(context.breakCrateAtKey).toHaveBeenCalledTimes(3);
  });

  it("stops before a solid wall", () => {
    const player = makePlayer(1, { x: 2, y: 5 });
    const context = makeContext({
      solid: ["5,5"],
    });
    const result = resolveFireballPath({ x: 2, y: 5 }, "right", 1, context);
    expect(result).not.toBeNull();
    expect(result!.detonation).toEqual({ x: 4, y: 5 });
    expect(result!.pathTiles).toHaveLength(2);
  });

  it("kills the first player in the lane and stops there", () => {
    const player = makePlayer(1, { x: 2, y: 5 });
    const victim = makePlayer(2, { x: 4, y: 5 });
    const context = makeContext({
      players: [player, victim],
    });
    const result = resolveFireballPath({ x: 2, y: 5 }, "right", 1, context);
    expect(result).not.toBeNull();
    expect(result!.hitPlayer).toBe(true);
    expect(result!.detonation).toEqual({ x: 4, y: 5 });
    expect(context.tryAbsorbInstantHit).toHaveBeenCalledTimes(1);
  });

  it("is blocked by a bomb", () => {
    const context = makeContext({
      bombs: [{ x: 4, y: 5 }],
    });
    const result = resolveFireballPath({ x: 2, y: 5 }, "right", 1, context);
    expect(result).not.toBeNull();
    expect(result!.detonation).toEqual({ x: 3, y: 5 });
  });

  it("returns null when the first tile is blocked", () => {
    const context = makeContext({
      solid: ["3,5"],
    });
    const result = resolveFireballPath({ x: 2, y: 5 }, "right", 1, context);
    expect(result).toBeNull();
  });

  it("adds lateral flames to free tiles at the detonation", () => {
    const player = makePlayer(1, { x: 2, y: 5 });
    const context = makeContext({
      breakable: ["3,5"],
    });
    fireFireballJutsu(player, "right", context);
    expect(context.addFlame).toHaveBeenCalledWith(
      expect.objectContaining({ x: 6, y: 5 }),
      MADARA_FIRE_LINGER_MS,
      "normal",
      1,
    );
    expect(context.addFlame).toHaveBeenCalledWith(
      expect.objectContaining({ x: 6, y: 4 }),
      MADARA_FIRE_LINGER_MS,
      "normal",
      1,
    );
    expect(context.addFlame).toHaveBeenCalledWith(
      expect.objectContaining({ x: 6, y: 6 }),
      MADARA_FIRE_LINGER_MS,
      "normal",
      1,
    );
  });

  it("does not add flames through walls", () => {
    const player = makePlayer(1, { x: 2, y: 5 });
    const context = makeContext({
      breakable: ["3,5"],
      solid: ["6,4", "6,6"],
    });
    fireFireballJutsu(player, "right", context);
    const flameTiles = (context.addFlame as ReturnType<typeof vi.fn>).mock.calls.map(
      (c: unknown[]) => c[0] as TileCoord,
    );
    expect(flameTiles).toContainEqual({ x: 6, y: 5 });
    expect(flameTiles).not.toContainEqual({ x: 6, y: 4 });
    expect(flameTiles).not.toContainEqual({ x: 6, y: 6 });
  });

  it("preview target reaches the detonation tile", () => {
    const player = makePlayer(1, { x: 2, y: 5 });
    const context = makeContext({
      breakable: ["3,5", "4,5"],
    });
    const target = computeFireballTarget(player, "right", context);
    expect(target).toEqual({ x: 6 * 40 + 20, y: 5 * 40 + 20 });
  });
});

describe("madara skill driver", () => {
  it("channels and then fires the fireball", () => {
    const player = makePlayer(1, { x: 2, y: 5 });
    const context = makeContext({});
    startFireballJutsu(player, "right", context);
    expect(player.skill.phase).toBe("channeling");

    updateFireballJutsu(player, "right", MADARA_CHANNEL_MS + 10, context);

    expect(player.skill.phase).toBe("cooldown");
    expect(player.skill.cooldownRemainingMs).toBe(MADARA_SKILL_COOLDOWN_MS);
    expect(context.addChampionWorldEffect).toHaveBeenCalled();
    expect(context.addFlame).toHaveBeenCalled();
  });

  it("fizzles with a short cooldown when the first tile is blocked", () => {
    const player = makePlayer(1, { x: 2, y: 5 });
    const context = makeContext({
      solid: ["3,5"],
    });
    startFireballJutsu(player, "right", context);
    expect(player.skill.phase).toBe("cooldown");
    expect(player.skill.cooldownRemainingMs).toBeLessThan(MADARA_SKILL_COOLDOWN_MS);
  });

  it("ignores update when not channeling", () => {
    const player = makePlayer(1, { x: 2, y: 5 });
    finishFireballJutsu(player, MADARA_SKILL_COOLDOWN_MS);
    const context = makeContext({});
    const consumed = updateFireballJutsu(player, "right", 16, context);
    expect(consumed).toBe(false);
    expect(context.addChampionWorldEffect).not.toHaveBeenCalled();
  });
});
