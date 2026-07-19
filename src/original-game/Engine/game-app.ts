import {
  BASE_MOVE_MS,
  BOMB_FUSE_MS,
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  FIXED_STEP_MS,
  FLAME_DURATION_MS,
  HUD_HEIGHT,
  KEY_BINDINGS,
  LOCAL_PLAYER_MOVEMENT_BINDINGS,
  MIN_MOVE_MS,
  PLAYER_COLORS,
  ROUND_DURATION_MS,
  ROUND_END_DELAY_MS,
  SKILL_KEY,
  SPEED_STEP_MS,
  TARGET_WINS,
  TILE_SIZE,
} from "../PersonalConfig/config";
import { monotonicNow } from "../../shared/monotonic-time";
import {
  spriteForDirection,
  type CharacterRosterEntry,
  type DirectionalSprites,
  type GameAssets,
} from "./assets";
import {
  DEFAULT_ARENA_THEME_ID,
  getArenaThemeById,
  type ArenaThemePalette,
} from "../Arenas/arena-theme-library";
import { pickAnimationFrame } from "./animation-frame";
import { SpriteTrimCache, type SpriteTrimBounds } from "./sprite-trim-cache";
import {
  ALL_PLAYER_IDS,
  MENU_PLAYER_IDS,
} from "../Gameplay/types";
import type {
  ArenaDefinition,
  ArenaState,
  BombState,
  CharacterSkillId,
  Direction,
  FlameState,
  MatchScore,
  MenuPlayerId,
  Mode,
  PixelCoord,
  PlayerId,
  PlayerState,
  PowerUpState,
  RoundOutcome,
  SuddenDeathClosingTileState,
  TileCoord,
} from "../Gameplay/types";
import { InputManager, NoopInputManager, type InputController } from "./input";
import {
  buildArenaRuntimeConfig,
  createArena,
  createDefaultArenaDefinition,
  isWrapPortalTile,
  tileKey,
} from "../Arenas/arena";
import {
  applyPowerUpToPlayer,
  formatBombFuseSeconds,
  formatControlKey,
  getBombFuseMsForPlayer,
  getDemolitionComboDropTypes,
  getPowerUpDefinition,
  getPowerUpLevel,
  isPowerUpMaxed,
  type SkillPowerUpType,
  SKILL_POWER_UP_TYPES,
} from "../Gameplay/powerups";
import {
  advancePickupChain,
  createPickupChainState,
  PICKUP_CHAIN_GUARD_MS,
  registerPickupForChain,
  type PickupChainState,
} from "../Gameplay/pickup-chain";
import {
  PLAYER_BODY_HALF,
  bodyOverlapsTile,
  bodyTileOverlapArea,
  bodyTouchedTileIndices,
  projectedBodyOverlapsTile,
  isMonotonicBodyBombEgress as pureIsMonotonicBodyBombEgress,
} from "../Gameplay/player-body";
import { tilesFromKeys } from "../Gameplay/flame-contact";
import { drawFlameTile } from "./flame-render";
import {
  computeRivalSlotWidth,
  drawHudPanel as paintHudPanel,
  ellipsisText,
  formatHudScoreLine,
  HUD_LAYOUT,
  partitionHudPlayers,
} from "./hud-format";
import type {
  LobbyMode,
  MatchStartConfig,
  OnlineDeathCause,
  OnlineEndlessStats,
  OnlineGameFrame,
  OnlineGameSnapshot,
  OnlineInputState,
  OnlineSessionBridge,
} from "../NetCode/protocol";
import {
  AUDIO_MUTED_STORAGE_KEY,
  AUDIO_VOLUME_STORAGE_KEY,
  SoundManager,
  SFX_MANIFEST,
} from "./sound-manager";
import type {
  BotContext,
  BotDecision,
  BotDecisionMeasurement,
  BotDecisionPolicy,
} from "./bot-contracts";
import {
  buildBotDangerMap as botAI_buildDangerMap,
  canBotSafelyPlaceBomb as botAI_canSafelyPlaceBomb,
  getBotDecision as botAI_getBotDecision,
  getBotSafetyDecision as botAI_getSafetyDecision,
  getStableBotDirection as botAI_getStableBotDirection,
} from "./bot-ai";
import { createBotRuntime, type BotRuntime } from "./bot-runtime";
import {
  buildDangerMap,
  getBombBlastKeys as projectBombBlastKeys,
  SUDDEN_DEATH_FALL_MS,
  SUDDEN_DEATH_TICK_MS,
  type ProjectedBomb,
} from "./danger-map";
import {
  createMatchCycle,
  type MatchCycle,
  type MatchCycleEvent,
  type MatchCycleSnapshot,
} from "./match-cycle";
import { resolveBombExplosions, type BombExplosion } from "./bomb-explosions";
import type { SkillContext } from "../ultimate/skill-system";
import {
  createDefaultPlayerSkillState,
  syncPlayerSkill as skill_syncPlayerSkill,
  advancePlayerSkillTimers as skill_advancePlayerSkillTimers,
  activatePlayerSkill as skill_activatePlayerSkill,
  updatePlayerSkillChannel as skill_updatePlayerSkillChannel,
  isPlayerImmuneDuringSkillChannel as skill_isPlayerImmuneDuringSkillChannel,
  getCharacterSkillId,
  getCharacterSkillDefinition,
} from "../ultimate/skill-system";
import type { OnlineRenderSample, PendingOnlineInput } from "../NetCode/online-sync";
import {
  ONLINE_SNAPSHOT_INTERVAL_MS,
  appendPendingOnlineInput,
  captureOnlineLocalInput as online_captureLocalInput,
  cloneOnlineInputState,
  consumeLatchedOnlinePress,
  createNeutralOnlineInput,
  mergeLatchedOnlineInput,
  playOnlineAudioTransition as online_playAudioTransition,
  pushOnlineRenderSample as online_pushRenderSample,
  updateVisualPlayerPositions as online_updateVisualPlayerPositions,
} from "../NetCode/online-sync";
import { SITE_COPY, type SiteLanguage } from "../UiLayouts/i18n";
import { createChampionVisualRuntime } from "../../../Champions/visual-runtime";
import { championSkillAllowsPlayerOverlap, getChampionProjectedMovementIgnoredBombIds, notifyChampionBombPlaced, notifyChampionBombRemoved, projectChampionSkillTarget } from "../../../Champions/runtime";
import {
  isNicoBeamEffect,
  type ChampionWorldEffect,
} from "../../../Champions/world-effects";

const KICK_SLIDE_MAX_TILES = 3;
const KICK_FUSE_PENALTY_MS_PER_TILE = 250;
const KICK_FUSE_MIN_MS = 450;
const KICK_IMPACT_FEEDBACK_MS = 220;
const EXPLOSION_SCREEN_SHAKE_MS = 160;
const EXPLOSION_SCREEN_SHAKE_AMPLITUDE_PX = 4;
const EXPLOSION_SCREEN_SHAKE_AMPLITUDE_MAX_PX = 6;
const DEMOLITION_COMBO_MIN_CRATES = 2;
export type { BotDecisionMeasurement, BotDecisionPolicy } from "./bot-contracts";

declare global {
  interface Window {
    render_game_to_text?: () => string;
    advanceTime?: (ms: number) => void;
  }
}

interface CenterOverlayState {
  title: string;
  subtitle: string;
  footer: string | null;
  victoryEmblem: boolean;
  stalemateEmblem: boolean;
}

const directionDelta: Record<Direction, TileCoord> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};
const LANE_SNAP_THRESHOLD = TILE_SIZE * 0.45;
const LANE_LOCK_THRESHOLD = 3;
const LANE_SETTLE_EPSILON = 0.35;
const LANE_SNAP_FACTOR = 2.6;
const ROUND_START_CUE_MS = 1_250;
const CHARACTER_MENU_KEYS: Record<MenuPlayerId, string> = {
  1: "KeyG",
  2: "KeyK",
};
const LOCAL_BOT_TOGGLE_KEY = "KeyB";
const LOCAL_BOT_CYCLE_KEY = "KeyN";
const MAX_LOCAL_BOT_FILL = 3;
const BOT_BOMB_COOLDOWN_MS = 900;
/** Fullscreen shares the two-row layout height (was 34 — too cramped for 4p). */
const FULLSCREEN_HUD_HEIGHT = HUD_LAYOUT.height;
const FULLSCREEN_HUD_CENTER_WIDTH = HUD_LAYOUT.centerMaxWidth;
const WALK_FRAME_MS = 100;
const SKILL_FRAME_MS = 100;
const DEATH_FRAME_MS = 90;
const CRATE_BREAK_DURATION_MS = 220;
const POWER_UP_SPAWN_POP_MS = 120;
const POWER_UP_REVEAL_HALO_MS = 260;
const POWER_UP_REVEAL_HALO_START_RADIUS = 12;
const POWER_UP_REVEAL_HALO_END_RADIUS = 26;
const FLAME_DISSIPATE_TAIL_MS = 120;
const CHAIN_REACTION_FEEDBACK_MS = 260;
const EXPLOSION_FEEDBACK_INSET_PX = 1;
const PLAYER_FLAME_OCCLUSION_INSET_PX = 3;
const PLAYER_FLAME_OCCLUSION_CORNER_PX = 10;
const PLAYER_FLAME_OCCLUSION_DEATH_WINDOW_MS = FLAME_DURATION_MS;
const SPAWN_PROTECTION_MS = 2200;
const PERFECT_START_WINDOW_MS = 320;
const PERFECT_START_BOOST_MS = 640;
const PERFECT_START_SPEED_MULTIPLIER = 1.35;
const PICKUP_SPRINT_BOOST_MS = 420;
const DANGER_ADRENALINE_ETA_MS = 900;
const DANGER_ADRENALINE_SPEED_MULTIPLIER = 1.18;
const SPEED_SPARK_TRAIL_ACTIVE_ALPHA = 0.72;
const SPEED_SPARK_TRAIL_PASSIVE_ALPHA = 0.42;
const SUDDEN_DEATH_ELAPSED_MS = 40_000;
const SUDDEN_DEATH_START_MS = ROUND_DURATION_MS - SUDDEN_DEATH_ELAPSED_MS;
const SUDDEN_DEATH_IMPACT_LINGER_MS = 180;
const SHIELD_GUARD_MS = 600;
const SHIELD_BREAKAWAY_BOOST_MS = 520;
const DANGER_OVERLAY_MAX_ETA_MS = BOMB_FUSE_MS + 600;
const HUD_CRITICAL_DANGER_MS = 1_200;
const DANGER_OVERLAY_PULSE_FAST_MS = 220;
const DANGER_OVERLAY_PULSE_SLOW_MS = 420;
const MATCH_RESULT_RESTART_DELAY_MS = 900;
const ROUND_OUTCOME_OVERLAY_HOLD_MS = 350;
const CANVAS_BACKBUFFER_SCALE = 2;
const CANVAS_VIEWPORT_PADDING = 32;
const POWER_UP_PICKUP_NOTICE_MS = 2200;
const PLAYER_SPRITE_HEIGHT_SCALE = 1.45;
const PLAYER_SPRITE_MAX_WIDTH_SCALE = 1.2;
const CANVAS_UI_PANEL_BG = "rgba(8, 8, 16, 0.82)";
const CANVAS_UI_PANEL_BG_STRONG = "rgba(6, 6, 12, 0.92)";
const CANVAS_UI_PANEL_BG_SOFT = "rgba(12, 12, 20, 0.72)";
const CANVAS_UI_BORDER = "rgba(0, 229, 160, 0.22)";
const CANVAS_UI_BORDER_STRONG = "rgba(0, 229, 160, 0.38)";
const CANVAS_UI_TEXT = "#f0f4f8";
const CANVAS_UI_MUTED = "#6b7a8d";
const CANVAS_UI_MUTED_SOFT = "rgba(107, 122, 141, 0.68)";
const CANVAS_UI_GOLD = "#00e5a0";
const CANVAS_UI_GOLD_BRIGHT = "#5dffc8";
const CANVAS_UI_GOLD_SOFT = "rgba(0, 229, 160, 0.14)";
const CANVAS_UI_SUCCESS = "#5dffc8";
const CANVAS_UI_DANGER = "#ff5f57";
const CANVAS_UI_SHADOW = "rgba(2, 2, 8, 0.9)";

function createEmptyDirectionalSprites(): DirectionalSprites {
  return {
    up: null,
    down: null,
    left: null,
    right: null,
    idle: { up: [], down: [], left: [], right: [] },
    walk: { up: [], down: [], left: [], right: [] },
    run: { up: [], down: [], left: [], right: [] },
    cast: { up: [], down: [], left: [], right: [] },
    attack: { up: [], down: [], left: [], right: [] },
    death: { up: [], down: [], left: [], right: [] },
  };
}

function createPlayerRecord<T>(factory: (playerId: PlayerId) => T): Record<PlayerId, T> {
  return {
    1: factory(1),
    2: factory(2),
    3: factory(3),
    4: factory(4),
  };
}

function createBooleanPlayerRecord(value: boolean): Record<PlayerId, boolean> {
  return createPlayerRecord(() => value);
}

function createNumberPlayerRecord(value: number): Record<PlayerId, number> {
  return createPlayerRecord(() => value);
}

type EndlessDeathStats = Readonly<{
  total: MatchScore;
  byCause: Record<OnlineDeathCause, MatchScore>;
}>;

function createEndlessDeathStats(stats?: OnlineEndlessStats | null): EndlessDeathStats {
  return {
    total: stats?.deaths ? { ...stats.deaths } : createNumberPlayerRecord(0),
    byCause: {
      self: stats?.selfDeaths ? { ...stats.selfDeaths } : createNumberPlayerRecord(0),
      opponent: stats?.opponentDeaths ? { ...stats.opponentDeaths } : createNumberPlayerRecord(0),
      "sudden-death": stats?.suddenDeathDeaths ? { ...stats.suddenDeathDeaths } : createNumberPlayerRecord(0),
      environment: stats?.environmentDeaths ? { ...stats.environmentDeaths } : createNumberPlayerRecord(0),
    },
  };
}

function createDirectionPlayerRecord(value: Direction | null): Record<PlayerId, Direction | null> {
  return createPlayerRecord(() => value);
}

function normalizeActivePlayerIds(playerIds: PlayerId[]): PlayerId[] {
  const unique = Array.from(new Set(playerIds.filter((playerId): playerId is PlayerId => (
    ALL_PLAYER_IDS as readonly number[]
  ).includes(playerId)))) as PlayerId[];
  return unique.length > 0 ? unique : [1, 2];
}

function createHeadlessCanvas(): {
  width: number;
  height: number;
  style: Record<string, string>;
  setAttribute: () => void;
  getContext: (_kind?: string) => CanvasRenderingContext2D;
} {
  const noop = () => undefined;
  const fakeContext = {
    setTransform: noop,
    clearRect: noop,
    fillRect: noop,
    strokeRect: noop,
    beginPath: noop,
    moveTo: noop,
    lineTo: noop,
    closePath: noop,
    stroke: noop,
    fill: noop,
    arc: noop,
    ellipse: noop,
    drawImage: noop,
    fillText: noop,
    strokeText: noop,
    save: noop,
    restore: noop,
    translate: noop,
    rotate: noop,
    createLinearGradient: () => ({ addColorStop: noop }),
  } as unknown as CanvasRenderingContext2D;
  fakeContext.imageSmoothingEnabled = false;
  return {
    width: CANVAS_WIDTH * CANVAS_BACKBUFFER_SCALE,
    height: CANVAS_HEIGHT * CANVAS_BACKBUFFER_SCALE,
    style: {},
    setAttribute: noop,
    getContext: () => fakeContext,
  };
}

interface MovementOption {
  direction: Direction;
  horizontal: boolean;
  laneTarget: number;
  canAdvanceForward: boolean;
  combinedMove: PixelCoord;
  laneOnlyMove: PixelCoord;
  forwardOnlyMove: PixelCoord;
  combinedFree: boolean;
  laneOnlyFree: boolean;
  forwardOnlyFree: boolean;
}

interface HudSkillSlot {
  type: SkillPowerUpType;
  level: number;
  acquired: boolean;
  keyLabel: string | null;
  valueLabel: string;
  recentlyCollected: boolean;
  pickupProgress: number;
}

interface HudPlayerStatus {
  label: string;
  tone: "success" | "danger" | "muted";
  critical: boolean;
  dangerEtaMs: number | null;
}

interface CrateBreakAnimation {
  tile: TileCoord;
  elapsedMs: number;
}

interface BombKickImpactFeedback {
  bombId: number;
  elapsedMs: number;
}

export interface ExplosionChainReactionFeedback {
  fromTile: TileCoord;
  toTile: TileCoord;
  elapsedMs: number;
}

export interface ExplosionFeedbackCell {
  x: number;
  y: number;
  width: number;
  height: number;
  style: NonNullable<FlameState["style"]>;
  remainingMs: number;
}

export interface ExplosionFeedbackConnector {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  style: NonNullable<FlameState["style"]>;
}

export interface ExplosionFeedbackReadModel {
  cells: ExplosionFeedbackCell[];
  connectors: ExplosionFeedbackConnector[];
  chainReactions: ExplosionChainReactionFeedback[];
}

export interface PlayerFlameOcclusionIndicator {
  playerId: PlayerId;
  ownerId: PlayerId | null;
  x: number;
  y: number;
  width: number;
  height: number;
  cornerLength: number;
  style: NonNullable<FlameState["style"]>;
  alpha: number;
}

export interface PlayerFlameOcclusionElimination {
  playerId: PlayerId;
  startedAtMs: number;
}

export function buildPlayerFlameOcclusionIndicators(
  flames: readonly Pick<FlameState, "tile" | "style" | "remainingMs" | "ownerId">[],
  players: readonly Pick<PlayerState, "id" | "tile" | "active" | "alive">[],
  eliminations: readonly PlayerFlameOcclusionElimination[],
  animationClockMs: number,
  prefersReducedMotion: boolean,
): PlayerFlameOcclusionIndicator[] {
  const recentlyEliminated = new Set(
    eliminations
      .filter(({ startedAtMs }) => {
        const elapsedMs = animationClockMs - startedAtMs;
        return elapsedMs >= 0 && elapsedMs <= PLAYER_FLAME_OCCLUSION_DEATH_WINDOW_MS;
      })
      .map(({ playerId }) => playerId),
  );
  const activeFlames = new Map(
    flames
      .filter((flame) => flame.remainingMs > 0)
      .map((flame) => [tileKey(flame.tile.x, flame.tile.y), flame]),
  );
  const pulse = prefersReducedMotion
    ? 0.5
    : 0.5 + Math.sin(animationClockMs / 120) * 0.5;
  const baseAlpha = 0.74 + pulse * 0.22;

  return players.flatMap((player) => {
    if (!player.active || (!player.alive && !recentlyEliminated.has(player.id))) {
      return [];
    }
    const flame = activeFlames.get(tileKey(player.tile.x, player.tile.y));
    if (!flame) {
      return [];
    }
    const fade = Math.min(1, flame.remainingMs / FLAME_DISSIPATE_TAIL_MS);
    return [{
      playerId: player.id,
      ownerId: flame.ownerId,
      x: player.tile.x * TILE_SIZE + PLAYER_FLAME_OCCLUSION_INSET_PX,
      y: player.tile.y * TILE_SIZE + PLAYER_FLAME_OCCLUSION_INSET_PX,
      width: TILE_SIZE - PLAYER_FLAME_OCCLUSION_INSET_PX * 2,
      height: TILE_SIZE - PLAYER_FLAME_OCCLUSION_INSET_PX * 2,
      cornerLength: PLAYER_FLAME_OCCLUSION_CORNER_PX,
      style: flame.style ?? "normal",
      alpha: prefersReducedMotion
        ? baseAlpha
        : Math.round(baseAlpha * fade * 1_000) / 1_000,
    }];
  });
}

export function buildExplosionFeedbackGeometry(
  flames: readonly Pick<FlameState, "tile" | "style" | "remainingMs">[],
): { cells: ExplosionFeedbackCell[]; connectors: ExplosionFeedbackConnector[] } {
  const normalized = flames.map((flame) => ({
    ...flame,
    style: flame.style ?? "normal",
  }));
  const byTile = new Map(normalized.map((flame) => [tileKey(flame.tile.x, flame.tile.y), flame]));
  const connectors: ExplosionFeedbackConnector[] = [];

  for (const flame of normalized) {
    for (const delta of [directionDelta.right, directionDelta.down]) {
      const neighbor = byTile.get(tileKey(flame.tile.x + delta.x, flame.tile.y + delta.y));
      if (!neighbor || neighbor.style !== flame.style) {
        continue;
      }
      connectors.push({
        fromX: flame.tile.x * TILE_SIZE + TILE_SIZE / 2,
        fromY: flame.tile.y * TILE_SIZE + TILE_SIZE / 2,
        toX: neighbor.tile.x * TILE_SIZE + TILE_SIZE / 2,
        toY: neighbor.tile.y * TILE_SIZE + TILE_SIZE / 2,
        style: flame.style,
      });
    }
  }

  return {
    cells: normalized.map((flame) => ({
      x: flame.tile.x * TILE_SIZE + EXPLOSION_FEEDBACK_INSET_PX,
      y: flame.tile.y * TILE_SIZE + EXPLOSION_FEEDBACK_INSET_PX,
      width: TILE_SIZE - EXPLOSION_FEEDBACK_INSET_PX * 2,
      height: TILE_SIZE - EXPLOSION_FEEDBACK_INSET_PX * 2,
      style: flame.style,
      remainingMs: flame.remainingMs,
    })),
    connectors,
  };
}

interface PowerUpPickupNotice {
  playerId: PlayerId;
  type: SkillPowerUpType;
  valueLabel: string;
  chainGuard: boolean;
  elapsedMs: number;
  remainingMs: number;
}

interface PlayerDeathAnimationState {
  startedAtMs: number;
  direction: Direction;
}

interface SuddenDeathClosureEffect extends SuddenDeathClosingTileState {}

interface ArenaRenderMetrics {
  scale: number;
  tileSize: number;
  arenaX: number;
  arenaY: number;
  arenaPixelWidth: number;
  arenaPixelHeight: number;
}

export interface LocalSessionReturnBrief {
  mode: LobbyMode;
  winner: PlayerId | null;
  winnerName: string | null;
  reason: RoundOutcome["reason"];
  roundNumber: number;
  scoreLine: string;
  matchComplete: boolean;
  finishedAtMs: number;
}

