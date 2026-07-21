export const GAME_MECHANICS_VERSION = "kernel-0.10.0" as const;

/**
 * Canonical competitive tick duration in milliseconds.
 * Shared neutral constant — MatchConfig, kernel, and modules must agree.
 * Kept here (not in world-state) so match-config can validate alignment
 * without importing the world-state module (circular dependency).
 */
export const TICK_DURATION_MS = 20 as const;

/** Competitive cycle timings. Changes to these rules require a manual mechanics revision bump. */
export const ROUND_START_MS = 1_200 as const;
export const SPAWN_PROTECTION_MS = 2_200 as const;
export const ROUND_END_MS = 1_600 as const;

declare const SeatIdBrand: unique symbol;
declare const CompetitorIdBrand: unique symbol;

/**
 * Stable seat slot inside a match (2..4). Identity of the chair, not who sits.
 * Branded so SeatId is not assignable to CompetitorId (or the reverse).
 */
export type SeatId = string & { readonly [SeatIdBrand]: "SeatId" };

/**
 * Who occupies a seat for this match. Commands and simulation ownership use this.
 * Branded so CompetitorId is not assignable to SeatId (or the reverse).
 */
export type CompetitorId = string & { readonly [CompetitorIdBrand]: "CompetitorId" };

export type Direction = "up" | "down" | "left" | "right";

/** Canonical skill ids (aligned with character roster skill identifiers). */
export const SKILL_IDS = [
  "ranni-ice-blink",
  "killer-bee-wing-dash",
  "crocodilo-emerald-surge",
  "thresh-death-sentence",
] as const;

export type SkillId = (typeof SKILL_IDS)[number];

export const RANNI_ICE_BLINK_SKILL_ID = "ranni-ice-blink" as const satisfies SkillId;
export const KILLER_BEE_WING_DASH_SKILL_ID = "killer-bee-wing-dash" as const satisfies SkillId;
export const CROCODILO_EMERALD_SURGE_SKILL_ID = "crocodilo-emerald-surge" as const satisfies SkillId;
export const THRESH_DEATH_SENTENCE_SKILL_ID = "thresh-death-sentence" as const satisfies SkillId;

const SKILL_ID_SET: ReadonlySet<string> = new Set(SKILL_IDS);

export function isSkillId(value: string): value is SkillId {
  return SKILL_ID_SET.has(value);
}

/** Competitive Match phases + adapter-only `paused` overlay in the facade snapshot. */
export type MatchPhase =
  | "round-start"
  | "playing"
  | "sudden-death"
  | "round-over"
  | "match-over";

export type GamePhase = MatchPhase | "paused";

export type TileCoord = Readonly<{
  x: number;
  y: number;
}>;

/** Fixed-point body-center position (integer world units). */
export type WorldPosition = Readonly<{
  x: number;
  y: number;
}>;

/** Integer velocity actually applied last locomotion tick (units/tick). */
export type Velocity = Readonly<{
  x: number;
  y: number;
}>;

export type SeatAssignment = Readonly<{
  seatId: SeatId;
  competitorId: CompetitorId;
  skillId?: SkillId;
}>;

export type ScoreEntry = Readonly<{
  competitorId: CompetitorId;
  wins: number;
}>;

/**
 * Canonical, deeply immutable match configuration.
 * Replay is identified by this config plus the ordered command stream.
 *
 * `contentRevision` is metadata pass-through while there is no variable
 * content pack to load — any non-empty string is accepted and preserved.
 * `mechanicsRevision` is also stored here, but the program only executes
 * configs whose revision matches this implementation.
 * `targetRoundWins` is first-to-K (1..9); draws create extra rounds.
 */
export type MatchConfig = Readonly<{
  seed: string;
  mechanicsRevision: string;
  contentRevision: string;
  roundDurationMs: number;
  /** First-to-K wins. Integer 1..9. */
  targetRoundWins: number;
  seats: readonly SeatAssignment[];
}>;

export type SkillSnapshot = Readonly<{
  id: SkillId;
  phase: "idle" | "channeling" | "cooldown";
  cooldownRemainingMs: number;
  channelRemainingMs: number;
  projection: WorldPosition | null;
  aimDirection: Direction | null;
}>;

