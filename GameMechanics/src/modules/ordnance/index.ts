import type {
  CompetitorId,
  GameEvent,
  MatchConfig,
  TileCoord,
} from "../../contracts.ts";
import { ZED_LIVING_SHADOW_SKILL_ID } from "../../contracts.ts";
import type { CommandRejection } from "../../kernel/commands.ts";
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
  assertTilesSortedUnique,
  BOMB_FUSE_MS,
  compareTiles,
  DIRECTION_DELTA,
  effectiveSolidKeySet,
  findLocomotion,
  findProgression,
  findVitals,
  FLAME_DURATION_MS,
  freezeTile,
  isGameplayActive,
  tileKey,
  tileOf,
  TICK_DURATION_MS,
  type BombEntry,
  type BombsSlice,
  type FlameCause,
  type FlameEntry,
  type FlamesSlice,
} from "../../kernel/world-state.ts";

/**
 * 3.3.0: Living Shadow free echo plant at the fixed projection tile while
 * channeling (capacity-exempt, same owner/fuse; illegal echo never rejects body).
 * 3.2.0: placement no longer rejects when a rival body overlaps the tile —
 * pre-overlap geometric egress lets them walk off (Decision 012).
 * 3.1.0: blast walk stops at grid bounds — flames never wrap the torus
 * (Decision 011). 3.0.0: placement/capacity/range read Powerups progression.
 */
const MODULE_VERSION = "3.3.0";

/** Reachable active fuse after a complete tick (post fuse-system, pre explosion). */
const MIN_ACTIVE_FUSE_MS = TICK_DURATION_MS;
const MAX_ACTIVE_FUSE_MS = BOMB_FUSE_MS - TICK_DURATION_MS;

/**
 * Blast walk stops at solid, at a crate (consumed), and at the grid edge.
 * Flames never wrap the torus (Decision 011) — unlike bodies.
 */
function collectBlast(
  origin: TileCoord,
  range: number,
  solid: ReadonlySet<string>,
  crates: ReadonlySet<string>,
): TileCoord[] {
  const tiles: TileCoord[] = [freezeTile(origin)];
  for (const direction of Object.values(DIRECTION_DELTA)) {
    for (let step = 1; step <= range; step += 1) {
      const tile = {
        x: origin.x + direction.x * step,
        y: origin.y + direction.y * step,
      };
      if (tile.x < 0 || tile.y < 0 || tile.x >= ARENA_WIDTH || tile.y >= ARENA_HEIGHT) break;
      const key = tileKey(tile);
      if (solid.has(key)) break;
      tiles.push(freezeTile(tile));
      if (crates.has(key)) break;
    }
  }
  return tiles;
}

function compareCauses(left: FlameCause, right: FlameCause): number {
  if (left.bombId !== right.bombId) return left.bombId - right.bombId;
  return left.ownerId < right.ownerId ? -1 : left.ownerId > right.ownerId ? 1 : 0;
}

function mergeFlame(
  existing: FlameEntry | undefined,
  tile: TileCoord,
  cause: FlameCause,
): FlameEntry {
  const causes = [...(existing?.causes ?? []), cause].sort(compareCauses);
  const unique: FlameCause[] = [];
  for (const entry of causes) {
    const last = unique[unique.length - 1];
    if (last && last.bombId === entry.bombId && last.ownerId === entry.ownerId) continue;
    unique.push(entry);
  }
  return Object.freeze({
    tile: freezeTile(tile),
    remainingMs: Math.max(existing?.remainingMs ?? 0, FLAME_DURATION_MS),
    causes: Object.freeze(unique),
  });
}

function canPlaceBombOnTile(
  tile: TileCoord,
  occupied: ReadonlySet<string>,
  solid: ReadonlySet<string>,
  crates: ReadonlySet<string>,
): boolean {
  if (
    tile.x < 0
    || tile.y < 0
    || tile.x >= ARENA_WIDTH
    || tile.y >= ARENA_HEIGHT
  ) {
    return false;
  }
  const key = tileKey(tile);
  if (occupied.has(key) || solid.has(key) || crates.has(key)) return false;
  return true;
}

