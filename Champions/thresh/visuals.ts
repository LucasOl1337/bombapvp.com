import type {
  ChampionAnimationContext,
  ChampionAnimationResult,
  ChampionVisualAdapter,
} from "../visual-contracts";
import {
  isThreshDeathSentenceEffect,
  type ChampionWorldEffect,
} from "../world-effects";
import type { ThreshDeathSentenceEffect } from "./contracts";
import {
  THRESH_HOOK_FRAME_MS,
  THRESH_HOOK_VISUAL_MS,
} from "./skill";
import { THRESH_SKILL_ID } from "./identity";

export function resolveThreshAnimation(
  c: ChampionAnimationContext,
): ChampionAnimationResult | null {
  if (c.player.skill.phase !== "channeling") {
    return null;
  }
  const exact = c.cycles.cast[c.direction] ?? [];
  const frames = exact.length ? exact : c.castFrames;
  return frames.length
    ? { frames, frameMs: THRESH_HOOK_FRAME_MS, playback: "hold" }
    : null;
}

/** Spectral chain with a hook head along the Death Sentence line. */
export function drawThreshDeathSentence(
  ctx: CanvasRenderingContext2D,
  effect: ThreshDeathSentenceEffect,
  tileSize: number,
): void {
  const progress = 1 - Math.max(0, Math.min(1, effect.remainingMs / THRESH_HOOK_VISUAL_MS));
  const ox = effect.origin.x * tileSize + tileSize * 0.5;
  const oy = effect.origin.y * tileSize + tileSize * 0.5;
  const reach = tileSize * Math.max(0.4, effect.reachTiles) * (0.45 + progress * 0.55);
  const ex = ox + effect.direction.x * reach;
  const ey = oy + effect.direction.y * reach;
  const alpha = 0.85 * (1 - progress);
  ctx.save();
  ctx.lineCap = "round";

  // Chain body — glowing spectral green core.
  ctx.strokeStyle = `rgba(57, 255, 136, ${alpha})`;
  ctx.lineWidth = 3 + (1 - progress) * 2;
  ctx.beginPath();
  ctx.moveTo(ox, oy);
  ctx.lineTo(ex, ey);
  ctx.stroke();

  // Chain links pulsing along the line.
  const links = Math.max(3, Math.round(effect.reachTiles * 2));
  for (let i = 0; i <= links; i += 1) {
    const t = ((progress * 1.4 + i / links) % 1) * 0.92 + 0.04;
    const cx = ox + effect.direction.x * reach * t;
    const cy = oy + effect.direction.y * reach * t;
    const r = tileSize * 0.07 * (1.4 - t);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(180, 255, 210, ${alpha * (1 - t * 0.6)})`;
    ctx.lineWidth = 1.6;
    ctx.stroke();
  }

  // Hook head at the tip.
  ctx.beginPath();
  ctx.arc(ex, ey, tileSize * (0.16 + progress * 0.08), 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(220, 255, 235, ${alpha})`;
  ctx.lineWidth = 2.4;
  ctx.stroke();

  if (effect.hit) {
    // Soul-snare flash on the caught victim.
    ctx.beginPath();
    ctx.arc(ex, ey, tileSize * (0.34 + progress * 0.22), 0, Math.PI * 2);
    ctx.fillStyle = `rgba(57, 255, 136, ${0.32 * (1 - progress)})`;
    ctx.fill();
  }
  ctx.restore();
}

export function advanceThreshWorldEffects(
  effects: readonly ChampionWorldEffect[],
  deltaMs: number,
): ChampionWorldEffect[] {
  return effects
    .map((effect) => {
      if (!isThreshDeathSentenceEffect(effect)) {
        return effect;
      }
      return {
        ...effect,
        remainingMs: effect.remainingMs - deltaMs,
      };
    })
    .filter(
      (effect) =>
        !isThreshDeathSentenceEffect(effect) || effect.remainingMs > 0,
    );
}

export const THRESH_VISUAL_ADAPTER: ChampionVisualAdapter = {
  skillId: THRESH_SKILL_ID,
  resolveAnimation: resolveThreshAnimation,
  advanceWorldEffects: advanceThreshWorldEffects,
  getHudStatus: (player, language) => {
    if (player.skill.phase !== "channeling") {
      return null;
    }
    const sec = Math.max(0, player.skill.channelRemainingMs / 1000).toFixed(1);
    return {
      label: language === "pt" ? `GANCHO ${sec}s` : `HOOK ${sec}s`,
      tone: "success",
      critical: false,
      dangerEtaMs: null,
    };
  },
  drawWorldEffect: (ctx, effect, tileSize) => {
    if (isThreshDeathSentenceEffect(effect)) {
      drawThreshDeathSentence(ctx, effect, tileSize);
    }
  },
};
export function createChampionVisualAdapter(): ChampionVisualAdapter {
  return THRESH_VISUAL_ADAPTER;
}
