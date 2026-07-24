import type {
  CompetitorId,
  LocalDuel1v1Options,
  MatchConfig,
  MatchConfigInput,
  SeatAssignment,
  SeatId,
} from "./contracts.ts";
import { isSkillId, TICK_DURATION_MS } from "./contracts.ts";

/** Manual rules identifier. Bump when executable gameplay rules change. */
export const DEFAULT_MECHANICS_REVISION = "mechanics-v8" as const;

/**
 * Content pack identifier. Pass-through metadata while no variable content
 * is loaded — any non-empty string is accepted and preserved on MatchConfig.
 */
export const DEFAULT_CONTENT_REVISION = "content-prototype-arena-v1" as const;
export const DEFAULT_SEED = "game-mechanics-prototype-v1" as const;
export const DEFAULT_ROUND_DURATION_MS = 90_000;
export const DEFAULT_TARGET_ROUND_WINS = 2;
export const MIN_TARGET_ROUND_WINS = 1;
export const MAX_TARGET_ROUND_WINS = 9;
export const MIN_SEATS = 2;
export const MAX_SEATS = 4;
export const MIN_ROUND_DURATION_MS = 5_000;
export const MAX_ROUND_DURATION_MS = 10 * 60_000;

const LOCAL_DUEL_SEAT_IDS = ["seat-0", "seat-1"] as const;
const LOCAL_DUEL_COMPETITOR_IDS = ["competitor-a", "competitor-b"] as const;

/** Brand a validated seat id. Only call after normalize + uniqueness checks. */
function asSeatId(value: string): SeatId {
  return value as SeatId;
}

/** Brand a validated competitor id. Only call after normalize + uniqueness checks. */
function asCompetitorId(value: string): CompetitorId {
  return value as CompetitorId;
}

function requireNonEmptyTrimmed(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw new Error(`${label} must be a non-empty string.`);
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
  }
  return trimmed;
}

function freezeSeat(assignment: SeatAssignment): SeatAssignment {
  return Object.freeze({
    seatId: assignment.seatId,
    competitorId: assignment.competitorId,
    ...(assignment.skillId === undefined ? {} : { skillId: assignment.skillId }),
  });
}

/**
 * Validates and deeply freezes a MatchConfig.
 * Rejects invalid input instead of silently repairing it.
 *
 * IDs are normalized (trim) before uniqueness checks and branding so that
 * `"seat"` and `" seat "` collide as the same seatId.
 *
 * `contentRevision` is stored as pass-through metadata (any non-empty string)
 * until variable content packs exist.
 */
export function createMatchConfig(input: MatchConfigInput): MatchConfig {
  const seed = requireNonEmptyTrimmed(input.seed, "MatchConfig.seed");
  const mechanicsRevision = requireNonEmptyTrimmed(
    input.mechanicsRevision,
    "MatchConfig.mechanicsRevision",
  );
  const contentRevision = requireNonEmptyTrimmed(
    input.contentRevision,
    "MatchConfig.contentRevision",
  );

  if (!Number.isFinite(input.roundDurationMs) || !Number.isInteger(input.roundDurationMs)) {
    throw new Error("MatchConfig.roundDurationMs must be a finite integer.");
  }
  if (
    input.roundDurationMs < MIN_ROUND_DURATION_MS
    || input.roundDurationMs > MAX_ROUND_DURATION_MS
  ) {
    throw new Error(
      `MatchConfig.roundDurationMs must be between ${MIN_ROUND_DURATION_MS} and ${MAX_ROUND_DURATION_MS}.`,
    );
  }
  // Positive tick-aligned multiple of the canonical competitive tick.
  if (input.roundDurationMs % TICK_DURATION_MS !== 0) {
    throw new Error(
      `MatchConfig.roundDurationMs must be a positive multiple of ${TICK_DURATION_MS} ms.`,
    );
  }

  const targetRoundWins =
    input.targetRoundWins === undefined ? DEFAULT_TARGET_ROUND_WINS : input.targetRoundWins;
  if (!Number.isFinite(targetRoundWins) || !Number.isInteger(targetRoundWins)) {
    throw new Error("MatchConfig.targetRoundWins must be a finite integer.");
  }
  if (targetRoundWins < MIN_TARGET_ROUND_WINS || targetRoundWins > MAX_TARGET_ROUND_WINS) {
    throw new Error(
      `MatchConfig.targetRoundWins must be between ${MIN_TARGET_ROUND_WINS} and ${MAX_TARGET_ROUND_WINS}.`,
    );
  }

  if (!Array.isArray(input.seats)) {
    throw new Error("MatchConfig.seats must be an array.");
  }
  if (input.seats.length < MIN_SEATS || input.seats.length > MAX_SEATS) {
    throw new Error(
      `MatchConfig.seats must contain between ${MIN_SEATS} and ${MAX_SEATS} assignments.`,
    );
  }

  const seatIds = new Set<SeatId>();
  const competitorIds = new Set<CompetitorId>();
  const seats: SeatAssignment[] = [];

  for (const raw of input.seats) {
    if (!raw || typeof raw !== "object") {
      throw new Error("MatchConfig.seats entries must be objects.");
    }

    // Normalize before uniqueness — never insert raw untrimmed values.
    const seatId = asSeatId(requireNonEmptyTrimmed(raw.seatId, "MatchConfig seatId"));
    const competitorId = asCompetitorId(
      requireNonEmptyTrimmed(raw.competitorId, "MatchConfig competitorId"),
    );
    const skillId = raw.skillId;
    if (skillId !== undefined && (typeof skillId !== "string" || !isSkillId(skillId))) {
      throw new Error(`Unknown MatchConfig skillId: ${String(skillId)}`);
    }

    if (seatIds.has(seatId)) {
      throw new Error(`Duplicate seatId in MatchConfig: ${seatId}`);
    }
    if (competitorIds.has(competitorId)) {
      throw new Error(`Duplicate competitorId in MatchConfig: ${competitorId}`);
    }
    seatIds.add(seatId);
    competitorIds.add(competitorId);
    seats.push(freezeSeat({ seatId, competitorId, ...(skillId ? { skillId } : {}) }));
  }

  return Object.freeze({
    seed,
    mechanicsRevision,
    contentRevision,
    roundDurationMs: input.roundDurationMs,
    targetRoundWins,
    seats: Object.freeze(seats),
  });
}

