import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import {
  GAME_MECHANICS_VERSION,
  ROUND_END_MS,
  ROUND_START_MS,
  SPAWN_PROTECTION_MS,
  TICK_DURATION_MS,
  RANNI_ICE_BLINK_SKILL_ID,
  ZED_LIVING_SHADOW_SKILL_ID,
  type CompetitorId,
  type Direction,
  type GameCommand,
  type GameEvent,
  type GameSnapshot,
  type MatchConfig,
  type SeatId,
} from "../src/contracts.ts";
import {
  ZED_CHANNEL_MS,
  ZED_COOLDOWN_MS,
  ZED_FAIL_COOLDOWN_MS,
  ZED_SHADOW_RANGE,
} from "../src/modules/skills/index.ts";
import { createGameMechanics, MAX_ADVANCE_MS } from "../src/game-mechanics.ts";
import {
  createFourSeatMatchConfig,
  createLocalDuel1v1MatchConfig,
  createMatchConfig,
  DEFAULT_CONTENT_REVISION,
  DEFAULT_MECHANICS_REVISION,
  DEFAULT_TARGET_ROUND_WINS,
  MAX_ROUND_DURATION_MS,
  MIN_ROUND_DURATION_MS,
  roundSeedFor,
} from "../src/match-config.ts";
import {
  createDefaultMechanicsProgram,
  createDefaultModules,
  createMechanicsProgram,
} from "../src/composition.ts";
import {
  compileMechanics,
  MechanicsCompileError,
  type ModuleCodecs,
  type ModuleSpec,
  type SystemSpec,
} from "../src/kernel/protocol.ts";
import type { MechanicsProgram } from "../src/kernel/program.ts";
import {
  BASE_SPEED_UNITS_PER_TICK,
  BODY_HALF_EXTENT,
  BOMB_FUSE_MS,
  bodiesOverlap,
  bodyOverlapsTile,
  bodyTileOverlapArea,
  centralMirrorTile,
  countActiveBombs,
  createArenaTiles,
  freezePosition,
  freezeTile,
  freezeVelocity,
  findLocomotion,
  findVitals,
  hashUint32,
  LANE_ASSIST_MAX_OFFSET,
  LANE_CORRECTION_MAX,
  LANE_LONGITUDINAL_LOCK,
  PROGRESSION_BASE_FLAME_RANGE,
  PROGRESSION_BASE_MAX_BOMBS,
  PROGRESSION_MAX_CAP,
  symmetryPairKey,
  tileCenter,
  tileOf,
  UNITS_PER_TILE,
  WORLD_FORMAT_VERSION,
  type LocomotionEntry,
  type WorldPosition,
  type WorldState,
} from "../src/kernel/world-state.ts";
import {
  arenaModule,
  competitorsModule,
  intentModule,
  locomotionModule,
  matchModule,
  ordnanceModule,
  powerupsModule,
  pressureModule,
  skillsModule,
} from "../src/modules/index.ts";
import {
  buildPressurePath,
  derivePressureProgress,
  PRESSURE_FALL_MS,
  PRESSURE_INTERVAL_MS,
  impactAt,
  warningAt,
} from "../src/modules/pressure/index.ts";
import { deriveRoundDropPlan } from "../src/modules/powerups/index.ts";
import {
  resolveMovementBatch,
  type MovementCandidate,
} from "../src/modules/locomotion/index.ts";

// Compile-time proof: branded SeatId is not assignable to CompetitorId.
type AssertDistinctIds<A, B> = A extends B ? (B extends A ? never : true) : true;
const _seatIdNotCompetitorId: AssertDistinctIds<SeatId, CompetitorId> = true;
void _seatIdNotCompetitorId;

function competitor(game: ReturnType<typeof createGameMechanics>, id: CompetitorId) {
  const snapshot = game.snapshot();
  const found = snapshot.competitors.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`Missing competitor ${id}`);
  return found;
}

function localDuel(seed = "contract-seed", extras: { roundDurationMs?: number; targetRoundWins?: number } = {}) {
  return createLocalDuel1v1MatchConfig({ seed, ...extras });
}

function ranniDuel(seed = "ranni-skill"): MatchConfig {
  const base = localDuel(seed);
  return createMatchConfig({
    ...base,
    seats: base.seats.map((seat, index) => ({
      seatId: seat.seatId,
      competitorId: seat.competitorId,
      ...(index === 0 ? { skillId: RANNI_ICE_BLINK_SKILL_ID } : {}),
    })),
  });
}

function zedDuel(seed = "zed-skill"): MatchConfig {
  const base = localDuel(seed);
  return createMatchConfig({
    ...base,
    seats: base.seats.map((seat, index) => ({
      seatId: seat.seatId,
      competitorId: seat.competitorId,
      ...(index === 0 ? { skillId: ZED_LIVING_SHADOW_SKILL_ID } : {}),
    })),
  });
}

const ROUND_START_TICKS = ROUND_START_MS / TICK_DURATION_MS;
const SPAWN_PROTECTION_TICKS = SPAWN_PROTECTION_MS / TICK_DURATION_MS;
const ROUND_END_TICKS = ROUND_END_MS / TICK_DURATION_MS;

/** Advance N empty ticks. */
function stepN(program: MechanicsProgram, state: WorldState, ticks: number): WorldState {
  let current = state;
  for (let i = 0; i < ticks; i += 1) {
    current = program.step(current, { commands: [] }).state;
  }
  return current;
}

/** Leave round-start and open playing (60 ticks). */
function enterPlaying(program: MechanicsProgram, state: WorldState): WorldState {
  const next = stepN(program, state, ROUND_START_TICKS);
  if (next.slices.match.phase !== "playing") {
    throw new Error(`expected playing after ${ROUND_START_TICKS} ticks, got ${next.slices.match.phase}`);
  }
  return next;
}

/** Playing with zero spawn protection (for bomb/elim contracts). */
function enterUnprotected(program: MechanicsProgram, state: WorldState): WorldState {
  const playing = enterPlaying(program, state);
  return stepN(program, playing, SPAWN_PROTECTION_TICKS);
}

/** Facade: drain round-start countdown. */
function facadeEnterPlaying(game: ReturnType<typeof createGameMechanics>): void {
  game.dispatch({ type: "advance", deltaMs: ROUND_START_MS });
}

/** Facade: countdown + full spawn protection. */
function facadeEnterUnprotected(game: ReturnType<typeof createGameMechanics>): void {
  game.dispatch({ type: "advance", deltaMs: ROUND_START_MS + SPAWN_PROTECTION_MS });
}

/**
 * Mutable JSON draft for restore fixtures. Never type this as WorldState —
 * WorldState is deeply readonly and cannot be patched before restore.
 */
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
    pressure: {
      closedTiles: Array<{ x: number; y: number }>;
    };
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
    skills: {
      entries: Array<{
        competitorId: string;
        skillId: string;
        phase: string;
        channelRemainingMs: number;
        cooldownRemainingMs: number;
        projection: { x: number; y: number } | null;
        bombEgressKeys: string[];
        aimDirection?: Direction | null;
      }>;
    };
  };
};

function cloneDraft(base: WorldState): MutableWorldDraft {
  return JSON.parse(JSON.stringify(base)) as MutableWorldDraft;
}

/** Keep crafted progression compatible with active bomb count and range. */
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
    if (item.type === "bomb-up" && released("bomb-up") < needBomb) {
      crateKeySet.delete(key);
    } else if (item.type === "flame-up" && released("flame-up") < needFlame) {
      crateKeySet.delete(key);
    }
  }
  raw.slices.arena.crates = raw.slices.arena.crates.filter((tile) =>
    crateKeySet.has(`${tile.x},${tile.y}`),
  );
}

/** Align persisted closedTiles with Match sudden-death clock (restore-legal). */
function applyPressureForElapsed(
  raw: MutableWorldDraft,
  suddenDeathElapsedMs: number,
): void {
  const path = buildPressurePath(
    raw.slices.arena.width,
    raw.slices.arena.height,
    raw.slices.arena.solid,
  );
  const progress = derivePressureProgress(path, suddenDeathElapsedMs);
  raw.slices.pressure = {
    closedTiles: progress.closedTiles.map((tile) => ({ x: tile.x, y: tile.y })),
  };
}

/** Derived spiral for the arena base solid (never persisted on pressure). */
function derivedPathOf(state: WorldState | MutableWorldDraft) {
  return buildPressurePath(
    state.slices.arena.width,
    state.slices.arena.height,
    state.slices.arena.solid,
  );
}

const SHORT_ROUND_MS = 5_000;
const CANONICAL_PRESSURE_PATH_75 = buildPressurePath(
  11,
  9,
  createArenaTiles("pressure-canonical").solid,
);

function locoAtPosition(
  competitorId: CompetitorId,
  position: WorldPosition,
): LocomotionEntry {
  return Object.freeze({
    competitorId,
    position,
    velocity: freezeVelocity({ x: 0, y: 0 }),
    lastDirection: null,
  });
}

function freeSdTiles(
  arena: Readonly<{
    solid: ReadonlyArray<Readonly<{ x: number; y: number }>>;
    crates: ReadonlyArray<Readonly<{ x: number; y: number }>>;
  }>,
  excluded: ReadonlyArray<Readonly<{ x: number; y: number }>> = [],
): Array<Readonly<{ x: number; y: number }>> {
  const blocked = new Set(
    [...arena.solid, ...arena.crates, ...excluded].map((tile) => `${tile.x},${tile.y}`),
  );
  const tiles: Array<Readonly<{ x: number; y: number }>> = [];
  for (let y = 1; y < 8; y += 1) {
    for (let x = 1; x < 10; x += 1) {
      if (!blocked.has(`${x},${y}`)) tiles.push(freezeTile({ x, y }));
    }
  }
  return tiles;
}

function asSuddenDeathWorld(
  program: MechanicsProgram,
  base: WorldState,
  suddenDeathElapsedMs: number,
  patch: {
    arena?: MutableWorldDraft["slices"]["arena"];
    locomotion?: MutableWorldDraft["slices"]["locomotion"];
    bombs?: MutableWorldDraft["slices"]["bombs"];
    flames?: MutableWorldDraft["slices"]["flames"];
    vitals?: MutableWorldDraft["slices"]["vitals"];
  } = {},
): WorldState {
  const raw = cloneDraft(base);
  raw.tick = ROUND_START_TICKS
    + raw.config.roundDurationMs / TICK_DURATION_MS
    + suddenDeathElapsedMs / TICK_DURATION_MS;
  raw.slices.match = {
    phase: "sudden-death",
    roundNumber: base.slices.match.roundNumber,
    phaseRemainingMs: 0,
    roundElapsedMs: raw.config.roundDurationMs,
    roundRemainingMs: 0,
    suddenDeathElapsedMs,
    scores: base.slices.match.scores.map((entry) => ({ ...entry })),
    roundOutcome: null,
    matchWinner: null,
  };
  raw.slices.vitals = patch.vitals ?? vitalsAliveFields(raw.config, 0);
  if (patch.arena) raw.slices.arena = JSON.parse(JSON.stringify(patch.arena));
  if (patch.locomotion) raw.slices.locomotion = JSON.parse(JSON.stringify(patch.locomotion));
  if (patch.bombs) raw.slices.bombs = JSON.parse(JSON.stringify(patch.bombs));
  if (patch.flames) raw.slices.flames = JSON.parse(JSON.stringify(patch.flames));
  applyPressureForElapsed(raw, suddenDeathElapsedMs);
  reconcileBombsWithProgression(raw);
  return program.restore(raw);
}

function enterSuddenDeath(program: MechanicsProgram, state: WorldState): WorldState {
  let current = state;
  const maxTicks = ROUND_START_TICKS + state.config.roundDurationMs / TICK_DURATION_MS + 1;
  for (let index = 0; index < maxTicks; index += 1) {
    if (current.slices.match.phase === "sudden-death") return current;
    current = program.step(current, { commands: [] }).state;
  }
  throw new Error("expected sudden-death transition");
}

/** All default modules except an optional replacement of one id. */
function defaultModulesWith(
  replacements: ReadonlyArray<ModuleSpec> = [],
): ModuleSpec[] {
  const byId = new Map(createDefaultModules().map((module) => [module.id, module]));
  for (const module of replacements) {
    byId.set(module.id, module);
  }
  return [...byId.values()];
}

/** Unprotected mid-round elapsed — exact formula expects protection 0. */
const UNPROTECTED_ELAPSED_MS = SPAWN_PROTECTION_MS;

/** Minimal legal MatchSlice fields for crafted mid-round playing worlds. */
function playingMatchFields(
  config: MatchConfig,
  overrides: Partial<MutableWorldDraft["slices"]["match"]> = {},
): MutableWorldDraft["slices"]["match"] {
  const elapsed = overrides.roundElapsedMs ?? UNPROTECTED_ELAPSED_MS;
  return {
    phase: "playing",
    roundNumber: 1,
    phaseRemainingMs: 0,
    roundElapsedMs: elapsed,
    roundRemainingMs: config.roundDurationMs - elapsed,
    suddenDeathElapsedMs: 0,
    scores: config.seats.map((seat) => ({ competitorId: seat.competitorId, wins: 0 })),
    roundOutcome: null,
    matchWinner: null,
    ...overrides,
  };
}

function vitalsAliveFields(config: MatchConfig, protectionMs = 0): MutableWorldDraft["slices"]["vitals"] {
  return {
    entries: config.seats.map((seat) => ({
      competitorId: seat.competitorId,
      alive: true,
      spawnProtectionRemainingMs: protectionMs,
    })),
  };
}

/**
 * Craft a steppable playing world from an initial/base snapshot.
 * Defaults to unprotected (roundElapsedMs >= SPAWN_PROTECTION_MS, protection 0)
 * so restore's exact protection formula accepts the fixture.
 */
function asPlayingWorld(
  program: MechanicsProgram,
  base: WorldState,
  patch: {
    locomotion?: WorldState["slices"]["locomotion"] | MutableWorldDraft["slices"]["locomotion"];
    bombs?: WorldState["slices"]["bombs"] | MutableWorldDraft["slices"]["bombs"];
    flames?: WorldState["slices"]["flames"] | MutableWorldDraft["slices"]["flames"];
    arena?: {
      width?: number;
      height?: number;
      solid?: ReadonlyArray<{ x: number; y: number }>;
      crates?: ReadonlyArray<{ x: number; y: number }>;
    };
    vitals?: WorldState["slices"]["vitals"] | MutableWorldDraft["slices"]["vitals"];
    match?: Partial<MutableWorldDraft["slices"]["match"]>;
    tick?: number;
  } = {},
): WorldState {
  const config = base.config;
  const raw = cloneDraft(base);
  const basePlayingElapsed =
    base.slices.match.phase === "playing" || base.slices.match.phase === "sudden-death"
      ? base.slices.match.roundElapsedMs
      : UNPROTECTED_ELAPSED_MS;
  const elapsed = patch.match?.roundElapsedMs ?? Math.max(basePlayingElapsed, UNPROTECTED_ELAPSED_MS);
  raw.tick = patch.tick
    ?? Math.max(base.tick, ROUND_START_TICKS + elapsed / TICK_DURATION_MS);
  raw.slices.match = playingMatchFields(config, {
    roundNumber: base.slices.match.roundNumber,
    roundElapsedMs: elapsed,
    roundRemainingMs: config.roundDurationMs - elapsed,
    scores: base.slices.match.scores.map((entry) => ({
      competitorId: entry.competitorId,
      wins: entry.wins,
    })),
    ...(patch.match ?? {}),
  });
  const matchElapsed = raw.slices.match.roundElapsedMs;
  const defaultProtection = Math.max(0, SPAWN_PROTECTION_MS - matchElapsed);
  raw.slices.vitals = patch.vitals
    ? (JSON.parse(JSON.stringify(patch.vitals)) as MutableWorldDraft["slices"]["vitals"])
    : vitalsAliveFields(config, defaultProtection);
  if (patch.locomotion) {
    raw.slices.locomotion = JSON.parse(JSON.stringify(patch.locomotion)) as MutableWorldDraft["slices"]["locomotion"];
  }
  if (patch.bombs) {
    raw.slices.bombs = JSON.parse(JSON.stringify(patch.bombs)) as MutableWorldDraft["slices"]["bombs"];
  }
  if (patch.flames) {
    raw.slices.flames = JSON.parse(JSON.stringify(patch.flames)) as MutableWorldDraft["slices"]["flames"];
  }
  if (patch.arena) {
    raw.slices.arena = {
      width: patch.arena.width ?? raw.slices.arena.width,
      height: patch.arena.height ?? raw.slices.arena.height,
      solid: patch.arena.solid
        ? (JSON.parse(JSON.stringify(patch.arena.solid)) as MutableWorldDraft["slices"]["arena"]["solid"])
        : raw.slices.arena.solid,
      crates: patch.arena.crates
        ? (JSON.parse(JSON.stringify(patch.arena.crates)) as MutableWorldDraft["slices"]["arena"]["crates"])
        : raw.slices.arena.crates,
    };
  }
  reconcileBombsWithProgression(raw);
  return program.restore(raw);
}

/** Craft legal round-over after mid-round elimination (interval not yet finished). */
function asRoundOverWorld(
  program: MechanicsProgram,
  base: WorldState,
  winner: CompetitorId,
  opts: {
    roundElapsedMs?: number;
    phaseRemainingMs?: number;
    wins?: ReadonlyArray<number>;
    tick?: number;
    roundNumber?: number;
    reason?: "elimination" | "double-ko";
  } = {},
): WorldState {
  const config = base.config;
  const raw = cloneDraft(base);
  const elapsed = opts.roundElapsedMs ?? Math.max(UNPROTECTED_ELAPSED_MS, TICK_DURATION_MS * 5);
  const wins = opts.wins
    ?? config.seats.map((seat) => (seat.competitorId === winner ? 1 : 0));
  const sum = wins.reduce((acc, value) => acc + value, 0);
  // Keep crafted round numbers coherent with their score totals.
  const reason = opts.reason ?? "elimination";
  const minRound =
    reason === "elimination" ? Math.max(1, sum) : Math.max(1, sum + 1);
  const roundNumber = opts.roundNumber ?? Math.max(base.slices.match.roundNumber, minRound);
  raw.tick = opts.tick ?? ROUND_START_TICKS + elapsed / TICK_DURATION_MS;
  raw.slices.match = {
    phase: "round-over",
    roundNumber,
    phaseRemainingMs: opts.phaseRemainingMs ?? ROUND_END_MS,
    roundElapsedMs: elapsed,
    roundRemainingMs: config.roundDurationMs - elapsed,
    suddenDeathElapsedMs: 0,
    scores: config.seats.map((seat, index) => ({
      competitorId: seat.competitorId,
      wins: wins[index] ?? 0,
    })),
    roundOutcome:
      reason === "double-ko"
        ? { reason: "double-ko", winner: null }
        : { reason: "elimination", winner },
    matchWinner: null,
  };
  raw.slices.vitals = {
    entries: config.seats.map((seat) => ({
      competitorId: seat.competitorId,
      alive: reason === "elimination" ? seat.competitorId === winner : false,
      spawnProtectionRemainingMs: 0,
    })),
  };
  raw.slices.bombs = { nextId: 1, items: [] };
  raw.slices.flames = { items: [] };
  raw.slices.intent = {
    entries: config.seats.map((seat) => ({
      competitorId: seat.competitorId,
      pressedDirections: [],
    })),
  };
  // Arena must match the current round seed (crates may be empty after play).
  const roundTiles = createArenaTiles(roundSeedFor(config.seed, roundNumber));
  raw.slices.arena = {
    width: roundTiles.solid.length > 0 ? 11 : 11,
    height: 9,
    solid: roundTiles.solid.map((tile) => ({ x: tile.x, y: tile.y })),
    crates: roundTiles.crates.map((tile) => ({ x: tile.x, y: tile.y })),
  };
  // Locomotion must stay legal for living bodies; reset dead velocity only.
  raw.slices.locomotion.entries = config.seats.map((seat, index) => {
    const spawn = index === 0
      ? { x: 1, y: 1 }
      : index === 1
        ? { x: 9, y: 7 }
        : index === 2
          ? { x: 9, y: 1 }
          : { x: 1, y: 7 };
    return {
      competitorId: seat.competitorId,
      position: tileCenter(spawn),
      velocity: { x: 0, y: 0 },
      lastDirection: null,
    };
  });
  return program.restore(raw);
}

function replay(
  config: MatchConfig,
  commands: readonly GameCommand[],
): { snapshot: GameSnapshot; events: GameEvent[] } {
  const game = createGameMechanics(config);
  const events: GameEvent[] = [];
  for (const command of commands) {
    events.push(...game.dispatch(command));
  }
  return { snapshot: game.snapshot(), events };
}

function baseValidInput(
  overrides: Partial<{
    seed: string;
    mechanicsRevision: string;
    contentRevision: string;
    roundDurationMs: number;
    targetRoundWins: number;
    seats: readonly Readonly<{ seatId: string; competitorId: string }>[];
  }> = {},
) {
  return {
    seed: "ok",
    mechanicsRevision: DEFAULT_MECHANICS_REVISION,
    contentRevision: "c1",
    roundDurationMs: 30_000,
    targetRoundWins: DEFAULT_TARGET_ROUND_WINS,
    seats: [
      { seatId: "s0", competitorId: "a" },
      { seatId: "s1", competitorId: "b" },
    ] as const,
    ...overrides,
  };
}

function findFreeArenaTile(
  state: WorldState,
  excluded: readonly Readonly<{ x: number; y: number }>[] = [],
): Readonly<{ x: number; y: number }> {
  const blocked = new Set([
    ...state.slices.arena.solid,
    ...state.slices.arena.crates,
    ...state.slices.locomotion.entries.map((entry) => tileOf(entry.position)),
    ...excluded,
  ].map((tile) => `${tile.x},${tile.y}`));
  for (let y = 1; y < state.slices.arena.height - 1; y += 1) {
    for (let x = 1; x < state.slices.arena.width - 1; x += 1) {
      if (!blocked.has(`${x},${y}`)) return freezeTile({ x, y });
    }
  }
  throw new Error("Test fixture requires a free arena tile.");
}

/** Locomotion fixture at tile center with zero velocity. */
function locoAt(
  competitorId: CompetitorId,
  tileX: number,
  tileY: number,
  extras: Partial<LocomotionEntry> = {},
): LocomotionEntry {
  return Object.freeze({
    competitorId,
    position: tileCenter({ x: tileX, y: tileY }),
    velocity: freezeVelocity({ x: 0, y: 0 }),
    lastDirection: null,
    ...extras,
  });
}

function posAt(tileX: number, tileY: number, dx = 0, dy = 0): WorldPosition {
  const center = tileCenter({ x: tileX, y: tileY });
  return freezePosition({ x: center.x + dx, y: center.y + dy });
}

function listSourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "browser") continue;
      listSourceFiles(full, acc);
    } else if (entry.endsWith(".ts")) {
      acc.push(full);
    }
  }
  return acc;
}

function noopSystem(id: string, phase: SystemSpec["phase"], writes: SystemSpec["writes"] = []): SystemSpec {
  return Object.freeze({
    id,
    phase,
    reads: Object.freeze([] as const),
    writes: Object.freeze(writes),
    run: () => ({}),
  });
}

/** Minimal stub codecs for adversarial compile fixtures that never run initial/restore. */
function stubCodecs(owns: readonly ModuleSpec["owns"][number][]): ModuleCodecs {
  return Object.freeze({
    initial() {
      throw new Error("stub codecs.initial should not run in this fixture");
    },
    restore() {
      throw new Error("stub codecs.restore should not run in this fixture");
    },
  });
}

describe("Slice 0 — identidade e MatchConfig", () => {
  it("aceita config de 2 assentos com IDs estaveis e snapshot de replay", () => {
    const config = createLocalDuel1v1MatchConfig({
      seed: "two-seat",
      competitorIds: ["alpha", "beta"],
    });
    const game = createGameMechanics(config);
    const snapshot = game.snapshot();
    const alpha = config.seats[0]!.competitorId;
    const beta = config.seats[1]!.competitorId;

    expect(snapshot.version).toBe(GAME_MECHANICS_VERSION);
    expect(snapshot.config).toEqual(config);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.config)).toBe(true);
    expect(Object.isFrozen(snapshot.config.seats)).toBe(true);
    expect(snapshot.competitors).toHaveLength(2);
    expect(snapshot.competitors.map((entry) => entry.id)).toEqual([alpha, beta]);
    expect(snapshot.competitors.map((entry) => entry.seatId)).toEqual(["seat-0", "seat-1"]);
    expect(snapshot.config.mechanicsRevision).toBe(DEFAULT_MECHANICS_REVISION);
    expect(snapshot.config.contentRevision).toBe(DEFAULT_CONTENT_REVISION);
    expect(competitor(game, alpha).tile).toEqual({ x: 1, y: 1 });
    expect(competitor(game, beta).tile).toEqual({ x: 9, y: 7 });
  });

  it("aceita config de 4 assentos com quatro spawns spawn-safe no snapshot", () => {
    const config = createFourSeatMatchConfig({
      seed: "four-seat",
      competitorIds: ["c1", "c2", "c3", "c4"],
    });
    const game = createGameMechanics(config);
    const snapshot = game.snapshot();

    expect(snapshot.competitors).toHaveLength(4);
    expect(snapshot.competitors.map((entry) => entry.id)).toEqual(["c1", "c2", "c3", "c4"]);
    expect(snapshot.competitors.map((entry) => entry.tile)).toEqual([
      { x: 1, y: 1 },
      { x: 9, y: 7 },
      { x: 9, y: 1 },
      { x: 1, y: 7 },
    ]);

    const blocked = new Set([
      ...snapshot.arena.solid.map(({ x, y }) => `${x},${y}`),
      ...snapshot.arena.crates.map(({ x, y }) => `${x},${y}`),
    ]);
    for (const entry of snapshot.competitors) {
      expect(blocked.has(`${entry.tile.x},${entry.tile.y}`)).toBe(false);
    }
  });

  it("rejeita config invalida sem normalizar silenciosamente", () => {
    expect(() => createMatchConfig({
      seed: "ok",
      mechanicsRevision: "m1",
      contentRevision: "c1",
      roundDurationMs: 30_000,
      seats: [{ seatId: "s0", competitorId: "a" }],
    })).toThrow(/between 2 and 4/);

    expect(() => createMatchConfig({
      seed: "ok",
      mechanicsRevision: "m1",
      contentRevision: "c1",
      roundDurationMs: 30_000,
      seats: [
        { seatId: "s0", competitorId: "a" },
        { seatId: "s1", competitorId: "b" },
        { seatId: "s2", competitorId: "c" },
        { seatId: "s3", competitorId: "d" },
        { seatId: "s4", competitorId: "e" },
      ],
    })).toThrow(/between 2 and 4/);

    expect(() => createMatchConfig({
      seed: "ok",
      mechanicsRevision: "",
      contentRevision: "c1",
      roundDurationMs: 30_000,
      seats: [
        { seatId: "s0", competitorId: "a" },
        { seatId: "s1", competitorId: "b" },
      ],
    })).toThrow(/mechanicsRevision/);

    expect(() => createMatchConfig({
      seed: "ok",
      mechanicsRevision: "m1",
      contentRevision: "   ",
      roundDurationMs: 30_000,
      seats: [
        { seatId: "s0", competitorId: "a" },
        { seatId: "s1", competitorId: "b" },
      ],
    })).toThrow(/contentRevision/);

    expect(() => createMatchConfig({
      seed: "ok",
      mechanicsRevision: "m1",
      contentRevision: "c1",
      roundDurationMs: 30_000,
      seats: [
        { seatId: "dup", competitorId: "a" },
        { seatId: "dup", competitorId: "b" },
      ],
    })).toThrow(/Duplicate seatId/);

    expect(() => createMatchConfig({
      seed: "ok",
      mechanicsRevision: "m1",
      contentRevision: "c1",
      roundDurationMs: 30_000,
      seats: [
        { seatId: "s0", competitorId: "same" },
        { seatId: "s1", competitorId: "same" },
      ],
    })).toThrow(/Duplicate competitorId/);
  });

  it("matriz adversarial: seed, duracao e IDs apos normalizacao", () => {
    expect(() => createMatchConfig(baseValidInput({ seed: "" }))).toThrow(/seed/);
    expect(() => createMatchConfig(baseValidInput({ seed: "   " }))).toThrow(/seed/);

    expect(() => createMatchConfig(baseValidInput({ roundDurationMs: 30_000.5 }))).toThrow(
      /finite integer/,
    );
    expect(() => createMatchConfig(baseValidInput({ roundDurationMs: Number.NaN }))).toThrow(
      /finite integer/,
    );
    expect(() => createMatchConfig(baseValidInput({
      roundDurationMs: MIN_ROUND_DURATION_MS - 1,
    }))).toThrow(/between/);
    expect(() => createMatchConfig(baseValidInput({
      roundDurationMs: MAX_ROUND_DURATION_MS + 1,
    }))).toThrow(/between/);

    expect(() => createMatchConfig(baseValidInput({
      seats: [
        { seatId: "   ", competitorId: "a" },
        { seatId: "s1", competitorId: "b" },
      ],
    }))).toThrow(/seatId/);

    expect(() => createMatchConfig(baseValidInput({
      seats: [
        { seatId: "s0", competitorId: "  " },
        { seatId: "s1", competitorId: "b" },
      ],
    }))).toThrow(/competitorId/);

    expect(() => createMatchConfig(baseValidInput({
      seats: [
        { seatId: "seat", competitorId: "competitor" },
        { seatId: " seat ", competitorId: " other " },
      ],
    }))).toThrow(/Duplicate seatId/);

    expect(() => createMatchConfig(baseValidInput({
      seats: [
        { seatId: "seat-a", competitorId: "competitor" },
        { seatId: "seat-b", competitorId: " competitor " },
      ],
    }))).toThrow(/Duplicate competitorId/);
  });

  it("createGameMechanics rejeita mechanicsRevision que nao executa", () => {
    const config = createMatchConfig(baseValidInput({
      mechanicsRevision: "mechanics-future-9.9.9",
      contentRevision: "c-any",
    }));
    expect(() => createGameMechanics(config)).toThrow(/not executable/);
  });

  it("caso adversarial: mutacao da config original nao altera a simulacao", () => {
    const seats = [
      { seatId: "s0", competitorId: "a" },
      { seatId: "s1", competitorId: "b" },
    ];
    const mutableInput = {
      seed: "adversarial",
      mechanicsRevision: DEFAULT_MECHANICS_REVISION,
      contentRevision: "c-adv",
      roundDurationMs: 60_000,
      seats,
    };
    const config = createMatchConfig(mutableInput);
    const game = createGameMechanics(config);

    mutableInput.seed = "poisoned";
    mutableInput.roundDurationMs = 1;
    seats[0]!.competitorId = "hijacked";
    seats.push({ seatId: "s2", competitorId: "c" });

    const snapshot = game.snapshot();
    expect(snapshot.config.seed).toBe("adversarial");
    expect(snapshot.config.roundDurationMs).toBe(60_000);
    expect(snapshot.competitors.map((entry) => entry.id)).toEqual(["a", "b"]);
    expect(snapshot.competitors).toHaveLength(2);

    const leaked = snapshot.config as { seed: string };
    expect(() => {
      leaked.seed = "mutated-snapshot";
    }).toThrow();
    expect(game.snapshot().config.seed).toBe("adversarial");
  });

  it("set-movement enfileira; revision sobe so no advance quando ha mudanca causal", () => {
    const config = localDuel("revision-causal");
    const alpha = config.seats[0]!.competitorId;
    const game = createGameMechanics(config);

    expect(game.snapshot().revision).toBe(0);

    // Queue only — no kernel transition yet.
    game.dispatch({ type: "set-movement", competitorId: alpha, direction: "right", pressed: true });
    expect(game.snapshot().revision).toBe(0);

    game.dispatch({ type: "advance", deltaMs: 20 });
    expect(game.snapshot().revision).toBe(1);

    // Duplicate press after already active: intent unchanged → still playing clock bump.
    game.dispatch({ type: "set-movement", competitorId: alpha, direction: "right", pressed: true });
    const revAfterHold = game.snapshot().revision;
    game.dispatch({ type: "advance", deltaMs: 20 });
    // Playing tick always changes match clock → stateRevision bumps once per playing tick.
    expect(game.snapshot().revision).toBe(revAfterHold + 1);
  });
});

