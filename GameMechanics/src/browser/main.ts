import "@fontsource/inter/400.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/800.css";
import "@fontsource/space-grotesk/700.css";

import "./styles.css";

import brandMarkUrl from "../../assets/brand/brand-mark.png";
import floorBaseUrl from "../../assets/arena/tournament-clean/floor-base.png";
import floorBaseAltUrl from "../../assets/arena/tournament-clean/floor-base-alt.png";
import floorBaseAlt2Url from "../../assets/arena/tournament-clean/floor-base-alt2.png";
import floorBaseAlt3Url from "../../assets/arena/tournament-clean/floor-base-alt3.png";
import floorLaneUrl from "../../assets/arena/tournament-clean/floor-lane.png";
import floorSpawnUrl from "../../assets/arena/tournament-clean/floor-spawn.png";
import floorPortalUrl from "../../assets/arena/tournament-clean/floor-portal.png";
import wallUrl from "../../assets/arena/tournament-clean/wall.png";
import wallAltUrl from "../../assets/arena/tournament-clean/wall-alt.png";
import crateUrl from "../../assets/arena/tournament-clean/crate.png";
import crateAltUrl from "../../assets/arena/tournament-clean/crate-alt.png";
import bombUrl from "../../assets/gameplay/bomb.png";
import flameUrl from "../../assets/gameplay/flame.png";
import flameAnim00Url from "../../assets/gameplay/flame-frames/flame-anim-00.png";
import flameAnim02Url from "../../assets/gameplay/flame-frames/flame-anim-02.png";
import flameAnim04Url from "../../assets/gameplay/flame-frames/flame-anim-04.png";
import flameAnim06Url from "../../assets/gameplay/flame-frames/flame-anim-06.png";
import flameAnim08Url from "../../assets/gameplay/flame-frames/flame-anim-08.png";
import flameAnim10Url from "../../assets/gameplay/flame-frames/flame-anim-10.png";
import flameAnim12Url from "../../assets/gameplay/flame-frames/flame-anim-12.png";
import flameAnim14Url from "../../assets/gameplay/flame-frames/flame-anim-14.png";
import powerBombUrl from "../../assets/gameplay/power-bomb.png";
import powerFlameUrl from "../../assets/gameplay/power-flame.png";
import hudBombIconUrl from "../../assets/hud/icon-bomb-v1.png";
import hudFlameIconUrl from "../../assets/hud/icon-flame-v1.png";
import crateBreak0Url from "../../assets/gameplay/crate-break-0.png";
import crateBreak1Url from "../../assets/gameplay/crate-break-1.png";
import crateBreak2Url from "../../assets/gameplay/crate-break-2.png";
import crateBreak3Url from "../../assets/gameplay/crate-break-3.png";
import {
  collectChampionAssetUrls,
  getChampionPresentation,
  listChampionPresentations,
  resolveAtlasFrame,
  type ChampAccent,
  type ChampPack,
  type ChampPresentation,
  type Facing,
} from "./champion-packs.ts";
import {
  didLivingShadowSwapSucceed,
  selectBombAnimationAction,
  selectFacingFrames,
  selectSkillAnimationAction,
  timedAnimationFrameIndex,
  type ChampionAnimationAction,
  type SkillAnimationAction,
} from "./champion-animation-selection.ts";
import {
  ANIMATION_LAB_PACKS,
  getAnimationLabPack,
  nextAnimationLabPack,
  resetAnimationLabRotation,
  type AnimationLabCategory,
  type AnimationLabPackId,
} from "./animation-lab-packs.ts";
import {
  animationLabDestinationRect,
  animationLabSizeTiles,
} from "./animation-lab-presentation.ts";

import { createGameMechanics } from "../game-mechanics.ts";
import { createLocalDuel1v1MatchConfig, createMatchConfig } from "../match-config.ts";
import {
  RANNI_CHANNEL_MS,
  RANNI_COOLDOWN_MS,
  THRESH_CHANNEL_MS,
  THRESH_HOOK_RANGE,
  ZED_FAIL_COOLDOWN_MS,
} from "../modules/skills/index.ts";
import {
  initSoundUnlock,
  playSoundsForEvents,
  preloadSounds,
  toggleSoundMuted,
} from "./audio.ts";
import {
  GAME_MECHANICS_VERSION,
  RANNI_ICE_BLINK_SKILL_ID,
  THRESH_DEATH_SENTENCE_SKILL_ID,
  TICK_DURATION_MS,
  ZED_LIVING_SHADOW_SKILL_ID,
  type CompetitorId,
  type Direction,
  type GameEvent,
  type GameSnapshot,
  type SkillId,
  type TileCoord,
} from "../contracts.ts";
import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  BODY_HALF_EXTENT,
  BOMB_FUSE_MS,
  CANONICAL_SPAWNS,
  FLAME_DURATION_MS,
  isFlameLethal,
  LANE_CORRECTION_MAX,
  PRESSURE_FALL_MS,
  UNITS_PER_TILE,
  wrapDelta,
} from "../kernel/world-state.ts";
import {
  BOT_PROFILES,
  type BotProfileId,
} from "../bots/index.ts";
import {
  browserBotDriverForPlayer,
  createBrowserBotDrivers,
  driveBrowserBotsForTick,
  recordBrowserBotTickOutcome,
  setBrowserBotExperienceRecording,
  type BrowserBotDriver,
} from "./bot-drivers.ts";
import {
  createInMemoryExperienceSink,
  type BotExperienceEvent,
  type InMemoryExperienceSink,
} from "./bot-mastery/index.ts";
import {
  botProfileForPlayer,
  createBrowserMatchConfiguration,
  parseBrowserLaunchState,
  resolveChampionSlug,
  seedForBrowserMatch,
  serializeBrowserMatchConfiguration,
  type BrowserGameMode,
  type BrowserMatchConfiguration,
} from "./match-mode.ts";
import { createBotLabObservation } from "./lab-observation.ts";

declare global {
  interface Window {
    get_game_mechanics_snapshot?: () => GameSnapshot;
    advance_game_mechanics?: (milliseconds: number) => GameSnapshot;
    get_bot_lab_experience?: () => readonly BotExperienceEvent[];
  }
}

/** Canvas tile resolution for crisp product sprites. */
const TILE_SIZE = 48;
/**
 * Hi-DPI backbuffer: source tiles are 128px, so 3× puts each logical 48px
 * tile at 144 device px — the frame then downscales to screen size, which
 * keeps sprites crisp instead of CSS-upscaling a low-res raster.
 */
const BACKBUFFER_SCALE = 3;
const LOGICAL_WIDTH = ARENA_WIDTH * TILE_SIZE;
const LOGICAL_HEIGHT = ARENA_HEIGHT * TILE_SIZE;
const MAX_FRAME_DELTA_MS = 100;
const EVENT_LOG_LIMIT = 10;
const MOVE_SPEED_THRESHOLD = 8;
/**
 * Opaque champion height in tiles after source-rect trim.
 * Matches product arena scale (1.45). Dense packs further multiply by
 * {@link ChampPresentation.arenaScale} so full-cell art does not read oversized.
 */
const CHAMPION_HEIGHT_TILES = 1.45;
/** Max width in tiles after aspect fit (product arena uses 1.2). */
const CHAMPION_MAX_WIDTH_TILES = 1.2;
const SPRITE_ALPHA_THRESHOLD = 24;
const IDLE_FRAME_MS = 180;
const WALK_FRAME_MS = 90;
const DEATH_FRAME_MS = 90;
const CAST_FRAME_MS = 100;
/** Full ice-prison frame held for Ranni's physical body during Ice Blink. */
const RANNI_FROZEN_ULTIMATE_FRAME = 3;
/** Fast six-frame build-up before the full prison is held. */
const RANNI_FREEZE_BUILD_MS = 240;
/**
 * Living Shadow cast telegraph: build through cast frames, then release so
 * free-move locomotion can read while the 2000 ms channel continues.
 */
const ZED_CAST_TELEGRAPH_MS = 1_000;
const ZED_CAST_BUILD_MS = 700;
/** Readable swap recovery after a valid Living Shadow teleport. */
const ZED_SWAP_RECOVERY_MS = 720;
/** Short cancel/fail pose after timeout, invalid swap, or death cleanup. */
const ZED_SHADOW_CANCEL_MS = 420;
/** Dark enough to remain legible over the arena's pale floor. */
const RANNI_SPIRIT_PRIMARY_ALPHA = 0.5;
const RANNI_SPIRIT_WISP_FRAME_MS = 120;
const POWER_FX_MS = 720;
const SUDDEN_DEATH_FLASH_MS = 1400;
/** Combat presentation timing (adapter-only, never kernel state). */
const CRATE_BREAK_FX_MS = 220;
const SCREEN_SHAKE_MS = 160;
const SCREEN_SHAKE_BASE_PX = 4;
const SCREEN_SHAKE_MAX_PX = 6;
const FINAL_FUSE_WARN_MS = 450;
const FLAME_DISSIPATE_TAIL_MS = 140;
const BOMB_PLACE_POP_MS = 180;
const CHAIN_SPARK_FX_MS = 420;
const CHAIN_LINK_WINDOW_MS = 250;
const BLINK_TRAIL_FX_MS = 280;
const POWER_UP_POP_MS = 200;
/** Blink = teleport: a jump larger than this in one frame spawns a trail. */
const BLINK_JUMP_TILES = 1.25;
/** Thresh hook projectile visual timing. */
const HOOK_FLIGHT_MS = 300;
const HOOK_IMPACT_MS = 250;
const HOOK_FADE_MS = 200;
const HOOK_TOTAL_MS = HOOK_FLIGHT_MS + HOOK_IMPACT_MS + HOOK_FADE_MS;
/** Thresh hook victim pull timing — snare, drag, release. */
const HOOK_PULL_SNARE_MS = 100;
const HOOK_PULL_DRAG_MS = 250;
const HOOK_PULL_RELEASE_MS = 50;
const HOOK_PULL_TOTAL_MS = HOOK_PULL_SNARE_MS + HOOK_PULL_DRAG_MS + HOOK_PULL_RELEASE_MS;

/**
 * Champion accent → RGB for arena floor plate + sprite glow.
 * Tuned to pop on light stone tiles (product arena) without washing the sprite.
 */
const ACCENT_RGB: Readonly<Record<ChampAccent, string>> = Object.freeze({
  blue: "56 217 245",
  gold: "232 188 72",
  green: "57 255 136",
  red: "255 96 88",
  orange: "255 140 48",
});

const DUAL_BODY_PROJECTION_SKILL_IDS: ReadonlySet<SkillId> = new Set([
  RANNI_ICE_BLINK_SKILL_ID,
  ZED_LIVING_SHADOW_SKILL_ID,
]);

function accentRgb(accent: ChampAccent): string {
  return ACCENT_RGB[accent];
}

type SpriteTrimBounds = Readonly<{
  x: number;
  y: number;
  width: number;
  height: number;
}>;

type PresentationFx = {
  kind: "power-reveal" | "power-collect";
  tileX: number;
  tileY: number;
  powerUpType: "bomb-up" | "flame-up";
  label: string;
  startMs: number;
};

type AnimationLabFx = Readonly<{
  packId: AnimationLabPackId;
  anchor: { tileX: number; tileY: number } | "hud";
  startMs: number;
}>;

type CrateBreakFx = {
  tile: TileCoord;
  startMs: number;
};

type ChainSparkFx = {
  fromTile: TileCoord;
  toTile: TileCoord;
  startMs: number;
};

type BlinkTrailFx = {
  from: { x: number; y: number };
  to: { x: number; y: number };
  startMs: number;
};

type PressureWarnFx = {
  tile: TileCoord;
  startMs: number;
  durationMs: number;
};

type DeathAnim = {
  position: { x: number; y: number };
  facing: Facing;
  startMs: number;
};

type TimedChampionAction = Readonly<{
  action: SkillAnimationAction;
  startMs: number;
  /** Optional kernel-owned duration used to keep presentation in lockstep. */
  durationMs?: number;
  /** Optional entrance animation duration before holding the action's last frame. */
  buildMs?: number;
}>;

/** Thresh Death Sentence hook projectile visual state. */
type HookProjectileFx = {
  ownerId: CompetitorId;
  originTile: TileCoord;
  direction: Direction;
  reachTiles: number;
  hit: boolean;
  startMs: number;
};

/** Thresh hook victim pull animation — victim slides along the chain. */
type HookPullFx = {
  victimId: CompetitorId;
  /** Victim position before the teleport (fixed-point world units). */
  fromPos: { x: number; y: number };
  /** Victim position after the teleport (fixed-point world units). */
  toPos: { x: number; y: number };
  /** Thresh tile at the moment of the pull (chain origin). */
  threshTile: TileCoord;
  startMs: number;
};

type RecentExplosion = {
  bombId: number;
  tile: TileCoord;
  flameTiles: readonly TileCoord[];
  startMs: number;
};

/** Presentation-only local control slots. Not domain identity. */
type LocalControlSlot = "control-a" | "control-b";

type BrowserCopy = Readonly<{
  back: string;
  pause: string;
  resume: string;
  restart: string;
  protected: string;
  bombs: string;
  range: string;
  wins: string;
  round: string;
  firstTo: string;
  playing: string;
  roundStart: string;
  suddenDeath: string;
  paused: string;
  roundOver: string;
  matchOver: string;
  getReady: string;
  go: string;
  doubleKo: string;
  controlsHint: string;
  devShow: string;
  devHide: string;
  devTitle: string;
  ready: string;
  winner: (name: string) => string;
  matchWinner: (name: string) => string;
  controlName: (slot: LocalControlSlot) => string;
  p2Human: string;
  p2Bot: string;
  you: string;
  ultReady: string;
  ultCast: string;
  rivalOut: string;
  skillCooldown: (seconds: number) => string;
  p2ModeLabel: (control: "human" | "bot") => string;
}>;

const PT_COPY: BrowserCopy = Object.freeze({
  back: "Voltar ao Bomba PvP",
  pause: "Pausar",
  resume: "Continuar",
  restart: "Reiniciar",
  protected: "Protegido",
  bombs: "Bombas",
  range: "Alcance",
  wins: "Vitórias",
  round: "Rodada",
  firstTo: "FT",
  playing: "Em jogo",
  roundStart: "Preparar",
  suddenDeath: "Morte súbita",
  paused: "Pausado",
  roundOver: "Fim da rodada",
  matchOver: "Fim da partida",
  getReady: "Prepare-se",
  go: "Vai!",
  doubleKo: "Double KO",
  controlsHint: "P1 WASD+Q+Espaço/R · P2 ←↑↓→+O+I · Esc pausa · T reinicia · M som",
  devShow: "Dev",
  devHide: "Fechar",
  devTitle: "Diagnóstico",
  ready: "Arena pronta.",
  winner: (name) => `${name} venceu a rodada`,
  matchWinner: (name) => `${name} venceu a partida`,
  controlName: (slot) => championName(slot),
  p2Human: "Humano",
  p2Bot: "Bot",
  you: "VOCÊ",
  ultReady: "RDY",
  ultCast: "CAST",
  rivalOut: "FORA",
  skillCooldown: (seconds) => `${seconds.toFixed(1)}`,
  p2ModeLabel: (control) => (control === "bot" ? "P2: Bot" : "P2: Humano"),
});

const EN_COPY: BrowserCopy = Object.freeze({
  back: "Back to Bomba PvP",
  pause: "Pause",
  resume: "Resume",
  restart: "Restart",
  protected: "Protected",
  bombs: "Bombs",
  range: "Range",
  wins: "Wins",
  round: "Round",
  firstTo: "FT",
  playing: "Playing",
  roundStart: "Get ready",
  suddenDeath: "Sudden death",
  paused: "Paused",
  roundOver: "Round over",
  matchOver: "Match over",
  getReady: "Get ready",
  go: "Go!",
  doubleKo: "Double KO",
  controlsHint: "P1 WASD+Q+Space/R · P2 ←↑↓→+O+I · Esc pause · T restart · M sound",
  devShow: "Dev",
  devHide: "Close",
  devTitle: "Diagnostics",
  ready: "Arena ready.",
  winner: (name) => `${name} wins the round`,
  matchWinner: (name) => `${name} wins the match`,
  controlName: (slot) => championName(slot),
  p2Human: "Human",
  p2Bot: "Bot",
  you: "YOU",
  ultReady: "RDY",
  ultCast: "CAST",
  rivalOut: "OUT",
  skillCooldown: (seconds) => `${seconds.toFixed(1)}`,
  p2ModeLabel: (control) => (control === "bot" ? "P2: Bot" : "P2: Human"),
});

/** Presentational portal pads (mid-edge) — visual floor art over the real wrap portals. */
const VISUAL_PORTALS: readonly TileCoord[] = Object.freeze([
  Object.freeze({ x: 0, y: 4 }),
  Object.freeze({ x: ARENA_WIDTH - 1, y: 4 }),
  Object.freeze({ x: 5, y: 0 }),
  Object.freeze({ x: 5, y: ARENA_HEIGHT - 1 }),
]);

const SPAWN_PAD_KEYS = new Set(CANONICAL_SPAWNS.map((t) => `${t.x},${t.y}`));
const PORTAL_PAD_KEYS = new Set(VISUAL_PORTALS.map((t) => `${t.x},${t.y}`));

const FLOOR_BASE_URLS = [floorBaseUrl, floorBaseAltUrl, floorBaseAlt2Url, floorBaseAlt3Url] as const;
const FLAME_ANIM_URLS = [
  flameAnim00Url,
  flameAnim02Url,
  flameAnim04Url,
  flameAnim06Url,
  flameAnim08Url,
  flameAnim10Url,
  flameAnim12Url,
  flameAnim14Url,
] as const;

const CRATE_BREAK_URLS = [crateBreak0Url, crateBreak1Url, crateBreak2Url, crateBreak3Url] as const;

const initialLaunchState = parseBrowserLaunchState(window.location.search);
let activeConfiguration = initialLaunchState.configuration;
let activeMatchNumber = 1;

/** Active visual packs + roster meta for the current typed browser mode. */
let selectedP1 = activeConfiguration.players[0].championSlug;
let selectedP2 = activeConfiguration.players[1].championSlug;

function presentationFor(slot: LocalControlSlot): ChampPresentation {
  const slug = slot === "control-a" ? selectedP1 : selectedP2;
  const entry = getChampionPresentation(slug);
  if (!entry) throw new Error(`Missing champion presentation: ${slug}`);
  return entry;
}

function activePack(slot: LocalControlSlot): ChampPack {
  return presentationFor(slot).pack;
}

function championName(slot: LocalControlSlot): string {
  return presentationFor(slot).name;
}

function championCooldownMs(slot: LocalControlSlot): number {
  return presentationFor(slot).skillCooldownMs;
}

function buildMatchConfig(
  configuration: BrowserMatchConfiguration,
  matchNumber = activeMatchNumber,
) {
  const localDuelConfig = createLocalDuel1v1MatchConfig({
    seed: seedForBrowserMatch(configuration, matchNumber),
  });
  return createMatchConfig({
    ...localDuelConfig,
    seats: localDuelConfig.seats.map((seat, index) => {
      const champ = getChampionPresentation(configuration.players[index]!.championSlug);
      const skillId = champ?.kernelSkillId;
      return {
        seatId: seat.seatId,
        competitorId: seat.competitorId,
        ...(skillId ? { skillId } : {}),
      };
    }),
  });
}

let matchConfig = buildMatchConfig(activeConfiguration);
const localCompetitorBySlot: Readonly<Record<LocalControlSlot, CompetitorId>> = Object.freeze({
  "control-a": matchConfig.seats[0]!.competitorId,
  "control-b": matchConfig.seats[1]!.competitorId,
});
const localSlotByCompetitor: ReadonlyMap<CompetitorId, LocalControlSlot> = new Map([
  [localCompetitorBySlot["control-a"], "control-a"],
  [localCompetitorBySlot["control-b"], "control-b"],
]);

/**
 * Adapter-only bot controllers. The selected profile is resolved once per
 * match and passed into driveBot on every decision; the kernel only sees the
 * resulting ordinary GameCommands.
 */
