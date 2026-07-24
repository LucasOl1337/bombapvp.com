import type { MatchConfig } from "../contracts.ts";
import type { GameEvent } from "../contracts.ts";
import type { CommandRejection, ResolvedCommand } from "./commands.ts";
import type { TickFact } from "./facts.ts";
import type { WorldSlices, WorldState } from "./world-state.ts";

/** Manual rules identifier. Bump only when executable gameplay rules change. */
export const MECHANICS_REVISION = "mechanics-v8" as const;

/** Explicit barriers in the deterministic 20 ms schedule. */
export const PHASE_ORDER = [
  "cycle",
  "round-reset",
  "command",
  "timer",
  "protection",
  "pressure",
  "pressure-impact",
  "intent",
  "skill",
  "locomotion",
  "bombs",
  "explosion",
  "damage",
  "pickup",
  "round",
] as const;

export type PhaseId = (typeof PHASE_ORDER)[number];

export const SLICE_IDS = [
  "match",
  "arena",
  "roster",
  "vitals",
  "intent",
  "locomotion",
  "bombs",
  "flames",
  "pressure",
  "pickups",
  "progression",
  "skills",
] as const;

export type SliceId = (typeof SLICE_IDS)[number];

export type SystemRunContext = Readonly<{
  tick: number;
  stateRevision: number;
  formatVersion: string;
  mechanicsRevision: string;
  config: MatchConfig;
  commands: readonly ResolvedCommand[];
  facts: readonly TickFact[];
  read: <S extends SliceId>(sliceId: S) => WorldSlices[S];
}>;

export type SystemRunResult = Readonly<{
  writes?: Readonly<Partial<WorldSlices>>;
  events?: readonly GameEvent[];
  facts?: readonly TickFact[];
  rejections?: readonly CommandRejection[];
}>;

export type SystemSpec = Readonly<{
  id: string;
  phase: PhaseId;
  reads: readonly SliceId[];
  writes: readonly SliceId[];
  run: (ctx: SystemRunContext) => SystemRunResult;
}>;

export type ModuleCodecs = Readonly<{
  initial(config: MatchConfig): Readonly<Partial<WorldSlices>>;
  restore(
    rawOwned: Readonly<Partial<Record<SliceId, unknown>>>,
    config: MatchConfig,
  ): Readonly<Partial<WorldSlices>>;
}>;

export type ModuleSpec = Readonly<{
  id: string;
  /** Informational only; it does not participate in runtime identity. */
  version?: string | undefined;
  owns: readonly SliceId[];
  systems: readonly SystemSpec[];
  codecs: ModuleCodecs;
}>;

export type CompiledSystem = Readonly<{
  id: string;
  moduleId: string;
  phase: PhaseId;
  reads: readonly SliceId[];
  writes: readonly SliceId[];
  run: SystemSpec["run"];
}>;

export type CompiledModule = Readonly<{
  id: string;
  owns: readonly SliceId[];
  codecs: ModuleCodecs;
  systems: readonly SystemSpec[];
}>;

export type CompiledMechanics = Readonly<{
  mechanicsRevision: typeof MECHANICS_REVISION;
  modules: readonly CompiledModule[];
  systems: readonly CompiledSystem[];
  ownerBySlice: Readonly<Record<SliceId, string>>;
}>;

export class MechanicsCompileError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "MechanicsCompileError";
    this.code = code;
  }
}

function assertUniqueIds(kind: string, ids: readonly string[]): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) {
      throw new MechanicsCompileError("duplicate-id", `Duplicate ${kind} id: ${id}`);
    }
    seen.add(id);
  }
}

function requireCanonicalId(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0 || value !== value.trim()) {
    throw new MechanicsCompileError("invalid-id", `${label} must be a canonical non-empty string.`);
  }
  return value;
}

