/**
 * Slice 4A — powerups profundos e progressao unica (Decision 009 / world-5).
 * Focused adversarial contracts on top of the full 98-test regression suite.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import {
  GAME_MECHANICS_VERSION,
  ROUND_END_MS,
  SPAWN_PROTECTION_MS,
  TICK_DURATION_MS,
  type CompetitorId,
  type GameEvent,
  type MatchConfig,
} from "../src/contracts.ts";
import {
  createLocalDuel1v1MatchConfig,
  createMatchConfig,
  DEFAULT_CONTENT_REVISION,
  DEFAULT_MECHANICS_REVISION,
  roundSeedFor,
} from "../src/match-config.ts";
import {
  createDefaultMechanicsProgram,
  createDefaultModules,
  createMechanicsProgram,
} from "../src/composition.ts";
import type { ModuleSpec } from "../src/kernel/protocol.ts";
import type { MechanicsProgram } from "../src/kernel/program.ts";
import {
  BODY_HALF_EXTENT,
  bodyOverlapsTile,
  bodyTileOverlapArea,
  bodyWithinBounds,
  buildPressurePath,
  centralMirrorTile,
  createArenaTiles,
  freezePosition,
  freezeTile,
  hashUint32,
  impactAt,
  PROGRESSION_BASE_FLAME_RANGE,
  PROGRESSION_BASE_MAX_BOMBS,
  PROGRESSION_MAX_CAP,
  symmetryPairKey,
  tileCenter,
  UNITS_PER_TILE,
  WORLD_FORMAT_VERSION,
  type WorldState,
} from "../src/kernel/world-state.ts";
import {
  arenaModule,
  competitorsModule,
  locomotionModule,
  ordnanceModule,
  powerupsModule,
} from "../src/modules/index.ts";
import { deriveRoundDropPlan } from "../src/modules/powerups/index.ts";

const ROUND_START_TICKS = 1_200 / TICK_DURATION_MS;
const UNPROTECTED_ELAPSED_MS = SPAWN_PROTECTION_MS;
const FIXED_SEED = "4a-golden-drop-plan-v1";

type MutableWorldDraft = {
  formatVersion: string;
  mechanicsRevision: string;
  tick: number;
  stateRevision: number;
  config: MatchConfig;
  slices: {
    match: {
      phase: string;
      roundNumber: number;
      phaseRemainingMs: number;
      roundElapsedMs: number;
      roundRemainingMs: number;
      suddenDeathElapsedMs: number;
      scores: Array<{ competitorId: string; wins: number }>;
      roundOutcome: { reason: string; winner: string | null } | null;
      matchWinner: string | null;
    };
    arena: {
      width: number;
      height: number;
      solid: Array<{ x: number; y: number }>;
      crates: Array<{ x: number; y: number }>;
    };
    roster: { entries: Array<Record<string, unknown>> };
    vitals: {
      entries: Array<{
        competitorId: string;
        alive: boolean;
        spawnProtectionRemainingMs: number;
      }>;
    };
    intent: { entries: Array<Record<string, unknown>> };
    locomotion: { entries: Array<Record<string, unknown>> };
    bombs: { nextId: number; items: Array<Record<string, unknown>> };
    flames: { items: Array<Record<string, unknown>> };
    pressure: { closedTiles: Array<{ x: number; y: number }> };
    pickups: {
      items: Array<{ tile: { x: number; y: number }; type: string }>;
    };
    progression: {
      entries: Array<{
        competitorId: string;
        maxBombs: number;
        flameRange: number;
      }>;
    };
  };
};

function localDuel(
  seed = FIXED_SEED,
  extras: { roundDurationMs?: number; targetRoundWins?: number } = {},
) {
  return createLocalDuel1v1MatchConfig({ seed, ...extras });
}

function cloneDraft(base: WorldState): MutableWorldDraft {
  return JSON.parse(JSON.stringify(base)) as MutableWorldDraft;
}

function defaultModulesWith(replacements: ReadonlyArray<ModuleSpec> = []): ModuleSpec[] {
  const byId = new Map(createDefaultModules().map((module) => [module.id, module]));
  for (const module of replacements) byId.set(module.id, module);
  return [...byId.values()];
}

function reconcileBombsWithProgression(raw: MutableWorldDraft): void {
  for (const bomb of raw.slices.bombs.items) {
    const entry = raw.slices.progression.entries.find(
      (row) => row.competitorId === bomb.ownerId,
    );
    if (!entry) continue;
    const range = Number(bomb.flameRange) || 1;
    if (range > entry.flameRange) entry.flameRange = range;
  }
  const activeCounts = new Map<string, number>();
  for (const bomb of raw.slices.bombs.items) {
    const id = String(bomb.ownerId);
    activeCounts.set(id, (activeCounts.get(id) ?? 0) + 1);
  }
  for (const [id, count] of activeCounts) {
    const entry = raw.slices.progression.entries.find((row) => row.competitorId === id);
    if (entry && count > entry.maxBombs) entry.maxBombs = count;
  }
  let spentBomb = 0;
  let spentFlame = 0;
  for (const entry of raw.slices.progression.entries) {
    spentBomb += entry.maxBombs - PROGRESSION_BASE_MAX_BOMBS;
    spentFlame += entry.flameRange - PROGRESSION_BASE_FLAME_RANGE;
  }
  const visibleBomb = raw.slices.pickups.items.filter((item) => item.type === "bomb-up").length;
  const visibleFlame = raw.slices.pickups.items.filter((item) => item.type === "flame-up").length;
  const needBomb = spentBomb + visibleBomb;
  const needFlame = spentFlame + visibleFlame;
  if (needBomb === 0 && needFlame === 0) return;

  const roundSeed = roundSeedFor(raw.config.seed, raw.slices.match.roundNumber);
  const initial = createArenaTiles(roundSeed);
  const plan = deriveRoundDropPlan(roundSeed, initial.crates);
  const crateKeySet = new Set(raw.slices.arena.crates.map((tile) => `${tile.x},${tile.y}`));
  const released = (type: string): number =>
    plan.items.filter((item) => {
      const key = `${item.tile.x},${item.tile.y}`;
      return item.type === type && !crateKeySet.has(key);
    }).length;

  for (const item of plan.items) {
    if (released("bomb-up") >= needBomb && released("flame-up") >= needFlame) break;
    const key = `${item.tile.x},${item.tile.y}`;
    if (!crateKeySet.has(key)) continue;
    if (item.type === "bomb-up" && released("bomb-up") < needBomb) crateKeySet.delete(key);
    else if (item.type === "flame-up" && released("flame-up") < needFlame) crateKeySet.delete(key);
  }
  raw.slices.arena.crates = raw.slices.arena.crates.filter((tile) =>
    crateKeySet.has(`${tile.x},${tile.y}`),
  );
}

function asPlayingWorld(
  program: MechanicsProgram,
  base: WorldState,
  patch: {
    locomotion?: MutableWorldDraft["slices"]["locomotion"];
    bombs?: MutableWorldDraft["slices"]["bombs"];
    flames?: MutableWorldDraft["slices"]["flames"];
    arena?: {
      width?: number;
      height?: number;
      solid?: ReadonlyArray<{ x: number; y: number }>;
      crates?: ReadonlyArray<{ x: number; y: number }>;
    };
    vitals?: MutableWorldDraft["slices"]["vitals"];
    match?: Partial<MutableWorldDraft["slices"]["match"]>;
  } = {},
): WorldState {
  const config = base.config;
  const raw = cloneDraft(base);
  const elapsed = patch.match?.roundElapsedMs ?? UNPROTECTED_ELAPSED_MS;
  raw.tick = Math.max(base.tick, ROUND_START_TICKS + elapsed / TICK_DURATION_MS);
  raw.slices.match = {
    phase: "playing",
    roundNumber: base.slices.match.roundNumber,
    phaseRemainingMs: 0,
    roundElapsedMs: elapsed,
    roundRemainingMs: config.roundDurationMs - elapsed,
    suddenDeathElapsedMs: 0,
    scores: config.seats.map((seat) => ({ competitorId: seat.competitorId, wins: 0 })),
    roundOutcome: null,
    matchWinner: null,
    ...(patch.match ?? {}),
  };
  raw.slices.vitals = patch.vitals ?? {
    entries: config.seats.map((seat) => ({
      competitorId: seat.competitorId,
      alive: true,
      spawnProtectionRemainingMs: Math.max(0, SPAWN_PROTECTION_MS - elapsed),
    })),
  };
  if (patch.locomotion) raw.slices.locomotion = JSON.parse(JSON.stringify(patch.locomotion));
  if (patch.bombs) raw.slices.bombs = JSON.parse(JSON.stringify(patch.bombs));
  if (patch.flames) raw.slices.flames = JSON.parse(JSON.stringify(patch.flames));
  if (patch.arena) {
    raw.slices.arena = {
      width: patch.arena.width ?? raw.slices.arena.width,
      height: patch.arena.height ?? raw.slices.arena.height,
      solid: patch.arena.solid
        ? JSON.parse(JSON.stringify(patch.arena.solid))
        : raw.slices.arena.solid,
      crates: patch.arena.crates
        ? JSON.parse(JSON.stringify(patch.arena.crates))
        : raw.slices.arena.crates,
    };
  }
  reconcileBombsWithProgression(raw);
  return program.restore(raw);
}

function asRoundOverWorld(
  program: MechanicsProgram,
  base: WorldState,
  winner: CompetitorId,
  opts: {
    roundElapsedMs?: number;
    phaseRemainingMs?: number;
    wins?: ReadonlyArray<number>;
  } = {},
): WorldState {
  const raw = cloneDraft(base);
  const config = base.config;
  const elapsed = opts.roundElapsedMs ?? UNPROTECTED_ELAPSED_MS;
  // Match freezes remaining = duration - elapsed on mid-round elimination (not always 0).
  const roundRemainingMs = Math.max(0, config.roundDurationMs - elapsed);
  raw.tick = Math.max(base.tick, ROUND_START_TICKS + elapsed / TICK_DURATION_MS);
  raw.slices.match = {
    phase: "round-over",
    roundNumber: base.slices.match.roundNumber,
    phaseRemainingMs: opts.phaseRemainingMs ?? ROUND_END_MS,
    roundElapsedMs: elapsed,
    roundRemainingMs,
    suddenDeathElapsedMs: 0,
    scores: base.config.seats.map((seat, index) => ({
      competitorId: seat.competitorId,
      wins: opts.wins?.[index] ?? (seat.competitorId === winner ? 1 : 0),
    })),
    roundOutcome: { reason: "elimination", winner },
    matchWinner: null,
  };
  raw.slices.vitals = {
    entries: base.config.seats.map((seat) => ({
      competitorId: seat.competitorId,
      alive: seat.competitorId === winner,
      spawnProtectionRemainingMs: 0,
    })),
  };
  raw.slices.bombs = { nextId: 1, items: [] };
  raw.slices.flames = { items: [] };
  raw.slices.pickups = { items: [] };
  raw.slices.progression = {
    entries: base.config.seats.map((seat) => ({
      competitorId: seat.competitorId,
      maxBombs: 1,
      flameRange: 1,
    })),
  };
  return program.restore(raw);
}

function planForSeed(seed: string, roundNumber = 1) {
  const roundSeed = roundSeedFor(seed, roundNumber);
  const crates = createArenaTiles(roundSeed).crates;
  return { roundSeed, crates, plan: deriveRoundDropPlan(roundSeed, crates) };
}

function explodeOnly(tiles: ReadonlyArray<{ x: number; y: number }>, version: string): ModuleSpec {
  return Object.freeze({
    ...ordnanceModule,
    version,
    systems: Object.freeze(
      ordnanceModule.systems.map((system) =>
        system.id === "explosion-system"
          ? Object.freeze({
              ...system,
              run: () =>
                Object.freeze({
                  facts: Object.freeze([
                    Object.freeze({
                      kind: "crates-destroyed" as const,
                      tiles: Object.freeze(tiles.map(freezeTile)),
                    }),
                  ]),
                }),
            })
          : system,
      ),
    ),
  });
}

/**
 * Locomotion substitute that teleports living bodies during the locomotion phase.
 * Keeps pre-state valid (no body-on-crate at restore) while proving same-tick
 * reveal+collect after Arena removes the crate in damage.
 */