function runBombPlace(ctx: SystemRunContext): SystemRunResult {
  const match = ctx.read("match");
  const bombs = ctx.read("bombs");
  const locomotion = ctx.read("locomotion");
  const progression = ctx.read("progression");
  const vitals = ctx.read("vitals");
  const skills = ctx.read("skills");
  const arena = ctx.read("arena");
  const pressure = ctx.read("pressure");
  const rejections: CommandRejection[] = [];
  const events: GameEvent[] = [];
  const placeCommands = ctx.commands.filter(
    (resolved) => resolved.envelope.command.type === "place-bomb",
  );

  if (!isGameplayActive(match.phase)) {
    for (const resolved of placeCommands) {
      rejections.push(
        Object.freeze({
          sequence: resolved.envelope.sequence,
          seatId: resolved.envelope.seatId,
          reason: "not-playing" as const,
        }),
      );
    }
    return { rejections };
  }

  let nextId = bombs.nextId;
  const items: BombEntry[] = bombs.items.map((bomb) =>
    Object.freeze({ ...bomb, tile: freezeTile(bomb.tile), echo: bomb.echo === true }),
  );
  const occupied = new Set(items.map((bomb) => tileKey(bomb.tile)));
  const solid = effectiveSolidKeySet(arena, pressure);
  const crates = new Set(arena.crates.map(tileKey));

  for (const resolved of placeCommands) {
    const { envelope, competitorId } = resolved;
    const vitalsRow = findVitals(vitals, competitorId);
    if (!vitalsRow?.alive) {
      rejections.push(
        Object.freeze({
          sequence: envelope.sequence,
          seatId: envelope.seatId,
          reason: "competitor-dead" as const,
        }),
      );
      continue;
    }
    const progressionRow = findProgression(progression, competitorId);
    const loco = findLocomotion(locomotion, competitorId);
    if (!progressionRow || !loco) {
      rejections.push(
        Object.freeze({
          sequence: envelope.sequence,
          seatId: envelope.seatId,
          reason: "unknown-seat" as const,
        }),
      );
      continue;
    }

    // Capacity counts only non-echo bombs (Living Shadow free echo).
    const active = items.filter(
      (bomb) => bomb.ownerId === competitorId && !bomb.echo,
    ).length;
    if (active >= progressionRow.maxBombs) {
      rejections.push(
        Object.freeze({
          sequence: envelope.sequence,
          seatId: envelope.seatId,
          reason: "bomb-cap" as const,
        }),
      );
      continue;
    }

    // Placement tile is tileOf(pre-move position) — command phase before locomotion.
    const placeTile = tileOf(loco.position);
    const key = tileKey(placeTile);
    if (occupied.has(key)) {
      rejections.push(
        Object.freeze({
          sequence: envelope.sequence,
          seatId: envelope.seatId,
          reason: "tile-occupied" as const,
        }),
      );
      continue;
    }

    // A rival body overlapping the tile does not block placement (Decision
    // 012, parity with the original): the pre-overlap geometric egress lets
    // them simply walk off the fresh bomb.

    // Capture current flameRange at placement — later upgrades never rewrite it.
    const bomb: BombEntry = Object.freeze({
      id: nextId,
      ownerId: competitorId,
      tile: freezeTile(placeTile),
      fuseMs: BOMB_FUSE_MS,
      flameRange: progressionRow.flameRange,
      echo: false,
    });
    nextId += 1;
    items.push(bomb);
    occupied.add(key);
    events.push(
      Object.freeze({
        type: "bomb-placed",
        bombId: bomb.id,
        competitorId,
        at: freezeTile(bomb.tile),
      }),
    );

    // Living Shadow free echo: same tick, same owner/fuse, projection tile only.
    // Illegal echo never cancels the already-accepted body plant.
    const skill = skills.entries.find((entry) => entry.competitorId === competitorId);
    if (
      skill
      && skill.skillId === ZED_LIVING_SHADOW_SKILL_ID
      && skill.phase === "channeling"
      && skill.projection
    ) {
      const shadowTile = tileOf(skill.projection);
      if (canPlaceBombOnTile(shadowTile, occupied, solid, crates)) {
        const echo: BombEntry = Object.freeze({
          id: nextId,
          ownerId: competitorId,
          tile: freezeTile(shadowTile),
          fuseMs: BOMB_FUSE_MS,
          flameRange: progressionRow.flameRange,
          echo: true,
        });
        nextId += 1;
        items.push(echo);
        occupied.add(tileKey(shadowTile));
        events.push(
          Object.freeze({
            type: "bomb-placed",
            bombId: echo.id,
            competitorId,
            at: freezeTile(echo.tile),
          }),
        );
      }
    }
  }

  items.sort((left, right) => left.id - right.id);

  if (events.length === 0 && items.length === bombs.items.length) {
    return { rejections };
  }

  return {
    writes: {
      bombs: Object.freeze({ nextId, items: Object.freeze(items) }),
    },
    events,
    rejections,
  };
}

