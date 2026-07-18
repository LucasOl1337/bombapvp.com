import type {
  ChampionAnimationContext,
  ChampionAnimationResult,
  ChampionVisualAdapter,
} from "../visual-contracts";
import type { ChampionWorldEffect } from "../world-effects";
import { isAegisBastionEffect } from "../world-effects";
import type { AegisBastionEffect } from "./contracts";
import { AEGIS_SKILL_CHANNEL_MS, AEGIS_BASTION_VISUAL_MS } from "./skill";
import { AEGIS_SKILL_ID } from "./definition";

export function resolveAegisAnimation(
  ctx: ChampionAnimationContext,
): ChampionAnimationResult | null {
  if (ctx.player.skill.phase !== "channeling") return null;
  const exact = ctx.cycles.cast[ctx.direction] ?? [];
  const frames = exact.length
    ? exact
    : ctx.runFrames.length
      ? ctx.runFrames
      : ctx.attackFrames;
  if (!frames.length) return null;
  return {
    frames,
    frameMs: Math.max(
      40,
      Math.floor(AEGIS_SKILL_CHANNEL_MS / Math.max(1, frames.length)),
    ),
    playback: "hold",
  };
}

export function drawAegisBastion(
  ctx: CanvasRenderingContext2D,
  effect: AegisBastionEffect,
  tileSize: number,
): void {
  const progress =
    1 - Math.max(0, Math.min(1, effect.remainingMs / AEGIS_BASTION_VISUAL_MS));
  const cx = effect.origin.x * tileSize + tileSize * 0.5;
  const cy = effect.origin.y * tileSize + tileSize * 0.5;
  const alpha = 0.7 * (1 - progress);
  const r = tileSize * (0.35 + progress * 0.55);
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(220, 190, 90, ${alpha})`;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.65, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(140, 200, 255, ${alpha * 0.8})`;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

export function advanceAegisWorldEffects(
  effects: readonly ChampionWorldEffect[],
  deltaMs: number,
): ChampionWorldEffect[] {
  return effects
    .map((e) =>
      isAegisBastionEffect(e) ? { ...e, remainingMs: e.remainingMs - deltaMs } : e,
    )
    .filter((e) => !isAegisBastionEffect(e) || e.remainingMs > 0);
}

export const AEGIS_VISUAL_ADAPTER: ChampionVisualAdapter = {
  skillId: AEGIS_SKILL_ID,
  resolveAnimation: resolveAegisAnimation,
  advanceWorldEffects: advanceAegisWorldEffects,
  getHudStatus: (player, language) => {
    if (player.skill.phase !== "channeling") return null;
    const sec = Math.max(0, player.skill.channelRemainingMs / 1000).toFixed(1);
    return {
      label: language === "pt" ? `BASTIÃO ${sec}s` : `BASTION ${sec}s`,
      tone: "success",
      critical: false,
      dangerEtaMs: null,
    };
  },
  drawWorldEffect: (ctx, effect, tileSize) => {
    if (isAegisBastionEffect(effect)) drawAegisBastion(ctx, effect, tileSize);
  },
};
export function createChampionVisualAdapter(): ChampionVisualAdapter {
  return AEGIS_VISUAL_ADAPTER;
}
