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
import hudPanelCenterUrl from "../../assets/hud/panel-center-v1.png";
import hudPanelLocalUrl from "../../assets/hud/panel-local-v1.png";
import hudPanelRivalUrl from "../../assets/hud/panel-rival-v1.png";
import ranniPortraitUrl from "../../assets/champions/ranni/portrait.png";
import nicoPortraitUrl from "../../assets/champions/nico/portrait.png";
import ranniSouthUrl from "../../assets/champions/ranni/south.png";
import ranniNorthUrl from "../../assets/champions/ranni/north.png";
import ranniEastUrl from "../../assets/champions/ranni/east.png";
import ranniWestUrl from "../../assets/champions/ranni/west.png";
import ranniIdleSouth0 from "../../assets/champions/ranni/idle-south-0.png";
import ranniIdleSouth1 from "../../assets/champions/ranni/idle-south-1.png";
import ranniIdleSouth2 from "../../assets/champions/ranni/idle-south-2.png";
import ranniIdleSouth3 from "../../assets/champions/ranni/idle-south-3.png";
import ranniIdleNorth0 from "../../assets/champions/ranni/idle-north-0.png";
import ranniIdleNorth1 from "../../assets/champions/ranni/idle-north-1.png";
import ranniIdleNorth2 from "../../assets/champions/ranni/idle-north-2.png";
import ranniIdleNorth3 from "../../assets/champions/ranni/idle-north-3.png";
import ranniIdleEast0 from "../../assets/champions/ranni/idle-east-0.png";
import ranniIdleEast1 from "../../assets/champions/ranni/idle-east-1.png";
import ranniIdleEast2 from "../../assets/champions/ranni/idle-east-2.png";
import ranniIdleEast3 from "../../assets/champions/ranni/idle-east-3.png";
import ranniIdleWest0 from "../../assets/champions/ranni/idle-west-0.png";
import ranniIdleWest1 from "../../assets/champions/ranni/idle-west-1.png";
import ranniIdleWest2 from "../../assets/champions/ranni/idle-west-2.png";
import ranniIdleWest3 from "../../assets/champions/ranni/idle-west-3.png";
import ranniWalkSouth0 from "../../assets/champions/ranni/walk-south-0.png";
import ranniWalkSouth1 from "../../assets/champions/ranni/walk-south-1.png";
import ranniWalkSouth2 from "../../assets/champions/ranni/walk-south-2.png";
import ranniWalkSouth3 from "../../assets/champions/ranni/walk-south-3.png";
import ranniWalkSouth4 from "../../assets/champions/ranni/walk-south-4.png";
import ranniWalkSouth5 from "../../assets/champions/ranni/walk-south-5.png";
import ranniWalkSouth6 from "../../assets/champions/ranni/walk-south-6.png";
import ranniWalkSouth7 from "../../assets/champions/ranni/walk-south-7.png";
import ranniWalkNorth0 from "../../assets/champions/ranni/walk-north-0.png";
import ranniWalkNorth1 from "../../assets/champions/ranni/walk-north-1.png";
import ranniWalkNorth2 from "../../assets/champions/ranni/walk-north-2.png";
import ranniWalkNorth3 from "../../assets/champions/ranni/walk-north-3.png";
import ranniWalkNorth4 from "../../assets/champions/ranni/walk-north-4.png";
import ranniWalkNorth5 from "../../assets/champions/ranni/walk-north-5.png";
import ranniWalkNorth6 from "../../assets/champions/ranni/walk-north-6.png";
import ranniWalkNorth7 from "../../assets/champions/ranni/walk-north-7.png";
import ranniWalkEast0 from "../../assets/champions/ranni/walk-east-0.png";
import ranniWalkEast1 from "../../assets/champions/ranni/walk-east-1.png";
import ranniWalkEast2 from "../../assets/champions/ranni/walk-east-2.png";
import ranniWalkEast3 from "../../assets/champions/ranni/walk-east-3.png";
import ranniWalkEast4 from "../../assets/champions/ranni/walk-east-4.png";
import ranniWalkEast5 from "../../assets/champions/ranni/walk-east-5.png";
import ranniWalkEast6 from "../../assets/champions/ranni/walk-east-6.png";
import ranniWalkEast7 from "../../assets/champions/ranni/walk-east-7.png";
import ranniWalkWest0 from "../../assets/champions/ranni/walk-west-0.png";
import ranniWalkWest1 from "../../assets/champions/ranni/walk-west-1.png";
import ranniWalkWest2 from "../../assets/champions/ranni/walk-west-2.png";
import ranniWalkWest3 from "../../assets/champions/ranni/walk-west-3.png";
import ranniWalkWest4 from "../../assets/champions/ranni/walk-west-4.png";
import ranniWalkWest5 from "../../assets/champions/ranni/walk-west-5.png";
import ranniWalkWest6 from "../../assets/champions/ranni/walk-west-6.png";
import ranniWalkWest7 from "../../assets/champions/ranni/walk-west-7.png";
import nicoSouthUrl from "../../assets/champions/nico/south.png";
import nicoNorthUrl from "../../assets/champions/nico/north.png";
import nicoEastUrl from "../../assets/champions/nico/east.png";
import nicoWestUrl from "../../assets/champions/nico/west.png";
import nicoIdleSouth0 from "../../assets/champions/nico/idle-south-0.png";
import nicoIdleSouth1 from "../../assets/champions/nico/idle-south-1.png";
import nicoIdleSouth2 from "../../assets/champions/nico/idle-south-2.png";
import nicoIdleSouth3 from "../../assets/champions/nico/idle-south-3.png";
import nicoIdleNorth0 from "../../assets/champions/nico/idle-north-0.png";
import nicoIdleNorth1 from "../../assets/champions/nico/idle-north-1.png";
import nicoIdleNorth2 from "../../assets/champions/nico/idle-north-2.png";
import nicoIdleNorth3 from "../../assets/champions/nico/idle-north-3.png";
import nicoIdleEast0 from "../../assets/champions/nico/idle-east-0.png";
import nicoIdleEast1 from "../../assets/champions/nico/idle-east-1.png";
import nicoIdleEast2 from "../../assets/champions/nico/idle-east-2.png";
import nicoIdleEast3 from "../../assets/champions/nico/idle-east-3.png";
import nicoIdleWest0 from "../../assets/champions/nico/idle-west-0.png";
import nicoIdleWest1 from "../../assets/champions/nico/idle-west-1.png";
import nicoIdleWest2 from "../../assets/champions/nico/idle-west-2.png";
import nicoIdleWest3 from "../../assets/champions/nico/idle-west-3.png";
import nicoWalkSouth0 from "../../assets/champions/nico/walk-south-0.png";
import nicoWalkSouth1 from "../../assets/champions/nico/walk-south-1.png";
import nicoWalkSouth2 from "../../assets/champions/nico/walk-south-2.png";
import nicoWalkSouth3 from "../../assets/champions/nico/walk-south-3.png";
import nicoWalkNorth0 from "../../assets/champions/nico/walk-north-0.png";
import nicoWalkNorth1 from "../../assets/champions/nico/walk-north-1.png";
import nicoWalkNorth2 from "../../assets/champions/nico/walk-north-2.png";
import nicoWalkNorth3 from "../../assets/champions/nico/walk-north-3.png";
import nicoWalkNorth4 from "../../assets/champions/nico/walk-north-4.png";
import nicoWalkNorth5 from "../../assets/champions/nico/walk-north-5.png";
import nicoWalkEast0 from "../../assets/champions/nico/walk-east-0.png";
import nicoWalkEast1 from "../../assets/champions/nico/walk-east-1.png";
import nicoWalkEast2 from "../../assets/champions/nico/walk-east-2.png";
import nicoWalkEast3 from "../../assets/champions/nico/walk-east-3.png";
import nicoWalkEast4 from "../../assets/champions/nico/walk-east-4.png";
import nicoWalkEast5 from "../../assets/champions/nico/walk-east-5.png";
import nicoWalkWest0 from "../../assets/champions/nico/walk-west-0.png";
import nicoWalkWest1 from "../../assets/champions/nico/walk-west-1.png";
import nicoWalkWest2 from "../../assets/champions/nico/walk-west-2.png";
import nicoWalkWest3 from "../../assets/champions/nico/walk-west-3.png";
import nicoWalkWest4 from "../../assets/champions/nico/walk-west-4.png";
import nicoWalkWest5 from "../../assets/champions/nico/walk-west-5.png";
import crateBreak0Url from "../../assets/gameplay/crate-break-0.png";
import crateBreak1Url from "../../assets/gameplay/crate-break-1.png";
import crateBreak2Url from "../../assets/gameplay/crate-break-2.png";
import crateBreak3Url from "../../assets/gameplay/crate-break-3.png";
import ranniDeathSouth0 from "../../assets/champions/ranni/death-south-0.png";
import ranniDeathSouth1 from "../../assets/champions/ranni/death-south-1.png";
import ranniDeathSouth2 from "../../assets/champions/ranni/death-south-2.png";
import ranniDeathSouth3 from "../../assets/champions/ranni/death-south-3.png";
import ranniDeathSouth4 from "../../assets/champions/ranni/death-south-4.png";
import ranniDeathSouth5 from "../../assets/champions/ranni/death-south-5.png";
import ranniDeathSouth6 from "../../assets/champions/ranni/death-south-6.png";
import ranniDeathNorth0 from "../../assets/champions/ranni/death-north-0.png";
import ranniDeathNorth1 from "../../assets/champions/ranni/death-north-1.png";
import ranniDeathNorth2 from "../../assets/champions/ranni/death-north-2.png";
import ranniDeathNorth3 from "../../assets/champions/ranni/death-north-3.png";
import ranniDeathNorth4 from "../../assets/champions/ranni/death-north-4.png";
import ranniDeathNorth5 from "../../assets/champions/ranni/death-north-5.png";
import ranniDeathNorth6 from "../../assets/champions/ranni/death-north-6.png";
import ranniDeathEast0 from "../../assets/champions/ranni/death-east-0.png";
import ranniDeathEast1 from "../../assets/champions/ranni/death-east-1.png";
import ranniDeathEast2 from "../../assets/champions/ranni/death-east-2.png";
import ranniDeathEast3 from "../../assets/champions/ranni/death-east-3.png";
import ranniDeathEast4 from "../../assets/champions/ranni/death-east-4.png";
import ranniDeathEast5 from "../../assets/champions/ranni/death-east-5.png";
import ranniDeathEast6 from "../../assets/champions/ranni/death-east-6.png";
import ranniDeathWest0 from "../../assets/champions/ranni/death-west-0.png";
import ranniDeathWest1 from "../../assets/champions/ranni/death-west-1.png";
import ranniDeathWest2 from "../../assets/champions/ranni/death-west-2.png";
import ranniDeathWest3 from "../../assets/champions/ranni/death-west-3.png";
import ranniDeathWest4 from "../../assets/champions/ranni/death-west-4.png";
import ranniDeathWest5 from "../../assets/champions/ranni/death-west-5.png";
import ranniDeathWest6 from "../../assets/champions/ranni/death-west-6.png";
import ranniCastSouth0 from "../../assets/champions/ranni/cast-south-0.png";
import ranniCastSouth1 from "../../assets/champions/ranni/cast-south-1.png";
import ranniCastSouth2 from "../../assets/champions/ranni/cast-south-2.png";
import ranniCastSouth3 from "../../assets/champions/ranni/cast-south-3.png";
import ranniCastNorth0 from "../../assets/champions/ranni/cast-north-0.png";
import ranniCastNorth1 from "../../assets/champions/ranni/cast-north-1.png";
import ranniCastNorth2 from "../../assets/champions/ranni/cast-north-2.png";
import ranniCastNorth3 from "../../assets/champions/ranni/cast-north-3.png";
import ranniCastEast0 from "../../assets/champions/ranni/cast-east-0.png";
import ranniCastEast1 from "../../assets/champions/ranni/cast-east-1.png";
import ranniCastEast2 from "../../assets/champions/ranni/cast-east-2.png";
import ranniCastEast3 from "../../assets/champions/ranni/cast-east-3.png";
import ranniCastWest0 from "../../assets/champions/ranni/cast-west-0.png";
import ranniCastWest1 from "../../assets/champions/ranni/cast-west-1.png";
import ranniCastWest2 from "../../assets/champions/ranni/cast-west-2.png";
import ranniCastWest3 from "../../assets/champions/ranni/cast-west-3.png";
import nicoDeathSouth0 from "../../assets/champions/nico/death-south-0.png";
import nicoDeathSouth1 from "../../assets/champions/nico/death-south-1.png";
import nicoDeathSouth2 from "../../assets/champions/nico/death-south-2.png";
import nicoDeathSouth3 from "../../assets/champions/nico/death-south-3.png";
import nicoDeathSouth4 from "../../assets/champions/nico/death-south-4.png";
import nicoDeathSouth5 from "../../assets/champions/nico/death-south-5.png";
import nicoDeathNorth0 from "../../assets/champions/nico/death-north-0.png";
import nicoDeathNorth1 from "../../assets/champions/nico/death-north-1.png";
import nicoDeathNorth2 from "../../assets/champions/nico/death-north-2.png";
import nicoDeathNorth3 from "../../assets/champions/nico/death-north-3.png";
import nicoDeathNorth4 from "../../assets/champions/nico/death-north-4.png";
import nicoDeathNorth5 from "../../assets/champions/nico/death-north-5.png";
import nicoDeathEast0 from "../../assets/champions/nico/death-east-0.png";
import nicoDeathEast1 from "../../assets/champions/nico/death-east-1.png";
import nicoDeathEast2 from "../../assets/champions/nico/death-east-2.png";
import nicoDeathEast3 from "../../assets/champions/nico/death-east-3.png";
import nicoDeathEast4 from "../../assets/champions/nico/death-east-4.png";
import nicoDeathEast5 from "../../assets/champions/nico/death-east-5.png";
import nicoDeathWest0 from "../../assets/champions/nico/death-west-0.png";
import nicoDeathWest1 from "../../assets/champions/nico/death-west-1.png";
import nicoDeathWest2 from "../../assets/champions/nico/death-west-2.png";
import nicoDeathWest3 from "../../assets/champions/nico/death-west-3.png";
import nicoDeathWest4 from "../../assets/champions/nico/death-west-4.png";
import nicoDeathWest5 from "../../assets/champions/nico/death-west-5.png";
import nicoCastSouth0 from "../../assets/champions/nico/cast-south-0.png";
import nicoCastSouth1 from "../../assets/champions/nico/cast-south-1.png";
import nicoCastSouth2 from "../../assets/champions/nico/cast-south-2.png";
import nicoCastSouth3 from "../../assets/champions/nico/cast-south-3.png";
import nicoCastSouth4 from "../../assets/champions/nico/cast-south-4.png";
import nicoCastSouth5 from "../../assets/champions/nico/cast-south-5.png";
import nicoCastNorth0 from "../../assets/champions/nico/cast-north-0.png";
import nicoCastNorth1 from "../../assets/champions/nico/cast-north-1.png";
import nicoCastNorth2 from "../../assets/champions/nico/cast-north-2.png";
import nicoCastNorth3 from "../../assets/champions/nico/cast-north-3.png";
import nicoCastNorth4 from "../../assets/champions/nico/cast-north-4.png";
import nicoCastNorth5 from "../../assets/champions/nico/cast-north-5.png";
import nicoCastEast0 from "../../assets/champions/nico/cast-east-0.png";
import nicoCastEast1 from "../../assets/champions/nico/cast-east-1.png";
import nicoCastEast2 from "../../assets/champions/nico/cast-east-2.png";
import nicoCastEast3 from "../../assets/champions/nico/cast-east-3.png";
import nicoCastEast4 from "../../assets/champions/nico/cast-east-4.png";
import nicoCastEast5 from "../../assets/champions/nico/cast-east-5.png";
import nicoCastWest0 from "../../assets/champions/nico/cast-west-0.png";
import nicoCastWest1 from "../../assets/champions/nico/cast-west-1.png";
import nicoCastWest2 from "../../assets/champions/nico/cast-west-2.png";
import nicoCastWest3 from "../../assets/champions/nico/cast-west-3.png";
import nicoCastWest4 from "../../assets/champions/nico/cast-west-4.png";
import nicoCastWest5 from "../../assets/champions/nico/cast-west-5.png";