let labExperienceRecording = false;
let labExperienceSink: InMemoryExperienceSink = createInMemoryExperienceSink();
let botDrivers: BrowserBotDriver[] = createBrowserBotDrivers(activeConfiguration, matchConfig, {
  experienceSink: labExperienceSink,
  recordExperience: labExperienceRecording,
});
function resetBots(): void {
  labExperienceSink = createInMemoryExperienceSink();
  botDrivers = createBrowserBotDrivers(activeConfiguration, matchConfig, {
    experienceSink: labExperienceSink,
    recordExperience: labExperienceRecording,
  });
}
function playerIndexForSlot(slot: LocalControlSlot): 0 | 1 {
  return slot === "control-a" ? 0 : 1;
}
function slotIsBot(slot: LocalControlSlot): boolean {
  return activeConfiguration.players[playerIndexForSlot(slot)].control === "bot";
}
function competitorIsBot(competitorId: CompetitorId): boolean {
  return slotIsBot(slotForCompetitor(competitorId));
}
function p2IsBot(): boolean {
  return slotIsBot("control-b");
}

const MOVEMENT_BINDINGS: Readonly<Record<string, Readonly<{
  competitorId: CompetitorId;
  direction: Direction;
}>>> = Object.freeze({
  KeyW: Object.freeze({ competitorId: localCompetitorBySlot["control-a"], direction: "up" }),
  KeyS: Object.freeze({ competitorId: localCompetitorBySlot["control-a"], direction: "down" }),
  KeyA: Object.freeze({ competitorId: localCompetitorBySlot["control-a"], direction: "left" }),
  KeyD: Object.freeze({ competitorId: localCompetitorBySlot["control-a"], direction: "right" }),
  ArrowUp: Object.freeze({ competitorId: localCompetitorBySlot["control-b"], direction: "up" }),
  ArrowDown: Object.freeze({ competitorId: localCompetitorBySlot["control-b"], direction: "down" }),
  ArrowLeft: Object.freeze({ competitorId: localCompetitorBySlot["control-b"], direction: "left" }),
  ArrowRight: Object.freeze({ competitorId: localCompetitorBySlot["control-b"], direction: "right" }),
});

function element<K extends keyof HTMLElementTagNameMap>(
  document: Document,
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function formatTime(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1_000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function slotForCompetitor(competitorId: CompetitorId): LocalControlSlot {
  return localSlotByCompetitor.get(competitorId) ?? "control-a";
}

function displayName(competitorId: CompetitorId, copy: BrowserCopy): string {
  const slot = slotForCompetitor(competitorId);
  const profile = botProfileForPlayer(activeConfiguration, playerIndexForSlot(slot));
  return profile ? `${profile.label} · ${copy.controlName(slot)}` : copy.controlName(slot);
}

function eventDescription(event: GameEvent, copy: BrowserCopy): string | null {
  if (event.type === "competitor-moved") return null;
  if (event.type === "bomb-placed") {
    return `${displayName(event.competitorId, copy)} · bomb #${event.bombId} @ ${event.at.x},${event.at.y}`;
  }
  if (event.type === "bomb-exploded") {
    return `bomb #${event.bombId} · ${event.flameTiles.length} flame tiles`;
  }
  if (event.type === "crate-destroyed") return `crate cleared @ ${event.at.x},${event.at.y}`;
  if (event.type === "power-up-revealed") {
    return `power-up ${event.powerUpType} revealed @ ${event.at.x},${event.at.y}`;
  }
  if (event.type === "power-up-collected") {
    return `${displayName(event.competitorId, copy)} · ${event.powerUpType} (B${event.maxBombs}/F${event.flameRange})`;
  }
  if (event.type === "competitor-eliminated") {
    return `${displayName(event.competitorId, copy)} eliminated`;
  }
  if (event.type === "pressure-warning") {
    return `pressure warn #${event.pressureIndex} @ ${event.tile.x},${event.tile.y}`;
  }
  if (event.type === "pressure-closed") {
    return `pressure closed #${event.pressureIndex} @ ${event.tile.x},${event.tile.y}`;
  }
  if (event.type === "round-started") return `round ${event.roundNumber}`;
  if (event.type === "round-became-playable") return `round ${event.roundNumber} playable`;
  if (event.type === "sudden-death-started") return `sudden death · round ${event.roundNumber}`;
  if (event.type === "round-ended") {
    if (event.outcome.winner) return copy.winner(displayName(event.outcome.winner, copy));
    return copy.doubleKo;
  }
  if (event.type === "match-ended") return copy.matchWinner(displayName(event.winner, copy));
  if (event.type === "phase-changed") return event.phase === "paused" ? copy.paused : copy.playing;
  if (event.type === "restarted") return copy.ready;
  return null;
}

function facingFromVelocity(vx: number, vy: number, fallback: Facing): Facing {
  if (Math.abs(vx) < MOVE_SPEED_THRESHOLD && Math.abs(vy) < MOVE_SPEED_THRESHOLD) return fallback;
  if (Math.abs(vx) >= Math.abs(vy)) return vx >= 0 ? "east" : "west";
  return vy >= 0 ? "south" : "north";
}

function isDevQueryEnabled(): boolean {
  try {
    return new URLSearchParams(window.location.search).get("dev") === "1";
  } catch {
    return false;
  }
}

function isAnimationLabDemoEnabled(): boolean {
  try {
    return new URLSearchParams(window.location.search).get("animationLab") === "1";
  } catch {
    return false;
  }
}

const root = document.querySelector<HTMLElement>("#game-mechanics-root");
if (!root) throw new Error("GameMechanics root was not found.");

const isEnglish = window.location.hostname.replace(/^www\./, "") === "bombpvp.com";
const copy = isEnglish ? EN_COPY : PT_COPY;
const animationLabDemoEnabled = isAnimationLabDemoEnabled();
document.documentElement.lang = isEnglish ? "en" : "pt-BR";
document.title = isEnglish ? "Bomba PvP · Arena" : "Bomba PvP · Arena";
root.removeAttribute("aria-live");

let game = createGameMechanics(matchConfig);
const imageCache = new Map<string, HTMLImageElement>();
const spriteTrimCache = new WeakMap<HTMLImageElement, SpriteTrimBounds | null>();
const atlasFrameTrimCache = new WeakMap<
  HTMLImageElement,
  Map<string, SpriteTrimBounds | null>
>();
let trimProbeCanvas: HTMLCanvasElement | null = null;
let trimProbeContext: CanvasRenderingContext2D | null = null;
const pressedMovementCodes = new Set<string>();
const eventMessages: string[] = [copy.ready];
const presentationFx: PresentationFx[] = [];
const animationLabFx: AnimationLabFx[] = [];
let animationLabDemoIndex = 0;
let animationLabDemoNextMs = 0;
const crateBreakFx: CrateBreakFx[] = [];
const chainSparkFx: ChainSparkFx[] = [];
const blinkTrailFx: BlinkTrailFx[] = [];
const pressureWarnFx: PressureWarnFx[] = [];
const deathAnims = new Map<CompetitorId, DeathAnim>();
/** Full presentation sequences started by skills or bomb placement. */
const championActionAnims = new Map<CompetitorId, TimedChampionAction>();
/** Previous skill phase for detecting a new skill presentation sequence. */
const prevChampionSkillPhase = new Map<CompetitorId, string>();
/**
 * Previous skill projection pose for the explicitly allowlisted dual-body skills:
 * Ice Blink's spirit and Living Shadow's clone. Other projections stay hidden.
 * Map key kept as ranniProjectionPose for existing visual-adapter tests.
 */
const ranniProjectionPose = new Map<CompetitorId, {
  x: number;
  y: number;
  facing: Facing;
  lastMoveMs: number;
  skillId: SkillId | null;
}>();
/** Thresh hook projectile FX (visual only, kernel logic is authoritative). */
const hookProjectileFx: HookProjectileFx[] = [];
/** Thresh hook victim pull animations. */
const hookPullFx: HookPullFx[] = [];
/** Track previous skill phase per competitor to detect channel→cooldown transitions. */
const prevSkillPhase = new Map<CompetitorId, string>();
/** Last known aim direction while channeling (kernel clears it on cooldown). */
const lastChannelAim = new Map<CompetitorId, Direction>();
/** Last known origin tile while channeling. */
const lastChannelOrigin = new Map<CompetitorId, TileCoord>();
/** Bomb tile by id from the latest snapshot (chain-spark origin lookup). */
const bombTilesById = new Map<number, TileCoord>();
/** Pop-in clock for freshly placed bombs. */
const bombPlaceFx = new Map<number, number>();
/** Pop-in clock for freshly revealed power-ups, keyed by tile. */
const powerUpRevealFx = new Map<string, number>();
/** Recent explosions for chain-reaction spark linking. */
const recentExplosions: RecentExplosion[] = [];
/** Last rendered pose per competitor (death capture + blink-jump detection). */
const lastCompetitorPose = new Map<CompetitorId, { x: number; y: number; facing: Facing }>();
let screenShakeUntilMs = 0;
let screenShakeAmplitudePx = 0;
const prefersReducedMotion = (() => {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
})();
const lastFacing = new Map<CompetitorId, Facing>([
  [localCompetitorBySlot["control-a"], "south"],
  [localCompetitorBySlot["control-b"], "north"],
]);

let devOpen = isDevQueryEnabled();
let suddenDeathBannerUntilMs = 0;
let lastKnownPhase: GameSnapshot["phase"] = game.snapshot().phase;

function loadImage(url: string): HTMLImageElement {
  const existing = imageCache.get(url);
  if (existing) return existing;
  const image = new Image();
  image.decoding = "async";
  image.src = url;
  imageCache.set(url, image);
  return image;
}

/**
 * Arena, HUD and effect bitmaps — everything a match needs regardless of who is
 * playing. Champion atlases are deliberately excluded; see `preloadChampion`.
 */
function preloadScene(): void {
  const urls = new Set<string>([
    brandMarkUrl,
    ...FLOOR_BASE_URLS,
    floorLaneUrl,
    floorSpawnUrl,
    floorPortalUrl,
    wallUrl,
    wallAltUrl,
    crateUrl,
    crateAltUrl,
    bombUrl,
    flameUrl,
    ...FLAME_ANIM_URLS,
    powerBombUrl,
    powerFlameUrl,
    ...CRATE_BREAK_URLS,
    hudBombIconUrl,
    hudFlameIconUrl,
    ...ANIMATION_LAB_PACKS.map((pack) => pack.atlasUrl),
  ]);
  for (const url of urls) loadImage(url);
}

/**
 * Fetch one champion's atlas + portrait. Idempotent — `loadImage` caches by
 * URL, so calling this on every seat change costs nothing after the first hit.
 */
function preloadChampion(slug: string): void {
  const entry = getChampionPresentation(slug);
  if (!entry) return;
  for (const url of collectChampionAssetUrls([entry])) loadImage(url);
}

/** Warm the champions the current seats actually use. */
function preloadSelectedChampions(): void {
  preloadChampion(selectedP1);
  preloadChampion(selectedP2);
}

function drawImageUrl(
  ctx: CanvasRenderingContext2D,
  url: string,
  x: number,
  y: number,
  w: number,
  h: number,
): boolean {
  const image = loadImage(url);
  if (!image.complete || image.naturalWidth <= 0) return false;
  ctx.drawImage(image, x, y, w, h);
  return true;
}

function ensureTrimProbe(): CanvasRenderingContext2D | null {
  if (trimProbeContext) return trimProbeContext;
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true }) ?? canvas.getContext("2d");
  if (!context) return null;
  trimProbeCanvas = canvas;
  trimProbeContext = context;
  return context;
}

/** Stable opaque content rect — trims transparent padding so champions match product scale. */
function getSpriteTrimBounds(image: HTMLImageElement): SpriteTrimBounds | null {
  if (spriteTrimCache.has(image)) return spriteTrimCache.get(image) ?? null;
  const width = image.naturalWidth || image.width || 0;
  const height = image.naturalHeight || image.height || 0;
  if (width <= 0 || height <= 0) return null;
  const context = ensureTrimProbe();
  if (!trimProbeCanvas || !context) {
    spriteTrimCache.set(image, null);
    return null;
  }
  if (trimProbeCanvas.width !== width) trimProbeCanvas.width = width;
  if (trimProbeCanvas.height !== height) trimProbeCanvas.height = height;
  context.clearRect(0, 0, width, height);
  try {
    context.drawImage(image, 0, 0, width, height);
    const data = context.getImageData(0, 0, width, height).data;
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const alpha = data[(y * width + x) * 4 + 3] ?? 0;
        if (alpha <= SPRITE_ALPHA_THRESHOLD) continue;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    if (maxX < minX || maxY < minY) {
      spriteTrimCache.set(image, null);
      return null;
    }
    const bounds = Object.freeze({
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    });
    spriteTrimCache.set(image, bounds);
    return bounds;
  } catch {
    const fallback = Object.freeze({ x: 0, y: 0, width, height });
    spriteTrimCache.set(image, fallback);
    return fallback;
  }
}

export type SpriteSource = Readonly<{
  image: HTMLImageElement;
  srcX: number;
  srcY: number;
  srcW: number;
  srcH: number;
}>;

/**
 * Resolve a frame token into an image plus source rect.
 *
 * Champion frames are atlas references whose opaque bounds were measured at
 * build time; everything else is a plain URL that still needs a runtime trim.
 * Returns null while the bitmap is still decoding.
 */
function resolveSpriteSource(token: string): SpriteSource | null {
  const atlasFrame = resolveAtlasFrame(token);
  if (atlasFrame) {
    const image = loadImage(atlasFrame.url);
    if (!image.complete || image.naturalWidth <= 0) return null;
    const { region } = atlasFrame;
    return {
      image,
      srcX: region.x,
      srcY: region.y,
      srcW: region.w,
      srcH: region.h,
    };
  }

  const image = loadImage(token);
  if (!image.complete || image.naturalWidth <= 0) return null;
  const trim = getSpriteTrimBounds(image);
  return {
    image,
    srcX: trim?.x ?? 0,
    srcY: trim?.y ?? 0,
    srcW: trim?.width ?? image.naturalWidth,
    srcH: trim?.height ?? image.naturalHeight,
  };
}

function acceptsGameplayInput(phase: GameSnapshot["phase"] = game.snapshot().phase): boolean {
  return phase === "playing" || phase === "sudden-death";
}

function floorUrlFor(x: number, y: number): string {
  const key = `${x},${y}`;
  if (SPAWN_PAD_KEYS.has(key)) return floorSpawnUrl;
  if (PORTAL_PAD_KEYS.has(key)) return floorPortalUrl;
  const centerX = Math.floor(ARENA_WIDTH / 2);
  const centerY = Math.floor(ARENA_HEIGHT / 2);
  const sideColumn = Math.min(2, ARENA_WIDTH - 3);
  const farSideColumn = Math.max(ARENA_WIDTH - 3, sideColumn + 1);
  const sideRow = Math.min(2, ARENA_HEIGHT - 3);
  const farSideRow = Math.max(ARENA_HEIGHT - 3, sideRow + 1);
  const isCenterLane = x === centerX || y === centerY;
  const isSideLane =
    x === sideColumn || x === farSideColumn || y === sideRow || y === farSideRow;
  if (isCenterLane || isSideLane) return floorLaneUrl;
  return FLOOR_BASE_URLS[(x + 2 * y) % FLOOR_BASE_URLS.length]!;
}

function wallUrlFor(x: number, y: number): string {
  return (x + y) % 2 === 0 ? wallUrl : wallAltUrl;
}

function crateUrlFor(x: number, y: number): string {
  return (x + y) % 2 === 0 ? crateUrl : crateAltUrl;
}

// ── DOM shell ────────────────────────────────────────────────

const app = element(document, "main", "arena-app");

const hud = element(document, "header", "arena-hud");
const hudBar = element(document, "div", "arena-hud__bar");

const brand = element(document, "a", "arena-brand");
brand.href = "/";
brand.setAttribute("aria-label", copy.back);
const brandImg = document.createElement("img");
brandImg.src = brandMarkUrl;
brandImg.alt = "";
brand.append(brandImg, element(document, "span", undefined, "Bomba PvP"));

// ── LoL-inspired dual HUD (P1 left · timer center · P2 right) ──

type LolHudPanel = Readonly<{
  root: HTMLElement;
  portrait: HTMLImageElement;
  name: HTMLElement;
  tag: HTMLElement;
  skillName: HTMLElement;
  controller: HTMLElement;
  status: HTMLElement;
  statusBar: HTMLElement;
  pips: HTMLElement;
  bombs: HTMLElement;
  range: HTMLElement;
  bombChip: HTMLElement;
  flameChip: HTMLElement;
  spellQ: HTMLElement;
  spellR: HTMLElement;
  spellRLabel: HTMLElement;
  spellRCd: HTMLElement;
  portraitRing: HTMLElement;
  competitorId: CompetitorId;
  slot: LocalControlSlot;
}>;

function createLolHudPanel(slot: LocalControlSlot): LolHudPanel {
  const side = slot === "control-a" ? "p1" : "p2";
  const root = element(
    document,
    "div",
    `arena-player-card arena-player-card--${side} lol-hud lol-hud--${side}`,
  );
  root.dataset.slot = side;
  root.dataset.accent = presentationFor(slot).accent;

  const portraitWrap = element(document, "div", "lol-hud__portrait-wrap");
  const portraitRing = element(document, "div", "lol-hud__portrait-ring");
  const portrait = document.createElement("img");
  portrait.className = "lol-hud__portrait";
  portrait.alt = "";
  portrait.decoding = "async";
  portrait.src = presentationFor(slot).portrait;
  portraitWrap.append(portraitRing, portrait);

  const body = element(document, "div", "lol-hud__body");
  const header = element(document, "div", "lol-hud__header");
  const tag = element(document, "span", "lol-hud__tag", side === "p1" ? "P1" : "P2");
  const name = element(document, "span", "lol-hud__name", championName(slot));
  const pips = element(document, "div", "lol-hud__pips hud-pips");
  header.append(tag, name, pips);
  const controller = element(document, "div", "lol-hud__controller", "");

  const statusRow = element(document, "div", "lol-hud__status-row");
  const statusBar = element(document, "div", "lol-hud__hp");
  const statusBarFill = element(document, "span", "lol-hud__hp-fill");
  statusBarFill.style.width = "100%";
  statusBar.append(statusBarFill);
  const status = element(document, "span", "lol-hud__status", "");
  statusRow.append(statusBar, status);

  const skillName = element(
    document,
    "div",
    "lol-hud__skill-name",
    presentationFor(slot).skillName,
  );

  const powerRail = element(document, "div", "lol-hud__power hud-power");
  const bombChip = element(document, "span", "hud-power__chip");
  const bombIcon = document.createElement("img");
  bombIcon.src = hudBombIconUrl;
  bombIcon.alt = "";
  const bombs = element(document, "span", "hud-power__value", "1/1");
  bombChip.append(bombIcon, bombs);
  const flameChip = element(document, "span", "hud-power__chip");
  const flameIcon = document.createElement("img");
  flameIcon.src = hudFlameIconUrl;
  flameIcon.alt = "";
  const range = element(document, "span", "hud-power__value", "1");
  flameChip.append(flameIcon, range);
  powerRail.append(bombChip, flameChip);

  const spells = element(document, "div", "lol-hud__spells");
  const spellQ = element(document, "div", "lol-hud__spell lol-hud__spell--q");
  spellQ.title = slot === "control-a" ? "Q · Bomba" : "O · Bomba";
  spellQ.append(element(document, "span", "lol-hud__spell-key", slot === "control-a" ? "Q" : "O"));
  const spellQIcon = document.createElement("img");
  spellQIcon.src = hudBombIconUrl;
  spellQIcon.alt = "";
  spellQ.append(spellQIcon);

  const spellR = element(document, "div", "lol-hud__spell lol-hud__spell--r is-ready");
  const skillKey = slot === "control-a" ? "R" : "I";
  spellR.title = `${skillKey} · ${presentationFor(slot).skillName}`;
  spellR.append(element(document, "span", "lol-hud__spell-key", skillKey));
  const spellRLabel = element(
    document,
    "span",
    "lol-hud__spell-label",
    presentationFor(slot).skillName.slice(0, 1).toUpperCase(),
  );
  const spellRCd = element(document, "span", "lol-hud__spell-cd", "");
  spellR.append(spellRLabel, spellRCd);
  spells.append(spellQ, spellR);

  body.append(header, controller, statusRow, skillName, powerRail, spells);
  root.append(portraitWrap, body);

  return {
    root,
    portrait,
    name,
    tag,
    skillName,
    controller,
    status,
    statusBar: statusBarFill,
    pips,
    bombs,
    range,
    bombChip,
    flameChip,
    spellQ,
    spellR,
    spellRLabel,
    spellRCd,
    portraitRing,
    competitorId: localCompetitorBySlot[slot],
    slot,
  };
}