export type CompetitorSnapshot = Readonly<{
  id: CompetitorId;
  seatId: SeatId;
  /** Fine fixed-point body center. */
  position: WorldPosition;
  /** Last applied locomotion delta (units/tick). */
  velocity: Velocity;
  /** Derived from position via tileOf — never a second source of truth. */
  tile: TileCoord;
  alive: boolean;
  /** Remaining spawn protection ms (0 when unprotected). */
  spawnProtectionRemainingMs: number;
  activeBombs: number;
  maxBombs: number;
  flameRange: number;
  /** Omitted byte-for-byte when this seat has no assigned skill. */
  skill?: SkillSnapshot;
}>;

export type BombSnapshot = Readonly<{
  id: number;
  ownerId: CompetitorId;
  tile: TileCoord;
  fuseMs: number;
  flameRange: number;
}>;

export type FlameCauseSnapshot = Readonly<{
  bombId: number;
  ownerId: CompetitorId;
}>;

export type FlameSnapshot = Readonly<{
  tile: TileCoord;
  remainingMs: number;
  /** Primary cause (first in canonical order). Never last-writer. */
  ownerId: CompetitorId;
  /** All causes when multi-authorship is present. */
  causes: readonly FlameCauseSnapshot[];
}>;

/** Visible power-up types for Slice 4A (Decision 009). */
export type PowerUpType = "bomb-up" | "flame-up";

export type PowerUpSnapshot = Readonly<{
  tile: TileCoord;
  type: PowerUpType;
}>;

export type RoundOutcome = Readonly<{
  reason: "elimination" | "double-ko";
  winner: CompetitorId | null;
}>;

export type GameSnapshot = Readonly<{
  version: typeof GAME_MECHANICS_VERSION;
  revision: number;
  config: MatchConfig;
  phase: GamePhase;
  roundNumber: number;
  /** Countdown for round-start / round-over; 0 otherwise. */
  phaseRemainingMs: number;
  /** Competitive round clock elapsed (playing / frozen after). */
  roundElapsedMs: number;
  /** Competitive round clock remaining; 0 in sudden-death and after. */
  roundRemainingMs: number;
  suddenDeathElapsedMs: number;
  scores: readonly ScoreEntry[];
  targetRoundWins: number;
  matchWinner: CompetitorId | null;
  /**
   * @deprecated Adapter alias for roundElapsedMs (competitive clock elapsed).
   * Prefer roundElapsedMs / phaseRemainingMs / roundRemainingMs explicitly.
   */
  elapsedMs: number;
  /**
   * @deprecated Adapter alias: during round-start/round-over shows phase
   * countdown; otherwise competitive remaining.
   */
  remainingMs: number;
  arena: Readonly<{
    width: number;
    height: number;
    /**
     * Effective solid projection for adapters: Arena base solid union
     * Pressure closed tiles. WorldState keeps owners separate.
     */
    solid: readonly TileCoord[];
    crates: readonly TileCoord[];
  }>;
  /**
   * Sudden-death pressure projection (adapter-only).
   * closedTiles are already unioned into arena.solid — not re-exposed.
   * closing is derived from Match phase/clock (null outside sudden-death).
   * pathLength is derived from Arena base solid spiral.
   */
  pressure: Readonly<{
    closing: null | Readonly<{
      index: number;
      tile: TileCoord;
      remainingMs: number;
    }>;
    pathLength: number;
  }>;
  competitors: readonly CompetitorSnapshot[];
  bombs: readonly BombSnapshot[];
  flames: readonly FlameSnapshot[];
  /** Visible, still-available power-ups only (canonical tile order). */
  powerUps: readonly PowerUpSnapshot[];
  outcome: RoundOutcome | null;
}>;

export type GameCommand =
  | Readonly<{
      type: "set-movement";
      competitorId: CompetitorId;
      direction: Direction;
      pressed: boolean;
    }>
  | Readonly<{ type: "place-bomb"; competitorId: CompetitorId }>
  | Readonly<{ type: "use-skill"; competitorId: CompetitorId }>
  | Readonly<{ type: "advance"; deltaMs: number }>
  | Readonly<{ type: "toggle-pause" }>
  /** Restarts the entire competitive session using the same MatchConfig. */
  | Readonly<{ type: "restart" }>;

