import type { GameEvent, MatchConfig } from "../../contracts.ts";
import { factsOfKind } from "../../kernel/facts.ts";
import type {
  ModuleSpec,
  SystemRunContext,
  SystemRunResult,
} from "../../kernel/protocol.ts";
import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  assertInteger,
  assertTile,
  assertTileInBounds,
  assertTilesSortedUnique,
  compareTiles,
  createArenaTiles,
  freezeTile,
  tileKey,
  type ArenaSlice,
} from "../../kernel/world-state.ts";
import { roundSeedFor } from "../../match-config.ts";

/**
 * 2.4.0: crates-destroyed (raw Ordnance intent) intersected with pre-state;
 * empty intersection is a pure no-op. Applied removals emit crates-removed
 * for Powerups (Decision 009) — never re-emit raw intent.
 */
const MODULE_VERSION = "2.4.0";

/**
 * Apply `crates-destroyed` facts from Ordnance. Only tiles that exist in the
 * pre-state crate set are removed. Spurious fact tiles (empty / already gone)
 * never produce writes, events, or applied facts. One `crate-destroyed` event
 * and one applied `crates-removed` fact per actually removed set.
 */
function runApplyDestroyedCrates(ctx: SystemRunContext): SystemRunResult {
  const destroyed = factsOfKind(ctx.facts, "crates-destroyed");
  if (destroyed.length === 0) return {};

  const arena = ctx.read("arena");
  const existing = new Set(arena.crates.map(tileKey));
  const remove = new Set<string>();
  for (const fact of destroyed) {
    for (const tile of fact.tiles) {
      const key = tileKey(tile);
      if (existing.has(key)) remove.add(key);
    }
  }
  if (remove.size === 0) return {};

  const remaining = arena.crates.filter((tile) => !remove.has(tileKey(tile)));
  const removedTiles = Object.freeze(
    arena.crates
      .filter((tile) => remove.has(tileKey(tile)))
      .map(freezeTile)
      .sort(compareTiles),
  );
  const events: GameEvent[] = removedTiles.map((tile) =>
    Object.freeze({
      type: "crate-destroyed" as const,
      at: freezeTile(tile),
    }),
  );

  return {
    writes: {
      arena: Object.freeze({
        width: arena.width,
        height: arena.height,
        solid: arena.solid,
        crates: Object.freeze(remaining.map(freezeTile).sort(compareTiles)),
      }),
    },
    events,
    facts: Object.freeze([
      Object.freeze({
        kind: "crates-removed" as const,
        tiles: removedTiles,
      }),
    ]),
  };
}

/** Vertical reset: rebuild solid/crates from the roundSeed fact. */
function runArenaReset(ctx: SystemRunContext): SystemRunResult {
  const resets = factsOfKind(ctx.facts, "round-reset");
  if (resets.length === 0) return {};
  const fact = resets[resets.length - 1]!;
  const tiles = createArenaTiles(fact.roundSeed);
  return {
    writes: {
      arena: Object.freeze({
        width: ARENA_WIDTH,
        height: ARENA_HEIGHT,
        solid: tiles.solid,
        crates: tiles.crates,
      }),
    },
  };
}

/**
 * pressure-impact barrier: remove crate on impact tile (if any) and emit the
 * existing crate-destroyed event. Never writes the pressure slice.
 */
function runArenaPressureImpact(ctx: SystemRunContext): SystemRunResult {
  const impacts = factsOfKind(ctx.facts, "pressure-impact");
  if (impacts.length === 0) return {};

  const arena = ctx.read("arena");
  const remove = new Set<string>();
  for (const fact of impacts) {
    remove.add(tileKey(fact.tile));
  }

  const remaining = arena.crates.filter((tile) => !remove.has(tileKey(tile)));
  if (remaining.length === arena.crates.length) return {};

  const events: GameEvent[] = arena.crates
    .filter((tile) => remove.has(tileKey(tile)))
    .map((tile) =>
      Object.freeze({
        type: "crate-destroyed" as const,
        at: freezeTile(tile),
      }),
    )
    .sort((left, right) => compareTiles(left.at, right.at));

  return {
    writes: {
      arena: Object.freeze({
        width: arena.width,
        height: arena.height,
        solid: arena.solid,
        crates: Object.freeze(remaining.map(freezeTile).sort(compareTiles)),
      }),
    },
    events,
  };
}