function runOrdnanceReset(ctx: SystemRunContext): SystemRunResult {
  const resets = factsOfKind(ctx.facts, "round-reset");
  if (resets.length === 0) return {};
  return {
    writes: {
      bombs: Object.freeze({ nextId: 1, items: Object.freeze([] as BombEntry[]) }),
      flames: Object.freeze({ items: Object.freeze([] as FlameEntry[]) }),
    },
  };
}

function runFlameDecay(ctx: SystemRunContext): SystemRunResult {
  const match = ctx.read("match");
  if (!isGameplayActive(match.phase)) {
    return {};
  }
  const flames = ctx.read("flames");
  const items = flames.items
    .map((flame) =>
      Object.freeze({
        tile: freezeTile(flame.tile),
        remainingMs: flame.remainingMs - TICK_DURATION_MS,
        causes: Object.freeze(flame.causes.map((cause) => Object.freeze({ ...cause }))),
      }),
    )
    .filter((flame) => flame.remainingMs > 0)
    .sort((left, right) => compareTiles(left.tile, right.tile));

  return {
    writes: {
      flames: Object.freeze({ items: Object.freeze(items) }),
    },
  };
}

function runBombFuse(ctx: SystemRunContext): SystemRunResult {
  const match = ctx.read("match");
  if (!isGameplayActive(match.phase)) {
    return {};
  }
  const bombs = ctx.read("bombs");
  const items = bombs.items.map((bomb) =>
    Object.freeze({
      ...bomb,
      tile: freezeTile(bomb.tile),
      fuseMs: Math.max(0, bomb.fuseMs - TICK_DURATION_MS),
    }),
  );
  return {
    writes: {
      bombs: Object.freeze({
        nextId: bombs.nextId,
        items: Object.freeze(items),
      }),
    },
  };
}

/**
 * pressure-impact barrier: force fuse=0 on any bomb sitting on the impact tile.
 * Normal bombs/explosion phases detonate it later this tick.
 */
function runOrdnancePressureImpact(ctx: SystemRunContext): SystemRunResult {
  const impacts = factsOfKind(ctx.facts, "pressure-impact");
  if (impacts.length === 0) return {};

  const bombs = ctx.read("bombs");
  const impactKeys = new Set(impacts.map((fact) => tileKey(fact.tile)));
  let changed = false;
  const items = bombs.items.map((bomb) => {
    if (!impactKeys.has(tileKey(bomb.tile))) {
      return Object.freeze({ ...bomb, tile: freezeTile(bomb.tile) });
    }
    changed = true;
    return Object.freeze({
      ...bomb,
      tile: freezeTile(bomb.tile),
      fuseMs: 0,
    });
  });
  if (!changed) return {};
  return {
    writes: {
      bombs: Object.freeze({
        nextId: bombs.nextId,
        items: Object.freeze(items),
      }),
    },
  };
}

/**
 * Chain reaction in waves until quiescence.
 * Simulates crate removals locally for wave progression; emits crates-destroyed
 * facts for Arena (sole writer of arena). Does not write arena/locomotion.
 * Effective solid = arena base solid + pressure closed tiles.
 */
