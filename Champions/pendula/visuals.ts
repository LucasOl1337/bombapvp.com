import type {
  ChampionAnimationContext,
  ChampionAnimationResult,
  ChampionVisualAdapter,
} from "../visual-contracts";
import {
  isPendulaPullEffect,
  type ChampionWorldEffect,
} from "../world-effects";
import type { PendulaPullEffect } from "./contracts";
import {
  PENDULA_SKILL_CHANNEL_MS,
  PENDULA_PULL_VISUAL_MS,
} from "./skill";
import { PENDULA_SKILL_ID } from "./definition";

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

/** Inward-sucking brass/cyan rings (Orianna-style Command: Pull). */
export function drawPendulaPull(
  ctx: CanvasRenderingContext2D,
  effect: PendulaPullEffect,
  tileSize: number,
): void {
  const progress = 1 - Math.max(0, Math.min(1, effect.remainingMs / PENDULA_PULL_VISUAL_MS));
  const cx = effect.origin.x * tileSize + tileSize * 0.5;
  const cy = effect.origin.y * tileSize + tileSize * 0.5;
  // Rings collapse inward toward Pendula.
  const outer =
    tileSize * (effect.maxRadiusTiles + 0.55) * (1 - progress * 0.85);
  const inner = Math.max(tileSize * 0.25, outer * 0.55);
  const alpha = 0.6 * (1 - progress);
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, outer, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(120, 220, 255, ${alpha})`;
  ctx.lineWidth = 3 + (1 - progress) * 3;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, inner, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(212, 175, 55, ${alpha * 0.85})`;
  ctx.lineWidth = 2;
  ctx.stroke();
  // Small core pulse at center
  ctx.beginPath();
  ctx.arc(cx, cy, tileSize * (0.18 + progress * 0.12), 0, Math.PI * 2);
  ctx.fillStyle = `rgba(120, 220, 255, ${0.35 * (1 - progress)})`;
  ctx.fill();
  ctx.restore();
}

export function advancePendulaWorldEffects(
  effects: readonly ChampionWorldEffect[],
  deltaMs: number,
): ChampionWorldEffect[] {
  return effects
    .map((effect) => {
      if (!isPendulaPullEffect(effect)) {
        return effect;
      }
      return {
        ...effect,
        remainingMs: effect.remainingMs - deltaMs,
      };
    })
    .filter(
      (effect) =>
        !isPendulaPullEffect(effect) || effect.remainingMs > 0,
    );
}

export const PENDULA_VISUAL_ADAPTER: ChampionVisualAdapter = {
  skillId: PENDULA_SKILL_ID,
  resolveAnimation: resolvePendulaAnimation,
  advanceWorldEffects: advancePendulaWorldEffects,
  getHudStatus: (player, language) => {
    if (player.skill.phase !== "channeling" && player.skill.phase !== "releasing") {
      return null;
    }
    const sec = Math.max(0, player.skill.channelRemainingMs / 1000).toFixed(1);
    return {
      label: language === "pt" ? `PULL ${sec}s` : `PULL ${sec}s`,
      tone: "success",
      critical: false,
      dangerEtaMs: null,
    };
  },
  drawWorldEffect: (ctx, effect, tileSize) => {
    if (isPendulaPullEffect(effect)) {
      drawPendulaPull(ctx, effect, tileSize);
    }
  },
};
export function createChampionVisualAdapter(): ChampionVisualAdapter {
  return PENDULA_VISUAL_ADAPTER;
}
