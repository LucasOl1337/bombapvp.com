import type {
  ChampionAnimationContext,
  ChampionAnimationResult,
  ChampionVisualAdapter,
} from "../visual-contracts";
import type { ChampionWorldEffect } from "../world-effects";
import { isMirelleTideSwapEffect } from "../world-effects";
import type { MirelleTideSwapEffect } from "./contracts";
import {
  MIRELLE_SKILL_CHANNEL_MS,
  MIRELLE_SWAP_VISUAL_MS,
} from "./skill";
import { MIRELLE_SKILL_ID } from "./definition";

export function resolveMirelleAnimation(
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
  // Spread cast frames across the short channel for a readable tide wind-up.
  const frameMs = Math.max(
    40,
    Math.floor(MIRELLE_SKILL_CHANNEL_MS / Math.max(1, frames.length)),
  );
  return { frames, frameMs, playback: "hold" };
}

/** Aqua/cyan ribbon between the two swap anchors. */
export function drawMirelleTideSwap(
  ctx: CanvasRenderingContext2D,
  effect: MirelleTideSwapEffect,
  tileSize: number,
): void {
  const progress =
    1 -
    Math.max(0, Math.min(1, effect.remainingMs / MIRELLE_SWAP_VISUAL_MS));
  const alpha = 0.75 * (1 - progress);
  const midX = (effect.from.x + effect.to.x) * 0.5;
  const midY = (effect.from.y + effect.to.y) * 0.5;
  const dx = effect.to.x - effect.from.x;
  const dy = effect.to.y - effect.from.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const wave = Math.sin(progress * Math.PI * 3) * tileSize * 0.18;

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Outer tide glow
  ctx.beginPath();
  ctx.moveTo(effect.from.x, effect.from.y);
  ctx.quadraticCurveTo(
    midX + nx * wave,
    midY + ny * wave,
    effect.to.x,
    effect.to.y,
  );
  ctx.strokeStyle = `rgba(80, 200, 255, ${alpha * 0.55})`;
  ctx.lineWidth = 6 + (1 - progress) * 4;
  ctx.stroke();

  // Core ribbon
  ctx.beginPath();
  ctx.moveTo(effect.from.x, effect.from.y);
  ctx.quadraticCurveTo(
    midX - nx * wave * 0.6,
    midY - ny * wave * 0.6,
    effect.to.x,
    effect.to.y,
  );
  ctx.strokeStyle = `rgba(180, 240, 255, ${alpha})`;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // End portals
  for (const p of [effect.from, effect.to]) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, tileSize * (0.22 + progress * 0.12), 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(120, 220, 255, ${alpha})`;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(p.x, p.y, tileSize * 0.1, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(200, 250, 255, ${alpha * 0.5})`;
    ctx.fill();
  }
  ctx.restore();
}

export function advanceMirelleWorldEffects(
  effects: readonly ChampionWorldEffect[],
  deltaMs: number,
): ChampionWorldEffect[] {
  return effects
    .map((effect) => {
      if (!isMirelleTideSwapEffect(effect)) return effect;
      return { ...effect, remainingMs: effect.remainingMs - deltaMs };
    })
    .filter(
      (effect) =>
        !isMirelleTideSwapEffect(effect) || effect.remainingMs > 0,
    );
}

export const MIRELLE_VISUAL_ADAPTER: ChampionVisualAdapter = {
  skillId: MIRELLE_SKILL_ID,
  resolveAnimation: resolveMirelleAnimation,
  advanceWorldEffects: advanceMirelleWorldEffects,
  getHudStatus: (player, language) => {
    if (player.skill.phase !== "channeling") return null;
    const sec = Math.max(0, player.skill.channelRemainingMs / 1000).toFixed(1);
    return {
      label: language === "pt" ? `MARÉ ${sec}s` : `TIDE ${sec}s`,
      tone: "success",
      critical: false,
      dangerEtaMs: null,
    };
  },
  drawWorldEffect: (ctx, effect, tileSize) => {
    if (isMirelleTideSwapEffect(effect)) {
      drawMirelleTideSwap(ctx, effect, tileSize);
    }
  },
};
export function createChampionVisualAdapter(): ChampionVisualAdapter {
  return MIRELLE_VISUAL_ADAPTER;
}
