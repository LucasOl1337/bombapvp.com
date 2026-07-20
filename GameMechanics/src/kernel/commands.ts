import type { CompetitorId, Direction, SeatId } from "../contracts.ts";

/**
 * External commands enter through validated envelopes.
 * tick must match the world tick; sequence defines order within the tick.
 */
export type KernelCommand =
  | Readonly<{
      type: "set-movement";
      direction: Direction;
      pressed: boolean;
    }>
  | Readonly<{ type: "place-bomb" }>
  | Readonly<{ type: "use-skill" }>;

export type CommandEnvelope = Readonly<{
  tick: number;
  sequence: number;
  seatId: SeatId;
  command: KernelCommand;
}>;

export type CommandRejection = Readonly<{
  sequence: number;
  seatId: SeatId;
  reason:
    | "tick-mismatch"
    | "unknown-seat"
    | "not-playing"
    | "competitor-dead"
    | "bomb-cap"
    | "tile-occupied"
    | "skill-unavailable"
    | "duplicate-sequence"
    | "invalid-envelope";
}>;

export type StepInput = Readonly<{
  commands: readonly CommandEnvelope[];
}>;

const DIRECTIONS = new Set<Direction>(["up", "down", "left", "right"]);

export function isDirection(value: unknown): value is Direction {
  return typeof value === "string" && DIRECTIONS.has(value as Direction);
}

/**
 * Structural validation of envelopes. Invalid structure → atomic failure (throw).
 * Inapplicable rules become rejections inside step, not exceptions.
 */
export function assertValidStepInput(input: StepInput): void {
  if (!input || typeof input !== "object") {
    throw new Error("StepInput must be an object.");
  }
  if (!Array.isArray(input.commands)) {
    throw new Error("StepInput.commands must be an array.");
  }
  for (const envelope of input.commands) {
    if (!envelope || typeof envelope !== "object") {
      throw new Error("Command envelope must be an object.");
    }
    if (!Number.isInteger(envelope.tick) || envelope.tick < 0) {
      throw new Error("Command envelope.tick must be a non-negative integer.");
    }
    if (!Number.isInteger(envelope.sequence) || envelope.sequence < 0) {
      throw new Error("Command envelope.sequence must be a non-negative integer.");
    }
    if (typeof envelope.seatId !== "string" || envelope.seatId.trim().length === 0) {
      throw new Error("Command envelope.seatId must be a non-empty string.");
    }
    const command = envelope.command;
    if (!command || typeof command !== "object" || typeof command.type !== "string") {
      throw new Error("Command envelope.command is invalid.");
    }
    if (command.type === "set-movement") {
      if (!isDirection(command.direction) || typeof command.pressed !== "boolean") {
        throw new Error("set-movement command is structurally invalid.");
      }
    } else if (command.type === "place-bomb" || command.type === "use-skill") {
      // ok
    } else {
      throw new Error(`Unknown kernel command type: ${(command as { type: string }).type}`);
    }
  }
}

/** Canonical order: sequence, then seatId, then command type. */
export function sortEnvelopes(commands: readonly CommandEnvelope[]): CommandEnvelope[] {
  return [...commands].sort((left, right) => {
    if (left.sequence !== right.sequence) return left.sequence - right.sequence;
    if (left.seatId !== right.seatId) {
      return left.seatId < right.seatId ? -1 : 1;
    }
    return left.command.type < right.command.type ? -1 : left.command.type > right.command.type ? 1 : 0;
  });
}

export type ResolvedCommand = Readonly<{
  envelope: CommandEnvelope;
  competitorId: CompetitorId;
}>;