function runExplosion(ctx: SystemRunContext): SystemRunResult {
  const match = ctx.read("match");
  if (!isGameplayActive(match.phase)) {
    return {};
  }

  const arena = ctx.read("arena");
  const pressure = ctx.read("pressure");
  const bombs = ctx.read("bombs");
  const flames = ctx.read("flames");

  const solid = new Set(effectiveSolidKeySet(arena, pressure));
  let crateKeys = new Set(arena.crates.map(tileKey));
  let remainingBombs: BombEntry[] = bombs.items.map((bomb) =>
    Object.freeze({ ...bomb, tile: freezeTile(bomb.tile) }),
  );
  const flamesByKey = new Map<string, FlameEntry>();
  for (const flame of flames.items) {
    flamesByKey.set(
      tileKey(flame.tile),
      Object.freeze({
        tile: freezeTile(flame.tile),
        remainingMs: flame.remainingMs,
        causes: Object.freeze(flame.causes.map((cause) => Object.freeze({ ...cause }))),
      }),
    );
  }

  const waveEvents: GameEvent[] = [];
  const destroyedAll = new Set<string>();

  let dueIds = remainingBombs.filter((bomb) => bomb.fuseMs <= 0).map((bomb) => bomb.id);

  while (dueIds.length > 0) {
    const dueSet = new Set(dueIds);
    const waveBombs = remainingBombs
      .filter((bomb) => dueSet.has(bomb.id))
      .sort((left, right) => left.id - right.id);

    const waveCrates = new Set(crateKeys);
    const destroyedThisWave = new Set<string>();
    const flameTilesThisWave = new Set<string>();
    const nextDue: number[] = [];

    for (const bomb of waveBombs) {
      const flameTiles = collectBlast(bomb.tile, bomb.flameRange, solid, waveCrates);
      const cause: FlameCause = Object.freeze({
        bombId: bomb.id,
        ownerId: bomb.ownerId,
      });

      for (const tile of flameTiles) {
        const key = tileKey(tile);
        flameTilesThisWave.add(key);
        if (waveCrates.has(key)) destroyedThisWave.add(key);
        flamesByKey.set(key, mergeFlame(flamesByKey.get(key), tile, cause));
      }

      waveEvents.push(
        Object.freeze({
          type: "bomb-exploded",
          bombId: bomb.id,
          competitorId: bomb.ownerId,
          flameTiles: Object.freeze(flameTiles.map(freezeTile)),
        }),
      );
    }

    const explodedIds = new Set(waveBombs.map((bomb) => bomb.id));
    remainingBombs = remainingBombs.filter((bomb) => !explodedIds.has(bomb.id));

    for (const key of [...destroyedThisWave].sort()) {
      crateKeys.delete(key);
      destroyedAll.add(key);
    }

    for (const bomb of remainingBombs) {
      if (flameTilesThisWave.has(tileKey(bomb.tile))) {
        nextDue.push(bomb.id);
      }
    }
    dueIds = nextDue.sort((left, right) => left - right);
  }

  const exploded = waveEvents
    .filter((event) => event.type === "bomb-exploded")
    .sort((left, right) => {
      if (left.type !== "bomb-exploded" || right.type !== "bomb-exploded") return 0;
      return left.bombId - right.bombId;
    });

  const flameItems = Object.freeze(
    [...flamesByKey.values()].sort((left, right) => compareTiles(left.tile, right.tile)),
  );

  const destroyedTiles = Object.freeze(
    [...destroyedAll]
      .map((key) => {
        const [x = 0, y = 0] = key.split(",").map(Number);
        return freezeTile({ x, y });
      })
      .sort(compareTiles),
  );

  const facts =
    destroyedTiles.length > 0
      ? [Object.freeze({ kind: "crates-destroyed" as const, tiles: destroyedTiles })]
      : [];

  if (
    exploded.length === 0
    && destroyedTiles.length === 0
    && remainingBombs.length === bombs.items.length
    && flameItems.length === flames.items.length
  ) {
    const sameBombs = remainingBombs.every((bomb, index) => {
      const prev = bombs.items[index];
      return (
        prev
        && prev.id === bomb.id
        && prev.fuseMs === bomb.fuseMs
        && prev.ownerId === bomb.ownerId
      );
    });
    if (sameBombs && flameItems.length === flames.items.length) {
      return {};
    }
  }

  return {
    writes: {
      bombs: Object.freeze({
        nextId: bombs.nextId,
        items: Object.freeze(remainingBombs.sort((left, right) => left.id - right.id)),
      }),
      flames: Object.freeze({ items: flameItems }),
    },
    events: exploded,
    facts,
  };
}

function initialOrdnance(): { bombs: BombsSlice; flames: FlamesSlice } {
  return {
    bombs: Object.freeze({ nextId: 1, items: Object.freeze([] as BombEntry[]) }),
    flames: Object.freeze({ items: Object.freeze([] as FlameEntry[]) }),
  };
}