function paintLolIdentity(panel: LolHudPanel): void {
  const champ = presentationFor(panel.slot);
  panel.root.dataset.accent = champ.accent;
  panel.portrait.src = champ.portrait;
  panel.name.textContent = champ.name;
  panel.skillName.textContent = champ.skillName;
  panel.spellR.title = `${panel.slot === "control-a" ? "R" : "I"} · ${champ.skillName}`;
  panel.spellRLabel.textContent = champ.skillName.slice(0, 1).toUpperCase();
  panel.spellR.classList.toggle("is-locked", !champ.kernelSkillId);
  const profile = botProfileForPlayer(activeConfiguration, playerIndexForSlot(panel.slot));
  panel.controller.textContent = profile
    ? `${isEnglish ? "AI" : "IA"} · ${profile.label}`
    : (isEnglish ? "HUMAN" : "HUMANO");
  panel.root.classList.toggle("is-bot-controlled", profile !== null);
}

const p1Hud = createLolHudPanel("control-a");
const p2Hud = createLolHudPanel("control-b");
paintLolIdentity(p1Hud);
paintLolIdentity(p2Hud);
/** @deprecated alias kept for pulseHudStat compatibility */
const localPanel = p1Hud;
const rivalPill = p2Hud;

/** Brief pulse on the HUD power chip that just grew (pickup feedback). */
function pulseHudStat(competitorId: CompetitorId, powerUpType: "bomb-up" | "flame-up"): void {
  const panel =
    competitorId === p1Hud.competitorId
      ? p1Hud
      : competitorId === p2Hud.competitorId
        ? p2Hud
        : null;
  if (!panel) return;
  const target = powerUpType === "bomb-up" ? panel.bombChip : panel.flameChip;
  target.classList.remove("is-pulsed");
  void target.offsetWidth;
  target.classList.add("is-pulsed");
}

const timerShell = element(document, "div", "arena-timer-shell hud-meta");
const roundLabel = element(document, "div", "arena-timer-shell__round", "R1 · FT2");
const timeValue = element(document, "div", "arena-timer-shell__time", "00:00");
const sdMeter = element(document, "div", "hud-meta__sd");
const sdMeterFill = element(document, "span", "hud-meta__sd-fill");
sdMeter.append(sdMeterFill);
timerShell.append(roundLabel, timeValue, sdMeter);

hudBar.append(p1Hud.root, timerShell, p2Hud.root);
hud.append(brand, hudBar);

// ── Landing mode + competitor selection ───────────────────────

let matchStarted = false;
let pickMode: BrowserGameMode = activeConfiguration.mode;
let pickP1 = selectedP1;
let pickP2 = selectedP2;
let pickBotP1: BotProfileId = botProfileForPlayer(activeConfiguration, 0)?.id ?? "bomb";
let pickBotP2: BotProfileId = botProfileForPlayer(activeConfiguration, 1)?.id
  ?? (activeConfiguration.mode === "bot-training" ? "bomb" : "pingo");

const selectScreen = element(document, "section", "char-select");
selectScreen.setAttribute(
  "aria-label",
  isEnglish ? "Game mode and competitor selection" : "Seleção de modo e competidores",
);

const selectInner = element(document, "div", "char-select__inner");
const selectTitle = element(
  document,
  "h1",
  "char-select__title",
  isEnglish ? "Choose your experiment" : "Escolha seu experimento",
);
const selectSub = element(
  document,
  "p",
  "char-select__sub",
  isEnglish
    ? "Play locally, train against one bot, or watch two selected AIs compete."
    : "Jogue localmente, treine contra um bot ou observe duas IAs selecionadas.",
);

const modePicker = element(document, "div", "char-select__modes");
modePicker.setAttribute("role", "radiogroup");
modePicker.setAttribute("aria-label", isEnglish ? "Game modes" : "Modos de jogo");
const modeDefinitions: readonly Readonly<{
  id: BrowserGameMode;
  label: string;
  description: string;
  marker: string;
}>[] = Object.freeze([
  Object.freeze({
    id: "local-duel",
    label: isEnglish ? "Local duel" : "Duelo local",
    description: isEnglish ? "Two players · one keyboard" : "Dois jogadores · um teclado",
    marker: "2P",
  }),
  Object.freeze({
    id: "bot-training",
    label: isEnglish ? "Bot training" : "Treino vs bot",
    description: isEnglish ? "Human vs selected AI profile" : "Humano vs perfil de IA",
    marker: "1P",
  }),
  Object.freeze({
    id: "bot-lab",
    label: isEnglish ? "AI laboratory" : "Laboratório de IA",
    description: isEnglish ? "Selected bot vs selected bot" : "Bot selecionado vs bot selecionado",
    marker: "LAB",
  }),
]);
const modeButtons = new Map<BrowserGameMode, HTMLButtonElement>();
for (const definition of modeDefinitions) {
  const button = element(document, "button", "char-select__mode") as HTMLButtonElement;
  button.type = "button";
  button.dataset.mode = definition.id;
  button.setAttribute("role", "radio");
  button.append(
    element(document, "span", "char-select__mode-marker", definition.marker),
    element(document, "strong", "char-select__mode-label", definition.label),
    element(document, "span", "char-select__mode-description", definition.description),
  );
  modeButtons.set(definition.id, button);
  modePicker.append(button);
}

function buildPickColumn(side: "p1" | "p2"): {
  root: HTMLElement;
  badge: HTMLElement;
  portrait: HTMLImageElement;
  name: HTMLElement;
  skill: HTMLElement;
  grid: HTMLElement;
  profileField: HTMLElement;
  profileSelect: HTMLSelectElement;
} {
  const root = element(document, "div", `char-select__col char-select__col--${side}`);
  const badge = element(document, "div", "char-select__badge", side === "p1" ? "PLAYER 1" : "PLAYER 2");
  const stage = element(document, "div", "char-select__stage");
  const portrait = document.createElement("img");
  portrait.className = "char-select__hero";
  portrait.alt = "";
  portrait.decoding = "async";
  const name = element(document, "h2", "char-select__name", "");
  const skill = element(document, "p", "char-select__skill", "");
  stage.append(portrait, name, skill);
  const profileField = element(document, "label", "char-select__profile");
  profileField.append(element(
    document,
    "span",
    "char-select__profile-label",
    isEnglish ? "AI profile" : "Perfil de IA",
  ));
  const profileSelect = document.createElement("select");
  profileSelect.setAttribute(
    "aria-label",
    isEnglish ? `${side === "p1" ? "P1" : "P2"} AI profile` : `Perfil de IA do ${side === "p1" ? "P1" : "P2"}`,
  );
  for (const profile of BOT_PROFILES) {
    const option = document.createElement("option");
    option.value = profile.id;
    option.textContent = `${profile.label} · ${profile.model}`;
    profileSelect.append(option);
  }
  profileSelect.value = side === "p1" ? pickBotP1 : pickBotP2;
  profileField.append(profileSelect);
  const grid = element(document, "div", "char-select__grid");
  grid.setAttribute("role", "listbox");
  grid.setAttribute("aria-label", side === "p1" ? "P1 roster" : "P2 roster");
  root.append(badge, stage, profileField, grid);
  return { root, badge, portrait, name, skill, grid, profileField, profileSelect };
}

const colP1 = buildPickColumn("p1");
const colP2 = buildPickColumn("p2");
const selectCols = element(document, "div", "char-select__cols");
selectCols.append(colP1.root, colP2.root);

const startBtn = element(
  document,
  "button",
  "arena-button arena-button--primary char-select__start",
  isEnglish ? "Fight" : "Lutar",
) as HTMLButtonElement;
startBtn.type = "button";

const changeBtn = element(
  document,
  "button",
  "arena-button char-select__change",
  isEnglish ? "Modes & fighters" : "Modos e personagens",
) as HTMLButtonElement;
changeBtn.type = "button";
changeBtn.title = isEnglish ? "Open mode and competitor selection" : "Abrir seleção de modo e competidores";

selectInner.append(selectTitle, selectSub, modePicker, selectCols, startBtn);
selectScreen.append(selectInner);

function paintPickColumn(
  col: ReturnType<typeof buildPickColumn>,
  slug: string,
  side: "p1" | "p2",
): void {
  const champ = getChampionPresentation(slug);
  if (!champ) return;
  // Warm the highlighted champion so confirming the pick never waits on a fetch.
  preloadChampion(slug);
  const playerIndex = side === "p1" ? 0 : 1;
  const isBot = pickMode === "bot-lab" || (pickMode === "bot-training" && playerIndex === 1);
  const profileId = side === "p1" ? pickBotP1 : pickBotP2;
  const profile = BOT_PROFILES.find(({ id }) => id === profileId);
  col.portrait.src = champ.portrait;
  col.name.textContent = champ.name;
  col.skill.textContent = isBot && profile
    ? `${profile.label} · ${champ.skillName} · ${(champ.skillCooldownMs / 1000).toFixed(0)}s`
    : `${champ.skillName} · ${(champ.skillCooldownMs / 1000).toFixed(0)}s`;
  col.root.dataset.accent = champ.accent;
  for (const btn of col.grid.querySelectorAll<HTMLButtonElement>("button")) {
    const active = btn.dataset.slug === slug;
    btn.classList.toggle("is-active", active);
    btn.setAttribute("aria-selected", String(active));
  }
}

function updateModeSelection(): void {
  for (const [mode, button] of modeButtons) {
    const active = mode === pickMode;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-checked", String(active));
  }
  const p1Bot = pickMode === "bot-lab";
  const p2Bot = pickMode !== "local-duel";
  colP1.profileField.hidden = !p1Bot;
  colP1.profileSelect.disabled = !p1Bot;
  colP2.profileField.hidden = !p2Bot;
  colP2.profileSelect.disabled = !p2Bot;
  colP1.badge.textContent = p1Bot ? "BOT A" : (isEnglish ? "PLAYER 1" : "JOGADOR 1");
  colP2.badge.textContent = p2Bot ? "BOT B" : (isEnglish ? "PLAYER 2" : "JOGADOR 2");
  startBtn.textContent = pickMode === "bot-lab"
    ? (isEnglish ? "Start experiment" : "Iniciar experimento")
    : (isEnglish ? "Fight" : "Lutar");
  paintPickColumn(colP1, pickP1, "p1");
  paintPickColumn(colP2, pickP2, "p2");
}

function fillRosterGrid(col: ReturnType<typeof buildPickColumn>, side: "p1" | "p2"): void {
  col.grid.replaceChildren();
  for (const champ of listChampionPresentations()) {
    const btn = element(document, "button", "char-select__thumb") as HTMLButtonElement;
    btn.type = "button";
    btn.dataset.slug = champ.slug;
    btn.setAttribute("role", "option");
    btn.setAttribute("aria-label", champ.name);
    btn.title = champ.name;
    const img = document.createElement("img");
    img.src = champ.portrait;
    img.alt = "";
    img.decoding = "async";
    btn.append(img, element(document, "span", "char-select__thumb-name", champ.name));
    btn.addEventListener("click", () => {
      if (side === "p1") pickP1 = champ.slug;
      else pickP2 = champ.slug;
      paintPickColumn(colP1, pickP1, "p1");
      paintPickColumn(colP2, pickP2, "p2");
    });
    col.grid.append(btn);
  }
}

fillRosterGrid(colP1, "p1");
fillRosterGrid(colP2, "p2");
colP1.profileSelect.addEventListener("change", () => {
  pickBotP1 = colP1.profileSelect.value as BotProfileId;
  paintPickColumn(colP1, pickP1, "p1");
});
colP2.profileSelect.addEventListener("change", () => {
  pickBotP2 = colP2.profileSelect.value as BotProfileId;
  paintPickColumn(colP2, pickP2, "p2");
});
for (const [mode, button] of modeButtons) {
  button.addEventListener("click", () => {
    const previousMode = pickMode;
    pickMode = mode;
    if (mode === "bot-training" && previousMode === "local-duel") {
      pickBotP2 = "bomb";
      colP2.profileSelect.value = pickBotP2;
    }
    if (mode === "bot-lab" && previousMode === "local-duel") {
      pickBotP1 = "bomb";
      pickBotP2 = "pingo";
      colP1.profileSelect.value = pickBotP1;
      colP2.profileSelect.value = pickBotP2;
    }
    updateModeSelection();
  });
}
updateModeSelection();

function stepPick(side: "p1" | "p2", delta: number): void {
  const roster = listChampionPresentations();
  const current = side === "p1" ? pickP1 : pickP2;
  const idx = Math.max(0, roster.findIndex((c) => c.slug === current));
  const next = roster[(idx + delta + roster.length) % roster.length]!;
  if (side === "p1") pickP1 = next.slug;
  else pickP2 = next.slug;
  paintPickColumn(colP1, pickP1, "p1");
  paintPickColumn(colP2, pickP2, "p2");
}

function showSelectScreen(show: boolean): void {
  selectScreen.classList.toggle("is-open", show);
  selectScreen.setAttribute("aria-hidden", show ? "false" : "true");
  app.classList.toggle("is-selecting", show);
}

function applyConfigurationAndRestart(
  configuration: BrowserMatchConfiguration,
  restartMatch = true,
): void {
  activeConfiguration = configuration;
  activeMatchNumber = 1;
  labPlaybackSpeed = 1;
  speedButton.textContent = "1×";
  selectedP1 = configuration.players[0].championSlug;
  selectedP2 = configuration.players[1].championSlug;
  preloadSelectedChampions();
  pickP1 = selectedP1;
  pickP2 = selectedP2;
  pickMode = configuration.mode;
  pickBotP1 = botProfileForPlayer(configuration, 0)?.id ?? pickBotP1;
  pickBotP2 = botProfileForPlayer(configuration, 1)?.id ?? pickBotP2;
  colP1.profileSelect.value = pickBotP1;
  colP2.profileSelect.value = pickBotP2;
  matchConfig = buildMatchConfig(configuration);
  game = createGameMechanics(matchConfig);
  resetBots();
  paintLolIdentity(p1Hud);
  paintLolIdentity(p2Hud);
  updateModeSelection();
  clearCombatPresentation();
  deathAnims.clear();
  championActionAnims.clear();
  prevChampionSkillPhase.clear();
  lastFacing.set(localCompetitorBySlot["control-a"], "south");
  lastFacing.set(localCompetitorBySlot["control-b"], "north");
  prevTickPositions = null;
  currTickPositions = null;
  accumulatorMs = 0;
  lastKnownPhase = game.snapshot().phase;
  eventMessages.length = 0;
  eventMessages.push(copy.ready);
  renderLog();
  syncP2ModeButton();
  if (restartMatch) render();
  try {
    const url = new URL(window.location.href);
    url.search = serializeBrowserMatchConfiguration(configuration, url.search).toString();
    window.history.replaceState({}, "", url);
  } catch {
    /* URL persistence is best-effort; typed state remains authoritative. */
  }
}

function confirmCharacterSelect(): void {
  applyConfigurationAndRestart(createBrowserMatchConfiguration({
    mode: pickMode,
    champion1: pickP1,
    champion2: pickP2,
    bot1: pickBotP1,
    bot2: pickBotP2,
  }), true);
  matchStarted = true;
  showSelectScreen(false);
}

startBtn.addEventListener("click", () => confirmCharacterSelect());
changeBtn.addEventListener("click", () => {
  pickP1 = selectedP1;
  pickP2 = selectedP2;
  pickMode = activeConfiguration.mode;
  pickBotP1 = botProfileForPlayer(activeConfiguration, 0)?.id ?? pickBotP1;
  pickBotP2 = botProfileForPlayer(activeConfiguration, 1)?.id ?? pickBotP2;
  colP1.profileSelect.value = pickBotP1;
  colP2.profileSelect.value = pickBotP2;
  updateModeSelection();
  showSelectScreen(true);
});

if (initialLaunchState.skipSelection) {
  matchStarted = true;
  showSelectScreen(false);
} else {
  matchStarted = false;
  showSelectScreen(true);
}

const stage = element(document, "section", "arena-stage");
const canvasFrame = element(document, "div", "arena-canvas-frame");
const canvas = element(document, "canvas", "arena-canvas");
canvas.width = LOGICAL_WIDTH * BACKBUFFER_SCALE;
canvas.height = LOGICAL_HEIGHT * BACKBUFFER_SCALE;
canvas.setAttribute(
  "aria-label",
  isEnglish ? "Bomba PvP arena" : "Arena do Bomba PvP",
);
const boardSummary = element(document, "p", "sr-only");
boardSummary.setAttribute("aria-live", "polite");
canvasFrame.append(canvas, boardSummary);

const sdBanner = element(document, "div", "arena-sd-banner", copy.suddenDeath);
sdBanner.setAttribute("aria-live", "polite");

const overlay = element(document, "div", "arena-overlay");
const overlayCard = element(document, "div", "arena-overlay__card");
const overlayEyebrow = element(document, "p", "arena-overlay__eyebrow", "");
const overlayPortraitWrap = element(document, "div", "arena-overlay__portrait");
const overlayPortrait = document.createElement("img");
overlayPortrait.alt = "";
overlayPortraitWrap.append(overlayPortrait);
overlayPortraitWrap.hidden = true;
const overlayTitle = element(document, "h1", "arena-overlay__title", "");
const overlaySub = element(document, "p", "arena-overlay__sub", "");
const overlayActions = element(document, "div", "arena-overlay__actions");
const overlayPauseBtn = element(document, "button", "arena-button arena-button--primary", copy.resume);
overlayPauseBtn.type = "button";
const overlayRestartBtn = element(document, "button", "arena-button", copy.restart);
overlayRestartBtn.type = "button";
const overlayNewMatchBtn = element(
  document,
  "button",
  "arena-button arena-button--primary",
  isEnglish ? "New match" : "Nova partida",
);
overlayNewMatchBtn.type = "button";
overlayActions.append(overlayPauseBtn, overlayRestartBtn, overlayNewMatchBtn);
overlayCard.append(overlayEyebrow, overlayPortraitWrap, overlayTitle, overlaySub, overlayActions);
overlay.append(overlayCard);
canvasFrame.append(sdBanner, overlay);
stage.append(canvasFrame);

const dock = element(document, "footer", "arena-dock");
const hint = element(document, "div", "arena-dock__hint");
hint.innerHTML =
  `<kbd>WASD</kbd>+<kbd>Q</kbd>+<kbd>␣</kbd> · <kbd>↑←↓→</kbd>+<kbd>O</kbd>+<kbd>I</kbd> · <kbd>Esc</kbd> · <kbd>T</kbd> · <kbd>M</kbd>`;
const actions = element(document, "div", "arena-actions");
const pauseButton = element(document, "button", "arena-button", copy.pause);
pauseButton.type = "button";
const restartButton = element(document, "button", "arena-button arena-button--primary", copy.restart);
restartButton.type = "button";
const newMatchButton = element(
  document,
  "button",
  "arena-button arena-button--primary",
  isEnglish ? "New match" : "Nova partida",
);
newMatchButton.type = "button";
const speedButton = element(document, "button", "arena-button arena-button--lab", "1×") as HTMLButtonElement;
speedButton.type = "button";
speedButton.title = isEnglish ? "AI lab playback speed" : "Velocidade do laboratório de IA";
const recordExperienceButton = element(
  document,
  "button",
  "arena-button arena-button--lab",
  isEnglish ? "Record off" : "Gravação off",
) as HTMLButtonElement;
recordExperienceButton.type = "button";
recordExperienceButton.title = isEnglish
  ? "Record deterministic structured bot experience in memory"
  : "Gravar experiência estruturada e determinística dos bots em memória";
