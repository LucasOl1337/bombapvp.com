import type {
  GameCommand,
  GameEvent,
  GameMechanics,
  GameSnapshot,
  MatchConfig,
  SeatId,
} from "./contracts.ts";
import { getDefaultMechanicsProgram } from "./composition.ts";
import type { CommandEnvelope, CommandRejection, KernelCommand } from "./kernel/commands.ts";
import type { MechanicsProgram } from "./kernel/program.ts";
import type { WorldState } from "./kernel/world-state.ts";
import { TICK_DURATION_MS } from "./kernel/program.ts";
import {
  cloneMatchConfig,
  createMatchConfig,
  DEFAULT_MECHANICS_REVISION,
} from "./match-config.ts";

/** Max wall-clock advance accepted by the browser facade in one dispatch. */
export const MAX_ADVANCE_MS = 10_000;

type QueuedCommand = Readonly<{
  seatId: SeatId;
  command: KernelCommand;
  sequence: number;
}>;

export type CreateGameMechanicsOptions = Readonly<{
  /**
   * Internal/test seam: inject a program without inventing a second rule path.
   * Production callers omit this and use the default compiled program.
   */
  program?: MechanicsProgram;
}>;

function seatIdForCompetitor(config: MatchConfig, competitorId: string): SeatId | undefined {
  return config.seats.find((seat) => seat.competitorId === competitorId)?.seatId;
}

function projectFacadeSnapshot(
  world: WorldState,
  paused: boolean,
  program: MechanicsProgram,
): GameSnapshot {
  const base = program.snapshot(world);
  // Pause is adapter-only; may overlay active competitive presentation phases.
  if (
    paused
    && (base.phase === "playing"
      || base.phase === "sudden-death"
      || base.phase === "round-start")
  ) {
    return Object.freeze({ ...base, phase: "paused" as const });
  }
  return base;
}

/**
 * Browser facade over the canonical {@link WorldState}.
 * Pause, incomplete tick remainder, sequence counters and command queue are
 * adapter state; gameplay remains in the deterministic kernel.
 */
export function createGameMechanics(
  config: MatchConfig,
  options: CreateGameMechanicsOptions = {},
): GameMechanics {
  const frozenConfig = createMatchConfig({
    seed: config.seed,
    mechanicsRevision: config.mechanicsRevision,
    contentRevision: config.contentRevision,
    roundDurationMs: config.roundDurationMs,
    targetRoundWins: config.targetRoundWins,
    seats: config.seats.map((seat) => ({
      seatId: seat.seatId,
      competitorId: seat.competitorId,
      ...(seat.skillId === undefined ? {} : { skillId: seat.skillId }),
    })),
  });

  const program = options.program ?? getDefaultMechanicsProgram();

  if (frozenConfig.mechanicsRevision !== program.mechanicsRevision) {
    throw new Error(
      `MatchConfig.mechanicsRevision "${frozenConfig.mechanicsRevision}" is not executable by this implementation (expected "${program.mechanicsRevision}").`,
    );
  }

  // The default program must expose the manual rules revision.
  if (!options.program && program.mechanicsRevision !== DEFAULT_MECHANICS_REVISION) {
    throw new Error(
      `Default program revision "${program.mechanicsRevision}" diverges from DEFAULT_MECHANICS_REVISION "${DEFAULT_MECHANICS_REVISION}".`,
    );
  }

  let world: WorldState = program.initial(frozenConfig);
  /** Adapter-only: pause is not a competitive WorldState phase. */
  let paused = false;
  /** Adapter-only: incomplete tick remainder (never silent truncation of full ticks). */
  let remainderMs = 0;
  let sequence = 0;
  /** Adapter-only queue — peeked into the first step of advance; drained only after success. */
  let queue: QueuedCommand[] = [];
  /** Last rejections observed from a successful advance (readonly for diagnostics). */
  let lastRejections: readonly CommandRejection[] = Object.freeze([]);

  function enqueue(seatId: SeatId, command: KernelCommand): void {
    queue.push(Object.freeze({ seatId, command, sequence }));
    sequence += 1;
  }

  function peekQueueAsEnvelopes(tick: number): CommandEnvelope[] {
    return queue.map((item) =>
      Object.freeze({
        tick,
        sequence: item.sequence,
        seatId: item.seatId,
        command: item.command,
      }),
    );
  }

  return Object.freeze({
    dispatch(command: GameCommand): readonly GameEvent[] {
      if (command.type === "set-movement") {
        const seatId = seatIdForCompetitor(frozenConfig, command.competitorId);
        if (!seatId) {
          throw new Error(`Unknown competitorId: ${command.competitorId}`);
        }
        enqueue(seatId, {
          type: "set-movement",
          direction: command.direction,
          pressed: command.pressed,
        });
        return Object.freeze([] as GameEvent[]);
      }

      if (command.type === "place-bomb" || command.type === "use-skill") {
        const seatId = seatIdForCompetitor(frozenConfig, command.competitorId);
        if (!seatId) {
          throw new Error(`Unknown competitorId: ${command.competitorId}`);
        }
        enqueue(seatId, { type: command.type });
        return Object.freeze([] as GameEvent[]);
      }

      if (command.type === "toggle-pause") {
        if (
          world.slices.match.phase === "round-over"
          || world.slices.match.phase === "match-over"
        ) {
          return Object.freeze([] as GameEvent[]);
        }
        paused = !paused;
        return Object.freeze([
          Object.freeze({
            type: "phase-changed" as const,
            phase: paused ? ("paused" as const) : ("playing" as const),
          }),
        ]);
      }

      if (command.type === "restart") {
        world = program.initial(cloneMatchConfig(frozenConfig));
        paused = false;
        remainderMs = 0;
        sequence = 0;
        queue = [];
        lastRejections = Object.freeze([]);
        return Object.freeze([
          Object.freeze({ type: "restarted" as const, seed: frozenConfig.seed }),
        ]);
      }

      if (command.type !== "advance") {
        return Object.freeze([] as GameEvent[]);
      }

      const deltaMs = command.deltaMs;
      if (!Number.isFinite(deltaMs) || deltaMs <= 0 || deltaMs > MAX_ADVANCE_MS) {
        throw new Error(
          `advance.deltaMs must be a finite number in (0, ${MAX_ADVANCE_MS}]; got ${String(deltaMs)}.`,
        );
      }

      if (paused) {
        return Object.freeze([] as GameEvent[]);
      }

      const totalMs = remainderMs + deltaMs;
      const ticks = Math.floor(totalMs / TICK_DURATION_MS);
      remainderMs = totalMs - ticks * TICK_DURATION_MS;

      if (ticks === 0) {
        return Object.freeze([] as GameEvent[]);
      }

      const events: GameEvent[] = [];
      const collectedRejections: CommandRejection[] = [];
      for (let index = 0; index < ticks; index += 1) {
        const commands = index === 0 ? peekQueueAsEnvelopes(world.tick) : [];
        const result = program.step(world, { commands });
        world = result.state;
        events.push(...result.events);
        collectedRejections.push(...result.rejections);
      }

      queue = [];
      lastRejections = Object.freeze(collectedRejections);
      return Object.freeze(events);
    },

    snapshot(): GameSnapshot {
      return projectFacadeSnapshot(world, paused, program);
    },

    rejections(): readonly CommandRejection[] {
      return lastRejections;
    },
  });
}