function initialArena(config: MatchConfig): ArenaSlice {
  // Round 1 uses the explicit per-round seed (Decision 007).
  const tiles = createArenaTiles(roundSeedFor(config.seed, 1));
  return Object.freeze({
    width: ARENA_WIDTH,
    height: ARENA_HEIGHT,
    solid: tiles.solid,
    crates: tiles.crates,
  });
}

function restoreArena(raw: unknown, _config: MatchConfig): ArenaSlice {
  if (!raw || typeof raw !== "object") {
    throw new Error("slices.arena must be an object.");
  }
  const arenaRaw = raw as Record<string, unknown>;
  const width = assertInteger(arenaRaw.width, "slices.arena.width", 1);
  const height = assertInteger(arenaRaw.height, "slices.arena.height", 1);
  if (width !== ARENA_WIDTH || height !== ARENA_HEIGHT) {
    throw new Error(
      `slices.arena dimensions must be ${ARENA_WIDTH}x${ARENA_HEIGHT}.`,
    );
  }
  if (!Array.isArray(arenaRaw.solid) || !Array.isArray(arenaRaw.crates)) {
    throw new Error("slices.arena.solid/crates must be arrays.");
  }
  const solid = Object.freeze(
    arenaRaw.solid.map((tile, index) => assertTile(tile, `slices.arena.solid[${index}]`)),
  );
  const crates = Object.freeze(
    arenaRaw.crates.map((tile, index) => assertTile(tile, `slices.arena.crates[${index}]`)),
  );

  for (const [index, tile] of solid.entries()) {
    assertTileInBounds(tile, width, height, `slices.arena.solid[${index}]`);
  }
  for (const [index, tile] of crates.entries()) {
    assertTileInBounds(tile, width, height, `slices.arena.crates[${index}]`);
  }

  assertTilesSortedUnique(solid, "slices.arena.solid");
  assertTilesSortedUnique(crates, "slices.arena.crates");

  const solidKeys = new Set(solid.map(tileKey));
  for (const tile of crates) {
    const key = tileKey(tile);
    if (solidKeys.has(key)) {
      throw new Error(`slices.arena.crates cannot sit on solid tile ${key}.`);
    }
  }

  return Object.freeze({ width, height, solid, crates });
}


export const arenaModule: ModuleSpec = Object.freeze({
  id: "arena",
  version: MODULE_VERSION,
  owns: Object.freeze(["arena"] as const),
  systems: Object.freeze([
    Object.freeze({
      id: "arena-reset-system",
      phase: "round-reset" as const,
      reads: Object.freeze(["arena"] as const),
      writes: Object.freeze(["arena"] as const),
      run: runArenaReset,
    }),
    Object.freeze({
      id: "arena-pressure-impact-system",
      phase: "pressure-impact" as const,
      reads: Object.freeze(["arena"] as const),
      writes: Object.freeze(["arena"] as const),
      run: runArenaPressureImpact,
    }),
    Object.freeze({
      id: "arena-apply-crates-system",
      phase: "damage" as const,
      reads: Object.freeze(["arena"] as const),
      writes: Object.freeze(["arena"] as const),
      run: runApplyDestroyedCrates,
    }),
  ]),
  codecs: Object.freeze({
    initial(config: MatchConfig) {
      return Object.freeze({ arena: initialArena(config) });
    },
    restore(rawOwned: Readonly<Partial<Record<"arena", unknown>>>, config: MatchConfig) {
      return Object.freeze({ arena: restoreArena(rawOwned.arena, config) });
    },
  }),
});
