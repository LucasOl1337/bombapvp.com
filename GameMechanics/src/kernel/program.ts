import {
  GAME_MECHANICS_VERSION,
  type BombSnapshot,
  type CompetitorSnapshot,
  type FlameSnapshot,
  type GameEvent,
  type GameSnapshot,
  type MatchConfig,
} from "../contracts.ts";
import { cloneMatchConfig, createMatchConfig } from "../match-config.ts";
import {
  assertValidStepInput,
  sortEnvelopes,
  type CommandRejection,
  type ResolvedCommand,
  type StepInput,
} from "./commands.ts";
import type { TickFact } from "./facts.ts";
import {
  assertSystemWrites,
  compileMechanics,
  createSystemRunContext,
  PHASE_ORDER,
  SLICE_IDS,
  type CompiledMechanics,
  type CompiledSystem,
  type ModuleSpec,
  type PhaseId,
  type SliceId,
} from "./protocol.ts";
import {
  cloneOutcome,
  cloneScores,
  countActiveBombs,
  deepFreeze,
  freezePosition,
  buildPressurePath,
  derivePressureClosing,
  effectiveSolidTiles,
  freezeTile,
  freezeVelocity,
  tileOf,
  TICK_DURATION_MS,
  WORLD_FORMAT_VERSION,
  type WorldSlices,
  type WorldState,
} from "./world-state.ts";

export type StepResult = Readonly<{
  state: WorldState;
  events: readonly GameEvent[];
  rejections: readonly CommandRejection[];
}>;

export interface MechanicsProgram {
  readonly mechanicsRevision: string;
  readonly tickDurationMs: typeof TICK_DURATION_MS;
  readonly compiled: CompiledMechanics;
  initial(config: MatchConfig): WorldState;
  step(state: WorldState, input: StepInput): StepResult;
  snapshot(state: WorldState): GameSnapshot;
  /**
   * Validate and freeze an unknown JSON payload into a steppable WorldState.
   * Kernel validates root only; vertical codecs own slice shapes/invariants.
   */
  restore(raw: unknown): WorldState;
}

function projectSnapshot(state: WorldState, revision: number): GameSnapshot {
  const competitors: readonly CompetitorSnapshot[] = Object.freeze(
    state.slices.roster.entries.map((roster) => {
      const loco = state.slices.locomotion.entries.find(
        (entry) => entry.competitorId === roster.competitorId,
      );
      const vitals = state.slices.vitals.entries.find(
        (entry) => entry.competitorId === roster.competitorId,
      );
      const progression = state.slices.progression.entries.find(
        (entry) => entry.competitorId === roster.competitorId,
      );
      if (!loco || !vitals || !progression) {
        throw new Error(`Missing projected state for ${roster.competitorId}`);
      }
      const skill = state.slices.skills.entries.find(
        (entry) => entry.competitorId === roster.competitorId,
      );
      return Object.freeze({
        id: roster.competitorId,
        seatId: roster.seatId,
        position: freezePosition(loco.position),
        velocity: freezeVelocity(loco.velocity),
        tile: freezeTile(tileOf(loco.position)),
        alive: vitals.alive,
        spawnProtectionRemainingMs: vitals.spawnProtectionRemainingMs,
        activeBombs: countActiveBombs(state.slices.bombs, roster.competitorId),
        maxBombs: progression.maxBombs,
        flameRange: progression.flameRange,
        ...(skill
          ? {
              skill: Object.freeze({
                id: skill.skillId,
                phase: skill.phase,
                cooldownRemainingMs: skill.cooldownRemainingMs,
                channelRemainingMs: skill.channelRemainingMs,
                projection: skill.projection ? freezePosition(skill.projection) : null,
                aimDirection: skill.aimDirection,
              }),
            }
          : {}),
      });
    }),
  );

  const bombs: readonly BombSnapshot[] = Object.freeze(
    [...state.slices.bombs.items]
      .sort((left, right) => left.id - right.id)
      .map((bomb) =>
        Object.freeze({
          id: bomb.id,
          ownerId: bomb.ownerId,
          tile: freezeTile(bomb.tile),
          fuseMs: bomb.fuseMs,
          flameRange: bomb.flameRange,
        }),
      ),
  );

  const flames: readonly FlameSnapshot[] = Object.freeze(
    state.slices.flames.items.map((flame) => {
      const primaryOwner = flame.causes[0]?.ownerId;
      if (!primaryOwner) {
        throw new Error(`Flame at ${flame.tile.x},${flame.tile.y} has no causes.`);
      }
      return Object.freeze({
        tile: freezeTile(flame.tile),
        remainingMs: Math.max(0, flame.remainingMs),
        ownerId: primaryOwner,
        causes: Object.freeze(
          flame.causes.map((cause) =>
            Object.freeze({ bombId: cause.bombId, ownerId: cause.ownerId }),
          ),
        ),
      });
    }),
  );

  const match = state.slices.match;
  const pressure = state.slices.pressure;
  const derivedPath = buildPressurePath(
    state.slices.arena.width,
    state.slices.arena.height,
    state.slices.arena.solid,
  );
  const derivedClosing = derivePressureClosing(derivedPath, match);
  // Adapter display: show phase countdown during round-start/round-over.
  const displayRemaining =
    match.phase === "round-start" || match.phase === "round-over"
      ? match.phaseRemainingMs
      : match.roundRemainingMs;

  return Object.freeze({
    version: GAME_MECHANICS_VERSION,
    revision,
    config: cloneMatchConfig(state.config),
    phase: match.phase,
    roundNumber: match.roundNumber,
    phaseRemainingMs: match.phaseRemainingMs,
    roundElapsedMs: match.roundElapsedMs,
    roundRemainingMs: match.roundRemainingMs,
    suddenDeathElapsedMs: match.suddenDeathElapsedMs,
    scores: cloneScores(match.scores),
    targetRoundWins: state.config.targetRoundWins,
    matchWinner: match.matchWinner,
    // Deprecated aliases for older browser/tests — prefer explicit clocks.
    elapsedMs: match.roundElapsedMs,
    remainingMs: displayRemaining,
    arena: Object.freeze({
      width: state.slices.arena.width,
      height: state.slices.arena.height,
      // Effective solid (base + pressure closed) for adapters; owners stay separate.
      solid: effectiveSolidTiles(state.slices.arena, pressure),
      crates: state.slices.arena.crates,
    }),
    // closedTiles already projected into arena.solid — do not re-expose.
    pressure: Object.freeze({
      closing: derivedClosing
        ? Object.freeze({
            index: derivedClosing.index,
            tile: freezeTile(derivedClosing.tile),
            remainingMs: derivedClosing.remainingMs,
          })
        : null,
      pathLength: derivedPath.length,
    }),
    competitors,
    bombs,
    flames,
    powerUps: Object.freeze(
      state.slices.pickups.items.map((item) =>
        Object.freeze({
          tile: freezeTile(item.tile),
          type: item.type,
        }),
      ),
    ),
    outcome: match.roundOutcome ? cloneOutcome(match.roundOutcome) : null,
  });
}

