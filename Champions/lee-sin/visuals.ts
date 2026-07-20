import type {
  ChampionAnimationContext,
  ChampionAnimationResult,
  ChampionVisualAdapter,
} from "../visual-contracts";
import {
  isLeeSinDragonRageEffect,
  type ChampionWorldEffect,
} from "../world-effects";
import type { LeeSinDragonRageEffect } from "./contracts";
import {
  LEE_SIN_DASH_FRAME_MS,
  LEE_SIN_KICK_VISUAL_MS,
} from "./skill";
import { LEE_SIN_SKILL_ID } from "./identity";

export function resolveLeeSinAnimation(
  c: ChampionAnimationContext,
): ChampionAnimationResult | null {
  if (c.player.skill.phase !== "channeling") {
    return null;
  }
  const exact = c.cycles.cast[c.direction] ?? [];
  const frames = exact.length
    ? exact
    : c.runFrames.length
      ? c.runFrames
      : c.attackFrames;
  return frames.length
    ? { frames, frameMs: LEE_SIN_DASH_FRAME_MS, playback: "loop" }
    : null;
}

/** Golden sonic wave along the kick ray (Lee Sin Q/R energy). */
export function drawLeeSinDragonRage(
  ctx: CanvasRenderingContext2D,
  effect: LeeSinDragonRageEffect,
  tileSize: number,
): void {
  const progress = 1 - Math.max(0, Math.min(1, effect.remainingMs / LEE_SIN_KICK_VISUAL_MS));
  const ox = effect.origin.x * tileSize + tileSize * 0.5;
  const oy = effect.origin.y * tileSize + tileSize * 0.5;
  const reach = tileSize * effect.maxDistanceTiles * (0.35 + progress * 0.65);
  const ex = ox + effect.direction.x * reach;
  const ey = oy + effect.direction.y * reach;
  const alpha = 0.7 * (1 - progress);
  ctx.save();
  ctx.strokeStyle = `rgba(255, 210, 70, ${alpha})`;
  ctx.lineWidth = 4 + (1 - progress) * 4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(ox, oy);
  ctx.lineTo(ex, ey);
  ctx.stroke();
  // Sonic rings expanding along the ray
  for (let i = 0; i < 3; i += 1) {
    const t = (progress + i * 0.22) % 1;
    const cx = ox + effect.direction.x * reach * t;
    const cy = oy + effect.direction.y * reach * t;
    const r = tileSize * (0.2 + t * 0.45);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255, 240, 160, ${alpha * (1 - t)})`;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  if (effect.hit) {
    ctx.beginPath();
    ctx.arc(ex, ey, tileSize * (0.35 + progress * 0.2), 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 80, 40, ${0.35 * (1 - progress)})`;
    ctx.fill();
  }
  ctx.restore();
}

export function advanceLeeSinWorldEffects(
  effects: readonly ChampionWorldEffect[],
  deltaMs: number,
): ChampionWorldEffect[] {
  return effects
    .map((effect) => {
      if (!isLeeSinDragonRageEffect(effect)) {
        return effect;
      }
      return {
        ...effect,
        remainingMs: effect.remainingMs - deltaMs,
      };
    })
    .filter(
      (effect) =>
        !isLeeSinDragonRageEffect(effect) || effect.remainingMs > 0,
    );
}

export const LEE_SIN_VISUAL_ADAPTER: ChampionVisualAdapter = {
  skillId: LEE_SIN_SKILL_ID,
  resolveAnimation: resolveLeeSinAnimation,
  advanceWorldEffects: advanceLeeSinWorldEffects,
  getHudStatus: (player, language) => {
    if (player.skill.phase !== "channeling") {
      return null;
    }
    const sec = Math.max(0, player.skill.channelRemainingMs / 1000).toFixed(1);
    return {
      label: language === "pt" ? `CHUTE ${sec}s` : `KICK ${sec}s`,
      tone: "success",
      critical: false,
      dangerEtaMs: null,
    };
  },
  drawWorldEffect: (ctx, effect, tileSize) => {
    if (isLeeSinDragonRageEffect(effect)) {
      drawLeeSinDragonRage(ctx, effect, tileSize);
    }
  },
};
export function createChampionVisualAdapter(): ChampionVisualAdapter {
  return LEE_SIN_VISUAL_ADAPTER;
}
