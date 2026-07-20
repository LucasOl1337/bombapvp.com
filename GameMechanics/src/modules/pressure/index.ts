import type { GameEvent, MatchConfig, TileCoord } from "../../contracts.ts";
import { factsOfKind } from "../../kernel/facts.ts";
import type {
  ModuleSpec,
  SystemRunContext,
  SystemRunResult,
} from "../../kernel/protocol.ts";
import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  assertTile,
  assertTileInBounds,
  buildPressurePath,
  derivePressureProgress,
  freezeTile,
  impactAt,
  PRESSURE_FALL_MS,
  PRESSURE_INTERVAL_MS,
  tileKey,
  tilesEqualSorted,
  warningAt,
  type ArenaSlice,
  type PressureSlice,
} from "../../kernel/world-state.ts";

/**
 * Physical sudden-death pressure (Decision 008 / world-4).
 * Sole owner of the `pressure` slice. Persists only closedTiles.
 * Path and closing are pure derivations of Arena + Match — never written.
 *
 * 1.1.1: pressure-system acts only in sudden-death; pressure-reset-system is
 * the sole clearer of closedTiles via round-reset (no silent repair elsewhere).
 */
const MODULE_VERSION = "1.1.1";

export {
  buildPressurePath,
  derivePressureProgress,
  impactAt,
  PRESSURE_FALL_MS,
  PRESSURE_INTERVAL_MS,
  warningAt,
};

function freezePressure(slice: PressureSlice): PressureSlice {
  return Object.freeze({
    closedTiles: Object.freeze(slice.closedTiles.map(freezeTile)),
  });
}

function emptyClosed(): readonly TileCoord[] {
  return Object.freeze([] as TileCoord[]);
}

function cleanPressure(): PressureSlice {
  return freezePressure({ closedTiles: emptyClosed() });
}

function closedEquals(
  left: readonly TileCoord[],
  right: readonly TileCoord[],
): boolean {
  return tilesEqualSorted(left, right);
}


function pathFromArena(arena: ArenaSlice): readonly TileCoord[] {
  return buildPressurePath(arena.width, arena.height, arena.solid);
}

function runPressureReset(ctx: SystemRunContext): SystemRunResult {
  const resets = factsOfKind(ctx.facts, "round-reset");
  if (resets.length === 0) return {};
  return {
    writes: {
      pressure: cleanPressure(),
    },
  };
}

/**
 * `pressure` phase: pure calendar progression from Match SD clock.
 * Acts **only** in `sudden-death`. Outside SD (round-start, playing,
 * round-over, match-over) this is a strict no-op — never clears, freezes, or
 * repairs `closedTiles`. Terminal post-SD state stays frozen as left by the
 * last SD tick. Clearing closedTiles on multi-owner reset is solely `pressure-reset-system`
 * via the `round-reset` fact.
 */
function runPressure(ctx: SystemRunContext): SystemRunResult {
  const match = ctx.read("match");
  if (match.phase !== "sudden-death") {
    return {};
  }

  const pressure = ctx.read("pressure");
  const arena = ctx.read("arena");
  const canonicalPath = pathFromArena(arena);

  // sudden-death: closedTiles are the exact clock prefix.
  const elapsed = match.suddenDeathElapsedMs;
  const progress = derivePressureProgress(canonicalPath, elapsed);
  const next = freezePressure({ closedTiles: progress.closedTiles });

  const events: GameEvent[] = [];
  const facts: Array<{
    kind: "pressure-impact";
    roundNumber: number;
    pressureIndex: number;
    tile: ReturnType<typeof freezeTile>;
  }> = [];

  for (let index = 0; index < canonicalPath.length; index += 1) {
    const tile = canonicalPath[index]!;
    if (warningAt(index) === elapsed) {
      events.push(
        Object.freeze({
          type: "pressure-warning" as const,
          roundNumber: match.roundNumber,
          pressureIndex: index,
          tile: freezeTile(tile),
          remainingMs: PRESSURE_FALL_MS,
          fallMs: PRESSURE_FALL_MS,
        }),
      );
    }
    if (impactAt(index) === elapsed) {
      events.push(
        Object.freeze({
          type: "pressure-closed" as const,
          roundNumber: match.roundNumber,
          pressureIndex: index,
          tile: freezeTile(tile),
        }),
      );
      facts.push(
        Object.freeze({
          kind: "pressure-impact" as const,
          roundNumber: match.roundNumber,
          pressureIndex: index,
          tile: freezeTile(tile),
        }),
      );
    }
  }

  if (
    closedEquals(pressure.closedTiles, next.closedTiles)
    && events.length === 0
    && facts.length === 0
  ) {
    return {};
  }

  const result: SystemRunResult = {
    writes: { pressure: next },
    events,
  };
  if (facts.length > 0) {
    return Object.freeze({ ...result, facts: Object.freeze(facts) });
  }
  return result;
}

function initialPressure(_config: MatchConfig): PressureSlice {
  return cleanPressure();
}

function restorePressure(raw: unknown, _config: MatchConfig): PressureSlice {
  if (!raw || typeof raw !== "object") {
    throw new Error("slices.pressure must be an object.");
  }
  const pressureRaw = raw as Record<string, unknown>;

  // path/closing are derived — reject any second serialized truth.
  if ("path" in pressureRaw) {
    throw new Error(
      "slices.pressure.path is not persisted; path is derived from Arena solid.",
    );
  }
  if ("closing" in pressureRaw) {
    throw new Error(
      "slices.pressure.closing is not persisted; closing is derived from Match clock/phase.",
    );
  }
  if (!Array.isArray(pressureRaw.closedTiles)) {
    throw new Error("slices.pressure.closedTiles must be an array.");
  }

  const closedTiles = Object.freeze(
    pressureRaw.closedTiles.map((tile, index) =>
      assertTile(tile, `slices.pressure.closedTiles[${index}]`),
    ),
  );

  for (const [index, tile] of closedTiles.entries()) {
    assertTileInBounds(
      tile,
      ARENA_WIDTH,
      ARENA_HEIGHT,
      `slices.pressure.closedTiles[${index}]`,
    );
  }

  const seen = new Set<string>();
  for (const tile of closedTiles) {
    const key = tileKey(tile);
    if (seen.has(key)) {
      throw new Error(`slices.pressure.closedTiles has duplicate tile ${key}.`);
    }
    seen.add(key);
  }

  return freezePressure({ closedTiles });
}


export const pressureModule: ModuleSpec = Object.freeze({
  id: "pressure",
  version: MODULE_VERSION,
  owns: Object.freeze(["pressure"] as const),
  systems: Object.freeze([
    Object.freeze({
      id: "pressure-reset-system",
      phase: "round-reset" as const,
      reads: Object.freeze(["pressure"] as const),
      writes: Object.freeze(["pressure"] as const),
      run: runPressureReset,
    }),
    Object.freeze({
      id: "pressure-system",
      phase: "pressure" as const,
      reads: Object.freeze(["pressure", "match", "arena"] as const),
      writes: Object.freeze(["pressure"] as const),
      run: runPressure,
    }),
  ]),
  codecs: Object.freeze({
    initial(config: MatchConfig) {
      return Object.freeze({ pressure: initialPressure(config) });
    },
    restore(
      rawOwned: Readonly<Partial<Record<"pressure", unknown>>>,
      config: MatchConfig,
    ) {
      return Object.freeze({ pressure: restorePressure(rawOwned.pressure, config) });
    },
  }),
});