type AcceptedBundle = Readonly<{
  commands: readonly ResolvedCommand[];
  rejections: CommandRejection[];
}>;

/**
 * Validate envelopes once in the kernel. Structural issues throw.
 * Tick/seat/sequence issues become rejections; accepted become ResolvedCommand.
 */
function acceptEnvelopes(state: WorldState, input: StepInput): AcceptedBundle {
  assertValidStepInput(input);
  const rejections: CommandRejection[] = [];
  const seatMap = new Map(
    state.config.seats.map((seat) => [seat.seatId, seat.competitorId] as const),
  );
  const accepted: ResolvedCommand[] = [];
  const seenSequences = new Set<string>();

  for (const envelope of sortEnvelopes(input.commands)) {
    if (envelope.tick !== state.tick) {
      rejections.push(
        Object.freeze({
          sequence: envelope.sequence,
          seatId: envelope.seatId,
          reason: "tick-mismatch" as const,
        }),
      );
      continue;
    }
    const seqKey = `${envelope.sequence}|${envelope.seatId}`;
    if (seenSequences.has(seqKey)) {
      rejections.push(
        Object.freeze({
          sequence: envelope.sequence,
          seatId: envelope.seatId,
          reason: "duplicate-sequence" as const,
        }),
      );
      continue;
    }
    seenSequences.add(seqKey);
    const competitorId = seatMap.get(envelope.seatId);
    if (!competitorId) {
      rejections.push(
        Object.freeze({
          sequence: envelope.sequence,
          seatId: envelope.seatId,
          reason: "unknown-seat" as const,
        }),
      );
      continue;
    }
    accepted.push(Object.freeze({ envelope, competitorId }));
  }

  return { commands: Object.freeze(accepted), rejections };
}

function groupSystemsByPhase(
  systems: readonly CompiledSystem[],
): ReadonlyMap<PhaseId, readonly CompiledSystem[]> {
  const map = new Map<PhaseId, CompiledSystem[]>();
  for (const phase of PHASE_ORDER) {
    map.set(phase, []);
  }
  for (const system of systems) {
    map.get(system.phase)!.push(system);
  }
  return map;
}

