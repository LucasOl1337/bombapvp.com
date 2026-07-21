import type {
  ChampionAnimationContext,
  ChampionAnimationResult,
  ChampionVisualAdapter,
} from "../visual-contracts";
import {
  isMadaraFireballEffect,
  type ChampionWorldEffect,
} from "../world-effects";
import type { MadaraFireballEffect } from "./contracts";
import {
  MADARA_CAST_FRAME_MS,
  MADARA_FIREBALL_VISUAL_MS,
} from "./skill";
import { MADARA_SKILL_ID } from "./identity";

export function resolveMadaraAnimation(
  c: ChampionAnimationContext,
): ChampionAnimationResult | null {
  if (c.player.skill.phase !== "channeling") {
    return null;
  }
  const exact = c.cycles.cast[c.direction] ?? [];
  const frames = exact.length ? exact : c.castFrames;
  return frames.length
    ? { frames, frameMs: MADARA_CAST_FRAME_MS, playback: "hold" }
    : null;
}

/** Draw a fireball traveling from origin to detonation. */
export function drawMadaraFireball(
  ctx: CanvasRenderingContext2D,
  effect: MadaraFireballEffect,
  tileSize: number,
): void {
  const progress = 1 - Math.max(0, Math.min(1, effect.remainingMs / MADARA_FIREBALL_VISUAL_MS));
  const { origin, detonation, direction } = effect;

  // Interpolate visual position along the straight line.
  const sx = origin.x * tileSize + tileSize * 0.5;
  const sy = origin.y * tileSize + tileSize * 0.5;
  const ex = detonation.x * tileSize + tileSize * 0.5;
  const ey = detonation.y * tileSize + tileSize * 0.5;
  const cx = sx + (ex - sx) * progress;
  const cy = sy + (ey - sy) * progress;

  // Fireball body.
  const r = tileSize * (0.18 + Math.sin(progress * Math.PI) * 0.06);
  const grad = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r);
  grad.addColorStop(0, "rgba(255, 255, 200, 0.95)");
  grad.addColorStop(0.4, "rgba(255, 120, 20, 0.9)");
  grad.addColorStop(1, "rgba(180, 30, 10, 0.4)");

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  // Directional tail.
  const tailLen = tileSize * 0.45;
  const tailDx = direction === "left" ? tailLen : direction === "right" ? -tailLen : 0;
  const tailDy = direction === "up" ? tailLen : direction === "down" ? -tailLen : 0;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + tailDx, cy + tailDy);
  ctx.strokeStyle = "rgba(255, 80, 10, 0.5)";
  ctx.lineWidth = tileSize * 0.12;
  ctx.lineCap = "round";
  ctx.stroke();
  ctx.restore();

  // Detonation flash near the end.
  if (progress > 0.85) {
    const flash = (progress - 0.85) / 0.15;
    ctx.save();
    ctx.beginPath();
    ctx.arc(ex, ey, tileSize * (0.2 + flash * 0.4), 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 140, 20, ${0.6 * (1 - flash)})`;
    ctx.fill();
    ctx.restore();
  }
}

export function advanceMadaraWorldEffects(
  effects: readonly ChampionWorldEffect[],
  deltaMs: number,
): ChampionWorldEffect[] {
  return effects
    .map((effect) => {
      if (!isMadaraFireballEffect(effect)) {
        return effect;
      }
      return { ...effect, remainingMs: effect.remainingMs - deltaMs };
    })
    .filter((effect) => {
      if (isMadaraFireballEffect(effect)) {
        return effect.remainingMs > 0;
      }
      return true;
    });
}

export const MADARA_VISUAL_ADAPTER: ChampionVisualAdapter = {
  skillId: MADARA_SKILL_ID,
  resolveAnimation: resolveMadaraAnimation,
  advanceWorldEffects: advanceMadaraWorldEffects,
  getHudStatus: (player, language) => {
    if (player.skill.phase === "channeling") {
      return {
        label: language === "pt" ? "KATON" : "FIREBALL",
        tone: "success",
        critical: false,
        dangerEtaMs: null,
      };
    }
    return null;
  },
  drawWorldEffect: (ctx, effect, tileSize) => {
    if (isMadaraFireballEffect(effect)) {
      drawMadaraFireball(ctx, effect, tileSize);
    }
  },
};

export function createChampionVisualAdapter(): ChampionVisualAdapter {
  return MADARA_VISUAL_ADAPTER;
}
