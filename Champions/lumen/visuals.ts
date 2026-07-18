import type {
  ChampionAnimationContext,
  ChampionAnimationResult,
  ChampionVisualAdapter,
} from "../visual-contracts";
import type { ChampionWorldEffect } from "../world-effects";
import { isLumenFlashEffect } from "../world-effects";
import type { LumenFlashEffect } from "./contracts";
import { LUMEN_FLASH_VISUAL_MS } from "./skill";
import { LUMEN_SKILL_ID } from "./definition";

export function resolveLumenAnimation(
  ctx: ChampionAnimationContext,
): ChampionAnimationResult | null {
  // Instant skill — no channel animation path required.
  void ctx;
  return null;
}

export function drawLumenFlash(
  ctx: CanvasRenderingContext2D,
  effect: LumenFlashEffect,
  tileSize: number,
): void {
  const progress =
    1 - Math.max(0, Math.min(1, effect.remainingMs / LUMEN_FLASH_VISUAL_MS));
  const alpha = 0.75 * (1 - progress);
  ctx.save();
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(effect.from.x, effect.from.y);
  ctx.lineTo(effect.to.x, effect.to.y);
  ctx.strokeStyle = `rgba(255, 240, 140, ${alpha})`;
  ctx.lineWidth = 3 + (1 - progress) * 2;
  ctx.stroke();
  for (const p of [effect.from, effect.to]) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, tileSize * (0.18 + progress * 0.1), 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(180, 220, 255, ${alpha})`;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.restore();
}

export function advanceLumenWorldEffects(
  effects: readonly ChampionWorldEffect[],
  deltaMs: number,
): ChampionWorldEffect[] {
  return effects
    .map((e) =>
      isLumenFlashEffect(e) ? { ...e, remainingMs: e.remainingMs - deltaMs } : e,
    )
    .filter((e) => !isLumenFlashEffect(e) || e.remainingMs > 0);
}

export const LUMEN_VISUAL_ADAPTER: ChampionVisualAdapter = {
  skillId: LUMEN_SKILL_ID,
  resolveAnimation: resolveLumenAnimation,
  advanceWorldEffects: advanceLumenWorldEffects,
  drawWorldEffect: (ctx, effect, tileSize) => {
    if (isLumenFlashEffect(effect)) drawLumenFlash(ctx, effect, tileSize);
  },
};
export function createChampionVisualAdapter(): ChampionVisualAdapter {
  return LUMEN_VISUAL_ADAPTER;
}