describe("GameMechanics — regressao mecanica (2 competidores)", () => {
  it("cria uma arena deterministica, simetrica e com spawns seguros", () => {
    const first = createGameMechanics(localDuel("contract-seed")).snapshot();
    const second = createGameMechanics(localDuel("contract-seed")).snapshot();

    expect(first.arena).toEqual(second.arena);
    expect(first.config).toEqual(second.config);
    expect(first.arena).toMatchObject({ width: 11, height: 9 });
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.competitors)).toBe(true);

    const blocked = new Set([
      ...first.arena.solid.map(({ x, y }) => `${x},${y}`),
      ...first.arena.crates.map(({ x, y }) => `${x},${y}`),
    ]);
    expect(blocked.has("1,1")).toBe(false);
    expect(blocked.has("2,1")).toBe(false);
    expect(blocked.has("1,2")).toBe(false);
    expect(blocked.has("9,7")).toBe(false);
    expect(blocked.has("8,7")).toBe(false);
    expect(blocked.has("9,6")).toBe(false);

    const crateKeys = new Set(first.arena.crates.map(({ x, y }) => `${x},${y}`));
    const solidKeys = new Set(first.arena.solid.map(({ x, y }) => `${x},${y}`));
    // Central symmetry (Decision 011): pillars are seed + central mirror, and
    // the crate hash is D2-uniform (min of the 4 reflected tile-key variants),
    // so both sets close under the central mirror.
    for (const crate of first.arena.crates) {
      expect(crateKeys.has(`${first.arena.width - 1 - crate.x},${first.arena.height - 1 - crate.y}`))
        .toBe(true);
    }
    for (const tile of first.arena.solid) {
      expect(solidKeys.has(`${first.arena.width - 1 - tile.x},${first.arena.height - 1 - tile.y}`))
        .toBe(true);
    }
    // Sparse border + wrap portals on the classic layout.
    expect(solidKeys.has("0,2")).toBe(true);
    expect(solidKeys.has("0,1")).toBe(false);
    expect(solidKeys.has("0,4")).toBe(false);
    expect(solidKeys.has("10,4")).toBe(false);
    expect(solidKeys.has("5,0")).toBe(false);
    expect(solidKeys.has("5,8")).toBe(false);
  });

  it("move por comandos: 16 ticks por tile e gap impar da borda cruza a costura com wrap", () => {
    const config = localDuel();
    const alpha = config.seats[0]!.competitorId;
    const game = createGameMechanics(config);
    const spawn = tileCenter({ x: 1, y: 1 });
    facadeEnterPlaying(game);

    // Restart from spawn for the exact 16-tick / 1-tile right walk.
    game.dispatch({ type: "set-movement", competitorId: alpha, direction: "right", pressed: true });
    const events = game.dispatch({ type: "advance", deltaMs: 20 });
    expect(competitor(game, alpha).position).toEqual({
      x: spawn.x + BASE_SPEED_UNITS_PER_TICK,
      y: spawn.y,
    });
    expect(competitor(game, alpha).tile).toEqual({ x: 1, y: 1 });
    expect(events).toContainEqual({
      type: "competitor-moved",
      competitorId: alpha,
      position: { x: spawn.x + BASE_SPEED_UNITS_PER_TICK, y: spawn.y },
      tile: { x: 1, y: 1 },
    });

    // 15 more ticks (16 total) reach exactly the next tile center.
    for (let i = 0; i < 15; i += 1) {
      game.dispatch({ type: "advance", deltaMs: 20 });
    }
    game.dispatch({ type: "set-movement", competitorId: alpha, direction: "right", pressed: false });
    expect(competitor(game, alpha).position).toEqual(tileCenter({ x: 2, y: 1 }));
    expect(competitor(game, alpha).tile).toEqual({ x: 2, y: 1 });

    // Row y=1 has open wrap gaps at (0,1)/(10,1): walking left crosses the
    // seam and re-enters on the opposite side at the same y (Decision 011).
    game.dispatch({ type: "restart" });
    facadeEnterPlaying(game);
    game.dispatch({ type: "set-movement", competitorId: alpha, direction: "left", pressed: true });
    for (let i = 0; i < 16; i += 1) {
      game.dispatch({ type: "advance", deltaMs: 20 });
    }
    // 16 ticks left: (1,1) -> (0,1) center, still canonical in [0, span).
    expect(competitor(game, alpha).position).toEqual(tileCenter({ x: 0, y: 1 }));
    expect(competitor(game, alpha).tile).toEqual({ x: 0, y: 1 });
    for (let i = 0; i < 16; i += 1) {
      game.dispatch({ type: "advance", deltaMs: 20 });
    }
    // 16 more ticks: exits the left edge and wraps to (10,1) at the same y.
    expect(competitor(game, alpha).position).toEqual(tileCenter({ x: 10, y: 1 }));
    expect(competitor(game, alpha).tile).toEqual({ x: 10, y: 1 });
    for (let i = 0; i < 16; i += 1) {
      game.dispatch({ type: "advance", deltaMs: 20 });
    }
    game.dispatch({ type: "set-movement", competitorId: alpha, direction: "left", pressed: false });
    expect(competitor(game, alpha).position).toEqual(tileCenter({ x: 9, y: 1 }));
    expect(competitor(game, alpha).tile).toEqual({ x: 9, y: 1 });
  });

  it("borda par bloqueia no contato exato; portal (0,4) sai a esquerda e re-entra em (10,4)", () => {
    const program = createDefaultMechanicsProgram();
    const config = localDuel("wrap-portal");
    const alpha = config.seats[0]!.competitorId;
    const beta = config.seats[1]!.competitorId;
    const seat0 = config.seats[0]!.seatId;
    const base = program.initial(config);
    const openArena = {
      width: 11,
      height: 9,
      solid: [...base.slices.arena.solid],
      crates: [] as { x: number; y: number }[],
    };
    const pressLeft = (world: WorldState, sequence: number) =>
      program.step(world, {
        commands: [
          {
            tick: world.tick,
            sequence,
            seatId: seat0,
            command: { type: "set-movement", direction: "left", pressed: true },
          },
        ],
      }).state;

    // Even border tile (0,2) is solid: walking left from (1,2) stops at exact
    // contact (body left edge == tile right edge) and never penetrates.
    let world = asPlayingWorld(program, base, {
      arena: openArena,
      locomotion: { entries: [locoAt(alpha, 1, 2), locoAt(beta, 9, 7)] },
    });
    world = pressLeft(world, 0);
    for (let i = 0; i < 20; i += 1) {
      world = program.step(world, { commands: [] }).state;
    }
    const blocked = world.slices.locomotion.entries[0]!;
    expect(blocked.position).toEqual({
      x: UNITS_PER_TILE + BODY_HALF_EXTENT,
      y: tileCenter({ x: 1, y: 2 }).y,
    });
    expect(blocked.velocity).toEqual({ x: 0, y: 0 });
    expect(bodyOverlapsTile(blocked.position, { x: 0, y: 2 })).toBe(false);

    // Portal lane y=4: (0,4)/(10,4) are open portals. Walking left from (1,4)
    // exits through (0,4) and re-enters on the right at (10,4), same y.
    world = asPlayingWorld(program, base, {
      arena: openArena,
      locomotion: { entries: [locoAt(alpha, 1, 4), locoAt(beta, 9, 7)] },
    });
    world = pressLeft(world, 0);
    for (let i = 0; i < 15; i += 1) {
      world = program.step(world, { commands: [] }).state;
    }
    expect(world.slices.locomotion.entries[0]!.position).toEqual(tileCenter({ x: 0, y: 4 }));
    expect(tileOf(world.slices.locomotion.entries[0]!.position)).toEqual({ x: 0, y: 4 });
    // 8 more ticks reach x=0 (body straddling the seam), still canonical.
    for (let i = 0; i < 8; i += 1) {
      world = program.step(world, { commands: [] }).state;
    }
    expect(world.slices.locomotion.entries[0]!.position.x).toBe(0);
    // Seam-crossing tick: wraps to the right edge; velocity stays the
    // shortest wrapped delta (-64).
    const seam = program.step(world, { commands: [] }).state;
    const seamEntry = seam.slices.locomotion.entries[0]!;
    expect(seamEntry.velocity).toEqual({ x: -BASE_SPEED_UNITS_PER_TICK, y: 0 });
    expect(seamEntry.position.x).toBe(11 * UNITS_PER_TILE - BASE_SPEED_UNITS_PER_TICK);
    world = seam;
    for (let i = 0; i < 7; i += 1) {
      world = program.step(world, { commands: [] }).state;
    }
    const wrapped = world.slices.locomotion.entries[0]!;
    expect(wrapped.position).toEqual(tileCenter({ x: 10, y: 4 }));
    expect(tileOf(wrapped.position)).toEqual({ x: 10, y: 4 });
    // Position stays canonical in [0, width*UNITS) after the wrap.
    expect(wrapped.position.x).toBeGreaterThanOrEqual(0);
    expect(wrapped.position.x).toBeLessThan(11 * UNITS_PER_TILE);
  });

  it("explode uma bomba, cria chamas e encerra a rodada por eliminacao", () => {
    const config = localDuel("explosion-contract");
    const alpha = config.seats[0]!.competitorId;
    const beta = config.seats[1]!.competitorId;
    const game = createGameMechanics(config);
    facadeEnterUnprotected(game);

    // place-bomb only queues; event appears on the following advance.
    expect(game.dispatch({ type: "place-bomb", competitorId: alpha })).toEqual([]);
    const placeEvents = game.dispatch({ type: "advance", deltaMs: 20 });
    expect(placeEvents).toContainEqual({
      type: "bomb-placed",
      bombId: 1,
      competitorId: alpha,
      at: { x: 1, y: 1 },
    });

    const events = game.dispatch({ type: "advance", deltaMs: 2_000 });
    const snapshot = game.snapshot();
    expect(snapshot.bombs).toHaveLength(0);
    expect(snapshot.flames.map(({ tile }) => tile)).toContainEqual({ x: 1, y: 1 });
    expect(competitor(game, alpha).alive).toBe(false);
    expect(snapshot).toMatchObject({
      phase: "round-over",
      outcome: { reason: "elimination", winner: beta },
    });
    expect(events.some((event) => event.type === "bomb-exploded")).toBe(true);
    const elim = events.find((event) => event.type === "competitor-eliminated");
    expect(elim).toMatchObject({
      type: "competitor-eliminated",
      competitorId: alpha,
    });
    if (elim?.type === "competitor-eliminated") {
      expect(elim.causes.length).toBeGreaterThanOrEqual(1);
      const cause = elim.causes[0];
      expect(cause?.kind).toBe("bomb");
      if (cause?.kind === "bomb") {
        expect(cause.ownerId).toBe(alpha);
        expect(cause.bombId).toBe(1);
      }
      expect("by" in elim).toBe(false);
    }
  });

  it("pausa sem consumir tempo e reinicia preservando a config canonica", () => {
    const config = localDuel("restart-contract");
    const game = createGameMechanics(config);
    facadeEnterPlaying(game);
    const initial = game.snapshot();

    expect(game.dispatch({ type: "toggle-pause" })).toEqual([
      { type: "phase-changed", phase: "paused" },
    ]);
    game.dispatch({ type: "advance", deltaMs: 1_000 });
    expect(game.snapshot().remainingMs).toBe(initial.remainingMs);

    expect(game.dispatch({ type: "restart" })).toEqual([
      { type: "restarted", seed: "restart-contract" },
    ]);
    const restarted = game.snapshot();
    expect(restarted.phase).toBe("round-start");
    expect(restarted.elapsedMs).toBe(0);
    expect(restarted.roundNumber).toBe(1);
    expect(restarted.scores.every((entry) => entry.wins === 0)).toBe(true);
    expect(restarted.arena).toEqual(initial.arena);
    expect(restarted.config).toEqual(initial.config);
    expect(restarted.config).toEqual(config);
  });

  it("replay da mesma config + comandos produz snapshots e eventos iguais", () => {
    const config = createLocalDuel1v1MatchConfig({
      seed: "replay-parity",
      competitorIds: ["left", "right"],
    });
    const left = config.seats[0]!.competitorId;
    const commands: GameCommand[] = [
      { type: "set-movement", competitorId: left, direction: "right", pressed: true },
      { type: "advance", deltaMs: 200 },
      { type: "set-movement", competitorId: left, direction: "right", pressed: false },
      { type: "place-bomb", competitorId: left },
      { type: "advance", deltaMs: 500 },
      { type: "toggle-pause" },
      { type: "toggle-pause" },
      { type: "advance", deltaMs: 1_600 },
    ];

    const first = replay(config, commands);
    const second = replay(config, commands);

    expect(first.events).toEqual(second.events);
    expect(first.snapshot).toEqual(second.snapshot);
    expect(first.snapshot.config.seed).toBe("replay-parity");
    expect(first.snapshot.config.seats.map((seat) => seat.competitorId)).toEqual(["left", "right"]);
  });

  it("quatro competidores: eliminacao deixa um vencedor sem assumir p1/p2", () => {
    const config = createFourSeatMatchConfig({
      seed: "ffa-elim",
      competitorIds: ["w", "x", "y", "z"],
    });
    const w = config.seats[0]!.competitorId;
    const x = config.seats[1]!.competitorId;
    const y = config.seats[2]!.competitorId;
    const z = config.seats[3]!.competitorId;
    const game = createGameMechanics(config);
    facadeEnterUnprotected(game);

    game.dispatch({ type: "place-bomb", competitorId: w });
    game.dispatch({ type: "advance", deltaMs: 2_020 });

    expect(competitor(game, w).alive).toBe(false);
    expect(competitor(game, x).alive).toBe(true);
    expect(competitor(game, y).alive).toBe(true);
    expect(competitor(game, z).alive).toBe(true);
    expect(game.snapshot().phase).toBe("playing");
    expect(game.snapshot().competitors).toHaveLength(4);
  });
});

