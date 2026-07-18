import type {
  ChampionAnimationContext,
  ChampionAnimationResult,
  ChampionVisualAdapter,
} from "../visual-contracts";
import type { ChampionWorldEffect } from "../world-effects";
import { isZephyrGaleEffect } from "../world-effects";
import type { ZephyrGaleEffect } from "./contracts";
import { ZEPHYR_SKILL_CHANNEL_MS, ZEPHYR_GALE_VISUAL_MS } from "./skill";
import { ZEPHYR_SKILL_ID } from "./definition";

export function resolveZephyrAnimation(
  ctx: ChampionAnimationContext,
): ChampionAnimationResult | null {
  if (
    ctx.player.skill.phase !== "channeling" &&
    ctx.player.skill.phase !== "releasing"
  ) {
    return null;
  }
  const exact = ctx.cycles.cast[ctx.direction] ?? [];
  const frames = exact.length
    ? exact
    : ctx.runFrames.length
      ? ctx.runFrames
      : ctx.attackFrames;
  if (!frames.length) return null;
  const frameMs = Math.max(
    40,
    Math.floor(ZEPHYR_SKILL_CHANNEL_MS / Math.max(1, frames.length)),
  );
  return { frames, frameMs, playback: "hold" };
}

export function drawZephyrGale(
  ctx: CanvasRenderingContext2D,
  effect: ZephyrGaleEffect,
  tileSize: number,
): void {
  const progress =
    1 - Math.max(0, Math.min(1, effect.remainingMs / ZEPHYR_GALE_VISUAL_MS));
  const cx = effect.origin.x * tileSize + tileSize * 0.5;
  const cy = effect.origin.y * tileSize + tileSize * 0.5;
  const radius =
    tileSize * (0.3 + progress * (effect.maxRadiusTiles + 0.5));
  const alpha = 0.6 * (1 - progress);
  ctx.save();
  for (let ring = 0; ring < 3; ring += 1) {
    const r = radius * (0.55 + ring * 0.22);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(140, 230, 170, ${alpha * (1 - ring * 0.25)})`;
    ctx.lineWidth = 2.5 - ring * 0.4;
    ctx.stroke();
  }
  // Swirl ticks
  for (let i = 0; i < 8; i += 1) {
    const ang = (i / 8) * Math.PI * 2 + progress * 4;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(ang) * radius * 0.35, cy + Math.sin(ang) * radius * 0.35);
    ctx.lineTo(cx + Math.cos(ang) * radius, cy + Math.sin(ang) * radius);
    ctx.strokeStyle = `rgba(220, 255, 230, ${alpha * 0.7})`;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  ctx.restore();
}

export function advanceZephyrWorldEffects(
  effects: readonly ChampionWorldEffect[],
  deltaMs: number,
): ChampionWorldEffect[] {
  return effects
    .map((effect) => {
      if (!isZephyrGaleEffect(effect)) return effect;
      return { ...effect, remainingMs: effect.remainingMs - deltaMs };
    })
    .filter((effect) => !isZephyrGaleEffect(effect) || effect.remainingMs > 0);
}

export const ZEPHYR_VISUAL_ADAPTER: ChampionVisualAdapter = {
  skillId: ZEPHYR_SKILL_ID,
  resolveAnimation: resolveZephyrAnimation,
  advanceWorldEffects: advanceZephyrWorldEffects,
  getHudStatus: (player, language) => {
    if (player.skill.phase !== "channeling") return null;
    const sec = Math.max(0, player.skill.channelRemainingMs / 1000).toFixed(1);
    return {
      label: language === "pt" ? `VENTO ${sec}s` : `GALE ${sec}s`,
      tone: "success",
      critical: false,
      dangerEtaMs: null,
    };
  },
  drawWorldEffect: (ctx, effect, tileSize) => {
    if (isZephyrGaleEffect(effect)) drawZephyrGale(ctx, effect, tileSize);
  },
};
export function createChampionVisualAdapter(): ChampionVisualAdapter {
  return ZEPHYR_VISUAL_ADAPTER;
}