import { createGameMechanics } from "../game-mechanics.ts";
import { createLocalDuel1v1MatchConfig, createMatchConfig } from "../match-config.ts";
import { RANNI_CHANNEL_MS } from "../modules/skills/index.ts";
import {
  initSoundUnlock,
  playSoundsForEvents,
  preloadSounds,
  toggleSoundMuted,
} from "./audio.ts";
import {
  GAME_MECHANICS_VERSION,
  RANNI_ICE_BLINK_SKILL_ID,
  TICK_DURATION_MS,
  type CompetitorId,
  type Direction,
  type GameEvent,
  type GameSnapshot,
  type TileCoord,
} from "../contracts.ts";
import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  BODY_HALF_EXTENT,
  BOMB_FUSE_MS,
  CANONICAL_SPAWNS,
  FLAME_DURATION_MS,
  PRESSURE_FALL_MS,
  UNITS_PER_TILE,
} from "../kernel/world-state.ts";
import {
  createBotMemory,
  createBotPrng,
  driveBot,
  type BotMemory,
  type BotPrng,
} from "../bots/index.ts";

declare global {
  interface Window {
    get_game_mechanics_snapshot?: () => GameSnapshot;
    advance_game_mechanics?: (milliseconds: number) => GameSnapshot;
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
/** Opaque champion height in tiles after source-rect trim (oracle ~1.45, target 1.5–1.9). */
const CHAMPION_HEIGHT_TILES = 1.72;
const CHAMPION_MAX_WIDTH_TILES = 1.35;
const SPRITE_ALPHA_THRESHOLD = 24;
const IDLE_FRAME_MS = 180;
const WALK_FRAME_MS = 90;
const DEATH_FRAME_MS = 90;
const CAST_FRAME_MS = 100;
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

type RecentExplosion = {
  bombId: number;
  tile: TileCoord;
  flameTiles: readonly TileCoord[];
  startMs: number;
};

/** Presentation-only local control slots. Not domain identity. */
type LocalControlSlot = "control-a" | "control-b";
type Facing = "south" | "north" | "east" | "west";

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
  skillReady: string;
  skillChanneling: string;
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
  controlsHint: "P1 WASD+Q+Espaço · P2 ←↑↓→+O+I · Esc pausa · T reinicia · M som",
  devShow: "Dev",
  devHide: "Fechar",
  devTitle: "Diagnóstico",
  ready: "Arena pronta.",
  winner: (name) => `${name} venceu a rodada`,
  matchWinner: (name) => `${name} venceu a partida`,
  controlName: (slot) => (slot === "control-a" ? "Ranni" : "Nico"),
  p2Human: "Humano",
  p2Bot: "Bot",
  skillReady: "Espaço · Pronta",
  skillChanneling: "Espaço · Canalizando",
  skillCooldown: (seconds) => `Espaço · ${seconds.toFixed(1)}s`,
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
  controlsHint: "P1 WASD+Q+Space · P2 ←↑↓→+O+I · Esc pause · T restart · M sound",
  devShow: "Dev",
  devHide: "Close",
  devTitle: "Diagnostics",
  ready: "Arena ready.",
  winner: (name) => `${name} wins the round`,
  matchWinner: (name) => `${name} wins the match`,
  controlName: (slot) => (slot === "control-a" ? "Ranni" : "Nico"),
  p2Human: "Human",
  p2Bot: "Bot",
  skillReady: "Space · Ready",
  skillChanneling: "Space · Channeling",
  skillCooldown: (seconds) => `Space · ${seconds.toFixed(1)}s`,
  p2ModeLabel: (control) => (control === "bot" ? "P2: Bot" : "P2: Human"),
});