describe("Slice 1 — kernel puro MechanicsProgram", () => {
  it("initial/step sao deterministas e WorldState faz JSON round-trip executavel", () => {
    const config = localDuel("kernel-json");
    const program = createDefaultMechanicsProgram();
    const a = program.initial(config);
    const b = program.initial(config);
    expect(a).toEqual(b);
    expect(program.tickDurationMs).toBe(20);
    expect(a.formatVersion).toBe(WORLD_FORMAT_VERSION);
    expect(a.slices).toBeDefined();

    const seat0 = config.seats[0]!.seatId;
    let state = a;
    const events: GameEvent[] = [];
    for (let i = 0; i < 5; i += 1) {
      const result = program.step(state, {
        commands: i === 0
          ? [{
              tick: state.tick,
              sequence: 0,
              seatId: seat0,
              command: { type: "set-movement", direction: "right", pressed: true },
            }]
          : [],
      });
      state = result.state;
      events.push(...result.events);
    }

    const json = JSON.stringify(state);
    const restored = program.restore(JSON.parse(json));
    expect(restored).toEqual(state);
    expect(json).not.toMatch(/\[object /);

    // Restored state is steppable.
    const afterRestore = program.step(restored, { commands: [] });
    expect(afterRestore.state.tick).toBe(restored.tick + 1);

    const replayed = (() => {
      let s = program.initial(config);
      const ev: GameEvent[] = [];
      for (let i = 0; i < 5; i += 1) {
        const result = program.step(s, {
          commands: i === 0
            ? [{
                tick: s.tick,
                sequence: 0,
                seatId: seat0,
                command: { type: "set-movement", direction: "right", pressed: true },
              }]
            : [],
        });
        s = result.state;
        ev.push(...result.events);
      }
      return { state: s, events: ev };
    })();

    expect(replayed.state).toEqual(state);
    expect(replayed.events).toEqual(events);
  });

  it("step nunca muta o argumento state", () => {
    const config = localDuel("immutability");
    const program = createDefaultMechanicsProgram();
    const state = program.initial(config);
    const frozenCopy = program.restore(JSON.parse(JSON.stringify(state)));
    const before = JSON.stringify(state);

    program.step(state, {
      commands: [{
        tick: state.tick,
        sequence: 0,
        seatId: config.seats[0]!.seatId,
        command: { type: "set-movement", direction: "right", pressed: true },
      }],
    });

    expect(JSON.stringify(state)).toBe(before);
    expect(state).toEqual(frozenCopy);

    const badFormat = JSON.parse(JSON.stringify(state)) as { formatVersion: string };
    badFormat.formatVersion = "world-0";
    expect(() => program.restore(badFormat)).toThrow(/formatVersion/);
  });

  it("tick incrementa sempre; stateRevision inclui match clock em playing", () => {
    const config = localDuel("tick-revision");
    const program = createDefaultMechanicsProgram();
    let state = enterPlaying(program, program.initial(config));

    const idle = program.step(state, { commands: [] });
    expect(idle.state.tick).toBe(state.tick + 1);
    // Playing tick always changes match clocks → stateRevision bumps.
    expect(idle.state.stateRevision).toBe(state.stateRevision + 1);
    expect(idle.state.slices.match.roundElapsedMs).toBe(TICK_DURATION_MS * 2);

    state = idle.state;
    const withIntent = program.step(state, {
      commands: [{
        tick: state.tick,
        sequence: 0,
        seatId: config.seats[0]!.seatId,
        command: { type: "set-movement", direction: "right", pressed: true },
      }],
    });
    expect(withIntent.state.tick).toBe(state.tick + 1);
    expect(withIntent.state.stateRevision).toBe(state.stateRevision + 1);

    // match-over freezes competitive clocks → empty steps only advance tick.
    const short = createLocalDuel1v1MatchConfig({
      seed: "short-round",
      roundDurationMs: 5_000,
      targetRoundWins: 1,
    });
    const baseEnd = enterPlaying(program, program.initial(short));
    const alpha = short.seats[0]!.competitorId;
    const beta = short.seats[1]!.competitorId;
    const matchOverRaw = cloneDraft(baseEnd);
    matchOverRaw.slices.match.phase = "match-over";
    matchOverRaw.slices.match.phaseRemainingMs = 0;
    // Earliest legal terminal clock is SPAWN_PROTECTION_MS (deaths unreachable earlier).
    matchOverRaw.slices.match.roundElapsedMs = SPAWN_PROTECTION_MS;
    matchOverRaw.slices.match.roundRemainingMs = short.roundDurationMs - SPAWN_PROTECTION_MS;
    matchOverRaw.slices.match.suddenDeathElapsedMs = 0;
    matchOverRaw.slices.match.roundOutcome = { reason: "elimination", winner: alpha };
    matchOverRaw.slices.match.matchWinner = alpha;
    matchOverRaw.slices.match.scores = [
      { competitorId: alpha, wins: 1 },
      { competitorId: beta, wins: 0 },
    ];
    matchOverRaw.slices.vitals = {
      entries: [
        { competitorId: alpha, alive: true, spawnProtectionRemainingMs: 0 },
        { competitorId: beta, alive: false, spawnProtectionRemainingMs: 0 },
      ],
    };
    matchOverRaw.slices.bombs = { nextId: 1, items: [] };
    matchOverRaw.slices.flames = { items: [] };
    const end = program.restore(matchOverRaw);
    expect(end.slices.match.phase).toBe("match-over");
    const rev = end.stateRevision;
    const tick = end.tick;
    const after = program.step(end, { commands: [] }).state;
    expect(after.tick).toBe(tick + 1);
    expect(after.stateRevision).toBe(rev + 1);
  });

  it("scheduler usa run compilado: modulo/sistema substituto muda execucao; remocao falha", () => {
    const config = localDuel("scheduler-live");
    const base = createDefaultMechanicsProgram();
    let state = enterUnprotected(base, base.initial(config));
    const seat0 = config.seats[0]!.seatId;

    // Baseline: place bomb works.
    const placed = base.step(state, {
      commands: [{ tick: state.tick, sequence: 0, seatId: seat0, command: { type: "place-bomb" } }],
    });
    expect(placed.state.slices.bombs.items).toHaveLength(1);
    expect(placed.events.some((event) => event.type === "bomb-placed")).toBe(true);

    // Replace bomb-place run with a no-op — placement must not happen.
    const mutedOrdnance: ModuleSpec = Object.freeze({
      ...ordnanceModule,
      systems: Object.freeze(
        ordnanceModule.systems.map((system) =>
          system.id === "bomb-place-system"
            ? Object.freeze({
                ...system,
                run: () => ({}),
              })
            : system,
        ),
      ),
    });
    const muted = createMechanicsProgram(defaultModulesWith([mutedOrdnance]));
    const mutedPlace = muted.step(muted.initial(config), {
      commands: [{ tick: 0, sequence: 0, seatId: seat0, command: { type: "place-bomb" } }],
    });
    expect(mutedPlace.state.slices.bombs.items).toHaveLength(0);
    expect(mutedPlace.events.some((event) => event.type === "bomb-placed")).toBe(false);

    // Removing a required owner module fails compile.
    expect(() =>
      createMechanicsProgram([
        intentModule,
        locomotionModule,
        // ordnance missing
        arenaModule,
        competitorsModule,
        matchModule,
        pressureModule,
      ]),
    ).toThrow(MechanicsCompileError);
    expect(() =>
      createMechanicsProgram([
        intentModule,
        locomotionModule,
        arenaModule,
        competitorsModule,
        matchModule,
        pressureModule,
      ]),
    ).toThrow(/no owning module|missing-owner|bombs|flames/);
  });

  it("ordem de registro invertida de 6+ modulos/sistemas produz estado e eventos identicos", () => {
    const config = localDuel("permute-reg");
    const forward = createDefaultMechanicsProgram("forward");
    const reversed = createDefaultMechanicsProgram("reversed");

    // Also reverse systems inside each module.
    const fullyReversed: ModuleSpec[] = createDefaultModules("reversed").map((module) =>
      Object.freeze({
        ...module,
        systems: Object.freeze([...module.systems].reverse()),
      }),
    );
    const reversedSystems = createMechanicsProgram(fullyReversed);

    function run(program: ReturnType<typeof createMechanicsProgram>) {
      let state = program.initial(config);
      const events: GameEvent[] = [];
      const seat0 = config.seats[0]!.seatId;
      for (let i = 0; i < 10; i += 1) {
        const result = program.step(state, {
          commands: i === 0
            ? [{
                tick: state.tick,
                sequence: 0,
                seatId: seat0,
                command: { type: "place-bomb" },
              }]
            : [],
        });
        state = result.state;
        events.push(...result.events);
      }
      return { state, events, snapshot: program.snapshot(state) };
    }

    const a = run(forward);
    const b = run(reversed);
    const c = run(reversedSystems);
    expect(a.state).toEqual(b.state);
    expect(a.events).toEqual(b.events);
    expect(a.snapshot).toEqual(b.snapshot);
    expect(a.state).toEqual(c.state);
    expect(a.events).toEqual(c.events);
  });

  it("compileMechanics rejeita owner ausente/duplicado, id duplicado, write alheio, overlap e undeclared", () => {
    const defaults = createDefaultModules();
    expect(() => compileMechanics([...defaults, intentModule])).toThrow(MechanicsCompileError);
    expect(() => compileMechanics([...defaults, intentModule])).toThrow(/Duplicate module|owned by both/);

    // Duplicate system id across modules.
    const dupSystem: ModuleSpec = Object.freeze({
      id: "intruder-sys",
      version: "1",
      owns: Object.freeze([] as const),
      systems: Object.freeze([
        Object.freeze({
          id: "intent-system",
          phase: "intent" as const,
          reads: Object.freeze(["intent"] as const),
          writes: Object.freeze([] as const),
          run: () => ({}),
        }),
      ]),
      codecs: stubCodecs([]),
    });
    expect(() => compileMechanics([...defaults, dupSystem])).toThrow(/Duplicate system/);

    // Missing owner.
    expect(() =>
      compileMechanics(defaults.filter((module) => module.id !== "arena")),
    ).toThrow(/no owning module|missing-owner|arena/);

    // Duplicate owner.
    const dupOwner: ModuleSpec = Object.freeze({
      id: "thief",
      version: "1",
      owns: Object.freeze(["intent"] as const),
      systems: Object.freeze([] as const),
      codecs: stubCodecs(["intent"]),
    });
    expect(() => compileMechanics([...defaults, dupOwner])).toThrow(/owned by both|duplicate-owner/);

    // Foreign write.
    const badWrite: ModuleSpec = Object.freeze({
      id: "writer",
      version: "1",
      owns: Object.freeze([] as const),
      systems: Object.freeze([
        Object.freeze({
          id: "sneaky",
          phase: "command" as const,
          reads: Object.freeze(["intent"] as const),
          writes: Object.freeze(["intent"] as const),
          run: () => ({}),
        }),
      ]),
      codecs: stubCodecs([]),
    });
    expect(() => compileMechanics([...defaults, badWrite])).toThrow(/writes slice|invalid-write/);

    // Writer overlap same phase/slice.
    const overlapA: ModuleSpec = Object.freeze({
      id: "overlap-a",
      version: "1",
      owns: Object.freeze(["intent"] as const),
      systems: Object.freeze([
        Object.freeze({
          id: "intent-writer-a",
          phase: "intent" as const,
          reads: Object.freeze(["intent"] as const),
          writes: Object.freeze(["intent"] as const),
          run: () => ({}),
        }),
      ]),
      codecs: stubCodecs(["intent"]),
    });
    const overlapB: ModuleSpec = Object.freeze({
      id: "overlap-b",
      version: "1",
      owns: Object.freeze(["match"] as const),
      systems: Object.freeze([
        Object.freeze({
          id: "intent-writer-b",
          phase: "intent" as const,
          reads: Object.freeze(["intent"] as const),
          writes: Object.freeze(["intent"] as const),
          run: () => ({}),
        }),
        noopSystem("match-timer-x", "timer", ["match"]),
      ]),
      codecs: stubCodecs(["match"]),
    });
    // Single module with two writers of intent in intent phase:
    const doubleWriter: ModuleSpec = Object.freeze({
      id: "double",
      version: "1",
      owns: Object.freeze(["intent"] as const),
      systems: Object.freeze([
        Object.freeze({
          id: "intent-a",
          phase: "intent" as const,
          reads: Object.freeze(["intent"] as const),
          writes: Object.freeze(["intent"] as const),
          run: () => ({}),
        }),
        Object.freeze({
          id: "intent-b",
          phase: "intent" as const,
          reads: Object.freeze(["intent"] as const),
          writes: Object.freeze(["intent"] as const),
          run: () => ({}),
        }),
      ]),
      codecs: stubCodecs(["intent"]),
    });
    expect(() =>
      compileMechanics([
        doubleWriter,
        locomotionModule,
        ordnanceModule,
        arenaModule,
        competitorsModule,
        matchModule,
        pressureModule,
        powerupsModule,
        skillsModule,
      ]),
    ).toThrow(/writer-overlap|written by both/);

    // Undeclared write at runtime — keep real codecs from intentModule.
    const sneakyRuntime: ModuleSpec = Object.freeze({
      id: "intent",
      version: intentModule.version,
      owns: intentModule.owns,
      codecs: intentModule.codecs,
      systems: Object.freeze([
        Object.freeze({
          id: "intent-system",
          phase: "intent" as const,
          reads: Object.freeze(["intent"] as const),
          writes: Object.freeze(["intent"] as const),
          run: () => ({
            writes: {
              intent: { entries: [] },
              // undeclared — TypeScript may allow via cast
              match: {
                phase: "playing" as const,
                elapsedMs: 0,
                remainingMs: 1,
                outcome: null,
              },
            } as never,
          }),
        }),
      ]),
    });
    const program = createMechanicsProgram(defaultModulesWith([sneakyRuntime]));
    // Revision differs from DEFAULT because version/descriptors may match — still executable
    // for this custom program's own revision.
    const customConfig = createMatchConfig({
      ...baseValidInput({ seed: "undeclared" }),
      mechanicsRevision: program.mechanicsRevision,
    });
    expect(() =>
      program.step(program.initial(customConfig), { commands: [] }),
    ).toThrow(/undeclared write/);

    void overlapA;
    void overlapB;
  });

  it("facade queue e kernel step sao equivalentes; commitCommands nao existe", () => {
    const config = localDuel("facade-kernel-eq");
    const alpha = config.seats[0]!.competitorId;
    const seat0 = config.seats[0]!.seatId;

    // Kernel path: place + move in one step, then idle steps (must be playing/unprotected).
    const program = createDefaultMechanicsProgram();
    let kernel = enterUnprotected(program, program.initial(config));
    const kernelEvents: GameEvent[] = [];
    {
      const first = program.step(kernel, {
        commands: [
          {
            tick: kernel.tick,
            sequence: 0,
            seatId: seat0,
            command: { type: "place-bomb" },
          },
          {
            tick: kernel.tick,
            sequence: 1,
            seatId: seat0,
            command: { type: "set-movement", direction: "right", pressed: true },
          },
        ],
      });
      kernel = first.state;
      kernelEvents.push(...first.events);
      for (let i = 0; i < 9; i += 1) {
        const step = program.step(kernel, { commands: [] });
        kernel = step.state;
        kernelEvents.push(...step.events);
      }
    }

    // Facade path: queue then advance same total time (10 ticks * 20ms).
    const game = createGameMechanics(config);
    facadeEnterUnprotected(game);
    const facadeEvents: GameEvent[] = [];
    game.dispatch({ type: "place-bomb", competitorId: alpha });
    game.dispatch({
      type: "set-movement",
      competitorId: alpha,
      direction: "right",
      pressed: true,
    });
    facadeEvents.push(...game.dispatch({ type: "advance", deltaMs: 200 }));

    expect(game.snapshot().competitors.find((c) => c.id === alpha)?.tile).toEqual(
      program.snapshot(kernel).competitors.find((c) => c.id === alpha)?.tile,
    );
    expect(game.snapshot().bombs).toEqual(program.snapshot(kernel).bombs);
    expect(facadeEvents.filter((e) => e.type === "bomb-placed")).toEqual(
      kernelEvents.filter((e) => e.type === "bomb-placed"),
    );

    // commitCommands must not exist on the public kernel surface.
    const programModule = readFileSync(
      join(process.cwd(), "GameMechanics", "src", "kernel", "program.ts"),
      "utf8",
    );
    expect(programModule).not.toMatch(/commitCommands/);
    const indexModule = readFileSync(
      join(process.cwd(), "GameMechanics", "src", "index.ts"),
      "utf8",
    );
    expect(indexModule).not.toMatch(/commitCommands/);
  });

  it("delta facade invalido lanca erro; pos-round command gera not-playing", () => {
    const config = localDuel("reject-delta");
    const program = createDefaultMechanicsProgram();
    const state = program.initial(config);
    const before = JSON.stringify(state);

    const rejected = program.step(state, {
      commands: [{
        tick: state.tick + 5,
        sequence: 0,
        seatId: config.seats[0]!.seatId,
        command: { type: "place-bomb" },
      }],
    });
    expect(rejected.rejections.some((item) => item.reason === "tick-mismatch")).toBe(true);
    expect(rejected.state.slices.bombs.items).toHaveLength(0);
    expect(JSON.stringify(state)).toBe(before);

    const game = createGameMechanics(config);
    const snapBefore = game.snapshot();
    expect(() => game.dispatch({ type: "advance", deltaMs: Number.NaN })).toThrow(/deltaMs/);
    expect(() => game.dispatch({ type: "advance", deltaMs: -10 })).toThrow(/deltaMs/);
    expect(() => game.dispatch({ type: "advance", deltaMs: MAX_ADVANCE_MS + 1 })).toThrow(
      /deltaMs/,
    );
    expect(() => game.dispatch({ type: "advance", deltaMs: 0 })).toThrow(/deltaMs/);
    expect(game.snapshot()).toEqual(snapBefore);

    // Craft round-over (timeout no longer ends the round — sudden-death continues).
    const short = createLocalDuel1v1MatchConfig({
      seed: "post-round-cmd",
      roundDurationMs: 5_000,
    });
    const end = asRoundOverWorld(
      program,
      program.initial(short),
      short.seats[1]!.competitorId,
      { phaseRemainingMs: ROUND_END_MS },
    );
    expect(end.slices.match.phase).toBe("round-over");
    const post = program.step(end, {
      commands: [{
        tick: end.tick,
        sequence: 0,
        seatId: short.seats[0]!.seatId,
        command: { type: "place-bomb" },
      }],
    });
    expect(post.rejections.some((item) => item.reason === "not-playing")).toBe(true);
    expect(post.state.slices.bombs.items).toHaveLength(0);
    expect(post.state.tick).toBe(end.tick + 1);
    // round-over interval writes phaseRemainingMs each tick → stateRevision advances.
    expect(post.state.stateRevision).toBe(end.stateRevision + 1);

    // Facade: queue during round-start countdown is also not-playing (same gate).
    const facade = createGameMechanics(short);
    expect(facade.snapshot().phase).toBe("round-start");
    facade.dispatch({ type: "place-bomb", competitorId: short.seats[0]!.competitorId });
    facade.dispatch({ type: "advance", deltaMs: 20 });
    expect(facade.rejections().some((item) => item.reason === "not-playing")).toBe(true);
    expect(facade.snapshot().bombs).toHaveLength(0);
  });

  it("movimento simultaneo adversarial nao depende da ordem do roster", () => {
    // Head-on within contract max step: bodies never block (Decision 012) —
    // both cross through each other and are accepted, order-independent.
    const aFrom = freezePosition({ x: 1500, y: 1600 });
    const zFrom = freezePosition({
      x: 1500 + BODY_HALF_EXTENT * 2 - 20,
      y: 1600,
    });
    const headOn: MovementCandidate[] = [
      {
        competitorId: "z-last" as CompetitorId,
        from: zFrom,
        to: freezePosition({ x: zFrom.x - BASE_SPEED_UNITS_PER_TICK, y: zFrom.y }),
        direction: "left",
      },
      {
        competitorId: "a-first" as CompetitorId,
        from: aFrom,
        to: freezePosition({ x: aFrom.x + BASE_SPEED_UNITS_PER_TICK, y: aFrom.y }),
        direction: "right",
      },
    ];
    const headEntries: LocomotionEntry[] = [
      Object.freeze({
        competitorId: "z-last" as CompetitorId,
        position: zFrom,
        velocity: freezeVelocity({ x: 0, y: 0 }),
        lastDirection: null,
      }),
      Object.freeze({
        competitorId: "a-first" as CompetitorId,
        position: aFrom,
        velocity: freezeVelocity({ x: 0, y: 0 }),
        lastDirection: null,
      }),
    ];
    expect([...resolveMovementBatch(headEntries, headOn)].sort()).toEqual(["a-first", "z-last"]);
    expect([...resolveMovementBatch([...headEntries].reverse(), [...headOn].reverse())].sort())
      .toEqual(["a-first", "z-last"]);

    // Parallel follow within step 128: both accepted, order-independent.
    // Full-tile swap is impossible under the contract max step and is rejected elsewhere.
    const fA = freezePosition({ x: 1200, y: 1600 });
    const fZ = freezePosition({ x: 1200 + BODY_HALF_EXTENT * 2 + 50, y: 1600 });
    const followProposals: MovementCandidate[] = [
      {
        competitorId: "z-last" as CompetitorId,
        from: fZ,
        to: freezePosition({ x: fZ.x + BASE_SPEED_UNITS_PER_TICK, y: fZ.y }),
        direction: "right",
      },
      {
        competitorId: "a-first" as CompetitorId,
        from: fA,
        to: freezePosition({ x: fA.x + BASE_SPEED_UNITS_PER_TICK, y: fA.y }),
        direction: "right",
      },
    ];
    const followEntries: LocomotionEntry[] = [
      Object.freeze({
        competitorId: "a-first" as CompetitorId,
        position: fA,
        velocity: freezeVelocity({ x: 0, y: 0 }),
        lastDirection: null,
      }),
      Object.freeze({
        competitorId: "z-last" as CompetitorId,
        position: fZ,
        velocity: freezeVelocity({ x: 0, y: 0 }),
        lastDirection: null,
      }),
    ];
    const followA = resolveMovementBatch(followEntries, followProposals);
    const followB = resolveMovementBatch(followEntries, [...followProposals].reverse());
    expect([...followA].sort()).toEqual(["a-first", "z-last"]);
    expect([...followB].sort()).toEqual(["a-first", "z-last"]);
  });

  it("3+ bombas: crate pre-wave vs onda seguinte, chain e flame multi-cause", () => {
    // Default-revision valid world: fuse=20 (due after fuse phase), flameRange=2,
    // maxBombs=1 ⇒ three distinct owners via four-seat roster.
    const config = createFourSeatMatchConfig({
      seed: "wave-chain-3",
      competitorIds: ["c1", "c2", "c3", "c4"],
    });
    const program = createDefaultMechanicsProgram();
    const c1 = config.seats[0]!.competitorId;
    const c2 = config.seats[1]!.competitorId;
    const c3 = config.seats[2]!.competitorId;
    const c4 = config.seats[3]!.competitorId;
    const base = program.initial(config);

    // Corridor y=1 with flameRange=2:
    // bomb1 (1,1) fuse20 → hits bomb2 (2,1) and crate (3,1); cannot reach bomb3 (4,1).
    // Wave2: bomb2 explodes through cleared (3,1) and chains bomb3 at (4,1).
    const solid = base.slices.arena.solid;
    expect(base.slices.arena.crates.some((tile) => tile.x === 3 && tile.y === 1)).toBe(true);
    const crafted: WorldState = asPlayingWorld(program, base, {
      arena: {
        width: 11,
        height: 9,
        solid: [...solid],
        crates: [freezeTile({ x: 3, y: 1 })],
      },
      locomotion: {
        entries: [
          // Keep living competitors off the corridor bombs/crate.
          locoAt(c1, 1, 5),
          locoAt(c2, 9, 7),
          locoAt(c3, 9, 1),
          locoAt(c4, 1, 7),
        ],
      },
      bombs: {
        nextId: 4,
        items: [
          {
            id: 1,
            ownerId: c1,
            tile: freezeTile({ x: 1, y: 1 }),
            fuseMs: 20,
            flameRange: 2,
          echo: false,
          },
          {
            id: 2,
            ownerId: c2,
            tile: freezeTile({ x: 2, y: 1 }),
            fuseMs: 1_000,
            flameRange: 2,
          echo: false,
          },
          {
            id: 3,
            ownerId: c3,
            tile: freezeTile({ x: 4, y: 1 }),
            fuseMs: 1_000,
            flameRange: 2,
          echo: false,
          },
        ],
      },
    });

    const cratesBefore = crafted.slices.arena.crates.map((tile) => `${tile.x},${tile.y}`);
    expect(cratesBefore).toContain("3,1");

    const result = program.step(crafted, { commands: [] });
    const { state, events } = result;

    // All three bombs explode via fuse (1) + chain (2) + chain after crate open (3).
    expect(state.slices.bombs.items).toHaveLength(0);
    const explodedIds = events
      .filter((event) => event.type === "bomb-exploded")
      .map((event) => (event.type === "bomb-exploded" ? event.bombId : -1))
      .sort((a, b) => a - b);
    expect(explodedIds).toEqual([1, 2, 3]);

    expect(state.slices.arena.crates.map((tile) => `${tile.x},${tile.y}`)).not.toContain("3,1");
    expect(events.some((event) =>
      event.type === "crate-destroyed" && event.at.x === 3 && event.at.y === 1
    )).toBe(true);

    const multi = state.slices.flames.items.filter((flame) => flame.causes.length >= 2);
    expect(multi.length).toBeGreaterThanOrEqual(1);
    const sample = multi[0]!;
    expect(sample.causes.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < sample.causes.length; i += 1) {
      expect(sample.causes[i]!.bombId).toBeGreaterThanOrEqual(sample.causes[i - 1]!.bombId);
    }

    const bomb1Event = events.find(
      (event) => event.type === "bomb-exploded" && event.bombId === 1,
    );
    expect(bomb1Event?.type).toBe("bomb-exploded");
    if (bomb1Event?.type === "bomb-exploded") {
      // Same-wave crate blocking: cannot pass through crate to bomb3's tile.
      expect(bomb1Event.flameTiles.some((tile) => tile.x === 4 && tile.y === 1)).toBe(false);
      expect(bomb1Event.flameTiles.some((tile) => tile.x === 3 && tile.y === 1)).toBe(true);
    }

    // Next wave opens path through former crate and hits bomb3.
    const bomb2Event = events.find(
      (event) => event.type === "bomb-exploded" && event.bombId === 2,
    );
    expect(bomb2Event?.type).toBe("bomb-exploded");
    if (bomb2Event?.type === "bomb-exploded") {
      expect(bomb2Event.flameTiles.some((tile) => tile.x === 4 && tile.y === 1)).toBe(true);
    }

    const bomb3Event = events.find(
      (event) => event.type === "bomb-exploded" && event.bombId === 3,
    );
    expect(bomb3Event).toBeDefined();
  });

  it("double KO explicito preserva causes em ambos os eventos de eliminacao", () => {
    const config = localDuel("double-ko");
    const program = createDefaultMechanicsProgram();
    const alpha = config.seats[0]!.competitorId;
    const beta = config.seats[1]!.competitorId;
    const base = program.initial(config);

    // Default-revision valid: fuse=20 (due this tick after fuse phase), flameRange=2.
    // Cross-hit: bomb at (1,1) range2 reaches (3,1); bomb at (3,1) reaches (1,1).
    const crafted = asPlayingWorld(program, base, {
      arena: {
        width: 11,
        height: 9,
        solid: [...base.slices.arena.solid],
        crates: [],
      },
      locomotion: {
        entries: [
          locoAt(alpha, 1, 1),
          locoAt(beta, 3, 1),
        ],
      },
      bombs: {
        nextId: 3,
        items: [
          {
            id: 1,
            ownerId: alpha,
            tile: freezeTile({ x: 1, y: 1 }),
            fuseMs: 20,
            flameRange: 2,
          echo: false,
          },
          {
            id: 2,
            ownerId: beta,
            tile: freezeTile({ x: 3, y: 1 }),
            fuseMs: 20,
            flameRange: 2,
          echo: false,
          },
        ],
      },
    });

    const { state, events } = program.step(crafted, { commands: [] });
    const elims = events.filter((event) => event.type === "competitor-eliminated");
    expect(elims).toHaveLength(2);
    for (const event of elims) {
      if (event.type !== "competitor-eliminated") continue;
      expect(event.causes.length).toBeGreaterThanOrEqual(1);
      expect("by" in event).toBe(false);
    }
    expect(state.slices.match.phase).toBe("round-over");
    expect(state.slices.match.roundOutcome).toEqual({ reason: "double-ko", winner: null });
    expect(state.slices.vitals.entries.every((entry) => !entry.alive)).toBe(true);
  });

  it("kernel nao importa legacy/Champions/game-assets; program nao importa modules concretos", () => {
    const srcRoot = join(process.cwd(), "GameMechanics", "src");
    // Browser adapter may load the character content pack; pure kernel/modules must not.
    const files = listSourceFiles(srcRoot).filter(
      (file) => !relative(srcRoot, file).replace(/\\/g, "/").startsWith("browser/"),
    );
    const forbidden = [/original-game/, /Champions/, /game-assets/];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      for (const pattern of forbidden) {
        expect(text, relative(process.cwd(), file)).not.toMatch(pattern);
      }
    }

    const programSrc = readFileSync(join(srcRoot, "kernel", "program.ts"), "utf8");
    expect(programSrc).not.toMatch(/modules\//);
    expect(programSrc).not.toMatch(/intentModule|ordnanceModule|matchModule/);

    // Kernel must not own a monolithic createInitialWorld / slice-shape restore switch.
    expect(programSrc).not.toMatch(/createInitialWorld/);
    const worldSrc = readFileSync(join(srcRoot, "kernel", "world-state.ts"), "utf8");
    expect(worldSrc).not.toMatch(/export function createInitialWorld/);
    expect(worldSrc).not.toMatch(/export function restoreWorldState/);
  });
});

describe("Slice 1 — ownership, reads, codecs e facade", () => {

  it("read undeclared e rejeitado; system com reads vazio nao le match", () => {
    const emptyReadMatch: ModuleSpec = Object.freeze({
      ...matchModule,
      systems: Object.freeze([
        Object.freeze({
          id: "timer-system",
          phase: "timer" as const,
          reads: Object.freeze([] as const),
          writes: Object.freeze(["match"] as const),
          run: (ctx: { read: (sliceId: "match") => unknown }) => {
            // Undeclared: must throw atomically.
            ctx.read("match");
            return {};
          },
        }),
        matchModule.systems.find((system) => system.id === "round-system")!,
      ]),
      codecs: matchModule.codecs,
    });
    const program = createMechanicsProgram(defaultModulesWith([emptyReadMatch]));
    const config = createMatchConfig({
      ...baseValidInput({ seed: "empty-reads" }),
      mechanicsRevision: program.mechanicsRevision,
    });
    expect(() => program.step(program.initial(config), { commands: [] })).toThrow(
      /undeclared read/,
    );
  });

  it("initial/restore vêm dos codecs: substituir codec muda initial; ordem invertida identica", () => {
    const baseModules = createDefaultModules("forward");
    const reversedModules = createDefaultModules("reversed");
    const forward = createMechanicsProgram(baseModules);
    const reversed = createMechanicsProgram(reversedModules);
    const config = localDuel("codec-order");
    expect(forward.initial(config)).toEqual(reversed.initial(config));
    expect(forward.mechanicsRevision).toBe(reversed.mechanicsRevision);

    const poisonedArena: ModuleSpec = Object.freeze({
      ...arenaModule,
      version: "1.1.0-test-codec",
      codecs: Object.freeze({
        initial(configInput: import("../src/contracts.ts").MatchConfig) {
          const normal = arenaModule.codecs.initial(configInput);
          return Object.freeze({
            arena: Object.freeze({
              ...normal.arena!,
              // Different initial crates proves codecs drive initial().
              crates: Object.freeze([]),
            }),
          });
        },
        restore: arenaModule.codecs.restore,
      }),
    });
    const poisoned = createMechanicsProgram(defaultModulesWith([poisonedArena]));
    const poisonConfig = createMatchConfig({
      ...baseValidInput({ seed: "codec-swap" }),
      mechanicsRevision: poisoned.mechanicsRevision,
    });
    const normal = createDefaultMechanicsProgram().initial(
      createMatchConfig({
        ...baseValidInput({ seed: "codec-swap" }),
        mechanicsRevision: DEFAULT_MECHANICS_REVISION,
      }),
    );
    const alt = poisoned.initial(poisonConfig);
    expect(alt.slices.arena.crates).toEqual([]);
    expect(normal.slices.arena.crates.length).toBeGreaterThan(0);
    expect(poisoned.mechanicsRevision).toBe(DEFAULT_MECHANICS_REVISION);
  });

  it("MatchConfig rejects tick-unaligned duration (5001)", () => {
    expect(() => createMatchConfig(baseValidInput({ roundDurationMs: 5_001 }))).toThrow(
      /multiple of 20|TICK|tick/i,
    );
  });

  it("restore rejects legacy timer outcome (world-3: only elimination|double-ko)", () => {
    const program = createDefaultMechanicsProgram();
    const config = localDuel("legacy-timer-outcome");
    const base = program.initial(config);
    const winner = config.seats[0]!.competitorId;
    const raw = cloneDraft(asRoundOverWorld(program, base, winner));
    raw.slices.match.roundOutcome = { reason: "timer", winner: null };
    // Keep two alive so the only hard failure is the dead reason.
    raw.slices.vitals.entries.forEach((entry) => {
      entry.alive = true;
      entry.spawnProtectionRemainingMs = 0;
    });
    expect(() => program.restore(raw)).toThrow(/roundOutcome\.reason is invalid/);
  });

  it("restore rejects round-over elimination with inconsistent remaining", () => {
    const program = createDefaultMechanicsProgram();
    const config = localDuel("elim-bad-remaining");
    const base = program.initial(config);
    const winner = config.seats[1]!.competitorId;
    const raw = cloneDraft(asRoundOverWorld(program, base, winner, {
      roundElapsedMs: SPAWN_PROTECTION_MS,
    }));
    // Expected remaining for elapsed is duration-elapsed; poison with tick-aligned wrong value.
    raw.slices.match.roundRemainingMs = 980;
    expect(() => program.restore(raw)).toThrow(/roundRemainingMs is inconsistent/);
  });

  it("restore rejects playing with phaseRemainingMs != 0 (countdown only outside playing)", () => {
    const program = createDefaultMechanicsProgram();
    const config = localDuel("play-phase-remaining");
    const base = program.initial(config);
    const raw = cloneDraft(asPlayingWorld(program, base));
    raw.slices.match.phaseRemainingMs = TICK_DURATION_MS;
    expect(() => program.restore(raw)).toThrow(/playing requires phaseRemainingMs == 0/);
  });

  it("valid round-over world remains restorable and steppable after idle post-round ticks", () => {
    const program = createDefaultMechanicsProgram();
    const short = createLocalDuel1v1MatchConfig({
      seed: "post-round-restore",
      roundDurationMs: 5_000,
    });
    let state = asRoundOverWorld(
      program,
      program.initial(short),
      short.seats[1]!.competitorId,
      { phaseRemainingMs: ROUND_END_MS },
    );
    expect(state.slices.match.phase).toBe("round-over");

    for (let i = 0; i < 5; i += 1) {
      state = program.step(state, { commands: [] }).state;
    }
    expect(state.slices.match.phase).toBe("round-over");
    expect(state.slices.match.phaseRemainingMs).toBe(ROUND_END_MS - 5 * TICK_DURATION_MS);

    const restored = program.restore(JSON.parse(JSON.stringify(state)));
    expect(restored).toEqual(state);
    const after = program.step(restored, { commands: [] }).state;
    expect(after.tick).toBe(restored.tick + 1);
    expect(after.slices.match.phase).toBe("round-over");
    // phase countdown write bumps stateRevision during round-over interval.
    expect(after.stateRevision).toBe(restored.stateRevision + 1);
  });

  it("16 ticks movem exatamente 1 tile; 1/2/1000 ticks sem drift", () => {
    const config = localDuel("drift-gate");
    const program = createDefaultMechanicsProgram();
    let state = enterPlaying(program, program.initial(config));
    const seat0 = config.seats[0]!.seatId;
    const spawn = tileCenter({ x: 1, y: 1 });

    // Press right: intent + locomotion same tick applies the first step immediately.
    state = program.step(state, {
      commands: [
        {
          tick: state.tick,
          sequence: 0,
          seatId: seat0,
          command: { type: "set-movement", direction: "right", pressed: true },
        },
      ],
    }).state;
    expect(state.slices.locomotion.entries[0]!.position).toEqual({
      x: spawn.x + BASE_SPEED_UNITS_PER_TICK,
      y: spawn.y,
    });

    // Second tick of held movement.
    state = program.step(state, { commands: [] }).state;
    expect(state.slices.locomotion.entries[0]!.position).toEqual({
      x: spawn.x + BASE_SPEED_UNITS_PER_TICK * 2,
      y: spawn.y,
    });

    // 14 more held ticks → 16 total → exactly +1 tile (1024 units).
    for (let i = 0; i < 14; i += 1) {
      state = program.step(state, { commands: [] }).state;
    }
    expect(state.slices.locomotion.entries[0]!.position).toEqual(tileCenter({ x: 2, y: 1 }));
    expect(tileOf(state.slices.locomotion.entries[0]!.position)).toEqual({ x: 2, y: 1 });

    // 1000 further ticks: no fractional drift — position stays on the integer speed lattice.
    for (let i = 0; i < 1000; i += 1) {
      state = program.step(state, { commands: [] }).state;
    }
    const pos = state.slices.locomotion.entries[0]!.position;
    expect(Number.isInteger(pos.x)).toBe(true);
    expect(Number.isInteger(pos.y)).toBe(true);
    expect((pos.x - spawn.x) % BASE_SPEED_UNITS_PER_TICK).toBe(0);
  });

  it("JSON restore mid-movement converges to identical state/events", () => {
    const config = localDuel("restore-mid-move");
    const program = createDefaultMechanicsProgram();
    const seat0 = config.seats[0]!.seatId;
    let state = enterPlaying(program, program.initial(config));
    state = program.step(state, {
      commands: [
        {
          tick: state.tick,
          sequence: 0,
          seatId: seat0,
          command: { type: "set-movement", direction: "right", pressed: true },
        },
      ],
    }).state;
    for (let i = 0; i < 5; i += 1) {
      state = program.step(state, { commands: [] }).state;
    }
    const restored = program.restore(JSON.parse(JSON.stringify(state)));
    expect(restored).toEqual(state);
    const a = program.step(state, { commands: [] });
    const b = program.step(restored, { commands: [] });
    expect(a.state).toEqual(b.state);
    expect(a.events).toEqual(b.events);
  });

  it("lane assist: 460 vs 461, max 128, lock 77 vs 78 after correction, clamp, perpendicular vs opposite", () => {
    const config = localDuel("lane-assist");
    const program = createDefaultMechanicsProgram();
    const alpha = config.seats[0]!.competitorId;
    const beta = config.seats[1]!.competitorId;
    const seat0 = config.seats[0]!.seatId;
    const base = program.initial(config);

    function openWorld(
      position: WorldPosition,
      lastDirection: LocomotionEntry["lastDirection"] = null,
    ): WorldState {
      return asPlayingWorld(program, base, {
        arena: {
          width: 11,
          height: 9,
          solid: base.slices.arena.solid,
          crates: [],
        },
        locomotion: {
          entries: [
            {
              competitorId: alpha,
              position,
              velocity: freezeVelocity({ x: 0, y: 0 }),
              lastDirection,
            },
            locoAt(beta, 9, 7),
          ],
        },
      });
    }

    function stepRight(world: WorldState, sequence: number): WorldState {
      return program.step(world, {
        commands: [
          {
            tick: world.tick,
            sequence,
            seatId: seat0,
            command: { type: "set-movement", direction: "right", pressed: true },
          },
        ],
      }).state;
    }

    // Offset 100: assist corrects min(128,100)=100 → center, then longitudinal +64.
    const clampStart = posAt(1, 3, 0, 100);
    const clamped = stepRight(openWorld(clampStart), 0).slices.locomotion.entries[0]!;
    expect(clamped.position.y).toBe(tileCenter({ x: 1, y: 3 }).y);
    expect(clamped.position.x).toBe(clampStart.x + BASE_SPEED_UNITS_PER_TICK);

    // Assist boundary: 460 corrects (partial), 461 does not assist.
    const at460 = posAt(1, 3, 0, LANE_ASSIST_MAX_OFFSET);
    const after460 = stepRight(openWorld(at460), 1).slices.locomotion.entries[0]!;
    expect(after460.position.y).toBe(at460.y - LANE_CORRECTION_MAX);
    // Remaining transverse 460-128=332 > lock → no longitudinal.
    expect(after460.position.x).toBe(at460.x);

    const at461 = posAt(1, 3, 0, LANE_ASSIST_MAX_OFFSET + 1);
    const after461 = stepRight(openWorld(at461, null), 2).slices.locomotion.entries[0]!;
    expect(after461.position).toEqual(at461);
    expect(after461.velocity).toEqual({ x: 0, y: 0 });

    // Effective lock after max correction: 205 → 77 allows long; 206 → 78 blocks long.
    const lockOk = posAt(1, 3, 0, LANE_CORRECTION_MAX + LANE_LONGITUDINAL_LOCK); // 205
    const afterLockOk = stepRight(openWorld(lockOk), 3).slices.locomotion.entries[0]!;
    expect(afterLockOk.position.y).toBe(lockOk.y - LANE_CORRECTION_MAX);
    expect(Math.abs(afterLockOk.position.y - tileCenter({ x: 1, y: 3 }).y)).toBe(
      LANE_LONGITUDINAL_LOCK,
    );
    expect(afterLockOk.position.x).toBe(lockOk.x + BASE_SPEED_UNITS_PER_TICK);

    const lockNo = posAt(1, 3, 0, LANE_CORRECTION_MAX + LANE_LONGITUDINAL_LOCK + 1); // 206
    const afterLockNo = stepRight(openWorld(lockNo), 4).slices.locomotion.entries[0]!;
    expect(afterLockNo.position.y).toBe(lockNo.y - LANE_CORRECTION_MAX);
    expect(Math.abs(afterLockNo.position.y - tileCenter({ x: 1, y: 3 }).y)).toBe(
      LANE_LONGITUDINAL_LOCK + 1,
    );
    expect(afterLockNo.position.x).toBe(lockNo.x);

    // Use solid border wall at x=0: exact right contact with tile (0,2)
    // (sparse border: even-y left column is solid, Decision 011).
    // tile (0,2) right edge = 1024; body.x - 384 = 1024 → body.x = 1408.
    const wallContact = freezePosition({
      x: UNITS_PER_TILE + BODY_HALF_EXTENT,
      y: tileCenter({ x: 1, y: 2 }).y,
    });
    expect(bodyOverlapsTile(wallContact, { x: 0, y: 2 })).toBe(false);
    expect(
      bodyOverlapsTile(
        freezePosition({ x: wallContact.x - 1, y: wallContact.y }),
        { x: 0, y: 2 },
      ),
    ).toBe(true);

    // Opposite intent (left into wall) with lastDirection right must NOT continue right.
    const oppositeWorld = openWorld(wallContact, "right");
    const oppositeBlocked = program.step(oppositeWorld, {
      commands: [
        {
          tick: oppositeWorld.tick,
          sequence: 5,
          seatId: seat0,
          command: { type: "set-movement", direction: "left", pressed: true },
        },
      ],
    }).state.slices.locomotion.entries[0]!;
    expect(oppositeBlocked.position).toEqual(wallContact);
    expect(oppositeBlocked.velocity).toEqual({ x: 0, y: 0 });

    // Perpendicular: left into wall, lastDirection down continues (with lane assist on X).
    // Vertical continue uses lane center X of current tile (1,2) → x=1536, then +64 Y.
    const laneCenterX = tileCenter({ x: 1, y: 2 }).x;
    const perpWorld = openWorld(wallContact, "down");
    const perp = program.step(perpWorld, {
      commands: [
        {
          tick: perpWorld.tick,
          sequence: 6,
          seatId: seat0,
          command: { type: "set-movement", direction: "left", pressed: true },
        },
      ],
    }).state.slices.locomotion.entries[0]!;
    expect(perp.position.x).toBe(laneCenterX);
    expect(perp.position.y).toBe(wallContact.y + BASE_SPEED_UNITS_PER_TICK);
    expect(perp.lastDirection).toBe("down");
  });

  it("P1: blocked opposite at left wall keeps position and zero velocity (no lastDirection reverse)", () => {
    const config = localDuel("p1-opposite-wall");
    const program = createDefaultMechanicsProgram();
    const alpha = config.seats[0]!.competitorId;
    const beta = config.seats[1]!.competitorId;
    const seat0 = config.seats[0]!.seatId;
    const base = program.initial(config);
    // Exact contact with left border solid tile (0,2) (sparse border, Decision 011).
    const contact = freezePosition({
      x: UNITS_PER_TILE + BODY_HALF_EXTENT,
      y: tileCenter({ x: 1, y: 2 }).y,
    });
    const world = asPlayingWorld(program, base, {
      arena: {
        width: 11,
        height: 9,
        solid: [...base.slices.arena.solid],
        crates: [],
      },
      locomotion: {
        entries: [
          {
            competitorId: alpha,
            position: contact,
            velocity: freezeVelocity({ x: BASE_SPEED_UNITS_PER_TICK, y: 0 }),
            lastDirection: "right",
          },
          locoAt(beta, 9, 7),
        ],
      },
    });
    const next = program.step(world, {
      commands: [
        {
          tick: world.tick,
          sequence: 0,
          seatId: seat0,
          command: { type: "set-movement", direction: "left", pressed: true },
        },
      ],
    }).state;
    const entry = next.slices.locomotion.entries[0]!;
    expect(entry.position).toEqual(contact);
    expect(entry.velocity).toEqual({ x: 0, y: 0 });
    expect(entry.lastDirection).toBe("right");
  });

  it("AABB geometry integrated: four-side solid/crate contact stays put; corner loop never overlaps terrain", () => {
    const config = localDuel("aabb-integrated");
    const program = createDefaultMechanicsProgram();
    const alpha = config.seats[0]!.competitorId;
    const beta = config.seats[1]!.competitorId;
    const seat0 = config.seats[0]!.seatId;
    const base = program.initial(config);

    // Pillar solid (2,4) (classic pillar seed, Decision 011). Exact contacts from four sides.
    const pillar = { x: 2, y: 4 };
    const pillarLeft = 2 * UNITS_PER_TILE;
    const pillarRight = 3 * UNITS_PER_TILE;
    const pillarTop = 4 * UNITS_PER_TILE;
    const pillarBottom = 5 * UNITS_PER_TILE;
    const contacts: Array<{ pos: WorldPosition; dir: "up" | "down" | "left" | "right" }> = [
      {
        // from above: body bottom == pillar top
        pos: freezePosition({
          x: tileCenter(pillar).x,
          y: pillarTop - BODY_HALF_EXTENT,
        }),
        dir: "down",
      },
      {
        // from below
        pos: freezePosition({
          x: tileCenter(pillar).x,
          y: pillarBottom + BODY_HALF_EXTENT,
        }),
        dir: "up",
      },
      {
        // from left
        pos: freezePosition({
          x: pillarLeft - BODY_HALF_EXTENT,
          y: tileCenter(pillar).y,
        }),
        dir: "right",
      },
      {
        // from right
        pos: freezePosition({
          x: pillarRight + BODY_HALF_EXTENT,
          y: tileCenter(pillar).y,
        }),
        dir: "left",
      },
    ];

    for (const { pos, dir } of contacts) {
      expect(bodyOverlapsTile(pos, pillar)).toBe(false);
      const world = asPlayingWorld(program, base, {
        arena: {
          width: 11,
          height: 9,
          solid: [...base.slices.arena.solid],
          crates: [],
        },
        locomotion: {
          entries: [
            {
              competitorId: alpha,
              position: pos,
              velocity: freezeVelocity({ x: 0, y: 0 }),
              lastDirection: null,
            },
            locoAt(beta, 9, 7),
          ],
        },
      });
      const next = program.step(world, {
        commands: [
          {
            tick: world.tick,
            sequence: 0,
            seatId: seat0,
            command: { type: "set-movement", direction: dir, pressed: true },
          },
        ],
      }).state;
      const entry = next.slices.locomotion.entries[0]!;
      expect(entry.position).toEqual(pos);
      expect(entry.velocity).toEqual({ x: 0, y: 0 });
      expect(bodyOverlapsTile(entry.position, pillar)).toBe(false);
    }

    // Canonical crate equivalent: exact-contact from left against a seed-legal crate.
    const crateTile = base.slices.arena.crates[0];
    expect(crateTile).toBeDefined();
    const crateContact = freezePosition({
      x: crateTile!.x * UNITS_PER_TILE - BODY_HALF_EXTENT,
      y: tileCenter({ x: crateTile!.x - 1, y: crateTile!.y }).y,
    });
    // If the legal crate is not approachable from left on free corridor, still assert contact geometry.
    expect(bodyOverlapsTile(crateContact, crateTile!)).toBe(false);
    const crateWorld = asPlayingWorld(program, base, {
      arena: {
        width: 11,
        height: 9,
        solid: [...base.slices.arena.solid],
        crates: base.slices.arena.crates.filter(
          (tile) => tile.x === crateTile!.x && tile.y === crateTile!.y,
        ),
      },
      locomotion: {
        entries: [
          {
            competitorId: alpha,
            position: crateContact,
            velocity: freezeVelocity({ x: 0, y: 0 }),
            lastDirection: null,
          },
          locoAt(beta, 9, 7),
        ],
      },
    });
    const crateNext = program.step(crateWorld, {
      commands: [
        {
          tick: crateWorld.tick,
          sequence: 0,
          seatId: seat0,
          command: { type: "set-movement", direction: "right", pressed: true },
        },
      ],
    }).state;
    expect(crateNext.slices.locomotion.entries[0]!.position).toEqual(crateContact);
    expect(crateNext.slices.locomotion.entries[0]!.velocity).toEqual({ x: 0, y: 0 });

    // Corner loop: walk near spawn corridor; never overlap solid/crate.
    let corner = asPlayingWorld(program, base, {
      arena: {
        width: 11,
        height: 9,
        solid: [...base.slices.arena.solid],
        crates: [],
      },
      locomotion: {
        entries: [locoAt(alpha, 1, 1), locoAt(beta, 9, 7)],
      },
    });
    const path: Array<"right" | "down" | "left" | "up"> = [
      "right",
      "right",
      "down",
      "down",
      "left",
      "left",
      "up",
      "up",
    ];
    let seq = 0;
    for (const dir of path) {
      corner = program.step(corner, {
        commands: [
          {
            tick: corner.tick,
            sequence: seq,
            seatId: seat0,
            command: { type: "set-movement", direction: dir, pressed: true },
          },
        ],
      }).state;
      seq += 1;
      for (let t = 0; t < 8; t += 1) {
        corner = program.step(corner, { commands: [] }).state;
        const body = corner.slices.locomotion.entries[0]!.position;
        for (const solid of corner.slices.arena.solid) {
          expect(bodyOverlapsTile(body, solid)).toBe(false);
        }
        for (const crate of corner.slices.arena.crates) {
          expect(bodyOverlapsTile(body, crate)).toBe(false);
        }
      }
    }
  });

  it("batch 2–4: bodies never block (head-on/stationary/chain/follow/dead); impossible swap rejected; reorder independent", () => {
    const a = "a" as CompetitorId;
    const b = "b" as CompetitorId;
    const c = "c" as CompetitorId;
    const d = "d" as CompetitorId;
    const step = BASE_SPEED_UNITS_PER_TICK;

    function entry(id: CompetitorId, x: number, y: number): LocomotionEntry {
      return Object.freeze({
        competitorId: id,
        position: freezePosition({ x, y }),
        velocity: freezeVelocity({ x: 0, y: 0 }),
        lastDirection: null,
      });
    }

    function cand(
      id: CompetitorId,
      from: WorldPosition,
      dx: number,
      dy: number,
      direction: MovementCandidate["direction"],
    ): MovementCandidate {
      return Object.freeze({
        competitorId: id,
        from,
        to: freezePosition({ x: from.x + dx, y: from.y + dy }),
        direction,
      });
    }

    // Head-on from valid exact contact: bodies never block (Decision 012) —
    // both penetrate and are accepted.
    const aFrom = freezePosition({ x: 1000, y: 2000 });
    const bFrom = freezePosition({ x: 1000 + BODY_HALF_EXTENT * 2, y: 2000 });
    expect(bodiesOverlap(aFrom, bFrom)).toBe(false);
    expect(
      [
        ...resolveMovementBatch(
          [entry(a, aFrom.x, aFrom.y), entry(b, bFrom.x, bFrom.y)],
          [
            cand(a, aFrom, step, 0, "right"),
            cand(b, bFrom, -step, 0, "left"),
          ],
        ),
      ].sort(),
    ).toEqual([a, b]);

    // Invade stationary (no candidate for B): the invader passes through.
    const invFrom = freezePosition({ x: 1500, y: 1500 });
    const closeStat = freezePosition({ x: invFrom.x + BODY_HALF_EXTENT * 2, y: invFrom.y });
    expect(bodiesOverlap(invFrom, closeStat)).toBe(false);
    expect(
      [
        ...resolveMovementBatch(
          [entry(a, invFrom.x, invFrom.y), entry(b, closeStat.x, closeStat.y)],
          [cand(a, invFrom, step, 0, "right")],
        ),
      ],
    ).toEqual([a]);

    // Chain toward stationary C: A→B, B→C → both advance through the bodies.
    const cPos = freezePosition({ x: 3000, y: 1500 });
    const bPos = freezePosition({ x: cPos.x - BODY_HALF_EXTENT * 2, y: 1500 });
    const aPos = freezePosition({ x: bPos.x - BODY_HALF_EXTENT * 2, y: 1500 });
    expect(bodiesOverlap(aPos, bPos)).toBe(false);
    expect(bodiesOverlap(bPos, cPos)).toBe(false);
    expect(
      [
        ...resolveMovementBatch(
          [entry(a, aPos.x, aPos.y), entry(b, bPos.x, bPos.y), entry(c, cPos.x, cPos.y)],
          [cand(a, aPos, step, 0, "right"), cand(b, bPos, step, 0, "right")],
        ),
      ].sort(),
    ).toEqual([a, b]);

    // Follow: both advance same step with finals non-overlapping.
    const fA = freezePosition({ x: 1200, y: 1600 });
    const fB = freezePosition({ x: 1200 + BODY_HALF_EXTENT * 2 + 50, y: 1600 });
    const follow = resolveMovementBatch(
      [entry(a, fA.x, fA.y), entry(b, fB.x, fB.y)],
      [cand(a, fA, step, 0, "right"), cand(b, fB, step, 0, "right")],
    );
    expect([...follow].sort()).toEqual([a, b]);

    // Dead body not in livingEntries → its candidate is ignored.
    expect(
      [...resolveMovementBatch([entry(a, fA.x, fA.y)], [cand(a, fA, step, 0, "right")])],
    ).toEqual([a]);

    // Impossible full-tile swap/crossing (>128 per component) never accepted.
    const swap = resolveMovementBatch(
      [locoAt(a, 1, 1), locoAt(b, 2, 1)],
      [
        {
          competitorId: a,
          from: tileCenter({ x: 1, y: 1 }),
          to: tileCenter({ x: 2, y: 1 }),
          direction: "right",
        },
        {
          competitorId: b,
          from: tileCenter({ x: 2, y: 1 }),
          to: tileCenter({ x: 1, y: 1 }),
          direction: "left",
        },
      ],
    );
    expect(swap.size).toBe(0);

    // Candidate with one component 129 alone is rejected.
    const over = resolveMovementBatch(
      [entry(a, 1500, 1500)],
      [cand(a, freezePosition({ x: 1500, y: 1500 }), LANE_CORRECTION_MAX + 1, 0, "right")],
    );
    expect(over.size).toBe(0);

    // Non-trivial 4-player permutation: every in-step candidate is accepted,
    // order-independent (C has no candidate and is simply not in the set).
    const pA = freezePosition({ x: 2000, y: 2000 });
    const pB = freezePosition({ x: pA.x + BODY_HALF_EXTENT * 2, y: 2000 });
    const pC = freezePosition({ x: pB.x + BODY_HALF_EXTENT * 2, y: 2000 });
    const pD = freezePosition({ x: 2000, y: 4000 });
    const four: MovementCandidate[] = [
      cand(a, pA, step, 0, "right"),
      cand(b, pB, step, 0, "right"),
      cand(d, pD, step, 0, "right"),
    ];
    const living = [
      entry(a, pA.x, pA.y),
      entry(b, pB.x, pB.y),
      entry(c, pC.x, pC.y),
      entry(d, pD.x, pD.y),
    ];
    const r1 = resolveMovementBatch(living, four);
    const r2 = resolveMovementBatch(living, [...four].reverse());
    const r3 = resolveMovementBatch([...living].reverse(), four);
    expect([...r1].sort()).toEqual([a, b, d]);
    expect([...r2].sort()).toEqual([a, b, d]);
    expect([...r3].sort()).toEqual([a, b, d]);
  });

  it("bomba: egress, free pass-through while overlapping, reentry, tileOf frontier, third body", () => {
    const config = localDuel("bomb-egress");
    const program = createDefaultMechanicsProgram();
    const alpha = config.seats[0]!.competitorId;
    const beta = config.seats[1]!.competitorId;
    const seat0 = config.seats[0]!.seatId;
    const initial = program.initial(config);

    let state = asPlayingWorld(program, initial, {
      arena: {
        width: 11,
        height: 9,
        solid: [...initial.slices.arena.solid],
        crates: [],
      },
    });

    // Place bomb at spawn; same-tick egress starts on locomotion after command.
    const placed = program.step(state, {
      commands: [
        {
          tick: state.tick,
          sequence: 0,
          seatId: seat0,
          command: { type: "place-bomb" },
        },
        {
          tick: state.tick,
          sequence: 1,
          seatId: seat0,
          command: { type: "set-movement", direction: "right", pressed: true },
        },
      ],
    });
    expect(placed.events.some((e) => e.type === "bomb-placed")).toBe(true);
    expect(placed.state.slices.bombs.items[0]!.tile).toEqual({ x: 1, y: 1 });
    expect(placed.state.slices.locomotion.entries[0]!.position.x).toBeGreaterThan(
      tileCenter({ x: 1, y: 1 }).x,
    );

    // Still overlapping bomb: reversing back across the center is allowed
    // (free pass-through while any overlap persists — Decision 012).
    state = placed.state;
    expect(
      bodyOverlapsTile(
        state.slices.locomotion.entries[0]!.position,
        state.slices.bombs.items[0]!.tile,
      ),
    ).toBe(true);
    const beforeReverse = state.slices.locomotion.entries[0]!.position;
    state = program.step(state, {
      commands: [
        {
          tick: state.tick,
          sequence: 2,
          seatId: seat0,
          command: { type: "set-movement", direction: "left", pressed: true },
        },
      ],
    }).state;
    expect(state.slices.locomotion.entries[0]!.position.x).toBeLessThan(beforeReverse.x);
    expect(state.slices.locomotion.entries[0]!.velocity).toEqual({
      x: -BASE_SPEED_UNITS_PER_TICK,
      y: 0,
    });
    expect(
      bodyOverlapsTile(
        state.slices.locomotion.entries[0]!.position,
        state.slices.bombs.items[0]!.tile,
      ),
    ).toBe(true);

    // Resume egress right until clear, then reentry blocked.
    state = program.step(state, {
      commands: [
        {
          tick: state.tick,
          sequence: 3,
          seatId: seat0,
          command: { type: "set-movement", direction: "right", pressed: true },
        },
      ],
    }).state;
    for (let i = 0; i < 20; i += 1) {
      state = program.step(state, { commands: [] }).state;
    }
    expect(
      bodyOverlapsTile(
        state.slices.locomotion.entries[0]!.position,
        state.slices.bombs.items[0]!.tile,
      ),
    ).toBe(false);

    state = program.step(state, {
      commands: [
        {
          tick: state.tick,
          sequence: 4,
          seatId: seat0,
          command: { type: "set-movement", direction: "left", pressed: true },
        },
      ],
    }).state;
    for (let i = 0; i < 40; i += 1) {
      state = program.step(state, { commands: [] }).state;
    }
    expect(
      bodyOverlapsTile(
        state.slices.locomotion.entries[0]!.position,
        state.slices.bombs.items[0]!.tile,
      ),
    ).toBe(false);

    // tileOf on exact tile frontier: x = 2*1024 → tile x=2.
    const frontier = freezePosition({ x: 2 * UNITS_PER_TILE, y: tileCenter({ x: 1, y: 1 }).y });
    expect(tileOf(frontier)).toEqual({ x: 2, y: 1 });
    expect(tileOf(freezePosition({ x: 2 * UNITS_PER_TILE - 1, y: frontier.y }))).toEqual({
      x: 1,
      y: 1,
    });

    const frontierWorld = asPlayingWorld(program, initial, {
      arena: {
        width: 11,
        height: 9,
        solid: [...initial.slices.arena.solid],
        crates: [],
      },
      locomotion: {
        entries: [
          {
            competitorId: alpha,
            position: frontier,
            velocity: freezeVelocity({ x: 0, y: 0 }),
            lastDirection: null,
          },
          locoAt(beta, 9, 7),
        ],
      },
    });
    const frontierPlaced = program.step(frontierWorld, {
      commands: [{
        tick: frontierWorld.tick,
        sequence: 0,
        seatId: seat0,
        command: { type: "place-bomb" },
      }],
    });
    expect(frontierPlaced.state.slices.bombs.items[0]?.tile).toEqual({ x: 2, y: 1 });

    // Third living body overlapping target tile blocks placement.
    const near = asPlayingWorld(program, initial, {
      arena: {
        width: 11,
        height: 9,
        solid: [...initial.slices.arena.solid],
        crates: [],
      },
      locomotion: {
        entries: [
          locoAt(alpha, 2, 1),
          {
            competitorId: beta,
            position: freezePosition({
              x: tileCenter({ x: 2, y: 1 }).x + BODY_HALF_EXTENT * 2,
              y: tileCenter({ x: 2, y: 1 }).y,
            }),
            velocity: freezeVelocity({ x: 0, y: 0 }),
            lastDirection: null,
          },
        ],
      },
    });
    // Rival body overlapping the target tile no longer blocks placement
    // (Decision 012): the bomb lands and the rival walks off with the
    // pre-overlap geometric egress.
    expect(bodyOverlapsTile(near.slices.locomotion.entries[1]!.position, { x: 2, y: 1 })).toBe(
      true,
    );
    expect(
      bodiesOverlap(
        near.slices.locomotion.entries[0]!.position,
        near.slices.locomotion.entries[1]!.position,
      ),
    ).toBe(false);
    const plantedUnder = program.step(near, {
      commands: [
        {
          tick: near.tick,
          sequence: 0,
          seatId: seat0,
          command: { type: "place-bomb" },
        },
      ],
    });
    expect(plantedUnder.rejections).toHaveLength(0);
    expect(plantedUnder.events.some((e) => e.type === "bomb-placed")).toBe(true);
    expect(plantedUnder.state.slices.bombs.items).toHaveLength(1);
  });

  it("chama: ≥30% body area on flame tile kills; ~10% edge clip survives (mechanics-v7)", () => {
    const config = localDuel("flame-overlap-30");
    const program = createDefaultMechanicsProgram();
    const alpha = config.seats[0]!.competitorId;
    const beta = config.seats[1]!.competitorId;
    const base = program.initial(config);
    const flameTile = freezeTile({ x: 3, y: 1 });
    const y = tileCenter({ x: 2, y: 1 }).y;
    const bodySpan = BODY_HALF_EXTENT * 2;

    // Horizontal clip into flame tile (3,1): overlap width / bodySpan = fraction
    // (body is square; full-height overlap ⇒ area fraction = width fraction).
    // Area fraction = overlapWidth / bodySpan when the clip is full-height.
    const atOverlapWidth = (width: number) =>
      freezePosition({
        x: 3 * UNITS_PER_TILE - BODY_HALF_EXTENT + width,
        y,
      });

    const shallow = atOverlapWidth(Math.floor(0.1 * bodySpan)); // ~10%
    const lethal = atOverlapWidth(Math.ceil(0.3 * bodySpan)); // ≥30%
    const deep = atOverlapWidth(Math.ceil(0.35 * bodySpan));
    expect(bodyTileOverlapArea(shallow, flameTile) / (bodySpan * bodySpan)).toBeLessThan(0.3);
    expect(bodyTileOverlapArea(lethal, flameTile) / (bodySpan * bodySpan)).toBeGreaterThanOrEqual(0.3);
    expect(bodyTileOverlapArea(deep, flameTile) / (bodySpan * bodySpan)).toBeGreaterThan(0.3);

    const worldAt = (position: ReturnType<typeof freezePosition>) =>
      asPlayingWorld(program, base, {
        arena: {
          width: 11,
          height: 9,
          solid: [...base.slices.arena.solid],
          crates: [],
        },
        locomotion: {
          entries: [
            {
              competitorId: alpha,
              position,
              velocity: freezeVelocity({ x: 0, y: 0 }),
              lastDirection: null,
            },
            locoAt(beta, 9, 7),
          ],
        },
        bombs: {
          nextId: 2,
          items: [
            {
              id: 1,
              ownerId: beta,
              tile: freezeTile({ x: 5, y: 1 }),
              fuseMs: 20,
              flameRange: 2,
          echo: false,
            },
          ],
        },
      });

    // ~10% into the cross arm → survives.
    const shallowStep = program.step(worldAt(shallow), { commands: [] });
    expect(shallowStep.events.some((e) => e.type === "bomb-exploded")).toBe(true);
    expect(
      shallowStep.state.slices.vitals.entries.find((e) => e.competitorId === alpha)?.alive,
    ).toBe(true);

    // ≥30% on the blast tile → dies.
    const lethalStep = program.step(worldAt(lethal), { commands: [] });
    expect(lethalStep.events.some((e) => e.type === "competitor-eliminated")).toBe(true);
    expect(
      lethalStep.state.slices.vitals.entries.find((e) => e.competitorId === alpha)?.alive,
    ).toBe(false);

    // Fully on flame tile center → dies.
    const centerStep = program.step(worldAt(tileCenter(flameTile)), { commands: [] });
    expect(centerStep.events.some((e) => e.type === "competitor-eliminated")).toBe(true);

    // Exact edge contact (0 area) survives.
    const exactPos = freezePosition({
      x: 3 * UNITS_PER_TILE - BODY_HALF_EXTENT,
      y,
    });
    expect(bodyOverlapsTile(exactPos, flameTile)).toBe(false);

    // Exact contact with active flame is allowed (0 area → fraction 0).
    const exactWorld = asPlayingWorld(program, base, {
      arena: {
        width: 11,
        height: 9,
        solid: [...base.slices.arena.solid],
        crates: [],
      },
      locomotion: {
        entries: [
          {
            competitorId: alpha,
            position: exactPos,
            velocity: freezeVelocity({ x: 0, y: 0 }),
            lastDirection: null,
          },
          locoAt(beta, 9, 7),
        ],
      },
      bombs: { nextId: 2, items: [] },
      flames: {
        items: [
          {
            tile: freezeTile({ x: 3, y: 1 }),
            remainingMs: 600,
            causes: [{ bombId: 1, ownerId: alpha }],
          },
        ],
      },
    });
    const exactStep = program.step(exactWorld, { commands: [] });
    expect(
      exactStep.state.slices.vitals.entries.find((e) => e.competitorId === alpha)?.alive,
    ).toBe(true);
  });

  it("bomba: corpo fora do centro com saida unica alem do centro nao fica preso (Decision 012)", () => {
    const config = localDuel("bomb-trap");
    const program = createDefaultMechanicsProgram();
    const alpha = config.seats[0]!.competitorId;
    const beta = config.seats[1]!.competitorId;
    const seat0 = config.seats[0]!.seatId;
    const initial = program.initial(config);

    // Off-center body inside tile (1,1): left lane blocked by a crate, lane
    // assist lock exceeded — under the old monotone egress this was a trap.
    const center = tileCenter({ x: 1, y: 1 });
    const offCenter = freezePosition({ x: center.x - 100, y: center.y });
    expect(bodyOverlapsTile(offCenter, { x: 1, y: 1 })).toBe(true);
    expect(bodyOverlapsTile(offCenter, { x: 0, y: 1 })).toBe(false);
    let state = asPlayingWorld(program, initial, {
      arena: {
        width: 11,
        height: 9,
        solid: [...initial.slices.arena.solid],
        crates: [freezeTile({ x: 0, y: 1 })],
      },
      locomotion: {
        entries: [
          {
            competitorId: alpha,
            position: offCenter,
            velocity: freezeVelocity({ x: 0, y: 0 }),
            lastDirection: null,
          },
          locoAt(beta, 9, 7),
        ],
      },
    });

    state = program.step(state, {
      commands: [
        {
          tick: state.tick,
          sequence: 0,
          seatId: seat0,
          command: { type: "place-bomb" },
        },
      ],
    }).state;
    expect(state.slices.bombs.items[0]!.tile).toEqual({ x: 1, y: 1 });

    // Hold right: crosses the bomb tile center and fully clears the tile.
    state = program.step(state, {
      commands: [
        {
          tick: state.tick,
          sequence: 1,
          seatId: seat0,
          command: { type: "set-movement", direction: "right", pressed: true },
        },
      ],
    }).state;
    for (let i = 0; i < 30; i += 1) {
      state = program.step(state, { commands: [] }).state;
    }
    const escaped = state.slices.locomotion.entries[0]!.position;
    expect(escaped.x).toBeGreaterThan(center.x);
    expect(bodyOverlapsTile(escaped, { x: 1, y: 1 })).toBe(false);
  });

  it("chama: janela letal — nevoa residual nao mata; explosao nova rearma (Decision 012)", () => {
    const config = localDuel("flame-lethal-window");
    const program = createDefaultMechanicsProgram();
    const alpha = config.seats[0]!.competitorId;
    const beta = config.seats[1]!.competitorId;
    const seat0 = config.seats[0]!.seatId;
    const base = program.initial(config);

    const makeWorld = (
      remainingMs: number,
      opts: { playerTile?: { x: number; y: number }; bomb?: boolean } = {},
    ) => {
      const playerTile = opts.playerTile ?? { x: 4, y: 1 };
      return asPlayingWorld(program, base, {
        arena: {
          width: 11,
          height: 9,
          solid: [...base.slices.arena.solid],
          crates: [],
        },
        locomotion: {
          entries: [
            {
              competitorId: alpha,
              position: tileCenter(playerTile),
              velocity: freezeVelocity({ x: 0, y: 0 }),
              lastDirection: null,
            },
            locoAt(beta, 9, 7),
          ],
        },
        ...(opts.bomb
          ? {
              bombs: {
                nextId: 2,
                items: [
                  {
                    id: 1,
                    ownerId: beta,
                    tile: freezeTile({ x: 4, y: 1 }),
                    fuseMs: TICK_DURATION_MS,
                    flameRange: 1,
          echo: false,
                  },
                ],
              },
            }
          : {}),
        flames: {
          items: [
            {
              tile: freezeTile({ x: 4, y: 1 }),
              remainingMs,
              causes: [{ bombId: 9, ownerId: beta }],
            },
          ],
        },
      });
    };

    // Fresh flame (lethal window) on the body → dies.
    const fresh = program.step(makeWorld(600), { commands: [] });
    expect(fresh.events.some((e) => e.type === "competitor-eliminated")).toBe(true);
    expect(
      fresh.state.slices.vitals.entries.find((e) => e.competitorId === alpha)?.alive,
    ).toBe(false);

    // Residual fog (past the lethal window): stand and walk through → survives.
    const fogWorld = makeWorld(400, { playerTile: { x: 3, y: 1 } });
    let fog = program.step(fogWorld, {
      commands: [
        {
          tick: fogWorld.tick,
          sequence: 0,
          seatId: seat0,
          command: { type: "set-movement", direction: "right", pressed: true },
        },
      ],
    }).state;
    for (let i = 0; i < 20; i += 1) {
      fog = program.step(fog, { commands: [] }).state;
    }
    const walker = fog.slices.locomotion.entries[0]!;
    expect(
      fog.slices.vitals.entries.find((e) => e.competitorId === alpha)?.alive,
    ).toBe(true);
    // Walked across the whole fog tile without dying.
    expect(walker.position.x).toBeGreaterThan(tileCenter({ x: 4, y: 1 }).x);

    // New explosion on the fog tile refreshes remainingMs → lethal again.
    const refreshed = program.step(makeWorld(400, { bomb: true }), { commands: [] });
    expect(refreshed.events.some((e) => e.type === "bomb-exploded")).toBe(true);
    expect(refreshed.events.some((e) => e.type === "competitor-eliminated")).toBe(true);
  });

  it("restore rejects impossible velocity 129/-129/huge; non-safe, float; out-of-range positions normalize modulo the torus", () => {
    const program = createDefaultMechanicsProgram();
    const reversed = createDefaultMechanicsProgram("reversed");
    expect(program.mechanicsRevision).toBe(reversed.mechanicsRevision);
    const config = localDuel("slice2-validate");
    const initialA = program.initial(config);
    const initialB = reversed.initial(config);
    expect(initialA).toEqual(initialB);

    const seat0 = config.seats[0]!.seatId;
    const stepA = program.step(initialA, {
      commands: [
        {
          tick: initialA.tick,
          sequence: 0,
          seatId: seat0,
          command: { type: "set-movement", direction: "down", pressed: true },
        },
      ],
    });
    const stepB = reversed.step(initialB, {
      commands: [
        {
          tick: initialB.tick,
          sequence: 0,
          seatId: seat0,
          command: { type: "set-movement", direction: "down", pressed: true },
        },
      ],
    });
    expect(stepA.state).toEqual(stepB.state);
    expect(stepA.events).toEqual(stepB.events);

    // Velocity/placement poisons use unprotected playing (round-start requires velocity 0).
    const a = asPlayingWorld(program, initialA, { arena: { crates: [] } });
    const alpha = config.seats[0]!.competitorId;
    const beta = config.seats[1]!.competitorId;

    function withVelocity(vx: number, vy: number): unknown {
      const raw = JSON.parse(JSON.stringify(a)) as {
        slices: {
          locomotion: {
            entries: Array<{ velocity: { x: number; y: number } }>;
          };
        };
      };
      raw.slices.locomotion.entries[0]!.velocity = { x: vx, y: vy };
      return raw;
    }

    // Separate asserts — never overwrite before asserting.
    expect(() => program.restore(withVelocity(LANE_CORRECTION_MAX + 1, 0))).toThrow(
      /abs <= 128|contract max step/,
    );
    expect(() => program.restore(withVelocity(-(LANE_CORRECTION_MAX + 1), 0))).toThrow(
      /abs <= 128|contract max step/,
    );
    expect(() => program.restore(withVelocity(1_000_000, 0))).toThrow(
      /abs <= 128|contract max step/,
    );
    // Boundary 128 is accepted.
    expect(() => program.restore(withVelocity(LANE_CORRECTION_MAX, 0))).not.toThrow();
    expect(() => program.restore(withVelocity(0, -LANE_CORRECTION_MAX))).not.toThrow();

    // Non-safe integer overflow (distinct payload).
    const nonSafe = JSON.parse(JSON.stringify(a)) as {
      slices: { locomotion: { entries: Array<{ position: { x: number } }> } };
    };
    nonSafe.slices.locomotion.entries[0]!.position.x = Number.MAX_SAFE_INTEGER + 2;
    expect(() => program.restore(nonSafe)).toThrow(/safe integer/);

    // Float position (distinct payload).
    const floatPos = JSON.parse(JSON.stringify(a)) as {
      slices: { locomotion: { entries: Array<{ position: { x: number } }> } };
    };
    floatPos.slices.locomotion.entries[0]!.position.x = 1.25;
    expect(() => program.restore(floatPos)).toThrow(/safe integer/);

    // Float velocity (distinct payload).
    const floatVel = JSON.parse(JSON.stringify(a)) as {
      slices: { locomotion: { entries: Array<{ velocity: { x: number } }> } };
    };
    floatVel.slices.locomotion.entries[0]!.velocity.x = 0.5;
    expect(() => program.restore(floatVel)).toThrow(/safe integer/);

    // Out-of-range positions normalize modulo the torus instead of rejecting
    // (Decision 011). Structural validation (safe integers) stays strict.
    const normalized = program.restore({
      ...a,
      slices: {
        ...a.slices,
        locomotion: {
          entries: [
            {
              competitorId: alpha,
              position: freezePosition({
                x: -1,
                y: 9 * UNITS_PER_TILE + BASE_SPEED_UNITS_PER_TICK,
              }),
              velocity: freezeVelocity({ x: 0, y: 0 }),
              lastDirection: null,
            },
            locoAt(beta, 9, 7),
          ],
        },
      },
    });
    expect(normalized.slices.locomotion.entries[0]!.position).toEqual({
      x: 11 * UNITS_PER_TILE - 1,
      y: BASE_SPEED_UNITS_PER_TICK,
    });

  });

  it("adversarial loops with fixed seeds: per-tick invariants, mid restore/replay parity", () => {
    const seeds = ["seed-α", "seed-β", "seed-γ"] as const;
    for (const seed of seeds) {
      const config = createLocalDuel1v1MatchConfig({ seed });
      const program = createDefaultMechanicsProgram();
      const leftSeat = config.seats[0]!.seatId;
      const rightSeat = config.seats[1]!.seatId;
      let state = enterPlaying(program, program.initial(config));
      const midSnapshots: WorldState[] = [];

      function assertInvariants(world: WorldState): void {
        for (const entry of world.slices.locomotion.entries) {
          expect(Number.isInteger(entry.position.x)).toBe(true);
          expect(Number.isInteger(entry.position.y)).toBe(true);
          expect(Number.isSafeInteger(entry.position.x)).toBe(true);
          expect(Number.isSafeInteger(entry.position.y)).toBe(true);
          expect(Number.isInteger(entry.velocity.x)).toBe(true);
          expect(Number.isInteger(entry.velocity.y)).toBe(true);
          expect(Math.abs(entry.velocity.x)).toBeLessThanOrEqual(LANE_CORRECTION_MAX);
          expect(Math.abs(entry.velocity.y)).toBeLessThanOrEqual(LANE_CORRECTION_MAX);
          expect(
            entry.position.x - BODY_HALF_EXTENT >= 0
              && entry.position.y - BODY_HALF_EXTENT >= 0
              && entry.position.x + BODY_HALF_EXTENT
                <= world.slices.arena.width * UNITS_PER_TILE
              && entry.position.y + BODY_HALF_EXTENT
                <= world.slices.arena.height * UNITS_PER_TILE,
          ).toBe(true);
          for (const solid of world.slices.arena.solid) {
            expect(bodyOverlapsTile(entry.position, solid)).toBe(false);
          }
          for (const crate of world.slices.arena.crates) {
            expect(bodyOverlapsTile(entry.position, crate)).toBe(false);
          }
        }
        // Living bodies may overlap freely (Decision 012) — no body-body
        // invariant; only terrain/bomb constraints apply.
      }

      // Scripted continuous motion (~few hundred ticks total — keep suite fast).
      state = program.step(state, {
        commands: [
          {
            tick: state.tick,
            sequence: 0,
            seatId: leftSeat,
            command: { type: "set-movement", direction: "right", pressed: true },
          },
        ],
      }).state;
      assertInvariants(state);
      for (let i = 0; i < 16; i += 1) {
        state = program.step(state, { commands: [] }).state;
        assertInvariants(state);
      }
      midSnapshots.push(program.restore(JSON.parse(JSON.stringify(state))));

      state = program.step(state, {
        commands: [
          {
            tick: state.tick,
            sequence: 1,
            seatId: leftSeat,
            command: { type: "set-movement", direction: "down", pressed: true },
          },
        ],
      }).state;
      for (let i = 0; i < 8; i += 1) {
        state = program.step(state, { commands: [] }).state;
        assertInvariants(state);
      }
      midSnapshots.push(program.restore(JSON.parse(JSON.stringify(state))));

      state = program.step(state, {
        commands: [
          {
            tick: state.tick,
            sequence: 2,
            seatId: leftSeat,
            command: { type: "place-bomb" },
          },
          {
            tick: state.tick,
            sequence: 3,
            seatId: rightSeat,
            command: { type: "set-movement", direction: "left", pressed: true },
          },
        ],
      }).state;
      assertInvariants(state);
      for (let i = 0; i < 40; i += 1) {
        state = program.step(state, { commands: [] }).state;
        assertInvariants(state);
      }

      // Mid-point restore converges, then same empty steps match.
      for (const mid of midSnapshots) {
        const restored = program.restore(JSON.parse(JSON.stringify(mid)));
        expect(restored).toEqual(mid);
        const contA = program.step(mid, { commands: [] });
        const contB = program.step(restored, { commands: [] });
        expect(contA.state).toEqual(contB.state);
        expect(contA.events).toEqual(contB.events);
      }

      // Facade replay parity for the same command stream.
      const left = config.seats[0]!.competitorId;
      const right = config.seats[1]!.competitorId;
      const commands: GameCommand[] = [
        { type: "set-movement", competitorId: left, direction: "right", pressed: true },
        { type: "advance", deltaMs: 320 },
        { type: "set-movement", competitorId: left, direction: "down", pressed: true },
        { type: "advance", deltaMs: 160 },
        { type: "place-bomb", competitorId: left },
        { type: "set-movement", competitorId: right, direction: "left", pressed: true },
        { type: "advance", deltaMs: 800 },
      ];
      const first = replay(config, commands);
      const second = replay(config, commands);
      expect(first.events).toEqual(second.events);
      expect(first.snapshot).toEqual(second.snapshot);
      for (const competitor of first.snapshot.competitors) {
        expect(competitor.tile).toEqual(tileOf(competitor.position));
        expect(Number.isInteger(competitor.position.x)).toBe(true);
        expect(Number.isInteger(competitor.position.y)).toBe(true);
        expect(Math.abs(competitor.velocity.x)).toBeLessThanOrEqual(LANE_CORRECTION_MAX);
        expect(Math.abs(competitor.velocity.y)).toBeLessThanOrEqual(LANE_CORRECTION_MAX);
      }
    }
  });

  it("world-5 format; snapshot position/velocity/tile; kernel-0.10.0", () => {
    const program = createDefaultMechanicsProgram();
    const config = localDuel("world2-meta");
    const world = program.initial(config);
    expect(world.formatVersion).toBe("world-5");
    expect(WORLD_FORMAT_VERSION).toBe("world-5");
    const snap = program.snapshot(world);
    expect(snap.version).toBe("kernel-0.10.0");
    for (const c of snap.competitors) {
      expect(c.position).toEqual(tileCenter(c.tile));
      expect(c.velocity).toEqual({ x: 0, y: 0 });
    }
    expect(program.mechanicsRevision).toBe(DEFAULT_MECHANICS_REVISION);
    expect(world.slices.match.phase).toBe("round-start");
    expect(world.slices.match.phaseRemainingMs).toBe(ROUND_START_MS);
    expect(world.slices.match.roundNumber).toBe(1);
    expect(snap.pressure.pathLength).toBe(75);
    expect(snap.pressure.closing).toBeNull();
    expect("closedTiles" in snap.pressure).toBe(false);
  });

  it("browser reuses TICK_DURATION_MS and UNITS_PER_TILE (no hardcoded 20/1024 duplicates)", () => {
    const browserSrc = readFileSync(
      join(process.cwd(), "GameMechanics/src/browser/main.ts"),
      "utf8",
    );
    expect(browserSrc).toContain("TICK_DURATION_MS");
    expect(browserSrc).toContain("UNITS_PER_TILE");
    expect(browserSrc).not.toMatch(/FIXED_STEP_MS\s*=\s*20/);
    expect(browserSrc).not.toMatch(/UNITS_PER_TILE_DRAW\s*=\s*1024/);
  });
});

// ── Slice 3A — competitive first-to-K cycle (Decision 007 / world-3) ───────

describe("Slice 3A — ciclo competitivo first-to-K (Decision 007)", () => {
  /** Kill `victim` with a due bomb owned by `killer` at victim body tile. */
  function eliminateOnce(
    program: MechanicsProgram,
    state: WorldState,
    killer: CompetitorId,
    victim: CompetitorId,
  ): { state: WorldState; events: readonly GameEvent[] } {
    const victimEntry = state.slices.locomotion.entries.find(
      (entry) => entry.competitorId === victim,
    );
    if (!victimEntry) throw new Error("missing victim locomotion");
    const tile = tileOf(victimEntry.position);
    const elapsed = Math.max(state.slices.match.roundElapsedMs, UNPROTECTED_ELAPSED_MS);
    const crafted = asPlayingWorld(program, state, {
      locomotion: state.slices.locomotion,
      arena: {
        width: state.slices.arena.width,
        height: state.slices.arena.height,
        solid: state.slices.arena.solid,
        crates: [],
      },
      vitals: {
        entries: state.slices.vitals.entries.map((entry) => ({
          competitorId: entry.competitorId,
          alive: entry.alive,
          spawnProtectionRemainingMs: 0,
        })),
      },
      match: {
        phase: "playing",
        roundNumber: state.slices.match.roundNumber,
        phaseRemainingMs: 0,
        roundElapsedMs: elapsed,
        roundRemainingMs: state.config.roundDurationMs - elapsed,
        suddenDeathElapsedMs: 0,
        scores: state.slices.match.scores.map((entry) => ({
          competitorId: entry.competitorId,
          wins: entry.wins,
        })),
        roundOutcome: null,
        matchWinner: null,
      },
      bombs: {
        nextId: Math.max(2, state.slices.bombs.nextId),
        items: [
          {
            id: 1,
            ownerId: killer,
            tile: freezeTile(tile),
            fuseMs: 20,
            flameRange: 2,
          echo: false,
          },
        ],
      },
    });
    return program.step(crafted, { commands: [] });
  }

  /** Drain round-over interval completely (80 ticks). */
  function drainRoundEnd(program: MechanicsProgram, state: WorldState): WorldState {
    return stepN(program, state, ROUND_END_TICKS);
  }

  /** Drain countdown into playing (60 ticks). */
  function drainCountdown(program: MechanicsProgram, state: WorldState): WorldState {
    return enterPlaying(program, state);
  }

  it("A: countdown 59 still round-start; 60th GO-boundary opens playing before command (gameplay accepted)", () => {
    const program = createDefaultMechanicsProgram();
    const config = localDuel("3a-countdown");
    let state = program.initial(config);
    expect(state.slices.match.phase).toBe("round-start");
    expect(state.slices.match.phaseRemainingMs).toBe(ROUND_START_MS);

    // Before open: gameplay rejected (phase still round-start for the whole tick).
    const rejected = program.step(state, {
      commands: [{
        tick: state.tick,
        sequence: 0,
        seatId: config.seats[0]!.seatId,
        command: { type: "place-bomb" },
      }],
    });
    expect(rejected.rejections.some((item) => item.reason === "not-playing")).toBe(true);
    expect(rejected.state.slices.bombs.items).toHaveLength(0);
    expect(rejected.state.slices.match.phase).toBe("round-start");

    state = stepN(program, state, ROUND_START_TICKS - 1);
    expect(state.slices.match.phase).toBe("round-start");
    expect(state.slices.match.phaseRemainingMs).toBe(TICK_DURATION_MS);
    expect(state.slices.match.roundElapsedMs).toBe(0);

    // GO boundary (60th tick): cycle opens playing BEFORE command phase, so
    // gameplay on this same tick is coherent and must be accepted — not not-playing.
    // Do not change scheduler order; this documents the phase barrier contract.
    const opened = program.step(state, {
      commands: [{
        tick: state.tick,
        sequence: 0,
        seatId: config.seats[0]!.seatId,
        command: { type: "place-bomb" },
      }],
    });
    expect(opened.state.slices.match.phase).toBe("playing");
    expect(opened.events.some((event) => event.type === "round-became-playable")).toBe(true);
    expect(opened.rejections.some((item) => item.reason === "not-playing")).toBe(false);
    expect(opened.events.some((event) => event.type === "bomb-placed")).toBe(true);
    expect(opened.state.slices.bombs.items).toHaveLength(1);
    expect(opened.state.slices.match.phaseRemainingMs).toBe(0);
    // Same tick arms protection then decrements once (timer after round-reset).
    expect(
      opened.state.slices.vitals.entries.every(
        (entry) => entry.spawnProtectionRemainingMs === SPAWN_PROTECTION_MS - TICK_DURATION_MS,
      ),
    ).toBe(true);
    expect(opened.state.slices.match.roundElapsedMs).toBe(TICK_DURATION_MS);
  });

  it("B: protection 109/110 — move+bomb allowed; damage ignored until unprotected; no extend", () => {
    const program = createDefaultMechanicsProgram();
    const config = localDuel("3a-protect");
    const alpha = config.seats[0]!.competitorId;
    const beta = config.seats[1]!.competitorId;
    const seat0 = config.seats[0]!.seatId;
    let state = enterPlaying(program, program.initial(config));
    // After open tick: protection = 2180. Need 109 more ticks to hit 0 (109*20=2180).
    expect(state.slices.vitals.entries[0]!.spawnProtectionRemainingMs).toBe(
      SPAWN_PROTECTION_MS - TICK_DURATION_MS,
    );

    // Movement + bomb while protected.
    const moved = program.step(state, {
      commands: [
        {
          tick: state.tick,
          sequence: 0,
          seatId: seat0,
          command: { type: "set-movement", direction: "right", pressed: true },
        },
        {
          tick: state.tick,
          sequence: 1,
          seatId: seat0,
          command: { type: "place-bomb" },
        },
      ],
    });
    expect(moved.events.some((event) => event.type === "bomb-placed")).toBe(true);
    expect(moved.state.slices.locomotion.entries[0]!.position.x).toBeGreaterThan(
      tileCenter({ x: 1, y: 1 }).x,
    );
    state = moved.state;

    // Flame on protected body: no elimination, protection not extended.
    // Exact formula requires every living body share the same remaining ms.
    const protectedMs = state.slices.vitals.entries.find((e) => e.competitorId === alpha)!
      .spawnProtectionRemainingMs;
    expect(protectedMs).toBeGreaterThan(0);
    const elapsed = state.slices.match.roundElapsedMs;
    expect(protectedMs).toBe(Math.max(0, SPAWN_PROTECTION_MS - elapsed));
    const flameOnProtected = asPlayingWorld(program, state, {
      locomotion: state.slices.locomotion,
      match: {
        roundNumber: state.slices.match.roundNumber,
        roundElapsedMs: elapsed,
        roundRemainingMs: state.config.roundDurationMs - elapsed,
      },
      vitals: {
        entries: state.config.seats.map((seat) => ({
          competitorId: seat.competitorId,
          alive: true,
          spawnProtectionRemainingMs: protectedMs,
        })),
      },
      bombs: { nextId: 2, items: [] },
      flames: {
        items: [{
          tile: freezeTile(tileOf(state.slices.locomotion.entries[0]!.position)),
          remainingMs: 600,
          causes: [{ bombId: 1, ownerId: beta }],
        }],
      },
      arena: {
        width: 11,
        height: 9,
        solid: state.slices.arena.solid,
        crates: [],
      },
    });
    const ignored = program.step(flameOnProtected, { commands: [] });
    expect(ignored.events.some((event) => event.type === "competitor-eliminated")).toBe(false);
    expect(
      ignored.state.slices.vitals.entries.find((entry) => entry.competitorId === alpha)?.alive,
    ).toBe(true);
    // Protection only decrements by one tick — never re-armed/extended by exposure.
    expect(
      ignored.state.slices.vitals.entries.find((entry) => entry.competitorId === alpha)
        ?.spawnProtectionRemainingMs,
    ).toBe(protectedMs - TICK_DURATION_MS);

    // Boundary: after 108 more ticks from enterPlaying baseline (2180), still 20ms left;
    // 109th zeros it. enterPlaying already applied 1 playing tick.
    state = enterPlaying(program, program.initial(config));
    state = stepN(program, state, SPAWN_PROTECTION_TICKS - 2); // 108 more → 20ms left
    expect(state.slices.vitals.entries[0]!.spawnProtectionRemainingMs).toBe(TICK_DURATION_MS);
    state = stepN(program, state, 1);
    expect(state.slices.vitals.entries.every((e) => e.spawnProtectionRemainingMs === 0)).toBe(true);
  });

  it("C: timeout → sudden-death once; gameplay continues; no timer draw outcome", () => {
    const program = createDefaultMechanicsProgram();
    const config = createLocalDuel1v1MatchConfig({
      seed: "3a-sd",
      roundDurationMs: 5_000,
    });
    let state = enterPlaying(program, program.initial(config));
    // enterPlaying already spent 1 competitive tick (20ms).
    const ticksLeft = (config.roundDurationMs - TICK_DURATION_MS) / TICK_DURATION_MS;
    state = stepN(program, state, ticksLeft - 1);
    expect(state.slices.match.phase).toBe("playing");
    expect(state.slices.match.roundRemainingMs).toBe(TICK_DURATION_MS);

    const toSd = program.step(state, { commands: [] });
    expect(toSd.state.slices.match.phase).toBe("sudden-death");
    expect(toSd.events.filter((event) => event.type === "sudden-death-started")).toHaveLength(1);
    expect(toSd.state.slices.match.roundRemainingMs).toBe(0);
    expect(toSd.state.slices.match.roundElapsedMs).toBe(config.roundDurationMs);
    expect(toSd.state.slices.match.roundOutcome).toBeNull();
    // Protection forced to zero same tick.
    expect(toSd.state.slices.vitals.entries.every((e) => e.spawnProtectionRemainingMs === 0)).toBe(
      true,
    );

    // Idle further: still sudden-death (no second event, no round-over by timer).
    // Transition tick freezes suddenDeathElapsedMs at 0; next tick advances it by 20.
    expect(toSd.state.slices.match.suddenDeathElapsedMs).toBe(0);
    const cont = program.step(toSd.state, { commands: [] });
    expect(cont.state.slices.match.phase).toBe("sudden-death");
    expect(cont.events.some((event) => event.type === "sudden-death-started")).toBe(false);
    expect(cont.state.slices.match.suddenDeathElapsedMs).toBe(TICK_DURATION_MS);
    // Place bomb still works in sudden-death.
    const placed = program.step(cont.state, {
      commands: [{
        tick: cont.state.tick,
        sequence: 0,
        seatId: config.seats[0]!.seatId,
        command: { type: "place-bomb" },
      }],
    });
    expect(placed.events.some((event) => event.type === "bomb-placed")).toBe(true);
    expect(placed.state.slices.match.phase).toBe("sudden-death");
  });

  it("D: score +1 elimination; double KO +0; first-to-2 with draw extras; 4p sole survivor", () => {
    const program = createDefaultMechanicsProgram();
    // Elimination +1 (also covered by regression explode test).
    {
      const config = createLocalDuel1v1MatchConfig({
        seed: "3a-score-elim",
        targetRoundWins: 2,
      });
      const alpha = config.seats[0]!.competitorId;
      const beta = config.seats[1]!.competitorId;
      const { state, events } = eliminateOnce(
        program,
        program.initial(config),
        beta,
        alpha,
      );
      expect(state.slices.match.phase).toBe("round-over");
      expect(state.slices.match.roundOutcome).toEqual({ reason: "elimination", winner: beta });
      expect(state.slices.match.scores).toEqual([
        { competitorId: alpha, wins: 0 },
        { competitorId: beta, wins: 1 },
      ]);
      expect(events.some((event) => event.type === "round-ended")).toBe(true);
      expect(state.slices.match.matchWinner).toBeNull();
    }

    // Double KO +0 — primary gate in Slice 1 "double KO explicito"; assert score freeze here.
    {
      const config = localDuel("3a-dko-score");
      const alpha = config.seats[0]!.competitorId;
      const beta = config.seats[1]!.competitorId;
      const base = program.initial(config);
      const crafted = asPlayingWorld(program, base, {
        arena: { width: 11, height: 9, solid: base.slices.arena.solid, crates: [] },
        locomotion: { entries: [locoAt(alpha, 1, 1), locoAt(beta, 3, 1)] },
        bombs: {
          nextId: 3,
          items: [
            { id: 1, ownerId: alpha, tile: freezeTile({ x: 1, y: 1 }), fuseMs: 20, flameRange: 2 },
            { id: 2, ownerId: beta, tile: freezeTile({ x: 3, y: 1 }), fuseMs: 20, flameRange: 2 },
          ],
        },
      });
      const { state } = program.step(crafted, { commands: [] });
      expect(state.slices.match.roundOutcome).toEqual({ reason: "double-ko", winner: null });
      expect(state.slices.match.scores.every((entry) => entry.wins === 0)).toBe(true);
    }

    // First-to-2: legal 1-1 double-ko at round 3 (not impossible round1 1-1) → extra round.
    {
      const config = createLocalDuel1v1MatchConfig({
        seed: "3a-draw-extra",
        targetRoundWins: 2,
        roundDurationMs: 5_000,
      });
      const alpha = config.seats[0]!.competitorId;
      const beta = config.seats[1]!.competitorId;
      // sumWins=2 double-ko requires roundNumber >= 3 (current round scores 0).
      let state = asRoundOverWorld(program, program.initial(config), alpha, {
        wins: [1, 1],
        reason: "double-ko",
        roundNumber: 3,
        phaseRemainingMs: TICK_DURATION_MS,
      });
      const next = program.step(state, { commands: [] });
      expect(next.state.slices.match.phase).toBe("round-start");
      expect(next.state.slices.match.roundNumber).toBe(4);
      expect(next.state.slices.match.scores).toEqual([
        { competitorId: alpha, wins: 1 },
        { competitorId: beta, wins: 1 },
      ]);
      expect(next.events.some((event) => event.type === "round-started")).toBe(true);
      expect(next.events.some((event) => event.type === "match-ended")).toBe(false);
    }

    // 4-player free-for-all: three simultaneous eliminations → sole survivor +1.
    {
      const config = createFourSeatMatchConfig({
        seed: "3a-ffa",
        competitorIds: ["w", "x", "y", "z"],
        targetRoundWins: 2,
      });
      const [w, x, y, z] = config.seats.map((seat) => seat.competitorId);
      const base = program.initial(config);
      // One bomb per victim owner (maxBombs=1); simultaneous detonation kills three.
      const multi = asPlayingWorld(program, base, {
        arena: { width: 11, height: 9, solid: base.slices.arena.solid, crates: [] },
        locomotion: {
          entries: [
            locoAt(w!, 1, 1),
            locoAt(x!, 9, 7),
            locoAt(y!, 9, 1),
            locoAt(z!, 1, 7),
          ],
        },
        bombs: {
          nextId: 4,
          items: [
            { id: 1, ownerId: x!, tile: freezeTile({ x: 9, y: 7 }), fuseMs: 20, flameRange: 2 },
            { id: 2, ownerId: y!, tile: freezeTile({ x: 9, y: 1 }), fuseMs: 20, flameRange: 2 },
            { id: 3, ownerId: z!, tile: freezeTile({ x: 1, y: 7 }), fuseMs: 20, flameRange: 2 },
          ],
        },
      });
      const { state, events } = program.step(multi, { commands: [] });
      expect(events.filter((event) => event.type === "competitor-eliminated")).toHaveLength(3);
      expect(state.slices.vitals.entries.filter((entry) => entry.alive).map((e) => e.competitorId))
        .toEqual([w]);
      expect(state.slices.match.phase).toBe("round-over");
      expect(state.slices.match.roundOutcome).toEqual({ reason: "elimination", winner: w });
      expect(state.slices.match.scores.find((entry) => entry.competitorId === w)?.wins).toBe(1);
      expect(events.some((event) => event.type === "round-ended")).toBe(true);
    }
  });

  it("E: interval 79/80; multi-owner reset; per-round seed exact; root tick continuous", () => {
    const program = createDefaultMechanicsProgram();
    const config = createLocalDuel1v1MatchConfig({
      seed: "3a-interval",
      targetRoundWins: 3,
      roundDurationMs: 5_000,
    });
    const alpha = config.seats[0]!.competitorId;
    const beta = config.seats[1]!.competitorId;

    // Craft round-over with phaseRemaining = 1600, winner beta, scores 1-0.
    let state = asRoundOverWorld(program, program.initial(config), beta, {
      wins: [0, 1],
      phaseRemainingMs: ROUND_END_MS,
      roundElapsedMs: UNPROTECTED_ELAPSED_MS,
    });
    // Drop a bomb + intent + displaced loco so reset is observable (still legal round-over).
    {
      const draft = cloneDraft(state);
      draft.slices.bombs = {
        nextId: 5,
        items: [{
          id: 4,
          ownerId: alpha,
          tile: freezeTile({ x: 2, y: 1 }),
          fuseMs: 40,
          flameRange: 1,
          echo: false,
        }],
      };
      draft.slices.intent.entries[0]!.pressedDirections = ["right"];
      draft.slices.vitals.entries[0]!.alive = false;
      draft.slices.vitals.entries[0]!.spawnProtectionRemainingMs = 0;
      // Keep spawn positions legal; only non-reset fields must be observable.
      draft.slices.locomotion.entries[1] = {
        ...draft.slices.locomotion.entries[1]!,
        velocity: { x: 64, y: 0 },
        lastDirection: "right",
      };
      draft.slices.arena.crates = [];
      reconcileBombsWithProgression(draft);
      state = program.restore(draft);
    }

    state = stepN(program, state, ROUND_END_TICKS - 1);
    expect(state.slices.match.phase).toBe("round-over");
    expect(state.slices.match.phaseRemainingMs).toBe(TICK_DURATION_MS);
    expect(state.slices.bombs.items).toHaveLength(1);

    const tickBefore = state.tick;
    const rosterBefore = state.slices.roster;
    const reset = program.step(state, { commands: [] });
    expect(reset.state.tick).toBe(tickBefore + 1);
    expect(reset.state.slices.match.phase).toBe("round-start");
    expect(reset.state.slices.match.roundNumber).toBe(2);
    expect(reset.state.slices.match.scores).toEqual([
      { competitorId: alpha, wins: 0 },
      { competitorId: beta, wins: 1 },
    ]);
    expect(reset.events.some((event) =>
      event.type === "round-started"
      && event.roundNumber === 2
      && event.roundSeed === roundSeedFor(config.seed, 2)
    )).toBe(true);
    // All owners reset their slices (not Match writing them).
    expect(reset.state.slices.bombs.items).toHaveLength(0);
    expect(reset.state.slices.bombs.nextId).toBe(1);
    expect(reset.state.slices.flames.items).toHaveLength(0);
    expect(reset.state.slices.intent.entries.every((e) => e.pressedDirections.length === 0)).toBe(
      true,
    );
    expect(reset.state.slices.vitals.entries.every((e) => e.alive)).toBe(true);
    expect(reset.state.slices.vitals.entries.every((e) => e.spawnProtectionRemainingMs === 0)).toBe(
      true,
    );
    // Spawns + velocity/lastDirection restored.
    expect(tileOf(reset.state.slices.locomotion.entries[0]!.position)).toEqual({ x: 1, y: 1 });
    expect(tileOf(reset.state.slices.locomotion.entries[1]!.position)).toEqual({ x: 9, y: 7 });
    expect(reset.state.slices.locomotion.entries.every((e) =>
      e.velocity.x === 0 && e.velocity.y === 0 && e.lastDirection === null
    )).toBe(true);
    // Roster persists across rounds.
    expect(reset.state.slices.roster).toEqual(rosterBefore);
    // Arena solid+crates exact vs createArenaTiles(roundSeedFor(seed, 2)).
    const expectedArena = createArenaTiles(roundSeedFor(config.seed, 2));
    expect(reset.state.slices.arena.solid).toEqual(expectedArena.solid);
    expect(reset.state.slices.arena.crates).toEqual(expectedArena.crates);
    // Forward/reversed program boundary: restore + step parity after reset.
    const restored = program.restore(JSON.parse(JSON.stringify(reset.state)));
    expect(restored).toEqual(reset.state);
    const a = program.step(reset.state, { commands: [] });
    const b = program.step(restored, { commands: [] });
    expect(a.state).toEqual(b.state);
    expect(a.events).toEqual(b.events);
  });

  it("F: first-to-K match-over after real interval; restart equals program.initial", () => {
    const program = createDefaultMechanicsProgram();
    const config = createLocalDuel1v1MatchConfig({
      seed: "3a-match-over",
      targetRoundWins: 2,
      roundDurationMs: 5_000,
    });
    const alpha = config.seats[0]!.competitorId;
    const beta = config.seats[1]!.competitorId;

    // Real kernel trajectory: alpha wins round 1 and round 2 → match-over after interval.
    let state = program.initial(config);
    let ended = eliminateOnce(program, state, alpha, beta);
    expect(ended.state.slices.match.scores).toEqual([
      { competitorId: alpha, wins: 1 },
      { competitorId: beta, wins: 0 },
    ]);
    state = drainRoundEnd(program, ended.state);
    expect(state.slices.match.phase).toBe("round-start");
    expect(state.slices.match.roundNumber).toBe(2);
    state = drainCountdown(program, state);
    ended = eliminateOnce(program, state, alpha, beta);
    expect(ended.state.slices.match.scores).toEqual([
      { competitorId: alpha, wins: 2 },
      { competitorId: beta, wins: 0 },
    ]);
    expect(ended.state.slices.match.phase).toBe("round-over");
    expect(ended.state.slices.match.matchWinner).toBeNull();
    const matchOver = drainRoundEnd(program, ended.state);
    expect(matchOver.slices.match.phase).toBe("match-over");
    expect(matchOver.slices.match.matchWinner).toBe(alpha);
    expect(matchOver.slices.match.roundOutcome).toEqual({
      reason: "elimination",
      winner: alpha,
    });

    // Gameplay frozen.
    const idle = program.step(matchOver, {
      commands: [{
        tick: matchOver.tick,
        sequence: 0,
        seatId: config.seats[0]!.seatId,
        command: { type: "place-bomb" },
      }],
    });
    expect(idle.rejections.some((item) => item.reason === "not-playing")).toBe(true);
    expect(idle.state.slices.match.phase).toBe("match-over");
    expect(idle.state.stateRevision).toBe(matchOver.stateRevision + 1);

    // Facade restart equals program.initial world content (adapter metadata excluded).
    const game = createGameMechanics(config);
    facadeEnterPlaying(game);
    game.dispatch({ type: "place-bomb", competitorId: alpha });
    game.dispatch({ type: "restart" });
    const snap = game.snapshot();
    const initialWorld = program.initial(config);
    const initialSnap = program.snapshot(initialWorld);
    expect(snap.phase).toBe(initialSnap.phase);
    expect(snap.roundNumber).toBe(initialSnap.roundNumber);
    expect(snap.scores).toEqual(initialSnap.scores);
    expect(snap.matchWinner).toBeNull();
    expect(snap.phaseRemainingMs).toBe(ROUND_START_MS);
    expect(snap.bombs).toEqual([]);
    expect(snap.flames).toEqual([]);
    expect(snap.arena).toEqual(initialSnap.arena);
    expect(snap.competitors.map((c) => ({
      id: c.id,
      position: c.position,
      velocity: c.velocity,
      alive: c.alive,
      spawnProtectionRemainingMs: c.spawnProtectionRemainingMs,
    }))).toEqual(initialSnap.competitors.map((c) => ({
      id: c.id,
      position: c.position,
      velocity: c.velocity,
      alive: c.alive,
      spawnProtectionRemainingMs: c.spawnProtectionRemainingMs,
    })));
    // Adapter-only fields (not in WorldState): revision/version may reset independently —
    // document that only competitive world content is compared above.
    void beta;
  });

  it("H: module order — cycle → round-reset → command → timer → protection → pressure", () => {
    const protocolSrc = readFileSync(
      join(process.cwd(), "GameMechanics/src/kernel/protocol.ts"),
      "utf8",
    );
    expect(protocolSrc).toMatch(
      /"cycle"[\s\S]*"round-reset"[\s\S]*"command"[\s\S]*"timer"[\s\S]*"protection"[\s\S]*"pressure"[\s\S]*"pressure-impact"[\s\S]*"intent"/,
    );
    const matchSystems = matchModule.systems.map((system) => system.phase);
    expect(matchSystems).toContain("cycle");
    expect(matchSystems).toContain("timer");
    expect(matchSystems).toContain("round");
    const protectionSystem = competitorsModule.systems.find(
      (system) => system.id === "protection-timer-system",
    );
    expect(protectionSystem?.phase).toBe("protection");
    // Owners that must reset on round-reset fact:
    for (const mod of [
      arenaModule,
      intentModule,
      locomotionModule,
      ordnanceModule,
      competitorsModule,
      pressureModule,
      powerupsModule,
    ]) {
      expect(mod.systems.some((system) => system.phase === "round-reset")).toBe(true);
    }
    // Versions for world-5 / kernel-0.10.0 (Slice 4A candidate).
    expect(matchModule.version).toBe("2.1.1");
    expect(competitorsModule.version).toBe("3.4.0");
    expect(arenaModule.version).toBe("2.4.0");
    expect(intentModule.version).toBe("2.1.0");
    expect(ordnanceModule.version).toBe("3.2.0");
    expect(locomotionModule.version).toBe("3.2.0");
    expect(pressureModule.version).toBe("1.1.1");
    expect(powerupsModule.version).toBe("1.0.0");
    expect(WORLD_FORMAT_VERSION).toBe("world-5");
    expect(GAME_MECHANICS_VERSION).toBe("kernel-0.10.0");
  });

  it("I: Match does not own pressure/shrink (Pressure module owns 3B)", () => {
    const matchSrc = readFileSync(
      join(process.cwd(), "GameMechanics/src/modules/match/index.ts"),
      "utf8",
    );
    expect(matchSrc).not.toMatch(/shrink|pressure|closing.?ring/i);
    // Snapshot exposes sudden-death clocks + pressure projection from owner.
    const program = createDefaultMechanicsProgram();
    const snap = program.snapshot(program.initial(localDuel("3a-no-pressure")));
    expect("suddenDeathElapsedMs" in snap).toBe(true);
    expect("pressure" in snap).toBe(true);
    expect(snap.pressure.pathLength).toBe(75);
    expect("shrink" in snap).toBe(false);
  });

  it("J: real trajectories 2-0 and 2-1 with double-KO extra round (no score inject)", () => {
    const program = createDefaultMechanicsProgram();
    // 2-0 trajectory: alpha wins both rounds via kernel transitions only.
    {
      const config = createLocalDuel1v1MatchConfig({
        seed: "3a-traj-2-0",
        targetRoundWins: 2,
        roundDurationMs: 5_000,
      });
      const alpha = config.seats[0]!.competitorId;
      const beta = config.seats[1]!.competitorId;
      let state = program.initial(config);
      let r1 = eliminateOnce(program, state, alpha, beta);
      expect(r1.state.slices.match.roundNumber).toBe(1);
      expect(r1.state.slices.match.scores).toEqual([
        { competitorId: alpha, wins: 1 },
        { competitorId: beta, wins: 0 },
      ]);
      state = drainRoundEnd(program, r1.state);
      expect(state.slices.match.phase).toBe("round-start");
      expect(state.slices.match.roundNumber).toBe(2);
      state = drainCountdown(program, state);
      const r2 = eliminateOnce(program, state, alpha, beta);
      expect(r2.state.slices.match.scores).toEqual([
        { competitorId: alpha, wins: 2 },
        { competitorId: beta, wins: 0 },
      ]);
      state = drainRoundEnd(program, r2.state);
      expect(state.slices.match.phase).toBe("match-over");
      expect(state.slices.match.matchWinner).toBe(alpha);
    }

    // 2-1 with a real double-KO between scored rounds (extra round, no point).
    {
      const config = createLocalDuel1v1MatchConfig({
        seed: "3a-traj-2-1",
        targetRoundWins: 2,
        roundDurationMs: 5_000,
      });
      const alpha = config.seats[0]!.competitorId;
      const beta = config.seats[1]!.competitorId;
      let state = program.initial(config);

      // Round 1: alpha +1
      let ended = eliminateOnce(program, state, alpha, beta);
      expect(ended.state.slices.match.scores).toEqual([
        { competitorId: alpha, wins: 1 },
        { competitorId: beta, wins: 0 },
      ]);
      state = drainRoundEnd(program, ended.state);
      state = drainCountdown(program, state);

      // Round 2: real double-KO → scores stay 1-0, extra round.
      const dko = asPlayingWorld(program, state, {
        arena: { width: 11, height: 9, solid: state.slices.arena.solid, crates: [] },
        locomotion: { entries: [locoAt(alpha, 1, 1), locoAt(beta, 3, 1)] },
        match: {
          roundNumber: 2,
          scores: [
            { competitorId: alpha, wins: 1 },
            { competitorId: beta, wins: 0 },
          ],
        },
        bombs: {
          nextId: 3,
          items: [
            { id: 1, ownerId: alpha, tile: freezeTile({ x: 1, y: 1 }), fuseMs: 20, flameRange: 2 },
            { id: 2, ownerId: beta, tile: freezeTile({ x: 3, y: 1 }), fuseMs: 20, flameRange: 2 },
          ],
        },
      });
      ended = program.step(dko, { commands: [] });
      expect(ended.state.slices.match.roundOutcome).toEqual({ reason: "double-ko", winner: null });
      expect(ended.state.slices.match.scores).toEqual([
        { competitorId: alpha, wins: 1 },
        { competitorId: beta, wins: 0 },
      ]);
      state = drainRoundEnd(program, ended.state);
      expect(state.slices.match.phase).toBe("round-start");
      expect(state.slices.match.roundNumber).toBe(3);
      expect(state.slices.match.scores).toEqual([
        { competitorId: alpha, wins: 1 },
        { competitorId: beta, wins: 0 },
      ]);

      // Round 3: beta +1 → 1-1
      state = drainCountdown(program, state);
      ended = eliminateOnce(program, state, beta, alpha);
      expect(ended.state.slices.match.scores).toEqual([
        { competitorId: alpha, wins: 1 },
        { competitorId: beta, wins: 1 },
      ]);
      state = drainRoundEnd(program, ended.state);
      expect(state.slices.match.phase).toBe("round-start");
      expect(state.slices.match.roundNumber).toBe(4);

      // Round 4: alpha +1 → 2-1 match-over after interval
      state = drainCountdown(program, state);
      ended = eliminateOnce(program, state, alpha, beta);
      expect(ended.state.slices.match.scores).toEqual([
        { competitorId: alpha, wins: 2 },
        { competitorId: beta, wins: 1 },
      ]);
      state = drainRoundEnd(program, ended.state);
      expect(state.slices.match.phase).toBe("match-over");
      expect(state.slices.match.matchWinner).toBe(alpha);
      expect(state.slices.match.roundOutcome?.winner).toBe(alpha);
    }
  });

  it("A: golden spiral 75 coords outer-to-center, first (1,0), last (6,4)", () => {
    const program = createDefaultMechanicsProgram();
    const world = program.initial(localDuel("3b-path", { roundDurationMs: SHORT_ROUND_MS }));
    const path = derivedPathOf(world);
    const solidKeys = new Set(world.slices.arena.solid.map((t) => `${t.x},${t.y}`));

    expect(path).toHaveLength(75);
    expect(path[0]).toEqual({ x: 1, y: 0 });
    expect(path[path.length - 1]).toEqual({ x: 6, y: 4 });
    expect(path.map((t) => ({ x: t.x, y: t.y }))).toEqual([...CANONICAL_PRESSURE_PATH_75]);

    const keys = path.map((t) => `${t.x},${t.y}`);
    expect(new Set(keys).size).toBe(75);
    for (const tile of path) {
      expect(solidKeys.has(`${tile.x},${tile.y}`)).toBe(false);
    }

    // path/closing are never persisted on the slice.
    expect(world.slices.pressure).toEqual({ closedTiles: [] });
    expect("path" in world.slices.pressure).toBe(false);
    expect("closing" in world.slices.pressure).toBe(false);

    const rebuilt = buildPressurePath(11, 9, world.slices.arena.solid);
    expect(rebuilt).toEqual(path);
    expect(PRESSURE_INTERVAL_MS).toBe(900);
    expect(PRESSURE_FALL_MS).toBe(340);
    expect(warningAt(0)).toBe(0);
    expect(impactAt(0)).toBe(340);
    expect(warningAt(1)).toBe(900);
    expect(impactAt(1)).toBe(1240);
  });

  it("B: transition elapsed 0 warning; 320 no impact; 340 first impact; 880/900/1220/1240 boundaries", () => {
    const program = createDefaultMechanicsProgram();
    const config = localDuel("3b-bounds", { roundDurationMs: SHORT_ROUND_MS });
    let state = enterSuddenDeath(program, program.initial(config));
    const path = derivedPathOf(state);
    const path0 = path[0]!;
    const path1 = path[1]!;

    // Elapsed 0: closed empty; closing derived via snapshot.
    expect(state.slices.pressure.closedTiles).toHaveLength(0);
    expect(program.snapshot(state).pressure.closing).toEqual({
      index: 0,
      tile: path0,
      remainingMs: PRESSURE_FALL_MS,
    });

    state = asSuddenDeathWorld(program, program.initial(config), 320);
    expect(state.slices.pressure.closedTiles).toHaveLength(0);
    expect(program.snapshot(state).pressure.closing?.remainingMs).toBe(20);
    expect(program.snapshot(state).pressure.closing?.index).toBe(0);

    const impact0 = program.step(state, { commands: [] });
    expect(impact0.state.slices.match.suddenDeathElapsedMs).toBe(340);
    expect(impact0.state.slices.pressure.closedTiles).toHaveLength(1);
    expect(impact0.state.slices.pressure.closedTiles[0]).toEqual(path0);
    expect(program.snapshot(impact0.state).pressure.closing).toBeNull();
    const closed0 = impact0.events.filter((e) => e.type === "pressure-closed");
    const warn0 = impact0.events.filter((e) => e.type === "pressure-warning");
    expect(closed0).toHaveLength(1);
    expect(warn0).toHaveLength(0);
    expect(closed0[0]).toMatchObject({
      type: "pressure-closed",
      pressureIndex: 0,
      tile: path0,
    });

    state = asSuddenDeathWorld(program, program.initial(config), 880);
    expect(state.slices.pressure.closedTiles).toHaveLength(1);
    expect(program.snapshot(state).pressure.closing).toBeNull();

    const warn1 = program.step(state, { commands: [] });
    expect(warn1.state.slices.match.suddenDeathElapsedMs).toBe(900);
    expect(program.snapshot(warn1.state).pressure.closing).toEqual({
      index: 1,
      tile: path1,
      remainingMs: PRESSURE_FALL_MS,
    });
    expect(warn1.events.filter((e) => e.type === "pressure-warning")).toHaveLength(1);
    expect(warn1.events.filter((e) => e.type === "pressure-closed")).toHaveLength(0);

    state = asSuddenDeathWorld(program, program.initial(config), 1220);
    expect(program.snapshot(state).pressure.closing?.remainingMs).toBe(20);
    const impact1 = program.step(state, { commands: [] });
    expect(impact1.state.slices.match.suddenDeathElapsedMs).toBe(1240);
    expect(impact1.state.slices.pressure.closedTiles).toHaveLength(2);
    expect(impact1.events.filter((e) => e.type === "pressure-closed")).toHaveLength(1);
    expect(impact1.events.filter((e) => e.type === "pressure-warning")).toHaveLength(0);
  });

  it("C: impact removes crate, forces bomb fuse+explosion, blocks blast and movement", () => {
    const program = createDefaultMechanicsProgram();
    const config = localDuel("3b-crate-bomb", { roundDurationMs: SHORT_ROUND_MS });
    const base = program.initial(config);
    const alpha = config.seats[0]!.competitorId;
    const beta = config.seats[1]!.competitorId;
    const solid = base.slices.arena.solid;
    const solidSet = new Set(solid.map((t) => `${t.x},${t.y}`));
    const initialCrates = new Set(base.slices.arena.crates.map((t) => `${t.x},${t.y}`));
    const path = derivedPathOf(base);
    const path0 = path[0]!;

    let impactIndex = -1;
    let impactTile = path0;
    for (let i = 0; i < path.length; i += 1) {
      const tile = path[i]!;
      if (initialCrates.has(`${tile.x},${tile.y}`)) {
        impactIndex = i;
        impactTile = tile;
        break;
      }
    }
    expect(impactIndex).toBeGreaterThanOrEqual(0);
    const preImpactMs = impactAt(impactIndex) - TICK_DURATION_MS;

    const crateWorld = asSuddenDeathWorld(program, base, preImpactMs, {
      arena: {
        width: 11,
        height: 9,
        solid: solid.map((t) => ({ x: t.x, y: t.y })),
        crates: [{ x: impactTile.x, y: impactTile.y }],
      },
    });
    expect(program.restore(JSON.parse(JSON.stringify(crateWorld)))).toEqual(crateWorld);
    expect(crateWorld.slices.arena.crates.some((t) => t.x === impactTile.x && t.y === impactTile.y)).toBe(true);

    const crateResult = program.step(crateWorld, { commands: [] });
    expect(crateResult.state.slices.match.suddenDeathElapsedMs).toBe(impactAt(impactIndex));
    expect(crateResult.state.slices.arena.crates.some((t) => t.x === impactTile.x && t.y === impactTile.y)).toBe(false);
    expect(crateResult.events.some((e) =>
      e.type === "crate-destroyed" && e.at.x === impactTile.x && e.at.y === impactTile.y
    )).toBe(true);
    expect(crateResult.state.slices.pressure.closedTiles.some(
      (t) => t.x === impactTile.x && t.y === impactTile.y,
    )).toBe(true);

    // Bomb on path[0]: force fuse + explode same tick.
    const bombWorld = asSuddenDeathWorld(program, base, 320, {
      arena: {
        width: 11,
        height: 9,
        solid: solid.map((t) => ({ x: t.x, y: t.y })),
        crates: [],
      },
      bombs: {
        nextId: 2,
        items: [{
          id: 1,
          ownerId: alpha,
          tile: { x: path0.x, y: path0.y },
          fuseMs: 1_000,
          flameRange: 2,
          echo: false,
        }],
      },
    });
    const bombResult = program.step(bombWorld, { commands: [] });
    expect(bombResult.state.slices.bombs.items).toHaveLength(0);
    expect(bombResult.events.some((e) => e.type === "bomb-exploded" && e.bombId === 1)).toBe(true);
    const snap = program.snapshot(bombResult.state);
    expect(snap.arena.solid.some((t) => t.x === path0.x && t.y === path0.y)).toBe(true);
    expect(bombResult.state.slices.arena.solid.some((t) => t.x === path0.x && t.y === path0.y)).toBe(false);

    // Effective solid blocks blast past a closed tile.
    const candidates = [
      { x: path0.x + 1, y: path0.y },
      { x: path0.x, y: path0.y + 1 },
      { x: path0.x - 1, y: path0.y },
      { x: path0.x, y: path0.y - 1 },
    ];
    const bombTile = candidates.find((t) =>
      !solidSet.has(`${t.x},${t.y}`) && !(t.x === path0.x && t.y === path0.y)
    );
    expect(bombTile).toBeDefined();
    const blastWorld = asSuddenDeathWorld(program, base, 340, {
      arena: {
        width: 11,
        height: 9,
        solid: solid.map((t) => ({ x: t.x, y: t.y })),
        crates: [],
      },
      bombs: {
        nextId: 2,
        items: [{
          id: 1,
          ownerId: alpha,
          tile: bombTile!,
          fuseMs: 20,
          flameRange: 2,
          echo: false,
        }],
      },
    });
    const blasted = program.step(blastWorld, { commands: [] });
    const boom = blasted.events.find((e) => e.type === "bomb-exploded");
    expect(boom?.type).toBe("bomb-exploded");
    if (boom?.type === "bomb-exploded") {
      const flameKeys = new Set(boom.flameTiles.map((t) => `${t.x},${t.y}`));
      const dx = path0.x - bombTile!.x;
      const dy = path0.y - bombTile!.y;
      if ((dx === 0 || dy === 0) && Math.abs(dx) + Math.abs(dy) > 0) {
        const beyond = {
          x: path0.x + Math.sign(dx),
          y: path0.y + Math.sign(dy),
        };
        if (!solidSet.has(`${beyond.x},${beyond.y}`)) {
          expect(flameKeys.has(`${beyond.x},${beyond.y}`)).toBe(false);
        }
      }
    }

    if (bombTile) {
      const free = freeSdTiles(
        { solid: solid.map((t) => ({ x: t.x, y: t.y })), crates: [] },
        [path0],
      ).filter((t) => t.x !== bombTile.x || t.y !== bombTile.y);
      const other = free[0]!;
      const moveWorld = asSuddenDeathWorld(program, base, 340, {
        arena: {
          width: 11,
          height: 9,
          solid: solid.map((t) => ({ x: t.x, y: t.y })),
          crates: [],
        },
        locomotion: {
          entries: [
            locoAt(alpha, bombTile.x, bombTile.y),
            locoAt(beta, other.x, other.y),
          ],
        },
      });
      const seat0 = config.seats[0]!.seatId;
      const dx = path0.x - bombTile.x;
      const dy = path0.y - bombTile.y;
      const direction =
        dx === 1 ? "right" as const
        : dx === -1 ? "left" as const
        : dy === 1 ? "down" as const
        : "up" as const;
      const moved = program.step(moveWorld, {
        commands: [{
          tick: moveWorld.tick,
          sequence: 0,
          seatId: seat0,
          command: { type: "set-movement", direction, pressed: true },
        }],
      });
      const pos = moved.state.slices.locomotion.entries.find((e) => e.competitorId === alpha)!.position;
      expect(bodyOverlapsTile(pos, path0)).toBe(false);
    }
  });

  it("C2: closed blocks inbound blast; crushed bomb detonates; flame coexists; crate event only if present", () => {
    const program = createDefaultMechanicsProgram();
    const config = localDuel("3b-blast-gates", { roundDurationMs: SHORT_ROUND_MS });
    const base = program.initial(config);
    const alpha = config.seats[0]!.competitorId;
    const beta = config.seats[1]!.competitorId;
    const solid = base.slices.arena.solid.map((t) => ({ x: t.x, y: t.y }));
    const solidSet = new Set(solid.map((t) => `${t.x},${t.y}`));
    const path0 = derivedPathOf(base)[0]!;

    // Gate 1: closed tile blocks blast arriving from outside (no flame beyond/on closed from external origin).
    const neighbors = [
      { x: path0.x + 1, y: path0.y },
      { x: path0.x, y: path0.y + 1 },
      { x: path0.x - 1, y: path0.y },
      { x: path0.x, y: path0.y - 1 },
    ];
    const origin = neighbors.find((t) => !solidSet.has(`${t.x},${t.y}`));
    expect(origin).toBeDefined();
    const free = freeSdTiles({ solid, crates: [] }, [path0, origin!]);
    const blastWorld = asSuddenDeathWorld(program, base, 340, {
      arena: { width: 11, height: 9, solid, crates: [] },
      bombs: {
        nextId: 2,
        items: [{
          id: 1,
          ownerId: alpha,
          tile: origin!,
          fuseMs: 20,
          flameRange: 2,
          echo: false,
        }],
      },
      locomotion: {
        entries: [
          locoAt(alpha, free[0]!.x, free[0]!.y),
          locoAt(beta, free[1]!.x, free[1]!.y),
        ],
      },
    });
    const blasted = program.step(blastWorld, { commands: [] });
    const boom = blasted.events.find((e) => e.type === "bomb-exploded");
    expect(boom?.type).toBe("bomb-exploded");
    if (boom?.type === "bomb-exploded") {
      const flameKeys = new Set(boom.flameTiles.map((t) => `${t.x},${t.y}`));
      // Propagation stops at solid; closed path0 is solid — flame must not include path0.
      expect(flameKeys.has(`${path0.x},${path0.y}`)).toBe(false);
      const dx = path0.x - origin!.x;
      const dy = path0.y - origin!.y;
      if ((dx === 0 || dy === 0) && Math.abs(dx) + Math.abs(dy) > 0) {
        const beyond = {
          x: path0.x + Math.sign(dx),
          y: path0.y + Math.sign(dy),
        };
        if (!solidSet.has(`${beyond.x},${beyond.y}`)) {
          expect(flameKeys.has(`${beyond.x},${beyond.y}`)).toBe(false);
        }
      }
    }

    // Gate 2: bomb crushed ON closed tile has fuse forced 0 and detonates same tick.
    const crushed = asSuddenDeathWorld(program, base, 320, {
      arena: { width: 11, height: 9, solid, crates: [] },
      bombs: {
        nextId: 2,
        items: [{
          id: 1,
          ownerId: alpha,
          tile: { x: path0.x, y: path0.y },
          fuseMs: 1_800,
          flameRange: 2,
          echo: false,
        }],
      },
    });
    const crushStep = program.step(crushed, { commands: [] });
    expect(crushStep.state.slices.match.suddenDeathElapsedMs).toBe(340);
    expect(crushStep.state.slices.bombs.items).toHaveLength(0);
    expect(crushStep.events.some((e) => e.type === "bomb-exploded" && e.bombId === 1)).toBe(true);
    // Gate 3: origin flame may coexist with the closed tile after detonation.
    expect(
      crushStep.state.slices.flames.items.some(
        (f) => f.tile.x === path0.x && f.tile.y === path0.y,
      ),
    ).toBe(true);
    // Restore must accept flame on closed tile (positive exception).
    expect(program.restore(JSON.parse(JSON.stringify(crushStep.state)))).toEqual(crushStep.state);

    // Gate 4: Arena emits crate-destroyed only when a crate really existed.
    const noCrateWorld = asSuddenDeathWorld(program, base, 320, {
      arena: { width: 11, height: 9, solid, crates: [] },
    });
    const noCrateStep = program.step(noCrateWorld, { commands: [] });
    expect(noCrateStep.events.filter((e) => e.type === "crate-destroyed")).toHaveLength(0);

    // Prefer a path index whose tile is in the seed crate layout (legal subset).
    const seedCrates = new Set(
      createArenaTiles(roundSeedFor(config.seed, 1)).crates.map((t) => `${t.x},${t.y}`),
    );
    const path = derivedPathOf(base);
    let crateIndex = -1;
    let crateTile = path0;
    for (let i = 0; i < path.length; i += 1) {
      const tile = path[i]!;
      if (seedCrates.has(`${tile.x},${tile.y}`)) {
        crateIndex = i;
        crateTile = tile;
        break;
      }
    }
    expect(crateIndex).toBeGreaterThanOrEqual(0);
    const preCrateMs = impactAt(crateIndex) - TICK_DURATION_MS;
    const withCrateWorld = asSuddenDeathWorld(program, base, preCrateMs, {
      arena: {
        width: 11,
        height: 9,
        solid,
        crates: [{ x: crateTile.x, y: crateTile.y }],
      },
    });
    const withCrateStep = program.step(withCrateWorld, { commands: [] });
    const crateEvents = withCrateStep.events.filter((e) => e.type === "crate-destroyed");
    expect(crateEvents).toHaveLength(1);
    expect(crateEvents[0]).toMatchObject({
      type: "crate-destroyed",
      at: crateTile,
    });
  });

  it("C2: spurious crates-destroyed fact for empty tile is pure no-op", () => {
    // Hardening: Ordnance may emit crates-destroyed for a tile that is not a
    // crate. Arena intersects with pre-state crates; empty intersection is a
    // pure no-op (no Arena write, no event). Real facts still remove once.
    type ArenaRead = {
      crates: ReadonlyArray<{ x: number; y: number }>;
    };
    function withExplosion(
      version: string,
      run: (ctx: { read: (id: "arena") => ArenaRead }) => {
        facts?: ReadonlyArray<{ kind: "crates-destroyed"; tiles: ReadonlyArray<{ x: number; y: number }> }>;
      },
    ): ModuleSpec {
      return Object.freeze({
        ...ordnanceModule,
        version,
        systems: Object.freeze(
          ordnanceModule.systems.map((system) =>
            system.id === "explosion-system"
              ? Object.freeze({ ...system, run: run as typeof system.run })
              : system,
          ),
        ),
      });
    }

    // Spurious: fact targets empty (1,1) — not present in crates.
    const spurious = withExplosion("2.3.0-spurious-crates-fact", () =>
      Object.freeze({
        facts: Object.freeze([
          Object.freeze({
            kind: "crates-destroyed" as const,
            tiles: Object.freeze([freezeTile({ x: 1, y: 1 })]),
          }),
        ]),
      }),
    );
    const spuriousProgram = createMechanicsProgram(defaultModulesWith([spurious]));
    const spuriousConfig = createMatchConfig({
      seed: "3b-spurious-crate-fact",
      mechanicsRevision: spuriousProgram.mechanicsRevision,
      contentRevision: DEFAULT_CONTENT_REVISION,
      roundDurationMs: SHORT_ROUND_MS,
      targetRoundWins: 2,
      seats: [
        { seatId: "seat-0", competitorId: "competitor-a" },
        { seatId: "seat-1", competitorId: "competitor-b" },
      ],
    });
    const spuriousBase = spuriousProgram.initial(spuriousConfig);
    expect(spuriousBase.slices.arena.crates.some((t) => t.x === 1 && t.y === 1)).toBe(false);
    expect(spuriousBase.slices.arena.solid.some((t) => t.x === 1 && t.y === 1)).toBe(false);
    const spuriousPlaying = asPlayingWorld(spuriousProgram, spuriousBase);
    const beforeArena = JSON.parse(JSON.stringify(spuriousPlaying.slices.arena));
    const spuriousStep = spuriousProgram.step(spuriousPlaying, { commands: [] });
    expect(spuriousStep.events.filter((e) => e.type === "crate-destroyed")).toHaveLength(0);
    expect(spuriousStep.state.slices.arena).toEqual(spuriousPlaying.slices.arena);
    expect(JSON.parse(JSON.stringify(spuriousStep.state.slices.arena))).toEqual(beforeArena);
    expect(spuriousProgram.restore(JSON.parse(JSON.stringify(spuriousStep.state)))).toEqual(
      spuriousStep.state,
    );

    // Positive: fact for a real pre-state crate removes once and emits once.
    const real = withExplosion("2.3.0-real-crates-fact", (ctx) => {
      const crate = ctx.read("arena").crates[0];
      if (!crate) return {};
      return Object.freeze({
        facts: Object.freeze([
          Object.freeze({
            kind: "crates-destroyed" as const,
            tiles: Object.freeze([freezeTile(crate)]),
          }),
        ]),
      });
    });
    const realProgram = createMechanicsProgram(defaultModulesWith([real]));
    const realConfig = createMatchConfig({
      seed: "3b-real-crate-fact",
      mechanicsRevision: realProgram.mechanicsRevision,
      contentRevision: DEFAULT_CONTENT_REVISION,
      roundDurationMs: SHORT_ROUND_MS,
      targetRoundWins: 2,
      seats: [
        { seatId: "seat-0", competitorId: "competitor-a" },
        { seatId: "seat-1", competitorId: "competitor-b" },
      ],
    });
    const realPlaying = asPlayingWorld(realProgram, realProgram.initial(realConfig));
    const firstCrate = realPlaying.slices.arena.crates[0]!;
    const realStep = realProgram.step(realPlaying, { commands: [] });
    const destroyed = realStep.events.filter((e) => e.type === "crate-destroyed");
    expect(destroyed).toHaveLength(1);
    expect(destroyed[0]).toMatchObject({ type: "crate-destroyed", at: firstCrate });
    expect(
      realStep.state.slices.arena.crates.some(
        (t) => t.x === firstCrate.x && t.y === firstCrate.y,
      ),
    ).toBe(false);
  });

  it("D: positive body overlap dies; exact contact safe; simultaneous multi-kill scoring", () => {
    const program = createDefaultMechanicsProgram();
    const config = localDuel("3b-overlap", { roundDurationMs: SHORT_ROUND_MS });
    const base = program.initial(config);
    const path0 = derivedPathOf(base)[0]!;
    const alpha = config.seats[0]!.competitorId;
    const beta = config.seats[1]!.competitorId;
    const center = tileCenter(path0);

    // Exact contact on the open-below side of path0 (classic border: (0,0)/(2,0)
    // are solid, so side contact would touch a real wall).
    const exactContact = freezePosition({
      x: center.x,
      y: (path0.y + 1) * UNITS_PER_TILE + BODY_HALF_EXTENT,
    });
    expect(bodyOverlapsTile(exactContact, path0)).toBe(false);
    expect(
      base.slices.arena.solid.every((t) => !bodyOverlapsTile(exactContact, t)),
    ).toBe(true);
    {
      const safeWorld = asSuddenDeathWorld(program, base, 320, {
        arena: {
          width: 11,
          height: 9,
          solid: base.slices.arena.solid.map((t) => ({ x: t.x, y: t.y })),
          crates: [],
        },
        locomotion: {
          entries: [
            locoAtPosition(alpha, exactContact),
            locoAt(beta, 5, 4),
          ],
        },
      });
      const safeStep = program.step(safeWorld, { commands: [] });
      expect(safeStep.state.slices.vitals.entries.find((e) => e.competitorId === alpha)?.alive).toBe(true);
      expect(safeStep.events.filter((e) => e.type === "competitor-eliminated")).toHaveLength(0);
    }

    const posA = freezePosition({ x: center.x, y: center.y + 800 });
    const posB = freezePosition({ x: center.x + 800, y: center.y });
    expect(bodyOverlapsTile(posA, path0)).toBe(true);
    expect(bodyOverlapsTile(posB, path0)).toBe(true);
    expect(bodiesOverlap(posA, posB)).toBe(false);

    const killWorld = asSuddenDeathWorld(program, base, 320, {
      arena: {
        width: 11,
        height: 9,
        solid: base.slices.arena.solid.map((t) => ({ x: t.x, y: t.y })),
        crates: [],
      },
      locomotion: {
        entries: [
          locoAtPosition(alpha, posA),
          locoAtPosition(beta, posB),
        ],
      },
    });
    const killStep = program.step(killWorld, { commands: [] });
    expect(killStep.state.slices.match.suddenDeathElapsedMs).toBe(340);
    const elims = killStep.events.filter((e) => e.type === "competitor-eliminated");
    expect(elims).toHaveLength(2);
    for (const e of elims) {
      if (e.type !== "competitor-eliminated") continue;
      expect(e.causes).toHaveLength(1);
      expect(e.causes[0]?.kind).toBe("pressure");
      if (e.causes[0]?.kind === "pressure") {
        expect(e.causes[0].pressureIndex).toBe(0);
        expect(e.causes[0].at).toEqual(path0);
      }
    }
    expect(killStep.state.slices.match.phase).toBe("round-over");
    expect(killStep.state.slices.match.roundOutcome).toEqual({
      reason: "double-ko",
      winner: null,
    });
    // Terminal after SD: closedTiles frozen, closing derived null.
    expect(killStep.state.slices.pressure.closedTiles).toHaveLength(1);
    expect(program.snapshot(killStep.state).pressure.closing).toBeNull();

    const four = createFourSeatMatchConfig({
      seed: "3b-4p",
      roundDurationMs: SHORT_ROUND_MS,
      competitorIds: ["p1", "p2", "p3", "p4"],
    });
    const fourBase = program.initial(four);
    const tile = derivedPathOf(fourBase)[0]!;
    const c = tileCenter(tile);
    const seats = four.seats.map((s) => s.competitorId);
    const free = freeSdTiles(
      {
        solid: fourBase.slices.arena.solid.map((t) => ({ x: t.x, y: t.y })),
        crates: [],
      },
      [tile],
    );
    let freeA = free[0]!;
    let freeB = free[free.length - 1]!;
    for (let i = 0; i < free.length; i += 1) {
      for (let j = i + 1; j < free.length; j += 1) {
        const a = tileCenter(free[i]!);
        const b = tileCenter(free[j]!);
        if (Math.abs(a.x - b.x) >= BODY_HALF_EXTENT * 2 || Math.abs(a.y - b.y) >= BODY_HALF_EXTENT * 2) {
          freeA = free[i]!;
          freeB = free[j]!;
          break;
        }
      }
    }
    const s0 = freezePosition({ x: c.x, y: c.y + 800 });
    const s1 = freezePosition({ x: c.x + 800, y: c.y });
    const fourWorld = asSuddenDeathWorld(program, fourBase, 320, {
      arena: {
        width: 11,
        height: 9,
        solid: fourBase.slices.arena.solid.map((t) => ({ x: t.x, y: t.y })),
        crates: [],
      },
      locomotion: {
        entries: [
          locoAtPosition(seats[0]!, s0),
          locoAtPosition(seats[1]!, s1),
          locoAt(seats[2]!, freeA.x, freeA.y),
          locoAt(seats[3]!, freeB.x, freeB.y),
        ],
      },
    });
    const fourStep = program.step(fourWorld, { commands: [] });
    expect(fourStep.events.filter((e) => e.type === "competitor-eliminated")).toHaveLength(2);
    expect(fourStep.state.slices.vitals.entries.filter((e) => e.alive)).toHaveLength(2);
    expect(fourStep.state.slices.match.phase).toBe("sudden-death");
  });

  it("D2: pressure impact precedes locomotion and bomb damage — single pressure cause", () => {
    const program = createDefaultMechanicsProgram();
    const config = localDuel("3b-causality", { roundDurationMs: SHORT_ROUND_MS });
    const base = program.initial(config);
    const alpha = config.seats[0]!.competitorId;
    const beta = config.seats[1]!.competitorId;
    const path0 = derivedPathOf(base)[0]!;
    const solid = base.slices.arena.solid.map((t) => ({ x: t.x, y: t.y }));
    const solidSet = new Set(solid.map((t) => `${t.x},${t.y}`));
    const center = tileCenter(path0);

    // Neighbor for movement attempt away from impact.
    const neighbors = [
      { x: path0.x + 1, y: path0.y },
      { x: path0.x, y: path0.y + 1 },
      { x: path0.x - 1, y: path0.y },
      { x: path0.x, y: path0.y - 1 },
    ];
    const escape = neighbors.find((t) => !solidSet.has(`${t.x},${t.y}`));
    expect(escape).toBeDefined();
    const free = freeSdTiles({ solid, crates: [] }, [path0]);
    const other = free.find((t) => t.x !== escape!.x || t.y !== escape!.y) ?? free[0]!;

    // Victim overlapping path0; bomb also on path0 with short fuse would explode same tick.
    // Movement pressed toward escape. Impact must kill first with pressure cause only.
    const dx = escape!.x - path0.x;
    const dy = escape!.y - path0.y;
    const direction =
      dx === 1 ? "right" as const
      : dx === -1 ? "left" as const
      : dy === 1 ? "down" as const
      : "up" as const;

    const world = asSuddenDeathWorld(program, base, 320, {
      arena: { width: 11, height: 9, solid, crates: [] },
      locomotion: {
        entries: [
          locoAtPosition(alpha, freezePosition({ x: center.x, y: center.y })),
          locoAt(beta, other.x, other.y),
        ],
      },
      bombs: {
        nextId: 2,
        items: [{
          id: 1,
          ownerId: beta,
          tile: { x: path0.x, y: path0.y },
          fuseMs: 20,
          flameRange: 2,
          echo: false,
        }],
      },
    });

    const result = program.step(world, {
      commands: [{
        tick: world.tick,
        sequence: 0,
        seatId: config.seats[0]!.seatId,
        command: { type: "set-movement", direction, pressed: true },
      }],
    });

    expect(result.state.slices.match.suddenDeathElapsedMs).toBe(340);
    // Victim cannot escape on the impact tick.
    expect(result.state.slices.vitals.entries.find((e) => e.competitorId === alpha)?.alive).toBe(false);
    const alphaElims = result.events.filter(
      (e) => e.type === "competitor-eliminated" && e.competitorId === alpha,
    );
    expect(alphaElims).toHaveLength(1);
    const elim = alphaElims[0]!;
    if (elim.type === "competitor-eliminated") {
      expect(elim.causes).toHaveLength(1);
      expect(elim.causes[0]?.kind).toBe("pressure");
      if (elim.causes[0]?.kind === "pressure") {
        expect(elim.causes[0].pressureIndex).toBe(0);
        expect(elim.causes[0].at).toEqual(path0);
      }
    }
    // Bomb still detonates (ordnance reaction), but does not re-author alpha's death.
    expect(result.events.some((e) => e.type === "bomb-exploded" && e.bombId === 1)).toBe(true);
  });

  it("E: full path close cannot leave an active multi-survivor round", () => {
    const program = createDefaultMechanicsProgram();
    const config = localDuel("3b-full", { roundDurationMs: SHORT_ROUND_MS, targetRoundWins: 3 });
    let state = enterSuddenDeath(program, program.initial(config));
    const pathLen = derivedPathOf(state).length;
    const maxTicks = impactAt(pathLen - 1) / TICK_DURATION_MS + 5;
    let ended = false;
    for (let i = 0; i < maxTicks; i += 1) {
      const step = program.step(state, { commands: [] });
      state = step.state;
      if (state.slices.match.phase === "round-over" || state.slices.match.phase === "match-over") {
        ended = true;
        break;
      }
    }
    expect(ended).toBe(true);
    expect(state.slices.match.phase).toBe("round-over");
    expect(["elimination", "double-ko"]).toContain(state.slices.match.roundOutcome?.reason);
    const alive = state.slices.vitals.entries.filter((e) => e.alive).length;
    expect(alive).toBeLessThanOrEqual(1);
    expect(state.slices.pressure.closedTiles.length).toBeGreaterThan(0);
    expect(state.slices.match.phase).not.toBe("sudden-death");
    expect(program.snapshot(state).pressure.closing).toBeNull();
  });

  it("F: round reset clears closedTiles; path re-derives; preserves score and root tick", () => {
    const program = createDefaultMechanicsProgram();
    const config = localDuel("3b-reset", { roundDurationMs: SHORT_ROUND_MS, targetRoundWins: 3 });
    const alpha = config.seats[0]!.competitorId;
    const beta = config.seats[1]!.competitorId;

    let state = enterSuddenDeath(program, program.initial(config));
    const path0 = derivedPathOf(state)[0]!;
    const c = tileCenter(path0);
    state = asSuddenDeathWorld(program, program.initial(config), 320, {
      arena: {
        width: 11,
        height: 9,
        solid: program.initial(config).slices.arena.solid.map((t) => ({ x: t.x, y: t.y })),
        crates: [],
      },
      locomotion: {
        entries: [
          locoAt(alpha, 5, 3),
          locoAtPosition(beta, freezePosition({ x: c.x, y: c.y })),
        ],
      },
    });
    const ended = program.step(state, { commands: [] });
    expect(ended.state.slices.match.phase).toBe("round-over");
    expect(ended.state.slices.match.scores).toEqual([
      { competitorId: alpha, wins: 1 },
      { competitorId: beta, wins: 0 },
    ]);
    expect(ended.state.slices.pressure.closedTiles.length).toBeGreaterThan(0);
    const tickAtRoundOver = ended.state.tick;

    state = stepN(program, ended.state, ROUND_END_TICKS);
    expect(state.slices.match.phase).toBe("round-start");
    expect(state.slices.match.roundNumber).toBe(2);
    expect(state.tick).toBe(tickAtRoundOver + ROUND_END_TICKS);
    expect(state.slices.pressure.closedTiles).toEqual([]);
    expect(derivedPathOf(state)).toHaveLength(75);
    expect(program.snapshot(state).pressure.closing).toBeNull();
    expect(state.slices.match.scores).toEqual([
      { competitorId: alpha, wins: 1 },
      { competitorId: beta, wins: 0 },
    ]);
    expect(state.tick).toBeGreaterThan(tickAtRoundOver);
  });

  it("G: JSON/replay parity and normal/reversed module registration parity", () => {
    const config = localDuel("3b-parity", { roundDurationMs: SHORT_ROUND_MS });
    const forward = createDefaultMechanicsProgram("forward");
    const reversed = createDefaultMechanicsProgram("reversed");
    expect(forward.mechanicsRevision).toBe(reversed.mechanicsRevision);

    function runToSd(program: MechanicsProgram) {
      let state = enterSuddenDeath(program, program.initial(config));
      const events: GameEvent[] = [];
      for (let i = 0; i < PRESSURE_FALL_MS / TICK_DURATION_MS; i += 1) {
        const step = program.step(state, { commands: [] });
        state = step.state;
        events.push(...step.events);
      }
      return { state, events, snap: program.snapshot(state) };
    }

    const a = runToSd(forward);
    const b = runToSd(reversed);
    expect(a.state).toEqual(b.state);
    expect(a.events).toEqual(b.events);
    expect(a.snap).toEqual(b.snap);

    const json = JSON.parse(JSON.stringify(a.state));
    const restored = forward.restore(json);
    expect(restored).toEqual(a.state);
    const s1 = forward.step(a.state, { commands: [] });
    const s2 = forward.step(restored, { commands: [] });
    expect(s1.state).toEqual(s2.state);
    expect(s1.events).toEqual(s2.events);
  });

  it("J: no Math.random/Date/performance in simulation; no legacy imports", () => {
    const srcRoot = join(process.cwd(), "GameMechanics", "src");
    const skip = new Set(["browser"]);
    function walk(dir: string): string[] {
      const out: string[] = [];
      for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        const st = statSync(full);
        if (st.isDirectory()) {
          if (skip.has(name)) continue;
          out.push(...walk(full));
        } else if (name.endsWith(".ts")) {
          out.push(full);
        }
      }
      return out;
    }
    for (const file of walk(srcRoot)) {
      const text = readFileSync(file, "utf8");
      expect(text, relative(process.cwd(), file)).not.toMatch(/original-game/);
      if (file.includes(`${join("src", "browser")}`)) continue;
      expect(text, relative(process.cwd(), file)).not.toMatch(/\bMath\.random\b/);
      expect(text, relative(process.cwd(), file)).not.toMatch(/\bDate\.now\b/);
      expect(text, relative(process.cwd(), file)).not.toMatch(/\bperformance\.now\b/);
    }
  });
});