/**
 * Local browser / lab preset: duel 1v1 with two stable seats and competitors.
 * Input labels (WASD vs arrows) stay in the adapter; domain IDs live here.
 */
export function createLocalDuel1v1MatchConfig(
  options: LocalDuel1v1Options = {},
): MatchConfig {
  const competitorIds = options.competitorIds ?? LOCAL_DUEL_COMPETITOR_IDS;
  return createMatchConfig({
    seed: options.seed ?? DEFAULT_SEED,
    mechanicsRevision: options.mechanicsRevision ?? DEFAULT_MECHANICS_REVISION,
    contentRevision: options.contentRevision ?? DEFAULT_CONTENT_REVISION,
    roundDurationMs: options.roundDurationMs ?? DEFAULT_ROUND_DURATION_MS,
    targetRoundWins: options.targetRoundWins ?? DEFAULT_TARGET_ROUND_WINS,
    seats: [
      { seatId: LOCAL_DUEL_SEAT_IDS[0], competitorId: competitorIds[0] },
      { seatId: LOCAL_DUEL_SEAT_IDS[1], competitorId: competitorIds[1] },
    ],
  });
}

/** Four-seat free-for-all factory for tests and future local lobbies. */
export function createFourSeatMatchConfig(options: {
  seed?: string;
  roundDurationMs?: number;
  targetRoundWins?: number;
  mechanicsRevision?: string;
  contentRevision?: string;
  /** Raw competitor labels; branded at the MatchConfig boundary. */
  competitorIds?: readonly [string, string, string, string];
} = {}): MatchConfig {
  const competitorIds = options.competitorIds ?? [
    "competitor-a",
    "competitor-b",
    "competitor-c",
    "competitor-d",
  ] as const;
  return createMatchConfig({
    seed: options.seed ?? DEFAULT_SEED,
    mechanicsRevision: options.mechanicsRevision ?? DEFAULT_MECHANICS_REVISION,
    contentRevision: options.contentRevision ?? DEFAULT_CONTENT_REVISION,
    roundDurationMs: options.roundDurationMs ?? DEFAULT_ROUND_DURATION_MS,
    targetRoundWins: options.targetRoundWins ?? DEFAULT_TARGET_ROUND_WINS,
    seats: [
      { seatId: "seat-0", competitorId: competitorIds[0] },
      { seatId: "seat-1", competitorId: competitorIds[1] },
      { seatId: "seat-2", competitorId: competitorIds[2] },
      { seatId: "seat-3", competitorId: competitorIds[3] },
    ],
  });
}

export function cloneMatchConfig(config: MatchConfig): MatchConfig {
  return createMatchConfig({
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
}

/** Explicit per-round arena seed — no hidden RNG cursor. */
export function roundSeedFor(configSeed: string, roundNumber: number): string {
  return `${configSeed}|round:${roundNumber}`;
}