/** Presentational portal pads (mid-edge) — visual only, no kernel coupling. */
const VISUAL_PORTALS: readonly TileCoord[] = Object.freeze([
  Object.freeze({ x: 1, y: 4 }),
  Object.freeze({ x: ARENA_WIDTH - 2, y: 4 }),
  Object.freeze({ x: 5, y: 1 }),
  Object.freeze({ x: 5, y: ARENA_HEIGHT - 2 }),
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

type ChampPack = Readonly<{
  portrait: string;
  static: Readonly<Record<Facing, string>>;
  idle: Readonly<Record<Facing, readonly string[]>>;
  walk: Readonly<Record<Facing, readonly string[]>>;
  cast: Readonly<Record<Facing, readonly string[]>>;
  death: Readonly<Record<Facing, readonly string[]>>;
}>;

const CHAMPIONS: Readonly<Record<LocalControlSlot, ChampPack>> = Object.freeze({
  "control-a": Object.freeze({
    portrait: ranniPortraitUrl,
    static: Object.freeze({
      south: ranniSouthUrl,
      north: ranniNorthUrl,
      east: ranniEastUrl,
      west: ranniWestUrl,
    }),
    idle: Object.freeze({
      south: Object.freeze([ranniIdleSouth0, ranniIdleSouth1, ranniIdleSouth2, ranniIdleSouth3]),
      north: Object.freeze([ranniIdleNorth0, ranniIdleNorth1, ranniIdleNorth2, ranniIdleNorth3]),
      east: Object.freeze([ranniIdleEast0, ranniIdleEast1, ranniIdleEast2, ranniIdleEast3]),
      west: Object.freeze([ranniIdleWest0, ranniIdleWest1, ranniIdleWest2, ranniIdleWest3]),
    }),
    walk: Object.freeze({
      south: Object.freeze([
        ranniWalkSouth0, ranniWalkSouth1, ranniWalkSouth2, ranniWalkSouth3,
        ranniWalkSouth4, ranniWalkSouth5, ranniWalkSouth6, ranniWalkSouth7,
      ]),
      north: Object.freeze([
        ranniWalkNorth0, ranniWalkNorth1, ranniWalkNorth2, ranniWalkNorth3,
        ranniWalkNorth4, ranniWalkNorth5, ranniWalkNorth6, ranniWalkNorth7,
      ]),
      east: Object.freeze([
        ranniWalkEast0, ranniWalkEast1, ranniWalkEast2, ranniWalkEast3,
        ranniWalkEast4, ranniWalkEast5, ranniWalkEast6, ranniWalkEast7,
      ]),
      west: Object.freeze([
        ranniWalkWest0, ranniWalkWest1, ranniWalkWest2, ranniWalkWest3,
        ranniWalkWest4, ranniWalkWest5, ranniWalkWest6, ranniWalkWest7,
      ]),
    }),
    cast: Object.freeze({
      south: Object.freeze([ranniCastSouth0, ranniCastSouth1, ranniCastSouth2, ranniCastSouth3]),
      north: Object.freeze([ranniCastNorth0, ranniCastNorth1, ranniCastNorth2, ranniCastNorth3]),
      east: Object.freeze([ranniCastEast0, ranniCastEast1, ranniCastEast2, ranniCastEast3]),
      west: Object.freeze([ranniCastWest0, ranniCastWest1, ranniCastWest2, ranniCastWest3]),
    }),
    death: Object.freeze({
      south: Object.freeze([
        ranniDeathSouth0, ranniDeathSouth1, ranniDeathSouth2, ranniDeathSouth3,
        ranniDeathSouth4, ranniDeathSouth5, ranniDeathSouth6,
      ]),
      north: Object.freeze([
        ranniDeathNorth0, ranniDeathNorth1, ranniDeathNorth2, ranniDeathNorth3,
        ranniDeathNorth4, ranniDeathNorth5, ranniDeathNorth6,
      ]),
      east: Object.freeze([
        ranniDeathEast0, ranniDeathEast1, ranniDeathEast2, ranniDeathEast3,
        ranniDeathEast4, ranniDeathEast5, ranniDeathEast6,
      ]),
      west: Object.freeze([
        ranniDeathWest0, ranniDeathWest1, ranniDeathWest2, ranniDeathWest3,
        ranniDeathWest4, ranniDeathWest5, ranniDeathWest6,
      ]),
    }),
  }),
  "control-b": Object.freeze({
    portrait: nicoPortraitUrl,
    static: Object.freeze({
      south: nicoSouthUrl,
      north: nicoNorthUrl,
      east: nicoEastUrl,
      west: nicoWestUrl,
    }),
    idle: Object.freeze({
      south: Object.freeze([nicoIdleSouth0, nicoIdleSouth1, nicoIdleSouth2, nicoIdleSouth3]),
      north: Object.freeze([nicoIdleNorth0, nicoIdleNorth1, nicoIdleNorth2, nicoIdleNorth3]),
      east: Object.freeze([nicoIdleEast0, nicoIdleEast1, nicoIdleEast2, nicoIdleEast3]),
      west: Object.freeze([nicoIdleWest0, nicoIdleWest1, nicoIdleWest2, nicoIdleWest3]),
    }),
    walk: Object.freeze({
      south: Object.freeze([nicoWalkSouth0, nicoWalkSouth1, nicoWalkSouth2, nicoWalkSouth3]),
      north: Object.freeze([
        nicoWalkNorth0, nicoWalkNorth1, nicoWalkNorth2, nicoWalkNorth3,
        nicoWalkNorth4, nicoWalkNorth5,
      ]),
      east: Object.freeze([
        nicoWalkEast0, nicoWalkEast1, nicoWalkEast2, nicoWalkEast3,
        nicoWalkEast4, nicoWalkEast5,
      ]),
      west: Object.freeze([
        nicoWalkWest0, nicoWalkWest1, nicoWalkWest2, nicoWalkWest3,
        nicoWalkWest4, nicoWalkWest5,
      ]),
    }),
    cast: Object.freeze({
      south: Object.freeze([
        nicoCastSouth0, nicoCastSouth1, nicoCastSouth2, nicoCastSouth3,
        nicoCastSouth4, nicoCastSouth5,
      ]),
      north: Object.freeze([
        nicoCastNorth0, nicoCastNorth1, nicoCastNorth2, nicoCastNorth3,
        nicoCastNorth4, nicoCastNorth5,
      ]),
      east: Object.freeze([
        nicoCastEast0, nicoCastEast1, nicoCastEast2, nicoCastEast3,
        nicoCastEast4, nicoCastEast5,
      ]),
      west: Object.freeze([
        nicoCastWest0, nicoCastWest1, nicoCastWest2, nicoCastWest3,
        nicoCastWest4, nicoCastWest5,
      ]),
    }),
    death: Object.freeze({
      south: Object.freeze([
        nicoDeathSouth0, nicoDeathSouth1, nicoDeathSouth2, nicoDeathSouth3,
        nicoDeathSouth4, nicoDeathSouth5,
      ]),
      north: Object.freeze([
        nicoDeathNorth0, nicoDeathNorth1, nicoDeathNorth2, nicoDeathNorth3,
        nicoDeathNorth4, nicoDeathNorth5,
      ]),
      east: Object.freeze([
        nicoDeathEast0, nicoDeathEast1, nicoDeathEast2, nicoDeathEast3,
        nicoDeathEast4, nicoDeathEast5,
      ]),
      west: Object.freeze([
        nicoDeathWest0, nicoDeathWest1, nicoDeathWest2, nicoDeathWest3,
        nicoDeathWest4, nicoDeathWest5,
      ]),
    }),
  }),
});

const localDuelConfig = createLocalDuel1v1MatchConfig();
const matchConfig = createMatchConfig({
  ...localDuelConfig,
  seats: localDuelConfig.seats.map((seat, index) => ({
    seatId: seat.seatId,
    competitorId: seat.competitorId,
    ...(index === 0 ? { skillId: RANNI_ICE_BLINK_SKILL_ID } : {}),
  })),
});
const localCompetitorBySlot: Readonly<Record<LocalControlSlot, CompetitorId>> = Object.freeze({
  "control-a": matchConfig.seats[0]!.competitorId,
  "control-b": matchConfig.seats[1]!.competitorId,
});
const localSlotByCompetitor: ReadonlyMap<CompetitorId, LocalControlSlot> = new Map([
  [localCompetitorBySlot["control-a"], "control-a"],
  [localCompetitorBySlot["control-b"], "control-b"],
]);

/** Seat controlled by P2, resolved once from the frozen config. */
const P2_SEAT_ID = matchConfig.seats[1]!.seatId;
const P2_COMPETITOR_ID = localCompetitorBySlot["control-b"];

/** Presentation-only: is P2 driven by the pure bot or a local human? Default human. */
type P2Control = "human" | "bot";
function initialP2Control(): P2Control {
  try {
    return new URLSearchParams(window.location.search).get("p2") === "bot" ? "bot" : "human";
  } catch {
    return "human";
  }
}
let p2Control: P2Control = initialP2Control();

/**
 * Deterministic bot PRNG seeded from the match seed. Reset on restart so a
 * fresh session reproduces the same bot stream. Bot memory holds the currently
 * pressed direction so we emit clean release/press transitions each decision.
 */
let botPrng: BotPrng = createBotPrng(matchConfig.seed);
let botMemory: BotMemory = createBotMemory();
function resetBot(): void {
  botPrng = createBotPrng(matchConfig.seed);
  botMemory = createBotMemory();
}
function p2IsBot(): boolean {
  return p2Control === "bot";
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
  return copy.controlName(slotForCompetitor(competitorId));
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

const root = document.querySelector<HTMLElement>("#game-mechanics-root");
if (!root) throw new Error("GameMechanics root was not found.");

const isEnglish = window.location.hostname.replace(/^www\./, "") === "bombpvp.com";
const copy = isEnglish ? EN_COPY : PT_COPY;
document.documentElement.lang = isEnglish ? "en" : "pt-BR";
document.title = isEnglish ? "Bomba PvP · Arena" : "Bomba PvP · Arena";
root.removeAttribute("aria-live");

const game = createGameMechanics(matchConfig);
const imageCache = new Map<string, HTMLImageElement>();
const spriteTrimCache = new WeakMap<HTMLImageElement, SpriteTrimBounds | null>();
let trimProbeCanvas: HTMLCanvasElement | null = null;
let trimProbeContext: CanvasRenderingContext2D | null = null;
const pressedMovementCodes = new Set<string>();
const eventMessages: string[] = [copy.ready];
const presentationFx: PresentationFx[] = [];
const crateBreakFx: CrateBreakFx[] = [];
const chainSparkFx: ChainSparkFx[] = [];
const blinkTrailFx: BlinkTrailFx[] = [];
const pressureWarnFx: PressureWarnFx[] = [];
const deathAnims = new Map<CompetitorId, DeathAnim>();
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

function preloadAll(): void {
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
    hudPanelCenterUrl,
    hudPanelLocalUrl,
    hudPanelRivalUrl,
  ]);
  for (const slot of ["control-a", "control-b"] as const) {
    const pack = CHAMPIONS[slot];
    urls.add(pack.portrait);
    for (const facing of ["south", "north", "east", "west"] as const) {
      urls.add(pack.static[facing]);
      for (const frame of pack.idle[facing]) urls.add(frame);
      for (const frame of pack.walk[facing]) urls.add(frame);
      for (const frame of pack.cast[facing]) urls.add(frame);
      for (const frame of pack.death[facing]) urls.add(frame);
    }
  }
  for (const url of urls) loadImage(url);
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
app.style.setProperty("--hud-panel-local", `url("${hudPanelLocalUrl}")`);
app.style.setProperty("--hud-panel-rival", `url("${hudPanelRivalUrl}")`);
app.style.setProperty("--hud-panel-center", `url("${hudPanelCenterUrl}")`);

const hud = element(document, "header", "arena-hud");
const hudBar = element(document, "div", "arena-hud__bar");
const sideLeft = element(document, "div", "arena-hud__side arena-hud__side--left");
const sideRight = element(document, "div", "arena-hud__side arena-hud__side--right");
const center = element(document, "div", "arena-center");

const brand = element(document, "a", "arena-brand");
brand.href = "/";
brand.setAttribute("aria-label", copy.back);
const brandImg = document.createElement("img");
brandImg.src = brandMarkUrl;
brandImg.alt = "";
brand.append(brandImg, element(document, "span", undefined, "Bomba PvP"));

function createPlayerCard(slot: LocalControlSlot): Readonly<{
  root: HTMLElement;
  wins: HTMLElement;
  bombs: HTMLElement;
  range: HTMLElement;
  status: HTMLElement;
  skill: HTMLElement;
  bombStat: HTMLElement;
  flameStat: HTMLElement;
  competitorId: CompetitorId;
}> {
  const css = slot === "control-a" ? "p1" : "p2";
  const card = element(document, "div", `arena-player-card arena-player-card--${css}`);
  const portraitWrap = element(document, "div", "arena-player-card__portrait");
  const portrait = document.createElement("img");
  portrait.src = CHAMPIONS[slot].portrait;
  portrait.alt = copy.controlName(slot);
  portraitWrap.append(portrait);

  const meta = element(document, "div", "arena-player-card__meta");
  const nameRow = element(document, "div", "arena-player-card__name-row");
  nameRow.append(
    element(document, "span", "arena-player-card__tag", slot === "control-a" ? "P1" : "P2"),
    element(document, "span", "arena-player-card__name", copy.controlName(slot)),
  );
  const stats = element(document, "div", "arena-player-card__stats");
  const bombStat = element(document, "span", "arena-player-card__stat");
  const bombIcon = document.createElement("img");
  bombIcon.src = hudBombIconUrl;
  bombIcon.alt = "";
  const bombs = element(document, "span", undefined, "1/1");
  bombStat.append(bombIcon, bombs);
  const flameStat = element(document, "span", "arena-player-card__stat");
  const flameIcon = document.createElement("img");
  flameIcon.src = hudFlameIconUrl;
  flameIcon.alt = "";
  const range = element(document, "span", undefined, "1");
  flameStat.append(flameIcon, range);
  const status = element(document, "span", "arena-player-card__stat", "");
  const skill = element(document, "span", "arena-player-card__skill", "");
  skill.hidden = true;
  stats.append(bombStat, flameStat, status);
  meta.append(nameRow, stats, skill);

  const wins = element(document, "div", "arena-player-card__wins", "W0");
  if (slot === "control-a") {
    card.append(portraitWrap, meta, wins);
  } else {
    card.append(wins, meta, portraitWrap);
  }
  return {
    root: card,
    wins,
    bombs,
    range,
    status,
    skill,
    bombStat,
    flameStat,
    competitorId: localCompetitorBySlot[slot],
  };
}

const cardA = createPlayerCard("control-a");
const cardB = createPlayerCard("control-b");

/** Brief pulse on the HUD stat that just grew (power-up pickup feedback). */
function pulseHudStat(competitorId: CompetitorId, powerUpType: "bomb-up" | "flame-up"): void {
  const card = competitorId === cardA.competitorId
    ? cardA
    : competitorId === cardB.competitorId
      ? cardB
      : null;
  if (!card) return;
  const target = powerUpType === "bomb-up" ? card.bombStat : card.flameStat;
  target.classList.remove("is-pulsed");
  // Force reflow so the animation restarts on rapid consecutive pickups.
  void target.offsetWidth;
  target.classList.add("is-pulsed");
}
sideLeft.append(brand, cardA.root);
sideRight.append(cardB.root);

const timerShell = element(document, "div", "arena-timer-shell");
const roundLabel = element(document, "div", "arena-timer-shell__round", `${copy.round} 1 · ${copy.firstTo}2`);
const timeValue = element(document, "div", "arena-timer-shell__time", "00:00");
const phaseLabelEl = element(document, "div", "arena-timer-shell__phase", copy.playing);
timerShell.append(roundLabel, timeValue, phaseLabelEl);
center.append(timerShell);
hudBar.append(sideLeft, center, sideRight);
hud.append(hudBar);

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
overlayActions.append(overlayPauseBtn, overlayRestartBtn);
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
actions.append(pauseButton, restartButton);

const devToggle = element(document, "button", "arena-dev-toggle", copy.devShow);
devToggle.type = "button";
devToggle.title = "Toggle diagnostics (?dev=1)";
const p2ModeButton = element(document, "button", "arena-button arena-button--p2", copy.p2ModeLabel(p2Control));
p2ModeButton.type = "button";
p2ModeButton.title = "Toggle P2 human/bot (?p2=bot)";
actions.append(p2ModeButton);

function syncP2ModeButton(): void {
  p2ModeButton.textContent = copy.p2ModeLabel(p2Control);
  p2ModeButton.classList.toggle("is-bot", p2IsBot());
}

p2ModeButton.addEventListener("click", () => {
  // Switching control releases any pressed P2 key and re-seeds the bot so the
  // handoff never leaves a stuck direction or a stale decision stream.
  if (p2IsBot()) {
    if (botMemory.pressed !== null) {
      game.dispatch({ type: "set-movement", competitorId: P2_COMPETITOR_ID, direction: botMemory.pressed, pressed: false });
    }
  } else {
    releaseMovement();
  }
  p2Control = p2IsBot() ? "human" : "bot";
  resetBot();
  syncP2ModeButton();
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
  `${GAME_MECHANICS_VERSION} · local assets only · WASD+Q+Space / arrows+O+I / Esc / T / M`,
);
devPanel.append(devTitle, devMeta, devLog, devNote);

app.append(hud, stage, dock, devPanel);
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

function clearCombatPresentation(): void {
  presentationFx.length = 0;
  crateBreakFx.length = 0;
  chainSparkFx.length = 0;
  blinkTrailFx.length = 0;
  pressureWarnFx.length = 0;
  recentExplosions.length = 0;
  deathAnims.clear();
  bombTilesById.clear();
  bombPlaceFx.clear();
  powerUpRevealFx.clear();
  lastCompetitorPose.clear();
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
    } else if (event.type === "bomb-placed") {
      bombPlaceFx.set(event.bombId, nowMs);
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
        if (recentExplosions.length > 8) recentExplosions.splice(0, recentExplosions.length - 8);
      }
      bombPlaceFx.delete(event.bombId);
      bombTilesById.delete(event.bombId);
    } else if (event.type === "crate-destroyed") {
      crateBreakFx.push({ tile: event.at, startMs: nowMs });
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
  const pack = CHAMPIONS[slot];
  const frames = moving ? pack.walk[facing] : pack.idle[facing];
  if (frames.length === 0) return pack.static[facing];
  const frameMs = moving ? WALK_FRAME_MS : IDLE_FRAME_MS;
  const index = Math.floor(animMs / frameMs) % frames.length;
  return frames[index] ?? pack.static[facing];
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
    // Dissipate tail: fade + shrink through the last FLAME_DISSIPATE_TAIL_MS.
    const tailAlpha = Math.max(0, Math.min(1, flame.remainingMs / FLAME_DISSIPATE_TAIL_MS));
    const alpha = Math.max(0.3, tailAlpha);
    const dissipateScale = 0.9 + tailAlpha * 0.1;
    // Per-tile phase offset so tiles never run the same frame in lockstep.
    const tilePhase = ((flame.tile.x * 31 + flame.tile.y * 17) % 8) * 70;
    const frameIndex = Math.floor((animMs + tilePhase) / 70) % FLAME_ANIM_URLS.length;
    const frameUrl = FLAME_ANIM_URLS[frameIndex]!;
    const centerX = flame.tile.x * TILE_SIZE + TILE_SIZE / 2;
    const centerY = flame.tile.y * TILE_SIZE + TILE_SIZE / 2;
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
  };
  const renderables: Renderable[] = [];

  for (const competitor of snapshot.competitors) {
    if (!competitor.alive) continue;
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
        blinkTrailFx.push({
          from: { x: previousPose.x, y: previousPose.y },
          to: { x: competitor.position.x, y: competitor.position.y },
          startMs: animMs,
        });
      }
    }
    lastCompetitorPose.set(competitor.id, {
      x: competitor.position.x,
      y: competitor.position.y,
      facing,
    });
    let frameUrl: string;
    if (channeling) {
      const pack = CHAMPIONS[slot];
      const frames = pack.cast[facing];
      // Play the cast cycle once from channel start, then hold the last
      // frame — looping the cycle reads as a buggy strobe on long channels.
      const channelElapsedMs = Math.max(
        0,
        RANNI_CHANNEL_MS - (competitor.skill?.channelRemainingMs ?? 0),
      );
      const castIndex = Math.min(frames.length - 1, Math.floor(channelElapsedMs / CAST_FRAME_MS));
      frameUrl = frames[castIndex] ?? pack.static[facing];
    } else {
      frameUrl = championFrameUrl(slot, facing, moving, animMs);
    }
    renderables.push({
      id: competitor.id,
      slot,
      position: competitor.position,
      facing,
      frameUrl,
      alive: true,
      spawnProtectionRemainingMs: competitor.spawnProtectionRemainingMs,
      channeling,
    });
  }

  // Eliminated competitors keep a held-pose death animation until the round resets.
  for (const [id, death] of deathAnims) {
    const slot = slotForCompetitor(id);
    const pack = CHAMPIONS[slot];
    const frames = pack.death[death.facing];
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
    });
  }

  renderables.sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x);

  for (const entry of renderables) {
    const cx = (entry.position.x / UNITS_PER_TILE) * TILE_SIZE;
    const cy = (entry.position.y / UNITS_PER_TILE) * TILE_SIZE;
    // Feet sit on body bottom (body center + half extent), matching product anchor.
    const bodyBottom = cy + (BODY_HALF_EXTENT / UNITS_PER_TILE) * TILE_SIZE;
    const spriteHeight = TILE_SIZE * CHAMPION_HEIGHT_TILES;
    const maxSpriteWidth = TILE_SIZE * CHAMPION_MAX_WIDTH_TILES;
    const identity = entry.slot === "control-a" ? "56, 217, 245" : "255, 120, 50";

    // Soft ground contact shadow under feet.
    context.save();
    context.fillStyle = "rgba(8, 6, 5, 0.34)";
    context.beginPath();
    context.ellipse(cx, bodyBottom - 1, TILE_SIZE * 0.34, TILE_SIZE * 0.14, 0, 0, Math.PI * 2);
    context.fill();
    context.restore();

    // Identity ring: color-coded filled ellipse marking P1/P2 ownership.
    context.save();
    context.fillStyle = `rgb(${identity} / ${entry.alive ? 0.14 : 0.06})`;
    context.beginPath();
    context.ellipse(cx, bodyBottom - 1, TILE_SIZE * 0.42, TILE_SIZE * 0.18, 0, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = `rgb(${identity} / ${entry.alive ? 0.5 : 0.22})`;
    context.lineWidth = 1.5;
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
      // Soft cyan aura while the skill channels.
      context.save();
      context.globalCompositeOperation = "lighter";
      const aura = context.createRadialGradient(cx, cy, 4, cx, cy, TILE_SIZE * 0.7);
      aura.addColorStop(0, "rgba(120, 220, 255, 0.22)");
      aura.addColorStop(1, "rgba(120, 220, 255, 0)");
      context.fillStyle = aura;
      context.fillRect(cx - TILE_SIZE, cy - TILE_SIZE, TILE_SIZE * 2, TILE_SIZE * 2);
      context.restore();
    }

    const image = loadImage(entry.frameUrl);
    if (image.complete && image.naturalWidth > 0) {
      const fullW = image.naturalWidth;
      const fullH = image.naturalHeight;
      const trim = getSpriteTrimBounds(image);
      const srcX = trim?.x ?? 0;
      const srcY = trim?.y ?? 0;
      const srcW = trim?.width ?? fullW;
      const srcH = trim?.height ?? fullH;
      const spriteWidth = Math.min(maxSpriteWidth, spriteHeight * (srcW / srcH));
      const spriteX = cx - spriteWidth * 0.5;
      const spriteY = bodyBottom - spriteHeight + 1;
      context.drawImage(image, srcX, srcY, srcW, srcH, spriteX, spriteY, spriteWidth, spriteHeight);
    } else {
      context.fillStyle = entry.slot === "control-a" ? "#38d9f5" : "#ff5a1f";
      context.beginPath();
      context.arc(cx, cy, TILE_SIZE * 0.28, 0, Math.PI * 2);
      context.fill();
    }

    // Name pill above the head for living players.
    if (entry.alive) {
      const label = `${entry.slot === "control-a" ? "P1" : "P2"} · ${copy.controlName(entry.slot)}`;
      context.save();
      context.font = "600 10px Inter, system-ui, sans-serif";
      const pillWidth = context.measureText(label).width + 14;
      const pillHeight = 15;
      const pillX = cx - pillWidth / 2;
      const pillY = bodyBottom - spriteHeight - pillHeight - 3;
      context.fillStyle = "rgba(10, 12, 18, 0.62)";
      context.beginPath();
      context.roundRect(pillX, pillY, pillWidth, pillHeight, 7);
      context.fill();
      context.fillStyle = `rgb(${identity} / 0.9)`;
      context.fillRect(pillX + 4, pillY + 3, 2, pillHeight - 6);
      context.fillStyle = "rgba(240, 244, 252, 0.92)";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(label, cx + 2, pillY + pillHeight / 2 + 0.5);
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

  // Winner portrait on outcome overlays; hidden otherwise.
  const overlayWinner = snapshot.phase === "round-over"
    ? snapshot.outcome?.winner ?? null
    : snapshot.phase === "match-over"
      ? snapshot.matchWinner
      : null;
  if (overlayWinner) {
    overlayPortrait.src = CHAMPIONS[slotForCompetitor(overlayWinner)].portrait;
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
    if (snapshot.matchWinner) {
      overlayTitle.textContent = copy.matchWinner(displayName(snapshot.matchWinner, copy));
    } else {
      overlayTitle.textContent = copy.matchOver;
    }
    overlaySub.textContent = `${copy.firstTo}${snapshot.targetRoundWins}`;
    return;
  }
}

function renderHud(snapshot: GameSnapshot): void {
  const displayMs = timerDisplayMs(snapshot);
  if (snapshot.phase === "sudden-death") {
    timeValue.textContent = formatTime(displayMs);
    timerShell.classList.add("is-sudden-death");
  } else {
    timeValue.textContent = formatTime(displayMs);
    timerShell.classList.remove("is-sudden-death");
  }
  phaseLabelEl.textContent = phaseLabel(snapshot);
  roundLabel.textContent =
    `${copy.round} ${snapshot.roundNumber} · ${copy.firstTo}${snapshot.targetRoundWins}`;

  pauseButton.textContent = snapshot.phase === "paused" ? copy.resume : copy.pause;
  pauseButton.disabled =
    snapshot.phase === "round-over" || snapshot.phase === "match-over";

  for (const card of [cardA, cardB]) {
    const competitor = snapshot.competitors.find((entry) => entry.id === card.competitorId);
    if (!competitor) continue;
    card.root.classList.toggle("is-eliminated", !competitor.alive);
    card.wins.textContent = `W${scoreFor(snapshot, competitor.id)}`;
    card.bombs.textContent = `${Math.max(0, competitor.maxBombs - competitor.activeBombs)}/${competitor.maxBombs}`;
    card.range.textContent = String(competitor.flameRange);
    card.status.textContent = !competitor.alive
      ? "×"
      : competitor.spawnProtectionRemainingMs > 0
        ? copy.protected
        : "";
    card.skill.hidden = competitor.skill === undefined;
    if (competitor.skill) {
      card.skill.classList.toggle("is-channeling", competitor.skill.phase === "channeling");
      card.skill.classList.toggle("is-cooldown", competitor.skill.phase === "cooldown");
      card.skill.textContent = competitor.skill.phase === "idle"
        ? copy.skillReady
        : competitor.skill.phase === "channeling"
          ? copy.skillChanneling
          : copy.skillCooldown(competitor.skill.cooldownRemainingMs / 1_000);
    }
  }

  if (devOpen) {
    devMeta.textContent =
      `tick=${snapshot.revision} phase=${snapshot.phase} R${snapshot.roundNumber} `
      + `K=${snapshot.targetRoundWins} bombs=${snapshot.bombs.length} flames=${snapshot.flames.length} `
      + `powerups=${snapshot.powerUps.length} pressure=${snapshot.pressure.closing ? "closing" : "—"}`;
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

  renderCanvas(snapshot, animMs);
  renderHud(snapshot);
  renderSuddenDeathBanner(snapshot, animMs);
  renderOverlay(snapshot);

  boardSummary.textContent =
    `${phaseLabel(snapshot)}. ${copy.round} ${snapshot.roundNumber}. `
    + `${copy.controlName("control-a")} ${scoreFor(snapshot, localCompetitorBySlot["control-a"])} – `
    + `${scoreFor(snapshot, localCompetitorBySlot["control-b"])} ${copy.controlName("control-b")}. `
    + `${formatTime(timerDisplayMs(snapshot))}.`;
}

function dispatchAndRender(command: Parameters<typeof game.dispatch>[0]): readonly GameEvent[] {
  // A restart re-seeds the bot so a fresh session replays the same bot stream.
  if (command.type === "restart") resetBot();
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
  const movement = MOVEMENT_BINDINGS[event.code];
  if (movement) {
    event.preventDefault();
    // Gate movement to playable phases only — paused keys must not enqueue.
    if (!acceptsGameplayInput()) return;
    // While the bot drives P2, ignore the human P2 movement keys entirely.
    if (p2IsBot() && movement.competitorId === P2_COMPETITOR_ID) return;
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
    // While the bot drives P2, ignore the human P2 bomb key.
    if (p2IsBot() && competitorId === P2_COMPETITOR_ID) return;
    dispatchAndRender({ type: "place-bomb", competitorId });
    return;
  }
  if (event.code === "Space" || event.code === "KeyI" || event.code === "KeyE" || event.code === "KeyP") {
    event.preventDefault();
    if (!acceptsGameplayInput()) return;
    // Product bindings: P1 Space, P2 KeyI. E/P kept as legacy alternates.
    const competitorId = event.code === "Space" || event.code === "KeyE"
      ? localCompetitorBySlot["control-a"]
      : localCompetitorBySlot["control-b"];
    if (p2IsBot() && competitorId === P2_COMPETITOR_ID) return;
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
 * Run one bot decision and dispatch its ordinary commands, immediately before a
 * kernel tick advances. Deterministic: same snapshot + seed + memory yields the
 * same commands. No-op unless P2 is bot-controlled and play is live.
 */
function dispatchBotCommandsForTick(): void {
  if (!p2IsBot()) return;
  const snapshot = game.snapshot();
  if (snapshot.phase !== "playing" && snapshot.phase !== "sudden-death") return;
  const commands = driveBot(snapshot, P2_SEAT_ID, P2_COMPETITOR_ID, botPrng, botMemory);
  for (const command of commands) game.dispatch(command);
}

function frame(nowMs: number): void {
  accumulatorMs += Math.min(MAX_FRAME_DELTA_MS, Math.max(0, nowMs - previousFrameMs));
  previousFrameMs = nowMs;
  const events: GameEvent[] = [];
  while (accumulatorMs >= TICK_DURATION_MS) {
    dispatchBotCommandsForTick();
    events.push(...game.dispatch({ type: "advance", deltaMs: TICK_DURATION_MS }));
    accumulatorMs -= TICK_DURATION_MS;
  }
  if (events.length > 0) appendEvents(events);
  render(game.snapshot(), nowMs);
  animationFrame = window.requestAnimationFrame(frame);
}

window.get_game_mechanics_snapshot = () => game.snapshot();
window.advance_game_mechanics = (milliseconds: number) => {
  const events: GameEvent[] = [];
  let remaining = Math.max(0, milliseconds);
  while (remaining >= TICK_DURATION_MS) {
    dispatchBotCommandsForTick();
    events.push(...game.dispatch({ type: "advance", deltaMs: TICK_DURATION_MS }));
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
}, { once: true });

preloadAll();
preloadSounds();
initSoundUnlock(window);
updateDevOpen();
syncP2ModeButton();
renderLog();
render();
animationFrame = window.requestAnimationFrame(frame);