// ── Part 2: minimal Champion skill contract — Ranni Ice Blink ───────────────

describe("Ranni Ice Blink", () => {
  function useSkill(state: WorldState, config: MatchConfig, sequence = 0) {
    return {
      tick: state.tick,
      sequence,
      seatId: config.seats[0]!.seatId,
      command: { type: "use-skill" as const },
    };
  }

  function pressRight(state: WorldState, config: MatchConfig, sequence = 0) {
    return {
      tick: state.tick,
      sequence,
      seatId: config.seats[0]!.seatId,
      command: { type: "set-movement" as const, direction: "right" as const, pressed: true },
    };
  }

  it("keeps no-skill config and public snapshots byte-compatible", () => {
    const config = localDuel("skill-none");
    const program = createDefaultMechanicsProgram();
    let state = program.initial(config);
    expect(state.slices.skills.entries).toEqual([]);
    expect(config.seats.every((seat) => !("skillId" in seat))).toBe(true);
    expect(program.snapshot(state).competitors.every((entry) => !("skill" in entry))).toBe(true);

    state = enterPlaying(program, state);
    const rejected = program.step(state, {
      commands: [{
        tick: state.tick,
        sequence: 0,
        seatId: config.seats[0]!.seatId,
        command: { type: "use-skill" },
      }],
    });
    expect(rejected.rejections).toContainEqual(expect.objectContaining({ reason: "skill-unavailable" }));
    expect(program.snapshot(rejected.state).competitors.every((entry) => !("skill" in entry))).toBe(true);
  });

  it("freezes the body, moves projection deterministically, and permits second-use completion next tick", () => {
    const config = ranniDuel("skill-manual");
    const program = createDefaultMechanicsProgram();
    let state = asPlayingWorld(program, program.initial(config), {
      arena: { crates: [] },
    });
    const alpha = config.seats[0]!.competitorId;
    const body = findLocomotion(state.slices.locomotion, alpha)!.position;

    const activated = program.step(state, {
      commands: [pressRight(state, config), useSkill(state, config, 1)],
    });
    state = activated.state;
    expect(activated.rejections).toEqual([]);
    expect(findLocomotion(state.slices.locomotion, alpha)!.position).toEqual(body);
    expect(program.snapshot(state).competitors[0]!.skill).toMatchObject({
      phase: "channeling",
      channelRemainingMs: 2_480,
      cooldownRemainingMs: 0,
      projection: body,
    });

    const completed = program.step(state, { commands: [useSkill(state, config)] });
    const moved = findLocomotion(completed.state.slices.locomotion, alpha)!.position;
    expect(completed.rejections).toEqual([]);
    expect(moved.x).toBe(body.x + BASE_SPEED_UNITS_PER_TICK / 2);
    expect(moved.y).toBe(body.y);
    expect(findLocomotion(completed.state.slices.locomotion, alpha)!.velocity).toEqual({ x: 0, y: 0 });
    expect(program.snapshot(completed.state).competitors[0]!.skill).toMatchObject({
      phase: "cooldown",
      channelRemainingMs: 0,
      cooldownRemainingMs: 8_000,
      projection: null,
    });
  });

  it("keeps the frozen body behind while its projection crosses a solid wall", () => {
    const config = ranniDuel("skill-wall-phase");
    const program = createDefaultMechanicsProgram();
    const initial = program.initial(config);
    const alpha = config.seats[0]!.competitorId;
    const body = findLocomotion(initial.slices.locomotion, alpha)!.position;
    const bodyTile = tileOf(body);
    const wall = { x: bodyTile.x + 1, y: bodyTile.y };
    let state = asPlayingWorld(program, initial, {
      arena: { crates: [], solid: [wall] },
    });

    state = program.step(state, {
      commands: [pressRight(state, config), useSkill(state, config, 1)],
    }).state;
    for (let tick = 0; tick < 64; tick += 1) {
      state = program.step(state, { commands: [] }).state;
    }

    expect(findLocomotion(state.slices.locomotion, alpha)!.position).toEqual(body);
    const projection = state.slices.skills.entries[0]!.projection!;
    expect(projection.x).toBeGreaterThan((wall.x + 1) * UNITS_PER_TILE);
    expect(tileOf(projection).x).toBeGreaterThan(wall.x);
  });

  it("auto-completes on exactly the 125th activation-inclusive tick", () => {
    const config = ranniDuel("skill-auto");
    const program = createDefaultMechanicsProgram();
    let state = asPlayingWorld(program, program.initial(config), { arena: { crates: [] } });
    const alpha = config.seats[0]!.competitorId;
    const body = findLocomotion(state.slices.locomotion, alpha)!.position;

    state = program.step(state, {
      commands: [pressRight(state, config), useSkill(state, config, 1)],
    }).state;
    for (let tick = 2; tick < 125; tick += 1) {
      state = program.step(state, { commands: [] }).state;
      expect(state.slices.skills.entries[0]!.phase).toBe("channeling");
      expect(findLocomotion(state.slices.locomotion, alpha)!.position).toEqual(body);
    }
    const completed = program.step(state, { commands: [] });
    expect(completed.state.slices.skills.entries[0]!.phase).toBe("cooldown");
    expect(findLocomotion(completed.state.slices.locomotion, alpha)!.position.x).toBeGreaterThan(body.x);
  });

  it("invalid completion (solid tile) stays physical but consumes full cooldown; landing on a rival body teleports", () => {
    const config = ranniDuel("skill-invalid");
    const program = createDefaultMechanicsProgram();
    let state = asPlayingWorld(program, program.initial(config), { arena: { crates: [] } });
    const alpha = config.seats[0]!.competitorId;
    const beta = config.seats[1]!.competitorId;
    const body = findLocomotion(state.slices.locomotion, alpha)!.position;
    const occupied = findLocomotion(state.slices.locomotion, beta)!.position;

    // Landing exactly on a solid pillar is still invalid → stays physical.
    const solidTile = state.slices.arena.solid[0]!;
    const draft = cloneDraft(state);
    draft.slices.skills.entries[0] = {
      competitorId: alpha,
      skillId: RANNI_ICE_BLINK_SKILL_ID,
      phase: "channeling",
      channelRemainingMs: TICK_DURATION_MS,
      cooldownRemainingMs: 0,
      projection: { ...tileCenter(solidTile) },
      bombEgressKeys: [],
    };
    state = program.restore(draft);

    const completed = program.step(state, { commands: [] });
    expect(findLocomotion(completed.state.slices.locomotion, alpha)!.position).toEqual(body);
    expect(completed.state.slices.skills.entries[0]).toMatchObject({
      phase: "cooldown",
      cooldownRemainingMs: 8_000,
      projection: null,
    });

    // Landing on a rival body is valid (Decision 012: bodies never block) →
    // the blink teleports onto the occupied position.
    const ontoBody = cloneDraft(state);
    ontoBody.slices.skills.entries[0] = {
      competitorId: alpha,
      skillId: RANNI_ICE_BLINK_SKILL_ID,
      phase: "channeling",
      channelRemainingMs: TICK_DURATION_MS,
      cooldownRemainingMs: 0,
      projection: { ...occupied },
      bombEgressKeys: [],
    };
    const teleported = program.step(program.restore(ontoBody), { commands: [] });
    expect(
      findLocomotion(teleported.state.slices.locomotion, alpha)!.position,
    ).toEqual(occupied);
    expect(teleported.state.slices.skills.entries[0]!.phase).toBe("cooldown");
  });

  it("rejects a bomb crossed by the projection as a landing destination", () => {
    const config = ranniDuel("skill-bomb-landing");
    const program = createDefaultMechanicsProgram();
    const base = asPlayingWorld(program, program.initial(config), { arena: { crates: [] } });
    const alpha = config.seats[0]!.competitorId;
    const beta = config.seats[1]!.competitorId;
    const body = findLocomotion(base.slices.locomotion, alpha)!.position;
    const bombTile = { x: tileOf(body).x + 1, y: tileOf(body).y };
    const bombPosition = tileCenter(bombTile);
    const draft = cloneDraft(base);
    draft.slices.bombs = {
      nextId: 2,
      items: [{
        id: 1,
        ownerId: beta,
        tile: bombTile,
        // Restored active bombs have already consumed the activation tick.
        fuseMs: BOMB_FUSE_MS - TICK_DURATION_MS,
        flameRange: 2,
          echo: false,
      }],
    };
    draft.slices.skills.entries[0] = {
      competitorId: alpha,
      skillId: RANNI_ICE_BLINK_SKILL_ID,
      phase: "channeling",
      channelRemainingMs: TICK_DURATION_MS * 2,
      cooldownRemainingMs: 0,
      projection: { ...bombPosition },
      bombEgressKeys: [],
      aimDirection: "right",
    };
    let state = program.restore(draft);

    state = program.step(state, { commands: [] }).state;
    expect(state.slices.skills.entries[0]!.bombEgressKeys).toEqual([]);
    expect(state.slices.skills.entries[0]!.projection).toEqual(bombPosition);

    const completed = program.step(state, { commands: [] }).state;
    expect(findLocomotion(completed.slices.locomotion, alpha)!.position).toEqual(body);
    expect(completed.slices.skills.entries[0]!.phase).toBe("cooldown");
  });

  it("is immune while channeling, vulnerable on completion, and places bombs at the physical body", () => {
    const config = ranniDuel("skill-immunity");
    const program = createDefaultMechanicsProgram();
    const alpha = config.seats[0]!.competitorId;
    const beta = config.seats[1]!.competitorId;
    let state = asPlayingWorld(program, program.initial(config), { arena: { crates: [] } });
    const body = findLocomotion(state.slices.locomotion, alpha)!.position;
    const bodyTile = tileOf(body);
    const draft = cloneDraft(state);
    draft.slices.flames.items = [{
      tile: bodyTile,
      remainingMs: 600,
      causes: [{ bombId: 7, ownerId: beta }],
    }];
    state = program.restore(draft);

    const activated = program.step(state, {
      commands: [
        useSkill(state, config),
        {
          tick: state.tick,
          sequence: 1,
          seatId: config.seats[0]!.seatId,
          command: { type: "place-bomb" as const },
        },
      ],
    });
    expect(findVitals(activated.state.slices.vitals, alpha)?.alive).toBe(true);
    expect(activated.state.slices.bombs.items[0]?.tile).toEqual(bodyTile);
    expect(findLocomotion(activated.state.slices.locomotion, alpha)!.position).toEqual(body);

    const completed = program.step(activated.state, {
      commands: [useSkill(activated.state, config)],
    });
    expect(findVitals(completed.state.slices.vitals, alpha)?.alive).toBe(false);
    expect(completed.events.some((event) =>
      event.type === "competitor-eliminated" && event.competitorId === alpha
    )).toBe(true);
  });

  it("rejects cooldown reuse, accepts exactly at zero, resets per round, and restores channel/cooldown", () => {
    const config = ranniDuel("skill-cooldown");
    const program = createDefaultMechanicsProgram();
    let state = asPlayingWorld(program, program.initial(config), { arena: { crates: [] } });
    state = program.step(state, { commands: [useSkill(state, config)] }).state;
    state = program.step(state, { commands: [useSkill(state, config)] }).state;
    expect(state.slices.skills.entries[0]!.cooldownRemainingMs).toBe(8_000);
    expect(program.restore(JSON.parse(JSON.stringify(state)))).toEqual(state);

    const rejected = program.step(state, { commands: [useSkill(state, config)] });
    expect(rejected.rejections).toContainEqual(expect.objectContaining({ reason: "skill-unavailable" }));
    state = rejected.state;
    expect(state.slices.skills.entries[0]!.cooldownRemainingMs).toBe(7_980);

    state = stepN(program, state, 398);
    expect(state.slices.skills.entries[0]!.cooldownRemainingMs).toBe(TICK_DURATION_MS);
    const ready = program.step(state, { commands: [useSkill(state, config)] });
    expect(ready.rejections).toEqual([]);
    expect(ready.state.slices.skills.entries[0]!.phase).toBe("channeling");
    expect(program.restore(JSON.parse(JSON.stringify(ready.state)))).toEqual(ready.state);

    const roundOver = asRoundOverWorld(program, ready.state, config.seats[1]!.competitorId, {
      phaseRemainingMs: TICK_DURATION_MS,
    });
    const reset = program.step(roundOver, { commands: [] }).state;
    expect(reset.slices.skills.entries[0]).toMatchObject({
      phase: "idle",
      channelRemainingMs: 0,
      cooldownRemainingMs: 0,
      projection: null,
    });
  });

  it("preserves replay/restore and forward/reversed module parity", () => {
    const config = ranniDuel("skill-parity");
    const forward = createDefaultMechanicsProgram("forward");
    const reversed = createDefaultMechanicsProgram("reversed");

    function run(program: MechanicsProgram) {
      let state = asPlayingWorld(program, program.initial(config), { arena: { crates: [] } });
      const events: GameEvent[] = [];
      const rejections: unknown[] = [];
      for (let tick = 0; tick < 8; tick += 1) {
        const commands = tick === 0
          ? [pressRight(state, config), useSkill(state, config, 1)]
          : tick === 4
            ? [useSkill(state, config)]
            : [];
        const result = program.step(state, { commands });
        state = result.state;
        events.push(...result.events);
        rejections.push(...result.rejections);
        if (tick === 2) state = program.restore(JSON.parse(JSON.stringify(state)));
      }
      return { state, events, rejections, snapshot: program.snapshot(state) };
    }

    const first = run(forward);
    const replayed = run(forward);
    const reordered = run(reversed);
    expect(replayed).toEqual(first);
    expect(reordered).toEqual(first);
  });
});