/**
 * Pure generic scheduler: iterates compiled systems only.
 * Does not import any concrete module or know gameplay ids.
 * Same-phase systems share one phase pre-state; facts visible only later;
 * events ordered by phase/module/system/local; failures do not return partial state.
 */
function stepWorld(
  state: WorldState,
  input: StepInput,
  compiled: CompiledMechanics,
): StepResult {
  const { commands, rejections } = acceptEnvelopes(state, input);

  let current = state;
  const allEvents: GameEvent[] = [];
  const allRejections: CommandRejection[] = [...rejections];
  let priorFacts: readonly TickFact[] = Object.freeze([]);
  let wrote = false;

  const byPhase = groupSystemsByPhase(compiled.systems);

  for (const phase of PHASE_ORDER) {
    const systems = byPhase.get(phase) ?? [];
    if (systems.length === 0) continue;

    const phasePreState = current;
    const phaseWrites: Partial<WorldSlices> = {};
    const phaseFacts: TickFact[] = [];

    for (const system of systems) {
      const result = system.run(
        createSystemRunContext(phasePreState, system, commands, priorFacts),
      );
      assertSystemWrites(system, result.writes);

      if (result.writes) {
        for (const key of Object.keys(result.writes) as (keyof WorldSlices)[]) {
          const value = result.writes[key];
          if (value !== undefined) {
            (phaseWrites as Record<string, unknown>)[key] = value;
          }
        }
      }
      if (result.events) {
        allEvents.push(...result.events);
      }
      if (result.facts) {
        phaseFacts.push(...result.facts);
      }
      if (result.rejections) {
        allRejections.push(...result.rejections);
      }
    }

    if (Object.keys(phaseWrites).length > 0) {
      wrote = true;
      current = Object.freeze({
        ...current,
        slices: Object.freeze({
          ...current.slices,
          ...phaseWrites,
        }),
      });
    }

    if (phaseFacts.length > 0) {
      priorFacts = Object.freeze([...priorFacts, ...phaseFacts]);
    }
  }

  const next = Object.freeze({
    ...current,
    tick: state.tick + 1,
    stateRevision: wrote ? state.stateRevision + 1 : state.stateRevision,
  });

  return Object.freeze({
    state: next,
    events: Object.freeze(allEvents),
    rejections: Object.freeze(allRejections),
  });
}

function assertExactSliceKeys(slicesRaw: Record<string, unknown>): void {
  for (const key of SLICE_IDS) {
    if (!(key in slicesRaw)) {
      throw new Error(`WorldState.slices missing required key "${key}".`);
    }
  }
  for (const key of Object.keys(slicesRaw)) {
    if (!SLICE_IDS.includes(key as SliceId)) {
      throw new Error(`WorldState.slices has unknown key "${key}".`);
    }
  }
}

function assertOwnedOnly(
  moduleId: string,
  owns: readonly SliceId[],
  partial: Readonly<Partial<WorldSlices>>,
): void {
  for (const key of Object.keys(partial) as SliceId[]) {
    if (!owns.includes(key)) {
      throw new Error(
        `Module ${moduleId} codec returned non-owned slice "${key}".`,
      );
    }
  }
  for (const key of owns) {
    if (!(key in partial) || partial[key] === undefined) {
      throw new Error(
        `Module ${moduleId} codec did not produce owned slice "${key}".`,
      );
    }
  }
}

/**
 * Root-only validation + vertical codec aggregation.
 * Order of modules never affects the assembled world.
 */
function assembleFromCodecs(
  compiled: CompiledMechanics,
  config: MatchConfig,
  mode: "initial" | "restore",
  rawSlices: Record<string, unknown> | null,
  tick: number,
  stateRevision: number,
): WorldState {
  const partial: Partial<WorldSlices> = {};

  // Deterministic module order (id) so aggregation is order-independent.
  for (const module of compiled.modules) {
    const produced =
      mode === "initial"
        ? module.codecs.initial(config)
        : module.codecs.restore(
            Object.fromEntries(
              module.owns.map((slice) => [slice, rawSlices![slice]] as const),
            ) as Readonly<Partial<Record<SliceId, unknown>>>,
            config,
          );
    assertOwnedOnly(module.id, module.owns, produced);
    for (const key of module.owns) {
      (partial as Record<string, unknown>)[key] = produced[key];
    }
  }

  for (const slice of SLICE_IDS) {
    if (partial[slice] === undefined) {
      throw new Error(`Assembled world missing slice "${slice}".`);
    }
  }

  const slices = deepFreeze(partial as WorldSlices);

  return deepFreeze({
    formatVersion: WORLD_FORMAT_VERSION,
    mechanicsRevision: compiled.mechanicsRevision,
    tick,
    stateRevision,
    config: cloneMatchConfig(config),
    slices,
  } satisfies WorldState);
}

