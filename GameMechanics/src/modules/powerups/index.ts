import type {
  CompetitorId,
  GameEvent,
  MatchConfig,
  PowerUpType,
  TileCoord,
} from "../../contracts.ts";
import { factsOfKind } from "../../kernel/facts.ts";
import type {
  ModuleSpec,
  SystemRunContext,
  SystemRunResult,
} from "../../kernel/protocol.ts";
import {
  assertCompetitorOrder,
  assertInteger,
  assertTile,
  assertTilesSortedUnique,
  bodyTileOverlapArea,
  centralMirrorTile,
  compareTiles,
  createArenaTiles,
  freezeTile,
  hashUint32,
  isGameplayActive,
  PROGRESSION_BASE_FLAME_RANGE,
  PROGRESSION_BASE_MAX_BOMBS,
  PROGRESSION_MAX_CAP,
  symmetryPairKey,
  tileKey,
  type PickupItem,
  type PickupsSlice,
  type ProgressionEntry,
  type ProgressionSlice,
  type VitalsSlice,
} from "../../kernel/world-state.ts";
import { roundSeedFor } from "../../match-config.ts";

/**
 * Powerups 1.0.0 (Decision 009 / Slice 4A).
 * Owns pickups (visible only) + progression (sole maxBombs/flameRange source).
 * Hidden drop plan is pure: roundSeed + initial crates layout — never persisted.
 */
const MODULE_VERSION = "1.0.0";

const DROP_PAIR_NUMERATOR = 65;
const DROP_PAIR_DENOMINATOR = 100;
const BOMB_UP_WEIGHT = 5;
const FLAME_UP_WEIGHT = 4;
const DROP_TYPE_MODULUS = BOMB_UP_WEIGHT + FLAME_UP_WEIGHT; // 9

export type DropPlanEntry = Readonly<{
  tile: TileCoord;
  type: PowerUpType;
}>;

export type RoundDropPlan = Readonly<{
  /** Canonical selected drops (sorted by tile). */
  items: readonly DropPlanEntry[];
  pairCount: number;
  selectedPairCount: number;
}>;

function freezePickup(item: PickupItem): PickupItem {
  return Object.freeze({
    tile: freezeTile(item.tile),
    type: item.type,
  });
}

function freezeProgressionEntry(entry: ProgressionEntry): ProgressionEntry {
  return Object.freeze({
    competitorId: entry.competitorId,
    maxBombs: entry.maxBombs,
    flameRange: entry.flameRange,
  });
}

function isPowerUpType(value: unknown): value is PowerUpType {
  return value === "bomb-up" || value === "flame-up";
}

function typeFromBucket(bucket: number): PowerUpType {
  // Integer weight table: bomb-up 5, flame-up 4 over modulus 9.
  return bucket < BOMB_UP_WEIGHT ? "bomb-up" : "flame-up";
}

/**
 * Pure hidden drop plan for a round.
 * Groups initial crates by central symmetry, selects floor(pairCount*65/100)
 * pairs by deterministic uint32 hash + pairKey (no float accumulation),
 * assigns type by hash%9 weights, same type on both present tiles.
 */
export function deriveRoundDropPlan(
  roundSeed: string,
  initialCrates: readonly TileCoord[],
): RoundDropPlan {
  type Pair = {
    pairKey: string;
    tiles: TileCoord[];
    selectHash: number;
  };

  const pairsByKey = new Map<string, Pair>();
  for (const tile of initialCrates) {
    const mirror = centralMirrorTile(tile);
    const pairKey = symmetryPairKey(tile, mirror);
    let pair = pairsByKey.get(pairKey);
    if (!pair) {
      pair = {
        pairKey,
        tiles: [],
        selectHash: hashUint32(`${roundSeed}|${pairKey}|drop-select`),
      };
      pairsByKey.set(pairKey, pair);
    }
    const key = tileKey(tile);
    if (!pair.tiles.some((existing) => tileKey(existing) === key)) {
      pair.tiles.push(freezeTile(tile));
    }
  }

  const pairs = [...pairsByKey.values()].map((pair) =>
    Object.freeze({
      pairKey: pair.pairKey,
      tiles: Object.freeze([...pair.tiles].sort(compareTiles)),
      selectHash: pair.selectHash,
    }),
  );
  pairs.sort((left, right) => {
    if (left.selectHash !== right.selectHash) {
      return left.selectHash < right.selectHash ? -1 : 1;
    }
    return left.pairKey < right.pairKey ? -1 : left.pairKey > right.pairKey ? 1 : 0;
  });

  const pairCount = pairs.length;
  const selectedPairCount = Math.floor((pairCount * DROP_PAIR_NUMERATOR) / DROP_PAIR_DENOMINATOR);
  const selected = pairs.slice(0, selectedPairCount);

  const items: DropPlanEntry[] = [];
  for (const pair of selected) {
    const typeBucket =
      hashUint32(`${roundSeed}|${pair.pairKey}|drop-type`) % DROP_TYPE_MODULUS;
    const type = typeFromBucket(typeBucket);
    for (const tile of pair.tiles) {
      items.push(
        Object.freeze({
          tile: freezeTile(tile),
          type,
        }),
      );
    }
  }

  items.sort((left, right) => compareTiles(left.tile, right.tile));
  return Object.freeze({
    items: Object.freeze(items),
    pairCount,
    selectedPairCount,
  });
}