/** Link modules into an order-independent deterministic schedule. */
export function compileMechanics(modules: readonly ModuleSpec[]): CompiledMechanics {
  assertUniqueIds("module", modules.map((module) => module.id));

  const allSystemIds: string[] = [];
  const ownerBySlice = {} as Record<SliceId, string>;
  const ownedSlices = new Set<SliceId>();

  for (const module of modules) {
    const moduleId = requireCanonicalId(module.id, "Module id");
    if (!module.codecs || typeof module.codecs !== "object") {
      throw new MechanicsCompileError("invalid-module", `Module ${moduleId} must carry vertical codecs.`);
    }
    if (typeof module.codecs.initial !== "function" || typeof module.codecs.restore !== "function") {
      throw new MechanicsCompileError("invalid-module", `Module ${moduleId} codecs must provide initial and restore.`);
    }

    for (const slice of module.owns) {
      if (!SLICE_IDS.includes(slice)) {
        throw new MechanicsCompileError("unknown-slice", `Module ${moduleId} owns unknown slice: ${slice}`);
      }
      if (ownedSlices.has(slice)) {
        throw new MechanicsCompileError(
          "duplicate-owner",
          `Slice "${slice}" owned by both ${ownerBySlice[slice]} and ${moduleId}`,
        );
      }
      ownedSlices.add(slice);
      ownerBySlice[slice] = moduleId;
    }

    for (const system of module.systems) {
      const systemId = requireCanonicalId(system.id, "System id");
      if (typeof system.run !== "function") {
        throw new MechanicsCompileError("invalid-system", `System ${systemId} must carry a concrete run function.`);
      }
      allSystemIds.push(systemId);
      if (!PHASE_ORDER.includes(system.phase)) {
        throw new MechanicsCompileError("unknown-phase", `System ${system.id} uses unknown phase: ${system.phase}`);
      }
      for (const slice of system.writes) {
        if (!module.owns.includes(slice)) {
          throw new MechanicsCompileError(
            "invalid-write",
            `System ${system.id} writes slice "${slice}" not owned by module ${module.id}`,
          );
        }
      }
      for (const slice of [...system.reads, ...system.writes]) {
        if (!SLICE_IDS.includes(slice)) {
          throw new MechanicsCompileError("unknown-slice", `System ${system.id} references unknown slice: ${slice}`);
        }
      }
    }
  }

  assertUniqueIds("system", allSystemIds);
  for (const slice of SLICE_IDS) {
    if (!ownedSlices.has(slice)) {
      throw new MechanicsCompileError("missing-owner", `Slice "${slice}" has no owning module.`);
    }
  }

  const writerKey = new Map<string, string>();
  for (const module of modules) {
    for (const system of module.systems) {
      for (const slice of system.writes) {
        const key = `${system.phase}|${slice}`;
        const previous = writerKey.get(key);
        if (previous) {
          throw new MechanicsCompileError(
            "writer-overlap",
            `Slice "${slice}" written by both ${previous} and ${system.id} in phase ${system.phase}`,
          );
        }
        writerKey.set(key, system.id);
      }
    }
  }

  const systems: CompiledSystem[] = modules.flatMap((module) =>
    module.systems.map((system) =>
      Object.freeze({
        id: system.id,
        moduleId: module.id,
        phase: system.phase,
        reads: Object.freeze([...system.reads]),
        writes: Object.freeze([...system.writes]),
        run: system.run,
      }),
    ),
  );
  systems.sort((left, right) => {
    const phaseDelta = PHASE_ORDER.indexOf(left.phase) - PHASE_ORDER.indexOf(right.phase);
    if (phaseDelta !== 0) return phaseDelta;
    if (left.moduleId !== right.moduleId) return left.moduleId < right.moduleId ? -1 : 1;
    return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
  });

  const compiledModules: CompiledModule[] = modules
    .map((module) =>
      Object.freeze({
        id: module.id,
        owns: Object.freeze([...module.owns]) as readonly SliceId[],
        codecs: module.codecs,
        systems: Object.freeze([...module.systems]),
      }),
    )
    .sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));

  return Object.freeze({
    mechanicsRevision: MECHANICS_REVISION,
    modules: Object.freeze(compiledModules),
    systems: Object.freeze(systems),
    ownerBySlice: Object.freeze({ ...ownerBySlice }) as Readonly<Record<SliceId, string>>,
  });
}

export function assertSystemWrites(
  system: CompiledSystem,
  writes: Readonly<Partial<WorldSlices>> | undefined,
): void {
  if (!writes) return;
  for (const key of Object.keys(writes) as SliceId[]) {
    if (!system.writes.includes(key)) {
      throw new Error(`System ${system.id} produced undeclared write for slice "${key}".`);
    }
  }
}

export function createSliceReader(
  slices: WorldSlices,
  allowed: readonly SliceId[],
  label: string,
): <S extends SliceId>(sliceId: S) => WorldSlices[S] {
  const allow = new Set(allowed);
  return <S extends SliceId>(sliceId: S): WorldSlices[S] => {
    if (!allow.has(sliceId)) {
      throw new Error(`${label} attempted undeclared read of slice "${sliceId}".`);
    }
    return slices[sliceId];
  };
}

export function createSystemRunContext(
  state: WorldState,
  system: CompiledSystem,
  commands: readonly ResolvedCommand[],
  facts: readonly TickFact[],
): SystemRunContext {
  return Object.freeze({
    tick: state.tick,
    stateRevision: state.stateRevision,
    formatVersion: state.formatVersion,
    mechanicsRevision: state.mechanicsRevision,
    config: state.config,
    commands,
    facts,
    read: createSliceReader(state.slices, system.reads, `System ${system.id}`),
  });
}
