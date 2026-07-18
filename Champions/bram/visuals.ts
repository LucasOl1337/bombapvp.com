import type {
  ChampionAnimationContext,
  ChampionAnimationResult,
  ChampionVisualAdapter,
} from "../visual-contracts";
import type { ChampionWorldEffect } from "../world-effects";
import { isBramSeismicEffect } from "../world-effects";
import type { BramSeismicEffect } from "./contracts";
import { BRAM_SKILL_CHANNEL_MS, BRAM_SEISMIC_VISUAL_MS } from "./skill";
import { BRAM_SKILL_ID } from "./definition";

export function resolveBramAnimation(
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
    Math.floor(BRAM_SKILL_CHANNEL_MS / Math.max(1, frames.length)),
  );
  return { frames, frameMs, playback: "hold" };
}

export function drawBramSeismic(
  ctx: CanvasRenderingContext2D,
  effect: BramSeismicEffect,
  tileSize: number,
): void {
  const progress =
    1 - Math.max(0, Math.min(1, effect.remainingMs / BRAM_SEISMIC_VISUAL_MS));
  const cx = effect.origin.x * tileSize + tileSize * 0.5;
  const cy = effect.origin.y * tileSize + tileSize * 0.5;
  const radius =
    tileSize * (0.35 + progress * (effect.maxRadiusTiles + 0.4));
  const alpha = 0.65 * (1 - progress);
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(180, 130, 60, ${alpha})`;
  ctx.lineWidth = 4 + (1 - progress) * 3;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.62, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(90, 70, 40, ${alpha * 0.8})`;
  ctx.lineWidth = 2;
  ctx.stroke();
  // Radial cracks
  for (let i = 0; i < 6; i += 1) {
    const ang = (i / 6) * Math.PI * 2 + progress;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(
      cx + Math.cos(ang) * radius * 0.95,
      cy + Math.sin(ang) * radius * 0.95,
    );
    ctx.strokeStyle = `rgba(60, 40, 20, ${alpha * 0.7})`;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  ctx.restore();
}

export function advanceBramWorldEffects(
  effects: readonly ChampionWorldEffect[],
  deltaMs: number,
): ChampionWorldEffect[] {
  return effects
    .map((effect) => {
      if (!isBramSeismicEffect(effect)) return effect;
      return { ...effect, remainingMs: effect.remainingMs - deltaMs };
    })
    .filter((effect) => !isBramSeismicEffect(effect) || effect.remainingMs > 0);
}

export const BRAM_VISUAL_ADAPTER: ChampionVisualAdapter = {
  skillId: BRAM_SKILL_ID,
  resolveAnimation: resolveBramAnimation,
  advanceWorldEffects: advanceBramWorldEffects,
  getHudStatus: (player, language) => {
    if (player.skill.phase !== "channeling") return null;
    const sec = Math.max(0, player.skill.channelRemainingMs / 1000).toFixed(1);
    return {
      label: language === "pt" ? `SÍSMO ${sec}s` : `STOMP ${sec}s`,
      tone: "success",
      critical: false,
      dangerEtaMs: null,
    };
  },
  drawWorldEffect: (ctx, effect, tileSize) => {
    if (isBramSeismicEffect(effect)) drawBramSeismic(ctx, effect, tileSize);
  },
};
export function createChampionVisualAdapter(): ChampionVisualAdapter {
  return BRAM_VISUAL_ADAPTER;
}