function restoreBombs(raw: unknown, config: MatchConfig): BombsSlice {
  if (!raw || typeof raw !== "object") {
    throw new Error("slices.bombs must be an object.");
  }
  const bombsRaw = raw as { nextId?: unknown; items?: unknown };
  const nextId = assertInteger(bombsRaw.nextId, "slices.bombs.nextId", 1);
  if (!Array.isArray(bombsRaw.items)) {
    throw new Error("slices.bombs.items must be an array.");
  }
  const seatSet = new Set(config.seats.map((seat) => seat.competitorId));
  const bombItems = bombsRaw.items.map((item, index) => {
    if (!item || typeof item !== "object") {
      throw new Error(`slices.bombs.items[${index}] is invalid.`);
    }
    const row = item as Record<string, unknown>;
    const id = assertInteger(row.id, `slices.bombs.items[${index}].id`, 1);
    if (id >= nextId) {
      throw new Error(`slices.bombs.items[${index}].id must be < nextId.`);
    }
    if (typeof row.ownerId !== "string" || !seatSet.has(row.ownerId as CompetitorId)) {
      throw new Error(`slices.bombs.items[${index}].ownerId is invalid.`);
    }
    const fuseMs = assertInteger(row.fuseMs, `slices.bombs.items[${index}].fuseMs`);
    if (fuseMs % TICK_DURATION_MS !== 0) {
      throw new Error(
        `slices.bombs.items[${index}].fuseMs must be a multiple of ${TICK_DURATION_MS} ms.`,
      );
    }
    if (fuseMs < MIN_ACTIVE_FUSE_MS || fuseMs > MAX_ACTIVE_FUSE_MS) {
      throw new Error(
        `slices.bombs.items[${index}].fuseMs must be in [${MIN_ACTIVE_FUSE_MS}, ${MAX_ACTIVE_FUSE_MS}].`,
      );
    }
    if (row.echo !== undefined && typeof row.echo !== "boolean") {
      throw new Error(`slices.bombs.items[${index}].echo must be a boolean when present.`);
    }
    return Object.freeze({
      id,
      ownerId: row.ownerId as CompetitorId,
      tile: assertTile(row.tile, `slices.bombs.items[${index}].tile`),
      fuseMs,
      flameRange: assertInteger(row.flameRange, `slices.bombs.items[${index}].flameRange`, 1),
      echo: row.echo === true,
    });
  });

  const bombIds = new Set(bombItems.map((bomb) => bomb.id));
  if (bombIds.size !== bombItems.length) {
    throw new Error("slices.bombs.items must have unique ids.");
  }
  for (let index = 1; index < bombItems.length; index += 1) {
    if (bombItems[index]!.id <= bombItems[index - 1]!.id) {
      throw new Error("slices.bombs.items must be ordered by ascending id.");
    }
  }
  const bombTiles = new Set<string>();
  for (const bomb of bombItems) {
    const key = tileKey(bomb.tile);
    if (bombTiles.has(key)) {
      throw new Error(`slices.bombs.items has multiple bombs on tile ${key}.`);
    }
    bombTiles.add(key);
  }

  return Object.freeze({ nextId, items: Object.freeze(bombItems) });
}

