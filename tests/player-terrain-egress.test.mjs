// @vitest-environment node

/**
 * Soft/hard terrain embed recovery:
 * - body center forced onto breakable must not soft-lock forever
 * - walk-out (monotonic egress) works when already overlapping
 * - normal approach still cannot enter a crate
 */
import { describe, expect, it } from "vitest";
import { createDefaultArenaDefinition } from "../src/original-game/Arenas/arena.ts";
import { GameApp } from "../src/original-game/Engine/game-app.ts";
import { TILE_SIZE } from "../src/original-game/PersonalConfig/config.ts";
import { bodyOverlapsTile } from "../src/original-game/Gameplay/player-body.ts";
import { tileKey } from "../src/original-game/Gameplay/tile-key.ts";
import { fireTideSwap } from "../Champions/mirelle/skill.ts";
import { MIRELLE_SKILL_ID } from "../Champions/mirelle/definition.ts";

const STEP_MS = 1_000 / 60;
const HALF = TILE_SIZE * 0.5;

function assets() {
  return {
    players: {},
    characterRoster: [{
      id: "03a976fb-7313-4064-a477-5bb9b0760034",
      name: "Ranni",
      size: null,
      selectionIndex: 0,
    }],
    characterSpriteLoader: async () => null,
    arenaTheme: {},
    floor: { base: null, lane: null, spawn: null },
    props: { wall: null, crate: null, bomb: null, flame: null },
    powerUps: {},
  };
}

function input(direction = null) {
  return {
    direction,
    bombPressed: false,
    detonatePressed: false,
    skillPressed: false,
    skillHeld: false,
  };
}

function createMatch(arenaDef = createDefaultArenaDefinition()) {
  const app = new GameApp({}, assets(), arenaDef);
  app.startServerAuthoritativeMatch(
    [1, 2],
    { 1: 0, 2: 0, 3: 0, 4: 0 },
    { roomMode: "endless", arena: arenaDef },
  );
  app.advanceServerSimulation(1_300);
  return app;
}

function pickBreakableWithOpenNeighbor(breakables, solid, width, height) {
  for (const key of breakables) {
    const [cx, cy] = key.split(",").map(Number);
    for (const [dx, dy, toCrate] of [
      [1, 0, "left"],
      [-1, 0, "right"],
      [0, 1, "up"],
      [0, -1, "down"],
    ]) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const nk = tileKey(nx, ny);
      if (!breakables.has(nk) && !solid.has(nk)) {
        return {
          crate: { x: cx, y: cy, key },
          neighbor: { x: nx, y: ny, toCrate },
        };
      }
    }
  }
  return null;
}

