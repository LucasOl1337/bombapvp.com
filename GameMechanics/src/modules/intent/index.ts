import type { CompetitorId, Direction, MatchConfig } from "../../contracts.ts";
import type { CommandRejection } from "../../kernel/commands.ts";
import { factsOfKind } from "../../kernel/facts.ts";
import type {
  ModuleSpec,
  SystemRunContext,
  SystemRunResult,
} from "../../kernel/protocol.ts";
import {
  assertCompetitorOrder,
  findIntent,
  findVitals,
  isGameplayActive,
  type IntentEntry,
  type IntentSlice,
} from "../../kernel/world-state.ts";

/** Intent slice and command handling implementation version. */
const MODULE_VERSION = "2.1.0";

const DIRECTIONS = new Set<Direction>(["up", "down", "left", "right"]);

function applySetMovement(
  directions: readonly Direction[],
  direction: Direction,
  pressed: boolean,
): readonly Direction[] {
  const next = directions.filter((entry) => entry !== direction);
  if (pressed) next.push(direction);
  return Object.freeze(next);
}

function runIntent(ctx: SystemRunContext): SystemRunResult {
  const intent = ctx.read("intent");
  const vitals = ctx.read("vitals");
  const match = ctx.read("match");
  const rejections: CommandRejection[] = [];
  const byId = new Map<string, IntentEntry>(
    intent.entries.map((entry) => [
      entry.competitorId,
      Object.freeze({
        competitorId: entry.competitorId,
        pressedDirections: Object.freeze([...entry.pressedDirections]),
      }),
    ]),
  );

  for (const resolved of ctx.commands) {
    const { envelope, competitorId } = resolved;
    if (envelope.command.type !== "set-movement") continue;

    if (!isGameplayActive(match.phase)) {
      rejections.push(
        Object.freeze({
          sequence: envelope.sequence,
          seatId: envelope.seatId,
          reason: "not-playing" as const,
        }),
      );
      continue;
    }

    const row = findVitals(vitals, competitorId);
    if (!row?.alive) {
      rejections.push(
        Object.freeze({
          sequence: envelope.sequence,
          seatId: envelope.seatId,
          reason: "competitor-dead" as const,
        }),
      );
      continue;
    }

    const current = byId.get(competitorId) ?? findIntent(intent, competitorId);
    if (!current) continue;

    const nextDirections = applySetMovement(
      current.pressedDirections,
      envelope.command.direction,
      envelope.command.pressed,
    );

    byId.set(
      competitorId,
      Object.freeze({
        competitorId,
        pressedDirections: nextDirections,
      }),
    );
  }

  const entries = ctx.config.seats.map((seat) => {
    const entry = byId.get(seat.competitorId);
    return (
      entry ??
      Object.freeze({
        competitorId: seat.competitorId,
        pressedDirections: Object.freeze([] as Direction[]),
      })
    );
  });

  return {
    writes: {
      intent: Object.freeze({ entries: Object.freeze(entries) }),
    },
    rejections,
  };
}

function initialIntent(config: MatchConfig): IntentSlice {
  const entries = config.seats.map((assignment) =>
    Object.freeze({
      competitorId: assignment.competitorId,
      pressedDirections: Object.freeze([] as Direction[]),
    }),
  );
  return Object.freeze({ entries: Object.freeze(entries) });
}

function restoreIntent(raw: unknown, config: MatchConfig): IntentSlice {
  if (!raw || typeof raw !== "object") {
    throw new Error("slices.intent must be an object.");
  }
  const intentRaw = raw as { entries?: unknown };
  if (!Array.isArray(intentRaw.entries)) {
    throw new Error("slices.intent.entries must be an array.");
  }
  const seatOrder = config.seats.map((seat) => seat.competitorId);
  const seatSet = new Set(seatOrder);
  const intentEntries = intentRaw.entries.map((entry, index) => {
    if (!entry || typeof entry !== "object") {
      throw new Error(`slices.intent.entries[${index}] is invalid.`);
    }
    const row = entry as Record<string, unknown>;
    if (typeof row.competitorId !== "string" || !seatSet.has(row.competitorId as CompetitorId)) {
      throw new Error(`slices.intent.entries[${index}].competitorId is invalid.`);
    }
    if (!Array.isArray(row.pressedDirections)) {
      throw new Error(`slices.intent.entries[${index}].pressedDirections must be an array.`);
    }
    const dirs = row.pressedDirections.map((direction, dirIndex) => {
      if (typeof direction !== "string" || !DIRECTIONS.has(direction as Direction)) {
        throw new Error(
          `slices.intent.entries[${index}].pressedDirections[${dirIndex}] is invalid.`,
        );
      }
      return direction as Direction;
    });
    if (new Set(dirs).size !== dirs.length) {
      throw new Error(
        `slices.intent.entries[${index}].pressedDirections must be unique.`,
      );
    }
    return Object.freeze({
      competitorId: row.competitorId as CompetitorId,
      pressedDirections: Object.freeze(dirs),
    });
  });
  assertCompetitorOrder(intentEntries, seatOrder, "slices.intent.entries");
  return Object.freeze({ entries: Object.freeze(intentEntries) });
}

function runIntentReset(ctx: SystemRunContext): SystemRunResult {
  const resets = factsOfKind(ctx.facts, "round-reset");
  if (resets.length === 0) return {};
  const intent = ctx.read("intent");
  const entries = intent.entries.map((entry) =>
    Object.freeze({
      competitorId: entry.competitorId,
      pressedDirections: Object.freeze([] as Direction[]),
    }),
  );
  return {
    writes: {
      intent: Object.freeze({ entries: Object.freeze(entries) }),
    },
  };
}


export const intentModule: ModuleSpec = Object.freeze({
  id: "intent",
  version: MODULE_VERSION,
  owns: Object.freeze(["intent"] as const),
  systems: Object.freeze([
    Object.freeze({
      id: "intent-reset-system",
      phase: "round-reset" as const,
      reads: Object.freeze(["intent"] as const),
      writes: Object.freeze(["intent"] as const),
      run: runIntentReset,
    }),
    Object.freeze({
      id: "intent-system",
      phase: "intent" as const,
      reads: Object.freeze(["intent", "vitals", "match"] as const),
      writes: Object.freeze(["intent"] as const),
      run: runIntent,
    }),
  ]),
  codecs: Object.freeze({
    initial(config: MatchConfig) {
      return Object.freeze({ intent: initialIntent(config) });
    },
    restore(rawOwned: Readonly<Partial<Record<"intent", unknown>>>, config: MatchConfig) {
      return Object.freeze({ intent: restoreIntent(rawOwned.intent, config) });
    },
  }),
});