function planForRound(config: MatchConfig, roundNumber: number): RoundDropPlan {
  const roundSeed = roundSeedFor(config.seed, roundNumber);
  const initial = createArenaTiles(roundSeed);
  return deriveRoundDropPlan(roundSeed, initial.crates);
}

function baseProgression(config: MatchConfig): ProgressionSlice {
  return Object.freeze({
    entries: Object.freeze(
      config.seats.map((seat) =>
        freezeProgressionEntry({
          competitorId: seat.competitorId,
          maxBombs: PROGRESSION_BASE_MAX_BOMBS,
          flameRange: PROGRESSION_BASE_FLAME_RANGE,
        }),
      ),
    ),
  });
}

function emptyPickups(): PickupsSlice {
  return Object.freeze({ items: Object.freeze([] as PickupItem[]) });
}

/** round-reset: clear pickups and restore progression 1/1. */
function runPowerupsReset(ctx: SystemRunContext): SystemRunResult {
  const resets = factsOfKind(ctx.facts, "round-reset");
  if (resets.length === 0) return {};
  return {
    writes: {
      pickups: emptyPickups(),
      progression: baseProgression(ctx.config),
    },
  };
}

/**
 * pressure-impact: remove visible pickups on impact tiles.
 * Never materializes hidden drops (pressure crushing a crate emits no crates-removed).
 */
function runPowerupsPressureImpact(ctx: SystemRunContext): SystemRunResult {
  const impacts = factsOfKind(ctx.facts, "pressure-impact");
  if (impacts.length === 0) return {};

  const pickups = ctx.read("pickups");
  if (pickups.items.length === 0) return {};

  const impactKeys = new Set(impacts.map((fact) => tileKey(fact.tile)));
  const remaining = pickups.items.filter((item) => !impactKeys.has(tileKey(item.tile)));
  if (remaining.length === pickups.items.length) return {};

  return {
    writes: {
      pickups: Object.freeze({
        items: Object.freeze(remaining.map(freezePickup)),
      }),
    },
  };
}

/**
 * pickup phase: materialize drops from Arena-applied crates-removed, then
 * resolve claims in one atomic commit of pickups + progression.
 * Same-tick: drop revealed in damage (via fact) can be collected here;
 * competitor eliminated in damage is already dead in vitals and cannot claim.
 * Strict no-op outside playing/sudden-death (round-reset owns terminal wipe).
 */