describe("player terrain egress / unstuck", () => {
  it("ejects idle body when center is forced onto a breakable crate", () => {
    const def = createDefaultArenaDefinition();
    const app = createMatch(def);
    let snap = app.exportOnlineSnapshot();
    const breakables = new Set(snap.breakableTiles);
    const solid = new Set(def.tiles.solid);
    const pair = pickBreakableWithOpenNeighbor(
      breakables,
      solid,
      def.grid.width,
      def.grid.height,
    );
    expect(pair).not.toBeNull();

    const crateCenter = {
      x: pair.crate.x * TILE_SIZE + HALF,
      y: pair.crate.y * TILE_SIZE + HALF,
    };
    snap.players[1].position = { ...crateCenter };
    snap.players[1].tile = { x: pair.crate.x, y: pair.crate.y };
    snap.players[1].alive = true;
    snap.bombs = [];
    snap.flames = [];
    app.applyOnlineSnapshot(snap);

    // Idle tick — hard eject must free the center without input.
    app.replaceServerPlayerInput(1, input(null));
    app.advanceServerSimulation(STEP_MS);
    snap = app.exportOnlineSnapshot();

    const endKey = tileKey(snap.players[1].tile.x, snap.players[1].tile.y);
    expect(breakables.has(endKey)).toBe(false);
    expect(solid.has(endKey)).toBe(false);
    expect(bodyOverlapsTile(snap.players[1].position, {
      x: pair.crate.x,
      y: pair.crate.y,
    })).toBe(false);
  });

  it("allows walk-out when already embedded, still blocks fresh entry", () => {
    const def = createDefaultArenaDefinition();
    const app = createMatch(def);
    let snap = app.exportOnlineSnapshot();
    const breakables = new Set(snap.breakableTiles);
    const solid = new Set(def.tiles.solid);
    const pair = pickBreakableWithOpenNeighbor(
      breakables,
      solid,
      def.grid.width,
      def.grid.height,
    );
    expect(pair).not.toBeNull();

    // Approach from open neighbor — must not enter crate center.
    const start = {
      x: pair.neighbor.x * TILE_SIZE + HALF,
      y: pair.neighbor.y * TILE_SIZE + HALF,
    };
    snap.players[1].position = { ...start };
    snap.players[1].tile = { x: pair.neighbor.x, y: pair.neighbor.y };
    snap.bombs = [];
    snap.flames = [];
    app.applyOnlineSnapshot(snap);
    app.replaceServerPlayerInput(1, input(pair.neighbor.toCrate));
    for (let i = 0; i < 90; i += 1) app.advanceServerSimulation(STEP_MS);
    snap = app.exportOnlineSnapshot();
    expect(bodyOverlapsTile(snap.players[1].position, {
      x: pair.crate.x,
      y: pair.crate.y,
    })).toBe(false);
    const afterApproachKey = tileKey(snap.players[1].tile.x, snap.players[1].tile.y);
    expect(afterApproachKey).not.toBe(pair.crate.key);

    // Force embed, then walk toward open neighbor — egress / eject must free.
    const crateCenter = {
      x: pair.crate.x * TILE_SIZE + HALF,
      y: pair.crate.y * TILE_SIZE + HALF,
    };
    // Direction from crate center toward the open neighbor.
    const fromCrate = pair.neighbor.x > pair.crate.x
      ? "right"
      : pair.neighbor.x < pair.crate.x
        ? "left"
        : pair.neighbor.y > pair.crate.y
          ? "down"
          : "up";

    snap = app.exportOnlineSnapshot();
    snap.players[1].position = { ...crateCenter };
    snap.players[1].tile = { x: pair.crate.x, y: pair.crate.y };
    snap.bombs = [];
    snap.flames = [];
    app.applyOnlineSnapshot(snap);
    app.replaceServerPlayerInput(1, input(fromCrate));
    for (let i = 0; i < 90; i += 1) app.advanceServerSimulation(STEP_MS);
    snap = app.exportOnlineSnapshot();
    const freeKey = tileKey(snap.players[1].tile.x, snap.players[1].tile.y);
    expect(breakables.has(freeKey)).toBe(false);
    expect(bodyOverlapsTile(snap.players[1].position, {
      x: pair.crate.x,
      y: pair.crate.y,
    })).toBe(false);
  });

  it("rejects Mirelle enemy swap when landing tile is breakable", () => {
    const TILE = TILE_SIZE;
    const caster = {
      id: 1,
      name: "M",
      active: true,
      alive: true,
      tile: { x: 2, y: 2 },
      position: { x: 2 * TILE + HALF, y: 2 * TILE + HALF },
      velocity: { x: 0, y: 0 },
      direction: "right",
      lastMoveDirection: "right",
      maxBombs: 1,
      activeBombs: 0,
      flameRange: 1,
      speedLevel: 0,
      remoteLevel: 0,
      shieldCharges: 0,
      bombPassLevel: 0,
      kickLevel: 0,
      shortFuseLevel: 0,
      flameGuardMs: 0,
      spawnProtectionMs: 0,
      skill: {
        id: MIRELLE_SKILL_ID,
        phase: "ready",
        channelRemainingMs: 0,
        cooldownRemainingMs: 0,
        castElapsedMs: 0,
        projectedPosition: null,
        projectedLastMoveDirection: null,
        projectedBombEgressIds: [],
      },
    };
    // Enemy center reports tile (4,2) which we mark breakable.
    const enemy = {
      ...caster,
      id: 2,
      tile: { x: 4, y: 2 },
      position: { x: 4 * TILE + HALF, y: 2 * TILE + HALF },
      skill: { ...caster.skill },
    };
    const solid = new Set();
    const breakable = new Set(["4,2"]);
    const context = {
      players: { 1: caster, 2: enemy },
      activePlayerIds: [1, 2],
      bombs: [],
      arena: { solid, breakable, config: { grid: { width: 11, height: 9 } } },
      getTileFromPosition: (pos) => ({
        x: Math.floor(pos.x / TILE),
        y: Math.floor(pos.y / TILE),
      }),
      normalizeArenaPosition: (p) => p,
      canOccupyPosition: (_player, pos) => {
        const t = {
          x: Math.floor(pos.x / TILE),
          y: Math.floor(pos.y / TILE),
        };
        const key = `${t.x},${t.y}`;
        return !solid.has(key) && !breakable.has(key);
      },
      addChampionWorldEffect: () => {},
      soundManager: { playOneShot: () => {} },
    };

    expect(fireTideSwap(caster, context)).toBe(false);
    expect(caster.tile).toEqual({ x: 2, y: 2 });
    expect(enemy.tile).toEqual({ x: 4, y: 2 });
  });
});