const LOCAL_SESSION_RETURN_BRIEF_STORAGE_KEY = "bomba-local-session-return-brief";
const LOCAL_SESSION_RETURN_BRIEF_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export class GameApp {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly input: InputController;
  private readonly root: HTMLElement;
  private readonly assets: GameAssets;
  private readonly headless: boolean;
  private onlineSession: OnlineSessionBridge | null = null;
  private activePlayerIds: PlayerId[] = [1, 2];
  private onlineLocalPlayerId: PlayerId = 1;
  private externalInputPlayers: Record<PlayerId, boolean> = createBooleanPlayerRecord(false);
  private customPlayerLabels: Record<PlayerId, string | null> = createPlayerRecord(() => null);
  private showWorldPlayerLabels = false;
  private hideNativeHud = false;
  private onlineInputs: Record<PlayerId, OnlineInputState> = createPlayerRecord(() => createNeutralOnlineInput());
  private onlineSnapshotCooldownMs = 0;
  private visualPlayerPositions: Record<PlayerId, PixelCoord> = createPlayerRecord(() => ({ x: 0, y: 0 }));
  private onlineRenderSamples: OnlineRenderSample[] = [];
  private onlineNextInputSeq = 0;
  private onlinePendingInputs: PendingOnlineInput[] = [];
  private onlineObservedRoundNumber: number | null = null;
  private onlineAudioPrimed = false;

  private lastTimestamp = 0;
  private accumulatorMs = 0;

  private baseArenaDefinition: ArenaDefinition = createDefaultArenaDefinition();
  private mode: Mode = "boot";
  private selectedCharacterIndex: Record<PlayerId, number> = createNumberPlayerRecord(0);
  private pendingCharacterIndex: Record<PlayerId, number> = createNumberPlayerRecord(0);
  private characterLocked: Record<PlayerId, boolean> = createBooleanPlayerRecord(true);
  private characterMenuOpen: Record<PlayerId, boolean> = createBooleanPlayerRecord(false);
  private arena: ArenaState = createArena();
  private players: Record<PlayerId, PlayerState> = this.createPlayers();
  private bombs: BombState[] = [];
  private flames: FlameState[] = [];
  private championWorldEffects: ChampionWorldEffect[] = [];
  private nextBombId = 1;

  private menuReady: Record<PlayerId, boolean> = createBooleanPlayerRecord(false);
  private matchResultChoice: Record<PlayerId, "rematch" | "lobby" | null> = createPlayerRecord(() => null);
  private score: MatchScore = { 1: 0, 2: 0, 3: 0, 4: 0 };
  private roundNumber = 1;
  private roundTimeMs = ROUND_DURATION_MS;
  private paused = false;
  private roundOutcome: RoundOutcome | null = null;
  private roundOutcomeMessage = "";
  private roundStartCueMs = 0;
  private matchWinner: PlayerId | null = null;
  private matchCycle: MatchCycle = createMatchCycle({
    mode: "classic",
    activePlayerIds: [1, 2],
    roundDurationMs: ROUND_DURATION_MS,
    roundEndDelayMs: ROUND_END_DELAY_MS,
    targetWins: TARGET_WINS,
  });
  private matchResultCooldownMs = 0;
  private autoPausedForHiddenTab = false;
  private onlineRoomMode: LobbyMode = "classic";
  private endlessKills: MatchScore = createNumberPlayerRecord(0);
  private endlessRoundWins: MatchScore = createNumberPlayerRecord(0);
  private endlessDeathStats: EndlessDeathStats = createEndlessDeathStats();
  private readonly automationMode = typeof navigator !== "undefined" ? navigator.webdriver : false;
  /** AIRI embeds the game in a sandboxed iframe, which can receive blur/hidden
   * events even while the widget is visibly open. Its bridge advances the
   * authoritative simulation explicitly, so the normal local-tab safety pause
   * must not stop an AIRI-controlled match.
   */
  private readonly airiEmbedMode = typeof window !== "undefined"
    && typeof window.location?.search === "string"
    && new URLSearchParams(window.location.search).get("airi") === "1";
  private automationControlledPlayer: PlayerId = 2;
  private localBotFill = 0;
  private botControlledPlayers: Record<PlayerId, boolean> = createBooleanPlayerRecord(false);
  private botDecisionPolicies: Partial<Record<PlayerId, BotDecisionPolicy>> = {};
  private botRuntimes: Partial<Record<PlayerId, BotRuntime>> = {};
  private botEnabled = false;
  private botDecisionObserver: ((measurement: BotDecisionMeasurement) => void) | null = null;
  /** Match-wide pacing rule preserved from the original bot engine. */
  private roomBotBombPlacementThrottleMs = 0;
  private botCommittedDirection: Record<PlayerId, Direction | null> = createDirectionPlayerRecord(null);
  private botPendingReverseDirection: Record<PlayerId, Direction | null> = createDirectionPlayerRecord(null);
  private botPendingReverseFrames: Record<PlayerId, number> = createNumberPlayerRecord(0);
  private animationClockMs = 0;
  private crateBreakAnimations: CrateBreakAnimation[] = [];
  private bombKickImpactFeedback: BombKickImpactFeedback[] = [];
  private chainReactionFeedback: ExplosionChainReactionFeedback[] = [];
  private readonly championVisuals = createChampionVisualRuntime();
  private readonly prefersReducedMotion = typeof window !== "undefined"
    && typeof window.matchMedia === "function"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  /** Presentation-only camera impact; not part of online simulation snapshots. */
  private screenShakeMs = 0;
  private screenShakeAmplitudePx = 0;
  private powerUpRevealStartedAtMs = new Map<PowerUpState, number>();
  private powerUpPickupNotices: PowerUpPickupNotice[] = [];
  private pickupChains: Record<PlayerId, PickupChainState> = createPlayerRecord(() => createPickupChainState());
  private playerDeathAnimations: Record<PlayerId, PlayerDeathAnimationState | null> = createPlayerRecord(() => null);
  private suddenDeathActive = false;
  private suddenDeathTickMs = SUDDEN_DEATH_TICK_MS;
  private suddenDeathIndex = 0;
  private suddenDeathPath: TileCoord[] = [];
  private suddenDeathClosedTiles = new Set<string>();
  private suddenDeathClosureEffects: SuddenDeathClosureEffect[] = [];
  private showDangerOverlay = false;
  private showBombPreview = false;
  private readonly characterRoster: CharacterRosterEntry[];
  private readonly characterSpriteCache = new Map<string, DirectionalSprites>();
  private readonly characterSpriteLoads = new Map<string, Promise<DirectionalSprites>>();
  private readonly spriteTrimCache = new SpriteTrimCache();
  private readonly soundManager = new SoundManager();
  private language: SiteLanguage = "pt";

  // ── Performance: offscreen caches ──
  private backdropCache: HTMLCanvasElement | null = null;
  private arenaStaticCache: HTMLCanvasElement | null = null;
  private arenaStaticDirty = true;
  private cachedDangerMap: Map<string, number> | null = null;
  private cachedBotDangerMap: Map<string, number> | null = null;
  private botDangerCacheActive = false;
  private labSafetyDangerMapClockMs = -1;
  private labSafetyDangerMap: Map<string, number> | null = null;
  private arenaStaticMistGradient: CanvasGradient | null = null;

  constructor(root: HTMLElement, assets: GameAssets, arenaDefinition: ArenaDefinition = createDefaultArenaDefinition()) {
    this.root = root;
    this.assets = assets;
    this.baseArenaDefinition = arenaDefinition;
    this.arena = createArena(this.baseArenaDefinition);
    this.headless = typeof document === "undefined" || typeof window === "undefined";

    if (this.headless) {
      const fakeCanvas = createHeadlessCanvas();
      this.canvas = fakeCanvas as unknown as HTMLCanvasElement;
      this.ctx = fakeCanvas.getContext("2d") as CanvasRenderingContext2D;
      this.input = new NoopInputManager();
    } else {
      this.canvas = document.createElement("canvas");
      this.canvas.width = CANVAS_WIDTH * CANVAS_BACKBUFFER_SCALE;
      this.canvas.height = CANVAS_HEIGHT * CANVAS_BACKBUFFER_SCALE;
      this.canvas.setAttribute("aria-label", "BOMBA game canvas");
      if ("dataset" in this.canvas && this.canvas.dataset) {
        this.canvas.dataset.gameCanvas = "true";
      } else {
        this.canvas.setAttribute("data-game-canvas", "true");
      }

      const ctx = this.canvas.getContext("2d");
      if (!ctx) {
        throw new Error("Canvas 2D context not available");
      }
      this.ctx = ctx;
      this.ctx.setTransform(CANVAS_BACKBUFFER_SCALE, 0, 0, CANVAS_BACKBUFFER_SCALE, 0, 0);
      this.ctx.imageSmoothingEnabled = false;
      this.input = new InputManager(window);
    }
    const configuredRoster = this.assets.characterRoster ?? [];
    const fallbackRoster: CharacterRosterEntry[] = [
      { id: "default-p1", name: "Default P1", size: null, sprites: this.assets.players[1] ?? createEmptyDirectionalSprites() },
      { id: "default-p2", name: "Default P2", size: null, sprites: this.assets.players[2] ?? createEmptyDirectionalSprites() },
    ];
    this.characterRoster = configuredRoster.length > 0
      ? configuredRoster
      : fallbackRoster;
    const playerOneIndex = this.findDefaultCharacterIndex(1, 0);
    const playerTwoIndex = this.findDefaultCharacterIndex(2, Math.min(1, this.characterRoster.length - 1));
    this.selectedCharacterIndex = {
      1: playerOneIndex,
      2: playerTwoIndex,
      3: this.findDefaultCharacterIndex(3, playerOneIndex),
      4: this.findDefaultCharacterIndex(4, playerTwoIndex),
    };
    this.pendingCharacterIndex = { ...this.selectedCharacterIndex };
    this.applyOfflineBotFill(this.automationMode ? 1 : 0, false);
    this.primeCharacterSprites();
  }

  private getArenaGridWidth(): number {
    return this.arena.config.grid.width;
  }

  private getArenaGridHeight(): number {
    return this.arena.config.grid.height;
  }

  private getArenaPixelWidth(): number {
    return this.getArenaGridWidth() * TILE_SIZE;
  }

  private getArenaPixelHeight(): number {
    return this.getArenaGridHeight() * TILE_SIZE;
  }

  private isFullscreenMatchLayoutActive(): boolean {
    if (this.headless || this.mode !== "match" || typeof document === "undefined") {
      return false;
    }
    const stage = this.canvas.closest(".experience-match__stage");
    return stage instanceof HTMLElement && stage.dataset.fullscreen === "true";
  }

  private getHudRenderHeight(): number {
    return this.isFullscreenMatchLayoutActive() ? FULLSCREEN_HUD_HEIGHT : HUD_HEIGHT;
  }

  private getArenaRenderMetrics(): ArenaRenderMetrics {
    const logicalArenaWidth = this.getArenaPixelWidth();
    const logicalArenaHeight = this.getArenaPixelHeight();
    const compactFullscreenLayout = this.isFullscreenMatchLayoutActive();
    const hudHeight = this.getHudRenderHeight();
    const playfieldPaddingX = compactFullscreenLayout ? 0 : 2;
    const playfieldTop = hudHeight + (compactFullscreenLayout ? 1 : 2);
    const playfieldBottom = CANVAS_HEIGHT - (compactFullscreenLayout ? 1 : 2);
    const availableWidth = Math.max(120, CANVAS_WIDTH - playfieldPaddingX * 2);
    const availableHeight = Math.max(120, playfieldBottom - playfieldTop);
    const widthScale = availableWidth / logicalArenaWidth;
    const heightScale = availableHeight / logicalArenaHeight;
    const maxScale = compactFullscreenLayout ? 2.24 : 2.08;
    const scale = Math.max(0.82, Math.min(maxScale, Math.min(widthScale, heightScale)));
    const arenaPixelWidth = logicalArenaWidth * scale;
    const arenaPixelHeight = logicalArenaHeight * scale;
    const arenaX = Math.round((CANVAS_WIDTH - arenaPixelWidth) / 2);
    const arenaY = Math.round(playfieldTop + (compactFullscreenLayout ? 1 : 2));
    return {
      scale,
      tileSize: TILE_SIZE * scale,
      arenaX,
      arenaY,
      arenaPixelWidth,
      arenaPixelHeight,
    };
  }

  private getArenaOffsetX(): number {
    return this.getArenaRenderMetrics().arenaX;
  }

  private getArenaOffsetY(): number {
    return this.getArenaRenderMetrics().arenaY;
  }

  private getPlayerSpawn(playerId: PlayerId) {
    return this.arena.config.spawnMap[playerId];
  }

  private createBotContext(dangerMap?: Map<string, number>): BotContext {
    return {
      players: this.players,
      activePlayerIds: this.activePlayerIds,
      bombs: this.bombs,
      flames: this.flames,
      arena: this.arena,
      suddenDeathActive: this.suddenDeathActive,
      suddenDeathTickMs: this.suddenDeathTickMs,
      suddenDeathIndex: this.suddenDeathIndex,
      suddenDeathPath: this.suddenDeathPath,
      suddenDeathClosureEffects: this.suddenDeathClosureEffects,
      roomBombPlacementThrottleMs: this.roomBotBombPlacementThrottleMs,
      botCommittedDirection: this.botCommittedDirection,
      botPendingReverseDirection: this.botPendingReverseDirection,
      botPendingReverseFrames: this.botPendingReverseFrames,
      dangerMap,
      canOccupyPosition: (_pos, _tile) => true,
      evaluateMovementOption: (player, dir, dt) => this.evaluateMovementOption(player, dir, dt),
      evaluateProjectedMovementOption: (player, dir, dt) => {
        const projectedBombEgressIds = getChampionProjectedMovementIgnoredBombIds(player);
        return this.evaluateMovementOption(player, dir, dt, projectedBombEgressIds, false, true);
      },
      projectSkillTarget: (player, dir) => projectChampionSkillTarget(player, dir, this.createSkillContext()),
      canMovementOptionAdvance: (pos, opt) => this.canMovementOptionAdvance(pos, opt),
      areOppositeDirections: (a, b) => this.areOppositeDirections(a, b),
      isPlayerOverlappingTile: (player, tile) => this.isPlayerOverlappingTile(player, tile),
    };
  }

  private createSkillContext(): SkillContext {
    return {
      arena: this.arena,
      bombs: this.bombs,
      players: this.players,
      activePlayerIds: this.activePlayerIds,
      addChampionWorldEffect: (effect) => {
        this.championWorldEffects.push(effect);
      },
      selectedCharacterIndex: this.selectedCharacterIndex,
      characterRoster: this.characterRoster,
      canOccupyPosition: (player, pos) => this.canOccupyPosition(
        player,
        pos,
        [],
        championSkillAllowsPlayerOverlap(player),
      ),
      getTileFromPosition: (pos) => this.getTileFromPosition(pos),
      normalizeArenaPosition: (pos) => this.normalizeArenaPosition(pos),
      getWrappedDelta: (target, current, size) => this.getWrappedDelta(target, current, size),
      resolveMovementDirection: (player, dir, dt, ignoredBombIds) => (
        this.resolveMovementDirection(player, dir, dt, ignoredBombIds, false, true)
      ),
      movePlayerSimulated: (player, dir, dt, ignoredBombIds) => (
        this.movePlayerSimulated(player, dir, dt, ignoredBombIds, false, true)
      ),
      isPositionOverlappingTile: (position, tile) => this.isProjectedPositionOverlappingTile(position, tile),
      clonePlayerState: (player) => this.clonePlayerState(player),
      tryAbsorbInstantHit: (player, attackerId) => this.tryAbsorbInstantHit(player, attackerId),
      breakCrateAtKey: (key) => this.breakCrateAtKey(key),
      addFlame: (tile, durationMs, style, ownerId) => this.addFlame(tile, durationMs, style, ownerId),
      soundManager: { playOneShot: (name: string) => this.soundManager.playOneShot(name as any) },
    };
  }

  public attachOnlineSession(session: OnlineSessionBridge): void {
    this.onlineSession = session;
    this.onlineRoomMode = "classic";
    this.customPlayerLabels = createPlayerRecord(() => null);
    this.activePlayerIds = [1, 2];
    this.localBotFill = 0;
    this.botControlledPlayers = createBooleanPlayerRecord(false);
    this.botDecisionPolicies = {};
    this.botRuntimes = {};
    this.botEnabled = false;
    this.botDecisionObserver = null;
    this.menuReady = createBooleanPlayerRecord(false);
    this.matchResultChoice = createPlayerRecord(() => null);
    this.matchResultCooldownMs = 0;
    this.onlineLocalPlayerId = 1;
    this.onlineInputs = createPlayerRecord(() => createNeutralOnlineInput());
    this.onlineNextInputSeq = 0;
    this.onlinePendingInputs = [];
    this.onlineObservedRoundNumber = null;
    this.onlineAudioPrimed = false;
    this.onlineRenderSamples = [];
    this.endlessKills = createNumberPlayerRecord(0);
    this.endlessRoundWins = createNumberPlayerRecord(0);
    this.endlessDeathStats = createEndlessDeathStats();
    this.syncPlayerLabels();
  }

  public startOnlineMatch(config: MatchStartConfig): void {
    this.onlineRoomMode = config.roomMode ?? "classic";
    this.baseArenaDefinition = config.arena;
    this.arena = createArena(this.baseArenaDefinition);
    this.activePlayerIds = normalizeActivePlayerIds(config.activePlayerIds);
    this.onlineLocalPlayerId = config.localPlayerId;
    this.customPlayerLabels = createPlayerRecord((playerId) => config.playerLabels?.[playerId] ?? null);
    this.onlineNextInputSeq = 0;
    this.onlinePendingInputs = [];
    this.onlineInputs = createPlayerRecord(() => createNeutralOnlineInput());
    this.onlineAudioPrimed = false;
    this.onlineRenderSamples = [];
    this.selectedCharacterIndex = { ...config.characterSelections };
    this.pendingCharacterIndex = { ...config.characterSelections };
    this.characterLocked = createBooleanPlayerRecord(true);
    this.characterMenuOpen = createBooleanPlayerRecord(false);
    this.matchResultChoice = createPlayerRecord(() => null);
    this.matchResultCooldownMs = 0;
    this.localBotFill = 0;
    this.botDecisionObserver = null;
    this.botDecisionPolicies = {};
    this.setBotPlayers(config.botPlayerIds ?? []);
    this.applyEndlessStats(null);

    if (config.role === "host") {
      this.startMatch();
      return;
    }
    this.soundManager.playOneShot("matchStart");
    this.mode = "match";
    this.score = this.onlineRoomMode === "endless"
      ? { ...this.endlessRoundWins }
      : createNumberPlayerRecord(0);
    this.roundNumber = 1;
    this.roundTimeMs = ROUND_DURATION_MS;
    this.matchWinner = null;
    this.paused = false;
    this.autoPausedForHiddenTab = false;
    this.roundOutcome = null;
    this.roundOutcomeMessage = "";
    this.replaceMatchCycleFromProjection();
    this.roundStartCueMs = ROUND_START_CUE_MS;
    this.menuReady = createBooleanPlayerRecord(false);
    for (const playerId of this.activePlayerIds) {
      this.menuReady[playerId] = true;
    }
  }

  public applyOnlineSnapshot(snapshot: OnlineGameSnapshot): void {
    const previousMode = this.mode;
    const previousRoundNumber = this.roundNumber;
    const previousRoundOutcome = this.roundOutcome;
    const previousSuddenDeathActive = this.suddenDeathActive;
    this.onlineRoomMode = snapshot.roomMode ?? "classic";
    this.baseArenaDefinition = snapshot.arena;
    this.playOnlineAudioTransition({
      bombs: snapshot.bombs,
      flames: snapshot.flames,
      players: snapshot.players,
      previousRoundOutcome: this.roundOutcome,
      roundOutcome: snapshot.roundOutcome,
      matchWinner: snapshot.matchWinner,
      previousSuddenDeathActive,
      suddenDeathActive: snapshot.suddenDeathActive,
      breakableTiles: snapshot.breakableTiles,
      powerUps: snapshot.powerUps,
    });
    if (this.onlineSession?.role === "guest" && this.onlineAudioPrimed) {
      this.spawnCrateBreakAnimationsFromDiff(snapshot.breakableTiles);
    }
    const baseArena = createArena(this.baseArenaDefinition);
    this.mode = snapshot.mode;
    this.suddenDeathClosedTiles = new Set(snapshot.suddenDeathClosedTiles ?? []);
    this.suddenDeathClosureEffects = (snapshot.suddenDeathClosingTiles ?? []).map((effect) => ({
      tile: { ...effect.tile },
      elapsedMs: effect.elapsedMs,
      impacted: effect.impacted,
    }));
    this.arena = {
      config: baseArena.config,
      solid: new Set([...baseArena.solid, ...this.suddenDeathClosedTiles]),
      breakable: new Set(snapshot.breakableTiles),
      powerUps: snapshot.powerUps.map((powerUp) => ({
        type: powerUp.type,
        tile: { ...powerUp.tile },
        revealed: powerUp.revealed,
        collected: powerUp.collected,
      })),
    };
    this.invalidateArenaCache();
    this.players = createPlayerRecord((playerId) => this.clonePlayerState(snapshot.players[playerId]));
    this.bombs = snapshot.bombs.map((bomb) => ({
      ...bomb,
      tile: { ...bomb.tile },
      bodyEgressPlayerIds: [...(bomb.bodyEgressPlayerIds ?? [])],
    }));
    this.flames = snapshot.flames.map((flame) => ({
      ...flame,
      tile: { ...flame.tile },
    }));
    this.championWorldEffects = (snapshot.magicBeams ?? []).map((beam) => ({
      kind: "nico-beam" as const,
      ...beam,
      origin: { ...beam.origin },
      tiles: beam.tiles.map((tile: { x: number; y: number }) => ({ ...tile })),
    }));
    this.nextBombId = snapshot.nextBombId;
    this.score = { ...snapshot.score };
    this.roundNumber = snapshot.roundNumber;
    this.roundTimeMs = snapshot.roundTimeMs;
    this.paused = snapshot.paused;
    this.autoPausedForHiddenTab = false;
    this.roundOutcome = snapshot.roundOutcome
      ? { ...snapshot.roundOutcome }
      : null;
    this.roundOutcomeMessage = snapshot.roundOutcome?.message ?? "";
    this.syncRoundStartCue(
      previousMode,
      previousRoundNumber,
      previousRoundOutcome,
      snapshot.mode,
      snapshot.roundNumber,
      this.roundOutcome,
    );
    this.matchWinner = snapshot.matchWinner;
    this.animationClockMs = snapshot.animationClockMs;
    this.suddenDeathActive = snapshot.suddenDeathActive;
    this.suddenDeathTickMs = snapshot.suddenDeathTickMs;
    this.suddenDeathIndex = snapshot.suddenDeathIndex;
    this.showDangerOverlay = snapshot.showDangerOverlay;
    this.showBombPreview = snapshot.showBombPreview;
    this.selectedCharacterIndex = { ...snapshot.selectedCharacterIndex };
    this.pendingCharacterIndex = { ...snapshot.selectedCharacterIndex };
    this.characterLocked = createBooleanPlayerRecord(true);
    this.characterMenuOpen = createBooleanPlayerRecord(false);
    this.activePlayerIds = normalizeActivePlayerIds(snapshot.activePlayerIds);
    this.localBotFill = 0;
    this.setBotPlayers(snapshot.botPlayerIds ?? []);
    this.matchResultChoice = createPlayerRecord(() => null);
    this.matchResultCooldownMs = 0;
    this.applyEndlessStats(snapshot.endlessStats);
    this.replaceMatchCycleFromProjection();
    this.syncRoundStartCue(
      previousMode,
      previousRoundNumber,
      previousRoundOutcome,
      snapshot.mode,
      snapshot.roundNumber,
      this.roundOutcome,
    );
    this.primeCharacterSprites();
    this.resetOnlineRoundBuffers(snapshot.roundNumber);
    this.pushOnlineRenderSample(snapshot.serverTimeMs, snapshot.serverTick, snapshot.players);
    this.nextBombId = snapshot.nextBombId;
    this.reconcileGuestState(snapshot.ackedInputSeq[this.onlineLocalPlayerId] ?? 0);

    if (previousMode !== "match" || this.visualPlayerPositions[this.onlineLocalPlayerId].x === 0) {
      this.syncVisualPlayerPositions();
    }
    this.onlineAudioPrimed = true;
  }

  public applyOnlineFrame(frame: OnlineGameFrame): void {
    const previousMode = this.mode;
    const previousRoundNumber = this.roundNumber;
    const previousRoundOutcome = this.roundOutcome;
    const previousSuddenDeathActive = this.suddenDeathActive;
    this.onlineRoomMode = frame.roomMode ?? "classic";
    this.playOnlineAudioTransition({
      bombs: frame.bombs,
      flames: frame.flames,
      players: frame.players,
      previousRoundOutcome: this.roundOutcome,
      roundOutcome: frame.roundOutcome,
      matchWinner: frame.matchWinner,
      previousSuddenDeathActive,
      suddenDeathActive: frame.suddenDeathActive,
    });
    this.mode = frame.mode;
    this.players = createPlayerRecord((playerId) => this.clonePlayerState(frame.players[playerId]));
    this.bombs = frame.bombs.map((bomb) => ({
      ...bomb,
      tile: { ...bomb.tile },
      bodyEgressPlayerIds: [...(bomb.bodyEgressPlayerIds ?? [])],
    }));
    this.flames = frame.flames.map((flame) => ({
      ...flame,
      tile: { ...flame.tile },
    }));
    this.championWorldEffects = (frame.magicBeams ?? []).map((beam) => ({
      kind: "nico-beam" as const,
      ...beam,
      origin: { ...beam.origin },
      tiles: beam.tiles.map((tile) => ({ ...tile })),
    }));
    this.score = { ...frame.score };
    this.roundNumber = frame.roundNumber;
    this.roundTimeMs = frame.roundTimeMs;
    this.paused = frame.paused;
    this.autoPausedForHiddenTab = false;
    this.roundOutcome = frame.roundOutcome ? { ...frame.roundOutcome } : null;
    this.roundOutcomeMessage = frame.roundOutcome?.message ?? "";
    this.syncRoundStartCue(
      previousMode,
      previousRoundNumber,
      previousRoundOutcome,
      frame.mode,
      frame.roundNumber,
      this.roundOutcome,
    );
    this.matchWinner = frame.matchWinner;
    this.animationClockMs = frame.animationClockMs;
    this.suddenDeathActive = frame.suddenDeathActive;
    this.suddenDeathTickMs = frame.suddenDeathTickMs;
    this.suddenDeathIndex = frame.suddenDeathIndex;
    this.suddenDeathClosedTiles = new Set(frame.suddenDeathClosedTiles ?? []);
    this.suddenDeathClosureEffects = (frame.suddenDeathClosingTiles ?? []).map((effect) => ({
      tile: { ...effect.tile },
      elapsedMs: effect.elapsedMs,
      impacted: effect.impacted,
    }));
    this.arena.solid = new Set([...this.arena.config.tiles.solid, ...this.suddenDeathClosedTiles]);
    this.selectedCharacterIndex = { ...frame.selectedCharacterIndex };
    this.pendingCharacterIndex = { ...frame.selectedCharacterIndex };
    this.activePlayerIds = normalizeActivePlayerIds(frame.activePlayerIds);
    this.localBotFill = 0;
    this.setBotPlayers(frame.botPlayerIds ?? []);
    this.nextBombId = frame.nextBombId;
    this.applyEndlessStats(frame.endlessStats);
    this.replaceMatchCycleFromProjection();
    this.syncRoundStartCue(
      previousMode,
      previousRoundNumber,
      previousRoundOutcome,
      frame.mode,
      frame.roundNumber,
      this.roundOutcome,
    );
    this.primeCharacterSprites();
    this.resetOnlineRoundBuffers(frame.roundNumber);
    this.pushOnlineRenderSample(frame.serverTimeMs, frame.serverTick, frame.players);
    this.reconcileGuestState(frame.ackedInputSeq[this.onlineLocalPlayerId] ?? 0);

    if (previousMode !== "match" || this.visualPlayerPositions[this.onlineLocalPlayerId].x === 0) {
      this.syncVisualPlayerPositions();
    }
    this.onlineAudioPrimed = true;
  }

  public clearOnlinePeer(): void {
    this.resetToLobbyState();
    this.onlineInputs = createPlayerRecord(() => createNeutralOnlineInput());
    this.onlineNextInputSeq = 0;
    this.onlinePendingInputs = [];
    this.onlineObservedRoundNumber = null;
    this.onlineAudioPrimed = false;
    this.onlineRenderSamples = [];
    this.botEnabled = false;
    this.onlineRoomMode = "classic";
  }

  private resetToLobbyState(): void {
    this.input.clearPresses();
    this.mode = "menu";
    this.activePlayerIds = [1, 2];
    this.onlineLocalPlayerId = 1;
    this.menuReady = createBooleanPlayerRecord(false);
    this.matchResultChoice = createPlayerRecord(() => null);
    this.matchResultCooldownMs = 0;
    this.score = { 1: 0, 2: 0, 3: 0, 4: 0 };
    this.endlessKills = createNumberPlayerRecord(0);
    this.endlessRoundWins = createNumberPlayerRecord(0);
    this.endlessDeathStats = createEndlessDeathStats();
    this.onlineRoomMode = "classic";
    this.roundNumber = 1;
    this.matchWinner = null;
    this.paused = false;
    this.autoPausedForHiddenTab = false;
    this.roundOutcome = null;
    this.roomBotBombPlacementThrottleMs = 0;
    this.botCommittedDirection = createDirectionPlayerRecord(null);
    this.botPendingReverseDirection = createDirectionPlayerRecord(null);
    this.botPendingReverseFrames = createNumberPlayerRecord(0);
    for (const runtime of Object.values(this.botRuntimes)) {
      runtime?.reset();
    }
    this.animationClockMs = 0;
    this.suddenDeathActive = false;
    this.suddenDeathTickMs = SUDDEN_DEATH_TICK_MS;
    this.suddenDeathIndex = 0;
    this.suddenDeathClosedTiles = new Set();
    this.suddenDeathClosureEffects = [];
    this.suddenDeathPath = this.buildSuddenDeathPath();
    this.onlineAudioPrimed = false;
    if (!this.onlineSession) {
      this.applyOfflineBotFill(this.localBotFill, false);
    } else {
      this.localBotFill = 0;
      this.botControlledPlayers = createBooleanPlayerRecord(false);
      this.botDecisionPolicies = {};
      this.botRuntimes = {};
      this.botEnabled = false;
    }
    this.resetRound(false);
  }

  private playOnlineAudioTransition(next: {
    bombs: BombState[];
    flames: FlameState[];
    players: Record<PlayerId, PlayerState>;
    previousRoundOutcome: RoundOutcome | null;
    roundOutcome: RoundOutcome | null;
    matchWinner: PlayerId | null;
    previousSuddenDeathActive: boolean;
    suddenDeathActive: boolean;
    breakableTiles?: string[];
    powerUps?: PowerUpState[];
  }): void {
    online_playAudioTransition({
      headless: this.headless,
      role: this.onlineSession?.role ?? null,
      audioPrimed: this.onlineAudioPrimed,
      localPlayerId: this.onlineLocalPlayerId,
      suppressLocalBombAudio: this.hasPendingLocalBombAudioSuppression(),
      previousBombs: this.bombs,
      previousFlames: this.flames,
      previousBreakableTiles: Array.from(this.arena.breakable),
      previousPlayers: this.players,
      previousMatchWinner: this.matchWinner,
      previousRoundOutcome: next.previousRoundOutcome,
      previousSuddenDeathActive: next.previousSuddenDeathActive,
      next,
      didCollectRemotePowerUp: (powerUps) => this.didCollectRemotePowerUp(powerUps, next.players),
      playSound: (name) => this.soundManager.playOneShot(name),
    });
  }

  private hasPendingLocalBombAudioSuppression(): boolean {
    if (!this.onlineSession || this.onlineSession.role !== "guest") {
      return false;
    }
    return this.onlinePendingInputs.some((pending) => pending.input.bombPressed);
  }

  private didCollectRemotePowerUp(
    nextPowerUps: PowerUpState[],
    nextPlayers: Record<PlayerId, PlayerState>,
  ): boolean {
    const previousCollected = new Set(
      this.arena.powerUps
        .filter((powerUp) => powerUp.collected)
        .map((powerUp) => `${powerUp.type}:${tileKey(powerUp.tile.x, powerUp.tile.y)}`),
    );
    const previousLocalTile = this.players[this.onlineLocalPlayerId]?.tile;
    const nextLocalTile = nextPlayers[this.onlineLocalPlayerId]?.tile;
    return nextPowerUps.some((powerUp) => (
      powerUp.collected
      && !previousCollected.has(`${powerUp.type}:${tileKey(powerUp.tile.x, powerUp.tile.y)}`)
      && (
        (previousLocalTile?.x === powerUp.tile.x && previousLocalTile.y === powerUp.tile.y)
        || (nextLocalTile?.x === powerUp.tile.x && nextLocalTile.y === powerUp.tile.y)
      )
    ));
  }

  private spawnCrateBreakAnimationsFromDiff(nextBreakableTiles: string[]): void {
    const nextBreakables = new Set(nextBreakableTiles);
    for (const key of this.arena.breakable) {
      if (!nextBreakables.has(key)) {
        this.addCrateBreakAnimation(this.parseTileKey(key));
      }
    }
  }

  public receiveOnlineGuestInput(input: OnlineInputState): void {
    this.onlineInputs[2] = mergeLatchedOnlineInput(this.onlineInputs[2], input);
  }

  public detachOnlineSession(): void {
    if (!this.onlineSession) {
      return;
    }
    this.onlineSession = null;
    this.customPlayerLabels = createPlayerRecord(() => null);
    this.clearOnlinePeer();
    this.mode = "menu";
    this.paused = false;
    this.autoPausedForHiddenTab = false;
  }

  public returnToMenu(): void {
    if (this.onlineSession) {
      this.detachOnlineSession();
      return;
    }
    this.resetToLobbyState();
    this.mode = "menu";
    this.paused = false;
    this.autoPausedForHiddenTab = false;
    if (!this.headless) {
      this.render();
    }
  }

  public removeServerPlayer(playerId: PlayerId): void {
    const player = this.players[playerId];
    if (!player) {
      return;
    }
    if (player.alive) {
      this.killPlayer(player);
    }
    player.active = false;
    player.alive = false;
    player.velocity = { x: 0, y: 0 };
    player.activeBombs = 0;
    this.botControlledPlayers[playerId] = false;
    delete this.botDecisionPolicies[playerId];
    delete this.botRuntimes[playerId];
    this.activePlayerIds = this.activePlayerIds.filter((id) => id !== playerId);
    this.matchCycle.dispatch({
      type: "set-active-players",
      activePlayerIds: this.activePlayerIds,
    });
    if (this.mode === "match" && !this.roundOutcome) {
      this.evaluateRoundState();
    }
  }

  public eliminateServerPlayer(playerId: PlayerId): void {
    const player = this.players[playerId];
    if (!player) {
      return;
    }
    this.killPlayer(player);
    if (this.mode === "match" && !this.roundOutcome) {
      this.evaluateRoundState();
    }
  }

  public setServerBotPlayers(botPlayerIds: PlayerId[]): void {
    this.setBotPlayers(botPlayerIds);
  }

  public setServerCharacterSelections(characterSelections: Record<PlayerId, number>): void {
    this.selectedCharacterIndex = { ...characterSelections };
    this.pendingCharacterIndex = { ...characterSelections };
    this.syncPlayerLabels();
    this.primeCharacterSprites();
  }

  public setServerPlayerLabels(playerLabels: Record<PlayerId, string>): void {
    this.customPlayerLabels = createPlayerRecord((playerId) => playerLabels[playerId] ?? null);
    this.syncPlayerLabels();
  }

  public start(): void {
    if (this.headless) {
      return;
    }
    const storage = this.getLocalStorage();
    // IMPORTANT: readStorageItem returns null when unset. Number(null) === 0, so
    // never coerce null/empty into a volume — that forced mute-by-volume for every
    // first-time (or cleared-storage) visitor.
    const rawVolume = this.readStorageItem(storage, AUDIO_VOLUME_STORAGE_KEY);
    if (rawVolume !== null && rawVolume.trim() !== "") {
      const storedVolume = Number(rawVolume);
      if (Number.isFinite(storedVolume)) {
        this.soundManager.setVolume(storedVolume);
      }
    }
    this.soundManager.setMuted(this.readStorageItem(storage, AUDIO_MUTED_STORAGE_KEY) === "true");
    void this.soundManager.loadSounds(SFX_MANIFEST);
    this.root.appendChild(this.canvas);
    this.syncCanvasDisplaySize();
    this.mode = "menu";
    this.registerWindowHooks();
    this.render();
    window.requestAnimationFrame(this.loop);
  }

  public getCurrentMode(): Mode {
    return this.mode;
  }

  public getLocalSessionReturnBrief(): LocalSessionReturnBrief | null {
    const storage = this.getLocalStorage();
    if (!storage) {
      return null;
    }

    let parsed: unknown;
    try {
      const raw = storage.getItem(LOCAL_SESSION_RETURN_BRIEF_STORAGE_KEY);
      if (!raw) {
        return null;
      }
      parsed = JSON.parse(raw);
    } catch {
      return null;
    }

    if (!this.isLocalSessionReturnBrief(parsed)) {
      return null;
    }

    if (Date.now() - parsed.finishedAtMs > LOCAL_SESSION_RETURN_BRIEF_MAX_AGE_MS) {
      return null;
    }

    return parsed;
  }

  public setLanguage(language: SiteLanguage): void {
    this.language = language;
    if (!this.headless) {
      this.render();
    }
  }

  public setAudioVolume(volume: number): void {
    this.soundManager.setVolume(volume);
    this.writeStorageItem(AUDIO_VOLUME_STORAGE_KEY, String(this.soundManager.getVolume()));
  }

  public setAudioMuted(muted: boolean): void {
    this.soundManager.setMuted(muted);
    this.writeStorageItem(AUDIO_MUTED_STORAGE_KEY, String(muted));
  }

  public getAudioSettings(): { volume: number; muted: boolean } {
    return { volume: this.soundManager.getVolume(), muted: this.soundManager.isMuted() };
  }

  public startOfflineBotMatch(
    botFill = 3,
    mode: LobbyMode = "classic",
    options: {
      botDecisionPolicies?: Partial<Record<PlayerId, BotDecisionPolicy>>;
      botCharacterSelections?: Partial<Record<PlayerId, number>>;
      playerLabels?: Partial<Record<PlayerId, string>>;
    } = {},
  ): void {
    if (this.onlineSession) {
      return;
    }
    this.customPlayerLabels = createPlayerRecord((playerId) => options.playerLabels?.[playerId] ?? null);
    this.onlineRoomMode = mode;
    this.mode = "menu";
    this.paused = false;
    this.roundOutcome = null;
    this.matchWinner = null;
    this.endlessKills = createNumberPlayerRecord(0);
    this.endlessRoundWins = createNumberPlayerRecord(0);
    this.endlessDeathStats = createEndlessDeathStats();
    this.botDecisionObserver = null;
    this.botDecisionPolicies = { ...options.botDecisionPolicies };
    this.applyOfflineBotFill(botFill, false);
    for (const playerId of this.activePlayerIds) {
      const characterIndex = options.botCharacterSelections?.[playerId];
      if (!this.isBotControlled(playerId) || characterIndex === undefined) continue;
      const normalizedIndex = this.wrapCharacterIndex(characterIndex);
      this.selectedCharacterIndex[playerId] = normalizedIndex;
      this.pendingCharacterIndex[playerId] = normalizedIndex;
      this.characterLocked[playerId] = true;
      this.characterMenuOpen[playerId] = false;
    }
    this.syncPlayerLabels();
    this.primeCharacterSprites();
    this.startMatch();
  }

  public setOfflinePreferredCharacter(characterIndex: number): void {
    if (this.onlineSession) {
      return;
    }
    const nextIndex = this.wrapCharacterIndex(characterIndex);
    this.selectedCharacterIndex[1] = nextIndex;
    this.pendingCharacterIndex[1] = nextIndex;
    this.characterLocked[1] = true;
    this.characterMenuOpen[1] = false;
    this.syncPlayerLabels();
    this.primeCharacterSprites();
  }

  private setBotPlayers(botPlayerIds: PlayerId[]): void {
    const nextBots = new Set(botPlayerIds);
    this.botControlledPlayers = createPlayerRecord((playerId) => (
      nextBots.has(playerId) && this.activePlayerIds.includes(playerId)
    ));
    this.botEnabled = ALL_PLAYER_IDS.some((playerId) => this.botControlledPlayers[playerId]);
    this.botRuntimes = Object.fromEntries(
      ALL_PLAYER_IDS
        .filter((playerId) => this.botControlledPlayers[playerId])
        .map((playerId) => [
          playerId,
          createBotRuntime(this.botDecisionPolicies[playerId] ?? botAI_getBotDecision),
        ]),
    );
    this.syncPlayerLabels();
  }

  private applyEndlessStats(stats: OnlineEndlessStats | null | undefined): void {
    this.endlessKills = stats ? { ...stats.kills } : createNumberPlayerRecord(0);
    this.endlessRoundWins = stats ? { ...stats.roundWins } : createNumberPlayerRecord(0);
    this.endlessDeathStats = createEndlessDeathStats(stats);
    if (this.onlineRoomMode === "endless") {
      this.score = { ...this.endlessRoundWins };
    }
  }

  private readonly loop = (timestamp: number): void => {
    if (this.lastTimestamp === 0) {
      this.lastTimestamp = timestamp;
    }
    const deltaMs = Math.min(50, timestamp - this.lastTimestamp);
    this.lastTimestamp = timestamp;
    this.accumulatorMs += deltaMs;

    while (this.accumulatorMs >= FIXED_STEP_MS) {
      this.update(FIXED_STEP_MS);
      this.accumulatorMs -= FIXED_STEP_MS;
    }

    this.updateVisualPlayerPositions(deltaMs);
    this.render();
    this.input.endFrame();
    window.requestAnimationFrame(this.loop);
  };

  private registerWindowHooks(): void {
    window.addEventListener("resize", this.syncCanvasDisplaySize);
    window.addEventListener("blur", this.handleWindowInactive);
    if (typeof document !== "undefined" && typeof document.addEventListener === "function") {
      document.addEventListener("visibilitychange", this.handleDocumentVisibilityChange);
    }
    this.soundManager.bindUnlock(window);
    window.render_game_to_text = () => this.renderGameToText();
    window.advanceTime = (ms: number) => {
      const steps = Math.max(1, Math.round(ms / FIXED_STEP_MS));
      for (let step = 0; step < steps; step += 1) {
        this.update(FIXED_STEP_MS);
      }
      this.render();
      this.input.endFrame();
    };
  }

  private readonly handleWindowInactive = (): void => {
    this.pauseLocalMatchForHiddenTab();
  };

  private readonly handleDocumentVisibilityChange = (): void => {
    if (typeof document !== "undefined" && document.visibilityState === "hidden") {
      this.pauseLocalMatchForHiddenTab();
    }
  };

  private pauseLocalMatchForHiddenTab(): void {
    if (this.airiEmbedMode || this.onlineSession || this.mode !== "match" || this.roundOutcome || this.paused) {
      return;
    }
    this.paused = true;
    this.autoPausedForHiddenTab = true;
    this.input.clearPresses();
    this.render();
  }

  /** Resume only a pause caused by the browser hiding or blurring the tab.
   * Manual Escape pauses remain respected by the external controller.
   */
  public resumeAiriMatch(): void {
    if (this.mode !== "match" || !this.autoPausedForHiddenTab) {
      return;
    }
    this.paused = false;
    this.autoPausedForHiddenTab = false;
    this.render();
  }

  private readonly syncCanvasDisplaySize = (): void => {
    if (this.headless || typeof window === "undefined") {
      return;
    }
    if (!("style" in this.canvas)) {
      return;
    }
    const viewport = this.canvas.parentElement;
    const viewportWidth = viewport?.clientWidth
      ?? (typeof window.innerWidth === "number" ? window.innerWidth : CANVAS_WIDTH + CANVAS_VIEWPORT_PADDING);
    const viewportHeight = viewport?.clientHeight
      ?? (typeof window.innerHeight === "number" ? window.innerHeight : CANVAS_HEIGHT + CANVAS_VIEWPORT_PADDING);
    const metrics = this.getArenaRenderMetrics();
    const compactFullscreenLayout = this.isFullscreenMatchLayoutActive();
    const hudHeight = this.getHudRenderHeight();
    const viewportPadding = viewport ? (compactFullscreenLayout ? 2 : 6) : CANVAS_VIEWPORT_PADDING;
    const availableWidth = Math.max(160, viewportWidth - viewportPadding);
    const availableHeight = Math.max(160, viewportHeight - viewportPadding);
    const contentHeight = Math.max(hudHeight + 8, metrics.arenaY + metrics.arenaPixelHeight + (compactFullscreenLayout ? 4 : 8));
    const fitScale = Math.min(availableWidth / CANVAS_WIDTH, availableHeight / contentHeight);
    const displayScale = Math.max(compactFullscreenLayout ? 0.66 : 0.5, fitScale);
    const displayWidth = Math.max(1, Math.round(CANVAS_WIDTH * displayScale));
    const displayHeight = Math.max(1, Math.round(CANVAS_HEIGHT * displayScale));
    this.canvas.style.width = `${displayWidth}px`;
    this.canvas.style.height = `${displayHeight}px`;
    this.canvas.style.justifySelf = "center";
    this.canvas.style.alignSelf = compactFullscreenLayout ? "center" : "start";
  };

  private captureOnlineLocalInput(): void {
    if (!this.onlineSession || this.externalInputPlayers[this.onlineLocalPlayerId]) {
      return;
    }
    const localBindings = KEY_BINDINGS[1];
    const input = this.onlineInputs[this.onlineLocalPlayerId];
    online_captureLocalInput(
      input,
      this.input.getDirectionFromCodes(LOCAL_PLAYER_MOVEMENT_BINDINGS),
      this.input.consumePress(localBindings.bomb),
      this.input.consumePress(localBindings.detonate),
      this.input.consumePress(SKILL_KEY),
      this.input.isDown(SKILL_KEY),
    );
  }

  private forwardGuestInput(): void {
    if (this.onlineSession?.role !== "guest") {
      return;
    }
    const nextInput = cloneOnlineInputState(this.onlineInputs[this.onlineLocalPlayerId]);
    const inputSeq = this.onlineNextInputSeq + 1;
    this.onlineNextInputSeq = inputSeq;
    this.onlineSession.sendGuestInput(nextInput, inputSeq);
    appendPendingOnlineInput(this.onlinePendingInputs, { seq: inputSeq, input: nextInput });
  }

  private flushOnlineSnapshot(deltaMs: number): void {
    if (
      this.onlineSession?.role !== "host"
      || (this.mode !== "match" && this.mode !== "match-result")
    ) {
      this.onlineSnapshotCooldownMs = 0;
      return;
    }
    this.onlineSnapshotCooldownMs -= deltaMs;
    if (this.onlineSnapshotCooldownMs > 0) {
      return;
    }
    this.onlineSnapshotCooldownMs = ONLINE_SNAPSHOT_INTERVAL_MS;
    this.onlineSession.sendHostSnapshot(this.createOnlineSnapshot());
  }

  private createOnlineSnapshot(): OnlineGameSnapshot {
    return {
      mode: this.mode,
      roomMode: this.onlineRoomMode,
      arena: buildArenaRuntimeConfig(this.baseArenaDefinition),
      serverTimeMs: 0,
      serverTick: 0,
      frameId: 0,
      ackedInputSeq: createNumberPlayerRecord(0),
      breakableTiles: Array.from(this.arena.breakable),
      powerUps: this.arena.powerUps.map((powerUp) => ({
        type: powerUp.type,
        tile: { ...powerUp.tile },
        revealed: powerUp.revealed,
        collected: powerUp.collected,
      })),
      players: createPlayerRecord((playerId) => this.clonePlayerState(this.players[playerId])),
      bombs: this.bombs.map((bomb) => ({
        ...bomb,
        tile: { ...bomb.tile },
        bodyEgressPlayerIds: [...(bomb.bodyEgressPlayerIds ?? [])],
      })),
      flames: this.flames.map((flame) => ({
        ...flame,
        tile: { ...flame.tile },
      })),
      magicBeams: this.championWorldEffects.filter(isNicoBeamEffect).map((beam) => ({
        ownerId: beam.ownerId,
        origin: { ...beam.origin },
        direction: beam.direction,
        tiles: beam.tiles.map((tile) => ({ ...tile })),
        remainingMs: beam.remainingMs,
      })),
      nextBombId: this.nextBombId,
      score: { ...this.score },
      roundNumber: this.roundNumber,
      roundTimeMs: this.roundTimeMs,
      paused: this.paused,
      roundOutcome: this.roundOutcome ? { ...this.roundOutcome } : null,
      matchWinner: this.matchWinner,
      animationClockMs: this.animationClockMs,
      suddenDeathActive: this.suddenDeathActive,
      suddenDeathTickMs: this.suddenDeathTickMs,
      suddenDeathIndex: this.suddenDeathIndex,
      suddenDeathClosedTiles: Array.from(this.suddenDeathClosedTiles),
      suddenDeathClosingTiles: this.suddenDeathClosureEffects.map((effect) => ({
        tile: { ...effect.tile },
        elapsedMs: effect.elapsedMs,
        impacted: effect.impacted,
      })),
      showDangerOverlay: this.showDangerOverlay,
      showBombPreview: this.showBombPreview,
      selectedCharacterIndex: { ...this.selectedCharacterIndex },
      activePlayerIds: [...this.activePlayerIds],
      botPlayerIds: ALL_PLAYER_IDS.filter((playerId) => this.isBotControlled(playerId)),
      endlessStats: this.onlineRoomMode === "endless"
        ? {
          kills: { ...this.endlessKills },
          roundWins: { ...this.endlessRoundWins },
          deaths: { ...this.endlessDeathStats.total },
          selfDeaths: { ...this.endlessDeathStats.byCause.self },
          opponentDeaths: { ...this.endlessDeathStats.byCause.opponent },
          suddenDeathDeaths: { ...this.endlessDeathStats.byCause["sudden-death"] },
          environmentDeaths: { ...this.endlessDeathStats.byCause.environment },
        }
        : null,
    };
  }

  private clonePlayerState(player: PlayerState): PlayerState {
    const skill = player.skill ?? createDefaultPlayerSkillState(this.getPlayerSkillId(player.id));
    return {
      ...player,
      tile: { ...player.tile },
      position: { ...player.position },
      velocity: { ...player.velocity },
      skill: {
        ...skill,
        projectedPosition: skill.projectedPosition ? { ...skill.projectedPosition } : null,
        projectedBombEgressIds: [...(skill.projectedBombEgressIds ?? [])],
      },
    };
  }

  private update(deltaMs: number): void {
    if (this.onlineSession?.role === "guest") {
      this.updateVisualEffects(deltaMs);
      if (this.mode === "match") {
        this.updateRoundStartCue(deltaMs);
        if (!this.headless) {
          this.captureOnlineLocalInput();
        }
        this.forwardGuestInput();
        this.updateGuestLocalPrediction(deltaMs);
      } else if (this.mode === "match-result") {
        this.updateMatchResult(deltaMs);
      }
      return;
    }

    if (this.onlineSession && !this.headless) {
      this.captureOnlineLocalInput();
    }

    switch (this.mode) {
      case "menu":
        this.updateMenu();
        break;
      case "match":
        this.updateMatch(deltaMs);
        break;
      case "match-result":
        this.updateMatchResult(deltaMs);
        break;
      default:
        break;
    }

    if (this.onlineSession?.role === "host") {
      this.flushOnlineSnapshot(deltaMs);
    }
  }

  public startServerAuthoritativeMatch(
    activePlayerIds: PlayerId[],
    characterSelections: Record<PlayerId, number>,
    options: {
      arena?: ArenaDefinition;
      roomMode?: LobbyMode;
      botPlayerIds?: PlayerId[];
      botDecisionPolicies?: Partial<Record<PlayerId, BotDecisionPolicy>>;
      botDecisionObserver?: (measurement: BotDecisionMeasurement) => void;
      endlessStats?: OnlineEndlessStats | null;
      playerLabels?: Record<PlayerId, string>;
      showWorldPlayerLabels?: boolean;
      hideNativeHud?: boolean;
    } = {},
  ): void {
    this.onlineSession = {
      role: "host",
      roomCode: "server",
      sendGuestInput: (_input: OnlineInputState, _inputSeq: number) => undefined,
      sendHostSnapshot: () => undefined,
      sendMatchResultChoice: () => false,
    };
    this.onlineRoomMode = options.roomMode ?? "classic";
    this.baseArenaDefinition = options.arena ?? this.baseArenaDefinition;
    this.arena = createArena(this.baseArenaDefinition);
    this.activePlayerIds = normalizeActivePlayerIds(activePlayerIds);
    this.onlineLocalPlayerId = 1;
    this.externalInputPlayers = createBooleanPlayerRecord(false);
    this.onlineInputs = createPlayerRecord(() => createNeutralOnlineInput());
    this.onlineNextInputSeq = 0;
    this.onlinePendingInputs = [];
    this.onlineObservedRoundNumber = null;
    this.onlineRenderSamples = [];
    this.selectedCharacterIndex = { ...characterSelections };
    this.pendingCharacterIndex = { ...characterSelections };
    this.customPlayerLabels = createPlayerRecord((playerId) => options.playerLabels?.[playerId] ?? null);
    this.showWorldPlayerLabels = options.showWorldPlayerLabels ?? false;
    this.hideNativeHud = options.hideNativeHud ?? false;
    this.characterLocked = createBooleanPlayerRecord(true);
    this.characterMenuOpen = createBooleanPlayerRecord(false);
    this.localBotFill = 0;
    this.botDecisionObserver = options.botDecisionObserver ?? null;
    this.botDecisionPolicies = { ...options.botDecisionPolicies };
    this.setBotPlayers(options.botPlayerIds ?? []);
    this.applyEndlessStats(options.endlessStats);
    this.primeCharacterSprites();
    this.startMatch();
  }

  public setServerPlayerInput(playerId: PlayerId, input: OnlineInputState): void {
    this.externalInputPlayers[playerId] = true;
    this.onlineInputs[playerId] = mergeLatchedOnlineInput(this.onlineInputs[playerId], input);
  }

  public replaceServerPlayerInput(playerId: PlayerId, input: OnlineInputState): void {
    this.externalInputPlayers[playerId] = true;
    this.onlineInputs[playerId] = cloneOnlineInputState(input);
  }

  public getServerSafetyInput(playerId: PlayerId, intendedInput: OnlineInputState): OnlineInputState | null {
    const player = this.players[playerId];
    if (!player?.active || !player.alive || this.mode !== "match" || this.roundOutcome) {
      return null;
    }

    const dangerMap = this.getLabSafetyDangerMap();
    const botContext = this.createBotContext(dangerMap);
    const currentTile = this.getTileFromPosition(player.position);
    const currentKey = tileKey(currentTile.x, currentTile.y);
    const moveDurationMs = this.getMoveDuration(player);
    const currentDangerMs = dangerMap.get(currentKey);
    const overlappingBomb = this.bombs.some((bomb) => (
      bomb.tile.x === currentTile.x && bomb.tile.y === currentTile.y
    ));
    let intendedDangerMs: number | undefined;
    if (intendedInput.direction) {
      const delta = directionDelta[intendedInput.direction];
      const intendedTile = this.normalizeTile({
        x: currentTile.x + delta.x,
        y: currentTile.y + delta.y,
      });
      intendedDangerMs = dangerMap.get(tileKey(intendedTile.x, intendedTile.y));
    }

    const currentTileThreatened = currentDangerMs !== undefined
      && currentDangerMs <= moveDurationMs * 2 + 140;
    const intendedTileThreatened = intendedDangerMs !== undefined
      && intendedDangerMs <= moveDurationMs + 140;
    const unsafeBombPulse = intendedInput.bombPressed
      && !botAI_canSafelyPlaceBomb(player, botContext);
    if (!overlappingBomb && !currentTileThreatened && !intendedTileThreatened && !unsafeBombPulse) {
      return null;
    }

    const safetyDirection = overlappingBomb || currentTileThreatened
      ? botAI_getSafetyDecision(player, botContext).direction
      : intendedTileThreatened ? null : intendedInput.direction;
    return {
      direction: safetyDirection,
      bombPressed: false,
      detonatePressed: false,
      skillPressed: false,
      skillHeld: false,
    };
  }

  public clearServerPlayerInput(playerId: PlayerId): void {
    this.externalInputPlayers[playerId] = true;
    this.onlineInputs[playerId] = createNeutralOnlineInput();
  }

  public advanceServerSimulation(deltaMs: number): void {
    const steps = Math.max(1, Math.round(deltaMs / FIXED_STEP_MS));
    for (let step = 0; step < steps; step += 1) {
      this.update(FIXED_STEP_MS);
    }
    this.input.endFrame();
  }

  public exportOnlineSnapshot(): OnlineGameSnapshot {
    return this.createOnlineSnapshot();
  }

  public getExplosionFeedbackReadModel(): ExplosionFeedbackReadModel {
    const geometry = buildExplosionFeedbackGeometry(this.flames);
    return {
      ...geometry,
      chainReactions: this.chainReactionFeedback.map((effect) => ({
        fromTile: { ...effect.fromTile },
        toTile: { ...effect.toTile },
        elapsedMs: effect.elapsedMs,
      })),
    };
  }

  private syncVisualPlayerPositions(): void {
    this.visualPlayerPositions = createPlayerRecord((playerId) => this.getPlayerPixelPositionFromState(this.players[playerId]));
  }

  private pushOnlineRenderSample(
    serverTimeMs: number,
    serverTick: number,
    players: Record<PlayerId, PlayerState>,
  ): void {
    online_pushRenderSample(
      this.onlineRenderSamples,
      this.headless,
      serverTimeMs,
      serverTick,
      players,
      (player) => this.getPlayerPixelPositionFromState(player),
    );
  }

  private updateGuestLocalPrediction(deltaMs: number): void {
    if (!this.onlineSession || this.onlineSession.role !== "guest" || this.mode !== "match" || this.paused || this.roundOutcome) {
      return;
    }

    const localId = this.onlineLocalPlayerId;
    const player = this.players[localId];
    if (!player || !player.alive) {
      return;
    }
    this.simulatePlayerInputStep(
      player,
      {
        direction: this.getMovementDirection(localId),
        bombPressed: this.consumeOnlineBombPress(localId),
        detonatePressed: this.consumeOnlineDetonatePress(localId),
        skillPressed: this.consumeOnlineSkillPress(localId),
        skillHeld: this.isSkillHeld(localId),
      },
      deltaMs,
    );
  }

  private reconcileGuestState(ackedInputSeq: number): void {
    if (!this.onlineSession || this.onlineSession.role !== "guest") {
      return;
    }
    if (this.mode !== "match") {
      this.onlinePendingInputs = [];
      return;
    }

    this.onlinePendingInputs = this.onlinePendingInputs.filter((pending) => pending.seq > ackedInputSeq);
    const localPlayer = this.players[this.onlineLocalPlayerId];
    if (!localPlayer || !localPlayer.alive) {
      return;
    }

    let suppressFirstPendingSkillReplay = localPlayer.skill.phase !== "idle";
    for (const pending of this.onlinePendingInputs) {
      const predictedInput = suppressFirstPendingSkillReplay && pending.input.skillPressed
        ? {
            ...pending.input,
            skillPressed: false,
          }
        : pending.input;
      if (suppressFirstPendingSkillReplay && pending.input.skillPressed) {
        suppressFirstPendingSkillReplay = false;
      }
      this.applyPredictedInputStep(localPlayer, predictedInput, FIXED_STEP_MS);
    }
  }

  private resetOnlineRoundBuffers(roundNumber: number): void {
    if (!this.onlineSession) {
      return;
    }
    if (this.onlineObservedRoundNumber === roundNumber) {
      return;
    }
    this.onlineObservedRoundNumber = roundNumber;
    this.onlinePendingInputs = [];
    this.onlineRenderSamples = [];
    this.onlineInputs = createPlayerRecord(() => createNeutralOnlineInput());
    this.syncVisualPlayerPositions();
  }

  private applyPredictedInputStep(player: PlayerState, input: OnlineInputState, deltaMs: number): void {
    this.simulatePlayerInputStep(player, input, deltaMs, false);
  }

  private simulatePlayerInputStep(
    player: PlayerState,
    input: OnlineInputState,
    deltaMs: number,
    playAudio = true,
  ): boolean {
    player.spawnProtectionMs = Math.max(0, player.spawnProtectionMs - deltaMs);
    player.flameGuardMs = Math.max(0, player.flameGuardMs - deltaMs);
    player.breakawayBoostMs = Math.max(0, (player.breakawayBoostMs ?? 0) - deltaMs);
    player.pickupSprintMs = Math.max(0, (player.pickupSprintMs ?? 0) - deltaMs);
    this.updatePerfectStartBurst(player, input.direction, deltaMs);
    this.syncPlayerSkill(player);
    this.advancePlayerSkillTimers(player, deltaMs);

    if (input.skillPressed) {
      this.activatePlayerSkill(player, input.direction);
    }

    if (this.updatePlayerSkillChannel(player, input.direction, input.skillPressed, Boolean(input.skillHeld), deltaMs)) {
      player.tile = this.getTileFromPosition(player.position);
      this.ejectPlayerFromBlockedTerrain(player);
      return false;
    }

    let placedBomb = false;
    if (input.bombPressed) {
      placedBomb = this.placeBomb(player, playAudio);
    }
    if (input.detonatePressed) {
      this.triggerRemoteDetonation(player);
    }

    if (input.direction) {
      const actualDirection = this.resolveMovementDirection(player, input.direction, deltaMs);
      player.direction = actualDirection;
      this.movePlayer(player, actualDirection, deltaMs);
    } else {
      player.velocity.x = 0;
      player.velocity.y = 0;
    }
    player.tile = this.getTileFromPosition(player.position);
    this.ejectPlayerFromBlockedTerrain(player);
    return placedBomb;
  }

  private syncPlayerSkill(player: PlayerState): void {
    skill_syncPlayerSkill(player, this.createSkillContext(), (playerId) => this.getPlayerSkillId(playerId));
  }

  private advancePlayerSkillTimers(player: PlayerState, deltaMs: number): void {
    skill_advancePlayerSkillTimers(player, deltaMs);
  }

  private activatePlayerSkill(player: PlayerState, desiredDirection: Direction | null): void {
    skill_activatePlayerSkill(player, desiredDirection, this.createSkillContext());
  }

  private updatePlayerSkillChannel(
    player: PlayerState,
    desiredDirection: Direction | null,
    skillPressed: boolean,
    skillHeld: boolean,
    deltaMs: number,
  ): boolean {
    return this.championVisuals.updateSkillChannel(
      player, desiredDirection, skillPressed, skillHeld, deltaMs,
      (subject, direction, pressed, held, elapsedMs) => skill_updatePlayerSkillChannel(
        subject, direction, pressed, held, elapsedMs, this.createSkillContext(),
      ),
    );
  }

  private isPlayerImmuneDuringSkillChannel(player: PlayerState): boolean {
    return skill_isPlayerImmuneDuringSkillChannel(player);
  }

  private updateVisualPlayerPositions(deltaMs: number): void {
    online_updateVisualPlayerPositions({
      headless: this.headless,
      hasSession: Boolean(this.onlineSession),
      activePlayerIds: this.activePlayerIds,
      onlineLocalPlayerId: this.onlineLocalPlayerId,
      players: this.players,
      visualPlayerPositions: this.visualPlayerPositions,
      onlineRenderSamples: this.onlineRenderSamples,
      deltaMs,
      getPlayerPixelPositionFromState: (player) => this.getPlayerPixelPositionFromState(player),
    });
  }

  private updateMenu(): void {
    if (this.onlineSession) {
      return;
    }

    if (this.input.consumePress(LOCAL_BOT_CYCLE_KEY)) {
      this.applyOfflineBotFill((this.localBotFill + 1) % (MAX_LOCAL_BOT_FILL + 1));
    }

    if (this.input.consumePress(LOCAL_BOT_TOGGLE_KEY)) {
      this.applyOfflineBotFill(this.localBotFill > 0 ? 0 : 1);
    }

    this.handleCharacterSelectionInput();
    if (this.isAnyCharacterMenuOpen()) {
      return;
    }

    for (const playerId of this.activePlayerIds) {
      if (this.isBotControlled(playerId)) {
        this.menuReady[playerId] = true;
      }
    }

    if (this.automationMode && this.input.consumePress("Enter")) {
      this.menuReady = createBooleanPlayerRecord(false);
      for (const playerId of this.activePlayerIds) {
        this.menuReady[playerId] = true;
      }
    }
    this.handleReadyInput(this.menuReady);
    if (this.activePlayerIds.every((playerId) => this.menuReady[playerId])) {
      this.startMatch();
    }
  }

  private updateMatch(deltaMs: number): void {
    if (!this.roundOutcome && this.input.consumePress("Escape")) {
      this.paused = !this.paused;
      this.autoPausedForHiddenTab = false;
    }

    if (!this.onlineSession) {
      this.handleCharacterSelectionInput();
      if (this.isAnyCharacterMenuOpen()) {
        return;
      }
    }

    if (this.automationMode) {
      if (this.input.consumePress("KeyA")) {
        this.automationControlledPlayer = 1;
      }
      if (this.input.consumePress("KeyB")) {
        this.automationControlledPlayer = 2;
      }
    }

    if (this.paused) {
      return;
    }

    if (this.roundOutcome) {
      const events = this.matchCycle.dispatch({ type: "tick", deltaMs });
      this.syncMatchCycleProjection();
      this.handleMatchCycleEvents(events);
      return;
    }

    this.updateRoundStartCue(deltaMs);
    const cycleEvents = this.matchCycle.dispatch({ type: "tick", deltaMs });
    this.syncMatchCycleProjection();
    this.animationClockMs += deltaMs;
    this.updateVisualEffects(deltaMs);
    if (cycleEvents.length > 0) {
      this.handleMatchCycleEvents(cycleEvents);
      return;
    }

    this.updateSuddenDeath(deltaMs);
    this.roomBotBombPlacementThrottleMs = Math.max(
      0,
      this.roomBotBombPlacementThrottleMs - deltaMs,
    );
    this.updatePlayers(deltaMs);
    this.updateBombs(deltaMs);
    this.resolvePlayerDeathsFromFlames();
    this.updateFlames(deltaMs);
    this.collectPowerUps();
    this.evaluateRoundState();

    // Cache danger map so render doesn't need to recompute it
    if (this.showDangerOverlay) {
      this.cachedDangerMap = this.getDangerMap();
    } else {
      this.cachedDangerMap = null;
    }

  }

  private updateMatchResult(deltaMs: number): void {
    if (this.onlineSession) {
      return;
    }

    if (this.handleLocalMatchResultInput()) {
      return;
    }

    if (!this.headless) {
      return;
    }

    this.matchResultCooldownMs = Math.max(0, this.matchResultCooldownMs - deltaMs);
    if (this.matchResultCooldownMs > 0) {
      return;
    }

    if (this.activePlayerIds.length >= 2) {
      this.startMatch();
      return;
    }
    this.returnToMenu();
  }

  private handleLocalMatchResultInput(): boolean {
    if (this.input.consumePress("Escape")) {
      this.matchResultChoice[1] = "lobby";
      this.returnToMenu();
      return true;
    }

    if (this.input.consumePress("Enter") || this.input.consumePress("Space")) {
      this.matchResultChoice[1] = "rematch";
      this.startMatch();
      return true;
    }

    return false;
  }

  private handleReadyInput(readyState: Record<PlayerId, boolean>): void {
    for (const playerId of MENU_PLAYER_IDS) {
      if (!this.activePlayerIds.includes(playerId)) {
        continue;
      }
      if (this.isBotControlled(playerId)) {
        continue;
      }
      if (this.input.consumePress(KEY_BINDINGS[playerId].ready)) {
        readyState[playerId] = !readyState[playerId];
      }
    }
  }

  private handleCharacterSelectionInput(): void {
    for (const id of MENU_PLAYER_IDS) {
      if (!this.input.consumePress(CHARACTER_MENU_KEYS[id])) {
        continue;
      }
      const opening = !this.characterMenuOpen[id];
      this.characterMenuOpen[id] = opening;
      if (opening) {
        this.pendingCharacterIndex[id] = this.selectedCharacterIndex[id];
        this.characterLocked[id] = false;
      }
    }

    for (const id of MENU_PLAYER_IDS) {
      if (!this.characterMenuOpen[id]) {
        continue;
      }
      if (this.input.consumePress(KEY_BINDINGS[id].up)) {
        this.cycleCharacterSelection(id, -1);
      }
      if (this.input.consumePress(KEY_BINDINGS[id].down)) {
        this.cycleCharacterSelection(id, 1);
      }
      if (this.input.consumePress(KEY_BINDINGS[id].ready)) {
        this.lockCharacterSelection(id);
      }
    }
  }

  private cycleCharacterSelection(playerId: PlayerId, delta: number): void {
    const total = this.characterRoster.length;
    if (total <= 0) {
      return;
    }
    const current = this.pendingCharacterIndex[playerId];
    this.pendingCharacterIndex[playerId] = (current + delta + total) % total;
  }

  private lockCharacterSelection(playerId: PlayerId): void {
    this.selectedCharacterIndex[playerId] = this.pendingCharacterIndex[playerId];
    this.characterLocked[playerId] = true;
    this.characterMenuOpen[playerId] = false;
  }

  private isAnyCharacterMenuOpen(): boolean {
    return MENU_PLAYER_IDS.some((playerId) => this.characterMenuOpen[playerId]);
  }

  private applyOfflineBotFill(botFill: number, preserveP1Ready = true): void {
    if (this.onlineSession) {
      return;
    }
    const nextFill = Math.max(0, Math.min(MAX_LOCAL_BOT_FILL, Math.floor(botFill)));
    this.localBotFill = nextFill;
    const nextActivePlayerIds: PlayerId[] = nextFill === 0
      ? [1, 2]
      : ([1, ...ALL_PLAYER_IDS.slice(1, 1 + nextFill)] as PlayerId[]);
    this.activePlayerIds = normalizeActivePlayerIds(nextActivePlayerIds);
    const botPlayerIds = nextFill > 0
      ? this.activePlayerIds.filter((playerId) => playerId !== 1)
      : [];
    this.setBotPlayers(botPlayerIds);
    const nextReady = createBooleanPlayerRecord(false);
    nextReady[1] = preserveP1Ready ? this.menuReady[1] : false;
    for (const playerId of this.activePlayerIds) {
      if (playerId !== 1 && this.isBotControlled(playerId)) {
        nextReady[playerId] = true;
      }
    }
    this.menuReady = nextReady;
    this.matchResultChoice = createPlayerRecord(() => null);
    this.matchResultCooldownMs = 0;
    this.syncPlayerLabels();
  }

  private startMatch(): void {
    // Prevent queued key presses from previous screens leaking into active gameplay.
    this.input.clearPresses();
    this.soundManager.playOneShot("matchStart");
    this.menuReady = createBooleanPlayerRecord(false);
    this.matchResultChoice = createPlayerRecord(() => null);
    this.matchResultCooldownMs = 0;
    this.score = this.onlineRoomMode === "endless"
      ? { ...this.endlessRoundWins }
      : { 1: 0, 2: 0, 3: 0, 4: 0 };
    this.roundNumber = 1;
    this.roundTimeMs = ROUND_DURATION_MS;
    this.matchWinner = null;
    this.roundOutcome = null;
    this.roundOutcomeMessage = "";
    this.replaceMatchCycleFromProjection();
    this.resetRound();
    this.mode = "match";
  }

  private replaceMatchCycleFromProjection(): void {
    const cycle = createMatchCycle({
      mode: this.onlineRoomMode,
      activePlayerIds: this.activePlayerIds,
      roundDurationMs: ROUND_DURATION_MS,
      roundEndDelayMs: ROUND_END_DELAY_MS,
      targetWins: TARGET_WINS,
    });
    cycle.restore({
      roundNumber: this.roundNumber,
      roundTimeMs: this.roundTimeMs,
      score: this.score,
      outcome: this.roundOutcome
        ? {
          winner: this.roundOutcome.winner,
          reason: this.roundOutcome.reason,
          countdownMs: Math.max(0, this.roundOutcome.countdownMs),
        }
        : null,
      matchWinner: this.matchWinner,
    });
    this.matchCycle = cycle;
  }

  private syncMatchCycleProjection(snapshot: MatchCycleSnapshot = this.matchCycle.snapshot()): void {
    this.score = { ...snapshot.score };
    this.roundNumber = snapshot.roundNumber;
    this.roundTimeMs = snapshot.roundTimeMs;
    this.matchWinner = snapshot.matchWinner;
    if (!snapshot.outcome) {
      this.roundOutcome = null;
      this.roundOutcomeMessage = "";
      return;
    }
    this.roundOutcome = {
      ...snapshot.outcome,
      message: this.roundOutcomeMessage,
    };
  }

  private handleMatchCycleEvents(events: readonly MatchCycleEvent[]): void {
    for (const event of events) {
      if (event.type === "round-timer-expired") {
        this.finishRound(null, "timer", "Clock hit zero. Draw round.");
        continue;
      }
      if (event.type === "round-started") {
        if (this.onlineRoomMode === "endless") {
          this.endlessRoundWins = { ...this.score };
        }
        this.input.clearPresses();
        this.resetRound();
        continue;
      }
      if (event.type === "match-finished") {
        this.matchResultChoice = createPlayerRecord(() => null);
        this.matchResultCooldownMs = MATCH_RESULT_RESTART_DELAY_MS;
        this.input.clearPresses();
        this.mode = "match-result";
      }
    }
  }

  private resetRound(showStartCue = true): void {
    this.arena = createArena(this.baseArenaDefinition);
    this.invalidateArenaCache();
    this.players = this.createPlayers();
    this.bombs = [];
    this.flames = [];
    this.championWorldEffects = [];
    this.crateBreakAnimations = [];
    this.chainReactionFeedback = [];
    this.championVisuals.reset();
    this.screenShakeMs = 0;
    this.screenShakeAmplitudePx = 0;
    this.powerUpRevealStartedAtMs.clear();
    this.powerUpPickupNotices = [];
    this.pickupChains = createPlayerRecord(() => createPickupChainState());
    this.playerDeathAnimations = createPlayerRecord(() => null);
    this.nextBombId = 1;
    this.roundTimeMs = ROUND_DURATION_MS;
    this.roundOutcome = null;
    this.roundOutcomeMessage = "";
    this.roundStartCueMs = showStartCue ? ROUND_START_CUE_MS : 0;
    this.paused = false;
    this.autoPausedForHiddenTab = false;
    this.roomBotBombPlacementThrottleMs = 0;
    this.botCommittedDirection = createDirectionPlayerRecord(null);
    this.botPendingReverseDirection = createDirectionPlayerRecord(null);
    this.botPendingReverseFrames = createNumberPlayerRecord(0);
    for (const runtime of Object.values(this.botRuntimes)) {
      runtime?.reset();
    }
    this.animationClockMs = 0;
    this.suddenDeathActive = false;
    this.suddenDeathTickMs = SUDDEN_DEATH_TICK_MS;
    this.suddenDeathIndex = 0;
    this.suddenDeathClosedTiles = new Set();
    this.suddenDeathClosureEffects = [];
    this.suddenDeathPath = this.buildSuddenDeathPath();
    if (this.mode === "match") {
      this.replaceMatchCycleFromProjection();
    }
  }

  private createPlayers(): Record<PlayerId, PlayerState> {
    const players = createPlayerRecord((playerId) => {
      const spawn = this.getPlayerSpawn(playerId);
      const name = this.customPlayerLabels[playerId]
        || (this.isBotControlled(playerId) ? "BOT" : `P${playerId}`);
      return this.createPlayer(playerId, name, spawn.tile, spawn.direction, this.activePlayerIds.includes(playerId));
    });
    this.visualPlayerPositions = createPlayerRecord((playerId) => this.getPlayerPixelPositionFromState(players[playerId]));
    return players;
  }

  private syncPlayerLabels(): void {
    for (const playerId of ALL_PLAYER_IDS) {
      this.players[playerId].name = this.customPlayerLabels[playerId]
        || (this.isBotControlled(playerId) ? "BOT" : `P${playerId}`);
    }
  }

  private getCharacterEntry(index: number): CharacterRosterEntry {
    const entryBySelectionIndex = this.characterRoster.find((entry) => entry.selectionIndex === index);
    if (entryBySelectionIndex) {
      return entryBySelectionIndex;
    }
    const total = this.characterRoster.length;
    const normalized = ((index % total) + total) % total;
    return this.characterRoster[normalized];
  }

  private findDefaultCharacterIndex(playerId: PlayerId, fallbackIndex: number): number {
    const configuredIndex = this.characterRoster.findIndex((entry) => entry.defaultSlot === playerId);
    if (configuredIndex >= 0) {
      return configuredIndex;
    }
    return fallbackIndex;
  }

  private wrapCharacterIndex(index: number): number {
    const total = Math.max(1, this.characterRoster.length);
    return ((index % total) + total) % total;
  }

  private getActiveCharacterEntry(playerId: PlayerId): CharacterRosterEntry {
    return this.getCharacterEntry(this.selectedCharacterIndex[playerId]);
  }

  private getPreviewCharacterEntry(playerId: PlayerId): CharacterRosterEntry {
    const index = this.characterMenuOpen[playerId]
      ? this.pendingCharacterIndex[playerId]
      : this.selectedCharacterIndex[playerId];
    return this.getCharacterEntry(index);
  }

  private getPlayerSprites(playerId: PlayerId): DirectionalSprites {
    const entry = this.getActiveCharacterEntry(playerId);
    if (entry.sprites) {
      return entry.sprites;
    }
    void this.loadCharacterSprites(entry);
    return this.characterSpriteCache.get(entry.id) ?? this.getFallbackSpritesForEntry(entry);
  }

  private getFallbackSpritesForEntry(entry: CharacterRosterEntry): DirectionalSprites {
    const fallbackSlot = entry.defaultSlot ?? 1;
    return this.assets.players[fallbackSlot]
      ?? this.assets.players[1]
      ?? createEmptyDirectionalSprites();
  }

  private loadCharacterSprites(entry: CharacterRosterEntry): Promise<DirectionalSprites> {
    if (entry.sprites) {
      this.characterSpriteCache.set(entry.id, entry.sprites);
      return Promise.resolve(entry.sprites);
    }

    const loadedSprites = this.characterSpriteCache.get(entry.id);
    if (loadedSprites) {
      return Promise.resolve(loadedSprites);
    }

    const pendingLoad = this.characterSpriteLoads.get(entry.id);
    if (pendingLoad) {
      return pendingLoad;
    }

    const load = this.assets.characterSpriteLoader(entry)
      .then((sprites) => {
        this.characterSpriteCache.set(entry.id, sprites);
        return sprites;
      })
      .catch((error) => {
        this.characterSpriteLoads.delete(entry.id);
        throw error;
      });
    this.characterSpriteLoads.set(entry.id, load);
    return load;
  }

  private primeCharacterSprites(): void {
    for (const playerId of ALL_PLAYER_IDS) {
      void this.loadCharacterSprites(this.getActiveCharacterEntry(playerId));
    }
  }

  private getPlayerSkillId(playerId: PlayerId): CharacterSkillId | null {
    return getCharacterSkillId(this.getActiveCharacterEntry(playerId).id);
  }

  private getCharacterLabel(playerId: PlayerId, maxLength = 18): string {
    return this.shortenCharacterName(this.getActiveCharacterEntry(playerId).name, maxLength);
  }

  private getPlayerSlotLabel(playerId: PlayerId): string {
    return this.customPlayerLabels[playerId]
      || (this.isBotControlled(playerId) ? "BOT" : `P${playerId}`);
  }

  private shortenCharacterName(name: string, maxLength = 30): string {
    return ellipsisText(name, maxLength);
  }

  /** Local seat for HUD "YOU" panel (online guest, automation, or P1). */
  private getMatchLocalPlayerId(): PlayerId {
    if (this.onlineSession) {
      return this.onlineLocalPlayerId;
    }
    if (this.automationMode) {
      return this.automationControlledPlayer;
    }
    return 1;
  }

  private createPlayer(
    id: PlayerId,
    name: string,
    tile: TileCoord,
    direction: Direction,
    active: boolean,
  ): PlayerState {
    const center = this.getTileCenter(tile);
    return {
      id,
      name,
      active,
      tile: { ...tile },
      position: center,
      velocity: { x: 0, y: 0 },
      alive: active,
      direction,
      lastMoveDirection: null,
      maxBombs: 1,
      activeBombs: 0,
      flameRange: 1,
      speedLevel: 0,
      remoteLevel: 0,
      shieldCharges: 0,
      bombPassLevel: 0,
      kickLevel: 0,
      shortFuseLevel: 0,
      flameGuardMs: 0,
      spawnProtectionMs: SPAWN_PROTECTION_MS,
      perfectStartWindowMs: PERFECT_START_WINDOW_MS,
      perfectStartBoostMs: 0,
      breakawayBoostMs: 0,
      pickupSprintMs: 0,
      skill: createDefaultPlayerSkillState(null),
    };
  }

  private updatePlayers(deltaMs: number): void {
    this.cachedBotDangerMap = null;
    this.botDangerCacheActive = true;
    try {
      for (const id of this.activePlayerIds) {
        const player = this.players[id];
        if (!player.alive) {
          continue;
        }

        const botDecision = this.isBotControlled(id) ? this.getBotDecision(player) : null;
        const automationBomb = this.automationMode
          ? this.automationControlledPlayer === id && this.input.consumePress("Space")
          : false;
        const onlineBomb = this.consumeOnlineBombPress(id);
        const nativeBindings = MENU_PLAYER_IDS.includes(id as MenuPlayerId)
          ? KEY_BINDINGS[id as MenuPlayerId]
          : null;
        const nativeBomb = this.shouldUseNativeControls()
          ? nativeBindings ? this.input.consumePress(nativeBindings.bomb) : false
          : false;
        const wantsBomb = botDecision?.placeBomb || automationBomb || nativeBomb || onlineBomb;
        const wantsDetonate = botDecision?.detonate
          || this.consumeOnlineDetonatePress(id)
          || (this.shouldUseNativeControls()
            ? nativeBindings ? this.input.consumePress(nativeBindings.detonate) : false
            : false);
        const nativeSkillPressed = this.shouldUseNativeControls() && nativeBindings
          ? this.input.consumePress(nativeBindings.skill)
          : false;
        const modelSkillPressed = botDecision?.skillAction === "release"
          ? Boolean(botDecision.useSkill) && (player.skill.phase === "channeling" || player.skill.phase === "releasing")
          : Boolean(botDecision?.useSkill);
        const wantsSkill = modelSkillPressed
          || this.consumeOnlineSkillPress(id)
          || (nativeSkillPressed
            && !this.isBotControlled(id)
            && (!this.automationMode || this.automationControlledPlayer === id));
        const skillHeld = botDecision?.skillHeld ?? this.isSkillHeld(id);

        const desiredDirection = botDecision?.direction ?? this.getMovementDirection(id);
        const direction = this.isBotControlled(id)
          ? this.getStableBotDirection(player, desiredDirection, deltaMs)
          : desiredDirection;
        const placedBomb = this.simulatePlayerInputStep(
          player,
          {
            direction,
            bombPressed: wantsBomb,
            detonatePressed: wantsDetonate,
            skillPressed: wantsSkill,
            skillHeld,
          },
          deltaMs,
        );
        if (this.isBotControlled(id) && direction && player.skill.phase !== "channeling") {
          this.rememberBotDirection(id, player.direction);
        }
        if (placedBomb && botDecision?.placeBomb && this.isBotControlled(id)) {
          this.roomBotBombPlacementThrottleMs = BOT_BOMB_COOLDOWN_MS;
        }
      }
    } finally {
      this.botDangerCacheActive = false;
      this.cachedBotDangerMap = null;
    }
  }

  private getMovementDirection(id: PlayerId): Direction | null {
    if (this.isBotControlled(id)) {
      return null;
    }
    if (this.onlineSession) {
      const input = this.onlineInputs[id];
      if (input) {
        return input.direction;
      }
    }
    if (this.automationMode) {
      if (this.automationControlledPlayer === id) {
        return this.input.getMovementDirection(2) ?? this.input.getMovementDirection(1);
      }
      return null;
    }
    if (MENU_PLAYER_IDS.includes(id as MenuPlayerId)) {
      return this.input.getMovementDirection(id as MenuPlayerId);
    }
    return null;
  }

  private isSkillHeld(id: PlayerId): boolean {
    if (this.isBotControlled(id)) {
      return false;
    }
    if (this.onlineSession) {
      return Boolean(this.onlineInputs[id]?.skillHeld);
    }
    if (this.automationMode) {
      return this.automationControlledPlayer === id
        && MENU_PLAYER_IDS.includes(id as MenuPlayerId)
        && this.input.isDown(KEY_BINDINGS[id as MenuPlayerId].skill);
    }
    if (!this.shouldUseNativeControls() || !MENU_PLAYER_IDS.includes(id as MenuPlayerId)) {
      return false;
    }
    return this.input.isDown(KEY_BINDINGS[id as MenuPlayerId].skill);
  }

  private isBotControlled(id: PlayerId): boolean {
    return Boolean(this.botControlledPlayers?.[id]) && this.activePlayerIds.includes(id);
  }

  private shouldUseNativeControls(): boolean {
    if (this.onlineSession) {
      return false;
    }
    return true;
  }

  private consumeOnlineBombPress(id: PlayerId): boolean {
    return consumeLatchedOnlinePress(Boolean(this.onlineSession), this.onlineInputs[id], "bombPressed");
  }

  private consumeOnlineDetonatePress(id: PlayerId): boolean {
    return consumeLatchedOnlinePress(Boolean(this.onlineSession), this.onlineInputs[id], "detonatePressed");
  }

  private consumeOnlineSkillPress(id: PlayerId): boolean {
    return consumeLatchedOnlinePress(Boolean(this.onlineSession), this.onlineInputs[id], "skillPressed");
  }

  private getBotDecision(player: PlayerState): BotDecision {
    const startedAtMs = monotonicNow();
    const context = this.createBotContext(this.getSharedBotDangerMap());
    const runtime = this.botRuntimes[player.id]
      ?? createBotRuntime(this.botDecisionPolicies[player.id] ?? botAI_getBotDecision);
    this.botRuntimes[player.id] = runtime;
    const decision = runtime.decide(player, context);
    this.botDecisionObserver?.({
      playerId: player.id,
      decision,
      computeMs: Math.max(0, monotonicNow() - startedAtMs),
    });
    return decision;
  }

  private getSharedBotDangerMap(): Map<string, number> {
    if (!this.botDangerCacheActive) {
      return botAI_buildDangerMap(this.createBotContext());
    }
    if (!this.cachedBotDangerMap) {
      this.cachedBotDangerMap = botAI_buildDangerMap(this.createBotContext());
    }
    return this.cachedBotDangerMap;
  }

  private getLabSafetyDangerMap(): Map<string, number> {
    if (this.labSafetyDangerMapClockMs !== this.animationClockMs || !this.labSafetyDangerMap) {
      this.labSafetyDangerMapClockMs = this.animationClockMs;
      this.labSafetyDangerMap = botAI_buildDangerMap(this.createBotContext());
    }
    return this.labSafetyDangerMap;
  }

  private getOldestOwnedBomb(playerId: PlayerId): BombState | null {
    let selectedBomb: BombState | null = null;
    for (const bomb of this.bombs) {
      if (bomb.ownerId !== playerId) {
        continue;
      }
      if (!selectedBomb || bomb.id < selectedBomb.id) {
        selectedBomb = bomb;
      }
    }
    return selectedBomb;
  }

  private getDangerMap(extraBomb?: ProjectedBomb): Map<string, number> {
    return buildDangerMap(this.createBotContext(), extraBomb);
  }

  private getBombBlastKeys(origin: TileCoord, range: number): Set<string> {
    return projectBombBlastKeys(origin, range, this.arena);
  }

  private getMoveDuration(player: PlayerState): number {
    return Math.max(MIN_MOVE_MS, BASE_MOVE_MS - player.speedLevel * SPEED_STEP_MS);
  }

  private getMoveSpeed(player: PlayerState): number {
    const speed = TILE_SIZE / (this.getMoveDuration(player) / 1000);
    const hasSpeedBoost = (
      (player.perfectStartBoostMs ?? 0) > 0
      || (player.breakawayBoostMs ?? 0) > 0
      || (player.pickupSprintMs ?? 0) > 0
    );
    if (hasSpeedBoost) {
      return speed * PERFECT_START_SPEED_MULTIPLIER;
    }
    return this.hasDangerAdrenalineStep(player)
      ? speed * DANGER_ADRENALINE_SPEED_MULTIPLIER
      : speed;
  }

  private hasDangerAdrenalineStep(player: PlayerState): boolean {
    if (
      !player.alive
      || player.spawnProtectionMs > 0
      || player.flameGuardMs > 0
      || this.isPlayerImmuneDuringSkillChannel(player)
    ) {
      return false;
    }
    const tile = this.getTileFromPosition(player.position);
    const etaMs = this.getDangerMap().get(tileKey(tile.x, tile.y));
    return etaMs !== undefined && etaMs > 0 && etaMs <= DANGER_ADRENALINE_ETA_MS;
  }

  private updatePerfectStartBurst(player: PlayerState, direction: Direction | null, deltaMs: number): void {
    const windowMs = Math.max(0, player.perfectStartWindowMs ?? 0);
    const boostMs = Math.max(0, player.perfectStartBoostMs ?? 0);

    if (direction && windowMs > 0 && boostMs <= 0) {
      player.perfectStartWindowMs = 0;
      player.perfectStartBoostMs = PERFECT_START_BOOST_MS;
      return;
    }

    player.perfectStartWindowMs = Math.max(0, windowMs - deltaMs);
    player.perfectStartBoostMs = Math.max(0, boostMs - deltaMs);
  }

  private getStableBotDirection(
    player: PlayerState,
    desiredDirection: Direction | null,
    deltaMs: number,
  ): Direction | null {
    return botAI_getStableBotDirection(
      player,
      desiredDirection,
      deltaMs,
      this.createBotContext(this.getSharedBotDangerMap()),
    );
  }

  private rememberBotDirection(playerId: PlayerId, direction: Direction): void {
    if (this.botCommittedDirection[playerId] === direction) {
      return;
    }
    this.botCommittedDirection[playerId] = direction;
  }

  private normalizeTileAxis(value: number, size: number): number {
    const wrapped = value % size;
    return wrapped < 0 ? wrapped + size : wrapped;
  }

  private normalizeTile(tile: TileCoord): TileCoord {
    return {
      x: this.normalizeTileAxis(tile.x, this.getArenaGridWidth()),
      y: this.normalizeTileAxis(tile.y, this.getArenaGridHeight()),
    };
  }

  private normalizeAxisPosition(value: number, span: number): number {
    const wrapped = value % span;
    return wrapped < 0 ? wrapped + span : wrapped;
  }

  private normalizeArenaPosition(position: PixelCoord): PixelCoord {
    return {
      x: this.normalizeAxisPosition(position.x, this.getArenaPixelWidth()),
      y: this.normalizeAxisPosition(position.y, this.getArenaPixelHeight()),
    };
  }

  private getWrappedDelta(current: number, previous: number, span: number): number {
    let delta = current - previous;
    if (delta > span * 0.5) {
      delta -= span;
    } else if (delta < -span * 0.5) {
      delta += span;
    }
    return delta;
  }

  private positionChanged(from: PixelCoord, to: PixelCoord): boolean {
    return (
      Math.abs(this.getWrappedDelta(to.x, from.x, this.getArenaPixelWidth())) > 0.01
      || Math.abs(this.getWrappedDelta(to.y, from.y, this.getArenaPixelHeight())) > 0.01
    );
  }

  private canMovementOptionAdvance(from: PixelCoord, option: MovementOption): boolean {
    return (
      (option.combinedFree && this.positionChanged(from, option.combinedMove))
      || (option.laneOnlyFree && this.positionChanged(from, option.laneOnlyMove))
      || (option.forwardOnlyFree && this.positionChanged(from, option.forwardOnlyMove))
    );
  }

  private resolveMovementDirection(
    player: PlayerState,
    desiredDirection: Direction,
    deltaMs: number,
    ignoredBombIds: readonly number[] = [],
    allowBodyBombEgress = true,
    allowProjectedBombEgress = false,
  ): Direction {
    const desiredOption = this.evaluateMovementOption(
      player,
      desiredDirection,
      deltaMs,
      ignoredBombIds,
      allowBodyBombEgress,
      allowProjectedBombEgress,
    );
    const desiredCanMove = this.canMovementOptionAdvance(player.position, desiredOption);

    const lastDirection = player.lastMoveDirection;
    if (!lastDirection || lastDirection === desiredDirection || !this.arePerpendicular(lastDirection, desiredDirection)) {
      return desiredDirection;
    }

    if (desiredCanMove) {
      return desiredDirection;
    }

    const continueOption = this.evaluateMovementOption(
      player,
      lastDirection,
      deltaMs,
      ignoredBombIds,
      allowBodyBombEgress,
      allowProjectedBombEgress,
    );
    const continueAdvances = this.canMovementOptionAdvance(player.position, continueOption);

    return continueAdvances ? lastDirection : desiredDirection;
  }

  private evaluateMovementOption(
    player: PlayerState,
    direction: Direction,
    deltaMs: number,
    ignoredBombIds: readonly number[] = [],
    allowBodyBombEgress = true,
    allowProjectedBombEgress = false,
  ): MovementOption {
    const delta = directionDelta[direction];
    const step = this.getMoveSpeed(player) * (deltaMs / 1000);
    const horizontal = delta.x !== 0;
    const laneTarget = horizontal
      ? this.getNearestLaneCenter(player.position.y)
      : this.getNearestLaneCenter(player.position.x);
    const laneDistance = horizontal
      ? Math.abs(laneTarget - player.position.y)
      : Math.abs(laneTarget - player.position.x);

    let nextX = player.position.x;
    let nextY = player.position.y;
    const canAdvanceForward = laneDistance <= LANE_LOCK_THRESHOLD;

    if (horizontal) {
      if (laneDistance <= LANE_SNAP_THRESHOLD) {
        nextY = this.approach(player.position.y, laneTarget, step * LANE_SNAP_FACTOR);
      }
      if (canAdvanceForward) {
        nextX += delta.x * step;
      }
    } else {
      if (laneDistance <= LANE_SNAP_THRESHOLD) {
        nextX = this.approach(player.position.x, laneTarget, step * LANE_SNAP_FACTOR);
      }
      if (canAdvanceForward) {
        nextY += delta.y * step;
      }
    }

    const combinedMove = this.normalizeArenaPosition({ x: nextX, y: nextY });
    const laneOnlyMove = this.normalizeArenaPosition(horizontal
      ? { x: player.position.x, y: nextY }
      : { x: nextX, y: player.position.y });
    const forwardOnlyMove = this.normalizeArenaPosition(horizontal
      ? { x: nextX, y: player.position.y }
      : { x: player.position.x, y: nextY });

    return {
      direction,
      horizontal,
      laneTarget,
      canAdvanceForward,
      combinedMove,
      laneOnlyMove,
      forwardOnlyMove,
      combinedFree: this.canOccupyPosition(
        player,
        combinedMove,
        ignoredBombIds,
        allowBodyBombEgress,
        allowProjectedBombEgress,
      ),
      laneOnlyFree: this.canOccupyPosition(
        player,
        laneOnlyMove,
        ignoredBombIds,
        allowBodyBombEgress,
        allowProjectedBombEgress,
      ),
      forwardOnlyFree: this.canOccupyPosition(
        player,
        forwardOnlyMove,
        ignoredBombIds,
        allowBodyBombEgress,
        allowProjectedBombEgress,
      ),
    };
  }

  private movePlayer(player: PlayerState, direction: Direction, deltaMs: number): void {
    this.movePlayerInternal(player, direction, deltaMs, true);
  }

  private movePlayerSimulated(
    player: PlayerState,
    direction: Direction,
    deltaMs: number,
    ignoredBombIds: readonly number[] = [],
    allowBodyBombEgress = true,
    allowProjectedBombEgress = false,
  ): void {
    this.movePlayerInternal(
      player,
      direction,
      deltaMs,
      false,
      ignoredBombIds,
      allowBodyBombEgress,
      allowProjectedBombEgress,
    );
  }

  private movePlayerInternal(
    player: PlayerState,
    direction: Direction,
    deltaMs: number,
    allowBombPush: boolean,
    ignoredBombIds: readonly number[] = [],
    allowBodyBombEgress = true,
    allowProjectedBombEgress = false,
  ): void {
    const start = { ...player.position };
    let option = this.evaluateMovementOption(
      player,
      direction,
      deltaMs,
      ignoredBombIds,
      allowBodyBombEgress,
      allowProjectedBombEgress,
    );

    if (allowBombPush && !option.combinedFree && !option.forwardOnlyFree && option.canAdvanceForward) {
      const pushed = this.tryPushBomb(player, direction);
      if (pushed) {
        option = this.evaluateMovementOption(player, direction, deltaMs, [], allowBodyBombEgress);
      }
    }

    if (option.combinedFree && this.positionChanged(start, option.combinedMove)) {
      player.position = this.normalizeArenaPosition(option.combinedMove);
      player.velocity = {
        x: this.getWrappedDelta(player.position.x, start.x, this.getArenaPixelWidth()) / (deltaMs / 1000),
        y: this.getWrappedDelta(player.position.y, start.y, this.getArenaPixelHeight()) / (deltaMs / 1000),
      };
      if (
        Math.abs(player.position.x - start.x) > 0.01 ||
        Math.abs(player.position.y - start.y) > 0.01
      ) {
        player.lastMoveDirection = direction;
      }
      return;
    }

    let moved = false;
    if (option.laneOnlyFree && this.positionChanged(start, option.laneOnlyMove)) {
      player.position = this.normalizeArenaPosition(option.laneOnlyMove);
      moved = true;
    }
    if (option.forwardOnlyFree && !moved && this.positionChanged(start, option.forwardOnlyMove)) {
      player.position = this.normalizeArenaPosition(option.forwardOnlyMove);
      moved = true;
    }

    player.velocity = moved
      ? {
          x: this.getWrappedDelta(player.position.x, start.x, this.getArenaPixelWidth()) / (deltaMs / 1000),
          y: this.getWrappedDelta(player.position.y, start.y, this.getArenaPixelHeight()) / (deltaMs / 1000),
        }
      : { x: 0, y: 0 };

    if (moved && (player.velocity.x !== 0 || player.velocity.y !== 0)) {
      player.lastMoveDirection = direction;
    }

    if (option.horizontal && Math.abs(player.position.y - option.laneTarget) <= LANE_SETTLE_EPSILON) {
      player.position.y = option.laneTarget;
    }
    if (!option.horizontal && Math.abs(player.position.x - option.laneTarget) <= LANE_SETTLE_EPSILON) {
      player.position.x = option.laneTarget;
    }
    player.position = this.normalizeArenaPosition(player.position);
  }

  private arePerpendicular(a: Direction, b: Direction): boolean {
    const aHorizontal = a === "left" || a === "right";
    const bHorizontal = b === "left" || b === "right";
    return aHorizontal !== bHorizontal;
  }

  private areOppositeDirections(a: Direction, b: Direction): boolean {
    return (
      (a === "up" && b === "down")
      || (a === "down" && b === "up")
      || (a === "left" && b === "right")
      || (a === "right" && b === "left")
    );
  }

  private tryPushBomb(player: PlayerState, direction: Direction): boolean {
    if (player.kickLevel <= 0) {
      return false;
    }
    const fromTile = this.getTileFromPosition(player.position);
    const delta = directionDelta[direction];
    const bombTile = this.normalizeTile({ x: fromTile.x + delta.x, y: fromTile.y + delta.y });
    return this.tryPushBombAtTile(bombTile, direction, KICK_SLIDE_MAX_TILES);
  }

  private findBombAtTile(tile: TileCoord): BombState | null {
    const normalized = this.normalizeTile(tile);
    const key = tileKey(normalized.x, normalized.y);
    return this.bombs.find((bomb) => tileKey(bomb.tile.x, bomb.tile.y) === key) ?? null;
  }

  private tryPushBombAtTile(tile: TileCoord, direction: Direction, distance: number): boolean {
    const bomb = this.findBombAtTile(tile);
    if (!bomb) {
      return false;
    }
    const delta = directionDelta[direction];
    let targetTile = { ...bomb.tile };
    let movedTiles = 0;
    let impactBreakableKey: string | null = null;
    for (let step = 0; step < distance; step += 1) {
      const nextTile = this.normalizeTile({ x: targetTile.x + delta.x, y: targetTile.y + delta.y });
      const targetKey = tileKey(nextTile.x, nextTile.y);
      if (this.arena.solid.has(targetKey)) {
        break;
      }
      if (this.arena.breakable.has(targetKey)) {
        impactBreakableKey = targetKey;
        break;
      }
      if (this.bombs.some((item) => item.id !== bomb.id && item.tile.x === nextTile.x && item.tile.y === nextTile.y)) {
        break;
      }
      if (this.hasPlayerOnTile(nextTile)) {
        break;
      }
      targetTile = nextTile;
      movedTiles += 1;
    }
    if (movedTiles <= 0) {
      return false;
    }
    notifyChampionBombRemoved(ALL_PLAYER_IDS.map((playerId) => this.players[playerId]), bomb.id);
    bomb.tile = this.normalizeTile(targetTile);
    bomb.fuseMs = Math.max(KICK_FUSE_MIN_MS, bomb.fuseMs - movedTiles * KICK_FUSE_PENALTY_MS_PER_TILE);
    if (this.flames.some((flame) => flame.tile.x === bomb.tile.x && flame.tile.y === bomb.tile.y)) {
      bomb.fuseMs = 0;
    }
    bomb.ownerCanPass = false;
    bomb.bodyEgressPlayerIds = [];
    notifyChampionBombPlaced(
      this.activePlayerIds.map((playerId) => this.players[playerId]),
      bomb.id,
      (activePlayer) => Boolean(activePlayer.skill.projectedPosition && this.isProjectedPositionOverlappingTile(activePlayer.skill.projectedPosition, bomb.tile)),
    );
    this.bombKickImpactFeedback = this.bombKickImpactFeedback.filter((effect) => effect.bombId !== bomb.id);
    this.bombKickImpactFeedback.push({ bombId: bomb.id, elapsedMs: 0 });
    if (impactBreakableKey) {
      this.breakCrateAtKey(impactBreakableKey);
    }
    return true;
  }

  private hasPlayerOnTile(tile: TileCoord): boolean {
    const normalizedTile = this.normalizeTile(tile);
    for (const id of this.activePlayerIds) {
      const player = this.players[id];
      if (!player.alive) {
        continue;
      }
      // Kick blocking uses continuous body overlap (same AABB as walls/flames).
      if (this.isPlayerOverlappingTile(player, normalizedTile)) {
        return true;
      }
    }
    return false;
  }

  private getBodyGeometryOptions(): {
    arenaPixelWidth: number;
    arenaPixelHeight: number;
    bodyHalf: number;
    tileSize: number;
  } {
    return {
      arenaPixelWidth: this.getArenaPixelWidth(),
      arenaPixelHeight: this.getArenaPixelHeight(),
      bodyHalf: PLAYER_BODY_HALF,
      tileSize: TILE_SIZE,
    };
  }

  private canOccupyPosition(
    player: PlayerState,
    position: PixelCoord,
    ignoredBombIds: readonly number[] = [],
    allowBodyBombEgress = true,
    allowProjectedBombEgress = false,
  ): boolean {
    const wrapped = this.normalizeArenaPosition(position);
    if (
      allowBodyBombEgress
      && player.bombPassLevel <= 0
      && this.bombs.some((bomb) => (
        bomb.ownerId !== player.id
        && !ignoredBombIds.includes(bomb.id)
        && bomb.bodyEgressPlayerIds?.includes(player.id)
        && this.getBodyTileOverlapArea(player.position, bomb.tile) > 0
        && this.doesBodyBombEgressCrossCenter(player.position, wrapped, bomb.tile)
      ))
    ) {
      return false;
    }
    if (
      allowProjectedBombEgress
      && player.bombPassLevel <= 0
      && this.bombs.some((bomb) => (
        ignoredBombIds.includes(bomb.id)
        && this.getBodyTileOverlapArea(player.position, bomb.tile) > 0
        && this.doesBodyBombEgressCrossCenter(player.position, wrapped, bomb.tile)
      ))
    ) {
      return false;
    }
    const { minTileX, maxTileX, minTileY, maxTileY } = bodyTouchedTileIndices(
      wrapped,
      this.getBodyGeometryOptions(),
    );

    for (let tileY = minTileY; tileY <= maxTileY; tileY += 1) {
      for (let tileX = minTileX; tileX <= maxTileX; tileX += 1) {
        if (this.isTileBlockedForPlayer(
          player,
          tileX,
          tileY,
          ignoredBombIds,
          allowBodyBombEgress,
          wrapped,
          allowProjectedBombEgress,
        )) {
          return false;
        }
      }
    }

    return true;
  }

  private isTerrainBlockedKey(key: string): boolean {
    return this.arena.solid.has(key) || this.arena.breakable.has(key);
  }

  private isTileBlockedForPlayer(
    player: PlayerState,
    tileX: number,
    tileY: number,
    ignoredBombIds: readonly number[] = [],
    allowBodyBombEgress = true,
    candidatePosition: PixelCoord = player.position,
    allowProjectedBombEgress = false,
  ): boolean {
    const normalized = this.normalizeTile({ x: tileX, y: tileY });
    const key = tileKey(normalized.x, normalized.y);
    if (this.isTerrainBlockedKey(key)) {
      // Soft/hard walls normally block entry. If the body is already embedded
      // (spawn glitch, skill force-write, desync), allow monotonic egress so
      // the player is not permanently soft-locked inside the tile.
      const alreadyEmbedded = bodyOverlapsTile(
        player.position,
        normalized,
        this.getBodyGeometryOptions(),
      );
      if (
        alreadyEmbedded
        && pureIsMonotonicBodyBombEgress(
          player.position,
          candidatePosition,
          normalized,
          this.getBodyGeometryOptions(),
        )
      ) {
        return false;
      }
      return true;
    }

    for (const bomb of this.bombs) {
      if (bomb.tile.x !== normalized.x || bomb.tile.y !== normalized.y) {
        continue;
      }
      if (player.bombPassLevel > 0) {
        continue;
      }
      if (ignoredBombIds.includes(bomb.id)) {
        if (
          !allowProjectedBombEgress
          || this.isMonotonicBodyBombEgress(player.position, candidatePosition, bomb.tile)
        ) {
          continue;
        }
        return true;
      }
      if (bomb.ownerId === player.id && bomb.ownerCanPass) {
        continue;
      }
      if (
        allowBodyBombEgress
        && bomb.ownerId !== player.id
        && bomb.bodyEgressPlayerIds?.includes(player.id)
        && this.isMonotonicBodyBombEgress(player.position, candidatePosition, bomb.tile)
      ) {
        continue;
      }
      return true;
    }

    return false;
  }

  /**
   * Hard recovery when the body center sits inside solid/breakable.
   * Movement egress covers walk-out once the player presses a direction; this
   * covers idle embed and skills that landed on illegal terrain.
   */
  private ejectPlayerFromBlockedTerrain(player: PlayerState): boolean {
    if (!player.alive || !player.active) {
      return false;
    }
    const centerTile = this.getTileFromPosition(player.position);
    const centerKey = tileKey(centerTile.x, centerTile.y);
    if (!this.isTerrainBlockedKey(centerKey)) {
      return false;
    }
    const freeTile = this.findNearestOpenTileForPlayer(player, centerTile);
    if (!freeTile) {
      return false;
    }
    player.position = this.normalizeArenaPosition(this.getTileCenter(freeTile));
    player.tile = this.getTileFromPosition(player.position);
    player.velocity = { x: 0, y: 0 };
    return true;
  }

  private findNearestOpenTileForPlayer(
    player: PlayerState,
    origin: TileCoord = this.getTileFromPosition(player.position),
  ): TileCoord | null {
    const width = this.getArenaGridWidth();
    const height = this.getArenaGridHeight();
    const maxRadius = Math.max(width, height);
    for (let radius = 0; radius <= maxRadius; radius += 1) {
      for (let dy = -radius; dy <= radius; dy += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          if (radius > 0 && Math.max(Math.abs(dx), Math.abs(dy)) !== radius) {
            continue;
          }
          const tile = this.normalizeTile({ x: origin.x + dx, y: origin.y + dy });
          const key = tileKey(tile.x, tile.y);
          if (this.isTerrainBlockedKey(key)) {
            continue;
          }
          const center = this.getTileCenter(tile);
          // Probe occupancy from a temporary free pose so egress exceptions for
          // the embedded tile do not mask a bomb sitting on the candidate.
          const probe = { ...player, position: { ...center } };
          if (!this.canOccupyPosition(probe, center, [], false, false)) {
            continue;
          }
          return tile;
        }
      }
    }
    return null;
  }

  private getTileCenter(tile: TileCoord): PixelCoord {
    const normalized = this.normalizeTile(tile);
    return {
      x: normalized.x * TILE_SIZE + TILE_SIZE * 0.5,
      y: normalized.y * TILE_SIZE + TILE_SIZE * 0.5,
    };
  }

  private getTileFromPosition(position: PixelCoord): TileCoord {
    const wrapped = this.normalizeArenaPosition(position);
    return {
      x: this.normalizeTileAxis(Math.floor(wrapped.x / TILE_SIZE), this.getArenaGridWidth()),
      y: this.normalizeTileAxis(Math.floor(wrapped.y / TILE_SIZE), this.getArenaGridHeight()),
    };
  }

  private getNearestLaneCenter(value: number): number {
    const half = TILE_SIZE * 0.5;
    const lane = Math.round((value - half) / TILE_SIZE);
    return lane * TILE_SIZE + half;
  }

  private approach(current: number, target: number, amount: number): number {
    if (current < target) {
      return Math.min(target, current + amount);
    }
    if (current > target) {
      return Math.max(target, current - amount);
    }
    return current;
  }

  private isPlayerOverlappingTile(player: PlayerState, tile: TileCoord): boolean {
    const normalized = this.normalizeTile(tile);
    return bodyOverlapsTile(player.position, normalized, this.getBodyGeometryOptions());
  }

  private getBodyTileOverlapArea(position: PixelCoord, tile: TileCoord): number {
    const normalized = this.normalizeTile(tile);
    return bodyTileOverlapArea(position, normalized, this.getBodyGeometryOptions());
  }

  private isMonotonicBodyBombEgress(
    currentPosition: PixelCoord,
    candidatePosition: PixelCoord,
    tile: TileCoord,
  ): boolean {
    const normalized = this.normalizeTile(tile);
    return pureIsMonotonicBodyBombEgress(
      currentPosition,
      candidatePosition,
      normalized,
      this.getBodyGeometryOptions(),
    );
  }

  private doesBodyBombEgressCrossCenter(
    currentPosition: PixelCoord,
    candidatePosition: PixelCoord,
    tile: TileCoord,
  ): boolean {
    const tileCenter = this.getTileCenter(tile);
    return this.doesWrappedSegmentCrossCoordinate(
      currentPosition.x,
      candidatePosition.x,
      tileCenter.x,
      this.getArenaPixelWidth(),
    ) || this.doesWrappedSegmentCrossCoordinate(
      currentPosition.y,
      candidatePosition.y,
      tileCenter.y,
      this.getArenaPixelHeight(),
    );
  }

  private doesWrappedSegmentCrossCoordinate(
    start: number,
    end: number,
    coordinate: number,
    span: number,
  ): boolean {
    const startOffset = this.getWrappedDelta(start, coordinate, span);
    const endOffset = startOffset + this.getWrappedDelta(end, start, span);
    return (
      startOffset < 0
      && endOffset > 0
    ) || (
      startOffset > 0
      && endOffset < 0
    );
  }

  private isProjectedPositionOverlappingTile(position: PixelCoord, tile: TileCoord): boolean {
    const normalized = this.normalizeTile(tile);
    return projectedBodyOverlapsTile(position, normalized, this.getBodyGeometryOptions());
  }

  private placeBomb(player: PlayerState, playAudio = true): boolean {
    if (!player.alive || player.activeBombs >= player.maxBombs) {
      return false;
    }
    const tile = this.getTileFromPosition(player.position);
    player.tile = tile;
    const key = tileKey(tile.x, tile.y);
    if (this.bombs.some((bomb) => tileKey(bomb.tile.x, bomb.tile.y) === key)) {
      return false;
    }

    const bomb: BombState = {
      id: this.nextBombId,
      ownerId: player.id,
      tile: { ...tile },
      fuseMs: getBombFuseMsForPlayer(player),
      ownerCanPass: true,
      bodyEgressPlayerIds: this.activePlayerIds.filter((activePlayerId) => {
        const activePlayer = this.players[activePlayerId];
        return activePlayerId !== player.id
          && activePlayer.alive
          && this.getBodyTileOverlapArea(activePlayer.position, tile) > 0;
      }),
      flameRange: player.flameRange,
    };
    this.bombs.push(bomb);
    notifyChampionBombPlaced(
      this.activePlayerIds.map((playerId) => this.players[playerId]),
      bomb.id,
      (activePlayer) => Boolean(activePlayer.skill.projectedPosition && this.isProjectedPositionOverlappingTile(activePlayer.skill.projectedPosition, bomb.tile)),
    );
    this.cachedBotDangerMap = null;
    this.nextBombId += 1;
    player.activeBombs += 1;
    if (playAudio) {
      this.soundManager.playOneShot("bombPlace");
    }
    return true;
  }

  private triggerRemoteDetonation(player: PlayerState): void {
    if (!player.alive || player.remoteLevel <= 0) {
      return;
    }
    const selectedBomb = this.getOldestOwnedBomb(player.id);
    if (selectedBomb) {
      selectedBomb.fuseMs = 0;
    }
  }

  private updateBombs(deltaMs: number): void {
    for (const bomb of this.bombs) {
      bomb.bodyEgressPlayerIds = (bomb.bodyEgressPlayerIds ?? []).filter((playerId) => {
        const player = this.players[playerId];
        return player.alive
          && this.getBodyTileOverlapArea(player.position, bomb.tile) > 0;
      });
      if (bomb.ownerCanPass) {
        const owner = this.players[bomb.ownerId];
        if (!this.isPlayerOverlappingTile(owner, bomb.tile)) {
          bomb.ownerCanPass = false;
        }
      }
      bomb.fuseMs -= deltaMs;
    }

    const explosions = resolveBombExplosions({
      bombs: this.bombs,
      arena: {
        width: this.getArenaGridWidth(),
        height: this.getArenaGridHeight(),
        solid: this.arena.solid,
        breakable: this.arena.breakable,
      },
    });
    for (const explosion of explosions) {
      this.applyBombExplosion(explosion);
    }
  }

  private applyBombExplosion(explosion: BombExplosion): void {
    const index = this.bombs.findIndex((item) => item.id === explosion.bombId);
    if (index === -1) {
      return;
    }

    const [bomb] = this.bombs.splice(index, 1);
    notifyChampionBombRemoved(ALL_PLAYER_IDS.map((playerId) => this.players[playerId]), bomb.id);
    this.players[bomb.ownerId].activeBombs = Math.max(0, this.players[bomb.ownerId].activeBombs - 1);
    this.soundManager.playOneShot("bombExplode");
    this.triggerExplosionScreenShake();
    for (const reaction of explosion.chainReactions) {
      this.chainReactionFeedback.push({
        fromTile: { ...reaction.fromTile },
        toTile: { ...reaction.toTile },
        elapsedMs: 0,
      });
    }

    const brokenCrateKeys = explosion.brokenCrateKeys.filter((key) => this.breakCrateAtKey(key));
    this.ensureDemolitionComboDrop(brokenCrateKeys);
    if (brokenCrateKeys.length > 0) {
      this.soundManager.playOneShot("crateBreak");
    }

    for (const tile of explosion.flameTiles) {
      this.addFlame(tile, FLAME_DURATION_MS, "normal", bomb.ownerId);
    }
    this.soundManager.playOneShot("flames");
    this.resolvePlayerDeathsAtTileKeys(
      explosion.flameTiles.map((tile) => tileKey(tile.x, tile.y)),
      bomb.ownerId,
    );
  }

  private triggerExplosionScreenShake(): void {
    const stackedAmplitude = this.screenShakeMs > 0
      ? Math.min(EXPLOSION_SCREEN_SHAKE_AMPLITUDE_MAX_PX, this.screenShakeAmplitudePx + 1)
      : EXPLOSION_SCREEN_SHAKE_AMPLITUDE_PX;
    this.screenShakeAmplitudePx = stackedAmplitude;
    this.screenShakeMs = EXPLOSION_SCREEN_SHAKE_MS;
  }

  private getScreenShakeOffset(): PixelCoord {
    if (this.screenShakeMs <= 0 || this.screenShakeAmplitudePx <= 0) {
      return { x: 0, y: 0 };
    }
    const intensity = Math.min(1, this.screenShakeMs / EXPLOSION_SCREEN_SHAKE_MS);
    const amplitude = this.screenShakeAmplitudePx * intensity;
    // Deterministic presentation offset from the animation clock (not simulation RNG).
    const phase = this.animationClockMs;
    return {
      x: Math.sin(phase * 0.073) * amplitude,
      y: Math.cos(phase * 0.091) * amplitude,
    };
  }

  private armBombAtTile(tile: TileCoord): void {
    const bomb = this.bombs.find((item) => item.tile.x === tile.x && item.tile.y === tile.y);
    if (!bomb) {
      return;
    }
    bomb.fuseMs = 0;
  }

  private revealPowerUpAt(key: string): void {
    const item = this.arena.powerUps.find((powerUp) => tileKey(powerUp.tile.x, powerUp.tile.y) === key);
    if (item && !item.revealed) {
      item.revealed = true;
      this.powerUpRevealStartedAtMs.set(item, this.animationClockMs);
    }
  }

  private ensureDemolitionComboDrop(brokenCrateKeys: string[]): void {
    if (brokenCrateKeys.length < DEMOLITION_COMBO_MIN_CRATES) {
      return;
    }

    const sortedKeys = [...brokenCrateKeys].sort();
    const occupiedKeys = new Set(this.arena.powerUps
      .filter((powerUp) => !powerUp.collected)
      .map((powerUp) => tileKey(powerUp.tile.x, powerUp.tile.y)));
    const freeKeys = sortedKeys.filter((key) => !occupiedKeys.has(key));
    if (freeKeys.length === 0) {
      return;
    }

    let hash = 0;
    for (const key of sortedKeys) {
      for (let index = 0; index < key.length; index += 1) {
        hash = ((hash * 31) + key.charCodeAt(index)) >>> 0;
      }
    }

    const dropKey = freeKeys[hash % freeKeys.length];
    const comboDropTypes = getDemolitionComboDropTypes();
    const type = comboDropTypes[hash % comboDropTypes.length] ?? "speed-up";
    if (!dropKey) {
      return;
    }

    const comboDrop: PowerUpState = {
      tile: this.parseTileKey(dropKey),
      type,
      revealed: true,
      collected: false,
    };
    this.arena.powerUps.push(comboDrop);
    this.powerUpRevealStartedAtMs.set(comboDrop, this.animationClockMs);
  }

  private breakCrateAtKey(key: string): boolean {
    if (!this.arena.breakable.has(key)) {
      return false;
    }
    this.arena.breakable.delete(key);
    this.invalidateArenaCache();
    this.revealPowerUpAt(key);
    this.addCrateBreakAnimation(this.parseTileKey(key));
    return true;
  }

  private addCrateBreakAnimation(tile: TileCoord): void {
    const existing = this.crateBreakAnimations.find((effect) => (
      effect.tile.x === tile.x && effect.tile.y === tile.y
    ));
    if (existing) {
      existing.elapsedMs = 0;
      return;
    }
    this.crateBreakAnimations.push({
      tile: { ...tile },
      elapsedMs: 0,
    });
  }

  private parseTileKey(key: string): TileCoord {
    const [xText, yText] = key.split(",");
    return {
      x: Number(xText),
      y: Number(yText),
    };
  }

  private updateVisualEffects(deltaMs: number): void {
    if (this.screenShakeMs > 0) {
      this.screenShakeMs = Math.max(0, this.screenShakeMs - deltaMs);
      if (this.screenShakeMs <= 0) {
        this.screenShakeAmplitudePx = 0;
      }
    }

    for (const playerId of this.activePlayerIds) {
      advancePickupChain(this.pickupChains[playerId], deltaMs);
    }

    if (this.powerUpPickupNotices.length > 0) {
      for (const notice of this.powerUpPickupNotices) {
        notice.elapsedMs += deltaMs;
        notice.remainingMs -= deltaMs;
      }
      this.powerUpPickupNotices = this.powerUpPickupNotices.filter((notice) => notice.remainingMs > 0);
    }

    if (this.crateBreakAnimations.length > 0) {
      for (const effect of this.crateBreakAnimations) {
        effect.elapsedMs += deltaMs;
      }
      this.crateBreakAnimations = this.crateBreakAnimations.filter((effect) => (
        effect.elapsedMs < CRATE_BREAK_DURATION_MS
      ));
    }

    if (this.bombKickImpactFeedback.length > 0) {
      for (const effect of this.bombKickImpactFeedback) {
        effect.elapsedMs += deltaMs;
      }
      this.bombKickImpactFeedback = this.bombKickImpactFeedback.filter((effect) => (
        effect.elapsedMs < KICK_IMPACT_FEEDBACK_MS
        && this.bombs.some((bomb) => bomb.id === effect.bombId)
      ));
    }

    if (this.chainReactionFeedback.length > 0) {
      for (const effect of this.chainReactionFeedback) {
        effect.elapsedMs += deltaMs;
      }
      this.chainReactionFeedback = this.chainReactionFeedback.filter((effect) => (
        effect.elapsedMs < CHAIN_REACTION_FEEDBACK_MS
      ));
    }

    this.championVisuals.advance(deltaMs, this.activePlayerIds);

    this.championWorldEffects = this.championVisuals.advanceWorldEffects(
      this.championWorldEffects,
      deltaMs,
    );

    if (this.suddenDeathClosureEffects.length === 0) {
      return;
    }
    for (const effect of this.suddenDeathClosureEffects) {
      effect.elapsedMs += deltaMs;
      if (!effect.impacted && effect.elapsedMs >= SUDDEN_DEATH_FALL_MS) {
        effect.impacted = true;
        if (this.onlineSession?.role === "guest") {
          const key = tileKey(effect.tile.x, effect.tile.y);
          this.suddenDeathClosedTiles.add(key);
          this.arena.solid.add(key);
          this.invalidateArenaCache();
        } else {
          this.applySuddenDeathClosure(effect.tile);
        }
      }
    }
    this.suddenDeathClosureEffects = this.suddenDeathClosureEffects.filter((effect) => (
      effect.elapsedMs < SUDDEN_DEATH_FALL_MS + SUDDEN_DEATH_IMPACT_LINGER_MS
    ));
  }

  private addFlame(
    tile: TileCoord,
    durationMs: number = FLAME_DURATION_MS,
    style: FlameState["style"] = "normal",
    ownerId: PlayerId | null = null,
  ): void {
    this.armBombAtTile(tile);
    const existing = this.flames.find((flame) => flame.tile.x === tile.x && flame.tile.y === tile.y);
    if (existing) {
      existing.remainingMs = Math.max(existing.remainingMs, durationMs);
      existing.style = existing.style === "toxic" || style === "toxic"
        ? "toxic"
        : style;
      if (existing.ownerId == null && ownerId !== null) existing.ownerId = ownerId;
      return;
    }
    this.flames.push({ tile: { ...tile }, remainingMs: durationMs, style, ownerId: ownerId ?? null });
  }

  private updateSuddenDeath(deltaMs: number): void {
    if (!this.suddenDeathActive && this.roundTimeMs <= SUDDEN_DEATH_START_MS) {
      this.suddenDeathActive = true;
      this.suddenDeathTickMs = 0;
      this.soundManager.playOneShot("suddenDeathAlarm");
    }

    if (!this.suddenDeathActive || this.suddenDeathPath.length === 0 || this.suddenDeathIndex >= this.suddenDeathPath.length) {
      return;
    }

    this.suddenDeathTickMs -= deltaMs;
    while (this.suddenDeathTickMs <= 0 && this.suddenDeathIndex < this.suddenDeathPath.length) {
      const tile = this.suddenDeathPath[this.suddenDeathIndex];
      this.startSuddenDeathClosure(tile);
      this.suddenDeathIndex += 1;
      this.suddenDeathTickMs += SUDDEN_DEATH_TICK_MS;
    }
  }

  private startSuddenDeathClosure(tile: TileCoord): void {
    const key = tileKey(tile.x, tile.y);
    if (this.suddenDeathClosedTiles.has(key) || this.arena.solid.has(key)) {
      return;
    }
    const existing = this.suddenDeathClosureEffects.find((effect) => (
      effect.tile.x === tile.x && effect.tile.y === tile.y
    ));
    if (existing) {
      existing.elapsedMs = 0;
      existing.impacted = false;
      return;
    }
    this.suddenDeathClosureEffects.push({
      tile: { ...tile },
      elapsedMs: 0,
      impacted: false,
    });
  }

  private applySuddenDeathClosure(tile: TileCoord): void {
    const key = tileKey(tile.x, tile.y);
    if (this.suddenDeathClosedTiles.has(key)) {
      return;
    }
    this.breakCrateAtKey(key);
    this.arena.powerUps = this.arena.powerUps.filter((powerUp) => (
      powerUp.tile.x !== tile.x || powerUp.tile.y !== tile.y
    ));
    const bomb = this.bombs.find((item) => item.tile.x === tile.x && item.tile.y === tile.y);
    if (bomb) {
      bomb.fuseMs = 0;
    }
    this.suddenDeathClosedTiles.add(key);
    this.arena.solid.add(key);
    this.invalidateArenaCache();
    this.resolveSuddenDeathClosureImpact(tile);
  }

  private resolveSuddenDeathClosureImpact(tile: TileCoord): void {
    for (const id of this.activePlayerIds) {
      const player = this.players[id];
      if (!player.alive) {
        continue;
      }
      player.tile = this.getTileFromPosition(player.position);
      // Same hitbox rule as flames: body overlap, not only discrete tile center.
      if (!this.isPlayerOverlappingTile(player, tile)) {
        continue;
      }
      if (this.isPlayerImmuneDuringSkillChannel(player)) {
        continue;
      }
      this.killPlayer(player, "sudden-death");
    }
  }

  private buildSuddenDeathPath(): TileCoord[] {
    return this.arena.config.suddenDeathPath
      .filter((tile) => !this.arena.solid.has(tileKey(tile.x, tile.y)))
      .map((tile) => ({ ...tile }));
  }

  private updateFlames(deltaMs: number): void {
    for (const flame of this.flames) {
      flame.remainingMs -= deltaMs;
    }
    this.flames = this.flames.filter((flame) => flame.remainingMs > 0);
  }

  resolvePlayerDeathsFromFlames(): void {
    for (const id of this.activePlayerIds) {
      const player = this.players[id];
      if (!player.alive) continue;
      player.tile = this.getTileFromPosition(player.position);
      // Body AABB overlap (PLAYER_BODY_HALF < TILE/2). Continuous overlap
      // matches movement and bot lethality without full-tile unfair kills.
      const flame = this.flames.find((entry) => (
        entry.remainingMs > 0
        && this.isPlayerOverlappingTile(player, entry.tile)
      ));
      if (flame) this.tryAbsorbInstantHit(player, flame.ownerId ?? null);
    }
  }

  private resolvePlayerDeathsAtTileKeys(keys: Iterable<string>, attackerId: PlayerId | null = null): void {
    const flameKeys = new Set(keys);
    if (flameKeys.size === 0) {
      return;
    }
    const flameTiles = tilesFromKeys(flameKeys);
    for (const id of this.activePlayerIds) {
      const player = this.players[id];
      if (!player.alive) {
        continue;
      }
      player.tile = this.getTileFromPosition(player.position);
      const hit = flameTiles.some((tile) => this.isPlayerOverlappingTile(player, tile));
      if (hit) {
        this.tryAbsorbInstantHit(player, attackerId);
      }
    }
  }

  private tryAbsorbInstantHit(player: PlayerState, attackerId: PlayerId | null = null): boolean {
    if (player.spawnProtectionMs > 0) {
      return false;
    }
    if (this.isPlayerImmuneDuringSkillChannel(player)) {
      return false;
    }
    if (player.flameGuardMs > 0) {
      return false;
    }
    if (player.shieldCharges > 0) {
      player.shieldCharges -= 1;
      player.flameGuardMs = SHIELD_GUARD_MS;
      player.breakawayBoostMs = Math.max(player.breakawayBoostMs ?? 0, SHIELD_BREAKAWAY_BOOST_MS);
      this.soundManager.playOneShot("shieldBlock");
      return false;
    }
    if (this.onlineRoomMode === "endless" && attackerId && attackerId !== player.id) {
      this.endlessKills[attackerId] += 1;
    }
    const cause: OnlineDeathCause = attackerId === player.id
      ? "self"
      : attackerId
        ? "opponent"
        : "environment";
    this.killPlayer(player, cause);
    return true;
  }

  private killPlayer(player: PlayerState, cause: OnlineDeathCause | null = null): void {
    if (!player.alive) {
      return;
    }
    for (const bomb of this.bombs) {
      bomb.bodyEgressPlayerIds = (bomb.bodyEgressPlayerIds ?? []).filter(
        (playerId) => playerId !== player.id,
      );
    }
    if (this.onlineRoomMode === "endless" && cause) {
      this.endlessDeathStats.total[player.id] += 1;
      this.endlessDeathStats.byCause[cause][player.id] += 1;
    }
    player.alive = false;
    player.velocity = { x: 0, y: 0 };
    player.skill = createDefaultPlayerSkillState(player.skill.id);
    this.playerDeathAnimations[player.id] = {
      startedAtMs: this.animationClockMs,
      direction: player.lastMoveDirection ?? player.direction,
    };
  }

  private collectPowerUps(): void {
    for (const id of this.activePlayerIds) {
      const player = this.players[id];
      if (!player.alive) {
        continue;
      }
      player.tile = this.getTileFromPosition(player.position);

      for (const powerUp of this.arena.powerUps) {
        if (!powerUp.revealed || powerUp.collected) {
          continue;
        }
        // Continuous body/tile overlap — same body as walls and flames.
        if (!this.isPlayerOverlappingTile(player, powerUp.tile)) {
          continue;
        }
        if (isPowerUpMaxed(player, powerUp.type)) {
          const existingNotice = this.getPowerUpPickupNotice(id, powerUp.type);
          if (existingNotice?.valueLabel !== "MAX") {
            this.addPowerUpPickupNotice(id, powerUp.type, false, "MAX");
          }
          continue;
        }
        powerUp.collected = true;
        applyPowerUpToPlayer(player, powerUp.type);
        const chainGuard = registerPickupForChain(this.pickupChains[id], powerUp.type);
        if (chainGuard) {
          player.flameGuardMs = Math.max(player.flameGuardMs, PICKUP_CHAIN_GUARD_MS);
        }
        player.pickupSprintMs = Math.max(player.pickupSprintMs ?? 0, PICKUP_SPRINT_BOOST_MS);
        this.addPowerUpPickupNotice(id, powerUp.type, chainGuard);
        this.soundManager.playOneShot("powerCollect");
      }
    }
  }

  private evaluateRoundState(): void {
    const alivePlayers = this.activePlayerIds.filter((id) => this.players[id].alive);
    if (alivePlayers.length > 1) {
      return;
    }
    if (alivePlayers.length === 0) {
      this.finishRound(null, "double-ko", "Double KO. Nobody scores.");
      return;
    }
    this.finishRound(alivePlayers[0], "elimination", `${this.players[alivePlayers[0]].name} wins the round.`);
  }

  private finishRound(winner: PlayerId | null, reason: RoundOutcome["reason"], message: string): void {
    if (this.roundOutcome) {
      return;
    }
    this.roundOutcomeMessage = message;
    const [event] = this.matchCycle.dispatch({ type: "finish-round", winner, reason });
    if (!event || event.type !== "round-finished") {
      return;
    }
    this.syncMatchCycleProjection();
    this.soundManager.playOneShot("roundEnd");
    if (event.clinchesMatch) {
      this.soundManager.playOneShot("matchWin");
    }
    this.persistLocalSessionReturnBrief(winner, reason, event.clinchesMatch);
  }

  private persistLocalSessionReturnBrief(
    winner: PlayerId | null,
    reason: RoundOutcome["reason"],
    matchComplete: boolean,
  ): void {
    if (this.onlineSession) {
      return;
    }
    const storage = this.getLocalStorage();
    if (!storage) {
      return;
    }

    const brief: LocalSessionReturnBrief = {
      mode: this.onlineRoomMode,
      winner,
      winnerName: winner ? this.getPlayerBriefName(winner) : null,
      reason,
      roundNumber: this.roundNumber,
      scoreLine: this.buildLocalSessionScoreLine(),
      matchComplete,
      finishedAtMs: Date.now(),
    };

    try {
      storage.setItem(LOCAL_SESSION_RETURN_BRIEF_STORAGE_KEY, JSON.stringify(brief));
    } catch {
      // Returning players should never lose the current match because storage is unavailable.
    }
  }

  private getLocalStorage(): Storage | null {
    if (this.headless || typeof window === "undefined") {
      return null;
    }
    try {
      return window.localStorage ?? null;
    } catch {
      return null;
    }
  }

  private readStorageItem(storage: Storage | null, key: string): string | null {
    try {
      return storage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  }

  private writeStorageItem(key: string, value: string): void {
    try {
      this.getLocalStorage()?.setItem(key, value);
    } catch {
      // Audio controls remain usable when storage is blocked or full.
    }
  }

  private isLocalSessionReturnBrief(value: unknown): value is LocalSessionReturnBrief {
    if (!value || typeof value !== "object") {
      return false;
    }
    const candidate = value as Partial<LocalSessionReturnBrief>;
    return (candidate.mode === "classic" || candidate.mode === "endless")
      && (candidate.winner === null || ALL_PLAYER_IDS.includes(candidate.winner as PlayerId))
      && (typeof candidate.winnerName === "string" || candidate.winnerName === null)
      && (candidate.reason === "elimination" || candidate.reason === "timer" || candidate.reason === "double-ko")
      && typeof candidate.roundNumber === "number"
      && Number.isFinite(candidate.roundNumber)
      && candidate.roundNumber >= 1
      && typeof candidate.scoreLine === "string"
      && candidate.scoreLine.length > 0
      && typeof candidate.matchComplete === "boolean"
      && typeof candidate.finishedAtMs === "number"
      && Number.isFinite(candidate.finishedAtMs);
  }

  private buildLocalSessionScoreLine(): string {
    return this.activePlayerIds
      .map((playerId) => `${this.getPlayerBriefName(playerId)} ${this.score[playerId]}`)
      .join(" | ");
  }

  private hasMatchWinnerScore(): boolean {
    return this.activePlayerIds.some((playerId) => this.score[playerId] >= TARGET_WINS);
  }

  private getRoundedCountdownSeconds(countdownMs: number): number {
    return Math.max(0, Math.ceil(countdownMs / 1000));
  }

  private formatActiveScore(): string {
    return this.activePlayerIds
      .map((playerId) => `P${playerId} ${this.score[playerId]}`)
      .join(" - ");
  }

  private getPlayerBriefName(playerId: PlayerId): string {
    const player = this.players[playerId];
    if (!player) {
      return `P${playerId}`;
    }
    return player.name === "BOT" ? `BOT P${playerId}` : player.name;
  }

  private getPlayerPixelPositionFromState(player: PlayerState): PixelCoord {
    return {
      x: player.position.x - TILE_SIZE * 0.5,
      y: player.position.y - TILE_SIZE * 0.5,
    };
  }

  private getPlayerPixelPosition(player: PlayerState): PixelCoord {
    if (this.headless) {
      return this.getPlayerPixelPositionFromState(player);
    }
    return this.visualPlayerPositions[player.id] ?? this.getPlayerPixelPositionFromState(player);
  }

  private render(): void {
    this.ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    this.ctx.save();
    const shakeOffset = this.getScreenShakeOffset();
    this.ctx.translate(shakeOffset.x, shakeOffset.y);
    this.renderBackdrop();

    if (this.mode === "menu") {
      this.renderMenu();
      this.ctx.restore();
      return;
    }

    this.renderArena();
    this.renderHud();

    if (this.mode === "match") {
      this.renderMatchOverlay();
      if (this.isAnyCharacterMenuOpen()) {
        this.renderCharacterSelectionOverlay();
      }
      this.ctx.restore();
      return;
    }

    this.renderMatchResult();
    if (this.isAnyCharacterMenuOpen()) {
      this.renderCharacterSelectionOverlay();
    }
    this.ctx.restore();
  }

  private buildBackdropCache(): HTMLCanvasElement {
    const offscreen = document.createElement("canvas");
    offscreen.width = CANVAS_WIDTH * CANVAS_BACKBUFFER_SCALE;
    offscreen.height = CANVAS_HEIGHT * CANVAS_BACKBUFFER_SCALE;
    const c = offscreen.getContext("2d")!;
    c.setTransform(CANVAS_BACKBUFFER_SCALE, 0, 0, CANVAS_BACKBUFFER_SCALE, 0, 0);

    const metrics = this.getArenaRenderMetrics();
    const arenaWidth = metrics.arenaPixelWidth;
    const arenaHeight = metrics.arenaPixelHeight;
    const arenaX = metrics.arenaX;
    const arenaY = metrics.arenaY;
    const arenaRight = arenaX + arenaWidth;
    const arenaBottom = arenaY + arenaHeight;
    const frameX = arenaX - 10;
    const frameY = arenaY - 10;
    const frameWidth = arenaWidth + 20;
    const frameHeight = arenaHeight + 20;

    const gradient = c.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    gradient.addColorStop(0, "#0a0a12");
    gradient.addColorStop(0.38, "#07070e");
    gradient.addColorStop(1, "#050508");
    c.fillStyle = gradient;
    c.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const mist = c.createRadialGradient(CANVAS_WIDTH - 92, 84, 18, CANVAS_WIDTH - 92, 84, 214);
    mist.addColorStop(0, "rgba(0, 229, 160, 0.08)");
    mist.addColorStop(0.4, "rgba(0, 168, 112, 0.05)");
    mist.addColorStop(1, "rgba(5, 5, 12, 0)");
    c.fillStyle = mist;
    c.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const floorGlow = c.createLinearGradient(0, arenaBottom - 24, 0, CANVAS_HEIGHT);
    floorGlow.addColorStop(0, "rgba(0, 20, 16, 0)");
    floorGlow.addColorStop(1, "rgba(2, 2, 8, 0.92)");
    c.fillStyle = floorGlow;
    c.fillRect(0, arenaBottom - 24, CANVAS_WIDTH, CANVAS_HEIGHT - arenaBottom + 24);

    c.fillStyle = "rgba(6, 6, 14, 0.76)";
    c.beginPath();
    c.moveTo(0, arenaY - 10);
    c.lineTo(arenaX - 2, arenaY + 44);
    c.lineTo(arenaX - 10, arenaBottom + 42);
    c.lineTo(0, CANVAS_HEIGHT);
    c.closePath();
    c.fill();

    c.beginPath();
    c.moveTo(CANVAS_WIDTH, arenaY - 2);
    c.lineTo(arenaRight + 2, arenaY + 58);
    c.lineTo(arenaRight + 12, arenaBottom + 40);
    c.lineTo(CANVAS_WIDTH, CANVAS_HEIGHT);
    c.closePath();
    c.fill();

    c.fillStyle = "rgba(4, 4, 10, 0.5)";
    c.fillRect(frameX + 4, frameY + 14, frameWidth - 8, frameHeight - 4);

    c.fillStyle = "rgba(0, 229, 160, 0.08)";
    c.beginPath();
    c.moveTo(frameX, frameY + 4);
    c.lineTo(frameX + frameWidth, frameY + 4);
    c.lineTo(frameX + frameWidth - 6, frameY + 18);
    c.lineTo(frameX + 6, frameY + 18);
    c.closePath();
    c.fill();

    c.strokeStyle = "rgba(0, 229, 160, 0.16)";
    c.lineWidth = 1;
    c.strokeRect(frameX + 0.5, frameY + 0.5, frameWidth - 1, frameHeight - 1);

    c.fillStyle = "rgba(168, 255, 100, 0.04)";
    c.beginPath();
    c.ellipse(CANVAS_WIDTH - 84, arenaBottom + 16, 104, 76, -0.35, 0, Math.PI * 2);
    c.fill();

    c.fillStyle = "rgba(4, 4, 10, 0.34)";
    c.beginPath();
    c.moveTo(24, arenaY + 54);
    c.lineTo(56, arenaY + 120);
    c.lineTo(42, arenaBottom - 30);
    c.lineTo(14, arenaBottom - 40);
    c.closePath();
    c.fill();

    c.strokeStyle = "rgba(0, 229, 160, 0.04)";
    c.lineWidth = 2;
    for (let i = 0; i < 6; i += 1) {
      c.beginPath();
      c.moveTo(12 + i * 8, arenaY + 84 + i * 18);
      c.lineTo(34 + i * 8, arenaY + 56 + i * 16);
      c.stroke();
    }

    const vignette = c.createRadialGradient(
      CANVAS_WIDTH / 2,
      CANVAS_HEIGHT / 2,
      120,
      CANVAS_WIDTH / 2,
      CANVAS_HEIGHT / 2,
      360,
    );
    vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
    vignette.addColorStop(1, "rgba(0, 0, 0, 0.34)");
    c.fillStyle = vignette;
    c.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    return offscreen;
  }

  private renderBackdrop(): void {
    if (!this.backdropCache) {
      this.backdropCache = this.buildBackdropCache();
    }
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.drawImage(this.backdropCache, 0, 0);
    this.ctx.restore();
  }

  private renderMenu(): void {
    this.renderArena();
    this.renderHud();

    this.ctx.fillStyle = CANVAS_UI_PANEL_BG;
    this.ctx.fillRect(12, HUD_HEIGHT + 10, 456, 48);
    this.ctx.strokeStyle = CANVAS_UI_BORDER_STRONG;
    this.ctx.strokeRect(12.5, HUD_HEIGHT + 10.5, 455, 47);
    this.ctx.textAlign = "left";
    this.ctx.font = "700 9px Inter";
    this.ctx.fillStyle = CANVAS_UI_TEXT;
    this.ctx.fillText("MENU LOCAL  |  E/P READY  |  G/K CHARACTER", 22, HUD_HEIGHT + 27);
    this.ctx.font = "600 8px Inter";
    this.ctx.fillStyle = CANVAS_UI_MUTED;
    this.ctx.fillText(
      `B toggle bot rapido  |  N cicla bots: ${this.localBotFill}  |  ativos: ${this.activePlayerIds.length}`,
      22,
      HUD_HEIGHT + 43,
    );

    if (this.isAnyCharacterMenuOpen()) {
      this.renderCharacterSelectionOverlay();
    }
  }

  private renderCharacterSelectionOverlay(): void {
    this.ctx.fillStyle = "rgba(8, 6, 5, 0.78)";
    this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    this.drawCharacterSelectionPanel(1, 28, 112);
    this.drawCharacterSelectionPanel(2, 252, 112);
  }

  private drawCharacterSelectionPanel(playerId: PlayerId, x: number, y: number): void {
    const panelWidth = 200;
    const panelHeight = 244;
    const isOpen = this.characterMenuOpen[playerId];
    const entry = this.getPreviewCharacterEntry(playerId);
    const currentIndex = this.pendingCharacterIndex[playerId];

    this.ctx.fillStyle = CANVAS_UI_PANEL_BG_STRONG;
    this.ctx.fillRect(x, y, panelWidth, panelHeight);
    this.ctx.strokeStyle = CANVAS_UI_BORDER_STRONG;
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(x + 0.5, y + 0.5, panelWidth - 1, panelHeight - 1);

    this.ctx.textAlign = "left";
    this.ctx.fillStyle = CANVAS_UI_GOLD_BRIGHT;
    this.ctx.font = "700 13px Inter";
    this.ctx.fillText(`P${playerId} CHARACTER`, x + 10, y + 20);
    this.ctx.fillStyle = CANVAS_UI_TEXT;
    this.ctx.font = "600 11px Inter";
    this.ctx.fillText(this.shortenCharacterName(entry.name, 24), x + 10, y + 40);
    this.ctx.fillText(`${currentIndex + 1}/${this.characterRoster.length}`, x + 10, y + 56);

    for (let row = 0; row < 5; row += 1) {
      const offset = row - 2;
      const index = (currentIndex + offset + this.characterRoster.length) % this.characterRoster.length;
      const item = this.characterRoster[index];
      const rowY = y + 76 + row * 26;
      const selected = offset === 0;
      this.ctx.fillStyle = selected ? CANVAS_UI_GOLD_SOFT : "rgba(255, 255, 255, 0.03)";
      this.ctx.fillRect(x + 8, rowY - 14, panelWidth - 16, 22);
      this.ctx.fillStyle = selected ? CANVAS_UI_TEXT : CANVAS_UI_MUTED;
      this.ctx.font = selected ? "700 11px Inter" : "500 10px Inter";
      this.ctx.fillText(this.shortenCharacterName(item.name, 26), x + 12, rowY);
    }

    this.ctx.fillStyle = CANVAS_UI_MUTED;
    this.ctx.font = "500 10px Inter";
    this.ctx.fillText(
      playerId === 1 ? "W/S browse  E lock  G close" : "UP/DN browse  P lock  K close",
      x + 10,
      y + 222,
    );
    if (isOpen) {
      this.ctx.fillStyle = CANVAS_UI_TEXT;
      this.ctx.fillText("Selection is live after lock.", x + 10, y + 238);
    }
  }

  private drawHudPanel(x: number, y: number, width: number, height: number, accent: string): void {
    paintHudPanel(this.ctx, x, y, width, height, accent, {
      panelBg: CANVAS_UI_PANEL_BG,
      border: CANVAS_UI_BORDER,
    });
  }

  /**
   * Two-row match HUD (windowed + fullscreen):
   *  Top  — rival compact slots + isolated match meta (round/timer/mode)
   *  Bottom — dedicated local panel (status, icon+level power slots, skill)
   */
  private renderHud(): void {
    if (this.hideNativeHud) return;
    this.renderMatchHud();
  }

  private renderMatchHud(): void {
    const hudHeight = this.getHudRenderHeight();
    const compact = this.isFullscreenMatchLayoutActive();
    const localId = this.getMatchLocalPlayerId();
    const { leftRivals, rightRivals } = partitionHudPlayers(this.activePlayerIds, localId);

    const hudGradient = this.ctx.createLinearGradient(0, 0, CANVAS_WIDTH, hudHeight);
    if (compact) {
      hudGradient.addColorStop(0, "rgba(18, 15, 13, 0.76)");
      hudGradient.addColorStop(0.5, "rgba(24, 20, 16, 0.72)");
      hudGradient.addColorStop(1, "rgba(18, 15, 13, 0.76)");
    } else {
      hudGradient.addColorStop(0, "rgba(18, 15, 13, 0.96)");
      hudGradient.addColorStop(0.5, "rgba(25, 21, 17, 0.96)");
      hudGradient.addColorStop(1, "rgba(18, 15, 13, 0.96)");
    }
    this.ctx.fillStyle = hudGradient;
    this.ctx.fillRect(0, 0, CANVAS_WIDTH, hudHeight);
    this.ctx.fillStyle = CANVAS_UI_BORDER;
    this.ctx.fillRect(0, hudHeight - (compact ? 1 : 2), CANVAS_WIDTH, compact ? 1 : 2);

    const pad = HUD_LAYOUT.paddingX;
    const gap = HUD_LAYOUT.gap;
    const centerWidth = Math.min(FULLSCREEN_HUD_CENTER_WIDTH, HUD_LAYOUT.centerWidth + 20);
    const centerX = Math.round((CANVAS_WIDTH - centerWidth) / 2);
    const topY = HUD_LAYOUT.topRowY;
    const topH = HUD_LAYOUT.topRowHeight;

    // --- Top: left rivals | center meta | right rivals ---
    this.renderMatchCenterMeta(centerX, topY, centerWidth, topH);

    const leftGutter = Math.max(0, centerX - pad - gap);
    const leftSlotW = computeRivalSlotWidth(leftGutter, Math.max(1, leftRivals.length));
    leftRivals.forEach((playerId, index) => {
      const x = pad + index * (leftSlotW + gap);
      this.renderRivalHudSlot(playerId, x, topY, leftSlotW, topH);
    });

    const rightStartX = centerX + centerWidth + gap;
    const rightGutter = Math.max(0, CANVAS_WIDTH - pad - rightStartX);
    const rightSlotW = computeRivalSlotWidth(rightGutter, Math.max(1, rightRivals.length));
    rightRivals.forEach((playerId, index) => {
      const x = rightStartX + index * (rightSlotW + gap);
      this.renderRivalHudSlot(playerId, x, topY, rightSlotW, topH);
    });

    // --- Bottom: dedicated local player panel ---
    const localWidth = CANVAS_WIDTH - pad * 2;
    this.renderLocalPlayerHud(
      localId,
      pad,
      HUD_LAYOUT.localPanelY,
      localWidth,
      HUD_LAYOUT.localPanelHeight,
    );
  }

  private renderMatchCenterMeta(x: number, y: number, width: number, height: number): void {
    this.drawHudPanel(x, y, width, height, CANVAS_UI_BORDER_STRONG);
    const cx = x + width / 2;
    const modeLabel = this.onlineRoomMode === "endless"
      ? `R${this.roundNumber} · ENDLESS`
      : `R${this.roundNumber} · FT${TARGET_WINS}`;
    const suddenDeathHud = this.roundOutcome ? null : this.getSuddenDeathHudState();

    this.ctx.textAlign = "center";
    this.ctx.font = "700 7px Inter";
    this.drawHudText(modeLabel, cx, y + 8, CANVAS_UI_MUTED, CANVAS_UI_SHADOW);
    this.ctx.font = "700 13px Inter";
    this.drawHudText(
      Math.ceil(this.roundTimeMs / 1000).toString().padStart(2, "0"),
      cx,
      y + (suddenDeathHud ? 18 : 20),
      CANVAS_UI_TEXT,
      CANVAS_UI_SHADOW,
    );

    if (suddenDeathHud) {
      // Meter only under timer — avoid stacking SD text on the timer digits.
      this.drawSuddenDeathMeter(
        x + 12,
        y + height - 6,
        width - 24,
        suddenDeathHud.progress,
        suddenDeathHud.active,
      );
    }
  }

  /** Compact rival/opponent slot: name ellipsis, K/W, ult/alive state — no BFS string soup. */
  private renderRivalHudSlot(
    playerId: PlayerId,
    x: number,
    y: number,
    width: number,
    height: number,
  ): void {
    const palette = PLAYER_COLORS[playerId];
    const slotW = Math.max(HUD_LAYOUT.rivalSlotMinWidth, width);
    const status = this.getPlayerHudStatus(playerId);
    const scoreText = formatHudScoreLine(
      this.onlineRoomMode === "endless" ? "endless" : "standard",
      {
        kills: this.endlessKills[playerId],
        wins: this.onlineRoomMode === "endless"
          ? this.endlessRoundWins[playerId]
          : this.score[playerId],
      },
    );
    const slotLabel = this.getPlayerSlotLabel(playerId);
    // Reserve right edge for score (~36px) so name never collides with K/W.
    const nameBudget = slotW < 130 ? HUD_LAYOUT.rivalNameMax - 2 : HUD_LAYOUT.rivalNameMax;
    const name = this.getCharacterLabel(playerId, nameBudget);
    const ultLabel = this.getRivalUltLabel(playerId, status);

    this.drawHudPanel(x, y, slotW, height, palette.glow);

    // Row 1: P#  Name… ................. K/W
    this.ctx.textAlign = "left";
    this.ctx.font = "700 8px Inter";
    this.drawHudText(slotLabel, x + 7, y + 10, palette.primary, CANVAS_UI_SHADOW);
    this.ctx.font = "600 8px Inter";
    this.drawHudText(name, x + 28, y + 10, CANVAS_UI_TEXT, CANVAS_UI_SHADOW);

    this.ctx.textAlign = "right";
    this.ctx.font = "700 8px Inter";
    this.drawHudText(scoreText, x + slotW - 6, y + 10, CANVAS_UI_TEXT, CANVAS_UI_SHADOW);

    // Row 2: ult / alive (isolated from name)
    this.ctx.textAlign = "left";
    this.ctx.font = "600 8px Inter";
    this.drawHudText(ultLabel, x + 7, y + height - 6, this.getHudStatusColor(status), CANVAS_UI_SHADOW);
  }

  private getRivalUltLabel(playerId: PlayerId, status: HudPlayerStatus): string {
    const player = this.players[playerId];
    if (!player.alive) {
      return "DOWN";
    }
    if (status.tone === "danger" && status.critical) {
      return status.label;
    }
    if (!player.skill.id) {
      return player.alive ? "LIVE" : "DOWN";
    }
    const phase = player.skill.phase;
    if (phase === "channeling" || phase === "releasing") {
      return "CAST";
    }
    if (phase === "cooldown" && player.skill.cooldownRemainingMs > 0) {
      return `ULT ${(player.skill.cooldownRemainingMs / 1000).toFixed(1)}`;
    }
    if (phase === "idle") {
      return this.language === "pt" ? "ULT OK" : "ULT RDY";
    }
    return "LIVE";
  }

  /**
   * Local player panel: YOU + name, alive status, icon+number power slots, skill chip.
   * Does not rely on a single jammed "B 2 · F 3 · S 1" string for primary stats.
   */
  private renderLocalPlayerHud(
    playerId: PlayerId,
    x: number,
    y: number,
    width: number,
    height: number,
  ): void {
    const player = this.players[playerId];
    const palette = PLAYER_COLORS[playerId];
    const status = this.getPlayerHudStatus(playerId);
    const recentPickup = this.getLatestPowerUpPickupNotice(playerId);
    const nameBudget = width < 520 ? HUD_LAYOUT.localNameMax - 4 : HUD_LAYOUT.localNameMax;
    const nameText = recentPickup
      ? this.formatPowerUpPickupNotice(recentPickup, nameBudget)
      : this.getCharacterLabel(playerId, nameBudget);
    const nameColor = recentPickup
      ? (recentPickup.chainGuard ? CANVAS_UI_GOLD_BRIGHT : getPowerUpDefinition(recentPickup.type).tint)
      : CANVAS_UI_TEXT;
    const youLabel = this.language === "pt" ? "VOCÊ" : "YOU";
    // Absolute B/F/S counts as icon+number slots (not jammed "B 2 · F 3 · S 1").
    const skillSlots = this.getLocalHudPowerSlots(playerId);
    const hasUltimate = Boolean(player.skill.id);

    this.drawHudPanel(x, y, width, height, palette.glow);

    // Left identity band (~190px): YOU + name on top, status + score on bottom
    const identityWidth = 190;
    this.ctx.textAlign = "left";
    this.ctx.font = "700 10px Inter";
    this.drawHudText(youLabel, x + 8, y + 14, palette.primary, CANVAS_UI_SHADOW);
    this.ctx.font = "600 9px Inter";
    this.drawHudText(nameText, x + 46, y + 14, nameColor, CANVAS_UI_SHADOW);

    this.ctx.font = "700 9px Inter";
    this.drawHudText(
      status.label,
      x + 8,
      y + height - 8,
      this.getHudStatusColor(status),
      CANVAS_UI_SHADOW,
    );

    if (this.onlineRoomMode === "endless") {
      this.drawEndlessHudStats(x + 100, y + height - 8, playerId, palette);
    } else {
      this.drawRoundPips(x + 100, y + height - 16, this.score[playerId], palette);
    }

    // Center/right: power slots (icon + level) — primary stat presentation
    const rightPad = 8;
    const ultChipWidth = hasUltimate ? 52 : 0;
    const ultGap = hasUltimate ? 6 : 0;
    const slotsLeft = x + identityWidth + 8;
    const slotsRight = x + width - rightPad - ultChipWidth - ultGap;
    const slotsWidth = Math.max(80, slotsRight - slotsLeft);
    const slotGap = 4;
    const slotCount = Math.max(1, skillSlots.length);
    const slotW = Math.max(30, Math.min(52, Math.floor((slotsWidth - slotGap * (slotCount - 1)) / slotCount)));
    const slotH = 18;
    const slotY = y + Math.round((height - slotH) / 2);
    for (let index = 0; index < skillSlots.length; index += 1) {
      const slot = skillSlots[index];
      if (!slot) continue;
      const slotX = slotsLeft + index * (slotW + slotGap);
      this.drawHudSkillSlot(slotX, slotY, slotW, slotH, slot);
    }

    if (hasUltimate) {
      // Skill chip: cooldown / ready — name is implied by champion; status on chip
      this.drawHudUltimateChip(
        x + width - rightPad - ultChipWidth,
        slotY - 1,
        ultChipWidth,
        slotH + 2,
        playerId,
      );
    }
  }

  /** Compact ultimate cooldown chip (ULT RDY / ULT 5.2s / CAST). */
  private drawHudUltimateChip(
    x: number,
    y: number,
    width: number,
    height: number,
    playerId: PlayerId,
  ): void {
    const player = this.players[playerId];
    if (!player?.skill.id) {
      return;
    }
    const phase = player.skill.phase;
    const ready = phase === "idle";
    const casting = phase === "channeling" || phase === "releasing";
    const onCooldown = phase === "cooldown" && player.skill.cooldownRemainingMs > 0;

    let fill = "rgba(180, 167, 147, 0.22)";
    let border = CANVAS_UI_BORDER;
    let label = this.language === "pt" ? "ULT" : "ULT";
    let progress = 0;

    if (ready) {
      fill = "rgba(80, 200, 120, 0.28)";
      border = CANVAS_UI_SUCCESS;
      label = this.language === "pt" ? "OK" : "RDY";
      progress = 1;
    } else if (casting) {
      fill = "rgba(120, 200, 255, 0.35)";
      border = "rgba(120, 220, 255, 0.95)";
      const total = Math.max(1, player.skill.castElapsedMs + player.skill.channelRemainingMs);
      progress = Math.max(0, Math.min(1, player.skill.castElapsedMs / total));
      label = this.language === "pt" ? "CAST" : "CAST";
    } else if (onCooldown) {
      fill = "rgba(40, 36, 32, 0.85)";
      border = CANVAS_UI_MUTED;
      // Prefer definition cooldown when available so the bar is accurate.
      const totalCd = Math.max(
        player.skill.cooldownRemainingMs,
        this.getCharacterSkillCooldownMs(playerId) || player.skill.cooldownRemainingMs,
      );
      progress = 1 - Math.max(0, Math.min(1, player.skill.cooldownRemainingMs / totalCd));
      label = `${(player.skill.cooldownRemainingMs / 1000).toFixed(1)}`;
    }

    this.ctx.fillStyle = CANVAS_UI_PANEL_BG_STRONG;
    this.ctx.fillRect(x, y, width, height);
    if (progress > 0) {
      this.ctx.fillStyle = fill;
      this.ctx.fillRect(x, y, Math.max(1, width * progress), height);
    }
    this.ctx.strokeStyle = border;
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(x + 0.5, y + 0.5, Math.max(1, width - 1), Math.max(1, height - 1));

    // Never concatenate keybind + status ("SPC OK") — unreadable soup.
    // Chip is status only; keybind is implied for the local player.
    this.ctx.textAlign = "center";
    this.ctx.font = "700 8px Inter";
    const text = ready
      ? (this.language === "pt" ? "ULT" : "ULT")
      : label;
    this.drawHudText(
      text,
      x + width / 2,
      y + Math.max(8, height - 3),
      ready || casting ? CANVAS_UI_TEXT : CANVAS_UI_MUTED,
      CANVAS_UI_SHADOW,
    );
  }

  private getCharacterSkillCooldownMs(playerId: PlayerId): number {
    const skillId = this.getPlayerSkillId(playerId);
    if (!skillId) {
      return 0;
    }
    return getCharacterSkillDefinition(skillId)?.cooldownMs ?? 0;
  }

  private drawRoundPips(
    x: number,
    y: number,
    wins: number,
    palette: { primary: string; secondary: string; glow: string },
  ): void {
    for (let index = 0; index < TARGET_WINS; index += 1) {
      const centerX = x + 5 + index * 12;
      const filled = index < wins;
      this.ctx.beginPath();
      this.ctx.arc(centerX, y + 4, 4.5, 0, Math.PI * 2);
      this.ctx.fillStyle = filled ? CANVAS_UI_GOLD_BRIGHT : "rgba(255, 255, 255, 0.08)";
      this.ctx.fill();
      this.ctx.lineWidth = 1;
      this.ctx.strokeStyle = filled ? palette.primary : CANVAS_UI_BORDER;
      this.ctx.stroke();
      if (!filled) {
        continue;
      }
      this.ctx.beginPath();
      this.ctx.arc(centerX, y + 4, 1.75, 0, Math.PI * 2);
      this.ctx.fillStyle = "#fff7df";
      this.ctx.fill();
    }
  }

  private drawEndlessHudStats(
    x: number,
    y: number,
    playerId: PlayerId,
    palette: { primary: string; secondary: string; glow: string },
  ): void {
    this.ctx.textAlign = "left";
    this.ctx.font = "700 6px Inter";
    this.drawHudText(
      `K ${this.endlessKills[playerId]}  W ${this.endlessRoundWins[playerId]}`,
      x,
      y,
      palette.primary,
      CANVAS_UI_SHADOW,
    );
  }

  private getHudSkillSlots(playerId: PlayerId): HudSkillSlot[] {
    return SKILL_POWER_UP_TYPES.map((type) => this.getHudSkillSlot(playerId, type));
  }

  private getCompactHudSkillSlots(allSkillSlots: HudSkillSlot[]): HudSkillSlot[] {
    // Show only acquired powers (plus bomb/flame/speed base row so empty
    // starts still read B/F/S). Never pad with every empty power type.
    const basicTypes: readonly SkillPowerUpType[] = ["bomb-up", "flame-up", "speed-up"];
    const acquired = allSkillSlots.filter((slot) => slot.acquired);
    if (acquired.length === 0) {
      return allSkillSlots.filter((slot) => basicTypes.includes(slot.type));
    }
    const selected = new Set<SkillPowerUpType>(basicTypes);
    for (const slot of acquired) {
      selected.add(slot.type);
      if (selected.size >= 5) break;
    }
    return allSkillSlots.filter((slot) => selected.has(slot.type));
  }

  /** Local panel power row: absolute bomb/flame/speed counts as icon+number. */
  private getLocalHudPowerSlots(playerId: PlayerId): HudSkillSlot[] {
    const player = this.players[playerId];
    const slots = this.getCompactHudSkillSlots(this.getHudSkillSlots(playerId));
    return slots.map((slot) => {
      if (slot.type === "bomb-up") {
        return { ...slot, valueLabel: String(player.maxBombs), acquired: true, level: player.maxBombs };
      }
      if (slot.type === "flame-up") {
        return { ...slot, valueLabel: String(player.flameRange), acquired: true, level: player.flameRange };
      }
      if (slot.type === "speed-up") {
        return {
          ...slot,
          valueLabel: String(player.speedLevel),
          acquired: true,
          level: player.speedLevel,
        };
      }
      return slot;
    });
  }

  private getHudSkillSlot(playerId: PlayerId, type: SkillPowerUpType): HudSkillSlot {
    const player = this.players[playerId];
    const detonateKeyLabel = this.getDetonateHudKeyLabel(playerId);
    const rawLevel = getPowerUpLevel(player, type);
    const level = type === "bomb-up" || type === "flame-up"
      ? Math.max(0, rawLevel - 1)
      : rawLevel;
    const valueLabel = type === "remote-up"
      ? (level > 0 ? "ON" : "--")
      : type === "short-fuse-up"
        ? formatBombFuseSeconds(player)
        : `x${level}`;
    const pickupNotice = this.getPowerUpPickupNotice(playerId, type);

    return {
      type,
      level,
      acquired: level > 0,
      keyLabel: type === "remote-up" && level > 0 ? detonateKeyLabel : null,
      valueLabel,
      recentlyCollected: Boolean(pickupNotice),
      pickupProgress: pickupNotice
        ? Math.max(0, Math.min(1, pickupNotice.remainingMs / POWER_UP_PICKUP_NOTICE_MS))
        : 0,
    } satisfies HudSkillSlot;
  }

  private addPowerUpPickupNotice(
    playerId: PlayerId,
    type: SkillPowerUpType,
    chainGuard = false,
    valueLabel?: string,
  ): void {
    const slot = this.getHudSkillSlot(playerId, type);
    const notice: PowerUpPickupNotice = {
      playerId,
      type,
      valueLabel: valueLabel ?? slot.valueLabel,
      chainGuard,
      elapsedMs: 0,
      remainingMs: POWER_UP_PICKUP_NOTICE_MS,
    };
    this.powerUpPickupNotices = [
      notice,
      ...this.powerUpPickupNotices.filter((entry) => !(entry.playerId === playerId && entry.type === type)),
    ].slice(0, 6);
  }

  private getLatestPowerUpPickupNotice(playerId: PlayerId): PowerUpPickupNotice | null {
    return this.powerUpPickupNotices.find((notice) => notice.playerId === playerId) ?? null;
  }

  private getPowerUpPickupNotice(playerId: PlayerId, type: SkillPowerUpType): PowerUpPickupNotice | null {
    return this.powerUpPickupNotices.find((notice) => (
      notice.playerId === playerId && notice.type === type
    )) ?? null;
  }

  private formatPowerUpPickupNotice(notice: PowerUpPickupNotice, maxLength: number): string {
    const definition = getPowerUpDefinition(notice.type);
    if (notice.chainGuard) {
      return maxLength <= 8 ? "CHAIN!" : `CHAIN ${definition.shortLabel} ${notice.valueLabel}`;
    }
    if (notice.type === "short-fuse-up") {
      return `${definition.shortLabel} ${notice.valueLabel}`;
    }
    const label = maxLength <= 8 ? definition.shortLabel : definition.label;
    return this.shortenCharacterName(`+${label} ${notice.valueLabel}`, maxLength);
  }

  private getDetonateHudKeyLabel(playerId: PlayerId): string | null {
    if (this.onlineSession) {
      if (playerId !== this.onlineLocalPlayerId) {
        return null;
      }
      return formatControlKey(KEY_BINDINGS[1].detonate);
    }
    if (MENU_PLAYER_IDS.includes(playerId as MenuPlayerId)) {
      return formatControlKey(KEY_BINDINGS[playerId as MenuPlayerId].detonate);
    }
    return null;
  }

  private getPlayerHudStatus(playerId: PlayerId): HudPlayerStatus {
    const player = this.players[playerId];
    if (!player.alive) {
      return { label: "DOWN", tone: "muted", critical: false, dangerEtaMs: null };
    }
    if (player.skill.phase === "channeling" || player.skill.phase === "releasing") {
      const championStatus = this.championVisuals.getHudStatus(player, this.language);
      if (championStatus) return championStatus;
      const castSec = Math.max(0, player.skill.channelRemainingMs / 1000);
      return {
        label: this.language === "pt"
          ? `ULT ${castSec.toFixed(1)}s`
          : `ULT ${castSec.toFixed(1)}s`,
        tone: "success",
        critical: false,
        dangerEtaMs: null,
      };
    }
    if (player.flameGuardMs > 0) {
      return {
        label: `GUARD ${(player.flameGuardMs / 1000).toFixed(1)}s`,
        tone: "success",
        critical: false,
        dangerEtaMs: null,
      };
    }

    const dangerEtaMs = this.getPlayerDangerEtaMs(playerId);
    if (dangerEtaMs !== null && dangerEtaMs <= HUD_CRITICAL_DANGER_MS) {
      const roundedDangerEtaMs = Math.max(0, Math.round(dangerEtaMs));
      return {
        label: `DANGER ${(roundedDangerEtaMs / 1000).toFixed(1)}s`,
        tone: "danger",
        critical: true,
        dangerEtaMs: roundedDangerEtaMs,
      };
    }

    // Character ultimate cooldown — always visible while recharging.
    if (
      player.skill.id &&
      player.skill.phase === "cooldown" &&
      player.skill.cooldownRemainingMs > 0
    ) {
      const cdSec = player.skill.cooldownRemainingMs / 1000;
      return {
        label: this.language === "pt"
          ? `ULT ${cdSec.toFixed(1)}s`
          : `ULT ${cdSec.toFixed(1)}s`,
        tone: "muted",
        critical: false,
        dangerEtaMs: null,
      };
    }

    const pickupChain = this.pickupChains[playerId];
    if (pickupChain.previousType !== null && pickupChain.remainingMs > 0) {
      return {
        label: `CHAIN ${(pickupChain.remainingMs / 1000).toFixed(1)}s`,
        tone: "success",
        critical: false,
        dangerEtaMs: null,
      };
    }

    if (player.skill.id && player.skill.phase === "idle") {
      return {
        label: this.language === "pt" ? "ULT OK" : "ULT RDY",
        tone: "success",
        critical: false,
        dangerEtaMs: null,
      };
    }

    return { label: "LIVE", tone: "success", critical: false, dangerEtaMs: null };
  }

  private getHudStatusColor(status: HudPlayerStatus): string {
    if (status.tone === "danger") {
      return CANVAS_UI_DANGER;
    }
    if (status.tone === "muted") {
      return CANVAS_UI_MUTED_SOFT;
    }
    return CANVAS_UI_SUCCESS;
  }

  private getPlayerDangerEtaMs(playerId: PlayerId): number | null {
    if (this.mode !== "match" || this.roundOutcome) {
      return null;
    }

    const player = this.players[playerId];
    if (!player.alive || player.spawnProtectionMs > 0 || player.flameGuardMs > 0) {
      return null;
    }

    const tile = this.getTileFromPosition(player.position);
    const dangerMap = this.cachedDangerMap ?? this.getDangerMap();
    const etaMs = dangerMap.get(tileKey(tile.x, tile.y));
    return etaMs === undefined ? null : Math.max(0, etaMs);
  }

  private drawHudSkillSlot(x: number, y: number, width: number, height: number, slot: HudSkillSlot): void {
    const definition = getPowerUpDefinition(slot.type);
    const tint = slot.acquired ? definition.tint : "rgba(180, 167, 147, 0.4)";
    this.ctx.fillStyle = slot.acquired ? CANVAS_UI_PANEL_BG_STRONG : CANVAS_UI_PANEL_BG_SOFT;
    this.ctx.fillRect(x, y, width, height);
    if (slot.recentlyCollected) {
      const pulse = 0.12 + slot.pickupProgress * 0.24;
      this.ctx.globalAlpha = pulse;
      this.ctx.fillStyle = definition.tint;
      this.ctx.fillRect(x, y, width, height);
      this.ctx.globalAlpha = 1;
    }
    this.ctx.strokeStyle = slot.recentlyCollected
      ? definition.tint
      : (slot.acquired ? tint : CANVAS_UI_BORDER);
    this.ctx.lineWidth = slot.recentlyCollected ? 1.5 : 1;
    this.ctx.strokeRect(x + 0.5, y + 0.5, Math.max(1, width - 1), Math.max(1, height - 1));
    this.ctx.lineWidth = 1;

    const iconSize = Math.min(10, height - 2);
    const icon = this.assets.powerUps[slot.type];
    if (icon) {
      this.ctx.globalAlpha = slot.acquired ? 1 : 0.45;
      this.ctx.drawImage(
        icon,
        x + 2,
        y + Math.max(1, (height - iconSize) / 2),
        iconSize,
        iconSize,
      );
      this.ctx.globalAlpha = 1;
    } else {
      this.ctx.textAlign = "left";
      this.ctx.font = "700 7px Inter";
      this.drawHudText(
        definition.shortLabel.slice(0, 1),
        x + 3,
        y + height - 3,
        tint,
        CANVAS_UI_SHADOW,
      );
    }

    // Value only — key labels in chips caused the "SPC OK" overlay mess.
    this.ctx.textAlign = "right";
    this.ctx.font = "700 8px Inter";
    const valueColor = slot.acquired ? CANVAS_UI_TEXT : CANVAS_UI_MUTED_SOFT;
    this.drawHudText(slot.valueLabel, x + width - 3, y + height - 3, valueColor, CANVAS_UI_SHADOW);
  }

  private rebuildArenaStaticCache(): void {
    const logicalArenaWidth = this.getArenaPixelWidth();
    const logicalArenaHeight = this.getArenaPixelHeight();
    if (!this.arenaStaticCache) {
      this.arenaStaticCache = document.createElement("canvas");
    }
    this.arenaStaticCache.width = Math.max(1, Math.ceil(logicalArenaWidth * CANVAS_BACKBUFFER_SCALE));
    this.arenaStaticCache.height = Math.max(1, Math.ceil(logicalArenaHeight * CANVAS_BACKBUFFER_SCALE));
    const c = this.arenaStaticCache.getContext("2d")!;
    c.setTransform(CANVAS_BACKBUFFER_SCALE, 0, 0, CANVAS_BACKBUFFER_SCALE, 0, 0);
    c.clearRect(0, 0, logicalArenaWidth, logicalArenaHeight);

    const savedCtx = this.ctx;
    // Temporarily redirect draw calls to the offscreen canvas
    (this as unknown as { ctx: CanvasRenderingContext2D }).ctx = c;

    const arenaWidth = this.getArenaGridWidth();
    const arenaHeight = this.getArenaGridHeight();
    const centerX = Math.floor(arenaWidth / 2);
    const centerY = Math.floor(arenaHeight / 2);
    const sideColumn = Math.min(2, arenaWidth - 3);
    const farSideColumn = Math.max(arenaWidth - 3, sideColumn + 1);
    const sideRow = Math.min(2, arenaHeight - 3);
    const farSideRow = Math.max(arenaHeight - 3, sideRow + 1);
    for (let y = 0; y < arenaHeight; y += 1) {
      for (let x = 0; x < arenaWidth; x += 1) {
        const screenX = x * TILE_SIZE;
        const screenY = y * TILE_SIZE;
        const key = tileKey(x, y);
        const isWrapPortal = isWrapPortalTile(x, y, this.arena.config);
        const isCenterLane = x === centerX || y === centerY;
        const isSideLane = x === sideColumn || x === farSideColumn || y === sideRow || y === farSideRow;
        const isSpawnBay = (x <= 2 && y <= 2)
          || (x >= arenaWidth - 3 && y <= 2)
          || (x <= 2 && y >= arenaHeight - 3)
          || (x >= arenaWidth - 3 && y >= arenaHeight - 3);
        const floorVariant = isSpawnBay
          ? "spawn"
          : isWrapPortal
            ? "portal"
            : isCenterLane || isSideLane
              ? "lane"
              : "base";
        const floorSprite = isSpawnBay
          ? this.assets.floor.spawn
          : isWrapPortal || isCenterLane || isSideLane
            ? this.assets.floor.lane
            : this.assets.floor.base;
        if (floorSprite) {
          c.drawImage(floorSprite, screenX, screenY, TILE_SIZE, TILE_SIZE);
        } else {
          this.drawArenaFloorTile(screenX, screenY, floorVariant, (x + y) % 2);
        }

        if (this.arena.solid.has(key)) {
          if (this.suddenDeathClosedTiles.has(key)) {
            this.drawSuddenDeathClosedSlot(screenX, screenY);
          } else {
            this.drawWall(screenX, screenY);
          }
        } else if (this.arena.breakable.has(key)) {
          this.drawCrate(screenX, screenY);
        } else if (isWrapPortal) {
          c.strokeStyle = this.getArenaPalette().portalRing;
          c.strokeRect(screenX + 7.5, screenY + 7.5, TILE_SIZE - 15, TILE_SIZE - 15);
        }
      }
    }

    c.strokeStyle = this.getArenaPalette().arenaFrame;
    c.strokeRect(
      -0.5,
      -0.5,
      arenaWidth * TILE_SIZE + 1,
      arenaHeight * TILE_SIZE + 1,
    );

    c.fillStyle = this.getArenaPalette().arenaGlow;
    c.fillRect(0, 0, arenaWidth * TILE_SIZE, arenaHeight * TILE_SIZE);

    // Restore the real context
    (this as unknown as { ctx: CanvasRenderingContext2D }).ctx = savedCtx;
    this.arenaStaticDirty = false;
  }

  private invalidateArenaCache(): void {
    this.arenaStaticDirty = true;
    this.backdropCache = null;
    this.arenaStaticMistGradient = null;
  }

  private renderArena(): void {
    // Blit cached static layer (floor, walls, crates)
    if (this.arenaStaticDirty || !this.arenaStaticCache) {
      this.rebuildArenaStaticCache();
    }
    const metrics = this.getArenaRenderMetrics();
    const logicalArenaWidth = this.getArenaPixelWidth();
    const logicalArenaHeight = this.getArenaPixelHeight();
    this.ctx.save();
    this.ctx.translate(metrics.arenaX, metrics.arenaY);
    this.ctx.scale(metrics.scale, metrics.scale);
    this.ctx.drawImage(this.arenaStaticCache!, 0, 0, logicalArenaWidth, logicalArenaHeight);

    // Dynamic elements drawn on top every frame
    for (const effect of this.crateBreakAnimations) {
      this.drawCrateBreakAnimation(effect);
    }

    this.drawDangerOverlay();
    this.drawBombPreviewOverlay();

    for (const powerUp of this.arena.powerUps) {
      if (powerUp.revealed && !powerUp.collected) {
        this.drawPowerUp(powerUp);
      }
    }

    for (const bomb of this.bombs) {
      this.drawBomb(bomb);
    }

    this.drawExplosionFeedback();

    for (const flame of this.flames) {
      this.drawFlame(flame);
    }

    for (const id of ALL_PLAYER_IDS) {
      this.drawPlayerSkillPreview(this.players[id]);
    }

    for (const effect of this.championWorldEffects) {
      this.drawChampionWorldEffect(effect);
    }

    for (const id of ALL_PLAYER_IDS) {
      this.drawPlayer(this.players[id]);
    }

    this.drawPlayerFlameOcclusionIndicators();

    for (const effect of this.suddenDeathClosureEffects) {
      this.drawSuddenDeathClosureEffect(effect);
    }

    // Arena mist overlay (single pre-cached gradient)
    if (!this.arenaStaticMistGradient) {
      const palette = this.getArenaPalette();
      this.arenaStaticMistGradient = this.ctx.createLinearGradient(0, 0, 0, logicalArenaHeight);
      this.arenaStaticMistGradient.addColorStop(0, palette.arenaMistTop);
      this.arenaStaticMistGradient.addColorStop(0.35, "rgba(74, 108, 153, 0)");
      this.arenaStaticMistGradient.addColorStop(1, palette.arenaMistBottom);
    }
    this.ctx.fillStyle = this.arenaStaticMistGradient;
    this.ctx.fillRect(0, 0, logicalArenaWidth, logicalArenaHeight);
    this.ctx.restore();
  }

  private getArenaPalette(): ArenaThemePalette {
    return this.getArenaThemeDefinition()?.palette
      ?? getArenaThemeById(DEFAULT_ARENA_THEME_ID)?.palette
      ?? getArenaThemeById("arcane-citadel")!.palette;
  }

  private getArenaThemeDefinition() {
    return getArenaThemeById(this.arena.config.themeId)
      ?? this.assets.arenaTheme
      ?? getArenaThemeById(DEFAULT_ARENA_THEME_ID)
      ?? getArenaThemeById("arcane-citadel")!;
  }

  private drawArenaFloorTile(
    x: number,
    y: number,
    variant: "base" | "lane" | "spawn" | "portal",
    checker: number,
  ): void {
    const theme = this.getArenaThemeDefinition();
    const palette = theme.palette;
    let outer = checker === 0 ? palette.floorBase : palette.floorBaseAlt;
    let inner = checker === 0 ? palette.floorBaseAlt : palette.floorBase;
    if (variant === "lane") {
      outer = checker === 0 ? palette.floorLane : palette.floorLaneAlt;
      inner = checker === 0 ? palette.floorLaneAlt : palette.floorLane;
    } else if (variant === "spawn") {
      outer = checker === 0 ? palette.floorSpawn : palette.floorSpawnAlt;
      inner = checker === 0 ? palette.floorSpawnAlt : palette.floorSpawn;
    } else if (variant === "portal") {
      outer = checker === 0 ? palette.floorPortal : palette.floorPortalAlt;
      inner = checker === 0 ? palette.floorPortalAlt : palette.floorPortal;
    }

    this.ctx.fillStyle = outer;
    this.ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
    this.ctx.fillStyle = inner;
    this.ctx.fillRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
    this.ctx.fillStyle = palette.floorEdgeLight;
    this.ctx.fillRect(x + 2, y + 2, TILE_SIZE - 4, 2);
    this.ctx.fillRect(x + 2, y + 2, 2, TILE_SIZE - 4);
    this.ctx.fillStyle = palette.floorEdgeDark;
    this.ctx.fillRect(x + 2, y + TILE_SIZE - 4, TILE_SIZE - 4, 2);
    this.ctx.fillRect(x + TILE_SIZE - 4, y + 2, 2, TILE_SIZE - 4);
    this.ctx.strokeStyle = palette.floorBorder;
    this.ctx.strokeRect(x + 0.5, y + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);

    if (variant === "base") {
      this.ctx.fillStyle = palette.floorCenterMark;
      if (theme.motif.floorPattern === "diamond") {
        this.ctx.beginPath();
        this.ctx.moveTo(x + TILE_SIZE * 0.5, y + 12);
        this.ctx.lineTo(x + TILE_SIZE - 12, y + TILE_SIZE * 0.5);
        this.ctx.lineTo(x + TILE_SIZE * 0.5, y + TILE_SIZE - 12);
        this.ctx.lineTo(x + 12, y + TILE_SIZE * 0.5);
        this.ctx.closePath();
        this.ctx.fill();
      } else if (theme.motif.floorPattern === "vein") {
        this.ctx.fillRect(x + 9, y + 18, TILE_SIZE - 18, 2);
        this.ctx.fillRect(x + 15, y + 10, 2, TILE_SIZE - 20);
        this.ctx.fillRect(x + 23, y + 14, 2, 10);
      } else {
        this.ctx.fillRect(x + 14, y + 14, TILE_SIZE - 28, TILE_SIZE - 28);
      }
      return;
    }

    if (variant === "lane") {
      this.ctx.fillStyle = palette.floorCenterMark;
      if (theme.motif.lanePattern === "stripe") {
        this.ctx.fillRect(x + 8, y + 11, 4, TILE_SIZE - 22);
        this.ctx.fillRect(x + TILE_SIZE - 12, y + 11, 4, TILE_SIZE - 22);
        this.ctx.fillRect(x + 17, y + 8, 6, TILE_SIZE - 16);
      } else if (theme.motif.lanePattern === "chevron") {
        this.ctx.beginPath();
        this.ctx.moveTo(x + 10, y + 16);
        this.ctx.lineTo(x + 18, y + 10);
        this.ctx.lineTo(x + 26, y + 16);
        this.ctx.lineTo(x + 22, y + 16);
        this.ctx.lineTo(x + 18, y + 13);
        this.ctx.lineTo(x + 14, y + 16);
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.beginPath();
        this.ctx.moveTo(x + 10, y + 24);
        this.ctx.lineTo(x + 18, y + 18);
        this.ctx.lineTo(x + 26, y + 24);
        this.ctx.lineTo(x + 22, y + 24);
        this.ctx.lineTo(x + 18, y + 21);
        this.ctx.lineTo(x + 14, y + 24);
        this.ctx.closePath();
        this.ctx.fill();
      } else {
        this.ctx.fillRect(x + 10, y + 17, TILE_SIZE - 20, 6);
        this.ctx.fillRect(x + 17, y + 10, 6, TILE_SIZE - 20);
      }
      return;
    }

    this.ctx.save();
    this.ctx.lineWidth = 2;
    this.ctx.strokeStyle = variant === "spawn" ? palette.spawnRing : palette.portalRing;
    if (theme.motif.spawnPattern === "diamond") {
      this.ctx.beginPath();
      this.ctx.moveTo(x + TILE_SIZE * 0.5, y + 8);
      this.ctx.lineTo(x + TILE_SIZE - 8, y + TILE_SIZE * 0.5);
      this.ctx.lineTo(x + TILE_SIZE * 0.5, y + TILE_SIZE - 8);
      this.ctx.lineTo(x + 8, y + TILE_SIZE * 0.5);
      this.ctx.closePath();
      this.ctx.stroke();
    } else {
      this.ctx.beginPath();
      this.ctx.arc(x + TILE_SIZE * 0.5, y + TILE_SIZE * 0.5, TILE_SIZE * 0.22, 0, Math.PI * 2);
      this.ctx.stroke();
      if (theme.motif.spawnPattern === "seal") {
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.arc(x + TILE_SIZE * 0.5, y + TILE_SIZE * 0.5, TILE_SIZE * 0.31, 0, Math.PI * 2);
        this.ctx.stroke();
      }
    }
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(x + 10.5, y + 10.5, TILE_SIZE - 21, TILE_SIZE - 21);
    this.ctx.restore();
  }

  private getDangerOverlayTiles(): Array<{ x: number; y: number; etaMs: number }> {
    const dangerMap = this.cachedDangerMap ?? this.getDangerMap();
    const tiles: Array<{ x: number; y: number; etaMs: number }> = [];
    for (const [key, etaMs] of dangerMap.entries()) {
      if (etaMs > DANGER_OVERLAY_MAX_ETA_MS) {
        continue;
      }
      const [xText, yText] = key.split(",");
      const x = Number(xText);
      const y = Number(yText);
      if (Number.isNaN(x) || Number.isNaN(y)) {
        continue;
      }
      if (x < 0 || y < 0 || x >= this.getArenaGridWidth() || y >= this.getArenaGridHeight()) {
        continue;
      }
      if (this.arena.solid.has(key)) {
        continue;
      }
      tiles.push({ x, y, etaMs: Math.max(0, Math.round(etaMs)) });
    }
    tiles.sort((a, b) => a.etaMs - b.etaMs || a.y - b.y || a.x - b.x);
    return tiles;
  }

  private drawDangerOverlay(): void {
    if (!this.showDangerOverlay) {
      return;
    }
    const dangerTiles = this.getDangerOverlayTiles();
    for (const tile of dangerTiles) {
      let fill = "rgba(245, 96, 26, 0.14)";
      let stroke = "rgba(232, 210, 162, 0.34)";
      if (tile.etaMs <= 0) {
        fill = "rgba(255, 62, 62, 0.42)";
        stroke = "rgba(255, 189, 176, 0.72)";
      } else if (tile.etaMs <= 700) {
        fill = "rgba(255, 120, 72, 0.34)";
        stroke = "rgba(255, 216, 186, 0.65)";
      } else if (tile.etaMs <= 1500) {
        fill = "rgba(215, 172, 84, 0.24)";
        stroke = "rgba(247, 229, 177, 0.5)";
      }
      const screenX = tile.x * TILE_SIZE;
      const screenY = tile.y * TILE_SIZE;
      this.ctx.fillStyle = fill;
      this.ctx.fillRect(screenX + 5, screenY + 5, TILE_SIZE - 10, TILE_SIZE - 10);
      this.ctx.strokeStyle = stroke;
      this.ctx.strokeRect(screenX + 5.5, screenY + 5.5, TILE_SIZE - 11, TILE_SIZE - 11);

      const urgency = 1 - Math.min(1, tile.etaMs / DANGER_OVERLAY_MAX_ETA_MS);
      const pulsePeriodMs = DANGER_OVERLAY_PULSE_SLOW_MS
        - urgency * (DANGER_OVERLAY_PULSE_SLOW_MS - DANGER_OVERLAY_PULSE_FAST_MS);
      const pulse = 0.5 + 0.5 * Math.sin((this.animationClockMs / pulsePeriodMs) * Math.PI * 2);
      const markerY = screenY + TILE_SIZE - 7 - Math.round(pulse * (TILE_SIZE - 14));
      this.ctx.save();
      this.ctx.globalAlpha = 0.36 + urgency * 0.34 + pulse * 0.18;
      this.ctx.strokeStyle = stroke;
      this.ctx.lineWidth = 1.5;
      this.ctx.beginPath();
      this.ctx.moveTo(screenX + 9, screenY + TILE_SIZE - 9);
      this.ctx.lineTo(screenX + TILE_SIZE - 9, screenY + 9);
      this.ctx.stroke();
      this.ctx.fillStyle = stroke;
      this.ctx.fillRect(screenX + TILE_SIZE - 7, markerY, 3, 3);
      this.ctx.restore();
    }
  }

  private getBombPreviewPlayerId(): PlayerId {
    if (this.onlineSession) {
      return this.onlineLocalPlayerId;
    }
    if (this.automationMode) {
      return this.automationControlledPlayer;
    }
    return 1;
  }

  private getBombPreviewTiles(playerId: PlayerId): TileCoord[] {
    if (!this.showBombPreview || this.mode !== "match") {
      return [];
    }
    const player = this.players[playerId];
    if (!player.alive || player.activeBombs >= player.maxBombs) {
      return [];
    }
    const origin = this.getTileFromPosition(player.position);
    const originKey = tileKey(origin.x, origin.y);
    if (this.bombs.some((bomb) => tileKey(bomb.tile.x, bomb.tile.y) === originKey)) {
      return [];
    }
    const blastKeys = this.getBombBlastKeys(origin, player.flameRange);
    const tiles: TileCoord[] = [];
    for (const key of blastKeys) {
      const [xText, yText] = key.split(",");
      const x = Number(xText);
      const y = Number(yText);
      if (
        Number.isNaN(x)
        || Number.isNaN(y)
        || x < 0
        || y < 0
        || x >= this.getArenaGridWidth()
        || y >= this.getArenaGridHeight()
      ) {
        continue;
      }
      tiles.push({ x, y });
    }
    tiles.sort((a, b) => a.y - b.y || a.x - b.x);
    return tiles;
  }

  private drawBombPreviewOverlay(): void {
    if (!this.showBombPreview || this.mode !== "match" || this.roundOutcome || this.paused) {
      return;
    }
    const previewPlayerId = this.getBombPreviewPlayerId();
    const previewTiles = this.getBombPreviewTiles(previewPlayerId);
    if (previewTiles.length === 0) {
      return;
    }
    const origin = this.getTileFromPosition(this.players[previewPlayerId].position);
    for (const tile of previewTiles) {
      const screenX = tile.x * TILE_SIZE;
      const screenY = tile.y * TILE_SIZE;
      const isOrigin = tile.x === origin.x && tile.y === origin.y;
      const isTerminalCrate = this.arena.breakable.has(tileKey(tile.x, tile.y));
      this.ctx.fillStyle = isOrigin
        ? "rgba(255, 128, 64, 0.34)"
        : isTerminalCrate
          ? "rgba(255, 176, 48, 0.38)"
          : "rgba(245, 96, 26, 0.22)";
      this.ctx.fillRect(screenX + 6, screenY + 6, TILE_SIZE - 12, TILE_SIZE - 12);
      this.ctx.strokeStyle = isOrigin
        ? "rgba(255, 243, 212, 0.82)"
        : isTerminalCrate
          ? "rgba(255, 238, 168, 0.9)"
          : "rgba(236, 214, 168, 0.56)";
      this.ctx.strokeRect(screenX + 6.5, screenY + 6.5, TILE_SIZE - 13, TILE_SIZE - 13);
    }
  }

  private drawWall(x: number, y: number): void {
    if (this.assets.props.wall) {
      this.ctx.fillStyle = "rgba(8, 10, 14, 0.35)";
      this.ctx.fillRect(x + 1, y + TILE_SIZE - 5, TILE_SIZE - 2, 5);
      this.ctx.drawImage(this.assets.props.wall, x, y, TILE_SIZE, TILE_SIZE);
      this.ctx.fillStyle = "rgba(226, 221, 190, 0.08)";
      this.ctx.fillRect(x + 1, y + 1, TILE_SIZE - 2, 2);
      return;
    }
    const theme = this.getArenaThemeDefinition();
    const palette = theme.palette;
    this.ctx.fillStyle = palette.wallShadow;
    this.ctx.fillRect(x + 2, y + TILE_SIZE - 5, TILE_SIZE - 4, 4);
    this.ctx.fillStyle = palette.wallOuter;
    this.ctx.fillRect(x + 2, y + 3, TILE_SIZE - 4, TILE_SIZE - 6);
    this.ctx.fillStyle = palette.wallInner;
    this.ctx.fillRect(x + 5, y + 9, TILE_SIZE - 10, TILE_SIZE - 17);
    this.ctx.fillStyle = palette.wallTop;
    this.ctx.fillRect(x + 3, y + 4, TILE_SIZE - 6, 6);
    this.ctx.fillStyle = palette.wallAccent;
    if (theme.motif.wallStyle === "royal") {
      this.ctx.fillRect(x + 6, y + 11, TILE_SIZE - 12, 2);
      this.ctx.fillRect(x + 6, y + 18, TILE_SIZE - 12, 2);
      this.ctx.fillRect(x + 11, y + 8, 2, TILE_SIZE - 18);
      this.ctx.fillRect(x + TILE_SIZE - 13, y + 8, 2, TILE_SIZE - 18);
    } else if (theme.motif.wallStyle === "frost") {
      this.ctx.fillRect(x + 8, y + 11, TILE_SIZE - 16, 2);
      this.ctx.fillRect(x + 11, y + 16, TILE_SIZE - 22, 2);
      this.ctx.fillRect(x + 14, y + 21, TILE_SIZE - 28, 2);
    } else if (theme.motif.wallStyle === "obsidian") {
      this.ctx.fillRect(x + 7, y + 12, TILE_SIZE - 14, 1);
      this.ctx.fillRect(x + 9, y + 17, TILE_SIZE - 18, 1);
      this.ctx.fillRect(x + 13, y + 22, TILE_SIZE - 26, 1);
    } else {
      this.ctx.fillRect(x + 7, y + 12, TILE_SIZE - 14, 2);
      this.ctx.fillRect(x + 11, y + 17, TILE_SIZE - 22, 2);
    }
    this.ctx.strokeStyle = palette.wallBorder;
    this.ctx.strokeRect(x + 2.5, y + 3.5, TILE_SIZE - 5, TILE_SIZE - 7);
  }

  private drawSuddenDeathClosedSlot(x: number, y: number): void {
    this.drawWall(x, y);
    const palette = this.getArenaPalette();
    this.ctx.fillStyle = palette.suddenDeathWash;
    this.ctx.fillRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
    this.ctx.strokeStyle = palette.suddenDeathStroke;
    this.ctx.strokeRect(x + 4.5, y + 4.5, TILE_SIZE - 9, TILE_SIZE - 9);
  }

  private drawSuddenDeathClosureEffect(effect: SuddenDeathClosureEffect): void {
    const x = effect.tile.x * TILE_SIZE;
    const y = effect.tile.y * TILE_SIZE;
    const fallProgress = Math.min(1, effect.elapsedMs / SUDDEN_DEATH_FALL_MS);
    const dropOffset = effect.impacted
      ? 0
      : Math.round((1 - fallProgress) * (1 - fallProgress) * TILE_SIZE * 1.8);

    this.ctx.save();
    this.ctx.fillStyle = `rgba(12, 10, 14, ${effect.impacted ? 0.34 : 0.18 + fallProgress * 0.22})`;
    this.ctx.beginPath();
    this.ctx.ellipse(
      x + TILE_SIZE * 0.5,
      y + TILE_SIZE * 0.82,
      TILE_SIZE * 0.38,
      TILE_SIZE * 0.12,
      0,
      0,
      Math.PI * 2,
    );
    this.ctx.fill();

    this.ctx.globalAlpha = effect.impacted ? 1 : Math.max(0.66, 0.78 + fallProgress * 0.22);
    this.drawSuddenDeathClosedSlot(x, y - dropOffset);
    this.ctx.restore();

    if (!effect.impacted) {
      return;
    }

    const impactProgress = Math.min(1, Math.max(0, effect.elapsedMs - SUDDEN_DEATH_FALL_MS) / SUDDEN_DEATH_IMPACT_LINGER_MS);
    const glowAlpha = Math.max(0, 0.28 * (1 - impactProgress));
    if (glowAlpha <= 0) {
      return;
    }
    this.ctx.fillStyle = `rgba(255, 196, 134, ${glowAlpha})`;
    this.ctx.fillRect(x + 3, y + 3, TILE_SIZE - 6, TILE_SIZE - 6);
  }

  private drawCrate(x: number, y: number): void {
    if (this.assets.props.crate) {
      this.ctx.fillStyle = "rgba(10, 6, 2, 0.28)";
      this.ctx.fillRect(x + 2, y + TILE_SIZE - 4, TILE_SIZE - 4, 4);
      this.ctx.drawImage(this.assets.props.crate, x, y, TILE_SIZE, TILE_SIZE);
      return;
    }
    const theme = this.getArenaThemeDefinition();
    const palette = theme.palette;
    this.ctx.fillStyle = palette.crateShadow;
    this.ctx.fillRect(x + 3, y + TILE_SIZE - 5, TILE_SIZE - 6, 4);
    this.ctx.fillStyle = palette.crateOuter;
    this.ctx.fillRect(x + 4, y + 5, TILE_SIZE - 8, TILE_SIZE - 10);
    this.ctx.fillStyle = palette.crateInner;
    this.ctx.fillRect(x + 7, y + 8, TILE_SIZE - 14, TILE_SIZE - 16);
    this.ctx.fillStyle = palette.crateBand;
    if (theme.motif.crateStyle === "trimmed") {
      this.ctx.fillRect(x + 8, y + 8, TILE_SIZE - 16, 2);
      this.ctx.fillRect(x + 8, y + TILE_SIZE - 10, TILE_SIZE - 16, 2);
      this.ctx.fillRect(x + 8, y + 8, 2, TILE_SIZE - 16);
      this.ctx.fillRect(x + TILE_SIZE - 10, y + 8, 2, TILE_SIZE - 16);
    } else if (theme.motif.crateStyle === "expedition") {
      this.ctx.fillRect(x + 15, y + 6, 3, TILE_SIZE - 12);
      this.ctx.fillRect(x + 22, y + 6, 3, TILE_SIZE - 12);
      this.ctx.fillRect(x + 6, y + 18, TILE_SIZE - 12, 3);
    } else {
      this.ctx.fillRect(x + 16, y + 6, 4, TILE_SIZE - 12);
      this.ctx.fillRect(x + 6, y + 16, TILE_SIZE - 12, 4);
    }
    this.ctx.fillStyle = palette.crateMark;
    if (theme.motif.crateStyle === "trimmed") {
      this.ctx.fillRect(x + 11, y + 12, TILE_SIZE - 22, 2);
      this.ctx.fillRect(x + 11, y + 20, TILE_SIZE - 22, 2);
    } else if (theme.motif.crateStyle === "expedition") {
      this.ctx.fillRect(x + 9, y + 11, TILE_SIZE - 18, 2);
      this.ctx.fillRect(x + 13, y + 23, TILE_SIZE - 26, 2);
    } else {
      this.ctx.fillRect(x + 9, y + 10, TILE_SIZE - 18, 2);
      this.ctx.fillRect(x + 10, y + 22, TILE_SIZE - 20, 2);
    }
  }

  private drawCrateBreakAnimation(effect: CrateBreakAnimation): void {
    const x = effect.tile.x * TILE_SIZE;
    const y = effect.tile.y * TILE_SIZE;
    const frames = this.assets.props.crateBreakFrames ?? [];
    if (frames.length > 0) {
      const frameMs = Math.max(1, Math.floor(CRATE_BREAK_DURATION_MS / frames.length));
      const frame = pickAnimationFrame(frames, effect.elapsedMs, frameMs, "hold");
      if (frame) {
        this.ctx.save();
        this.ctx.globalAlpha = Math.max(0.58, 1 - (effect.elapsedMs / CRATE_BREAK_DURATION_MS) * 0.3);
        this.ctx.drawImage(frame, x, y, TILE_SIZE, TILE_SIZE);
        this.ctx.restore();
        return;
      }
    }

    // Fallback dust pulse when no sprite sheet is available.
    const progress = Math.min(1, effect.elapsedMs / CRATE_BREAK_DURATION_MS);
    const radius = 4 + progress * 10;
    this.ctx.fillStyle = `rgba(214, 168, 119, ${Math.max(0, 0.34 - progress * 0.24)})`;
    this.ctx.beginPath();
    this.ctx.arc(x + TILE_SIZE * 0.5, y + TILE_SIZE * 0.55, radius, 0, Math.PI * 2);
    this.ctx.fill();

    const fragments = [
      { offsetX: -8, offsetY: -4, driftX: -8, driftY: -7, size: 3 },
      { offsetX: 7, offsetY: -5, driftX: 7, driftY: -9, size: 3 },
      { offsetX: -5, offsetY: 5, driftX: -6, driftY: 5, size: 2 },
      { offsetX: 6, offsetY: 4, driftX: 8, driftY: 6, size: 2 },
    ];
    this.ctx.fillStyle = `rgba(151, 99, 55, ${Math.max(0, 0.82 - progress * 0.7)})`;
    for (const fragment of fragments) {
      const fragmentX = Math.round(x + TILE_SIZE * 0.5 + fragment.offsetX + fragment.driftX * progress);
      const fragmentY = Math.round(y + TILE_SIZE * 0.5 + fragment.offsetY + fragment.driftY * progress);
      this.ctx.fillRect(fragmentX, fragmentY, fragment.size, fragment.size);
    }
  }

  private drawPowerUp(powerUp: PowerUpState): void {
    const x = powerUp.tile.x * TILE_SIZE;
    const y = powerUp.tile.y * TILE_SIZE;
    const definition = getPowerUpDefinition(powerUp.type);
    const revealStartedAtMs = this.powerUpRevealStartedAtMs.get(powerUp);
    const revealElapsedMs = revealStartedAtMs === undefined
      ? POWER_UP_SPAWN_POP_MS
      : Math.max(0, this.animationClockMs - revealStartedAtMs);
    const revealProgress = Math.min(1, revealElapsedMs / POWER_UP_SPAWN_POP_MS);
    const revealHaloProgress = Math.min(1, revealElapsedMs / POWER_UP_REVEAL_HALO_MS);
    const revealPeakProgress = 0.58;
    const popScale = revealProgress < revealPeakProgress
      ? 0.72 + (0.36 * Math.sin((revealProgress / revealPeakProgress) * Math.PI * 0.5))
      : 1 + (0.08 * Math.cos(
        ((revealProgress - revealPeakProgress) / (1 - revealPeakProgress)) * Math.PI * 0.5,
      ));

    this.ctx.save();
    if (revealStartedAtMs !== undefined && revealHaloProgress < 1) {
      const haloFade = 1 - revealHaloProgress;
      const centerX = x + TILE_SIZE * 0.5;
      const centerY = y + TILE_SIZE * 0.5;
      const haloRadius = POWER_UP_REVEAL_HALO_START_RADIUS
        + (POWER_UP_REVEAL_HALO_END_RADIUS - POWER_UP_REVEAL_HALO_START_RADIUS) * revealHaloProgress;

      this.ctx.save();
      this.ctx.globalAlpha = 0.72 * haloFade;
      this.ctx.strokeStyle = definition.tint;
      this.ctx.lineWidth = 1.5;
      this.ctx.beginPath();
      this.ctx.arc(centerX, centerY, haloRadius, 0, Math.PI * 2);
      this.ctx.stroke();
      this.ctx.globalAlpha = 0.34 * haloFade;
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.arc(centerX, centerY, Math.max(8, haloRadius - 5), 0, Math.PI * 2);
      this.ctx.stroke();
      this.ctx.restore();
    }
    if (popScale !== 1) {
      this.ctx.translate(x + TILE_SIZE * 0.5, y + TILE_SIZE * 0.5);
      this.ctx.scale(popScale, popScale);
      this.ctx.translate(-(x + TILE_SIZE * 0.5), -(y + TILE_SIZE * 0.5));
    }
    const sprite = this.assets.powerUps[powerUp.type];
    if (sprite) {
      this.ctx.save();
      this.ctx.fillStyle = "rgba(8, 10, 14, 0.66)";
      this.ctx.beginPath();
      this.ctx.arc(x + 16, y + 16, 13, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.strokeStyle = "rgba(255, 244, 214, 0.82)";
      this.ctx.lineWidth = 1.5;
      this.ctx.stroke();
      this.ctx.drawImage(sprite, x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
      this.ctx.restore();
      this.ctx.restore();
      return;
    }

    this.ctx.fillStyle = CANVAS_UI_PANEL_BG_STRONG;
    this.ctx.fillRect(x + 8, y + 8, 16, 16);
    this.ctx.fillStyle = definition.tint;
    this.ctx.fillRect(x + 10, y + 10, 12, 12);
    this.ctx.fillStyle = "#120d06";
    this.ctx.font = "700 10px Inter";
    this.ctx.textAlign = "center";
    this.ctx.fillText(definition.shortLabel, x + 16, y + 19);
    this.ctx.restore();
  }

  private drawBomb(bomb: BombState): void {
    const fuseProgress = 1 - Math.min(1, Math.max(0, bomb.fuseMs) / 3000);
    const smoothUrgency = fuseProgress * fuseProgress * (3 - 2 * fuseProgress);
    const pulseIntervalMs = 80 - smoothUrgency * 32;
    const pulse = 0.6 + 0.4 * Math.sin((bomb.fuseMs / pulseIntervalMs) * Math.PI);
    const armedScale = 1 + (pulse - 0.6) * 0.1;
    const x = bomb.tile.x * TILE_SIZE;
    const y = bomb.tile.y * TILE_SIZE;
    const kickImpact = this.bombKickImpactFeedback.find((effect) => effect.bombId === bomb.id);
    if (kickImpact) {
      const progress = Math.min(1, kickImpact.elapsedMs / KICK_IMPACT_FEEDBACK_MS);
      this.ctx.save();
      this.ctx.strokeStyle = `rgba(255, 232, 138, ${0.9 * (1 - progress)})`;
      this.ctx.lineWidth = 3 - progress * 1.5;
      this.ctx.beginPath();
      this.ctx.arc(
        x + TILE_SIZE / 2,
        y + TILE_SIZE / 2,
        14 + progress * 8,
        0,
        Math.PI * 2,
      );
      this.ctx.stroke();
      this.ctx.restore();
    }
    const isFinalFuse = bomb.fuseMs <= 450;
    if (isFinalFuse) {
      const urgency = 1 - Math.max(0, bomb.fuseMs) / 450;
      const centerX = x + TILE_SIZE / 2;
      const centerY = y + TILE_SIZE / 2;
      const ringRadius = 13 + urgency * 4;
      const orbitAngle = -Math.PI / 2 + urgency * Math.PI * 2;
      this.ctx.save();
      this.ctx.lineCap = "round";
      this.ctx.lineWidth = 1.5 + urgency * 1.5;
      for (let segment = 0; segment < 8; segment += 1) {
        const segmentStart = orbitAngle + segment * (Math.PI / 4);
        this.ctx.strokeStyle = segment % 2 === 0
          ? `rgba(255, 72, 38, ${0.58 + urgency * 0.42})`
          : `rgba(255, 198, 78, ${0.4 + urgency * 0.5})`;
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, ringRadius, segmentStart, segmentStart + Math.PI / 7);
        this.ctx.stroke();
      }
      const sparkX = centerX + Math.cos(orbitAngle) * ringRadius;
      const sparkY = centerY + Math.sin(orbitAngle) * ringRadius;
      this.ctx.fillStyle = `rgba(255, 244, 184, ${0.78 + urgency * 0.22})`;
      this.ctx.shadowColor = "rgba(255, 82, 32, 0.92)";
      this.ctx.shadowBlur = 4 + urgency * 5;
      this.ctx.beginPath();
      this.ctx.arc(sparkX, sparkY, 1.8 + urgency * 1.4, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    }
    if (this.assets.props.bomb) {
      this.ctx.save();
      this.ctx.globalAlpha = Math.max(0.7, pulse);
      this.ctx.translate(x + TILE_SIZE / 2, y + TILE_SIZE / 2);
      this.ctx.scale(armedScale, armedScale);
      this.ctx.translate(-TILE_SIZE / 2, -TILE_SIZE / 2);
      this.ctx.drawImage(this.assets.props.bomb, 0, 0, TILE_SIZE, TILE_SIZE);
      this.ctx.restore();
      return;
    }
    this.ctx.save();
    this.ctx.translate(x + TILE_SIZE / 2, y + TILE_SIZE / 2);
    this.ctx.scale(armedScale, armedScale);
    this.ctx.fillStyle = `rgba(255, 228, 160, ${Math.max(0.35, pulse)})`;
    this.ctx.beginPath();
    this.ctx.arc(0, -8, 4, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.fillStyle = "#241f1a";
    this.ctx.beginPath();
    this.ctx.arc(0, 2, 10, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.strokeStyle = "#f2dfba";
    this.ctx.stroke();
    this.ctx.restore();
  }

  private drawExplosionFeedback(): void {
    const feedback = this.getExplosionFeedbackReadModel();
    if (feedback.chainReactions.length === 0) {
      return;
    }

    // Do NOT paint orange tile fills/borders or thick blast connectors — they
    // read as cheap HUD boxes on top of the flame sprites. Chain sparks only.
    this.ctx.save();
    this.ctx.lineCap = "round";
    this.ctx.globalCompositeOperation = "lighter";

    for (const effect of feedback.chainReactions) {
      const progress = Math.min(1, effect.elapsedMs / CHAIN_REACTION_FEEDBACK_MS);
      const alpha = 1 - progress;
      const fromX = effect.fromTile.x * TILE_SIZE + TILE_SIZE / 2;
      const fromY = effect.fromTile.y * TILE_SIZE + TILE_SIZE / 2;
      const toX = effect.toTile.x * TILE_SIZE + TILE_SIZE / 2;
      const toY = effect.toTile.y * TILE_SIZE + TILE_SIZE / 2;
      this.ctx.strokeStyle = `rgba(255, 244, 168, ${0.88 * alpha})`;
      this.ctx.lineWidth = 3;
      this.ctx.beginPath();
      this.ctx.moveTo(fromX, fromY);
      this.ctx.lineTo(toX, toY);
      this.ctx.stroke();

      const travel = this.prefersReducedMotion ? 0.5 : 0.18 + progress * 0.82;
      const sparkX = fromX + (toX - fromX) * travel;
      const sparkY = fromY + (toY - fromY) * travel;
      this.ctx.fillStyle = `rgba(255, 255, 220, ${alpha})`;
      this.ctx.beginPath();
      this.ctx.arc(sparkX, sparkY, 2.5, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.strokeStyle = `rgba(255, 132, 38, ${0.72 * alpha})`;
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.arc(toX, toY, this.prefersReducedMotion ? 9 : 6 + progress * 10, 0, Math.PI * 2);
      this.ctx.stroke();
    }
    this.ctx.restore();
  }

  private drawPlayerFlameOcclusionIndicators(): void {
    const indicators = buildPlayerFlameOcclusionIndicators(
      this.flames,
      ALL_PLAYER_IDS.map((playerId) => this.players[playerId]),
      ALL_PLAYER_IDS.flatMap((playerId) => {
        const deathAnimation = this.playerDeathAnimations[playerId];
        return deathAnimation
          ? [{ playerId, startedAtMs: deathAnimation.startedAtMs }]
          : [];
      }),
      this.animationClockMs,
      this.prefersReducedMotion,
    );
    if (indicators.length === 0) {
      return;
    }

    const traceCorners = (indicator: PlayerFlameOcclusionIndicator): void => {
      const { x, y, width, height, cornerLength } = indicator;
      const right = x + width;
      const bottom = y + height;
      this.ctx.beginPath();
      this.ctx.moveTo(x + cornerLength, y);
      this.ctx.lineTo(x, y);
      this.ctx.lineTo(x, y + cornerLength);
      this.ctx.moveTo(right - cornerLength, y);
      this.ctx.lineTo(right, y);
      this.ctx.lineTo(right, y + cornerLength);
      this.ctx.moveTo(x, bottom - cornerLength);
      this.ctx.lineTo(x, bottom);
      this.ctx.lineTo(x + cornerLength, bottom);
      this.ctx.moveTo(right - cornerLength, bottom);
      this.ctx.lineTo(right, bottom);
      this.ctx.lineTo(right, bottom - cornerLength);
    };

    this.ctx.save();
    this.ctx.lineCap = "square";
    this.ctx.lineJoin = "miter";
    for (const indicator of indicators) {
      const toxic = indicator.style === "toxic";
      this.ctx.globalAlpha = indicator.alpha;
      this.ctx.shadowBlur = 0;
      this.ctx.shadowColor = "transparent";
      this.ctx.strokeStyle = "rgba(8, 8, 16, 0.9)";
      this.ctx.lineWidth = 5;
      traceCorners(indicator);
      this.ctx.stroke();

      this.ctx.strokeStyle = toxic ? "#baffd3" : "#fff0a6";
      this.ctx.shadowColor = toxic ? "rgba(54, 255, 151, 0.95)" : "rgba(255, 76, 28, 0.95)";
      this.ctx.shadowBlur = 6;
      this.ctx.lineWidth = 2;
      traceCorners(indicator);
      this.ctx.stroke();
    }
    this.ctx.restore();
  }

  private drawFlame(flame: FlameState): void {
    drawFlameTile(this.ctx, flame, {
      flame: this.assets.props.flame,
      flameAnimSheet: this.assets.props.flameAnimSheet,
    }, {
      animationClockMs: this.animationClockMs,
      prefersReducedMotion: this.prefersReducedMotion,
      dissipateTailMs: FLAME_DISSIPATE_TAIL_MS,
      flameDurationMs: FLAME_DURATION_MS,
      tileSize: TILE_SIZE,
    });
  }

  private drawChampionWorldEffect(effect: ChampionWorldEffect): void {
    this.championVisuals.drawWorldEffect(this.ctx, effect, TILE_SIZE);
  }

  private drawPlayerSkillPreview(player: PlayerState): void {
    this.championVisuals.drawSkillPresentation({
      ctx: this.ctx,
      player,
      arena: this.arena,
      getTile: (position) => this.getTileFromPosition(position),
      createSkillContext: () => this.createSkillContext(),
      tileSize: TILE_SIZE,
      clockMs: this.animationClockMs,
      reducedMotion: this.prefersReducedMotion,
      language: this.language,
    });
  }

  private isSpeedSparkTrailActive(player: PlayerState, moving: boolean): boolean {
    if (!player.active || !player.alive || !moving) {
      return false;
    }
    return player.speedLevel > 0
      || (player.perfectStartBoostMs ?? 0) > 0
      || (player.breakawayBoostMs ?? 0) > 0
      || (player.pickupSprintMs ?? 0) > 0
      || this.hasDangerAdrenalineStep(player);
  }

  private getSpeedSparkTrailAlpha(player: PlayerState): number {
    const hasTimedBoost = (player.perfectStartBoostMs ?? 0) > 0
      || (player.breakawayBoostMs ?? 0) > 0
      || (player.pickupSprintMs ?? 0) > 0
      || this.hasDangerAdrenalineStep(player);
    const baseAlpha = hasTimedBoost ? SPEED_SPARK_TRAIL_ACTIVE_ALPHA : SPEED_SPARK_TRAIL_PASSIVE_ALPHA;
    return Math.max(0.32, Math.min(0.86, baseAlpha + Math.sin(this.animationClockMs / 90) * 0.06));
  }

  private drawSpeedSparkTrail(
    player: PlayerState,
    x: number,
    y: number,
    renderDirection: Direction,
  ): void {
    const sprite = this.assets.effects?.speedSparkTrail;
    if (!sprite) {
      return;
    }

    const direction = player.lastMoveDirection ?? renderDirection;
    const delta = directionDelta[direction];
    const angle: Record<Direction, number> = {
      right: 0,
      down: Math.PI / 2,
      left: Math.PI,
      up: -Math.PI / 2,
    };
    const trailWidth = TILE_SIZE * 1.36;
    const trailHeight = TILE_SIZE * 0.94;
    const centerX = x + TILE_SIZE * 0.5 - delta.x * TILE_SIZE * 0.24;
    const centerY = y + TILE_SIZE * 0.58 - delta.y * TILE_SIZE * 0.24;

    this.ctx.save();
    this.ctx.globalAlpha = this.getSpeedSparkTrailAlpha(player);
    this.ctx.globalCompositeOperation = "lighter";
    this.ctx.translate(centerX, centerY);
    this.ctx.rotate(angle[direction]);
    this.ctx.drawImage(sprite, -trailWidth * 0.74, -trailHeight * 0.5, trailWidth, trailHeight);
    this.ctx.restore();
  }

  private drawPlayer(player: PlayerState): void {
    const existingDeathState = this.playerDeathAnimations[player.id];
    if (!player.active && !existingDeathState) {
      return;
    }
    const deathState = this.ensurePlayerDeathAnimationState(player);
    if (!player.active && player.alive) {
      return;
    }
    const position = this.getPlayerPixelPosition(player);
    const palette = PLAYER_COLORS[player.id];
    const x = position.x;
    const y = position.y;
    const renderDirection = deathState?.direction ?? player.direction;
    const alpha = player.alive ? 1 : (deathState ? 1 : 0.35);
    const baseSprites = this.getPlayerSprites(player.id);
    this.drawRoundWinnerHalo(player, x, y);
    const idleFrames = baseSprites.idle?.[renderDirection] ?? [];
    const walkFrames = baseSprites.walk?.[renderDirection] ?? [];
    const runFrames = baseSprites.run?.[renderDirection] ?? [];
    const attackFrames = baseSprites.attack?.[renderDirection] ?? [];
    const castFrames = this.getAnimationFramesForDirection(baseSprites.cast, renderDirection);
    const deathFrames = this.getAnimationFramesForDirection(baseSprites.death, renderDirection);
    const movementFrames = walkFrames.length > 0 ? walkFrames : runFrames;
    const moving = Math.abs(player.velocity.x) > 0.02 || Math.abs(player.velocity.y) > 0.02;
    const deathElapsedMs = deathState
      ? Math.max(0, this.animationClockMs - deathState.startedAtMs)
      : 0;
    const deathSprite = !player.alive
      ? pickAnimationFrame(deathFrames, deathElapsedMs, DEATH_FRAME_MS, "hold")
      : null;
    const skillAnimation = this.getActiveSkillAnimationFrames(
      player,
      renderDirection,
      castFrames,
      runFrames,
      attackFrames,
    );
    const castSprite = skillAnimation
      ? pickAnimationFrame(
          skillAnimation.frames,
          player.skill.castElapsedMs,
          skillAnimation.frameMs,
          skillAnimation.playback,
        )
      : null;
    const movementSprite = moving
      ? pickAnimationFrame(movementFrames, this.animationClockMs, WALK_FRAME_MS, "loop")
      : pickAnimationFrame(idleFrames, this.animationClockMs, WALK_FRAME_MS, "loop");
    let sprite = deathSprite ?? castSprite ?? movementSprite ?? spriteForDirection(baseSprites, renderDirection);
    if (!sprite || !this.getSpriteTrimBounds(sprite)) {
      sprite = this.getRenderableSprite(baseSprites, renderDirection);
    }

    if (this.isSpeedSparkTrailActive(player, moving)) {
      this.drawSpeedSparkTrail(player, x, y, renderDirection);
    }

    this.ctx.save();
    this.ctx.globalAlpha = alpha;
    this.ctx.fillStyle = "rgba(10, 8, 7, 0.32)";
    this.ctx.beginPath();
    this.ctx.ellipse(x + TILE_SIZE * 0.5, y + TILE_SIZE - 2, TILE_SIZE * 0.4, TILE_SIZE * 0.18, 0, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.restore();

    if (sprite) {
      const fullWidth = sprite.naturalWidth || sprite.width || 1;
      const fullHeight = sprite.naturalHeight || sprite.height || 1;
      const trimmedBounds = this.getSpriteTrimBounds(sprite);
      const srcX = trimmedBounds?.x ?? 0;
      const srcY = trimmedBounds?.y ?? 0;
      const srcWidth = trimmedBounds?.width ?? fullWidth;
      const srcHeight = trimmedBounds?.height ?? fullHeight;
      const spriteHeight = TILE_SIZE * PLAYER_SPRITE_HEIGHT_SCALE;
      const maxSpriteWidth = TILE_SIZE * PLAYER_SPRITE_MAX_WIDTH_SCALE;
      const spriteWidth = Math.min(maxSpriteWidth, spriteHeight * (srcWidth / srcHeight));
      const spriteX = x + TILE_SIZE * 0.5 - spriteWidth * 0.5;
      const spriteY = y + TILE_SIZE - spriteHeight + 1;
      this.ctx.save();
      this.ctx.globalAlpha = alpha;
      this.ctx.drawImage(
        sprite,
        srcX,
        srcY,
        srcWidth,
        srcHeight,
        spriteX,
        spriteY,
        spriteWidth,
        spriteHeight,
      );
      this.ctx.restore();
      this.drawWorldPlayerLabel(player, x, y, alpha);
      return;
    }

    this.ctx.fillStyle = "#15120f";
    this.ctx.fillRect(x + 6, y + 3, TILE_SIZE - 12, TILE_SIZE - 4);
    this.ctx.fillStyle = player.alive ? palette.primary : "#8f8372";
    this.ctx.globalAlpha = alpha;
    this.ctx.fillRect(x + 7, y + 4, TILE_SIZE - 14, TILE_SIZE - 6);
    this.ctx.fillStyle = player.alive ? palette.secondary : "#5e554b";
    this.ctx.fillRect(x + 8, y + 8, TILE_SIZE - 16, TILE_SIZE - 13);
    this.ctx.fillStyle = "#f4ead8";

    if (renderDirection === "up") {
      this.ctx.fillRect(x + 12, y + 10, 4, 4);
      this.ctx.fillRect(x + 16, y + 10, 4, 4);
    } else if (renderDirection === "down") {
      this.ctx.fillRect(x + 12, y + 16, 4, 4);
      this.ctx.fillRect(x + 16, y + 16, 4, 4);
    } else if (renderDirection === "left") {
      this.ctx.fillRect(x + 10, y + 14, 4, 4);
      this.ctx.fillRect(x + 10, y + 18, 4, 4);
    } else {
      this.ctx.fillRect(x + 18, y + 14, 4, 4);
      this.ctx.fillRect(x + 18, y + 18, 4, 4);
    }

    this.ctx.globalAlpha = 1;
    this.drawWorldPlayerLabel(player, x, y, alpha);
  }

  private drawWorldPlayerLabel(player: PlayerState, x: number, y: number, alpha: number): void {
    const configuredLabel = this.customPlayerLabels[player.id];
    if (!this.showWorldPlayerLabels || !configuredLabel) {
      return;
    }
    const label = `P${player.id} · ${this.shortenCharacterName(configuredLabel, 20)}`;
    const palette = PLAYER_COLORS[player.id];
    this.ctx.save();
    this.ctx.globalAlpha = Math.max(0.45, alpha);
    this.ctx.font = "700 6px Inter";
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "middle";
    const width = Math.min(100, Math.ceil(this.ctx.measureText(label).width) + 12);
    const centerX = x + TILE_SIZE * 0.5;
    const top = y - 22;
    this.ctx.fillStyle = "rgba(5, 8, 13, 0.86)";
    this.ctx.fillRect(Math.round(centerX - width * 0.5), top, width, 12);
    this.ctx.fillStyle = palette.primary;
    this.ctx.fillRect(Math.round(centerX - width * 0.5), top, 2, 12);
    this.ctx.fillStyle = "#f5f8fc";
    this.ctx.fillText(label, centerX + 1, top + 6.5);
    this.ctx.restore();
  }

  private drawRoundWinnerHalo(player: PlayerState, x: number, y: number): void {
    if (this.roundOutcome?.winner !== player.id) {
      return;
    }
    this.ctx.fillStyle = CANVAS_UI_GOLD;
    this.ctx.fillRect(x + 4, y - 3, TILE_SIZE - 8, 3);
    this.ctx.fillRect(x + 1, y, 3, TILE_SIZE - 8);
    this.ctx.fillRect(x + TILE_SIZE - 4, y, 3, TILE_SIZE - 8);
    this.ctx.fillStyle = CANVAS_UI_GOLD_BRIGHT;
    this.ctx.fillRect(x + 7, y - 6, TILE_SIZE - 14, 3);
    this.ctx.fillRect(x + 4, y + TILE_SIZE - 8, TILE_SIZE - 8, 3);
  }

  private getActiveSkillAnimationFrames(
    player: PlayerState,
    renderDirection: Direction,
    castFrames: HTMLImageElement[],
    runFrames: HTMLImageElement[],
    attackFrames: HTMLImageElement[],
  ): { frames: HTMLImageElement[]; frameMs: number; playback: "loop" | "hold" } | null {
    const sprites = this.getPlayerSprites(player.id);
    return this.championVisuals.resolveAnimation({
      player,
      direction: renderDirection,
      cycles: { idle: sprites.idle, walk: sprites.walk, cast: sprites.cast },
      castFrames,
      runFrames,
      attackFrames,
      skillFrameMs: SKILL_FRAME_MS,
    });
  }

  private ensurePlayerDeathAnimationState(player: PlayerState): PlayerDeathAnimationState | null {
    if (player.alive) {
      this.playerDeathAnimations[player.id] = null;
      return null;
    }
    const existing = this.playerDeathAnimations[player.id];
    if (existing) {
      return existing;
    }
    const created: PlayerDeathAnimationState = {
      startedAtMs: this.animationClockMs,
      direction: player.lastMoveDirection ?? player.direction,
    };
    this.playerDeathAnimations[player.id] = created;
    return created;
  }

  private getSpriteTrimBounds(
    sprite: HTMLImageElement,
  ): SpriteTrimBounds | null {
    return this.spriteTrimCache.getBounds(sprite);
  }

  private getAnimationFramesForDirection(
    cycle: Record<Direction, HTMLImageElement[]> | undefined,
    preferredDirection: Direction,
  ): HTMLImageElement[] {
    if (!cycle) {
      return [];
    }
    const preferred = cycle[preferredDirection] ?? [];
    if (preferred.length > 0) {
      return preferred;
    }
    const fallbackOrder: Direction[] = [
      "down",
      "right",
      "left",
      "up",
    ];
    for (const direction of fallbackOrder) {
      if (direction === preferredDirection) {
        continue;
      }
      const frames = cycle[direction] ?? [];
      if (frames.length > 0) {
        return frames;
      }
    }
    return [];
  }

  private getRenderableSprite(
    sprites: DirectionalSprites,
    preferredDirection: Direction,
  ): HTMLImageElement | null {
    const directionOrder: Direction[] = [
      preferredDirection,
      "right",
      "left",
      "down",
      "up",
    ];
    const seen = new Set<Direction>();
    for (const direction of directionOrder) {
      if (seen.has(direction)) {
        continue;
      }
      seen.add(direction);
      const sprite = spriteForDirection(sprites, direction);
      if (!sprite) {
        continue;
      }
      if (this.getSpriteTrimBounds(sprite)) {
        return sprite;
      }
    }
    return null;
  }

  private renderMatchOverlay(): void {
    const overlay = this.getCenterOverlayState();
    if (overlay) {
      this.drawCenterOverlay(overlay.title, overlay.subtitle, overlay.footer, overlay.victoryEmblem, overlay.stalemateEmblem);
    }
  }

  private syncRoundStartCue(
    previousMode: Mode,
    previousRoundNumber: number,
    previousRoundOutcome: RoundOutcome | null,
    nextMode: Mode,
    nextRoundNumber: number,
    nextRoundOutcome: RoundOutcome | null,
  ): void {
    if (nextMode !== "match" || nextRoundOutcome) {
      this.roundStartCueMs = 0;
      return;
    }
    if (previousMode !== "match" || previousRoundNumber !== nextRoundNumber || previousRoundOutcome) {
      this.roundStartCueMs = ROUND_START_CUE_MS;
    }
  }

  private updateRoundStartCue(deltaMs: number): void {
    if (this.roundStartCueMs <= 0 || this.paused || this.roundOutcome) {
      return;
    }
    this.roundStartCueMs = Math.max(0, this.roundStartCueMs - deltaMs);
  }

  private drawHudText(text: string, x: number, y: number, fillColor: string, outlineColor: string): void {
    // Soft dual-pass outline keeps tiny HUD labels legible without the old
    // 1px stroke that turned "S0" into mud when the canvas was scaled up.
    this.ctx.save();
    this.ctx.lineJoin = "round";
    this.ctx.miterLimit = 2;
    this.ctx.lineWidth = 2.5;
    this.ctx.strokeStyle = outlineColor;
    this.ctx.strokeText(text, x, y);
    this.ctx.lineWidth = 1;
    this.ctx.strokeStyle = "rgba(0, 0, 0, 0.55)";
    this.ctx.strokeText(text, x, y);
    this.ctx.fillStyle = fillColor;
    this.ctx.fillText(text, x, y);
    this.ctx.restore();
  }

  private getSuddenDeathHudState(): { label: string; progress: number; active: boolean } {
    if (this.suddenDeathActive) {
      return {
        label: "SUDDEN DEATH",
        progress: 1,
        active: true,
      };
    }

    const remainingMs = Math.max(0, this.roundTimeMs - SUDDEN_DEATH_START_MS);
    const progress = SUDDEN_DEATH_ELAPSED_MS > 0
      ? 1 - (remainingMs / SUDDEN_DEATH_ELAPSED_MS)
      : 1;

    return {
      label: `SD ${Math.ceil(remainingMs / 1000)}s`,
      progress: Math.max(0, Math.min(1, progress)),
      active: false,
    };
  }

  private drawSuddenDeathMeter(x: number, y: number, width: number, progress: number, active: boolean): void {
    const meterWidth = Math.max(24, Math.round(width));
    const meterHeight = active ? 6 : 5;
    const clampedProgress = Math.max(0, Math.min(1, progress));
    const fillWidth = Math.max(2, Math.round((meterWidth - 2) * clampedProgress));
    const pulse = active
      ? 0.55 + (Math.sin((this.roundTimeMs + this.suddenDeathTickMs) / 120) + 1) * 0.225
      : 0.28 + clampedProgress * 0.42;

    this.ctx.save();
    this.ctx.fillStyle = active
      ? `rgba(255, 95, 87, ${0.1 + pulse * 0.12})`
      : `rgba(0, 229, 160, ${0.05 + clampedProgress * 0.08})`;
    this.ctx.fillRect(x - 1, y - 1, meterWidth + 2, meterHeight + 2);

    const baseGradient = this.ctx.createLinearGradient(x, y, x, y + meterHeight);
    if (active) {
      baseGradient.addColorStop(0, "rgba(44, 12, 16, 0.96)");
      baseGradient.addColorStop(1, "rgba(16, 6, 8, 0.96)");
    } else {
      baseGradient.addColorStop(0, "rgba(15, 12, 10, 0.94)");
      baseGradient.addColorStop(1, "rgba(7, 6, 9, 0.94)");
    }
    this.ctx.fillStyle = baseGradient;
    this.ctx.fillRect(x, y, meterWidth, meterHeight);

    this.ctx.globalAlpha = active ? 0.28 + pulse * 0.2 : 0.18 + clampedProgress * 0.12;
    this.ctx.fillStyle = active ? "rgba(255, 210, 204, 0.34)" : "rgba(174, 255, 233, 0.26)";
    for (let offset = 2; offset < meterWidth - 2; offset += 6) {
      this.ctx.fillRect(x + offset, y + 1, 2, meterHeight - 2);
    }
    this.ctx.globalAlpha = 1;

    const fillGradient = this.ctx.createLinearGradient(x, y, x + fillWidth, y);
    if (active) {
      fillGradient.addColorStop(0, "rgba(255, 208, 203, 0.98)");
      fillGradient.addColorStop(0.58, "rgba(255, 95, 87, 0.98)");
      fillGradient.addColorStop(1, "rgba(189, 31, 55, 0.98)");
    } else {
      fillGradient.addColorStop(0, "rgba(95, 255, 200, 0.96)");
      fillGradient.addColorStop(0.6, "rgba(0, 229, 160, 0.96)");
      fillGradient.addColorStop(1, "rgba(0, 161, 122, 0.96)");
    }
    this.ctx.fillStyle = fillGradient;
    this.ctx.fillRect(x + 1, y + 1, fillWidth, meterHeight - 2);

    if (fillWidth > 2) {
      this.ctx.fillStyle = active ? "rgba(255, 255, 255, 0.26)" : "rgba(255, 255, 255, 0.22)";
      this.ctx.fillRect(x + fillWidth - 1, y + 1, 1, meterHeight - 2);
    }

    this.ctx.strokeStyle = active ? `rgba(255, 95, 87, ${0.6 + pulse * 0.2})` : "rgba(0, 229, 160, 0.58)";
    this.ctx.strokeRect(x + 0.5, y + 0.5, meterWidth - 1, meterHeight - 1);
    this.ctx.restore();
  }

  private renderMatchResult(): void {
    const overlay = this.getCenterOverlayState();
    if (overlay) {
      this.drawCenterOverlay(overlay.title, overlay.subtitle, overlay.footer, overlay.victoryEmblem, overlay.stalemateEmblem);
    }
  }

  private getCenterOverlayState(): CenterOverlayState | null {
    const copy = SITE_COPY[this.language].canvas;
    if (this.mode === "match" && this.paused) {
      return {
        title: copy.pausedTitle,
        subtitle: copy.pausedSubtitle,
        footer: copy.roundStartSubtitle,
        victoryEmblem: false,
        stalemateEmblem: false,
      };
    }

    if (this.mode === "match" && this.roundOutcome) {
      const outcomeElapsedMs = ROUND_END_DELAY_MS - this.roundOutcome.countdownMs;
      if (outcomeElapsedMs < ROUND_OUTCOME_OVERLAY_HOLD_MS) {
        return null;
      }
      const title = this.roundOutcome.reason === "elimination" && this.roundOutcome.winner
        ? copy.roundWinner(this.players[this.roundOutcome.winner].name)
        : this.roundOutcome.reason === "double-ko"
          ? copy.doubleKoTitle
          : copy.timeoutTitle;
      const subtitle = this.roundOutcome.reason === "elimination"
        ? copy.arenaRebooting
        : this.roundOutcome.reason === "double-ko"
          ? copy.doubleKo
          : copy.noPoints;
      const seconds = this.getRoundedCountdownSeconds(this.roundOutcome.countdownMs);
      const nextAction = this.onlineRoomMode !== "endless" && this.hasMatchWinnerScore()
        ? copy.matchResultCue(seconds)
        : copy.nextRoundCue(seconds);
      return {
        title,
        subtitle,
        footer: `${copy.scoreSummary(this.formatActiveScore())} | ${nextAction}`,
        victoryEmblem: this.roundOutcome.winner !== null,
        stalemateEmblem: this.roundOutcome.winner === null,
      };
    }

    if (this.mode === "match" && this.roundStartCueMs > 0) {
      return {
        title: copy.roundStartTitle(this.roundNumber),
        subtitle: copy.roundStartSubtitle,
        footer: copy.scoreSummary(this.formatActiveScore()),
        victoryEmblem: false,
        stalemateEmblem: false,
      };
    }

    if (this.mode === "match-result") {
      const scoreSummary = copy.scoreSummary(this.formatActiveScore());
      return {
        title: this.matchWinner ? copy.matchWinner(this.players[this.matchWinner].name) : copy.matchComplete,
        subtitle: this.onlineSession ? copy.rematchSummary : copy.localResultActions,
        footer: scoreSummary,
        victoryEmblem: this.matchWinner !== null,
        stalemateEmblem: this.matchWinner === null,
      };
    }

    return null;
  }

  private drawCenterOverlay(
    title: string,
    subtitle: string,
    footer: string | null = null,
    showVictoryEmblem = false,
    showStalemateEmblem = false,
  ): void {
    const victoryEmblem = showVictoryEmblem ? this.assets.ui?.victoryEmblem : null;
    const stalemateEmblem = showStalemateEmblem ? this.assets.ui?.stalemateEmblem : null;
    const overlayEmblem = victoryEmblem ?? stalemateEmblem;
    const textCenterX = overlayEmblem ? CANVAS_WIDTH / 2 + 48 : CANVAS_WIDTH / 2;
    this.ctx.fillStyle = CANVAS_UI_PANEL_BG_STRONG;
    this.ctx.fillRect(40, 164, CANVAS_WIDTH - 80, 120);
    this.ctx.strokeStyle = CANVAS_UI_BORDER_STRONG;
    this.ctx.strokeRect(40, 164, CANVAS_WIDTH - 80, 120);
    this.drawCenterOverlayTelemetryFrame(showVictoryEmblem, showStalemateEmblem);
    if (victoryEmblem) {
      this.ctx.drawImage(victoryEmblem, 67, 176, 55, 78);
    } else if (stalemateEmblem) {
      this.ctx.drawImage(stalemateEmblem, 67, 176, 55, 78);
    }
    this.ctx.textAlign = "center";
    this.ctx.fillStyle = CANVAS_UI_TEXT;
    this.ctx.font = "700 22px Playfair Display";
    this.ctx.fillText(title, textCenterX, 214);
    this.ctx.fillStyle = CANVAS_UI_MUTED;
    this.ctx.font = "600 13px Inter";
    this.ctx.fillText(subtitle, textCenterX, 248);
    if (footer) {
      this.ctx.fillStyle = CANVAS_UI_GOLD;
      this.ctx.font = "700 10px Inter";
      this.ctx.fillText(footer, textCenterX, 270);
    }
  }

  private drawCenterOverlayTelemetryFrame(showVictoryEmblem: boolean, showStalemateEmblem: boolean): void {
    const accent = showVictoryEmblem
      ? CANVAS_UI_SUCCESS
      : showStalemateEmblem
        ? CANVAS_UI_DANGER
        : CANVAS_UI_GOLD;
    const railX = 56;
    const railWidth = CANVAS_WIDTH - 112;
    const segmentCount = 8;
    const segmentGap = 4;
    const segmentWidth = Math.floor((railWidth - (segmentCount - 1) * segmentGap) / segmentCount);

    this.ctx.save();
    this.ctx.fillStyle = accent;
    this.ctx.globalAlpha = showVictoryEmblem || showStalemateEmblem ? 0.9 : 0.45;
    this.ctx.fillRect(48, 170, CANVAS_WIDTH - 96, 2);
    this.ctx.fillRect(48, 276, CANVAS_WIDTH - 96, 2);

    this.ctx.globalAlpha = showVictoryEmblem ? 0.95 : showStalemateEmblem ? 0.62 : 0.26;
    for (let index = 0; index < segmentCount; index += 1) {
      const segmentX = railX + index * (segmentWidth + segmentGap);
      this.ctx.fillRect(segmentX, 278, segmentWidth, 2);
    }

    this.ctx.globalAlpha = 0.76;
    this.ctx.fillRect(40, 164, 12, 2);
    this.ctx.fillRect(40, 164, 2, 12);
    this.ctx.fillRect(CANVAS_WIDTH - 52, 164, 12, 2);
    this.ctx.fillRect(CANVAS_WIDTH - 42, 164, 2, 12);
    this.ctx.fillRect(40, 282, 12, 2);
    this.ctx.fillRect(40, 272, 2, 12);
    this.ctx.fillRect(CANVAS_WIDTH - 52, 282, 12, 2);
    this.ctx.fillRect(CANVAS_WIDTH - 42, 272, 2, 12);
    this.ctx.restore();
  }

  private renderGameToText(): string {
    const visibleBreakables = Array.from(this.arena.breakable)
      .slice(0, 24)
      .map((key) => {
        const [x, y] = key.split(",");
        return { x: Number(x), y: Number(y) };
      });

    const dangerOverlayTiles = this.showDangerOverlay
      ? this.getDangerOverlayTiles().slice(0, 48)
      : [];
    const previewPlayerId = this.getBombPreviewPlayerId();
    const bombPreviewTiles = this.showBombPreview
      ? this.getBombPreviewTiles(previewPlayerId).slice(0, 48)
      : [];
    const crateBreakEffects = this.crateBreakAnimations
      .slice(0, 24)
      .map((effect) => ({
        tile: { ...effect.tile },
        elapsedMs: Math.round(effect.elapsedMs),
      }));
    const screenShakeOffset = this.getScreenShakeOffset();
    const suddenDeathHud = this.getSuddenDeathHudState();
    const centerOverlay = this.getCenterOverlayState();
    const copy = SITE_COPY[this.language].canvas;

    const payload = {
      mode: this.mode,
      match: {
        round: this.roundNumber,
        score: this.score,
        remainingMs: Math.round(this.roundTimeMs),
        paused: this.paused,
        autoPausedForHiddenTab: this.autoPausedForHiddenTab,
        menuReady: this.menuReady,
        matchResultChoice: this.matchResultChoice,
        botEnabled: this.botEnabled,
        localBotFill: this.localBotFill,
        activePlayerIds: this.activePlayerIds,
        characterMenuOpen: this.characterMenuOpen,
        centerOverlay,
        roundStartCue: {
          active: this.roundStartCueMs > 0,
          remainingMs: Math.round(this.roundStartCueMs),
          title: copy.roundStartTitle(this.roundNumber),
          subtitle: copy.roundStartSubtitle,
        },
        suddenDeath: {
          active: this.suddenDeathActive,
          startsAtMs: SUDDEN_DEATH_START_MS,
          tickMs: Math.max(0, Math.round(this.suddenDeathTickMs)),
          progress: this.suddenDeathPath.length > 0
            ? Math.round((this.suddenDeathIndex / this.suddenDeathPath.length) * 1000) / 10
            : 0,
          warningLabel: suddenDeathHud.label,
          warningProgress: Math.round(suddenDeathHud.progress * 1000) / 10,
          closedTiles: Array.from(this.suddenDeathClosedTiles)
            .slice(0, 48)
            .map((key) => this.parseTileKey(key)),
          closingTiles: this.suddenDeathClosureEffects.map((effect) => ({
            tile: { ...effect.tile },
            elapsedMs: Math.round(effect.elapsedMs),
            impacted: effect.impacted,
          })),
        },
        dangerOverlay: {
          enabled: this.showDangerOverlay,
          maxEtaMs: DANGER_OVERLAY_MAX_ETA_MS,
          tiles: dangerOverlayTiles,
        },
        bombPreview: {
          enabled: this.showBombPreview,
          playerId: previewPlayerId,
          flameRange: this.players[previewPlayerId].flameRange,
          tiles: bombPreviewTiles,
        },
        automationSelectedPlayer: this.automationMode ? this.automationControlledPlayer : null,
        roundOutcome: this.roundOutcome ? {
          winner: this.roundOutcome.winner,
          reason: this.roundOutcome.reason,
          message: this.roundOutcome.message,
        } : null,
        returnBrief: this.getLocalSessionReturnBrief(),
      },
      arena: {
        width: this.getArenaGridWidth(),
        height: this.getArenaGridHeight(),
        tileSize: TILE_SIZE,
        origin: { x: this.getArenaOffsetX(), y: this.getArenaOffsetY() },
        coordinates: "origin top-left, x to right, y to bottom",
      },
      activePlayerIds: [...this.activePlayerIds],
      players: this.activePlayerIds.map((id) => {
        const player = this.players[id];
        const tile = this.getTileFromPosition(player.position);
        const pixel = this.getPlayerPixelPosition(player);
        const recentPowerUpPickup = this.getLatestPowerUpPickupNotice(id);
        return {
          id: player.id,
          name: player.name,
          tile,
          pixel,
          velocity: {
            x: Math.round(player.velocity.x * 100) / 100,
            y: Math.round(player.velocity.y * 100) / 100,
          },
          direction: player.direction,
          botControlled: this.isBotControlled(id),
          character: {
            id: this.getActiveCharacterEntry(id).id,
            name: this.getActiveCharacterEntry(id).name,
            selectedIndex: this.selectedCharacterIndex[id],
            pendingIndex: this.pendingCharacterIndex[id],
            locked: this.characterLocked[id],
            menuOpen: this.characterMenuOpen[id],
          },
          alive: player.alive,
          hudStatus: this.getPlayerHudStatus(id),
          bombsAvailable: player.maxBombs - player.activeBombs,
          bombCapacity: player.maxBombs,
          flameRange: player.flameRange,
          speedLevel: player.speedLevel,
          remoteLevel: player.remoteLevel,
          shieldCharges: player.shieldCharges,
          bombPassLevel: player.bombPassLevel,
          kickLevel: player.kickLevel,
          shortFuseLevel: player.shortFuseLevel,
          skillSlots: this.getHudSkillSlots(id).map((slot) => ({
            type: slot.type,
            acquired: slot.acquired,
            level: slot.level,
            value: slot.valueLabel,
            key: slot.keyLabel,
            recentlyCollected: slot.recentlyCollected,
          })),
          compactSkillSlots: this.getCompactHudSkillSlots(this.getHudSkillSlots(id)).map((slot) => ({
            type: slot.type,
            acquired: slot.acquired,
            level: slot.level,
            value: slot.valueLabel,
            key: slot.keyLabel,
            recentlyCollected: slot.recentlyCollected,
          })),
          recentPowerUpPickup: recentPowerUpPickup
            ? {
                type: recentPowerUpPickup.type,
                value: recentPowerUpPickup.valueLabel,
                chainGuard: recentPowerUpPickup.chainGuard,
                remainingMs: Math.round(recentPowerUpPickup.remainingMs),
              }
            : null,
          pickupChain: {
            previousType: this.pickupChains[id].previousType,
            remainingMs: Math.round(this.pickupChains[id].remainingMs),
          },
          flameGuardMs: Math.round(player.flameGuardMs),
          breakawayBoostMs: Math.round(player.breakawayBoostMs ?? 0),
          pickupSprintMs: Math.round(player.pickupSprintMs ?? 0),
          spawnProtectionMs: Math.round(player.spawnProtectionMs),
          skill: {
            id: player.skill.id,
            phase: player.skill.phase,
            channelRemainingMs: Math.round(player.skill.channelRemainingMs),
            cooldownRemainingMs: Math.round(player.skill.cooldownRemainingMs),
          },
        };
      }),
      bombs: this.bombs.map((bomb) => ({
        ownerId: bomb.ownerId,
        tile: bomb.tile,
        flameRange: bomb.flameRange,
        fuseMs: Math.max(0, Math.round(bomb.fuseMs)),
      })),
      flames: this.flames.map((flame) => ({
        tile: flame.tile,
        remainingMs: Math.round(flame.remainingMs),
      })),
      magicBeams: this.championWorldEffects.filter(isNicoBeamEffect).map((beam) => ({
        ownerId: beam.ownerId,
        origin: beam.origin,
        direction: beam.direction,
        remainingMs: Math.round(beam.remainingMs),
        tiles: beam.tiles,
      })),
      blocks: {
        remaining: this.arena.breakable.size,
        visibleBreakables,
        breakEffects: crateBreakEffects,
      },
      screenShake: {
        remainingMs: Math.round(this.screenShakeMs),
        amplitudePx: this.screenShakeAmplitudePx,
        offset: {
          x: Math.round(screenShakeOffset.x * 1000) / 1000,
          y: Math.round(screenShakeOffset.y * 1000) / 1000,
        },
      },
      powerups: this.arena.powerUps
        .filter((powerUp) => powerUp.revealed && !powerUp.collected)
        .map((powerUp) => ({
          type: powerUp.type,
          tile: powerUp.tile,
          visible: powerUp.revealed,
          collected: powerUp.collected,
        })),
    };

    return JSON.stringify(payload);
  }
}