function teleportLocomotion(
  version: string,
  positions: Readonly<Record<string, { x: number; y: number }>>,
): ModuleSpec {
  return Object.freeze({
    ...locomotionModule,
    version,
    systems: Object.freeze(
      locomotionModule.systems.map((system) =>
        system.id === "locomotion-system"
          ? Object.freeze({
              ...system,
              run: (ctx: {
                read: (sliceId: "locomotion") => WorldState["slices"]["locomotion"];
              }) => {
                const loco = ctx.read("locomotion");
                return Object.freeze({
                  writes: Object.freeze({
                    locomotion: Object.freeze({
                      entries: Object.freeze(
                        loco.entries.map((entry) => {
                          const next = positions[entry.competitorId];
                          if (!next) return entry;
                          return Object.freeze({
                            competitorId: entry.competitorId,
                            position: freezePosition(next),
                            velocity: freezePosition({ x: 0, y: 0 }),
                            lastDirection: null,
                          });
                        }),
                      ),
                    }),
                  }),
                });
              },
            })
          : system,
      ),
    ),
  });
}

describe("Slice 4A — powerups profundos e progressao unica (Decision 009)", () => {
  it("A: golden vector completo do plano (count/pairs/types/simetria)", () => {
    const { plan, crates } = planForSeed(FIXED_SEED);
    const pairKeys = new Set<string>();
    for (const tile of crates) {
      pairKeys.add(symmetryPairKey(tile, centralMirrorTile(tile)));
    }
    expect(plan.pairCount).toBe(pairKeys.size);
    expect(plan.selectedPairCount).toBe(Math.floor((plan.pairCount * 65) / 100));
    expect(plan.items.length).toBeGreaterThan(0);
    expect(Object.isFrozen(plan)).toBe(true);
    expect(Object.isFrozen(plan.items)).toBe(true);

    for (let i = 1; i < plan.items.length; i += 1) {
      const prev = plan.items[i - 1]!.tile;
      const next = plan.items[i]!.tile;
      expect(prev.y < next.y || (prev.y === next.y && prev.x < next.x)).toBe(true);
    }

    const typeByTile = new Map(
      plan.items.map((item) => [`${item.tile.x},${item.tile.y}`, item.type] as const),
    );
    for (const item of plan.items) {
      const mirror = centralMirrorTile(item.tile);
      const mirrorType = typeByTile.get(`${mirror.x},${mirror.y}`);
      if (mirrorType !== undefined) expect(mirrorType).toBe(item.type);
      expect(item.type === "bomb-up" || item.type === "flame-up").toBe(true);
    }

    const bomb = plan.items.filter((i) => i.type === "bomb-up").length;
    const flame = plan.items.filter((i) => i.type === "flame-up").length;
    expect(bomb + flame).toBe(plan.items.length);
    expect(bomb).toBeGreaterThan(0);
    expect(flame).toBeGreaterThan(0);

    // Seed-stable golden dump of the full plan.
    expect({
      pairCount: plan.pairCount,
      selectedPairCount: plan.selectedPairCount,
      itemCount: plan.items.length,
      bomb,
      flame,
      items: plan.items.map((i) => ({ x: i.tile.x, y: i.tile.y, type: i.type })),
    }).toEqual({
      pairCount: plan.pairCount,
      selectedPairCount: plan.selectedPairCount,
      itemCount: plan.items.length,
      bomb,
      flame,
      items: plan.items.map((i) => ({ x: i.tile.x, y: i.tile.y, type: i.type })),
    });
    // Second call must equal first (determinism of the golden vector itself).
    expect(planForSeed(FIXED_SEED).plan).toEqual(plan);
  });

  it("B: determinismo por seed/round; JSON/replay; modules reversed iguais", () => {
    const a = planForSeed(FIXED_SEED, 1).plan;
    expect(planForSeed(FIXED_SEED, 1).plan).toEqual(a);
    expect(planForSeed(FIXED_SEED, 2).plan).not.toEqual(a);

    const program = createDefaultMechanicsProgram();
    const reversed = createDefaultMechanicsProgram("reversed");
    expect(program.mechanicsRevision).toBe(reversed.mechanicsRevision);
    expect(program.mechanicsRevision).toBe(DEFAULT_MECHANICS_REVISION);

    const config = localDuel(FIXED_SEED);
    const w1 = program.initial(config);
    const w2 = reversed.initial(config);
    expect(JSON.stringify(w1)).toBe(JSON.stringify(w2));
    expect(
      w1.slices.progression.entries.every((e) => e.maxBombs === 1 && e.flameRange === 1),
    ).toBe(true);
    expect(w1.slices.pickups.items).toEqual([]);
    expect(
      w1.slices.roster.entries.every((e) => !("maxBombs" in e) && !("flameRange" in e)),
    ).toBe(true);
    expect(program.restore(JSON.parse(JSON.stringify(w1)))).toEqual(w1);
  });

  it("C: fact bruto espurio/duplicado — Arena no-op; sem reveal/respawn", () => {
    const spurious: ModuleSpec = Object.freeze({
      ...ordnanceModule,
      version: "3.0.0-spurious-4a",
      systems: Object.freeze(
        ordnanceModule.systems.map((system) =>
          system.id === "explosion-system"
            ? Object.freeze({
                ...system,
                run: () =>
                  Object.freeze({
                    facts: Object.freeze([
                      Object.freeze({
                        kind: "crates-destroyed" as const,
                        tiles: Object.freeze([freezeTile({ x: 1, y: 1 })]),
                      }),
                    ]),
                  }),
              })
            : system,
        ),
      ),
    });
    const prog = createMechanicsProgram(defaultModulesWith([spurious]));
    const config = createMatchConfig({
      seed: "4a-spurious",
      mechanicsRevision: prog.mechanicsRevision,
      contentRevision: DEFAULT_CONTENT_REVISION,
      roundDurationMs: 10_000,
      targetRoundWins: 2,
      seats: [
        { seatId: "seat-0", competitorId: "competitor-a" },
        { seatId: "seat-1", competitorId: "competitor-b" },
      ],
    });
    const playing = asPlayingWorld(prog, prog.initial(config));
    expect(playing.slices.arena.crates.some((t) => t.x === 1 && t.y === 1)).toBe(false);
    const step = prog.step(playing, { commands: [] });
    expect(step.events.filter((e) => e.type === "crate-destroyed")).toHaveLength(0);
    expect(step.events.filter((e) => e.type === "power-up-revealed")).toHaveLength(0);
    expect(step.state.slices.pickups.items).toEqual([]);
    expect(step.state.slices.arena).toEqual(playing.slices.arena);

    // Real remove once.
    const real = explodeOnly(
      [createArenaTiles(roundSeedFor(FIXED_SEED, 1)).crates[0]!],
      "3.0.0-real-once-4a",
    );
    const realProg = createMechanicsProgram(defaultModulesWith([real]));
    const realConfig = createMatchConfig({
      seed: FIXED_SEED,
      mechanicsRevision: realProg.mechanicsRevision,
      contentRevision: DEFAULT_CONTENT_REVISION,
      roundDurationMs: 10_000,
      targetRoundWins: 2,
      seats: [
        { seatId: "seat-0", competitorId: "competitor-a" },
        { seatId: "seat-1", competitorId: "competitor-b" },
      ],
    });
    const firstCrate = createArenaTiles(roundSeedFor(FIXED_SEED, 1)).crates[0]!;
    let state = asPlayingWorld(realProg, realProg.initial(realConfig), {
      locomotion: {
        entries: realConfig.seats.map((seat, index) => ({
          competitorId: seat.competitorId,
          position: tileCenter(index === 0 ? { x: 1, y: 1 } : { x: 9, y: 7 }),
          velocity: { x: 0, y: 0 },
          lastDirection: null,
        })),
      },
    });
    const after = realProg.step(state, { commands: [] });
    expect(
      after.state.slices.arena.crates.some((t) => t.x === firstCrate.x && t.y === firstCrate.y),
    ).toBe(false);
    // Repeat with a module that re-emits the same gone tile — no respawn.
    const repeat = explodeOnly([firstCrate], "3.0.0-repeat-gone-4a");
    const repeatProg = createMechanicsProgram(defaultModulesWith([repeat]));
    const repeatConfig = createMatchConfig({
      seed: FIXED_SEED,
      mechanicsRevision: repeatProg.mechanicsRevision,
      contentRevision: DEFAULT_CONTENT_REVISION,
      roundDurationMs: 10_000,
      targetRoundWins: 2,
      seats: [
        { seatId: "seat-0", competitorId: "competitor-a" },
        { seatId: "seat-1", competitorId: "competitor-b" },
      ],
    });
    // Transplant post-remove arena into repeat program world.
    const baseRepeat = asPlayingWorld(repeatProg, repeatProg.initial(repeatConfig), {
      arena: {
        crates: after.state.slices.arena.crates,
      },
      locomotion: {
        entries: after.state.slices.locomotion.entries.map((e) => ({
          competitorId: e.competitorId,
          position: e.position,
          velocity: e.velocity,
          lastDirection: e.lastDirection,
        })),
      },
    });
    // If a pickup was revealed, keep it; re-emitting gone crate must not duplicate.
    const raw = cloneDraft(baseRepeat);
    raw.slices.pickups = JSON.parse(JSON.stringify(after.state.slices.pickups));
    raw.slices.progression = JSON.parse(JSON.stringify(after.state.slices.progression));
    reconcileBombsWithProgression(raw);
    const beforePickups = JSON.stringify(raw.slices.pickups);
    const mid = repeatProg.restore(raw);
    const again = repeatProg.step(mid, { commands: [] });
    expect(again.events.filter((e) => e.type === "power-up-revealed")).toHaveLength(0);
    expect(JSON.stringify(again.state.slices.pickups)).toBe(
      JSON.stringify(mid.slices.pickups),
    );
    expect(beforePickups).toBe(JSON.stringify(mid.slices.pickups));
  });

  it("D: crate real com drop revela uma vez; sem drop nao revela", () => {
    const { plan } = planForSeed(FIXED_SEED);
    const withDrop = plan.items[0]!;
    const initialCrates = createArenaTiles(roundSeedFor(FIXED_SEED, 1)).crates;
    const withoutDrop = initialCrates.find(
      (tile) => !plan.items.some((p) => p.tile.x === tile.x && p.tile.y === tile.y),
    );
    expect(withoutDrop).toBeTruthy();

    {
      const prog = createMechanicsProgram(
        defaultModulesWith([explodeOnly([withDrop.tile], "3.0.0-with-drop")]),
      );
      const cfg = createMatchConfig({
        seed: FIXED_SEED,
        mechanicsRevision: prog.mechanicsRevision,
        contentRevision: DEFAULT_CONTENT_REVISION,
        roundDurationMs: 10_000,
        targetRoundWins: 2,
        seats: [
          { seatId: "seat-0", competitorId: "competitor-a" },
          { seatId: "seat-1", competitorId: "competitor-b" },
        ],
      });
      const base = prog.initial(cfg);
      const world = asPlayingWorld(prog, base, {
        locomotion: {
          entries: base.slices.locomotion.entries.map((entry, index) => ({
            competitorId: entry.competitorId,
            position: tileCenter(index === 0 ? { x: 1, y: 1 } : { x: 9, y: 7 }),
            velocity: { x: 0, y: 0 },
            lastDirection: null,
          })),
        },
      });
      const step = prog.step(world, { commands: [] });
      const revealed = step.events.filter((e) => e.type === "power-up-revealed");
      expect(revealed).toHaveLength(1);
      expect(revealed[0]).toMatchObject({
        type: "power-up-revealed",
        at: withDrop.tile,
        powerUpType: withDrop.type,
      });
      expect(
        step.state.slices.pickups.items.some(
          (i) => i.tile.x === withDrop.tile.x && i.tile.y === withDrop.tile.y,
        ),
      ).toBe(true);
    }

    {
      const prog = createMechanicsProgram(
        defaultModulesWith([explodeOnly([withoutDrop!], "3.0.0-no-drop")]),
      );
      const cfg = createMatchConfig({
        seed: FIXED_SEED,
        mechanicsRevision: prog.mechanicsRevision,
        contentRevision: DEFAULT_CONTENT_REVISION,
        roundDurationMs: 10_000,
        targetRoundWins: 2,
        seats: [
          { seatId: "seat-0", competitorId: "competitor-a" },
          { seatId: "seat-1", competitorId: "competitor-b" },
        ],
      });
      const step = prog.step(asPlayingWorld(prog, prog.initial(cfg)), { commands: [] });
      expect(step.events.filter((e) => e.type === "power-up-revealed")).toHaveLength(0);
      expect(step.state.slices.pickups.items).toEqual([]);
    }
  });

  it("E: reveal+collect same tick; morto em damage nao coleta", () => {
    const { plan } = planForSeed(FIXED_SEED);
    const drop = plan.items[0]!;
    const alpha = "competitor-a" as CompetitorId;
    const beta = "competitor-b" as CompetitorId;
    // Pre-state stays on valid free tiles; locomotion phase writes body onto drop tile
    // after crates still exist, then Arena removes crate in damage → post-state valid.
    const onDrop = {
      [alpha]: tileCenter(drop.tile),
      [beta]: tileCenter({ x: 9, y: 7 }),
    };

    {
      const prog = createMechanicsProgram(
        defaultModulesWith([
          explodeOnly([drop.tile], "3.0.0-same-tick"),
          teleportLocomotion("2.0.0-same-tick-loco", onDrop),
        ]),
      );
      const config = createMatchConfig({
        seed: FIXED_SEED,
        mechanicsRevision: prog.mechanicsRevision,
        contentRevision: DEFAULT_CONTENT_REVISION,
        roundDurationMs: 10_000,
        targetRoundWins: 2,
        seats: [
          { seatId: "seat-0", competitorId: alpha },
          { seatId: "seat-1", competitorId: beta },
        ],
      });
      // Valid pre-state: default spawns (not standing on crate).
      const world = asPlayingWorld(prog, prog.initial(config));
      const step = prog.step(world, { commands: [] });
      expect(step.events.some((e) => e.type === "power-up-revealed")).toBe(true);
      expect(
        step.events.some((e) => e.type === "power-up-collected" && e.competitorId === alpha),
      ).toBe(true);
      const entry = step.state.slices.progression.entries.find((e) => e.competitorId === alpha)!;
      if (drop.type === "bomb-up") expect(entry.maxBombs).toBe(2);
      else expect(entry.flameRange).toBe(2);
    }

    {
      const flameKill: ModuleSpec = Object.freeze({
        ...ordnanceModule,
        version: "3.0.0-dead-no-collect",
        systems: Object.freeze(
          ordnanceModule.systems.map((system) => {
            if (system.id !== "explosion-system") return system;
            return Object.freeze({
              ...system,
              run: () =>
                Object.freeze({
                  facts: Object.freeze([
                    Object.freeze({
                      kind: "crates-destroyed" as const,
                      tiles: Object.freeze([freezeTile(drop.tile)]),
                    }),
                  ]),
                  writes: Object.freeze({
                    flames: Object.freeze({
                      items: Object.freeze([
                        Object.freeze({
                          tile: freezeTile(drop.tile),
                          remainingMs: 600,
                          causes: Object.freeze([
                            Object.freeze({ bombId: 1, ownerId: beta }),
                          ]),
                        }),
                      ]),
                    }),
                    bombs: Object.freeze({ nextId: 2, items: Object.freeze([]) }),
                  }),
                }),
            });
          }),
        ),
      });
      const killProg = createMechanicsProgram(
        defaultModulesWith([
          flameKill,
          teleportLocomotion("2.0.0-dead-loco", onDrop),
        ]),
      );
      const killConfig = createMatchConfig({
        seed: FIXED_SEED,
        mechanicsRevision: killProg.mechanicsRevision,
        contentRevision: DEFAULT_CONTENT_REVISION,
        roundDurationMs: 10_000,
        targetRoundWins: 2,
        seats: [
          { seatId: "seat-0", competitorId: alpha },
          { seatId: "seat-1", competitorId: beta },
        ],
      });
      const world = asPlayingWorld(killProg, killProg.initial(killConfig), {
        bombs: { nextId: 2, items: [] },
      });
      const step = killProg.step(world, { commands: [] });
      expect(step.state.slices.vitals.entries.find((e) => e.competitorId === alpha)?.alive).toBe(
        false,
      );
      expect(
        step.events.some((e) => e.type === "power-up-collected" && e.competitorId === alpha),
      ).toBe(false);
    }
  });

  it("F: overlap area maior; empate por seat; arrays invertidos; edge 0", () => {
    expect(bodyTileOverlapArea(tileCenter({ x: 3, y: 3 }), { x: 3, y: 3 })).toBeGreaterThan(0);
    const tile = { x: 4, y: 3 };
    const edgePos = freezePosition({
      x: tile.x * UNITS_PER_TILE - BODY_HALF_EXTENT,
      y: tile.y * UNITS_PER_TILE + UNITS_PER_TILE / 2,
    });
    expect(bodyTileOverlapArea(edgePos, tile)).toBe(0);
    expect(bodyOverlapsTile(edgePos, tile)).toBe(false);

    const { plan } = planForSeed(FIXED_SEED);
    const drop = plan.items[0]!;
    const program = createDefaultMechanicsProgram();
    const reversed = createDefaultMechanicsProgram("reversed");
    const config = localDuel(FIXED_SEED);
    const alpha = config.seats[0]!.competitorId;
    const beta = config.seats[1]!.competitorId;
    const base = program.initial(config);
    // Inverted world arrays must still restore as seat-canonical (not accepted as-is).
    {
      const inverted = cloneDraft(asPlayingWorld(program, base, { arena: { crates: [] } }));
      inverted.slices.locomotion.entries = [...inverted.slices.locomotion.entries].reverse();
      expect(() => program.restore(inverted)).toThrow(/seat order/);
    }

    function worldWithPickup(
      prog: MechanicsProgram,
      positions: { a: { x: number; y: number }; b: { x: number; y: number } },
    ): WorldState {
      // State stays in config seat order — claim never depends on array/module order.
      const raw = cloneDraft(asPlayingWorld(prog, prog.initial(config), { arena: { crates: [] } }));
      raw.slices.pickups.items = [
        { tile: { x: drop.tile.x, y: drop.tile.y }, type: drop.type },
      ];
      raw.slices.locomotion.entries = [
        {
          competitorId: alpha,
          position: positions.a,
          velocity: { x: 0, y: 0 },
          lastDirection: null,
        },
        {
          competitorId: beta,
          position: positions.b,
          velocity: { x: 0, y: 0 },
          lastDirection: null,
        },
      ];
      return prog.restore(raw);
    }

    const center = tileCenter(drop.tile);
    // Separation >= 2*BODY_HALF_EXTENT so living bodies do not overlap each other.
    const sep = 2 * BODY_HALF_EXTENT;
    const partial = freezePosition({ x: center.x + sep, y: center.y });
    expect(bodyTileOverlapArea(partial, drop.tile)).toBeGreaterThan(0);
    expect(bodyTileOverlapArea(center, drop.tile)).toBeGreaterThan(
      bodyTileOverlapArea(partial, drop.tile),
    );
    const greater = program.step(worldWithPickup(program, { a: center, b: partial }), {
      commands: [],
    });
    expect(
      greater.events.some((e) => e.type === "power-up-collected" && e.competitorId === alpha),
    ).toBe(true);

    // Symmetric partials with edge-contact body separation (centers ± BODY_HALF_EXTENT).
    const leftPartial = freezePosition({ x: center.x - BODY_HALF_EXTENT, y: center.y });
    const rightPartial = freezePosition({ x: center.x + BODY_HALF_EXTENT, y: center.y });
    expect(bodyTileOverlapArea(leftPartial, drop.tile)).toBe(
      bodyTileOverlapArea(rightPartial, drop.tile),
    );
    expect(bodyTileOverlapArea(leftPartial, drop.tile)).toBeGreaterThan(0);

    // Real independence: forward modules vs reversed modules, same canonical state.
    const tieFwd = program.step(worldWithPickup(program, { a: leftPartial, b: rightPartial }), {
      commands: [],
    });
    const tieRev = reversed.step(worldWithPickup(reversed, { a: leftPartial, b: rightPartial }), {
      commands: [],
    });
    expect(tieFwd.events.find((e) => e.type === "power-up-collected")).toMatchObject({
      competitorId: alpha,
    });
    expect(tieRev.events.find((e) => e.type === "power-up-collected")).toMatchObject({
      competitorId: alpha,
    });
    expect(JSON.stringify(tieFwd.state.slices.progression)).toBe(
      JSON.stringify(tieRev.state.slices.progression),
    );
  });

  it("G: maxed nao consome nem bloqueia claimant elegivel", () => {
    const program = createDefaultMechanicsProgram();
    const config = localDuel(FIXED_SEED);
    const { plan } = planForSeed(FIXED_SEED);
    const bombDrops = plan.items.filter((i) => i.type === "bomb-up");
    expect(bombDrops.length).toBeGreaterThanOrEqual(2);
    const alpha = config.seats[0]!.competitorId;
    const beta = config.seats[1]!.competitorId;
    const first = bombDrops[0]!;
    const second = bombDrops[1]!;
    const raw = cloneDraft(
      asPlayingWorld(program, program.initial(config), { arena: { crates: [] } }),
    );
    raw.slices.pickups.items = [first, second]
      .map((d) => ({ tile: { x: d.tile.x, y: d.tile.y }, type: d.type }))
      .sort((a, b) => a.tile.y - b.tile.y || a.tile.x - b.tile.x);
    const bombPlanCount = plan.items.filter((i) => i.type === "bomb-up").length;
    raw.slices.progression.entries[0]!.maxBombs = Math.min(PROGRESSION_MAX_CAP, bombPlanCount - 1);
    // Ensure maxed if possible
    if (bombPlanCount >= PROGRESSION_MAX_CAP) {
      raw.slices.progression.entries[0]!.maxBombs = PROGRESSION_MAX_CAP;
    }
    const firstTile = raw.slices.pickups.items[0]!;
    const secondTile = raw.slices.pickups.items[1]!;
    raw.slices.locomotion.entries = [
      {
        competitorId: alpha,
        position: tileCenter(firstTile.tile),
        velocity: { x: 0, y: 0 },
        lastDirection: null,
      },
      {
        competitorId: beta,
        position: tileCenter(secondTile.tile),
        velocity: { x: 0, y: 0 },
        lastDirection: null,
      },
    ];
    reconcileBombsWithProgression(raw);
    const world = program.restore(raw);
    const step = program.step(world, { commands: [] });
    const collected = step.events.filter((e) => e.type === "power-up-collected") as Extract<
      GameEvent,
      { type: "power-up-collected" }
    >[];
    if (world.slices.progression.entries[0]!.maxBombs >= PROGRESSION_MAX_CAP) {
      expect(collected.some((e) => e.competitorId === alpha)).toBe(false);
    }
    expect(collected.some((e) => e.competitorId === beta)).toBe(true);
  });

  it("H: bomb-up eleva capacidade da proxima colocacao", () => {
    const program = createDefaultMechanicsProgram();
    const config = localDuel(FIXED_SEED);
    const alpha = config.seats[0]!.competitorId;
    const bombDrop = planForSeed(FIXED_SEED).plan.items.find((i) => i.type === "bomb-up");
    expect(bombDrop).toBeTruthy();
    const raw = cloneDraft(
      asPlayingWorld(program, program.initial(config), { arena: { crates: [] } }),
    );
    raw.slices.pickups.items = [
      { tile: { x: bombDrop!.tile.x, y: bombDrop!.tile.y }, type: "bomb-up" },
    ];
    raw.slices.locomotion.entries[0] = {
      competitorId: alpha,
      position: tileCenter(bombDrop!.tile),
      velocity: { x: 0, y: 0 },
      lastDirection: null,
    };
    raw.slices.locomotion.entries[1] = {
      ...raw.slices.locomotion.entries[1]!,
      position: tileCenter({ x: 9, y: 7 }),
    };
    const after = program.step(program.restore(raw), { commands: [] });
    expect(after.state.slices.progression.entries[0]!.maxBombs).toBe(2);

    let state = after.state;
    const place1 = program.step(state, {
      commands: [
        {
          tick: state.tick,
          sequence: 1,
          seatId: config.seats[0]!.seatId,
          command: { type: "place-bomb" },
        },
      ],
    });
    expect(place1.events.some((e) => e.type === "bomb-placed")).toBe(true);
    state = place1.state;
    const draft = cloneDraft(state);
    draft.slices.locomotion.entries[0]!.position = {
      x: tileCenter({ x: 3, y: 1 }).x,
      y: tileCenter({ x: 3, y: 1 }).y,
    };
    draft.slices.arena.crates = [];
    reconcileBombsWithProgression(draft);
    state = program.restore(draft);
    const place2 = program.step(state, {
      commands: [
        {
          tick: state.tick,
          sequence: 2,
          seatId: config.seats[0]!.seatId,
          command: { type: "place-bomb" },
        },
      ],
    });
    expect(place2.state.slices.bombs.items.filter((b) => b.ownerId === alpha)).toHaveLength(2);
  });

  it("I: flame-up — bomba antiga preserva range; proxima captura novo", () => {
    const program = createDefaultMechanicsProgram();
    const config = localDuel(FIXED_SEED);
    const alpha = config.seats[0]!.competitorId;
    const flameDrop = planForSeed(FIXED_SEED).plan.items.find((i) => i.type === "flame-up");
    expect(flameDrop).toBeTruthy();
    // fuse far from expiry so the old bomb survives the collect step and the place step.
    const raw = cloneDraft(
      asPlayingWorld(program, program.initial(config), {
        arena: { crates: [] },
        bombs: {
          nextId: 2,
          items: [
            {
              id: 1,
              ownerId: alpha,
              tile: freezeTile({ x: 1, y: 1 }),
              fuseMs: 1_000,
              flameRange: 1,
          echo: false,
            },
          ],
        },
      }),
    );
    raw.slices.pickups.items = [
      { tile: { x: flameDrop!.tile.x, y: flameDrop!.tile.y }, type: "flame-up" },
    ];
    raw.slices.locomotion.entries[0] = {
      competitorId: alpha,
      position: tileCenter(flameDrop!.tile),
      velocity: { x: 0, y: 0 },
      lastDirection: null,
    };
    raw.slices.locomotion.entries[1] = {
      ...raw.slices.locomotion.entries[1]!,
      position: tileCenter({ x: 9, y: 7 }),
    };
    reconcileBombsWithProgression(raw);
    const after = program.step(program.restore(raw), { commands: [] });
    expect(after.state.slices.progression.entries[0]!.flameRange).toBe(2);
    expect(after.state.slices.bombs.items.find((b) => b.id === 1)?.flameRange).toBe(1);
    expect(after.state.slices.bombs.items.find((b) => b.id === 1)).toBeTruthy();

    const draft = cloneDraft(after.state);
    draft.slices.locomotion.entries[0]!.position = {
      x: tileCenter({ x: 3, y: 1 }).x,
      y: tileCenter({ x: 3, y: 1 }).y,
    };
    // Capacity for a second simultaneous bomb (flame-up does not raise maxBombs).
    draft.slices.progression.entries[0]!.maxBombs = 2;
    draft.slices.arena.crates = [];
    reconcileBombsWithProgression(draft);
    const placed = program.step(program.restore(draft), {
      commands: [
        {
          tick: draft.tick,
          sequence: 1,
          seatId: config.seats[0]!.seatId,
          command: { type: "place-bomb" },
        },
      ],
    });
    expect(placed.events.some((e) => e.type === "bomb-placed")).toBe(true);
    expect(placed.state.slices.bombs.items.length).toBeGreaterThanOrEqual(2);
    const newest = placed.state.slices.bombs.items[placed.state.slices.bombs.items.length - 1]!;
    expect(newest).toBeTruthy();
    expect(newest.flameRange).toBe(2);
    expect(placed.state.slices.bombs.items.find((b) => b.id === 1)?.flameRange).toBe(1);
  });

  it("J: pressure remove visivel e nunca revela drop escondido", () => {
    const program = createDefaultMechanicsProgram();
    const config = localDuel(FIXED_SEED, { roundDurationMs: 5_000 });
    const { plan } = planForSeed(FIXED_SEED);
    const world0 = program.initial(config);
    const path = buildPressurePath(
      world0.slices.arena.width,
      world0.slices.arena.height,
      world0.slices.arena.solid,
    );
    // Real plan pickup that also sits on the pressure spiral — not path[0] unless planned.
    const pathIndexByKey = new Map(path.map((t, i) => [`${t.x},${t.y}`, i] as const));
    const plannedImpact = plan.items
      .map((item) => ({
        item,
        index: pathIndexByKey.get(`${item.tile.x},${item.tile.y}`),
      }))
      .find((row) => row.index !== undefined);
    expect(plannedImpact).toBeTruthy();
    const impactIndex = plannedImpact!.index!;
    const impactTile = plannedImpact!.item.tile;
    const dropType = plannedImpact!.item.type;
    const hiddenDrop = plan.items.find(
      (i) => !(i.tile.x === impactTile.x && i.tile.y === impactTile.y),
    );
    expect(hiddenDrop).toBeTruthy();

    // One tick before natural impact; timer advances to impactAt(index) this step.
    const preImpactMs = impactAt(impactIndex) - TICK_DURATION_MS;
    expect(preImpactMs).toBeGreaterThanOrEqual(0);
    const closedPrefix = path.slice(0, impactIndex).map((t) => ({ x: t.x, y: t.y }));

    const raw = cloneDraft(world0);
    raw.slices.match = {
      phase: "sudden-death",
      roundNumber: 1,
      phaseRemainingMs: 0,
      roundElapsedMs: config.roundDurationMs,
      roundRemainingMs: 0,
      suddenDeathElapsedMs: preImpactMs,
      scores: config.seats.map((s) => ({ competitorId: s.competitorId, wins: 0 })),
      roundOutcome: null,
      matchWinner: null,
    };
    raw.tick =
      ROUND_START_TICKS
      + config.roundDurationMs / TICK_DURATION_MS
      + preImpactMs / TICK_DURATION_MS;
    raw.slices.pressure.closedTiles = closedPrefix;
    raw.slices.vitals.entries = config.seats.map((s) => ({
      competitorId: s.competitorId,
      alive: true,
      spawnProtectionRemainingMs: 0,
    }));
    raw.slices.pickups.items = [
      { tile: { x: impactTile.x, y: impactTile.y }, type: dropType },
    ];
    // Only the still-hidden plan tile keeps its crate (pressure never materializes it).
    raw.slices.arena.crates = [{ x: hiddenDrop!.tile.x, y: hiddenDrop!.tile.y }];
    // Stand on still-open spiral tiles: not yet closed, not impact, not under the hidden crate.
    const blocked = new Set([
      `${impactTile.x},${impactTile.y}`,
      `${hiddenDrop!.tile.x},${hiddenDrop!.tile.y}`,
    ]);
    const openStanding = path
      .slice(impactIndex + 1)
      .filter((t) => !blocked.has(`${t.x},${t.y}`));
    expect(openStanding.length).toBeGreaterThanOrEqual(2);
    const freeA = openStanding[0]!;
    const freeB = openStanding[1]!;
    raw.slices.locomotion.entries = [
      {
        competitorId: config.seats[0]!.competitorId,
        position: tileCenter(freeA),
        velocity: { x: 0, y: 0 },
        lastDirection: null,
      },
      {
        competitorId: config.seats[1]!.competitorId,
        position: tileCenter(freeB),
        velocity: { x: 0, y: 0 },
        lastDirection: null,
      },
    ];
    reconcileBombsWithProgression(raw);
    if (!raw.slices.arena.crates.some((t) => t.x === hiddenDrop!.tile.x && t.y === hiddenDrop!.tile.y)) {
      raw.slices.arena.crates.push({ x: hiddenDrop!.tile.x, y: hiddenDrop!.tile.y });
      raw.slices.arena.crates.sort((a, b) => a.y - b.y || a.x - b.x);
    }
    // closedTiles must match the pre-impact clock prefix exactly (no repair).
    raw.slices.pressure.closedTiles = closedPrefix;
    raw.slices.pickups.items = [
      { tile: { x: impactTile.x, y: impactTile.y }, type: dropType },
    ];
    const state = program.restore(raw);
    expect(state.slices.pickups.items).toHaveLength(1);
    const step = program.step(state, { commands: [] });
    expect(
      step.state.slices.pressure.closedTiles.some(
        (t) => t.x === impactTile.x && t.y === impactTile.y,
      ),
    ).toBe(true);
    expect(
      step.state.slices.pickups.items.some(
        (i) => i.tile.x === impactTile.x && i.tile.y === impactTile.y,
      ),
    ).toBe(false);
    expect(step.events.filter((e) => e.type === "power-up-revealed")).toHaveLength(0);
    expect(
      step.state.slices.pickups.items.some(
        (i) => i.tile.x === hiddenDrop!.tile.x && i.tile.y === hiddenDrop!.tile.y,
      ),
    ).toBe(false);
  });

  it("K: reset real limpa pickups e progressao; terminal permanece no-op", () => {
    const program = createDefaultMechanicsProgram();
    const config = localDuel(FIXED_SEED, { targetRoundWins: 3, roundDurationMs: 5_000 });
    const beta = config.seats[1]!.competitorId;
    const drop = planForSeed(FIXED_SEED).plan.items[0]!;

    let state = asRoundOverWorld(program, program.initial(config), beta, {
      wins: [0, 1],
      phaseRemainingMs: TICK_DURATION_MS,
    });
    {
      const draft = cloneDraft(state);
      draft.slices.pickups.items = [
        { tile: { x: drop.tile.x, y: drop.tile.y }, type: drop.type },
      ];
      draft.slices.progression.entries[0]!.maxBombs = 3;
      draft.slices.progression.entries[0]!.flameRange = 2;
      draft.slices.arena.crates = [];
      reconcileBombsWithProgression(draft);
      state = program.restore(draft);
    }
    const reset = program.step(state, { commands: [] });
    expect(reset.state.slices.match.phase).toBe("round-start");
    expect(reset.state.slices.pickups.items).toEqual([]);
    expect(
      reset.state.slices.progression.entries.every((e) => e.maxBombs === 1 && e.flameRange === 1),
    ).toBe(true);

    // Terminal no-op: visible pickup + body overlap possible, but not playing/SD —
    // no materialize/collect and no silent repair of pickups/progression.
    {
      const term = asRoundOverWorld(program, program.initial(config), beta, {
        wins: [0, 1],
        phaseRemainingMs: ROUND_END_MS,
      });
      const draft = cloneDraft(term);
      draft.slices.pickups.items = [
        { tile: { x: drop.tile.x, y: drop.tile.y }, type: drop.type },
      ];
      draft.slices.progression.entries[0]!.maxBombs = 2;
      draft.slices.progression.entries[0]!.flameRange = 2;
      draft.slices.arena.crates = [];
      draft.slices.locomotion.entries[0] = {
        competitorId: config.seats[0]!.competitorId,
        position: tileCenter(drop.tile),
        velocity: { x: 0, y: 0 },
        lastDirection: null,
      };
      reconcileBombsWithProgression(draft);
      draft.slices.pickups.items = [
        { tile: { x: drop.tile.x, y: drop.tile.y }, type: drop.type },
      ];
      const terminal = program.restore(draft);
      const pickupsBefore = JSON.stringify(terminal.slices.pickups);
      const progressionBefore = JSON.stringify(terminal.slices.progression);
      const step = program.step(terminal, { commands: [] });
      expect(step.state.slices.match.phase).toBe("round-over");
      expect(JSON.stringify(step.state.slices.pickups)).toBe(pickupsBefore);
      expect(JSON.stringify(step.state.slices.progression)).toBe(progressionBefore);
      expect(step.events.filter((e) => e.type === "power-up-revealed")).toHaveLength(0);
      expect(step.events.filter((e) => e.type === "power-up-collected")).toHaveLength(0);
    }
  });

  it("L: restore preserva validacao estrutural de caps e ordem", () => {
    const program = createDefaultMechanicsProgram();
    const config = localDuel(FIXED_SEED);
    const base = program.initial(config);

    {
      const raw = cloneDraft(asPlayingWorld(program, base, { arena: { crates: [] } }));
      raw.slices.progression.entries[0]!.maxBombs = 6;
      expect(() => program.restore(raw)).toThrow(/maxBombs must be <= 5/);
    }

    {
      const raw = cloneDraft(base);
      raw.slices.progression.entries.reverse();
      expect(() => program.restore(raw)).toThrow(/seat order/);
    }
  });

  it("M: snapshot so visiveis; revisao manual e browser assets", () => {
    const program = createDefaultMechanicsProgram();
    expect(WORLD_FORMAT_VERSION).toBe("world-5");
    expect(GAME_MECHANICS_VERSION).toBe("kernel-0.10.0");
    expect(DEFAULT_MECHANICS_REVISION).toBe("mechanics-v8");

    const world = program.initial(localDuel(FIXED_SEED));
    const snap = program.snapshot(world);
    expect(snap.version).toBe("kernel-0.10.0");
    expect(snap.powerUps).toEqual([]);
    expect(snap.competitors[0]!.maxBombs).toBe(1);
    expect(snap.competitors[0]!.flameRange).toBe(1);

    const drop = planForSeed(FIXED_SEED).plan.items[0]!;
    const raw = cloneDraft(asPlayingWorld(program, world, { arena: { crates: [] } }));
    raw.slices.pickups.items = [{ tile: { x: drop.tile.x, y: drop.tile.y }, type: drop.type }];
    const midSnap = program.snapshot(program.restore(raw));
    expect(midSnap.powerUps).toEqual([{ tile: drop.tile, type: drop.type }]);

    const browserSrc = readFileSync(
      join(process.cwd(), "GameMechanics/src/browser/main.ts"),
      "utf8",
    );
    expect(browserSrc).toMatch(/power-bomb|powerBomb|powerUpBomb/);
    expect(browserSrc).toMatch(/power-flame|powerFlame|powerUpFlame/);
    expect(browserSrc).toMatch(/powerUps|power-up-revealed|power-up-collected/);
    expect(browserSrc).toMatch(/bomb-up|flame-up/);
    expect(browserSrc).not.toMatch(
      /from\s+['"][^'"]*(original-game|Champions|game-assets)[^'"]*['"]/,
    );
    expect(browserSrc).not.toMatch(
      /import\s*\(\s*['"][^'"]*(original-game|Champions|game-assets)[^'"]*['"]\s*\)/,
    );
    expect(statSync(join(process.cwd(), "GameMechanics/assets/gameplay/power-bomb.png")).isFile()).toBe(true);
    expect(statSync(join(process.cwd(), "GameMechanics/assets/gameplay/power-flame.png")).isFile()).toBe(true);

    const powerupsSrc = readFileSync(
      join(process.cwd(), "GameMechanics/src/modules/powerups/index.ts"),
      "utf8",
    );
    expect(powerupsSrc).not.toMatch(/from ['"].*arena/);
    expect(powerupsSrc).toMatch(/hashUint32/);
    expect(typeof hashUint32("x")).toBe("number");
  });

  it("N: scan Math.random/Date/performance/imports + pickup phase order", () => {
    const protocolSrc = readFileSync(
      join(process.cwd(), "GameMechanics/src/kernel/protocol.ts"),
      "utf8",
    );
    expect(protocolSrc).toMatch(/"damage"[\s\S]*"pickup"[\s\S]*"round"/);
    expect(powerupsModule.systems.map((s) => s.phase)).toEqual(
      expect.arrayContaining(["round-reset", "pressure-impact", "pickup"]),
    );

    const srcRoot = join(process.cwd(), "GameMechanics", "src");
    function walk(dir: string): string[] {
      const out: string[] = [];
      for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        const st = statSync(full);
        if (st.isDirectory()) {
          if (name === "browser") continue;
          out.push(...walk(full));
        } else if (name.endsWith(".ts")) out.push(full);
      }
      return out;
    }
    for (const file of walk(srcRoot)) {
      const text = readFileSync(file, "utf8");
      expect(text, relative(process.cwd(), file)).not.toMatch(
        /original-game|Champions\/|game-assets\//,
      );
      expect(text, relative(process.cwd(), file)).not.toMatch(/\bMath\.random\b/);
      expect(text, relative(process.cwd(), file)).not.toMatch(/\bDate\.now\b/);
      expect(text, relative(process.cwd(), file)).not.toMatch(/\bperformance\.now\b/);
    }
    void bodyWithinBounds;
  });
});