function restoreWithCodecs(raw: unknown, compiled: CompiledMechanics): WorldState {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("WorldState restore requires a plain JSON object.");
  }
  const candidate = raw as Record<string, unknown>;

  if (candidate.formatVersion !== WORLD_FORMAT_VERSION) {
    throw new Error(
      `WorldState.formatVersion "${String(candidate.formatVersion)}" is incompatible (expected "${WORLD_FORMAT_VERSION}").`,
    );
  }
  if (typeof candidate.mechanicsRevision !== "string") {
    throw new Error("WorldState.mechanicsRevision must be a string.");
  }
  if (candidate.mechanicsRevision !== compiled.mechanicsRevision) {
    throw new Error(
      `WorldState.mechanicsRevision "${candidate.mechanicsRevision}" is not executable (expected "${compiled.mechanicsRevision}").`,
    );
  }

  if (typeof candidate.tick !== "number" || !Number.isInteger(candidate.tick) || candidate.tick < 0) {
    throw new Error("WorldState.tick must be an integer >= 0.");
  }
  if (
    typeof candidate.stateRevision !== "number"
    || !Number.isInteger(candidate.stateRevision)
    || candidate.stateRevision < 0
  ) {
    throw new Error("WorldState.stateRevision must be an integer >= 0.");
  }

  if (!candidate.config || typeof candidate.config !== "object" || Array.isArray(candidate.config)) {
    throw new Error("WorldState.config is required.");
  }
  const rawConfig = candidate.config as MatchConfig & Record<string, unknown>;
  // Restore must not inject factory defaults for unknown worlds: targetRoundWins
  // is required on the payload (builder/factory may still default for initial()).
  if (
    !("targetRoundWins" in rawConfig)
    || rawConfig.targetRoundWins === undefined
    || rawConfig.targetRoundWins === null
  ) {
    throw new Error(
      "WorldState.config.targetRoundWins is required (restore does not inject defaults).",
    );
  }
  const config = createMatchConfig({
    seed: rawConfig.seed,
    mechanicsRevision: rawConfig.mechanicsRevision,
    contentRevision: rawConfig.contentRevision,
    roundDurationMs: rawConfig.roundDurationMs,
    targetRoundWins: rawConfig.targetRoundWins as number,
    seats: rawConfig.seats.map((seat) => ({
      seatId: seat.seatId,
      competitorId: seat.competitorId,
      ...(seat.skillId === undefined ? {} : { skillId: seat.skillId }),
    })),
  });
  if (config.mechanicsRevision !== compiled.mechanicsRevision) {
    throw new Error(
      `MatchConfig.mechanicsRevision "${config.mechanicsRevision}" is not executable (expected "${compiled.mechanicsRevision}").`,
    );
  }

  if (!candidate.slices || typeof candidate.slices !== "object" || Array.isArray(candidate.slices)) {
    throw new Error("WorldState.slices is required.");
  }
  const slicesRaw = candidate.slices as Record<string, unknown>;
  assertExactSliceKeys(slicesRaw);

  return assembleFromCodecs(
    compiled,
    config,
    "restore",
    slicesRaw,
    candidate.tick,
    candidate.stateRevision,
  );
}

/**
 * Build a pure MechanicsProgram from compiled modules.
 * Composition roots pass concrete modules; this kernel stays free of gameplay imports.
 * mechanicsRevision is the manual rules identifier from compileMechanics.
 */
export function createMechanicsProgram(modules: readonly ModuleSpec[]): MechanicsProgram {
  const compiled = compileMechanics(modules);
  const mechanicsRevision = compiled.mechanicsRevision;

  function initial(config: MatchConfig): WorldState {
    if (config.mechanicsRevision !== mechanicsRevision) {
      throw new Error(
        `MatchConfig.mechanicsRevision "${config.mechanicsRevision}" is not executable by this implementation (expected "${mechanicsRevision}").`,
      );
    }
    return assembleFromCodecs(compiled, config, "initial", null, 0, 0);
  }

  function restore(raw: unknown): WorldState {
    return restoreWithCodecs(raw, compiled);
  }

  return Object.freeze({
    mechanicsRevision,
    tickDurationMs: TICK_DURATION_MS,
    compiled,
    initial,
    step(state: WorldState, input: StepInput): StepResult {
      return stepWorld(state, input, compiled);
    },
    snapshot(state: WorldState): GameSnapshot {
      return projectSnapshot(state, state.stateRevision);
    },
    restore,
  });
}

export { TICK_DURATION_MS };
