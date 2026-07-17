import type {
  ArenaState,
  BombState,
  Direction,
  FlameState,
  PixelCoord,
  PlayerId,
  PlayerState,
  TileCoord,
} from "../Gameplay/types";

export interface BotDecision {
  direction: Direction | null;
  placeBomb: boolean;
  detonate?: boolean;
  useSkill?: boolean;
  skillHeld?: boolean;
  skillAction?: "start" | "hold" | "release" | "none";
  requestId?: number;
  microActionIndex?: number;
  targetId?: PlayerId;
  intent?: "remote-detonation" | "bomb-attack" | "attack-position" | "chase-enemy";
}

/**
 * Snapshot and movement capabilities a decision policy needs from the match.
 * It deliberately contains no GameApp type, so policies can run in a browser,
 * a headless match, or a future remote decision adapter.
 */
export interface BotContext {
  players: Record<PlayerId, PlayerState>;
  activePlayerIds: PlayerId[];
  bombs: BombState[];
  flames: FlameState[];
  arena: ArenaState;
  suddenDeathActive: boolean;
  suddenDeathTickMs: number;
  suddenDeathIndex: number;
  suddenDeathPath: TileCoord[];
  suddenDeathClosureEffects: Array<{ tile: TileCoord; elapsedMs: number; impacted: boolean }>;
  /** Match-wide pacing throttle set whenever any bot plants a bomb. */
  roomBombPlacementThrottleMs: number;
  botCommittedDirection: Record<PlayerId, Direction | null>;
  botPendingReverseDirection: Record<PlayerId, Direction | null>;
  botPendingReverseFrames: Record<PlayerId, number>;
  dangerMap?: Map<string, number>;
  canOccupyPosition: (position: PixelCoord, tile: TileCoord) => boolean;
  evaluateMovementOption: (player: PlayerState, direction: Direction, deltaMs: number) => any;
  evaluateProjectedMovementOption: (player: PlayerState, direction: Direction, deltaMs: number) => any;
  projectKillerBeeDashTarget: (player: PlayerState, direction: Direction) => PixelCoord;
  canMovementOptionAdvance: (position: PixelCoord, movementOption: any) => boolean;
  areOppositeDirections: (first: Direction, second: Direction) => boolean;
  isPlayerOverlappingTile: (player: PlayerState, tile: TileCoord) => boolean;
}

export type BotDecisionPolicy = (player: PlayerState, context: BotContext) => BotDecision;

export type BotDecisionMeasurement = Readonly<{
  playerId: PlayerId;
  decision: BotDecision;
  computeMs: number;
}>;
