import type {
  ChampionAnimationContext,
  ChampionAnimationResult,
  ChampionVisualAdapter,
} from "../visual-contracts";
import type { ChampionWorldEffect } from "../world-effects";
import { isHexaHexEffect } from "../world-effects";
import type { HexaHexEffect } from "./contracts";
import { HEXA_SKILL_CHANNEL_MS, HEXA_HEX_VISUAL_MS } from "./skill";
import { HEXA_SKILL_ID } from "./definition";

export function resolveHexaAnimation(
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
    Math.floor(HEXA_SKILL_CHANNEL_MS / Math.max(1, frames.length)),
  );
  return { frames, frameMs, playback: "hold" };
}

export function drawHexaHex(
  ctx: CanvasRenderingContext2D,
  effect: HexaHexEffect,
  tileSize: number,
): void {
  const progress =
    1 - Math.max(0, Math.min(1, effect.remainingMs / HEXA_HEX_VISUAL_MS));
  const alpha = 0.7 * (1 - progress);
  ctx.save();
  // Outer hex aura around caster
  const cx = effect.origin.x * tileSize + tileSize * 0.5;
  const cy = effect.origin.y * tileSize + tileSize * 0.5;
  const r = tileSize * (0.4 + progress * (effect.maxRadiusTiles + 0.2));
  ctx.beginPath();
  for (let i = 0; i < 6; i += 1) {
    const ang = (i / 6) * Math.PI * 2 - Math.PI / 2;
    const x = cx + Math.cos(ang) * r;
    const y = cy + Math.sin(ang) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.strokeStyle = `rgba(180, 90, 255, ${alpha})`;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Pulse on hexed bomb tiles
  for (const tile of effect.bombTiles) {
    const tx = tile.x * tileSize + tileSize * 0.5;
    const ty = tile.y * tileSize + tileSize * 0.5;
    const pr = tileSize * (0.2 + (1 - progress) * 0.15);
    ctx.beginPath();
    ctx.arc(tx, ty, pr, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(220, 140, 255, ${alpha})`;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(tx, ty, pr * 0.45, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(160, 60, 220, ${alpha * 0.35})`;
    ctx.fill();
  }
  ctx.restore();
}

export function advanceHexaWorldEffects(
  effects: readonly ChampionWorldEffect[],
  deltaMs: number,
): ChampionWorldEffect[] {
  return effects
    .map((effect) => {
      if (!isHexaHexEffect(effect)) return effect;
      return { ...effect, remainingMs: effect.remainingMs - deltaMs };
    })
    .filter((effect) => !isHexaHexEffect(effect) || effect.remainingMs > 0);
}

export const HEXA_VISUAL_ADAPTER: ChampionVisualAdapter = {
  skillId: HEXA_SKILL_ID,
  resolveAnimation: resolveHexaAnimation,
  advanceWorldEffects: advanceHexaWorldEffects,
  getHudStatus: (player, language) => {
    if (player.skill.phase !== "channeling") return null;
    const sec = Math.max(0, player.skill.channelRemainingMs / 1000).toFixed(1);
    return {
      label: language === "pt" ? `HEX ${sec}s` : `HEX ${sec}s`,
      tone: "success",
      critical: false,
      dangerEtaMs: null,
    };
  },
  drawWorldEffect: (ctx, effect, tileSize) => {
    if (isHexaHexEffect(effect)) drawHexaHex(ctx, effect, tileSize);
  },
};
export function createChampionVisualAdapter(): ChampionVisualAdapter {
  return HEXA_VISUAL_ADAPTER;
}