function runPowerupsPickup(ctx: SystemRunContext): SystemRunResult {
  const match = ctx.read("match");
  // Gameplay-active only: never materialize or collect in round-over / match-over /
  // round-start / paused — and never silently repair foreign terminal state.
  if (!isGameplayActive(match.phase)) {
    return {};
  }

  const removedFacts = factsOfKind(ctx.facts, "crates-removed");
  const pickups = ctx.read("pickups");
  const progression = ctx.read("progression");
  const vitals = ctx.read("vitals");
  const locomotion = ctx.read("locomotion");

  const plan = planForRound(ctx.config, match.roundNumber);
  const planByTile = new Map(plan.items.map((item) => [tileKey(item.tile), item.type] as const));

  const events: GameEvent[] = [];
  const visibleByTile = new Map<string, PowerUpType>();
  for (const item of pickups.items) {
    visibleByTile.set(tileKey(item.tile), item.type);
  }

  // Materialize newly released drops (from applied Arena fact only).
  const revealedTiles: TileCoord[] = [];
  for (const fact of removedFacts) {
    for (const tile of fact.tiles) {
      const key = tileKey(tile);
      if (visibleByTile.has(key)) continue;
      const type = planByTile.get(key);
      if (!type) continue;
      visibleByTile.set(key, type);
      revealedTiles.push(freezeTile(tile));
    }
  }
  revealedTiles.sort(compareTiles);
  for (const tile of revealedTiles) {
    const type = visibleByTile.get(tileKey(tile))!;
    events.push(
      Object.freeze({
        type: "power-up-revealed" as const,
        at: freezeTile(tile),
        powerUpType: type,
      }),
    );
  }

  // Virtual progression for sequential claim batch (cap-aware).
  const virtual = new Map<CompetitorId, { maxBombs: number; flameRange: number }>();
  for (const entry of progression.entries) {
    virtual.set(entry.competitorId, {
      maxBombs: entry.maxBombs,
      flameRange: entry.flameRange,
    });
  }

  const seatOrder = ctx.config.seats.map((seat) => seat.competitorId);
  const seatRank = new Map(seatOrder.map((id, index) => [id, index] as const));
  const alive = new Set(
    vitals.entries.filter((entry) => entry.alive).map((entry) => entry.competitorId),
  );
  const positionById = new Map(
    locomotion.entries.map((entry) => [entry.competitorId, entry.position] as const),
  );

  // Claim in canonical tile order over the combined visible list.
  const claimOrder = [...visibleByTile.entries()]
    .map(([key, type]) => {
      const [x = 0, y = 0] = key.split(",").map(Number);
      return Object.freeze({ tile: freezeTile({ x, y }), type });
    })
    .sort((left, right) => compareTiles(left.tile, right.tile));

  const remainingItems: PickupItem[] = [];
  let progressionChanged = false;

  for (const item of claimOrder) {
    type Candidate = Readonly<{
      competitorId: CompetitorId;
      area: number;
      seatIndex: number;
    }>;
    const candidates: Candidate[] = [];
    for (const competitorId of seatOrder) {
      if (!alive.has(competitorId)) continue;
      const stats = virtual.get(competitorId);
      if (!stats) continue;
      if (item.type === "bomb-up" && stats.maxBombs >= PROGRESSION_MAX_CAP) continue;
      if (item.type === "flame-up" && stats.flameRange >= PROGRESSION_MAX_CAP) continue;
      const position = positionById.get(competitorId);
      if (!position) continue;
      const area = bodyTileOverlapArea(position, item.tile);
      if (area <= 0) continue;
      candidates.push(
        Object.freeze({
          competitorId,
          area,
          seatIndex: seatRank.get(competitorId) ?? Number.MAX_SAFE_INTEGER,
        }),
      );
    }

    if (candidates.length === 0) {
      remainingItems.push(freezePickup(item));
      continue;
    }

    candidates.sort((left, right) => {
      if (left.area !== right.area) return right.area - left.area;
      return left.seatIndex - right.seatIndex;
    });
    const winner = candidates[0]!;
    const stats = virtual.get(winner.competitorId)!;
    if (item.type === "bomb-up") {
      stats.maxBombs = Math.min(PROGRESSION_MAX_CAP, stats.maxBombs + 1);
    } else {
      stats.flameRange = Math.min(PROGRESSION_MAX_CAP, stats.flameRange + 1);
    }
    progressionChanged = true;
    events.push(
      Object.freeze({
        type: "power-up-collected" as const,
        competitorId: winner.competitorId,
        at: freezeTile(item.tile),
        powerUpType: item.type,
        maxBombs: stats.maxBombs,
        flameRange: stats.flameRange,
      }),
    );
  }

  const nextPickups = Object.freeze({
    items: Object.freeze(remainingItems.map(freezePickup).sort((a, b) => compareTiles(a.tile, b.tile))),
  });
  const nextProgression = Object.freeze({
    entries: Object.freeze(
      progression.entries.map((entry) => {
        const stats = virtual.get(entry.competitorId)!;
        return freezeProgressionEntry({
          competitorId: entry.competitorId,
          maxBombs: stats.maxBombs,
          flameRange: stats.flameRange,
        });
      }),
    ),
  });

  const pickupsUnchanged =
    nextPickups.items.length === pickups.items.length
    && nextPickups.items.every((item, index) => {
      const prev = pickups.items[index];
      return prev && prev.type === item.type && tileKey(prev.tile) === tileKey(item.tile);
    });

  if (pickupsUnchanged && !progressionChanged && events.length === 0) {
    return {};
  }

  return {
    writes: {
      pickups: nextPickups,
      progression: nextProgression,
    },
    events,
  };
}