actions.append(pauseButton, restartButton, newMatchButton, speedButton, recordExperienceButton);

const devToggle = element(document, "button", "arena-dev-toggle", copy.devShow);
devToggle.type = "button";
devToggle.title = "Toggle diagnostics (?dev=1)";
const p2ModeButton = element(
  document,
  "button",
  "arena-button arena-button--p2",
  copy.p2ModeLabel(p2IsBot() ? "bot" : "human"),
);
p2ModeButton.type = "button";
actions.append(p2ModeButton, changeBtn);

function syncP2ModeButton(): void {
  const isLab = activeConfiguration.mode === "bot-lab";
  p2ModeButton.textContent = isLab
    ? (isEnglish ? "AI laboratory" : "Laboratório de IA")
    : copy.p2ModeLabel(p2IsBot() ? "bot" : "human");
  p2ModeButton.title = isLab
    ? (isEnglish ? "Both competitors use the selected AI profiles" : "Os dois competidores usam os perfis de IA selecionados")
    : (isEnglish ? "Switch between local duel and bot training" : "Alternar entre duelo local e treino contra bot");
  p2ModeButton.classList.toggle("is-bot", p2IsBot());
  p2ModeButton.disabled = isLab;
  newMatchButton.hidden = !isLab;
  speedButton.hidden = !isLab;
  recordExperienceButton.hidden = !isLab;
  overlayNewMatchBtn.hidden = !isLab;
}

p2ModeButton.addEventListener("click", () => {
  if (activeConfiguration.mode === "bot-lab") return;
  // Switching control releases any pressed P2 key and re-seeds the bot so the
  // handoff never leaves a stuck direction or a stale decision stream.
  if (p2IsBot()) {
    const driver = browserBotDriverForPlayer(botDrivers, 1);
    if (driver?.memory.pressed !== null && driver?.memory.pressed !== undefined) {
      game.dispatch({
        type: "set-movement",
        competitorId: driver.competitorId,
        direction: driver.memory.pressed,
        pressed: false,
      });
    }
  } else {
    releaseMovement();
  }
  activeConfiguration = createBrowserMatchConfiguration({
    mode: p2IsBot() ? "local-duel" : "bot-training",
    champion1: selectedP1,
    champion2: selectedP2,
    bot2: pickBotP2,
  });
  resetBots();
  paintLolIdentity(p1Hud);
  paintLolIdentity(p2Hud);
  syncP2ModeButton();
  try {
    const url = new URL(window.location.href);
    url.search = serializeBrowserMatchConfiguration(activeConfiguration, url.search).toString();
    window.history.replaceState({}, "", url);
  } catch {
    /* URL persistence is best-effort. */
  }
  render();
});

const LAB_PLAYBACK_SPEEDS = [1, 2, 4] as const;
type LabPlaybackSpeed = (typeof LAB_PLAYBACK_SPEEDS)[number];
let labPlaybackSpeed: LabPlaybackSpeed = 1;

function startNewLabMatch(): void {
  if (activeConfiguration.mode !== "bot-lab") return;
  activeMatchNumber += 1;
  matchConfig = buildMatchConfig(activeConfiguration, activeMatchNumber);
  game = createGameMechanics(matchConfig);
  resetBots();
  clearCombatPresentation();
  deathAnims.clear();
  championActionAnims.clear();
  prevChampionSkillPhase.clear();
  prevTickPositions = null;
  currTickPositions = null;
  accumulatorMs = 0;
  lastFacing.set(localCompetitorBySlot["control-a"], "south");
  lastFacing.set(localCompetitorBySlot["control-b"], "north");
  lastKnownPhase = game.snapshot().phase;
  eventMessages.length = 0;
  eventMessages.push(isEnglish ? `AI lab match ${activeMatchNumber} ready.` : `Partida ${activeMatchNumber} do laboratório pronta.`);
  renderLog();
  render();
}

newMatchButton.addEventListener("click", startNewLabMatch);
overlayNewMatchBtn.addEventListener("click", startNewLabMatch);
speedButton.addEventListener("click", () => {
  const index = LAB_PLAYBACK_SPEEDS.indexOf(labPlaybackSpeed);
  labPlaybackSpeed = LAB_PLAYBACK_SPEEDS[(index + 1) % LAB_PLAYBACK_SPEEDS.length]!;
  speedButton.textContent = `${labPlaybackSpeed}×`;
  render();
});
recordExperienceButton.addEventListener("click", () => {
  if (activeConfiguration.mode !== "bot-lab") return;
  labExperienceRecording = !labExperienceRecording;
  setBrowserBotExperienceRecording(botDrivers, labExperienceRecording);
  recordExperienceButton.textContent = labExperienceRecording
    ? (isEnglish ? "Record on" : "Gravação on")
    : (isEnglish ? "Record off" : "Gravação off");
  render();
});

dock.append(hint, actions, devToggle);

const devPanel = element(document, "aside", "arena-dev");
devPanel.setAttribute("aria-hidden", "true");
const devTitle = element(document, "h2", undefined, copy.devTitle);
const devMeta = element(document, "div", "arena-dev__meta");
const devLog = element(document, "ol", "arena-dev__log");
const devNote = element(
  document,
  "p",
  "arena-dev__note",
  `${GAME_MECHANICS_VERSION} · local assets only · WASD+Q+Space/R / arrows+O+I / Esc / T / M`,
);
devPanel.append(devTitle, devMeta, devLog, devNote);

app.append(hud, stage, dock, devPanel, selectScreen);
root.replaceChildren(app);

/** Keep the metallic HUD strip aligned to the live arena frame width. */
function syncHudToFrame(): void {
  const frameWidth = canvasFrame.getBoundingClientRect().width;
  if (frameWidth > 0) {
    hudBar.style.width = `${Math.round(frameWidth)}px`;
  }
}
if (typeof ResizeObserver !== "undefined") {
  const frameObserver = new ResizeObserver(() => syncHudToFrame());
  frameObserver.observe(canvasFrame);
  frameObserver.observe(stage);
} else {
  window.addEventListener("resize", syncHudToFrame);
}
requestAnimationFrame(syncHudToFrame);

const canvasContext = canvas.getContext("2d");
if (!canvasContext) throw new Error("GameMechanics canvas context was not available.");
const context: CanvasRenderingContext2D = canvasContext;
context.imageSmoothingEnabled = true;
context.imageSmoothingQuality = "high";

function phaseLabel(snapshot: GameSnapshot): string {
  if (snapshot.phase === "paused") return copy.paused;
  if (snapshot.phase === "round-start") return copy.roundStart;
  if (snapshot.phase === "sudden-death") return copy.suddenDeath;
  if (snapshot.phase === "round-over") return copy.roundOver;
  if (snapshot.phase === "match-over") return copy.matchOver;
  return copy.playing;
}

function timerDisplayMs(snapshot: GameSnapshot): number {
  if (snapshot.phase === "round-start" || snapshot.phase === "round-over") {
    return snapshot.phaseRemainingMs;
  }
  if (snapshot.phase === "sudden-death") return snapshot.suddenDeathElapsedMs;
  return snapshot.roundRemainingMs;
}

function scoreFor(snapshot: GameSnapshot, competitorId: CompetitorId): number {
  return snapshot.scores.find((entry) => entry.competitorId === competitorId)?.wins ?? 0;
}

function updateDevOpen(): void {
  devPanel.classList.toggle("is-open", devOpen);
  devPanel.setAttribute("aria-hidden", devOpen ? "false" : "true");
  devToggle.textContent = devOpen ? copy.devHide : copy.devShow;
}

function renderLog(): void {
  if (!devOpen) return;
  devLog.replaceChildren(...eventMessages.map((message) => element(document, "li", undefined, message)));
}

function powerUpLabel(type: "bomb-up" | "flame-up"): string {
  return type === "bomb-up" ? (isEnglish ? "+BOMB" : "+BOMBA") : (isEnglish ? "+RANGE" : "+ALCANCE");
}

function tileKeyOf(tile: TileCoord): string {
  return `${tile.x},${tile.y}`;
}

