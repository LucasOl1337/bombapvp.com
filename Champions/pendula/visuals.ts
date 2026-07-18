import type {
  ChampionAnimationContext,
  ChampionAnimationResult,
  ChampionVisualAdapter,
} from "../visual-contracts";
import type { ChampionWorldEffect } from "../world-effects";
import type { PendulaShockwaveEffect } from "./contracts";
import {
  PENDULA_SKILL_CHANNEL_MS,
  PENDULA_SHOCKWAVE_VISUAL_MS,
} from "./skill";
import { PENDULA_SKILL_ID } from "./definition";

function isPendulaShockwave(
  effect: ChampionWorldEffect,
): effect is PendulaShockwaveEffect {
  return (
    typeof effect === "object" &&
    effect !== null &&
    "kind" in effect &&
    (effect as PendulaShockwaveEffect).kind === "pendula-shockwave"
  );
}

export function resolvePendulaAnimation(
  c: ChampionAnimationContext,
): ChampionAnimationResult | null {
  if (c.player.skill.phase !== "channeling") {
    return null;
  }
  const exact = c.cycles.cast[c.direction] ?? [];
  const fallback = c.runFrames.length
    ? c.runFrames
    : (c.cycles.idle[c.direction] ?? []);
  const frames = exact.length ? exact : fallback;
  if (!frames.length) {
    return null;
  }
  return {
    frames,
    frameMs: Math.max(
      c.skillFrameMs,
      Math.floor(PENDULA_SKILL_CHANNEL_MS / frames.length),
    ),
    playback: "hold",
  };
}

export function drawPendulaShockwave(
  ctx: CanvasRenderingContext2D,
  effect: PendulaShockwaveEffect,
  tileSize: number,
): void {
  const progress = 1 - Math.max(0, Math.min(1, effect.remainingMs / PENDULA_SHOCKWAVE_VISUAL_MS));
  const cx = effect.origin.x * tileSize + tileSize * 0.5;
  const cy = effect.origin.y * tileSize + tileSize * 0.5;
  const radius =
    tileSize * (0.35 + progress * (effect.maxRadiusTiles + 0.35));
  const alpha = 0.55 * (1 - progress);
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(212, 175, 55, ${alpha})`;
  ctx.lineWidth = 3 + (1 - progress) * 4;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.72, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(120, 220, 255, ${alpha * 0.75})`;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

export function advancePendulaWorldEffects(
  effects: readonly ChampionWorldEffect[],
  deltaMs: number,
): ChampionWorldEffect[] {
  return effects
    .map((effect) => {
      if (!isPendulaShockwave(effect)) {
        return effect;
      }
      return {
        ...effect,
        remainingMs: effect.remainingMs - deltaMs,
      };
    })
    .filter(
      (effect) =>
        !isPendulaShockwave(effect) || effect.remainingMs > 0,
    );
}

export const PENDULA_VISUAL_ADAPTER: ChampionVisualAdapter = {
  skillId: PENDULA_SKILL_ID,
  resolveAnimation: resolvePendulaAnimation,
  advanceWorldEffects: advancePendulaWorldEffects,
  drawWorldEffect: (ctx, effect, tileSize) => {
    if (isPendulaShockwave(effect)) {
      drawPendulaShockwave(ctx, effect, tileSize);
    }
  },
};