// ── Zed Living Shadow mechanics ─────────────────────────────────────────────

describe("Zed Living Shadow", () => {
  function useSkill(state: WorldState, config: MatchConfig, sequence = 0) {
    return {
      tick: state.tick,
      sequence,
      seatId: config.seats[0]!.seatId,
      command: { type: "use-skill" as const },
    };
  }

  function press(
    state: WorldState,
    config: MatchConfig,
    direction: Direction,
    sequence = 0,
  ) {
    return {
      tick: state.tick,
      sequence,
      seatId: config.seats[0]!.seatId,
      command: { type: "set-movement" as const, direction, pressed: true },
    };
  }

  function release(
    state: WorldState,
    config: MatchConfig,
    direction: Direction,
    sequence = 0,
  ) {
    return {
      tick: state.tick,
      sequence,
      seatId: config.seats[0]!.seatId,
      command: { type: "set-movement" as const, direction, pressed: false },
    };
  }

  it("places a fixed projection on the furthest free cardinal tile up to range 3", () => {
    const config = zedDuel("zed-place");
    const program = createDefaultMechanicsProgram();
    let state = asPlayingWorld(program, program.initial(config), { arena: { crates: [] } });
    const alpha = config.seats[0]!.competitorId;
    const body = findLocomotion(state.slices.locomotion, alpha)!.position;
    const bodyTile = tileOf(body);

    const activated = program.step(state, {
      commands: [press(state, config, "right"), useSkill(state, config, 1)],
    });
    state = activated.state;
    expect(activated.rejections).toEqual([]);
    const skill = state.slices.skills.entries[0]!;
    expect(skill).toMatchObject({
      skillId: ZED_LIVING_SHADOW_SKILL_ID,
      phase: "channeling",
      channelRemainingMs: ZED_CHANNEL_MS - TICK_DURATION_MS,
      cooldownRemainingMs: 0,
    });
    // Placement is resolved from body tile before locomotion (skills phase first).
    expect(skill.projection).toEqual(
      tileCenter({ x: bodyTile.x + ZED_SHADOW_RANGE, y: bodyTile.y }),
    );
    // Free-move window: body is not rooted and may advance with the aim press.
    expect(findLocomotion(state.slices.locomotion, alpha)!.position.x).toBeGreaterThanOrEqual(
      body.x,
    );
    // Shadow is not a teleport yet — body is not at the projection tile.
    expect(findLocomotion(state.slices.locomotion, alpha)!.position).not.toEqual(skill.projection);
  });

  it("stops placement ray on solid/crate and rejects when no free tile exists", () => {
    const config = zedDuel("zed-ray-block");
    const program = createDefaultMechanicsProgram();
    const initial = program.initial(config);
    const alpha = config.seats[0]!.competitorId;
    const body = findLocomotion(initial.slices.locomotion, alpha)!.position;
    const bodyTile = tileOf(body);
    // Wall two tiles ahead → furthest place is 1 tile.
    let state = asPlayingWorld(program, initial, {
      arena: {
        crates: [],
        solid: [{ x: bodyTile.x + 2, y: bodyTile.y }],
      },
    });
    state = program.step(state, {
      commands: [press(state, config, "right"), useSkill(state, config, 1)],
    }).state;
    expect(state.slices.skills.entries[0]!.projection).toEqual(
      tileCenter({ x: bodyTile.x + 1, y: bodyTile.y }),
    );

    // Crate immediately adjacent blocks all placement → reject, stay idle.
    const blocked = asPlayingWorld(program, initial, {
      arena: {
        crates: [{ x: bodyTile.x + 1, y: bodyTile.y }],
        solid: [],
      },
    });
    const rejected = program.step(blocked, {
      commands: [press(blocked, config, "right"), useSkill(blocked, config, 1)],
    });
    expect(rejected.rejections).toContainEqual(
      expect.objectContaining({ reason: "skill-unavailable" }),
    );
    expect(rejected.state.slices.skills.entries[0]!.phase).toBe("idle");
    expect(rejected.state.slices.skills.entries[0]!.projection).toBeNull();
    // Body is free even on reject (not rooted by a failed cast).
    expect(findLocomotion(rejected.state.slices.locomotion, alpha)!.position.x).toBeGreaterThanOrEqual(
      body.x,
    );
  });

  it("allows placement through and onto bomb tiles (bombs do not block ray)", () => {
    const config = zedDuel("zed-bomb-place");
    const program = createDefaultMechanicsProgram();
    const base = asPlayingWorld(program, program.initial(config), { arena: { crates: [] } });
    const alpha = config.seats[0]!.competitorId;
    const beta = config.seats[1]!.competitorId;
    const body = findLocomotion(base.slices.locomotion, alpha)!.position;
    const bodyTile = tileOf(body);
    const draft = cloneDraft(base);
    draft.slices.bombs = {
      nextId: 3,
      items: [
        {
          id: 1,
          ownerId: beta,
          tile: { x: bodyTile.x + 1, y: bodyTile.y },
          fuseMs: BOMB_FUSE_MS - TICK_DURATION_MS,
          flameRange: 2,
          echo: false,
        },
        {
          id: 2,
          ownerId: beta,
          tile: { x: bodyTile.x + 3, y: bodyTile.y },
          fuseMs: BOMB_FUSE_MS - TICK_DURATION_MS,
          flameRange: 2,
          echo: false,
        },
      ],
    };
    let state = program.restore(draft);
    state = program.step(state, {
      commands: [press(state, config, "right"), useSkill(state, config, 1)],
    }).state;
    // Furthest free tile is still range 3 even with bombs on the path.
    expect(state.slices.skills.entries[0]!.projection).toEqual(
      tileCenter({ x: bodyTile.x + ZED_SHADOW_RANGE, y: bodyTile.y }),
    );
    // Bombs are untouched (no fuse rewrite, no extra plant).
    expect(state.slices.bombs.items).toHaveLength(2);
    expect(state.slices.bombs.items.map((b) => b.fuseMs)).toEqual([
      BOMB_FUSE_MS - TICK_DURATION_MS * 2,
      BOMB_FUSE_MS - TICK_DURATION_MS * 2,
    ]);
  });

  it("keeps the body freely movable during the shadow window", () => {
    const config = zedDuel("zed-free-move");
    const program = createDefaultMechanicsProgram();
    let state = asPlayingWorld(program, program.initial(config), { arena: { crates: [] } });
    const alpha = config.seats[0]!.competitorId;
    const body = findLocomotion(state.slices.locomotion, alpha)!.position;
    const bodyTile = tileOf(body);

    state = program.step(state, {
      commands: [press(state, config, "right"), useSkill(state, config, 1)],
    }).state;
    const projection = state.slices.skills.entries[0]!.projection!;
    expect(projection).toEqual(tileCenter({ x: bodyTile.x + ZED_SHADOW_RANGE, y: bodyTile.y }));

    // Keep moving right for several ticks; body advances, projection stays fixed.
    for (let i = 0; i < 8; i += 1) {
      state = program.step(state, { commands: [] }).state;
    }
    const after = findLocomotion(state.slices.locomotion, alpha)!.position;
    expect(after.x).toBeGreaterThan(body.x);
    expect(state.slices.skills.entries[0]!.projection).toEqual(projection);
    expect(state.slices.skills.entries[0]!.phase).toBe("channeling");
  });

  it("swaps body to projection on valid recast, clears projection, starts full CD", () => {
    const config = zedDuel("zed-swap-valid");
    const program = createDefaultMechanicsProgram();
    let state = asPlayingWorld(program, program.initial(config), { arena: { crates: [] } });
    const alpha = config.seats[0]!.competitorId;

    state = program.step(state, {
      commands: [press(state, config, "right"), useSkill(state, config, 1)],
    }).state;
    const projection = state.slices.skills.entries[0]!.projection!;
    // Stop movement so body stays put; then recast.
    state = program.step(state, {
      commands: [release(state, config, "right"), useSkill(state, config, 1)],
    }).state;

    expect(findLocomotion(state.slices.locomotion, alpha)!.position).toEqual(projection);
    expect(state.slices.skills.entries[0]).toMatchObject({
      phase: "cooldown",
      channelRemainingMs: 0,
      cooldownRemainingMs: ZED_COOLDOWN_MS,
      projection: null,
    });
  });

  it("invalid recast does not teleport and uses fail cooldown", () => {
    const config = zedDuel("zed-swap-invalid");
    const program = createDefaultMechanicsProgram();
    let state = asPlayingWorld(program, program.initial(config), { arena: { crates: [] } });
    const alpha = config.seats[0]!.competitorId;
    const body = findLocomotion(state.slices.locomotion, alpha)!.position;
    const solidTile = state.slices.arena.solid[0]!;

    const draft = cloneDraft(state);
    draft.slices.skills.entries[0] = {
      competitorId: alpha,
      skillId: ZED_LIVING_SHADOW_SKILL_ID,
      phase: "channeling",
      channelRemainingMs: TICK_DURATION_MS * 10,
      cooldownRemainingMs: 0,
      projection: { ...tileCenter(solidTile) },
      bombEgressKeys: [],
      aimDirection: "right",
    };
    state = program.restore(draft);
    const completed = program.step(state, { commands: [useSkill(state, config)] });
    expect(findLocomotion(completed.state.slices.locomotion, alpha)!.position).toEqual(body);
    expect(completed.state.slices.skills.entries[0]).toMatchObject({
      phase: "cooldown",
      cooldownRemainingMs: ZED_FAIL_COOLDOWN_MS,
      projection: null,
    });
  });

  it("timeout without swap clears projection with fail CD and no teleport", () => {
    const config = zedDuel("zed-timeout");
    const program = createDefaultMechanicsProgram();
    let state = asPlayingWorld(program, program.initial(config), { arena: { crates: [] } });
    const alpha = config.seats[0]!.competitorId;
    const body = findLocomotion(state.slices.locomotion, alpha)!.position;

    state = program.step(state, {
      commands: [press(state, config, "right"), useSkill(state, config, 1)],
    }).state;
    // Activation-inclusive ticks: ZED_CHANNEL_MS / TICK = 100.
    for (let tick = 2; tick < ZED_CHANNEL_MS / TICK_DURATION_MS; tick += 1) {
      state = program.step(state, { commands: [] }).state;
      expect(state.slices.skills.entries[0]!.phase).toBe("channeling");
    }
    const completed = program.step(state, { commands: [] });
    // Free-move may have advanced body if intent stuck; release intent first.
    // After timeout, skill is on fail CD and projection is cleared.
    expect(completed.state.slices.skills.entries[0]).toMatchObject({
      phase: "cooldown",
      cooldownRemainingMs: ZED_FAIL_COOLDOWN_MS,
      projection: null,
    });
    // Without a swap press, body never jumps to the projection tile.
    const projectionTarget = tileCenter({
      x: tileOf(body).x + ZED_SHADOW_RANGE,
      y: tileOf(body).y,
    });
    expect(findLocomotion(completed.state.slices.locomotion, alpha)!.position).not.toEqual(
      projectionTarget,
    );
  });

  it("emits no skill-hit and does not plant a second bomb on activate", () => {
    const config = zedDuel("zed-no-damage");
    const program = createDefaultMechanicsProgram();
    let state = asPlayingWorld(program, program.initial(config), { arena: { crates: [] } });
    const alpha = config.seats[0]!.competitorId;
    const beta = config.seats[1]!.competitorId;

    // Place rival on the shadow landing tile; shadow must not kill them.
    const body = findLocomotion(state.slices.locomotion, alpha)!.position;
    const landing = tileCenter({
      x: tileOf(body).x + ZED_SHADOW_RANGE,
      y: tileOf(body).y,
    });
    const draft = cloneDraft(state);
    const betaEntry = draft.slices.locomotion.entries.find((e) => e.competitorId === beta)!;
    betaEntry.position = { ...landing };
    state = program.restore(draft);

    const activated = program.step(state, {
      commands: [press(state, config, "right"), useSkill(state, config, 1)],
    });
    expect(activated.rejections).toEqual([]);
    expect(findVitals(activated.state.slices.vitals, beta)?.alive).toBe(true);
    expect(activated.state.slices.bombs.items).toHaveLength(0);
    // Complete swap onto rival body (bodies never block) — still no skill-hit.
    const swapped = program.step(activated.state, {
      commands: [useSkill(activated.state, config)],
    });
    expect(findVitals(swapped.state.slices.vitals, beta)?.alive).toBe(true);
    expect(swapped.events.every((e) => e.type !== "competitor-eliminated")).toBe(true);
    expect(findLocomotion(swapped.state.slices.locomotion, alpha)!.position).toEqual(landing);
  });

  it("has no channel immunity during the free-move window (Ranni remains immune)", () => {
    // Zed vulnerable while channeling.
    {
      const config = zedDuel("zed-no-immunity");
      const program = createDefaultMechanicsProgram();
      const alpha = config.seats[0]!.competitorId;
      const beta = config.seats[1]!.competitorId;
      let state = asPlayingWorld(program, program.initial(config), { arena: { crates: [] } });
      const body = findLocomotion(state.slices.locomotion, alpha)!.position;
      const bodyTile = tileOf(body);
      const draft = cloneDraft(state);
      draft.slices.flames.items = [{
        tile: bodyTile,
        remainingMs: 600,
        causes: [{ bombId: 7, ownerId: beta }],
      }];
      // Clear spawn protection so flame can kill.
      draft.slices.vitals.entries = draft.slices.vitals.entries.map((row) =>
        row.competitorId === alpha
          ? { ...row, spawnProtectionRemainingMs: 0 }
          : row
      );
      state = program.restore(draft);

      const activated = program.step(state, {
        commands: [useSkill(state, config)],
      });
      expect(activated.state.slices.skills.entries[0]).toMatchObject({
        phase: "cooldown",
        channelRemainingMs: 0,
        cooldownRemainingMs: ZED_FAIL_COOLDOWN_MS,
        projection: null,
      });
      expect(findVitals(activated.state.slices.vitals, alpha)?.alive).toBe(false);
      expect(activated.events.some((event) =>
        event.type === "competitor-eliminated" && event.competitorId === alpha
      )).toBe(true);
    }

    // Ranni still immune while channeling (no global regression).
    {
      const config = ranniDuel("ranni-still-immune");
      const program = createDefaultMechanicsProgram();
      const alpha = config.seats[0]!.competitorId;
      const beta = config.seats[1]!.competitorId;
      let state = asPlayingWorld(program, program.initial(config), { arena: { crates: [] } });
      const body = findLocomotion(state.slices.locomotion, alpha)!.position;
      const bodyTile = tileOf(body);
      const draft = cloneDraft(state);
      draft.slices.flames.items = [{
        tile: bodyTile,
        remainingMs: 600,
        causes: [{ bombId: 8, ownerId: beta }],
      }];
      draft.slices.vitals.entries = draft.slices.vitals.entries.map((row) =>
        row.competitorId === alpha
          ? { ...row, spawnProtectionRemainingMs: 0 }
          : row
      );
      state = program.restore(draft);

      const activated = program.step(state, {
        commands: [useSkill(state, config)],
      });
      expect(activated.state.slices.skills.entries[0]!.phase).toBe("channeling");
      expect(findVitals(activated.state.slices.vitals, alpha)?.alive).toBe(true);
    }
  });

  it("restores channel/cooldown and rejects reuse during fail CD", () => {
    const config = zedDuel("zed-restore-cd");
    const program = createDefaultMechanicsProgram();
    let state = asPlayingWorld(program, program.initial(config), { arena: { crates: [] } });
    state = program.step(state, {
      commands: [press(state, config, "right"), useSkill(state, config, 1)],
    }).state;
    // Timeout path → fail CD.
    state = stepN(program, state, ZED_CHANNEL_MS / TICK_DURATION_MS);
    expect(state.slices.skills.entries[0]!.phase).toBe("cooldown");
    expect(state.slices.skills.entries[0]!.cooldownRemainingMs).toBeLessThanOrEqual(
      ZED_FAIL_COOLDOWN_MS,
    );
    expect(program.restore(JSON.parse(JSON.stringify(state)))).toEqual(state);

    const rejected = program.step(state, { commands: [useSkill(state, config)] });
    expect(rejected.rejections).toContainEqual(
      expect.objectContaining({ reason: "skill-unavailable" }),
    );
  });

  it("plants a free echo bomb at the projection tile with shared owner and fuse", () => {
    const config = zedDuel("zed-echo-plant");
    const program = createDefaultMechanicsProgram();
    let state = asPlayingWorld(program, program.initial(config), { arena: { crates: [] } });
    const alpha = config.seats[0]!.competitorId;
    const seatId = config.seats[0]!.seatId;

    state = program.step(state, {
      commands: [press(state, config, "right"), useSkill(state, config, 1)],
    }).state;
    // Stop so body stays put for a clean body-tile plant.
    state = program.step(state, {
      commands: [release(state, config, "right")],
    }).state;
    const bodyTile = tileOf(findLocomotion(state.slices.locomotion, alpha)!.position);
    const projection = state.slices.skills.entries[0]!.projection!;
    const shadowTile = tileOf(projection);

    const planted = program.step(state, {
      commands: [{
        tick: state.tick,
        sequence: 0,
        seatId,
        command: { type: "place-bomb" },
      }],
    });
    state = planted.state;
    expect(planted.rejections).toEqual([]);
    expect(state.slices.bombs.items).toHaveLength(2);
    const bodyBomb = state.slices.bombs.items.find((b) =>
      b.tile.x === bodyTile.x && b.tile.y === bodyTile.y
    );
    const echoBomb = state.slices.bombs.items.find((b) =>
      b.tile.x === shadowTile.x && b.tile.y === shadowTile.y
    );
    // Fuse advances once in the same tick after placement (bomb-fuse system).
    const fuseAfterPlace = BOMB_FUSE_MS - TICK_DURATION_MS;
    expect(bodyBomb).toMatchObject({
      ownerId: alpha,
      fuseMs: fuseAfterPlace,
      echo: false,
    });
    expect(echoBomb).toMatchObject({
      ownerId: alpha,
      fuseMs: fuseAfterPlace,
      flameRange: bodyBomb!.flameRange,
      echo: true,
    });
    // Free echo does not consume a second capacity slot (maxBombs default 1).
    expect(countActiveBombs(state.slices.bombs, alpha)).toBe(1);
    expect(planted.events.filter((e) => e.type === "bomb-placed")).toHaveLength(2);
  });

  it("skips illegal echo without cancelling the body plant", () => {
    const config = zedDuel("zed-echo-blocked");
    const program = createDefaultMechanicsProgram();
    let state = asPlayingWorld(program, program.initial(config), { arena: { crates: [] } });
    const alpha = config.seats[0]!.competitorId;
    const beta = config.seats[1]!.competitorId;
    const seatId = config.seats[0]!.seatId;

    state = program.step(state, {
      commands: [press(state, config, "right"), useSkill(state, config, 1)],
    }).state;
    state = program.step(state, {
      commands: [release(state, config, "right")],
    }).state;
    const bodyTile = tileOf(findLocomotion(state.slices.locomotion, alpha)!.position);
    const shadowTile = tileOf(state.slices.skills.entries[0]!.projection!);

    // Occupy the shadow tile with a rival bomb so echo is illegal.
    const draft = cloneDraft(state);
    draft.slices.bombs = {
      nextId: 2,
      items: [{
        id: 1,
        ownerId: beta,
        tile: { ...shadowTile },
        fuseMs: BOMB_FUSE_MS - TICK_DURATION_MS,
        flameRange: 2,
        echo: false,
      }],
    };
    state = program.restore(draft);

    const planted = program.step(state, {
      commands: [{
        tick: state.tick,
        sequence: 0,
        seatId,
        command: { type: "place-bomb" },
      }],
    });
    expect(planted.rejections).toEqual([]);
    expect(planted.state.slices.bombs.items).toHaveLength(2);
    const bodyBomb = planted.state.slices.bombs.items.find((b) =>
      b.ownerId === alpha
    );
    expect(bodyBomb).toMatchObject({
      tile: bodyTile,
      echo: false,
      fuseMs: BOMB_FUSE_MS - TICK_DURATION_MS,
    });
    // Rival bomb still on shadow tile; no second alpha bomb.
    expect(
      planted.state.slices.bombs.items.filter((b) => b.ownerId === alpha),
    ).toHaveLength(1);
    expect(countActiveBombs(planted.state.slices.bombs, alpha)).toBe(1);
  });

  it("restores echoes only for Living Shadow owners", () => {
    const program = createDefaultMechanicsProgram();
    const zedConfig = zedDuel("zed-echo-restore");
    const zedState = asPlayingWorld(program, program.initial(zedConfig), {
      arena: { crates: [] },
    });
    const echoOwner = zedConfig.seats[0]!.competitorId;
    const zedDraft = cloneDraft(zedState);
    zedDraft.slices.bombs = {
      nextId: 2,
      items: [{
        id: 1,
        ownerId: echoOwner,
        tile: { x: 1, y: 1 },
        fuseMs: BOMB_FUSE_MS - TICK_DURATION_MS,
        flameRange: 1,
        echo: true,
      }],
    };
    expect(program.restore(zedDraft).slices.bombs.items[0]!.echo).toBe(true);

    const ranniConfig = ranniDuel("ranni-echo-restore");
    const ranniDraft = cloneDraft(asPlayingWorld(
      program,
      program.initial(ranniConfig),
      { arena: { crates: [] } },
    ));
    ranniDraft.slices.bombs = {
      nextId: 2,
      items: [{
        id: 1,
        ownerId: ranniConfig.seats[0]!.competitorId,
        tile: { x: 1, y: 1 },
        fuseMs: BOMB_FUSE_MS - TICK_DURATION_MS,
        flameRange: 1,
        echo: true,
      }],
    };
    expect(() => program.restore(ranniDraft)).toThrow(
      /echo requires a zed-living-shadow owner/,
    );
  });

  it("keeps echo bombs through swap and chains like normal ordnance", () => {
    const config = zedDuel("zed-echo-swap-chain");
    const program = createDefaultMechanicsProgram();
    let state = asPlayingWorld(program, program.initial(config), { arena: { crates: [] } });
    const alpha = config.seats[0]!.competitorId;
    const seatId = config.seats[0]!.seatId;

    state = program.step(state, {
      commands: [press(state, config, "right"), useSkill(state, config, 1)],
    }).state;
    state = program.step(state, {
      commands: [release(state, config, "right")],
    }).state;
    const projection = state.slices.skills.entries[0]!.projection!;

    state = program.step(state, {
      commands: [{
        tick: state.tick,
        sequence: 0,
        seatId,
        command: { type: "place-bomb" },
      }],
    }).state;
    expect(state.slices.bombs.items).toHaveLength(2);

    // Valid swap does not clear existing bombs.
    state = program.step(state, {
      commands: [useSkill(state, config)],
    }).state;
    expect(findLocomotion(state.slices.locomotion, alpha)!.position).toEqual(projection);
    expect(state.slices.skills.entries[0]!.projection).toBeNull();
    expect(state.slices.bombs.items).toHaveLength(2);
    expect(state.slices.bombs.items.every((b) => b.ownerId === alpha)).toBe(true);

    // Advance fuse until both detonate; both produce explosions.
    let exploded = 0;
    for (let i = 0; i < BOMB_FUSE_MS / TICK_DURATION_MS + 2; i += 1) {
      const stepped = program.step(state, { commands: [] });
      state = stepped.state;
      exploded += stepped.events.filter((e) => e.type === "bomb-exploded").length;
    }
    expect(exploded).toBeGreaterThanOrEqual(2);
    expect(state.slices.bombs.items).toHaveLength(0);
  });

  it("does not echo plants for non-Living-Shadow seats or outside channel", () => {
    // Killer Bee / Ranni-style: no dual plant.
    {
      const config = ranniDuel("ranni-no-echo");
      const program = createDefaultMechanicsProgram();
      let state = asPlayingWorld(program, program.initial(config), { arena: { crates: [] } });
      const alpha = config.seats[0]!.competitorId;
      const seatId = config.seats[0]!.seatId;
      state = program.step(state, {
        commands: [useSkill(state, config, 1)],
      }).state;
      expect(state.slices.skills.entries[0]!.phase).toBe("channeling");
      state = program.step(state, {
        commands: [{
          tick: state.tick,
          sequence: 0,
          seatId,
          command: { type: "place-bomb" },
        }],
      }).state;
      expect(state.slices.bombs.items).toHaveLength(1);
      expect(state.slices.bombs.items[0]!.echo).toBe(false);
      expect(countActiveBombs(state.slices.bombs, alpha)).toBe(1);
    }
    // Zed outside channel: body only.
    {
      const config = zedDuel("zed-no-channel-echo");
      const program = createDefaultMechanicsProgram();
      let state = asPlayingWorld(program, program.initial(config), { arena: { crates: [] } });
      const seatId = config.seats[0]!.seatId;
      state = program.step(state, {
        commands: [{
          tick: state.tick,
          sequence: 0,
          seatId,
          command: { type: "place-bomb" },
        }],
      }).state;
      expect(state.slices.bombs.items).toHaveLength(1);
      expect(state.slices.bombs.items[0]!.echo).toBe(false);
    }
  });
});