/** Opaque content rect for one atlas cell; generated VFX contain large transparent gutters. */
function getAtlasFrameTrimBounds(
  image: HTMLImageElement,
  sourceX: number,
  sourceY: number,
  frameSize: number,
): SpriteTrimBounds | null {
  let imageCache = atlasFrameTrimCache.get(image);
  if (!imageCache) {
    imageCache = new Map();
    atlasFrameTrimCache.set(image, imageCache);
  }
  const key = `${sourceX},${sourceY},${frameSize}`;
  if (imageCache.has(key)) return imageCache.get(key) ?? null;
  const context = ensureTrimProbe();
  if (!trimProbeCanvas || !context) return null;
  if (trimProbeCanvas.width !== frameSize) trimProbeCanvas.width = frameSize;
  if (trimProbeCanvas.height !== frameSize) trimProbeCanvas.height = frameSize;
  context.clearRect(0, 0, frameSize, frameSize);
  try {
    context.drawImage(
      image,
      sourceX,
      sourceY,
      frameSize,
      frameSize,
      0,
      0,
      frameSize,
      frameSize,
    );
    const data = context.getImageData(0, 0, frameSize, frameSize).data;
    let minX = frameSize;
    let minY = frameSize;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < frameSize; y += 1) {
      for (let x = 0; x < frameSize; x += 1) {
        if ((data[(y * frameSize + x) * 4 + 3] ?? 0) <= SPRITE_ALPHA_THRESHOLD) continue;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
    const bounds = maxX < minX || maxY < minY
      ? null
      : Object.freeze({
          x: minX,
          y: minY,
          width: maxX - minX + 1,
          height: maxY - minY + 1,
        });
    imageCache.set(key, bounds);
    return bounds;
  } catch {
    imageCache.set(key, null);
    return null;
  }
}

function queueAnimationLabFx(
  category: AnimationLabCategory,
  anchor: AnimationLabFx["anchor"],
  startMs: number,
): void {
  const pack = nextAnimationLabPack(category);
  if (!pack) return;
  animationLabFx.push({ packId: pack.id, anchor, startMs });
}

function clearCombatPresentation(): void {
  presentationFx.length = 0;
  animationLabFx.length = 0;
  animationLabDemoIndex = 0;
  animationLabDemoNextMs = 0;
  resetAnimationLabRotation();
  crateBreakFx.length = 0;
  chainSparkFx.length = 0;
  blinkTrailFx.length = 0;
  pressureWarnFx.length = 0;
  hookProjectileFx.length = 0;
  hookPullFx.length = 0;
  recentExplosions.length = 0;
  deathAnims.clear();
  bombTilesById.clear();
  bombPlaceFx.clear();
  powerUpRevealFx.clear();
  lastCompetitorPose.clear();
  ranniProjectionPose.clear();
  prevSkillPhase.clear();
  lastChannelAim.clear();
  lastChannelOrigin.clear();
  screenShakeUntilMs = 0;
  screenShakeAmplitudePx = 0;
}

function appendPresentationFx(events: readonly GameEvent[], nowMs: number): void {
  for (const event of events) {
    if (event.type === "power-up-revealed") {
      presentationFx.push({
        kind: "power-reveal",
        tileX: event.at.x,
        tileY: event.at.y,
        powerUpType: event.powerUpType,
        label: powerUpLabel(event.powerUpType),
        startMs: nowMs,
      });
      powerUpRevealFx.set(tileKeyOf(event.at), nowMs);
    } else if (event.type === "power-up-collected") {
      presentationFx.push({
        kind: "power-collect",
        tileX: event.at.x,
        tileY: event.at.y,
        powerUpType: event.powerUpType,
        label: powerUpLabel(event.powerUpType),
        startMs: nowMs,
      });
      powerUpRevealFx.delete(tileKeyOf(event.at));
      pulseHudStat(event.competitorId, event.powerUpType);
      queueAnimationLabFx("power-up", { tileX: event.at.x, tileY: event.at.y }, nowMs);
      queueAnimationLabFx("hud", "hud", nowMs);
    } else if (event.type === "bomb-placed") {
      bombPlaceFx.set(event.bombId, nowMs);
      const slot = slotForCompetitor(event.competitorId);
      const action = bombAnimationAction(slot);
      if (action) {
        championActionAnims.set(event.competitorId, { action, startMs: nowMs });
      }
    } else if (event.type === "bomb-exploded") {
      // Screen shake stacks while a previous one is still decaying.
      if (!prefersReducedMotion) {
        screenShakeAmplitudePx = nowMs < screenShakeUntilMs
          ? Math.min(SCREEN_SHAKE_MAX_PX, screenShakeAmplitudePx + 1)
          : SCREEN_SHAKE_BASE_PX;
        screenShakeUntilMs = nowMs + SCREEN_SHAKE_MS;
      }
      const originTile = bombTilesById.get(event.bombId)
        ?? event.flameTiles[0]
        ?? null;
      if (originTile) {
        // Chain link: a recent blast whose flames reached this bomb's tile.
        for (const previous of recentExplosions) {
          if (nowMs - previous.startMs > CHAIN_LINK_WINDOW_MS) continue;
          const linked = previous.flameTiles.some(
            (tile) => tile.x === originTile.x && tile.y === originTile.y,
          );
          if (linked) {
            chainSparkFx.push({ fromTile: previous.tile, toTile: originTile, startMs: nowMs });
            break;
          }
        }
        recentExplosions.push({
          bombId: event.bombId,
          tile: originTile,
          flameTiles: event.flameTiles,
          startMs: nowMs,
        });
        queueAnimationLabFx(
          "bomb",
          { tileX: originTile.x, tileY: originTile.y },
          nowMs,
        );
        if (recentExplosions.length > 8) recentExplosions.splice(0, recentExplosions.length - 8);
      }
      bombPlaceFx.delete(event.bombId);
      bombTilesById.delete(event.bombId);
    } else if (event.type === "crate-destroyed") {
      crateBreakFx.push({ tile: event.at, startMs: nowMs });
      queueAnimationLabFx("hit", { tileX: event.at.x, tileY: event.at.y }, nowMs);
    } else if (event.type === "competitor-eliminated") {
      const pose = lastCompetitorPose.get(event.competitorId);
      if (pose) {
        deathAnims.set(event.competitorId, {
          position: { x: pose.x, y: pose.y },
          facing: pose.facing,
          startMs: nowMs,
        });
      }
    } else if (event.type === "pressure-warning") {
      pressureWarnFx.push({
        tile: event.tile,
        startMs: nowMs,
        durationMs: Math.max(1, event.fallMs || event.remainingMs),
      });
      queueAnimationLabFx("arena", { tileX: event.tile.x, tileY: event.tile.y }, nowMs);
    } else if (event.type === "sudden-death-started") {
      suddenDeathBannerUntilMs = nowMs + SUDDEN_DEATH_FLASH_MS;
    } else if (event.type === "round-started" || event.type === "restarted") {
      clearCombatPresentation();
    }
  }
  // Cap presentation-only FX backlog.
  if (presentationFx.length > 24) presentationFx.splice(0, presentationFx.length - 24);
  if (crateBreakFx.length > 24) crateBreakFx.splice(0, crateBreakFx.length - 24);
  if (chainSparkFx.length > 12) chainSparkFx.splice(0, chainSparkFx.length - 12);
  if (blinkTrailFx.length > 8) blinkTrailFx.splice(0, blinkTrailFx.length - 8);
  if (pressureWarnFx.length > 8) pressureWarnFx.splice(0, pressureWarnFx.length - 8);
  if (animationLabFx.length > 24) animationLabFx.splice(0, animationLabFx.length - 24);
  if (hookProjectileFx.length > 4) hookProjectileFx.splice(0, hookProjectileFx.length - 4);
}

/** Detect Thresh hook launches by watching for channel→cooldown transitions. */
function detectHookLaunches(snapshot: GameSnapshot, nowMs: number): void {
  for (const competitor of snapshot.competitors) {
    const skill = competitor.skill;
    if (!skill || skill.id !== THRESH_DEATH_SENTENCE_SKILL_ID) continue;
    const prevPhase = prevSkillPhase.get(competitor.id);
    const currentPhase = skill.phase;
    prevSkillPhase.set(competitor.id, currentPhase);

    // While channeling, continuously capture aim + origin (kernel clears on cooldown).
    if (currentPhase === "channeling") {
      if (skill.aimDirection) lastChannelAim.set(competitor.id, skill.aimDirection);
      lastChannelOrigin.set(competitor.id, {
        x: Math.floor(competitor.position.x / UNITS_PER_TILE),
        y: Math.floor(competitor.position.y / UNITS_PER_TILE),
      });
      continue;
    }

    // Transition from channeling to cooldown = hook was fired.
    if (prevPhase !== "channeling" || currentPhase !== "cooldown") continue;
    const originTile = lastChannelOrigin.get(competitor.id) ?? {
      x: Math.floor(competitor.position.x / UNITS_PER_TILE),
      y: Math.floor(competitor.position.y / UNITS_PER_TILE),
    };
    const aim = lastChannelAim.get(competitor.id) ?? "down";
    // Full cooldown = hit, reduced = miss.
    const hit = skill.cooldownRemainingMs > 5000;
    hookProjectileFx.push({
      ownerId: competitor.id,
      originTile,
      direction: aim,
      reachTiles: THRESH_HOOK_RANGE,
      hit,
      startMs: nowMs,
    });

    // On hit, find the victim who was teleported and create a pull animation.
    if (hit) {
      for (const other of snapshot.competitors) {
        if (other.id === competitor.id || !other.alive) continue;
        const prevPose = lastCompetitorPose.get(other.id);
        if (!prevPose) continue;
        const jumpTiles = Math.hypot(
          other.position.x - prevPose.x,
          other.position.y - prevPose.y,
        ) / UNITS_PER_TILE;
        if (jumpTiles >= BLINK_JUMP_TILES) {
          hookPullFx.push({
            victimId: other.id,
            fromPos: { x: prevPose.x, y: prevPose.y },
            toPos: { x: other.position.x, y: other.position.y },
            threshTile: originTile,
            startMs: nowMs,
          });
        }
      }
    }

    // Clean up captured state.
    lastChannelAim.delete(competitor.id);
    lastChannelOrigin.delete(competitor.id);
  }
}

function appendEvents(events: readonly GameEvent[], nowMs = performance.now()): void {
  appendPresentationFx(events, nowMs);
  playSoundsForEvents(events, nowMs);
  for (const event of events) {
    const description = eventDescription(event, copy);
    if (!description) continue;
    eventMessages.unshift(description);
  }
  eventMessages.splice(EVENT_LOG_LIMIT);
  renderLog();
}

function championFrameUrl(
  slot: LocalControlSlot,
  facing: Facing,
  moving: boolean,
  animMs: number,
): string {
  const presentation = presentationFor(slot);
  const pack = presentation.pack;
  const action: ChampionAnimationAction = moving
    ? presentation.integratedAnimations.run
      ? "run"
      : hasAnimationFrames(pack.walk)
        ? "walk"
        : "run"
    : "idle";
  const frames = animationFrames(slot, action, facing);
  if (frames.length === 0) return pack.static[facing];
  const frameMs = moving ? WALK_FRAME_MS : IDLE_FRAME_MS;
  const index = Math.floor(animMs / frameMs) % frames.length;
  return frames[index] ?? pack.static[facing];
}

function hasAnimationFrames(
  frames: Readonly<Record<Facing, readonly string[]>>,
): boolean {
  return Object.values(frames).some((directionFrames) => directionFrames.length > 0);
}

function animationFrames(
  slot: LocalControlSlot,
  action: ChampionAnimationAction,
  facing: Facing,
): readonly string[] {
  const presentation = presentationFor(slot);
  return selectFacingFrames(
    presentation.pack[action],
    facing,
    presentation.integratedAnimations[action],
  );
}

function skillAnimationAction(slot: LocalControlSlot): SkillAnimationAction | null {
  const presentation = presentationFor(slot);
  const pack = presentation.pack;
  const integratedActions = Object.keys(presentation.integratedAnimations).filter(
    (action): action is SkillAnimationAction =>
      action === "attack" || action === "cast" || action === "ultimate",
  );
  return selectSkillAnimationAction(
    {
      attack: hasAnimationFrames(pack.attack),
      cast: hasAnimationFrames(pack.cast),
      ultimate: hasAnimationFrames(pack.ultimate),
    },
    integratedActions,
  );
}

function bombAnimationAction(slot: LocalControlSlot): SkillAnimationAction | null {
  const presentation = presentationFor(slot);
  const pack = presentation.pack;
  const integratedActions = Object.keys(presentation.integratedAnimations).filter(
    (action): action is SkillAnimationAction =>
      action === "attack" || action === "cast" || action === "ultimate",
  );
  return selectBombAnimationAction(
    {
      attack: hasAnimationFrames(pack.attack),
      cast: hasAnimationFrames(pack.cast),
      ultimate: hasAnimationFrames(pack.ultimate),
    },
    integratedActions,
  );
}

function timedChampionFrameUrl(
  competitorId: CompetitorId,
  slot: LocalControlSlot,
  facing: Facing,
  animMs: number,
): string | null {
  const timed = championActionAnims.get(competitorId);
  if (!timed) return null;
  const frames = animationFrames(slot, timed.action, facing);
  const age = animMs - timed.startMs;
  const durationMs = timed.durationMs ?? frames.length * CAST_FRAME_MS;
  const lifecycleFrame = timedAnimationFrameIndex(frames.length, age, durationMs);
  if (lifecycleFrame === null) {
    championActionAnims.delete(competitorId);
    return null;
  }
  const frameIndex = timed.buildMs
    ? Math.min(
        frames.length - 1,
        Math.floor(age / (timed.buildMs / frames.length)),
      )
    : lifecycleFrame;
  return frames[frameIndex] ?? null;
}

function detectChampionAnimationStarts(snapshot: GameSnapshot, nowMs: number): void {
  for (const competitor of snapshot.competitors) {
    const phase = competitor.skill?.phase ?? "none";
    const previous = prevChampionSkillPhase.get(competitor.id);
    prevChampionSkillPhase.set(competitor.id, phase);
    if (
      competitor.skill?.id === RANNI_ICE_BLINK_SKILL_ID
      && previous === "channeling"
      && phase !== "channeling"
    ) {
      championActionAnims.delete(competitor.id);
      continue;
    }
    // Living Shadow: channeling → cooldown is either valid swap or fail/timeout/death.
    if (
      competitor.skill?.id === ZED_LIVING_SHADOW_SKILL_ID
      && previous === "channeling"
      && phase === "cooldown"
    ) {
      const cooldownMs = competitor.skill.cooldownRemainingMs;
      const successSwap = didLivingShadowSwapSucceed(
        cooldownMs,
        ZED_FAIL_COOLDOWN_MS,
      );
      const slot = slotForCompetitor(competitor.id);
      const recoveryAction = successSwap
        ? (bombAnimationAction(slot) ?? skillAnimationAction(slot) ?? "cast")
        : (skillAnimationAction(slot) ?? "cast");
      championActionAnims.set(competitor.id, {
        action: recoveryAction,
        startMs: nowMs,
        durationMs: successSwap ? ZED_SWAP_RECOVERY_MS : ZED_SHADOW_CANCEL_MS,
      });
      continue;
    }
    if (phase !== "channeling" || previous === "channeling") continue;
    const action = skillAnimationAction(slotForCompetitor(competitor.id));
    if (action) {
      championActionAnims.set(competitor.id, {
        action,
        startMs: nowMs,
        ...(competitor.skill?.id === RANNI_ICE_BLINK_SKILL_ID
          ? {
              durationMs: RANNI_CHANNEL_MS,
              buildMs: RANNI_FREEZE_BUILD_MS,
            }
          : competitor.skill?.id === ZED_LIVING_SHADOW_SKILL_ID
            ? {
                durationMs: ZED_CAST_TELEGRAPH_MS,
                buildMs: ZED_CAST_BUILD_MS,
              }
            : {}),
      });
    }
  }
}

function screenShakeOffset(animMs: number): { x: number; y: number } {
  if (animMs >= screenShakeUntilMs || screenShakeAmplitudePx <= 0) return { x: 0, y: 0 };
  const intensity = Math.min(1, (screenShakeUntilMs - animMs) / SCREEN_SHAKE_MS);
  const amplitude = screenShakeAmplitudePx * intensity;
  // Deterministic presentation offset from the animation clock (not simulation RNG).
  return {
    x: Math.sin(animMs * 0.073) * amplitude,
    y: Math.cos(animMs * 0.091) * amplitude,
  };
}

function drawAnimationLabFx(animMs: number): void {
  for (let i = animationLabFx.length - 1; i >= 0; i -= 1) {
    const fx = animationLabFx[i]!;
    const pack = getAnimationLabPack(fx.packId);
    const age = animMs - fx.startMs;
    if (age < 0 || age >= pack.durationMs) {
      animationLabFx.splice(i, 1);
      continue;
    }
    const frameIndex = Math.min(pack.frameCount - 1, Math.floor(age / pack.frameMs));
    const sourceX = (frameIndex % pack.columns) * pack.frameSize;
    const sourceY = Math.floor(frameIndex / pack.columns) * pack.frameSize;
    const image = loadImage(pack.atlasUrl);
    if (!image.complete || image.naturalWidth <= 0) continue;

    const isHud = fx.anchor === "hud";
    const centerX = isHud
      ? LOGICAL_WIDTH / 2
      : fx.anchor.tileX * TILE_SIZE + TILE_SIZE / 2;
    const centerY = isHud
      ? TILE_SIZE * 0.52
      : fx.anchor.tileY * TILE_SIZE + TILE_SIZE / 2;
    const progress = age / pack.durationMs;
    const alpha = Math.min(1, (age / 80) * 1.5) * Math.min(1, (1 - progress) * 1.8);
    const trim = getAtlasFrameTrimBounds(image, sourceX, sourceY, pack.frameSize)
      ?? { x: 0, y: 0, width: pack.frameSize, height: pack.frameSize };
    const destination = animationLabDestinationRect(trim, {
      centerX,
      centerY,
      tileSize: TILE_SIZE,
      sizeTiles: animationLabSizeTiles(pack.category),
    });
    context.save();
    context.globalAlpha = alpha;
    context.globalCompositeOperation = "source-over";
    context.shadowColor = "rgba(0, 0, 0, 0.42)";
    context.shadowBlur = 4;
    context.drawImage(
      image,
      sourceX + trim.x,
      sourceY + trim.y,
      trim.width,
      trim.height,
      destination.x,
      destination.y,
      destination.width,
      destination.height,
    );
    context.restore();
  }
}

function maybeQueueAnimationLabDemo(animMs: number): void {
  if (!animationLabDemoEnabled || animMs < animationLabDemoNextMs) return;
  const pack = ANIMATION_LAB_PACKS[animationLabDemoIndex % ANIMATION_LAB_PACKS.length];
  if (!pack) return;
  animationLabDemoIndex += 1;
  animationLabDemoNextMs = animMs + pack.durationMs + 180;
  animationLabFx.push({
    packId: pack.id,
    anchor: pack.category === "hud"
      ? "hud"
      : { tileX: Math.floor(ARENA_WIDTH / 2), tileY: Math.floor(ARENA_HEIGHT / 2) },
    startMs: animMs,
  });
}

function renderCanvas(snapshot: GameSnapshot, animMs: number): void {
  // All draw calls below use logical units (48px tiles) over the 3× backbuffer.
  context.setTransform(BACKBUFFER_SCALE, 0, 0, BACKBUFFER_SCALE, 0, 0);
  context.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
  const shake = screenShakeOffset(animMs);
  context.save();
  context.translate(shake.x, shake.y);

  for (let y = 0; y < snapshot.arena.height; y += 1) {
    for (let x = 0; x < snapshot.arena.width; x += 1) {
      const drawn = drawImageUrl(
        context,
        floorUrlFor(x, y),
        x * TILE_SIZE,
        y * TILE_SIZE,
        TILE_SIZE,
        TILE_SIZE,
      );
      if (!drawn) {
        context.fillStyle = (x + y) % 2 === 0 ? "#d8d0c2" : "#cec5b7";
        context.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      }
    }
  }

  for (const tile of snapshot.arena.solid) {
    if (!drawImageUrl(
      context,
      wallUrlFor(tile.x, tile.y),
      tile.x * TILE_SIZE,
      tile.y * TILE_SIZE,
      TILE_SIZE,
      TILE_SIZE,
    )) {
      context.fillStyle = "#2a3038";
      context.fillRect(tile.x * TILE_SIZE, tile.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }
  }

  for (const tile of snapshot.arena.crates) {
    if (!drawImageUrl(
      context,
      crateUrlFor(tile.x, tile.y),
      tile.x * TILE_SIZE,
      tile.y * TILE_SIZE,
      TILE_SIZE,
      TILE_SIZE,
    )) {
      context.fillStyle = "#a86639";
      context.fillRect(
        tile.x * TILE_SIZE + 2,
        tile.y * TILE_SIZE + 2,
        TILE_SIZE - 4,
        TILE_SIZE - 4,
      );
    }
  }

  for (const powerUp of snapshot.powerUps) {
    const url = powerUp.type === "bomb-up" ? powerBombUrl : powerFlameUrl;
    const bob = Math.sin(animMs / 220) * 2;
    // Spawn pop: 0.72 → 1.08 → 1 in the first POWER_UP_POP_MS after reveal.
    const revealAt = powerUpRevealFx.get(tileKeyOf(powerUp.tile));
    let popScale = 1;
    if (revealAt !== undefined) {
      const t = Math.min(1, Math.max(0, (animMs - revealAt) / POWER_UP_POP_MS));
      if (t < 1) {
        popScale = t < 0.6 ? 0.72 + (t / 0.6) * 0.36 : 1.08 - ((t - 0.6) / 0.4) * 0.08;
      } else {
        powerUpRevealFx.delete(tileKeyOf(powerUp.tile));
      }
    }
    const size = TILE_SIZE * 0.62 * popScale;
    const x = powerUp.tile.x * TILE_SIZE + (TILE_SIZE - size) / 2;
    const y = powerUp.tile.y * TILE_SIZE + (TILE_SIZE - size) / 2 + bob;
    context.save();
    context.shadowColor = powerUp.type === "bomb-up" ? "rgb(56 160 255 / 55%)" : "rgb(255 120 40 / 55%)";
    context.shadowBlur = 10;
    if (!drawImageUrl(context, url, x, y, size, size)) {
      context.fillStyle = powerUp.type === "bomb-up" ? "#1f8fd6" : "#ff7a2a";
      context.fillRect(x, y, size, size);
    }
    context.restore();
  }

  if (snapshot.pressure.closing) {
    const closing = snapshot.pressure.closing;
    const progress = 1 - Math.min(1, closing.remainingMs / PRESSURE_FALL_MS);
    context.save();
    context.globalAlpha = 0.3 + progress * 0.5;
    drawImageUrl(
      context,
      wallUrlFor(closing.tile.x, closing.tile.y),
      closing.tile.x * TILE_SIZE,
      closing.tile.y * TILE_SIZE,
      TILE_SIZE,
      TILE_SIZE,
    );
    context.restore();
    context.save();
    context.strokeStyle = `rgb(255 ${Math.round(100 + progress * 90)} 50 / ${0.5 + progress * 0.45})`;
    context.lineWidth = 2 + progress * 2.5;
    context.strokeRect(
      closing.tile.x * TILE_SIZE + 3,
      closing.tile.y * TILE_SIZE + 3,
      TILE_SIZE - 6,
      TILE_SIZE - 6,
    );
    context.restore();
  }

  // Pressure warning telegraph: pulsing hazard on the tile about to close.
  for (let i = pressureWarnFx.length - 1; i >= 0; i -= 1) {
    const fx = pressureWarnFx[i]!;
    const age = animMs - fx.startMs;
    if (age < 0 || age > fx.durationMs) {
      pressureWarnFx.splice(i, 1);
      continue;
    }
    const t = age / fx.durationMs;
    const pulse = 0.5 + 0.5 * Math.sin(animMs / 90);
    const x = fx.tile.x * TILE_SIZE;
    const y = fx.tile.y * TILE_SIZE;
    context.save();
    context.fillStyle = `rgb(255 ${Math.round(120 - t * 60)} 40 / ${0.1 + pulse * 0.14})`;
    context.fillRect(x, y, TILE_SIZE, TILE_SIZE);
    context.strokeStyle = `rgb(255 90 40 / ${0.35 + pulse * 0.45})`;
    context.lineWidth = 2;
    context.setLineDash([6, 4]);
    context.strokeRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
    context.restore();
  }

  // Skill telegraph: blink projection marker while channeling.
  for (const competitor of snapshot.competitors) {
    if (!competitor.alive) continue;
    const skill = competitor.skill;
    if (!skill || skill.phase !== "channeling" || !skill.projection) continue;
    const px = (skill.projection.x / UNITS_PER_TILE) * TILE_SIZE;
    const py = (skill.projection.y / UNITS_PER_TILE) * TILE_SIZE;
    const pulse = 0.5 + 0.5 * Math.sin(animMs / 110);
    context.save();
    context.strokeStyle = `rgb(120 220 255 / ${0.45 + pulse * 0.4})`;
    context.lineWidth = 2;
    context.setLineDash([5, 4]);
    context.beginPath();
    context.arc(px, py, TILE_SIZE * (0.3 + pulse * 0.05), 0, Math.PI * 2);
    context.stroke();
    context.fillStyle = `rgb(120 220 255 / ${0.08 + pulse * 0.08})`;
    context.beginPath();
    context.arc(px, py, TILE_SIZE * 0.3, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  for (const bomb of snapshot.bombs) {
    bombTilesById.set(bomb.id, bomb.tile);
    const fuseProgress = 1 - Math.min(1, Math.max(0, bomb.fuseMs) / BOMB_FUSE_MS);
    const smoothUrgency = fuseProgress * fuseProgress * (3 - 2 * fuseProgress);
    const urgency = 1 - Math.min(1, bomb.fuseMs / BOMB_FUSE_MS);
    let pulse =
      0.78
      + urgency * 0.1
      + Math.sin(animMs / 70) * urgency * 0.05;
    // Placement pop: scale 0.6 → 1.06 → settle in the first BOMB_PLACE_POP_MS.
    const placedAt = bombPlaceFx.get(bomb.id);
    if (placedAt !== undefined) {
      const t = Math.min(1, Math.max(0, (animMs - placedAt) / BOMB_PLACE_POP_MS));
      if (t < 1) {
        const pop = t < 0.65 ? 0.6 + (t / 0.65) * 0.46 : 1.06 - ((t - 0.65) / 0.35) * 0.06;
        pulse *= pop / 0.78;
      } else {
        bombPlaceFx.delete(bomb.id);
      }
    }
    const centerX = bomb.tile.x * TILE_SIZE + TILE_SIZE / 2;
    const centerY = bomb.tile.y * TILE_SIZE + TILE_SIZE / 2;

    // Contact shadow + contained warm halo (blast reads as light, not sticker).
    context.save();
    context.fillStyle = "rgba(8, 6, 5, 0.4)";
    context.beginPath();
    context.ellipse(centerX, bomb.tile.y * TILE_SIZE + TILE_SIZE - 6, TILE_SIZE * 0.28, TILE_SIZE * 0.08, 0, 0, Math.PI * 2);
    context.fill();
    context.globalCompositeOperation = "lighter";
    const halo = context.createRadialGradient(centerX, centerY, 2, centerX, centerY, TILE_SIZE * 0.55);
    halo.addColorStop(0, `rgba(255, 150, 60, ${0.08 + smoothUrgency * 0.14})`);
    halo.addColorStop(1, "rgba(255, 120, 40, 0)");
    context.fillStyle = halo;
    context.fillRect(centerX - TILE_SIZE * 0.6, centerY - TILE_SIZE * 0.6, TILE_SIZE * 1.2, TILE_SIZE * 1.2);
    context.restore();

    // Fuse arc: thin ring that closes as the fuse burns (quiet at start, hot at the end).
    context.save();
    context.strokeStyle = `rgba(255, 170, 80, ${0.26 + smoothUrgency * 0.5})`;
    context.lineWidth = 2;
    context.lineCap = "round";
    context.beginPath();
    context.arc(centerX, centerY, TILE_SIZE * 0.42, -Math.PI / 2, -Math.PI / 2 + fuseProgress * Math.PI * 2);
    context.stroke();
    context.restore();

    // Final-fuse warning: 8-segment orbiting dashed ring + glowing orbiting spark.
    if (bomb.fuseMs <= FINAL_FUSE_WARN_MS) {
      const finalUrgency = 1 - Math.max(0, bomb.fuseMs) / FINAL_FUSE_WARN_MS;
      const ringRadius = TILE_SIZE * (0.36 + finalUrgency * 0.1);
      const orbitAngle = -Math.PI / 2 + finalUrgency * Math.PI * 2 + animMs / 240;
      context.save();
      context.lineCap = "round";
      context.lineWidth = 2 + finalUrgency * 1.5;
      for (let segment = 0; segment < 8; segment += 1) {
        const segmentStart = orbitAngle + segment * (Math.PI / 4);
        context.strokeStyle = segment % 2 === 0
          ? `rgba(255, 72, 38, ${0.58 + finalUrgency * 0.42})`
          : `rgba(255, 198, 78, ${0.4 + finalUrgency * 0.5})`;
        context.beginPath();
        context.arc(centerX, centerY, ringRadius, segmentStart, segmentStart + Math.PI / 7);
        context.stroke();
      }
      const sparkX = centerX + Math.cos(orbitAngle) * ringRadius;
      const sparkY = centerY + Math.sin(orbitAngle) * ringRadius;
      context.fillStyle = `rgba(255, 244, 184, ${0.78 + finalUrgency * 0.22})`;
      context.shadowColor = "rgba(255, 82, 32, 0.92)";
      context.shadowBlur = 4 + finalUrgency * 5;
      context.beginPath();
      context.arc(sparkX, sparkY, 2 + finalUrgency * 1.5, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }

    const size = TILE_SIZE * pulse;
    const x = centerX - size / 2;
    const y = centerY - size / 2;
    context.save();
    if (urgency > 0.55) {
      context.shadowColor = "rgb(255 80 20 / 70%)";
      context.shadowBlur = 8 + urgency * 10;
    }
    if (!drawImageUrl(context, bombUrl, x, y, size, size)) {
      context.fillStyle = "#11151b";
      context.beginPath();
      context.arc(x + size / 2, y + size / 2, size * 0.38, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
  }

  for (const flame of snapshot.flames) {
    // Lethal window (Decision 012): only fresh flames kill. Past the window
    // the tile keeps burning as harmless residual fog — dimmer, smaller, no
    // additive bloom, so players can read that walking through it is safe.
    const lethal = isFlameLethal(flame.remainingMs);
    // Dissipate tail: fade + shrink through the last FLAME_DISSIPATE_TAIL_MS.
    const tailAlpha = Math.max(0, Math.min(1, flame.remainingMs / FLAME_DISSIPATE_TAIL_MS));
    const alpha = lethal ? Math.max(0.3, tailAlpha) : Math.min(0.38, 0.12 + tailAlpha * 0.26);
    const dissipateScale = lethal ? 0.9 + tailAlpha * 0.1 : 0.68 + tailAlpha * 0.12;
    // Per-tile phase offset so tiles never run the same frame in lockstep.
    const tilePhase = ((flame.tile.x * 31 + flame.tile.y * 17) % 8) * 70;
    const frameIndex = Math.floor((animMs + tilePhase) / 70) % FLAME_ANIM_URLS.length;
    const frameUrl = FLAME_ANIM_URLS[frameIndex]!;
    const centerX = flame.tile.x * TILE_SIZE + TILE_SIZE / 2;
    const centerY = flame.tile.y * TILE_SIZE + TILE_SIZE / 2;
    if (lethal) {
      // Additive warm bloom so blasts read as light, not stickers.
      context.save();
      context.globalCompositeOperation = "lighter";
      const bloom = context.createRadialGradient(centerX, centerY, 2, centerX, centerY, TILE_SIZE * 0.72);
      bloom.addColorStop(0, `rgba(255, 196, 96, ${0.3 * alpha})`);
      bloom.addColorStop(0.55, `rgba(255, 110, 40, ${0.14 * alpha})`);
      bloom.addColorStop(1, "rgba(255, 80, 30, 0)");
      context.fillStyle = bloom;
      context.fillRect(
        flame.tile.x * TILE_SIZE - TILE_SIZE * 0.3,
        flame.tile.y * TILE_SIZE - TILE_SIZE * 0.3,
        TILE_SIZE * 1.6,
        TILE_SIZE * 1.6,
      );
      context.restore();
    }
    context.save();
    context.globalAlpha = alpha;
    const size = TILE_SIZE * 1.05 * dissipateScale;
    const x = centerX - size / 2;
    const y = centerY - size / 2;
    if (!drawImageUrl(context, frameUrl, x, y, size, size)) {
      drawImageUrl(context, flameUrl, x, y, size, size);
    }
    context.restore();
  }

  // Crate break: 4-frame sheet with fade, then a dust fallback if unloaded.
  for (let i = crateBreakFx.length - 1; i >= 0; i -= 1) {
    const fx = crateBreakFx[i]!;
    const age = animMs - fx.startMs;
    if (age < 0 || age > CRATE_BREAK_FX_MS) {
      crateBreakFx.splice(i, 1);
      continue;
    }
    const frameMs = Math.max(1, Math.floor(CRATE_BREAK_FX_MS / CRATE_BREAK_URLS.length));
    const frameIndex = Math.min(CRATE_BREAK_URLS.length - 1, Math.floor(age / frameMs));
    const x = fx.tile.x * TILE_SIZE;
    const y = fx.tile.y * TILE_SIZE;
    context.save();
    context.globalAlpha = Math.max(0.58, 1 - (age / CRATE_BREAK_FX_MS) * 0.3);
    if (!drawImageUrl(context, CRATE_BREAK_URLS[frameIndex]!, x, y, TILE_SIZE, TILE_SIZE)) {
      const progress = age / CRATE_BREAK_FX_MS;
      context.fillStyle = `rgba(214, 168, 119, ${Math.max(0, 0.34 - progress * 0.24)})`;
      context.beginPath();
      context.arc(x + TILE_SIZE * 0.5, y + TILE_SIZE * 0.55, 4 + progress * 10, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
  }

  // Chain-reaction sparks: additive link + traveling spark + target ring.
  if (chainSparkFx.length > 0) {
    context.save();
    context.lineCap = "round";
    context.globalCompositeOperation = "lighter";
    for (let i = chainSparkFx.length - 1; i >= 0; i -= 1) {
      const fx = chainSparkFx[i]!;
      const age = animMs - fx.startMs;
      if (age < 0 || age > CHAIN_SPARK_FX_MS) {
        chainSparkFx.splice(i, 1);
        continue;
      }
      const progress = age / CHAIN_SPARK_FX_MS;
      const alpha = 1 - progress;
      const fromX = fx.fromTile.x * TILE_SIZE + TILE_SIZE / 2;
      const fromY = fx.fromTile.y * TILE_SIZE + TILE_SIZE / 2;
      const toX = fx.toTile.x * TILE_SIZE + TILE_SIZE / 2;
      const toY = fx.toTile.y * TILE_SIZE + TILE_SIZE / 2;
      context.strokeStyle = `rgba(255, 244, 168, ${0.88 * alpha})`;
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(fromX, fromY);
      context.lineTo(toX, toY);
      context.stroke();
      const travel = prefersReducedMotion ? 0.5 : 0.18 + progress * 0.82;
      context.fillStyle = `rgba(255, 255, 220, ${alpha})`;
      context.beginPath();
      context.arc(fromX + (toX - fromX) * travel, fromY + (toY - fromY) * travel, 2.5, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = `rgba(255, 132, 38, ${0.72 * alpha})`;
      context.lineWidth = 2;
      context.beginPath();
      context.arc(toX, toY, prefersReducedMotion ? 9 : 6 + progress * 10, 0, Math.PI * 2);
      context.stroke();
    }
    context.restore();
  }

  // Blink trails: fading cyan link between blink origin and landing.
  for (let i = blinkTrailFx.length - 1; i >= 0; i -= 1) {
    const fx = blinkTrailFx[i]!;
    const age = animMs - fx.startMs;
    if (age < 0 || age > BLINK_TRAIL_FX_MS) {
      blinkTrailFx.splice(i, 1);
      continue;
    }
    const t = age / BLINK_TRAIL_FX_MS;
    const fromX = (fx.from.x / UNITS_PER_TILE) * TILE_SIZE;
    const fromY = (fx.from.y / UNITS_PER_TILE) * TILE_SIZE;
    const toX = (fx.to.x / UNITS_PER_TILE) * TILE_SIZE;
    const toY = (fx.to.y / UNITS_PER_TILE) * TILE_SIZE;
    context.save();
    context.globalCompositeOperation = "lighter";
    context.strokeStyle = `rgba(140, 225, 255, ${0.7 * (1 - t)})`;
    context.lineWidth = 3 * (1 - t) + 1;
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(fromX, fromY);
    context.lineTo(toX, toY);
    context.stroke();
    context.fillStyle = `rgba(200, 240, 255, ${0.8 * (1 - t)})`;
    context.beginPath();
    context.arc(fromX, fromY, 5 * (1 - t) + 1, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.arc(toX, toY, 6 * (1 - t) + 2, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  type Renderable = {
    id: CompetitorId;
    slot: LocalControlSlot;
    position: { x: number; y: number };
    facing: Facing;
    frameUrl: string;
    alive: boolean;
    spawnProtectionRemainingMs: number;
    channeling: boolean;
    spectral: boolean;
    /** Skill that owns this spectral projection (presentation tint only). */
    projectionSkillId: SkillId | null;
  };
  const renderables: Renderable[] = [];

  for (const competitor of snapshot.competitors) {
    if (!competitor.alive) {
      ranniProjectionPose.delete(competitor.id);
      continue;
    }
    const slot = slotForCompetitor(competitor.id);
    const facing = facingFromVelocity(
      competitor.velocity.x,
      competitor.velocity.y,
      lastFacing.get(competitor.id) ?? "south",
    );
    lastFacing.set(competitor.id, facing);
    const moving =
      Math.abs(competitor.velocity.x) >= MOVE_SPEED_THRESHOLD
      || Math.abs(competitor.velocity.y) >= MOVE_SPEED_THRESHOLD;
    const channeling = competitor.skill?.phase === "channeling";
    // Blink = teleport: a large single-frame jump leaves a trail behind.
    const previousPose = lastCompetitorPose.get(competitor.id);
    if (previousPose) {
      const jumpTiles = Math.hypot(
        competitor.position.x - previousPose.x,
        competitor.position.y - previousPose.y,
      ) / UNITS_PER_TILE;
      if (jumpTiles >= BLINK_JUMP_TILES) {
        // Skip if this teleport is already handled by a Thresh hook pull
        // (detected in detectHookLaunches to avoid double-firing).
        const alreadyPulled = hookPullFx.some(
          (fx) => fx.victimId === competitor.id
            && animMs - fx.startMs < HOOK_PULL_TOTAL_MS,
        );
        if (!alreadyPulled) {
          blinkTrailFx.push({
            from: { x: previousPose.x, y: previousPose.y },
            to: { x: competitor.position.x, y: competitor.position.y },
            startMs: animMs,
          });
        }
      }
    }
    lastCompetitorPose.set(competitor.id, {
      x: competitor.position.x,
      y: competitor.position.y,
      facing,
    });
    const actionFrame = timedChampionFrameUrl(competitor.id, slot, facing, animMs);
    const frameUrl = actionFrame ?? championFrameUrl(slot, facing, moving, animMs);
    // If this competitor is being pulled by Thresh hook, interpolate position.
    let renderPos = renderPositionFor(competitor.id, competitor.position);
    const pullFx = hookPullFx.find(
      (fx) => fx.victimId === competitor.id && animMs - fx.startMs < HOOK_PULL_TOTAL_MS,
    );
    if (pullFx) {
      const pullAge = animMs - pullFx.startMs;
      if (pullAge < HOOK_PULL_SNARE_MS) {
        // Snare phase: victim stays at origin (LoL snare hold).
        renderPos = pullFx.fromPos;
      } else if (pullAge < HOOK_PULL_SNARE_MS + HOOK_PULL_DRAG_MS) {
        // Drag phase: ease-out cubic with slight overshoot (LoL pull bounce).
        const t = (pullAge - HOOK_PULL_SNARE_MS) / HOOK_PULL_DRAG_MS;
        const eased = 1 - Math.pow(1 - t, 3);
        const overshoot = t > 0.8 ? Math.sin((t - 0.8) / 0.2 * Math.PI) * 0.06 : 0;
        const finalT = Math.min(1.05, eased + overshoot);
        const dx = wrapDelta(pullFx.toPos.x, pullFx.fromPos.x, ARENA_WIDTH * UNITS_PER_TILE);
        const dy = wrapDelta(pullFx.toPos.y, pullFx.fromPos.y, ARENA_HEIGHT * UNITS_PER_TILE);
        renderPos = {
          x: pullFx.fromPos.x + dx * finalT,
          y: pullFx.fromPos.y + dy * finalT,
        };
      }
      // Release phase: use snapshot position (already at destination).
    }
    renderables.push({
      id: competitor.id,
      slot,
      position: renderPos,
      facing,
      frameUrl,
      alive: true,
      spawnProtectionRemainingMs: competitor.spawnProtectionRemainingMs,
      channeling,
      spectral: false,
      projectionSkillId: null,
    });

    const projection =
      competitor.skill?.phase === "channeling"
        && DUAL_BODY_PROJECTION_SKILL_IDS.has(competitor.skill.id)
        && competitor.skill.projection
        ? competitor.skill.projection
        : null;
    const projectionSkillId = projection && competitor.skill ? competitor.skill.id : null;
    if (projection) {
      const previousProjection = ranniProjectionPose.get(competitor.id);
      const projectionDx = previousProjection
        ? wrapDelta(projection.x, previousProjection.x, WORLD_SPAN_X)
        : 0;
      const projectionDy = previousProjection
        ? wrapDelta(projection.y, previousProjection.y, WORLD_SPAN_Y)
        : 0;
      // Living Shadow is a fixed clone — hold the caster's facing and mirror
      // the body's action family (idle/walk/run/cast/plant) without translating.
      // Ice Blink steers its spirit and derives facing from projection velocity.
      const projectionFacing =
        projectionSkillId === ZED_LIVING_SHADOW_SKILL_ID
          ? facing
          : facingFromVelocity(
              projectionDx,
              projectionDy,
              previousProjection?.facing ?? facing,
            );
      const projectionMoved = Math.abs(projectionDx) >= MOVE_SPEED_THRESHOLD
        || Math.abs(projectionDy) >= MOVE_SPEED_THRESHOLD;
      const lastProjectionMoveMs = projectionMoved
        ? animMs
        : previousProjection?.lastMoveMs ?? Number.NEGATIVE_INFINITY;
      // Keep the walk cycle alive between 50 Hz kernel ticks for moving spirits.
      // Living Shadow stays spatially fixed but mirrors the body's locomotion family.
      const projectionMoving =
        projectionSkillId === ZED_LIVING_SHADOW_SKILL_ID
          ? moving
          : animMs - lastProjectionMoveMs < TICK_DURATION_MS * 2;
      ranniProjectionPose.set(competitor.id, {
        x: projection.x,
        y: projection.y,
        facing: projectionFacing,
        lastMoveMs: lastProjectionMoveMs,
        skillId: projectionSkillId,
      });
      const projectionFrameUrl =
        projectionSkillId === ZED_LIVING_SHADOW_SKILL_ID
          ? (actionFrame ?? championFrameUrl(slot, projectionFacing, projectionMoving, animMs))
          : championFrameUrl(slot, projectionFacing, projectionMoving, animMs);
      renderables.push({
        id: competitor.id,
        slot,
        position: projection,
        facing: projectionFacing,
        frameUrl: projectionFrameUrl,
        alive: true,
        spawnProtectionRemainingMs: 0,
        channeling: false,
        spectral: true,
        projectionSkillId,
      });
    } else {
      ranniProjectionPose.delete(competitor.id);
    }
  }

  // Eliminated competitors keep a held-pose death animation until the round resets.
  for (const [id, death] of deathAnims) {
    const slot = slotForCompetitor(id);
    const pack = activePack(slot);
    const frames = animationFrames(slot, "death", death.facing);
    const age = Math.max(0, animMs - death.startMs);
    const index = Math.min(frames.length - 1, Math.floor(age / DEATH_FRAME_MS));
    renderables.push({
      id,
      slot,
      position: death.position,
      facing: death.facing,
      frameUrl: frames[index] ?? pack.static[death.facing],
      alive: false,
      spawnProtectionRemainingMs: 0,
      channeling: false,
      spectral: false,
      projectionSkillId: null,
    });
  }

  renderables.sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x);

  for (const entry of renderables) {
    const cx = (entry.position.x / UNITS_PER_TILE) * TILE_SIZE;
    const cy = (entry.position.y / UNITS_PER_TILE) * TILE_SIZE;
    // Feet sit on body bottom (body center + half extent), matching product anchor.
    // Hitbox is always BODY_HALF_EXTENT — arenaScale is presentation-only.
    const bodyBottom = cy + (BODY_HALF_EXTENT / UNITS_PER_TILE) * TILE_SIZE;
    const champ = presentationFor(entry.slot);
    const arenaScale = champ.arenaScale;
    const spriteHeight = TILE_SIZE * CHAMPION_HEIGHT_TILES * arenaScale;
    const maxSpriteWidth = TILE_SIZE * CHAMPION_MAX_WIDTH_TILES * arenaScale;
    // Seat ownership (P1/P2) stays cyan/orange; accent drives champion magic color.
    const identity = entry.slot === "control-a" ? "56, 217, 245" : "255, 120, 50";
    const accent = accentRgb(champ.accent);
    const aliveAlpha = entry.spectral ? 0.42 : entry.alive ? 1 : 0.45;
    // Subtle breathe so idle units feel alive (presentation-only).
    const pulse = entry.alive ? 0.5 + 0.5 * Math.sin(animMs / 420) : 0;

    // 1) Contact shadow — darker ellipse so feet anchor on light stone.
    context.save();
    context.fillStyle = `rgba(6, 5, 4, ${0.46 * aliveAlpha})`;
    context.beginPath();
    context.ellipse(cx, bodyBottom - 1, TILE_SIZE * 0.38, TILE_SIZE * 0.16, 0, 0, Math.PI * 2);
    context.fill();
    context.restore();

    // 2) Accent ground plate — spectral platform read (borrowed from dark-arena polish).
    const plateRx = TILE_SIZE * (0.42 + 0.03 * pulse);
    const plateRy = TILE_SIZE * (0.18 + 0.012 * pulse);
    context.save();
    const plate = context.createRadialGradient(cx, bodyBottom - 1, 1, cx, bodyBottom - 1, plateRx);
    plate.addColorStop(0, `rgb(${accent} / ${0.32 * aliveAlpha})`);
    plate.addColorStop(0.55, `rgb(${accent} / ${0.14 * aliveAlpha})`);
    plate.addColorStop(1, `rgb(${accent} / 0)`);
    context.fillStyle = plate;
    context.beginPath();
    context.ellipse(cx, bodyBottom - 1, plateRx, plateRy, 0, 0, Math.PI * 2);
    context.fill();
    // Additive outer glow so accent plate survives light floor tiles.
    context.globalCompositeOperation = "lighter";
    const plateGlow = context.createRadialGradient(
      cx,
      bodyBottom - 1,
      2,
      cx,
      bodyBottom - 1,
      plateRx * 1.2,
    );
    plateGlow.addColorStop(0, `rgb(${accent} / ${0.2 * aliveAlpha})`);
    plateGlow.addColorStop(1, `rgb(${accent} / 0)`);
    context.fillStyle = plateGlow;
    context.beginPath();
    context.ellipse(cx, bodyBottom - 1, plateRx * 1.12, plateRy * 1.3, 0, 0, Math.PI * 2);
    context.fill();
    context.restore();

    // 3) Identity ownership ring (P1 cyan / P2 orange) — crisp seat marker.
    context.save();
    context.fillStyle = `rgb(${identity} / ${entry.spectral ? 0.04 : entry.alive ? 0.1 + 0.04 * pulse : 0.04})`;
    context.beginPath();
    context.ellipse(
      cx,
      bodyBottom - 1,
      TILE_SIZE * (0.44 + 0.02 * pulse),
      TILE_SIZE * (0.19 + 0.01 * pulse),
      0,
      0,
      Math.PI * 2,
    );
    context.fill();
    context.strokeStyle = `rgb(${identity} / ${entry.spectral ? 0.3 : entry.alive ? 0.72 + 0.14 * pulse : 0.28})`;
    context.lineWidth = 2;
    context.stroke();
    context.restore();

    if (entry.spawnProtectionRemainingMs > 0) {
      context.save();
      context.strokeStyle = "rgb(120 220 255 / 70%)";
      context.lineWidth = 2;
      context.beginPath();
      context.arc(cx, cy, TILE_SIZE * 0.42, 0, Math.PI * 2);
      context.stroke();
      context.restore();
    }

    if (entry.channeling) {
      // Soft accent aura while the skill channels (for example, Thresh green).
      context.save();
      context.globalCompositeOperation = "lighter";
      const aura = context.createRadialGradient(cx, cy, 4, cx, cy, TILE_SIZE * 0.72);
      aura.addColorStop(0, `rgb(${accent} / 0.28)`);
      aura.addColorStop(0.55, `rgb(${accent} / 0.1)`);
      aura.addColorStop(1, `rgb(${accent} / 0)`);
      context.fillStyle = aura;
      context.fillRect(cx - TILE_SIZE, cy - TILE_SIZE, TILE_SIZE * 2, TILE_SIZE * 2);
      context.restore();
    }

    const sprite = resolveSpriteSource(entry.frameUrl);
    if (sprite) {
      const { image, srcX, srcY, srcW, srcH } = sprite;
      const spriteWidth = Math.min(maxSpriteWidth, spriteHeight * (srcW / srcH));
      const spriteX = cx - spriteWidth * 0.5;
      const spriteY = bodyBottom - spriteHeight + 1;

      if (entry.spectral && entry.projectionSkillId === RANNI_ICE_BLINK_SKILL_ID) {
        const wispImage = champ.pack.effects["spirit-wisp"]
          ? imageCache.get(champ.pack.effects["spirit-wisp"]!)
          : undefined;
        if (wispImage?.complete && wispImage.naturalWidth > 0) {
          const wispFrame = Math.floor(animMs / RANNI_SPIRIT_WISP_FRAME_MS) % 4;
          const wispSize = TILE_SIZE * 1.15;
          context.save();
          context.globalAlpha = 0.3;
          context.globalCompositeOperation = "source-over";
          context.drawImage(
            wispImage,
            wispFrame * 128,
            0,
            128,
            128,
            cx - wispSize / 2,
            bodyBottom - wispSize * 0.78,
            wispSize,
            wispSize,
          );
          context.restore();
        }
      }

      // Soft accent silhouette glow — pops spectral sprites on light stone.
      context.save();
      if (entry.spectral) {
        // Spectral projection: dual-body ghost from allowlisted skill.projection state.
        // Ice Blink keeps its cool spirit tint; Living Shadow uses crimson.
        const iceSpirit = entry.projectionSkillId === RANNI_ICE_BLINK_SKILL_ID;
        const shadowClone = entry.projectionSkillId === ZED_LIVING_SHADOW_SKILL_ID;
        context.globalCompositeOperation = "lighter";
        context.filter = iceSpirit
          ? "brightness(0.95) saturate(1.15) hue-rotate(8deg)"
          : shadowClone
            ? "brightness(0.55) saturate(1.4) hue-rotate(-12deg)"
            : "brightness(0.75) saturate(1.2)";
        context.shadowColor = iceSpirit
          ? "rgb(100 220 245 / 0.48)"
          : shadowClone
            ? "rgb(180 40 50 / 0.5)"
            : `rgb(${accent} / 0.45)`;
        context.shadowBlur = 8 + 3 * pulse;
        for (const offset of [-7, -3]) {
          context.globalAlpha = offset === -7 ? 0.05 : 0.08;
          context.drawImage(
            image,
            srcX,
            srcY,
            srcW,
            srcH,
            spriteX + offset,
            spriteY + Math.abs(offset) * 0.2,
            spriteWidth,
            spriteHeight,
          );
        }
        context.globalCompositeOperation = "source-over";
        context.globalAlpha = iceSpirit ? RANNI_SPIRIT_PRIMARY_ALPHA : 0.45;
        context.filter = iceSpirit
          ? "brightness(0.8) contrast(1.18) saturate(1.35) hue-rotate(8deg)"
          : shadowClone
            ? "brightness(0.45) contrast(1.25) saturate(1.5) hue-rotate(-18deg)"
            : "brightness(0.7) contrast(1.15) saturate(1.2)";
        context.shadowColor = iceSpirit
          ? "rgb(80 205 235 / 0.6)"
          : shadowClone
            ? "rgb(160 30 40 / 0.55)"
            : `rgb(${accent} / 0.55)`;
        context.shadowBlur = 7 + 2 * pulse;
      } else if (entry.alive) {
        context.shadowColor = `rgb(${accent} / ${0.42 + 0.12 * pulse})`;
        context.shadowBlur = 11 + 5 * pulse;
      } else {
        context.shadowColor = "rgba(0, 0, 0, 0.25)";
        context.shadowBlur = 4;
      }
      context.drawImage(image, srcX, srcY, srcW, srcH, spriteX, spriteY, spriteWidth, spriteHeight);
      context.shadowBlur = 0;
      context.shadowColor = "transparent";
      // Crisp second pass so glow does not soften pixel edges.
      if (!entry.spectral) {
        context.drawImage(image, srcX, srcY, srcW, srcH, spriteX, spriteY, spriteWidth, spriteHeight);
      }
      context.restore();
    } else {
      context.fillStyle = entry.slot === "control-a" ? "#38d9f5" : "#ff5a1f";
      context.beginPath();
      context.arc(cx, cy, TILE_SIZE * 0.28, 0, Math.PI * 2);
      context.fill();
    }

    // Name pill above the head for living players.
    if (entry.alive && !entry.spectral) {
      const label = `${entry.slot === "control-a" ? "P1" : "P2"} · ${copy.controlName(entry.slot)}`;
      context.save();
      context.font = "600 10px Inter, system-ui, sans-serif";
      const pillWidth = context.measureText(label).width + 14;
      const pillHeight = 15;
      const pillX = cx - pillWidth / 2;
      const pillY = bodyBottom - spriteHeight - pillHeight - 3;
      context.fillStyle = "rgba(8, 10, 16, 0.72)";
      context.beginPath();
      context.roundRect(pillX, pillY, pillWidth, pillHeight, 7);
      context.fill();
      // Seat bar + thin accent hairline for champion identity.
      context.fillStyle = `rgb(${identity} / 0.95)`;
      context.fillRect(pillX + 4, pillY + 3, 2, pillHeight - 6);
      context.fillStyle = `rgb(${accent} / 0.75)`;
      context.fillRect(pillX + 7, pillY + 5, 2, pillHeight - 10);
      context.fillStyle = "rgba(245, 248, 255, 0.95)";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(label, cx + 2, pillY + pillHeight / 2 + 0.5);
      context.restore();
    }
  }

  // ── Thresh hook projectile ──────────────────────────────────────
  for (let i = hookProjectileFx.length - 1; i >= 0; i -= 1) {
    const fx = hookProjectileFx[i]!;
    const age = animMs - fx.startMs;
    if (age < 0 || age > HOOK_TOTAL_MS) {
      hookProjectileFx.splice(i, 1);
      continue;
    }
    const slot = slotForCompetitor(fx.ownerId);
    const pack = activePack(slot);
    const hookAssets = pack.hookProjectile;
    if (!hookAssets) continue;

    const facing: Facing = fx.direction === "up" ? "north"
      : fx.direction === "down" ? "south"
      : fx.direction === "left" ? "west"
      : "east";
    const headUrl = hookAssets.head[facing] ?? hookAssets.head.south;
    const chainUrl = hookAssets.chainLink;

    const ox = fx.originTile.x * TILE_SIZE + TILE_SIZE / 2;
    const oy = fx.originTile.y * TILE_SIZE + TILE_SIZE / 2;
    const dirX = fx.direction === "left" ? -1 : fx.direction === "right" ? 1 : 0;
    const dirY = fx.direction === "up" ? -1 : fx.direction === "down" ? 1 : 0;
    const maxReach = fx.reachTiles * TILE_SIZE;

    // Phase 1: Flight (0 → HOOK_FLIGHT_MS) — hook head travels, chain extends.
    // Phase 2: Impact (HOOK_FLIGHT_MS → +HOOK_IMPACT_MS) — flash at tip.
    // Phase 3: Fade (rest) — everything fades out.
    const flightT = Math.min(1, age / HOOK_FLIGHT_MS);
    const impactAge = age - HOOK_FLIGHT_MS;
    const fadeT = Math.max(0, (age - HOOK_FLIGHT_MS - HOOK_IMPACT_MS) / HOOK_FADE_MS);
    const globalAlpha = fadeT > 0 ? 1 - fadeT : 1;

    // Hook head position along the line.
    const hookDist = flightT * maxReach;
    const hx = ox + dirX * hookDist;
    const hy = oy + dirY * hookDist;

    context.save();
    context.globalAlpha = globalAlpha;

    // Draw chain links between origin and hook head.
    if (hookDist > 4) {
      const linkSpacing = TILE_SIZE * 0.35;
      const numLinks = Math.floor(hookDist / linkSpacing);
      const linkSize = TILE_SIZE * 0.5;
      for (let li = 1; li <= numLinks; li += 1) {
        const lt = li / (numLinks + 1);
        const lx = ox + dirX * hookDist * lt;
        const ly = oy + dirY * hookDist * lt;
        // Pulse each link slightly.
        const pulse = 0.85 + 0.15 * Math.sin(animMs / 80 + li * 1.2);
        const ls = linkSize * pulse;
        context.save();
        context.translate(lx, ly);
        // Rotate chain links to align with direction.
        if (dirX !== 0) context.rotate(dirX > 0 ? 0 : Math.PI);
        else context.rotate(dirY > 0 ? Math.PI / 2 : -Math.PI / 2);
        drawImageUrl(context, chainUrl, -ls / 2, -ls / 2, ls, ls);
        context.restore();
      }
    }

    // Draw hook head.
    const headSize = TILE_SIZE * 1.0;
    context.save();
    context.translate(hx, hy);
    // Rotate hook head to face flight direction.
    if (dirX > 0) context.rotate(0);
    else if (dirX < 0) context.rotate(Math.PI);
    else if (dirY > 0) context.rotate(Math.PI / 2);
    else context.rotate(-Math.PI / 2);
    // Slight bob during flight.
    const bob = age < HOOK_FLIGHT_MS ? Math.sin(animMs / 60) * 2 : 0;
    drawImageUrl(context, headUrl, -headSize / 2, -headSize / 2 + bob, headSize, headSize);
    context.restore();

    // Hitbox indicator during flight (subtle green circle).
    if (age < HOOK_FLIGHT_MS) {
      context.save();
      context.strokeStyle = `rgba(57, 255, 136, ${0.25 * globalAlpha})`;
      context.lineWidth = 1.5;
      context.beginPath();
      context.arc(hx, hy, TILE_SIZE * 0.3, 0, Math.PI * 2);
      context.stroke();
      context.restore();
    }

    // Impact flash at hook tip.
    if (fx.hit && impactAge >= 0 && impactAge < HOOK_IMPACT_MS) {
      const impactT = impactAge / HOOK_IMPACT_MS;
      const frameIdx = Math.min(
        hookAssets.impact.length - 1,
        Math.floor(impactT * hookAssets.impact.length),
      );
      const impactUrl = hookAssets.impact[frameIdx];
      if (impactUrl) {
        const impactSize = TILE_SIZE * 2 * (0.6 + impactT * 0.4);
        context.save();
        context.globalAlpha = globalAlpha * (1 - impactT * 0.3);
        drawImageUrl(
          context,
          impactUrl,
          hx - impactSize / 2,
          hy - impactSize / 2,
          impactSize,
          impactSize,
        );
        context.restore();
      }
    }

    context.restore();
  }

  // ── Thresh hook victim pull chain ──────────────────────────────
  for (let i = hookPullFx.length - 1; i >= 0; i -= 1) {
    const fx = hookPullFx[i]!;
    const age = animMs - fx.startMs;
    if (age < 0 || age > HOOK_PULL_TOTAL_MS) {
      hookPullFx.splice(i, 1);
      continue;
    }
    // Find the Thresh who owns this pull.
    const threshSlot = slotForCompetitor(
      hookProjectileFx.find((h) => h.hit && animMs - h.startMs < HOOK_TOTAL_MS + HOOK_PULL_TOTAL_MS)?.ownerId
        ?? fx.victimId,
    );
    const pack = activePack(threshSlot);
    const hookAssets = pack.hookProjectile;
    if (!hookAssets) continue;

    // Chain origin = Thresh tile center.
    const ox = fx.threshTile.x * TILE_SIZE + TILE_SIZE / 2;
    const oy = fx.threshTile.y * TILE_SIZE + TILE_SIZE / 2;

    // ── Victim position with LoL-style easing ──
    const fromPx = (fx.fromPos.x / UNITS_PER_TILE) * TILE_SIZE;
    const fromPy = (fx.fromPos.y / UNITS_PER_TILE) * TILE_SIZE;
    const toPx = (fx.toPos.x / UNITS_PER_TILE) * TILE_SIZE;
    const toPy = (fx.toPos.y / UNITS_PER_TILE) * TILE_SIZE;
    const spanX = ARENA_WIDTH * UNITS_PER_TILE;
    const spanY = ARENA_HEIGHT * UNITS_PER_TILE;
    const rawDx = wrapDelta(fx.toPos.x, fx.fromPos.x, spanX);
    const rawDy = wrapDelta(fx.toPos.y, fx.fromPos.y, spanY);

    let vx: number, vy: number;
    if (age < HOOK_PULL_SNARE_MS) {
      // Snare: victim trembles in place (LoL snare shake).
      const tremble = Math.sin(animMs / 30) * 2.5;
      vx = fromPx + tremble;
      vy = fromPy + tremble * 0.5;
    } else if (age < HOOK_PULL_SNARE_MS + HOOK_PULL_DRAG_MS) {
      // Drag: ease-out cubic with slight overshoot at the end (LoL pull bounce).
      const t = (age - HOOK_PULL_SNARE_MS) / HOOK_PULL_DRAG_MS;
      const eased = 1 - Math.pow(1 - t, 3);
      const overshoot = t > 0.8 ? Math.sin((t - 0.8) / 0.2 * Math.PI) * 0.06 : 0;
      const finalT = Math.min(1.05, eased + overshoot);
      vx = fromPx + (rawDx / UNITS_PER_TILE) * TILE_SIZE * finalT;
      vy = fromPy + (rawDy / UNITS_PER_TILE) * TILE_SIZE * finalT;
    } else {
      vx = toPx;
      vy = toPy;
    }

    // Fade out during release.
    const releaseT = Math.max(0, (age - HOOK_PULL_SNARE_MS - HOOK_PULL_DRAG_MS) / HOOK_PULL_RELEASE_MS);
    const alpha = releaseT > 0 ? 1 - releaseT : 1;

    // ── Draw spectral chain (LoL style: bright core + links) ──
    const chainDx = vx - ox;
    const chainDy = vy - oy;
    const chainDist = Math.hypot(chainDx, chainDy);
    if (chainDist > 4) {
      const chainAngle = Math.atan2(chainDy, chainDx);

      // Layer 1: glowing green energy line (additive, LoL spectral glow).
      context.save();
      context.globalAlpha = alpha * 0.6;
      context.globalCompositeOperation = "lighter";
      context.strokeStyle = "rgba(57, 255, 136, 0.7)";
      context.lineWidth = 3.5;
      context.lineCap = "round";
      context.shadowColor = "rgba(57, 255, 136, 0.8)";
      context.shadowBlur = 8;
      context.beginPath();
      context.moveTo(ox, oy);
      context.lineTo(vx, vy);
      context.stroke();
      context.restore();

      // Layer 2: chain link sprites along the line.
      const linkSpacing = TILE_SIZE * 0.32;
      const numLinks = Math.max(2, Math.floor(chainDist / linkSpacing));
      const linkSize = TILE_SIZE * 0.55;
      context.save();
      context.globalAlpha = alpha;
      for (let li = 1; li <= numLinks; li += 1) {
        const lt = li / (numLinks + 1);
        const lx = ox + chainDx * lt;
        const ly = oy + chainDy * lt;
        // Links pulse outward from Thresh (LoL chain energy flow).
        const pulsePhase = (animMs / 100 + li * 0.8) % (Math.PI * 2);
        const pulse = 0.8 + 0.2 * Math.sin(pulsePhase);
        const ls = linkSize * pulse;
        context.save();
        context.translate(lx, ly);
        context.rotate(chainAngle);
        drawImageUrl(context, hookAssets.chainLink, -ls / 2, -ls / 2, ls, ls);
        context.restore();
      }
      context.restore();
    }

    // ── Snare effect on victim (LoL: green flash + chains wrapping) ──
    if (age < HOOK_PULL_SNARE_MS + HOOK_PULL_DRAG_MS) {
      // Bright flash during snare phase.
      const snareIntensity = age < HOOK_PULL_SNARE_MS
        ? 1 - (age / HOOK_PULL_SNARE_MS) * 0.3
        : 0.7 - ((age - HOOK_PULL_SNARE_MS) / HOOK_PULL_DRAG_MS) * 0.5;
      context.save();
      context.globalAlpha = alpha * snareIntensity * 0.5;
      context.globalCompositeOperation = "lighter";
      const flashR = TILE_SIZE * (0.5 + 0.15 * Math.sin(animMs / 60));
      const flash = context.createRadialGradient(vx, vy, 2, vx, vy, flashR);
      flash.addColorStop(0, "rgba(180, 255, 210, 0.8)");
      flash.addColorStop(0.4, "rgba(57, 255, 136, 0.4)");
      flash.addColorStop(1, "rgba(57, 255, 136, 0)");
      context.fillStyle = flash;
      context.fillRect(vx - flashR, vy - flashR, flashR * 2, flashR * 2);
      context.restore();

      // Chain wrap rings around victim (2 orbiting links).
      context.save();
      context.globalAlpha = alpha * snareIntensity * 0.7;
      const wrapR = TILE_SIZE * 0.45;
      for (let w = 0; w < 2; w += 1) {
        const wAngle = animMs / 150 + w * Math.PI;
        const wx = vx + Math.cos(wAngle) * wrapR;
        const wy = vy + Math.sin(wAngle) * wrapR;
        const wSize = TILE_SIZE * 0.35;
        context.save();
        context.translate(wx, wy);
        context.rotate(wAngle + Math.PI / 2);
        drawImageUrl(context, hookAssets.chainLink, -wSize / 2, -wSize / 2, wSize, wSize);
        context.restore();
      }
      context.restore();
    }
  }

  // Presentation-only power-up feedback (burst / ring / floating label).
  for (let i = presentationFx.length - 1; i >= 0; i -= 1) {
    const fx = presentationFx[i]!;
    const age = animMs - fx.startMs;
    if (age < 0 || age > POWER_FX_MS) {
      presentationFx.splice(i, 1);
      continue;
    }
    const t = age / POWER_FX_MS;
    const cx = fx.tileX * TILE_SIZE + TILE_SIZE / 2;
    const cy = fx.tileY * TILE_SIZE + TILE_SIZE / 2;
    const isCollect = fx.kind === "power-collect";
    const color = fx.powerUpType === "bomb-up" ? "56, 160, 255" : "255, 140, 50";
    context.save();
    context.globalAlpha = Math.max(0, 1 - t);
    // Expanding ring
    context.strokeStyle = `rgb(${color} / ${0.85 - t * 0.5})`;
    context.lineWidth = isCollect ? 2.5 : 2;
    context.beginPath();
    context.arc(cx, cy, TILE_SIZE * (0.2 + t * (isCollect ? 0.75 : 0.55)), 0, Math.PI * 2);
    context.stroke();
    // Soft burst fill
    context.fillStyle = `rgb(${color} / ${0.22 * (1 - t)})`;
    context.beginPath();
    context.arc(cx, cy, TILE_SIZE * (0.16 + t * 0.28), 0, Math.PI * 2);
    context.fill();
    // Floating label
    context.font = "bold 11px ui-monospace, SFMono-Regular, Consolas, monospace";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = `rgb(255 245 230 / ${0.95 - t * 0.4})`;
    context.shadowColor = `rgb(${color} / 0.7)`;
    context.shadowBlur = 8;
    context.fillText(fx.label, cx, cy - TILE_SIZE * (0.35 + t * 0.55));
    context.restore();
  }

  // Optional lab demo: one validated VFX at a time, cycling through all packs.
  maybeQueueAnimationLabDemo(animMs);

  // Animation-lab VFX stays presentation-only and is painted above world FX.
  drawAnimationLabFx(animMs);

  // End screen-shake translate; vignette stays unshaken to seat the frame.
  context.restore();
  const vignette = context.createRadialGradient(
    LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2, LOGICAL_HEIGHT * 0.42,
    LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2, LOGICAL_HEIGHT * 0.85,
  );
  vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
  vignette.addColorStop(1, "rgba(4, 6, 10, 0.26)");
  context.fillStyle = vignette;
  context.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
}

function renderSuddenDeathBanner(snapshot: GameSnapshot, animMs: number): void {
  const active = snapshot.phase === "sudden-death";
  sdBanner.classList.toggle("is-visible", active);
  const flashing = active && animMs <= suddenDeathBannerUntilMs;
  sdBanner.classList.toggle("is-flash", flashing);
  if (!active) {
    suddenDeathBannerUntilMs = 0;
  }
}

function renderOverlay(snapshot: GameSnapshot): void {
  const labObservation = createBotLabObservation(
    activeConfiguration,
    snapshot,
    [championName("control-a"), championName("control-b")],
    isEnglish ? "en" : "pt-BR",
    activeMatchNumber,
    botDrivers,
  );
  const show =
    snapshot.phase === "paused"
    || snapshot.phase === "round-start"
    || snapshot.phase === "round-over"
    || snapshot.phase === "match-over";

  // Sudden death: non-blocking banner only (see renderSuddenDeathBanner).
  if (snapshot.phase === "sudden-death") {
    overlay.classList.remove("is-visible");
    return;
  }

  if (!show) {
    overlay.classList.remove("is-visible");
    return;
  }

  overlay.classList.add("is-visible");
  const showActions = snapshot.phase === "paused" || snapshot.phase === "match-over";
  overlayActions.hidden = !showActions;
  overlayActions.style.display = showActions ? "" : "none";
  overlayPauseBtn.hidden = snapshot.phase === "match-over";
  overlayPauseBtn.style.display = snapshot.phase === "match-over" ? "none" : "";
  const showNewLabMatch = activeConfiguration.mode === "bot-lab" && snapshot.phase === "match-over";
  overlayNewMatchBtn.hidden = !showNewLabMatch;
  overlayNewMatchBtn.style.display = showNewLabMatch ? "" : "none";

  // Winner portrait on outcome overlays; hidden otherwise.
  const overlayWinner = snapshot.phase === "round-over"
    ? snapshot.outcome?.winner ?? null
    : snapshot.phase === "match-over"
      ? snapshot.matchWinner
      : null;
  if (overlayWinner) {
    overlayPortrait.src = activePack(slotForCompetitor(overlayWinner)).portrait;
    overlayPortraitWrap.hidden = false;
  } else {
    overlayPortraitWrap.hidden = true;
  }

  if (snapshot.phase === "paused") {
    overlayEyebrow.textContent = "Bomba PvP";
    overlayTitle.textContent = copy.paused;
    overlaySub.textContent = copy.controlsHint;
    overlayPauseBtn.textContent = copy.resume;
    return;
  }
  if (snapshot.phase === "round-start") {
    const seconds = Math.max(1, Math.ceil(snapshot.phaseRemainingMs / 1_000));
    overlayEyebrow.textContent = `${copy.round} ${snapshot.roundNumber}`;
    overlayTitle.textContent = seconds <= 1 ? copy.go : String(seconds);
    overlaySub.textContent = copy.getReady;
    return;
  }
  if (snapshot.phase === "round-over") {
    overlayEyebrow.textContent = copy.roundOver;
    if (snapshot.outcome?.winner) {
      overlayTitle.textContent = copy.winner(displayName(snapshot.outcome.winner, copy));
    } else {
      overlayTitle.textContent = copy.doubleKo;
    }
    overlaySub.textContent = `${scoreFor(snapshot, localCompetitorBySlot["control-a"])} – ${scoreFor(snapshot, localCompetitorBySlot["control-b"])}`;
    return;
  }
  if (snapshot.phase === "match-over") {
    overlayEyebrow.textContent = copy.matchOver;
    if (labObservation?.result) {
      overlayTitle.textContent = labObservation.result;
    } else if (snapshot.matchWinner) {
      overlayTitle.textContent = copy.matchWinner(displayName(snapshot.matchWinner, copy));
    } else {
      overlayTitle.textContent = copy.matchOver;
    }
    overlaySub.textContent = activeConfiguration.mode === "bot-lab"
      ? `${copy.firstTo}${snapshot.targetRoundWins} · ${isEnglish ? "experiment" : "experimento"} ${activeMatchNumber}`
      : `${copy.firstTo}${snapshot.targetRoundWins}`;
    return;
  }
}

function updateLolPanel(panel: LolHudPanel, snapshot: GameSnapshot): void {
  const competitor = snapshot.competitors.find((entry) => entry.id === panel.competitorId);
  if (!competitor) return;
  const champ = presentationFor(panel.slot);
  panel.root.classList.toggle("is-eliminated", !competitor.alive);
  panel.bombs.textContent = `${Math.max(0, competitor.maxBombs - competitor.activeBombs)}/${competitor.maxBombs}`;
  panel.range.textContent = String(competitor.flameRange);
  panel.status.textContent = !competitor.alive
    ? copy.rivalOut
    : competitor.spawnProtectionRemainingMs > 0
      ? copy.protected
      : "";
  const hp = !competitor.alive
    ? 0
    : competitor.spawnProtectionRemainingMs > 0
      ? 0.7
      : 1;
  panel.statusBar.style.width = `${Math.round(hp * 100)}%`;
  panel.statusBar.classList.toggle("is-down", !competitor.alive);
  panel.statusBar.classList.toggle("is-shield", competitor.spawnProtectionRemainingMs > 0);

  const wins = scoreFor(snapshot, competitor.id);
  const pipNodes: HTMLElement[] = [];
  for (let i = 0; i < snapshot.targetRoundWins; i += 1) {
    pipNodes.push(element(
      document,
      "span",
      i < wins ? "hud-pips__pip hud-pips__pip--filled" : "hud-pips__pip",
    ));
  }
  panel.pips.replaceChildren(...pipNodes);

  const skill = competitor.skill;
  const cooldownMs = champ.skillCooldownMs || RANNI_COOLDOWN_MS;
  panel.spellR.classList.remove("is-locked");
  if (!skill) {
    // No skill snapshot only if seat has no skillId — should not happen for roster picks.
    panel.spellR.classList.add("is-locked");
    panel.spellR.classList.remove("is-ready", "is-cast", "is-cooldown");
    panel.spellRCd.textContent = "";
    panel.portraitRing.style.setProperty("--cd", "1");
    return;
  }
  const state = skill.phase === "idle"
    ? "ready"
    : skill.phase === "channeling"
      ? "cast"
      : "cooldown";
  panel.spellR.classList.toggle("is-ready", state === "ready");
  panel.spellR.classList.toggle("is-cast", state === "cast");
  panel.spellR.classList.toggle("is-cooldown", state === "cooldown");
  panel.spellRCd.textContent = state === "ready"
    ? copy.ultReady
    : state === "cast"
      ? copy.ultCast
      : copy.skillCooldown(skill.cooldownRemainingMs / 1_000);
  const progress = state === "ready" || state === "cast"
    ? 1
    : 1 - Math.min(1, Math.max(0, skill.cooldownRemainingMs / cooldownMs));
  panel.portraitRing.style.setProperty("--cd", String(progress));
}

function renderHud(snapshot: GameSnapshot): void {
  const labObservation = createBotLabObservation(
    activeConfiguration,
    snapshot,
    [championName("control-a"), championName("control-b")],
    isEnglish ? "en" : "pt-BR",
    activeMatchNumber,
    botDrivers,
  );
  const displayMs = timerDisplayMs(snapshot);
  timeValue.textContent = formatTime(displayMs);
  timerShell.classList.toggle("is-sudden-death", snapshot.phase === "sudden-death");
  roundLabel.textContent = activeConfiguration.mode === "bot-lab"
    ? `AI LAB · R${snapshot.roundNumber} · FT${snapshot.targetRoundWins}`
    : `R${snapshot.roundNumber} · FT${snapshot.targetRoundWins}`;

  const sdActive = snapshot.phase === "sudden-death";
  sdMeter.classList.toggle("is-active", sdActive);
  if (sdActive) {
    sdMeterFill.style.width = "100%";
  } else {
    const total = snapshot.roundElapsedMs + snapshot.roundRemainingMs;
    const progress = total > 0 ? snapshot.roundElapsedMs / total : 0;
    sdMeterFill.style.width = `${Math.round(Math.min(1, Math.max(0, progress)) * 100)}%`;
  }

  pauseButton.textContent = snapshot.phase === "paused" ? copy.resume : copy.pause;
  pauseButton.disabled =
    snapshot.phase === "round-over" || snapshot.phase === "match-over" || !matchStarted;

  updateLolPanel(p1Hud, snapshot);
  updateLolPanel(p2Hud, snapshot);
  for (const panel of [p1Hud, p2Hud]) {
    const playerIndex = playerIndexForSlot(panel.slot);
    const driver = browserBotDriverForPlayer(botDrivers, playerIndex);
    const profile = botProfileForPlayer(activeConfiguration, playerIndex);
    panel.controller.textContent = profile
      ? `${isEnglish ? "AI" : "IA"} · ${profile.label} · M${Math.trunc((driver?.masteryBasisPoints ?? 0) / 100)} · D${driver?.decisions ?? 0}`
      : (isEnglish ? "HUMAN" : "HUMANO");
  }

  if (labObservation) {
    const mastery = labObservation.competitors
      .map(({ masteryBasisPoints }) => `M${Math.trunc(masteryBasisPoints / 100)}`)
      .join("/");
    const experienceEvents = labObservation.competitors.reduce(
      (sum, competitor) => sum + competitor.experienceEvents,
      0,
    );
    hint.textContent = `${labObservation.summary} · ${labPlaybackSpeed}× · ${mastery} · E${experienceEvents} · ${labExperienceRecording ? "REC" : "OBS"}`;
  } else {
    hint.innerHTML = `<kbd>WASD</kbd>+<kbd>Q</kbd>+<kbd>␣</kbd> · <kbd>↑←↓→</kbd>+<kbd>O</kbd>+<kbd>I</kbd> · <kbd>Esc</kbd> · <kbd>T</kbd> · <kbd>M</kbd>`;
  }

  if (devOpen) {
    devMeta.textContent =
      `tick=${snapshot.revision} phase=${snapshot.phase} R${snapshot.roundNumber} `
      + `K=${snapshot.targetRoundWins} bombs=${snapshot.bombs.length} flames=${snapshot.flames.length} `
      + `powerups=${snapshot.powerUps.length} pressure=${snapshot.pressure.closing ? "closing" : "—"} `
      + `mode=${activeConfiguration.mode} p1=${selectedP1} p2=${selectedP2} `
      + `bots=${botDrivers.map(({ profile, modelVersion }) => `${profile.id}@${modelVersion}`).join(",") || "none"} `
      + `techniques=${botDrivers.map(({ lastTechniqueId }) => lastTechniqueId ?? "—").join(",")} `
      + `experience=${labExperienceSink.events().length}`;
  }
}

function render(snapshot = game.snapshot(), animMs = performance.now()): void {
  // When the world leaves a playable phase, drop held movement so pause cannot queue intent.
  if (
    lastKnownPhase !== snapshot.phase
    && acceptsGameplayInput(lastKnownPhase)
    && !acceptsGameplayInput(snapshot.phase)
  ) {
    releaseMovement();
  }
  lastKnownPhase = snapshot.phase;

  detectChampionAnimationStarts(snapshot, animMs);
  detectHookLaunches(snapshot, animMs);
  renderCanvas(snapshot, animMs);
  renderHud(snapshot);
  renderSuddenDeathBanner(snapshot, animMs);
  renderOverlay(snapshot);

  boardSummary.textContent =
    `${phaseLabel(snapshot)}. ${copy.round} ${snapshot.roundNumber}. `
    + `${displayName(localCompetitorBySlot["control-a"], copy)} ${scoreFor(snapshot, localCompetitorBySlot["control-a"])} – `
    + `${scoreFor(snapshot, localCompetitorBySlot["control-b"])} ${displayName(localCompetitorBySlot["control-b"], copy)}. `
    + `${formatTime(timerDisplayMs(snapshot))}.`;
}

function dispatchAndRender(command: Parameters<typeof game.dispatch>[0]): readonly GameEvent[] {
  // A restart re-seeds the bot so a fresh session replays the same bot stream.
  if (command.type === "restart") resetBots();
  const events = game.dispatch(command);
  appendEvents(events);
  render();
  return events;
}

pauseButton.addEventListener("click", () => dispatchAndRender({ type: "toggle-pause" }));
restartButton.addEventListener("click", () => dispatchAndRender({ type: "restart" }));
overlayPauseBtn.addEventListener("click", () => dispatchAndRender({ type: "toggle-pause" }));
overlayRestartBtn.addEventListener("click", () => dispatchAndRender({ type: "restart" }));
devToggle.addEventListener("click", () => {
  devOpen = !devOpen;
  updateDevOpen();
  renderLog();
  render();
});

function onKeyDown(event: KeyboardEvent): void {
  // Character select keyboard: A/D P1, arrows P2, Enter starts.
  if (!matchStarted || selectScreen.classList.contains("is-open")) {
    if (event.code === "KeyA") { event.preventDefault(); stepPick("p1", -1); return; }
    if (event.code === "KeyD") { event.preventDefault(); stepPick("p1", 1); return; }
    if (event.code === "ArrowLeft") { event.preventDefault(); stepPick("p2", -1); return; }
    if (event.code === "ArrowRight") { event.preventDefault(); stepPick("p2", 1); return; }
    if (event.code === "Enter" || event.code === "Space") {
      event.preventDefault();
      confirmCharacterSelect();
      return;
    }
    if (event.code === "Escape" && matchStarted) {
      event.preventDefault();
      showSelectScreen(false);
      return;
    }
    return;
  }
  const movement = MOVEMENT_BINDINGS[event.code];
  if (movement) {
    event.preventDefault();
    // Gate movement to playable phases only — paused keys must not enqueue.
    if (!acceptsGameplayInput()) return;
    // Bot-controlled slots never accept parallel human input.
    if (competitorIsBot(movement.competitorId)) return;
    if (pressedMovementCodes.has(event.code)) return;
    pressedMovementCodes.add(event.code);
    game.dispatch({ type: "set-movement", ...movement, pressed: true });
    return;
  }
  if (event.repeat) return;
  if (event.code === "KeyQ" || event.code === "KeyO") {
    event.preventDefault();
    // Gate bombs the same way: Q/O during pause must not place after resume.
    if (!acceptsGameplayInput()) return;
    const competitorId = event.code === "KeyQ"
      ? localCompetitorBySlot["control-a"]
      : localCompetitorBySlot["control-b"];
    if (competitorIsBot(competitorId)) return;
    dispatchAndRender({ type: "place-bomb", competitorId });
    return;
  }
  if (["KeyR", "Space", "KeyI", "KeyE", "KeyP"].includes(event.code)) {
    event.preventDefault();
    if (!acceptsGameplayInput()) return;
    // Product bindings: P1 KeyR/Space, P2 KeyI. E/P remain legacy alternates.
    const competitorId = event.code === "KeyR" || event.code === "Space" || event.code === "KeyE"
      ? localCompetitorBySlot["control-a"]
      : localCompetitorBySlot["control-b"];
    if (competitorIsBot(competitorId)) return;
    dispatchAndRender({ type: "use-skill", competitorId });
    return;
  }
  if (event.code === "Escape") {
    event.preventDefault();
    dispatchAndRender({ type: "toggle-pause" });
    return;
  }
  if (event.code === "KeyM") {
    event.preventDefault();
    const muted = toggleSoundMuted();
    eventMessages.unshift(muted ? "sound off" : "sound on");
    eventMessages.splice(EVENT_LOG_LIMIT);
    renderLog();
    return;
  }
  if (event.code === "KeyT") dispatchAndRender({ type: "restart" });
}

function onKeyUp(event: KeyboardEvent): void {
  const movement = MOVEMENT_BINDINGS[event.code];
  if (!movement) return;
  event.preventDefault();
  if (!pressedMovementCodes.has(event.code)) return;
  pressedMovementCodes.delete(event.code);
  // Always release if we had tracked the press (safe even outside playable phases).
  game.dispatch({ type: "set-movement", ...movement, pressed: false });
}

function releaseMovement(): void {
  for (const code of pressedMovementCodes) {
    const movement = MOVEMENT_BINDINGS[code];
    if (movement) game.dispatch({ type: "set-movement", ...movement, pressed: false });
  }
  pressedMovementCodes.clear();
}

function onVisibilityChange(): void {
  releaseMovement();
  if (!document.hidden) return;
  const phase = game.snapshot().phase;
  if (phase === "round-start" || phase === "playing" || phase === "sudden-death") {
    dispatchAndRender({ type: "toggle-pause" });
  }
}

window.addEventListener("keydown", onKeyDown);
window.addEventListener("keyup", onKeyUp);
window.addEventListener("blur", releaseMovement);
document.addEventListener("visibilitychange", onVisibilityChange);

let animationFrame = 0;
let previousFrameMs = performance.now();
let accumulatorMs = 0;

/**
 * Presentation-only tick interpolation (never kernel state). The kernel
 * advances at 50 Hz; rendering draws between the last two tick poses so
 * movement reads smooth at any display refresh rate (~1 tick of latency).
 */
const WORLD_SPAN_X = ARENA_WIDTH * UNITS_PER_TILE;
const WORLD_SPAN_Y = ARENA_HEIGHT * UNITS_PER_TILE;
let prevTickPositions: ReadonlyMap<CompetitorId, WorldPositionLike> | null = null;
let currTickPositions: ReadonlyMap<CompetitorId, WorldPositionLike> | null = null;
let tickBlendAlpha = 1;

type WorldPositionLike = Readonly<{ x: number; y: number }>;

function captureTickPositions(snapshot: GameSnapshot): Map<CompetitorId, WorldPositionLike> {
  const map = new Map<CompetitorId, WorldPositionLike>();
  for (const competitor of snapshot.competitors) {
    map.set(competitor.id, { x: competitor.position.x, y: competitor.position.y });
  }
  return map;
}

/**
 * Render position between the last two kernel ticks. Jumps larger than the
 * contract max step (blink teleport, round reset) snap instead of lerping
 * across the arena.
 */
function renderPositionFor(
  competitorId: CompetitorId,
  current: WorldPositionLike,
): WorldPositionLike {
  if (tickBlendAlpha >= 1 || !prevTickPositions || !currTickPositions?.has(competitorId)) {
    return current;
  }
  const prev = prevTickPositions.get(competitorId);
  if (!prev) return current;
  const dx = wrapDelta(current.x, prev.x, WORLD_SPAN_X);
  const dy = wrapDelta(current.y, prev.y, WORLD_SPAN_Y);
  if (Math.abs(dx) > LANE_CORRECTION_MAX || Math.abs(dy) > LANE_CORRECTION_MAX) {
    return current;
  }
  return { x: prev.x + dx * tickBlendAlpha, y: prev.y + dy * tickBlendAlpha };
}

/**
 * Run each configured bot decision and dispatch its ordinary commands,
 * immediately before a kernel tick advances. Driver order follows seat order,
 * so the same typed config + seed + command stream is deterministic.
 */
function dispatchBotCommandsForTick(): void {
  const snapshot = game.snapshot();
  for (const report of driveBrowserBotsForTick(snapshot, botDrivers)) {
    for (const command of report.commands) game.dispatch(command);
  }
}

function frame(nowMs: number): void {
  const delta = Math.min(MAX_FRAME_DELTA_MS, Math.max(0, nowMs - previousFrameMs));
  previousFrameMs = nowMs;
  if (!matchStarted || selectScreen.classList.contains("is-open")) {
    // Freeze sim during character select; still paint the idle arena.
    render(game.snapshot(), nowMs);
    animationFrame = window.requestAnimationFrame(frame);
    return;
  }
  accumulatorMs += delta * (activeConfiguration.mode === "bot-lab" ? labPlaybackSpeed : 1);
  const events: GameEvent[] = [];
  let preTickPositions: Map<CompetitorId, WorldPositionLike> | null = null;
  while (accumulatorMs >= TICK_DURATION_MS) {
    // Pose before THIS tick: on the last loop iteration it becomes the
    // interpolation origin, so multi-tick frames never fast-forward.
    preTickPositions = captureTickPositions(game.snapshot());
    dispatchBotCommandsForTick();
    const tickEvents = game.dispatch({ type: "advance", deltaMs: TICK_DURATION_MS });
    recordBrowserBotTickOutcome(game.snapshot(), botDrivers, tickEvents, game.rejections());
    events.push(...tickEvents);
    accumulatorMs -= TICK_DURATION_MS;
  }
  if (preTickPositions) {
    prevTickPositions = preTickPositions;
    currTickPositions = captureTickPositions(game.snapshot());
  }
  tickBlendAlpha = Math.min(1, accumulatorMs / TICK_DURATION_MS);
  if (events.length > 0) appendEvents(events);
  render(game.snapshot(), nowMs);
  animationFrame = window.requestAnimationFrame(frame);
}

window.get_game_mechanics_snapshot = () => game.snapshot();
window.get_bot_lab_experience = () => labExperienceSink.events();
window.advance_game_mechanics = (milliseconds: number) => {
  const events: GameEvent[] = [];
  let remaining = Math.max(0, milliseconds);
  while (remaining >= TICK_DURATION_MS) {
    dispatchBotCommandsForTick();
    const tickEvents = game.dispatch({ type: "advance", deltaMs: TICK_DURATION_MS });
    recordBrowserBotTickOutcome(game.snapshot(), botDrivers, tickEvents, game.rejections());
    events.push(...tickEvents);
    remaining -= TICK_DURATION_MS;
  }
  if (remaining > 0) events.push(...game.dispatch({ type: "advance", deltaMs: remaining }));
  appendEvents(events);
  const snapshot = game.snapshot();
  render(snapshot);
  return snapshot;
};

window.addEventListener("pagehide", () => {
  window.cancelAnimationFrame(animationFrame);
  releaseMovement();
  window.removeEventListener("keydown", onKeyDown);
  window.removeEventListener("keyup", onKeyUp);
  window.removeEventListener("blur", releaseMovement);
  document.removeEventListener("visibilitychange", onVisibilityChange);
  delete window.get_game_mechanics_snapshot;
  delete window.advance_game_mechanics;
  delete window.get_bot_lab_experience;
}, { once: true });

preloadScene();
preloadSelectedChampions();
preloadSounds();
initSoundUnlock(window);
updateDevOpen();
syncP2ModeButton();
renderLog();
render();
animationFrame = window.requestAnimationFrame(frame);