/**
 * Discriminated elimination authorship (Decision 008).
 * Flame state/snapshot causes remain bomb-only; only elimination events
 * carry the pressure variant.
 */
export type EliminationCause =
  | Readonly<{
      kind: "bomb";
      bombId: number;
      ownerId: CompetitorId;
    }>
  | Readonly<{
      kind: "pressure";
      pressureIndex: number;
      at: TileCoord;
    }>
  | Readonly<{
      kind: "skill";
      skillId: SkillId;
      ownerId: CompetitorId;
      at: TileCoord;
    }>;

export type GameEvent =
  | Readonly<{
      type: "competitor-moved";
      competitorId: CompetitorId;
      position: WorldPosition;
      /** Derived tile of the fine position — never stored separately in the world. */
      tile: TileCoord;
    }>
  | Readonly<{
      type: "bomb-placed";
      bombId: number;
      competitorId: CompetitorId;
      at: TileCoord;
    }>
  | Readonly<{
      type: "bomb-exploded";
      bombId: number;
      competitorId: CompetitorId;
      flameTiles: readonly TileCoord[];
    }>
  | Readonly<{ type: "crate-destroyed"; at: TileCoord }>
  | Readonly<{
      type: "competitor-eliminated";
      competitorId: CompetitorId;
      /** All authorship causes — never a single last-writer kill credit. */
      causes: readonly EliminationCause[];
    }>
  | Readonly<{
      type: "pressure-warning";
      roundNumber: number;
      pressureIndex: number;
      tile: TileCoord;
      remainingMs: number;
      fallMs: number;
    }>
  | Readonly<{
      type: "pressure-closed";
      roundNumber: number;
      pressureIndex: number;
      tile: TileCoord;
    }>
  | Readonly<{
      type: "power-up-revealed";
      at: TileCoord;
      powerUpType: PowerUpType;
    }>
  | Readonly<{
      type: "power-up-collected";
      competitorId: CompetitorId;
      at: TileCoord;
      powerUpType: PowerUpType;
      maxBombs: number;
      flameRange: number;
    }>
  | Readonly<{
      type: "round-started";
      roundNumber: number;
      roundSeed: string;
    }>
  | Readonly<{ type: "round-became-playable"; roundNumber: number }>
  | Readonly<{ type: "sudden-death-started"; roundNumber: number }>
  | Readonly<{
      type: "round-ended";
      roundNumber: number;
      outcome: RoundOutcome;
      scores: readonly ScoreEntry[];
    }>
  | Readonly<{
      type: "match-ended";
      winner: CompetitorId;
      scores: readonly ScoreEntry[];
    }>
  | Readonly<{ type: "phase-changed"; phase: "playing" | "paused" }>
  /** Full session restart (facade). Alias kept for browser compatibility. */
  | Readonly<{ type: "restarted"; seed: string }>;

/**
 * Neutral command rejection observed by adapters (facade diagnostics / kernel step).
 * Co-located with the public surface so browser code can type diagnostics without
 * importing kernel internals.
 */
export type FacadeCommandRejection = Readonly<{
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

/**
 * @deprecated Prefer {@link MechanicsProgram}. Kept for localhost / browser adapter.
 * `rejections()` exposes the last successful advance's kernel rejections (readonly).
 */
export interface GameMechanics {
  dispatch(command: GameCommand): readonly GameEvent[];
  snapshot(): GameSnapshot;
  /** Last rejections from a successful advance; empty until one runs. */
  rejections(): readonly FacadeCommandRejection[];
}

/**
 * Ergonomic raw-string input for MatchConfig construction.
 * Validation + branding happen only at the createMatchConfig boundary.
 */
export type MatchConfigInput = Readonly<{
  seed: string;
  mechanicsRevision: string;
  contentRevision: string;
  roundDurationMs: number;
  targetRoundWins?: number;
  seats: readonly Readonly<{
    seatId: string;
    competitorId: string;
    skillId?: SkillId;
  }>[];
}>;

export type LocalDuel1v1Options = Readonly<{
  seed?: string;
  roundDurationMs?: number;
  targetRoundWins?: number;
  mechanicsRevision?: string;
  contentRevision?: string;
  /** Raw competitor labels; branded at the MatchConfig boundary. */
  competitorIds?: readonly [string, string];
}>;