// ── Part 1: pure brawler bot + seeded PRNG ───────────────────────────────────
import {
  createBotPrng,
  createBotMemory,
  decideBot,
  driveBot,
  translateDecision,
  type BotDecision,
  type BotMemory,
} from "../src/bots/index.ts";
import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  UNITS_PER_TILE as BOT_UNITS_PER_TILE,
  createArenaTiles as botCreateArenaTiles,
  tileCenter as botTileCenter,
} from "../src/kernel/world-state.ts";

const BOT_SEAT = "s1" as SeatId;
const BOT_ID = "b" as CompetitorId;
const FOE_ID = "a" as CompetitorId;

type BotCompetitor = GameSnapshot["competitors"][number];

type SnapshotOverrides = Partial<{
  phase: GameSnapshot["phase"];
  self: Partial<BotCompetitor>;
  foe: Partial<BotCompetitor> | null;
  bombs: GameSnapshot["bombs"];
  flames: GameSnapshot["flames"];
  crates: readonly { x: number; y: number }[];
  solid: readonly { x: number; y: number }[];
}>;

function borderAndPillars(): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let y = 0; y < ARENA_HEIGHT; y += 1) {
    for (let x = 0; x < ARENA_WIDTH; x += 1) {
      const isBorder = x === 0 || y === 0 || x === ARENA_WIDTH - 1 || y === ARENA_HEIGHT - 1;
      const isPillar = x > 0 && y > 0 && x % 2 === 0 && y % 2 === 0;
      if (isBorder || isPillar) out.push({ x, y });
    }
  }
  return out;
}

