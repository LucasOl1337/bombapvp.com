import type { CharacterSkillId } from "./contracts";
import type {
  ArenaState,
  Direction,
  PixelCoord,
  PlayerId,
  PlayerState,
  TileCoord,
} from "../src/original-game/Gameplay/types";
import type { SkillContext } from "../src/original-game/ultimate/shared";
import type { ChampionWorldEffect } from "./world-effects";

export type ChampionHudStatus = {
  label: string;
  tone: "muted" | "danger" | "success";
  critical: boolean;
  dangerEtaMs: number | null;
};

export type SkillChannelUpdate = (
  player: PlayerState,
  direction: Direction | null,
  pressed: boolean,
  held: boolean,
  deltaMs: number,
) => boolean;
export type ChampionAnimationResult = {
  frames: HTMLImageElement[];
  frameMs: number;
  playback: "loop" | "hold";
};
export type ChampionAnimationContext = {
  player: PlayerState;
  direction: Direction;
  cycles: {
    idle: Record<Direction, HTMLImageElement[]>;
    walk: Record<Direction, HTMLImageElement[]>;
    cast: Record<Direction, HTMLImageElement[]>;
  };
  castFrames: HTMLImageElement[];
  runFrames: HTMLImageElement[];
  attackFrames: HTMLImageElement[];
  skillFrameMs: number;
};
export type ChampionPresentationContext = {
  ctx: CanvasRenderingContext2D;
  player: PlayerState;
  arena: Pick<ArenaState, "solid" | "config">;
  getTile: (position: PixelCoord) => TileCoord;
  createSkillContext: () => SkillContext;
  tileSize: number;
  clockMs: number;
  reducedMotion: boolean;
  language: "pt" | "en";
};

export interface ChampionVisualAdapter {
  readonly skillId: CharacterSkillId;
  resolveAnimation(
    context: ChampionAnimationContext,
  ): ChampionAnimationResult | null;
  updateSkillChannel?: (
    player: PlayerState,
    direction: Direction | null,
    pressed: boolean,
    held: boolean,
    deltaMs: number,
    update: SkillChannelUpdate,
  ) => boolean;
  advance?: (deltaMs: number, playerIds: readonly PlayerId[]) => void;
  reset?: () => void;
  getHudStatus?: (
    player: PlayerState,
    language: "pt" | "en",
  ) => ChampionHudStatus | null;
  drawPresentation?: (context: ChampionPresentationContext) => void;
  advanceWorldEffects?: (
    effects: readonly ChampionWorldEffect[],
    deltaMs: number,
  ) => ChampionWorldEffect[];
  drawWorldEffect?: (
    ctx: CanvasRenderingContext2D,
    effect: ChampionWorldEffect,
    tileSize: number,
  ) => void;
}

export interface ChampionVisualRuntime {
  resolveAnimation(
    context: ChampionAnimationContext,
  ): ChampionAnimationResult | null;
  updateSkillChannel(
    player: PlayerState,
    direction: Direction | null,
    pressed: boolean,
    held: boolean,
    deltaMs: number,
    update: SkillChannelUpdate,
  ): boolean;
  advance(deltaMs: number, playerIds: readonly PlayerId[]): void;
  reset(): void;
  getHudStatus(
    player: PlayerState,
    language: "pt" | "en",
  ): ChampionHudStatus | null;
  advanceWorldEffects(
    effects: readonly ChampionWorldEffect[],
    deltaMs: number,
  ): ChampionWorldEffect[];
  drawWorldEffect(
    ctx: CanvasRenderingContext2D,
    effect: ChampionWorldEffect,
    tileSize: number,
  ): void;
  drawSkillPresentation(context: ChampionPresentationContext): void;
}