function restoreFlames(raw: unknown, config: MatchConfig): FlamesSlice {
  if (!raw || typeof raw !== "object") {
    throw new Error("slices.flames must be an object.");
  }
  const flamesRaw = raw as { items?: unknown };
  if (!Array.isArray(flamesRaw.items)) {
    throw new Error("slices.flames.items must be an array.");
  }
  const seatSet = new Set(config.seats.map((seat) => seat.competitorId));
  const flameItems = flamesRaw.items.map((item, index) => {
    if (!item || typeof item !== "object") {
      throw new Error(`slices.flames.items[${index}] is invalid.`);
    }
    const row = item as Record<string, unknown>;
    if (!Array.isArray(row.causes) || row.causes.length === 0) {
      throw new Error(`slices.flames.items[${index}].causes must be a non-empty array.`);
    }
    const causes = row.causes.map((cause, causeIndex) => {
      if (!cause || typeof cause !== "object") {
        throw new Error(`slices.flames.items[${index}].causes[${causeIndex}] is invalid.`);
      }
      const c = cause as Record<string, unknown>;
      if (typeof c.ownerId !== "string" || !seatSet.has(c.ownerId as CompetitorId)) {
        throw new Error(
          `slices.flames.items[${index}].causes[${causeIndex}].ownerId is invalid.`,
        );
      }
      return Object.freeze({
        bombId: assertInteger(
          c.bombId,
          `slices.flames.items[${index}].causes[${causeIndex}].bombId`,
          1,
        ),
        ownerId: c.ownerId as CompetitorId,
      });
    });
    for (let causeIndex = 1; causeIndex < causes.length; causeIndex += 1) {
      if (compareCauses(causes[causeIndex - 1]!, causes[causeIndex]!) >= 0) {
        throw new Error(
          `slices.flames.items[${index}].causes must be ordered uniquely by bombId then ownerId.`,
        );
      }
    }
    const causeKeys = new Set(causes.map((cause) => `${cause.bombId}|${cause.ownerId}`));
    if (causeKeys.size !== causes.length) {
      throw new Error(`slices.flames.items[${index}].causes must be unique.`);
    }
    const remainingMs = assertInteger(
      row.remainingMs,
      `slices.flames.items[${index}].remainingMs`,
      1,
    );
    if (remainingMs % TICK_DURATION_MS !== 0) {
      throw new Error(
        `slices.flames.items[${index}].remainingMs must be a multiple of ${TICK_DURATION_MS} ms.`,
      );
    }
    if (remainingMs < TICK_DURATION_MS || remainingMs > FLAME_DURATION_MS) {
      throw new Error(
        `slices.flames.items[${index}].remainingMs must be in [${TICK_DURATION_MS}, ${FLAME_DURATION_MS}].`,
      );
    }
    return Object.freeze({
      tile: assertTile(row.tile, `slices.flames.items[${index}].tile`),
      remainingMs,
      causes: Object.freeze(causes),
    });
  });
  assertTilesSortedUnique(
    flameItems.map((flame) => flame.tile),
    "slices.flames.items",
  );
  return Object.freeze({ items: Object.freeze(flameItems) });
}


export const ordnanceModule: ModuleSpec = Object.freeze({
  id: "ordnance",
  version: MODULE_VERSION,
  owns: Object.freeze(["bombs", "flames"] as const),
  systems: Object.freeze([
    Object.freeze({
      id: "ordnance-reset-system",
      phase: "round-reset" as const,
      reads: Object.freeze(["bombs", "flames"] as const),
      writes: Object.freeze(["bombs", "flames"] as const),
      run: runOrdnanceReset,
    }),
    Object.freeze({
      id: "bomb-place-system",
      phase: "command" as const,
      reads: Object.freeze([
        "bombs",
        "locomotion",
        "progression",
        "vitals",
        "match",
        "skills",
        "arena",
        "pressure",
      ] as const),
      writes: Object.freeze(["bombs"] as const),
      run: runBombPlace,
    }),
    Object.freeze({
      id: "flame-decay-system",
      phase: "timer" as const,
      reads: Object.freeze(["flames", "match"] as const),
      writes: Object.freeze(["flames"] as const),
      run: runFlameDecay,
    }),
    Object.freeze({
      id: "ordnance-pressure-impact-system",
      phase: "pressure-impact" as const,
      reads: Object.freeze(["bombs"] as const),
      writes: Object.freeze(["bombs"] as const),
      run: runOrdnancePressureImpact,
    }),
    Object.freeze({
      id: "bomb-fuse-system",
      phase: "bombs" as const,
      reads: Object.freeze(["bombs", "match"] as const),
      writes: Object.freeze(["bombs"] as const),
      run: runBombFuse,
    }),
    Object.freeze({
      id: "explosion-system",
      phase: "explosion" as const,
      reads: Object.freeze(["bombs", "arena", "flames", "match", "pressure"] as const),
      writes: Object.freeze(["bombs", "flames"] as const),
      run: runExplosion,
    }),
  ]),
  codecs: Object.freeze({
    initial(_config: MatchConfig) {
      return Object.freeze(initialOrdnance());
    },
    restore(
      rawOwned: Readonly<Partial<Record<"bombs" | "flames", unknown>>>,
      config: MatchConfig,
    ) {
      return Object.freeze({
        bombs: restoreBombs(rawOwned.bombs, config),
        flames: restoreFlames(rawOwned.flames, config),
      });
    },
  }),
});