function botCompetitor(
  id: CompetitorId,
  seatId: SeatId,
  tile: { x: number; y: number },
  extra: Partial<BotCompetitor> = {},
): BotCompetitor {
  return {
    id,
    seatId,
    position: botTileCenter({ x: tile.x, y: tile.y }),
    velocity: { x: 0, y: 0 },
    tile: { x: tile.x, y: tile.y },
    alive: true,
    spawnProtectionRemainingMs: 0,
    activeBombs: 0,
    maxBombs: 1,
    flameRange: 2,
    ...extra,
  };
}

function botSnapshot(
  selfTile: { x: number; y: number },
  foeTile: { x: number; y: number } | null,
  overrides: SnapshotOverrides = {},
): GameSnapshot {
  const solid = overrides.solid ?? borderAndPillars();
  const crates = overrides.crates ?? [];
  const competitors: BotCompetitor[] = [botCompetitor(BOT_ID, BOT_SEAT, selfTile, overrides.self)];
  if (overrides.foe !== null && foeTile) {
    competitors.unshift(botCompetitor(FOE_ID, "s0" as SeatId, foeTile, overrides.foe ?? {}));
  }
  return {
    version: GAME_MECHANICS_VERSION,
    revision: 1,
    config: localDuel("bot-seed"),
    phase: overrides.phase ?? "playing",
    roundNumber: 1,
    phaseRemainingMs: 0,
    roundElapsedMs: 5_000,
    roundRemainingMs: 55_000,
    suddenDeathElapsedMs: 0,
    scores: [],
    targetRoundWins: 2,
    matchWinner: null,
    elapsedMs: 5_000,
    remainingMs: 55_000,
    arena: { width: ARENA_WIDTH, height: ARENA_HEIGHT, solid, crates },
    pressure: { closing: null, pathLength: 0 },
    competitors,
    bombs: overrides.bombs ?? [],
    flames: overrides.flames ?? [],
    powerUps: [],
    outcome: null,
  } as GameSnapshot;
}

