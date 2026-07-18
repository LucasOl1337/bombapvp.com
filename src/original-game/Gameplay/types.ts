export type PlayerId = 1 | 2 | 3 | 4;
export type MenuPlayerId = 1 | 2;
export const ALL_PLAYER_IDS = [1, 2, 3, 4] as const;
export const MENU_PLAYER_IDS = [1, 2] as const;
export type Mode = "boot" | "menu" | "match" | "match-result";
export type Direction = "up" | "down" | "left" | "right";
export type FlameStyle = "normal" | "arcane" | "shadow" | "toxic";
export type ArenaDefinitionStatus = "draft" | "active";
export type { CharacterSkillId } from "../../../Champions/contracts";
import type {
  ChampionPlayerSkillState,
  ChampionSkillPhase,
} from "../../../Champions/runtime-contracts";
export type SkillPhase = ChampionSkillPhase;
export type PowerUpType =
  | "bomb-up"
  | "flame-up"
  | "speed-up"
  | "remote-up"
  | "shield-up"
  | "bomb-pass-up"
  | "kick-up"
  | "short-fuse-up";

export interface TileCoord {
  x: number;
  y: number;
}

export interface PixelCoord {
  x: number;
  y: number;
}

export interface PlayerState {
  id: PlayerId;
  name: string;
  active: boolean;
  tile: TileCoord;
  position: PixelCoord;
  velocity: PixelCoord;
  alive: boolean;
  direction: Direction;
  lastMoveDirection: Direction | null;
  maxBombs: number;
  activeBombs: number;
  flameRange: number;
  speedLevel: number;
  remoteLevel: number;
  shieldCharges: number;
  bombPassLevel: number;
  kickLevel: number;
  shortFuseLevel: number;
  flameGuardMs: number;
  spawnProtectionMs: number;
  perfectStartWindowMs?: number;
  perfectStartBoostMs?: number;
  breakawayBoostMs?: number;
  pickupSprintMs?: number;
  skill: PlayerSkillState;
}

/** @deprecated Import ChampionPlayerSkillState from Champions/runtime-contracts. */
export type PlayerSkillState = ChampionPlayerSkillState;

export interface BombState {
  id: number;
  ownerId: PlayerId;
  tile: TileCoord;
  fuseMs: number;
  ownerCanPass: boolean;
  bodyEgressPlayerIds?: PlayerId[];
  flameRange: number;
}

export interface FlameState {
  tile: TileCoord;
  remainingMs: number;
  style?: FlameStyle;
  ownerId: PlayerId | null;
}

/**
 * Network/telemetry beam payload (Nico shape).
 * Runtime may hold a wider ChampionWorldEffect union; only Nico beams serialize here.
 */
export type MagicBeamState = import("../../../Champions/nico/contracts").NicoBeamEffect;

export interface SuddenDeathClosingTileState {
  tile: TileCoord;
  elapsedMs: number;
  impacted: boolean;
}

export interface PowerUpState {
  type: PowerUpType;
  tile: TileCoord;
  revealed: boolean;
  collected: boolean;
}

export interface ArenaSpawnDefinition {
  playerId: PlayerId;
  tile: TileCoord;
  direction: Direction;
}

export interface ArenaDefinition {
  id: string;
  name: string;
  status: ArenaDefinitionStatus;
  themeId: string;
  grid: {
    width: number;
    height: number;
  };
  tiles: {
    solid: string[];
    breakable: string[];
  };
  spawns: ArenaSpawnDefinition[];
  version: string;
  createdAt: string;
  updatedAt: string;
  /** Optional deterministic content seed used by headless publication matrices. */
  randomSeed?: string;
}

export interface ArenaValidationIssue {
  severity: "error" | "warning";
  code: string;
  message: string;
}

export interface ArenaRuntimeConfig extends ArenaDefinition {
  wrapPortals: TileCoord[];
  suddenDeathPath: TileCoord[];
  spawnMap: Record<PlayerId, ArenaSpawnDefinition>;
}

export interface ArenaState {
  config: ArenaRuntimeConfig;
  solid: Set<string>;
  breakable: Set<string>;
  powerUps: PowerUpState[];
}

export interface MatchScore {
  1: number;
  2: number;
  3: number;
  4: number;
}

export interface RoundOutcome {
  winner: PlayerId | null;
  reason: "elimination" | "timer" | "double-ko";
  message: string;
  countdownMs: number;
}