function initialPowerups(config: MatchConfig): {
  pickups: PickupsSlice;
  progression: ProgressionSlice;
} {
  return {
    pickups: emptyPickups(),
    progression: baseProgression(config),
  };
}

function restorePickups(raw: unknown): PickupsSlice {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("slices.pickups must be an object.");
  }
  const pickupsRaw = raw as Record<string, unknown>;
  if (!Array.isArray(pickupsRaw.items)) {
    throw new Error("slices.pickups.items must be an array.");
  }
  const items = pickupsRaw.items.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error(`slices.pickups.items[${index}] is invalid.`);
    }
    const row = item as Record<string, unknown>;
    if (!isPowerUpType(row.type)) {
      throw new Error(`slices.pickups.items[${index}].type is invalid.`);
    }
    return freezePickup({
      tile: assertTile(row.tile, `slices.pickups.items[${index}].tile`),
      type: row.type,
    });
  });
  assertTilesSortedUnique(
    items.map((item) => item.tile),
    "slices.pickups.items",
  );
  return Object.freeze({ items: Object.freeze(items) });
}

function restoreProgression(raw: unknown, config: MatchConfig): ProgressionSlice {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("slices.progression must be an object.");
  }
  const progressionRaw = raw as Record<string, unknown>;
  if (!Array.isArray(progressionRaw.entries)) {
    throw new Error("slices.progression.entries must be an array.");
  }
  const seatOrder = config.seats.map((seat) => seat.competitorId);
  const seatSet = new Set(seatOrder);
  const entries = progressionRaw.entries.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error(`slices.progression.entries[${index}] is invalid.`);
    }
    const row = entry as Record<string, unknown>;
    if (typeof row.competitorId !== "string" || !seatSet.has(row.competitorId as CompetitorId)) {
      throw new Error(`slices.progression.entries[${index}].competitorId is invalid.`);
    }
    const maxBombs = assertInteger(
      row.maxBombs,
      `slices.progression.entries[${index}].maxBombs`,
      1,
    );
    const flameRange = assertInteger(
      row.flameRange,
      `slices.progression.entries[${index}].flameRange`,
      1,
    );
    if (maxBombs > PROGRESSION_MAX_CAP) {
      throw new Error(
        `slices.progression.entries[${index}].maxBombs must be <= ${PROGRESSION_MAX_CAP}.`,
      );
    }
    if (flameRange > PROGRESSION_MAX_CAP) {
      throw new Error(
        `slices.progression.entries[${index}].flameRange must be <= ${PROGRESSION_MAX_CAP}.`,
      );
    }
    return freezeProgressionEntry({
      competitorId: row.competitorId as CompetitorId,
      maxBombs,
      flameRange,
    });
  });
  assertCompetitorOrder(entries, seatOrder, "slices.progression.entries");
  return Object.freeze({ entries: Object.freeze(entries) });
}

export const powerupsModule: ModuleSpec = Object.freeze({
  id: "powerups",
  version: MODULE_VERSION,
  owns: Object.freeze(["pickups", "progression"] as const),
  systems: Object.freeze([
    Object.freeze({
      id: "powerups-reset-system",
      phase: "round-reset" as const,
      reads: Object.freeze(["pickups", "progression"] as const),
      writes: Object.freeze(["pickups", "progression"] as const),
      run: runPowerupsReset,
    }),
    Object.freeze({
      id: "powerups-pressure-impact-system",
      phase: "pressure-impact" as const,
      reads: Object.freeze(["pickups"] as const),
      writes: Object.freeze(["pickups"] as const),
      run: runPowerupsPressureImpact,
    }),
    Object.freeze({
      id: "powerups-pickup-system",
      phase: "pickup" as const,
      reads: Object.freeze([
        "pickups",
        "progression",
        "vitals",
        "locomotion",
        "match",
      ] as const),
      writes: Object.freeze(["pickups", "progression"] as const),
      run: runPowerupsPickup,
    }),
  ]),
  codecs: Object.freeze({
    initial(config: MatchConfig) {
      return Object.freeze(initialPowerups(config));
    },
    restore(
      rawOwned: Readonly<Partial<Record<"pickups" | "progression", unknown>>>,
      config: MatchConfig,
    ) {
      return Object.freeze({
        pickups: restorePickups(rawOwned.pickups),
        progression: restoreProgression(rawOwned.progression, config),
      });
    },
  }),
});