const DIR_DELTA: Record<string, { x: number; y: number }> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

describe("bot PRNG (seeded, deterministic)", () => {
  it("reproduces the same stream for the same seed", () => {
    const a = createBotPrng("seed-x");
    const b = createBotPrng("seed-x");
    for (let i = 0; i < 100; i += 1) expect(a.next()).toBe(b.next());
  });

  it("diverges for different seeds", () => {
    const a = createBotPrng("seed-x");
    const b = createBotPrng("seed-y");
    let differ = false;
    for (let i = 0; i < 20; i += 1) if (a.next() !== b.next()) differ = true;
    expect(differ).toBe(true);
  });

  it("int stays within bounds and pick returns array members", () => {
    const prng = createBotPrng("bounds");
    for (let i = 0; i < 200; i += 1) {
      const v = prng.int(5);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(5);
    }
    const items = ["up", "down", "left", "right"] as const;
    for (let i = 0; i < 50; i += 1) expect(items).toContain(prng.pick(items));
  });

  it("rejects invalid int bounds and empty pick", () => {
    const prng = createBotPrng("guard");
    expect(() => prng.int(0)).toThrow();
    expect(() => prng.int(-1)).toThrow();
    expect(() => prng.pick([])).toThrow();
  });
});

describe("bot policy (pure decisions)", () => {
  const prng = createBotPrng("policy");

  it("idles outside live-play phase or when dead", () => {
    const mem = createBotMemory();
    expect(
      decideBot(botSnapshot({ x: 1, y: 1 }, { x: 9, y: 7 }, { phase: "round-start" }), BOT_SEAT, prng, mem).intent.kind,
    ).toBe("idle");
    expect(
      decideBot(botSnapshot({ x: 1, y: 1 }, { x: 9, y: 7 }, { self: { alive: false } }), BOT_SEAT, prng, mem).intent.kind,
    ).toBe("idle");
  });

  it("flees a tile covered by an active flame", () => {
    const snap = botSnapshot({ x: 1, y: 1 }, { x: 9, y: 7 }, {
      flames: [{ tile: { x: 1, y: 1 }, remainingMs: 400, ownerId: FOE_ID, causes: [] }],
    });
    const decision = decideBot(snap, BOT_SEAT, prng, createBotMemory());
    expect(decision.intent.kind).toBe("move");
    expect(decision.placeBomb).toBe(false);
    if (decision.intent.kind === "move") {
      const d = DIR_DELTA[decision.intent.direction]!;
      expect({ x: 1 + d.x, y: 1 + d.y }).not.toEqual({ x: 1, y: 1 });
    }
  });

  it("flees a live bomb blast cross before detonation", () => {
    const snap = botSnapshot({ x: 3, y: 1 }, { x: 9, y: 7 }, {
      bombs: [{ id: 1, ownerId: FOE_ID, tile: { x: 1, y: 1 }, fuseMs: 300, flameRange: 3 }],
    });
    const decision = decideBot(snap, BOT_SEAT, prng, createBotMemory());
    expect(decision.intent.kind).toBe("move");
    if (decision.intent.kind === "move") {
      const d = DIR_DELTA[decision.intent.direction]!;
      expect(1 + d.y).not.toBe(1);
    }
  });

  it("bombs an adjacent crate when an escape exists, then retreats", () => {
    const snap = botSnapshot({ x: 1, y: 1 }, { x: 9, y: 7 }, { crates: [{ x: 2, y: 1 }] });
    const decision = decideBot(snap, BOT_SEAT, prng, createBotMemory());
    expect(decision.placeBomb).toBe(true);
    expect(decision.intent.kind).toBe("move");
  });

  it("does NOT bomb when no post-bomb escape exists", () => {
    const snap = botSnapshot({ x: 1, y: 1 }, { x: 9, y: 7 }, {
      crates: [{ x: 2, y: 1 }, { x: 1, y: 2 }],
      self: { flameRange: 3 },
    });
    const decision = decideBot(snap, BOT_SEAT, prng, createBotMemory());
    expect(decision.placeBomb).toBe(false);
  });

  it("does NOT bomb when its only retreat crosses an earlier pending blast", () => {
    const snap = botSnapshot({ x: 7, y: 7 }, { x: 7, y: 5 }, {
      self: { activeBombs: 1, maxBombs: 2, flameRange: 2 },
      bombs: [{ id: 1, ownerId: BOT_ID, tile: { x: 9, y: 5 }, fuseMs: 300, flameRange: 3 }],
      solid: [
        ...borderAndPillars(),
        { x: 6, y: 7 },
        { x: 7, y: 6 },
      ],
    });
    const decision = decideBot(snap, BOT_SEAT, prng, createBotMemory());
    expect(decision.placeBomb).toBe(false);
  });

  it("does NOT route through a flame that remains active during traversal", () => {
    const snap = botSnapshot({ x: 7, y: 7 }, { x: 7, y: 5 }, {
      self: { flameRange: 2 },
      flames: [{ tile: { x: 8, y: 7 }, remainingMs: 600, ownerId: BOT_ID, causes: [] }],
      solid: [
        ...borderAndPillars(),
        { x: 6, y: 7 },
        { x: 7, y: 6 },
      ],
    });
    const decision = decideBot(snap, BOT_SEAT, prng, createBotMemory());
    expect(decision.placeBomb).toBe(false);
  });

  it("bombs an aligned in-range opponent with an escape", () => {
    const snap = botSnapshot({ x: 1, y: 3 }, { x: 1, y: 5 }, { self: { flameRange: 2 } });
    const decision = decideBot(snap, BOT_SEAT, prng, createBotMemory());
    expect(decision.placeBomb).toBe(true);
  });

  it("does NOT bomb an aligned opponent beyond flame range", () => {
    const snap = botSnapshot({ x: 1, y: 1 }, { x: 1, y: 7 }, { self: { flameRange: 2 } });
    const decision = decideBot(snap, BOT_SEAT, prng, createBotMemory());
    expect(decision.placeBomb).toBe(false);
  });

  it("pursues toward the nearest opponent with a legal first step", () => {
    const snap = botSnapshot({ x: 1, y: 1 }, { x: 5, y: 1 });
    const decision = decideBot(snap, BOT_SEAT, prng, createBotMemory());
    expect(decision.intent.kind).toBe("move");
    if (decision.intent.kind === "move") {
      const d = DIR_DELTA[decision.intent.direction]!;
      const next = { x: 1 + d.x, y: 1 + d.y };
      expect(next.x).toBeGreaterThan(0);
      expect(next.y).toBeGreaterThan(0);
    }
  });

  it("honours the self-imposed bomb cooldown after a placement", () => {
    const mem = createBotMemory();
    const snap = botSnapshot({ x: 1, y: 1 }, { x: 9, y: 7 }, { crates: [{ x: 2, y: 1 }] });
    expect(decideBot(snap, BOT_SEAT, prng, mem).placeBomb).toBe(true);
    expect(decideBot(snap, BOT_SEAT, prng, mem).placeBomb).toBe(false);
  });

  it("is deterministic for identical inputs", () => {
    const make = () => botSnapshot({ x: 1, y: 1 }, { x: 7, y: 5 });
    const a = decideBot(make(), BOT_SEAT, createBotPrng("det"), createBotMemory());
    const b = decideBot(make(), BOT_SEAT, createBotPrng("det"), createBotMemory());
    expect(a).toEqual(b);
  });
});

describe("bot decision to command adapter (press/release transitions)", () => {
  it("presses a fresh direction and releases the stale one on change", () => {
    const mem: BotMemory = createBotMemory();
    const first = translateDecision({ intent: { kind: "move", direction: "right" }, placeBomb: false }, BOT_ID, mem);
    expect(first).toEqual([{ type: "set-movement", competitorId: BOT_ID, direction: "right", pressed: true }]);
    expect(mem.pressed).toBe("right");
    const second = translateDecision({ intent: { kind: "move", direction: "up" }, placeBomb: false }, BOT_ID, mem);
    expect(second).toEqual([
      { type: "set-movement", competitorId: BOT_ID, direction: "right", pressed: false },
      { type: "set-movement", competitorId: BOT_ID, direction: "up", pressed: true },
    ]);
    expect(mem.pressed).toBe("up");
  });

  it("emits nothing when the direction is unchanged", () => {
    const mem = createBotMemory();
    const move: BotDecision = { intent: { kind: "move", direction: "right" }, placeBomb: false };
    translateDecision(move, BOT_ID, mem);
    expect(translateDecision(move, BOT_ID, mem)).toEqual([]);
  });

  it("releases the held key when the bot goes idle", () => {
    const mem = createBotMemory();
    translateDecision({ intent: { kind: "move", direction: "down" }, placeBomb: false }, BOT_ID, mem);
    const release = translateDecision({ intent: { kind: "idle" }, placeBomb: false }, BOT_ID, mem);
    expect(release).toEqual([{ type: "set-movement", competitorId: BOT_ID, direction: "down", pressed: false }]);
    expect(mem.pressed).toBe(null);
  });

  it("appends place-bomb after movement transitions", () => {
    const mem = createBotMemory();
    const commands = translateDecision({ intent: { kind: "move", direction: "left" }, placeBomb: true }, BOT_ID, mem);
    expect(commands.at(-1)).toEqual({ type: "place-bomb", competitorId: BOT_ID });
  });
});

describe("bot facade integration (real kernel, deterministic)", () => {
  function runSession(seed: string, ticks: number) {
    const config = localDuel(seed);
    const game = createGameMechanics(config);
    const seatId = config.seats[1]!.seatId;
    const competitorId = config.seats[1]!.competitorId;
    const prng = createBotPrng(config.seed);
    const mem = createBotMemory();
    let placedBomb = false;
    let botEverAlive = false;
    game.dispatch({ type: "advance", deltaMs: ROUND_START_MS });
    for (let tick = 0; tick < ticks; tick += 1) {
      const snap = game.snapshot();
      if (snap.phase === "playing" || snap.phase === "sudden-death") {
        botEverAlive = true;
        for (const command of driveBot(snap, seatId, competitorId, prng, mem)) {
          if (command.type === "place-bomb") placedBomb = true;
          game.dispatch(command);
        }
      }
      game.dispatch({ type: "advance", deltaMs: TICK_DURATION_MS });
    }
    const final = game.snapshot();
    const bot = final.competitors.find((c) => c.id === competitorId)!;
    return { revision: final.revision, botAlive: bot.alive, placedBomb, botEverAlive };
  }

  it("drives P2 through live play, engages, and replays byte-identically", () => {
    const a = runSession("bot-integration", 400);
    const b = runSession("bot-integration", 400);
    expect(a).toEqual(b);
    expect(a.botEverAlive).toBe(true);
    expect(a.placedBomb).toBe(true);
  });

  it("survives 30 seconds of normal bombing without self-elimination", () => {
    const config = createLocalDuel1v1MatchConfig({
      seed: "bot-selfsafe",
      targetRoundWins: 9,
    });
    const game = createGameMechanics(config);
    const seatId = config.seats[1]!.seatId;
    const competitorId = config.seats[1]!.competitorId;
    const prng = createBotPrng(config.seed);
    const memory = createBotMemory();
    const targetLiveTicks = 30_000 / TICK_DURATION_MS;
    let liveTicks = 0;
    let totalTicks = 0;
    let placedBomb = false;
    const selfEliminations: GameEvent[] = [];

    game.dispatch({ type: "advance", deltaMs: ROUND_START_MS });
    while (liveTicks < targetLiveTicks && totalTicks < 10_000) {
      const snapshot = game.snapshot();
      if (snapshot.phase === "playing" || snapshot.phase === "sudden-death") {
        liveTicks += 1;
        const commands = driveBot(snapshot, seatId, competitorId, prng, memory);
        for (const command of commands) {
          if (command.type === "place-bomb") placedBomb = true;
          game.dispatch(command);
        }
      }
      const events = game.dispatch({ type: "advance", deltaMs: TICK_DURATION_MS });
      selfEliminations.push(...events.filter((event) =>
        event.type === "competitor-eliminated"
        && event.competitorId === competitorId
        && event.causes.some((cause) => cause.kind === "bomb" && cause.ownerId === competitorId)
      ));
      totalTicks += 1;
    }

    expect(liveTicks).toBe(targetLiveTicks);
    expect(placedBomb).toBe(true);
    expect(selfEliminations).toEqual([]);
  });

  it("completes a seeded bot-vs-bot match with a winner within 8,000 ticks", () => {
    const config = createLocalDuel1v1MatchConfig({
      seed: "bot-v-bot-complete",
      roundDurationMs: MIN_ROUND_DURATION_MS,
      targetRoundWins: 1,
    });
    const game = createGameMechanics(config);
    const drivers = config.seats.map((seat) => ({
      seat,
      prng: createBotPrng(`${config.seed}|${seat.seatId}`),
      memory: createBotMemory(),
    }));
    const maxTicks = 8_000;
    let ticks = 0;
    let rejectionCount = 0;

    while (game.snapshot().phase !== "match-over" && ticks < maxTicks) {
      const snapshot = game.snapshot();
      if (snapshot.phase === "playing" || snapshot.phase === "sudden-death") {
        for (const driver of drivers) {
          for (const command of driveBot(
            snapshot,
            driver.seat.seatId,
            driver.seat.competitorId,
            driver.prng,
            driver.memory,
          )) {
            game.dispatch(command);
          }
        }
      }
      game.dispatch({ type: "advance", deltaMs: TICK_DURATION_MS });
      rejectionCount += game.rejections().length;
      ticks += 1;
    }

    const final = game.snapshot();
    expect(ticks).toBeLessThan(maxTicks);
    expect(final.phase).toBe("match-over");
    expect(final.matchWinner).not.toBeNull();
    expect(rejectionCount).toBe(0);
  });

  it("agrees with the real arena generator on solid pillars", () => {
    const real = botCreateArenaTiles("bot-seed");
    // Classic 8-pillar set: 4 seeds + central mirrors (Decision 011).
    for (const pillar of [
      { x: 3, y: 3 },
      { x: 5, y: 3 },
      { x: 2, y: 4 },
      { x: 4, y: 2 },
      { x: 7, y: 5 },
      { x: 5, y: 5 },
      { x: 8, y: 4 },
      { x: 6, y: 6 },
    ]) {
      expect(real.solid.some((t) => t.x === pillar.x && t.y === pillar.y)).toBe(true);
    }
    expect(real.solid).toHaveLength(24);
    expect(BOT_UNITS_PER_TILE).toBeGreaterThan(0);
  });
});

// ── Part 1 acceptance: pressure survival + a complete bot-vs-bot match ────────
//
// These two suites are the load-bearing acceptance gates for the brawler bot.
// They run the real kernel end to end (no crafted per-tick shortcuts inside the
// loop) and assert the two properties a competitive bot must have: it survives
// the sudden-death pressure spiral right up to the mathematical limit, and two
// such bots drive a whole match to a decided match-over — with the authoritative
// kernel raising zero rejections for the commands the bot produces.

/**
 * Reachable rest-safe region from a tile, computed independently of the bot's
 * own heuristics. A tile is rest-safe when neither it nor any orthogonal
 * neighbour is solid (wall / pillar / already-closed), covered by a live bomb
 * blast cross, on fire, or the tile the pressure front is actively closing.
 * We BFS the open 4-neighbour component the body can actually walk and count
 * how many of its tiles are rest-safe. Zero ⇒ no mathematically safe tile
 * survives and death is unavoidable.
 */
function reachableRestSafeCount(
  snap: GameSnapshot,
  from: Readonly<{ x: number; y: number }>,
): number {
  const width = snap.arena.width;
  const height = snap.arena.height;
  const wrap = (x: number, y: number): string =>
    `${((x % width) + width) % width},${((y % height) + height) % height}`;
  const solid = new Set(snap.arena.solid.map((t) => `${t.x},${t.y}`));
  const danger = new Set<string>();
  for (const flame of snap.flames) danger.add(`${flame.tile.x},${flame.tile.y}`);
  for (const bomb of snap.bombs) {
    danger.add(`${bomb.tile.x},${bomb.tile.y}`);
    for (const dir of ["up", "down", "left", "right"] as const) {
      const delta = DIR_DELTA[dir]!;
      for (let step = 1; step <= bomb.flameRange; step += 1) {
        const tx = bomb.tile.x + delta.x * step;
        const ty = bomb.tile.y + delta.y * step;
        // Flames never wrap: the blast walk stops at the grid edge.
        if (tx < 0 || ty < 0 || tx >= width || ty >= height) break;
        const k = `${tx},${ty}`;
        if (solid.has(k)) break;
        danger.add(k);
      }
    }
  }
  if (snap.pressure.closing) {
    danger.add(`${snap.pressure.closing.tile.x},${snap.pressure.closing.tile.y}`);
  }
  const restSafe = (x: number, y: number): boolean => {
    if (solid.has(`${x},${y}`) || danger.has(`${x},${y}`)) return false;
    for (const dir of ["up", "down", "left", "right"] as const) {
      const delta = DIR_DELTA[dir]!;
      if (danger.has(wrap(x + delta.x, y + delta.y))) return false;
    }
    return true;
  };
  // Toroidal walkability (Decision 011): open border gaps re-enter on the
  // opposite edge; solid border tiles still block.
  const seen = new Set<string>([`${from.x},${from.y}`]);
  const queue: Array<{ x: number; y: number }> = [{ x: from.x, y: from.y }];
  let count = 0;
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (restSafe(current.x, current.y)) count += 1;
    for (const dir of ["up", "down", "left", "right"] as const) {
      const delta = DIR_DELTA[dir]!;
      const nx = ((current.x + delta.x) % width + width) % width;
      const ny = ((current.y + delta.y) % height + height) % height;
      const k = `${nx},${ny}`;
      if (seen.has(k) || solid.has(k)) continue;
      seen.add(k);
      queue.push({ x: nx, y: ny });
    }
  }
  return count;
}

/** Translate bot GameCommands into kernel envelopes for the given seat/tick. */
function botEnvelopes(
  commands: readonly GameCommand[],
  seatId: SeatId,
  tick: number,
  startSequence: number,
): Array<{ tick: number; sequence: number; seatId: SeatId; command: unknown }> {
  return commands.map((command, index) => {
    const kernelCommand =
      command.type === "set-movement"
        ? { type: "set-movement" as const, direction: command.direction, pressed: command.pressed }
        : command.type === "place-bomb"
          ? { type: "place-bomb" as const }
          : command; // advance/toggle/restart never come from a bot
    return {
      tick,
      sequence: startSequence + index,
      seatId,
      command: kernelCommand,
    };
  });
}

describe("bot acceptance — sudden-death pressure survival (no live opponent)", () => {
  // Bounded assertion (task form b): with only the bot acting, it stays alive on
  // every sudden-death tick for as long as a reachable rest-safe tile provably
  // exists, and only ever dies once that region is mathematically empty. The
  // inert opponent is parked at the arena centre — the last cell the spiral
  // closes — purely to keep the round in sudden-death; it issues no commands, so
  // there is no live opponent influencing the bot.
  it("survives until no reachable rest-safe tile remains, then no earlier", () => {
    const program = createDefaultMechanicsProgram();
    const config = createLocalDuel1v1MatchConfig({
      seed: "pressure-survival",
      roundDurationMs: 5_000,
      targetRoundWins: 9,
    });
    const botCompetitorId = config.seats[1]!.competitorId;
    const botSeatId = config.seats[1]!.seatId;
    const foeCompetitorId = config.seats[0]!.competitorId;
    const base = program.initial(config);

    // Enter sudden-death directly with the bot in an outer corner and the inert
    // foe on the arena centre (5,4) — the final tile the spiral closes.
    let state = asSuddenDeathWorld(program, base, 0, {
      locomotion: {
        entries: [
          {
            competitorId: foeCompetitorId,
            position: tileCenter({ x: 5, y: 4 }),
            velocity: { x: 0, y: 0 },
            lastDirection: null,
          },
          {
            competitorId: botCompetitorId,
            position: tileCenter({ x: 1, y: 1 }),
            velocity: { x: 0, y: 0 },
            lastDirection: null,
          },
        ],
      },
    });
    expect(state.slices.match.phase).toBe("sudden-death");

    const prng = createBotPrng("pressure-survival");
    const memory = createBotMemory();
    let sequence = 0;

    let sdTicksObserved = 0;
    let safeWhenAliveTicks = 0;
    let botAlive = true;
    let deathSafeCount = -1;
    const rejectionReasons = new Set<string>();
    const MAX_SD_TICKS = 2_000; // 40s ceiling; the 75-tile spiral closes in ~67s.

    for (let tick = 0; tick < MAX_SD_TICKS; tick += 1) {
      if (state.slices.match.phase !== "sudden-death") break;
      const snap = program.snapshot(state);
      const bot = snap.competitors.find((c) => c.id === botCompetitorId)!;
      if (!bot.alive) {
        botAlive = false;
        deathSafeCount = reachableRestSafeCount(snap, tileOf(bot.position));
        break;
      }

      sdTicksObserved += 1;
      const safeBefore = reachableRestSafeCount(snap, tileOf(bot.position));
      if (safeBefore > 0) safeWhenAliveTicks += 1;

      const commands = driveBot(snap, botSeatId, botCompetitorId, prng, memory);
      const envelopes = botEnvelopes(commands, botSeatId, state.tick, sequence);
      sequence += commands.length;

      const result = program.step(state, { commands: envelopes as never });
      for (const rejection of result.rejections) rejectionReasons.add(rejection.reason);
      state = result.state;
    }

    // The scenario really did exercise the pressure spiral for a long stretch.
    expect(sdTicksObserved).toBeGreaterThanOrEqual(1_500); // >= 30s of pressure
    // Every command the bot produced in these modeled-legal situations was
    // accepted by the authoritative kernel — zero rejections.
    expect([...rejectionReasons]).toEqual([]);
    // Invariant: the bot was alive on every tick where a safe tile still
    // existed — it never died early. safeWhenAliveTicks counts exactly those
    // survived ticks, so it equals the ticks the safe region was non-empty.
    expect(safeWhenAliveTicks).toBe(sdTicksObserved);
    // If the bot ever died, it was only after the safe region emptied.
    if (!botAlive) {
      expect(deathSafeCount).toBe(0);
    }
  });
});

describe("bot acceptance — a complete bot-vs-bot match reaches match-over", () => {
  // Two brawler bots drive a full first-to-2 match through the real facade until
  // a decided match-over, under an explicit tick bound. The authoritative kernel
  // must reject none of the commands either bot produces in these legal states.
  it("drives P1 and P2 to a decided winner with zero rejections under an N-tick bound", () => {
    const config = createLocalDuel1v1MatchConfig({
      seed: "bot-vs-bot-match",
      roundDurationMs: 5_000,
      targetRoundWins: 2,
    });
    const game = createGameMechanics(config);

    const seat0 = config.seats[0]!.seatId;
    const competitor0 = config.seats[0]!.competitorId;
    const seat1 = config.seats[1]!.seatId;
    const competitor1 = config.seats[1]!.competitorId;

    const prng0 = createBotPrng(`${config.seed}|p0`);
    const prng1 = createBotPrng(`${config.seed}|p1`);
    const memory0 = createBotMemory();
    const memory1 = createBotMemory();

    game.dispatch({ type: "advance", deltaMs: ROUND_START_MS });

    const TICK_BOUND = 5_000; // 100s ceiling — the match resolves well inside it.
    let matchOverTick = -1;
    let totalRejections = 0;

    for (let tick = 0; tick < TICK_BOUND; tick += 1) {
      const snap = game.snapshot();
      if (snap.phase === "match-over") {
        matchOverTick = tick;
        break;
      }
      if (snap.phase === "playing" || snap.phase === "sudden-death") {
        for (const command of driveBot(snap, seat0, competitor0, prng0, memory0)) {
          game.dispatch(command);
        }
        for (const command of driveBot(snap, seat1, competitor1, prng1, memory1)) {
          game.dispatch(command);
        }
      }
      game.dispatch({ type: "advance", deltaMs: TICK_DURATION_MS });
      totalRejections += game.rejections().length;
    }

    const final = game.snapshot();
    expect(matchOverTick).toBeGreaterThanOrEqual(0); // reached match-over in bound
    expect(matchOverTick).toBeLessThan(TICK_BOUND);
    expect(final.phase).toBe("match-over");
    // A real, decided winner — one competitor, reached the target wins.
    expect(final.matchWinner).not.toBeNull();
    const winnerScore = final.scores.find((s) => s.competitorId === final.matchWinner)!;
    expect(winnerScore.wins).toBe(config.targetRoundWins);
    // Authoritative kernel accepted every bot command across the whole match.
    expect(totalRejections).toBe(0);

    // Determinism: the same seed replays the same match to the same tick/winner.
    const replayGame = createGameMechanics(config);
    const rprng0 = createBotPrng(`${config.seed}|p0`);
    const rprng1 = createBotPrng(`${config.seed}|p1`);
    const rmem0 = createBotMemory();
    const rmem1 = createBotMemory();
    replayGame.dispatch({ type: "advance", deltaMs: ROUND_START_MS });
    let replayOverTick = -1;
    for (let tick = 0; tick < TICK_BOUND; tick += 1) {
      const snap = replayGame.snapshot();
      if (snap.phase === "match-over") {
        replayOverTick = tick;
        break;
      }
      if (snap.phase === "playing" || snap.phase === "sudden-death") {
        for (const command of driveBot(snap, seat0, competitor0, rprng0, rmem0)) {
          replayGame.dispatch(command);
        }
        for (const command of driveBot(snap, seat1, competitor1, rprng1, rmem1)) {
          replayGame.dispatch(command);
        }
      }
      replayGame.dispatch({ type: "advance", deltaMs: TICK_DURATION_MS });
    }
    expect(replayOverTick).toBe(matchOverTick);
    expect(replayGame.snapshot().matchWinner).toBe(final.matchWinner);
  });
});

// Slice 4A focused suite (Decision 009) — co-located for `test:mechanics` filter.
import "./slice-4a-powerups.test.ts";
import "./browser-visual-adapter.test.ts";
