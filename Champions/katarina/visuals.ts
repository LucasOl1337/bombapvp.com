import type {
  ChampionAnimationContext,
  ChampionAnimationResult,
  ChampionVisualAdapter,
} from "../visual-contracts";
import {
  isKatarinaBladeEffect,
  isKatarinaShunpoEffect,
  type ChampionWorldEffect,
} from "../world-effects";
import type {
  KatarinaBladeEffect,
  KatarinaShunpoEffect,
} from "./contracts";
import {
  isKatarinaBladeConsumed,
  KATARINA_BLADE_ARMED_MS,
  KATARINA_CAST_FRAME_MS,
  KATARINA_SHUNPO_VISUAL_MS,
} from "./skill";
import { KATARINA_SKILL_ID } from "./identity";

export function resolveKatarinaAnimation(
  c: ChampionAnimationContext,
): ChampionAnimationResult | null {
  // Only the throw wind-up overrides animation; while the dagger is armed
  // ("releasing") Katarina plays her normal idle/walk cycles.
  if (c.player.skill.phase !== "channeling") {
    return null;
  }
  const exact = c.cycles.cast[c.direction] ?? [];
  const frames = exact.length ? exact : c.castFrames;
  return frames.length
    ? { frames, frameMs: KATARINA_CAST_FRAME_MS, playback: "hold" }
    : null;
}

/** Dagger stuck in the ground with a pulsing crimson ring (lifetime drain). */
export function drawKatarinaBlade(
  ctx: CanvasRenderingContext2D,
  effect: KatarinaBladeEffect,
  tileSize: number,
): void {
  const cx = effect.tile.x * tileSize + tileSize * 0.5;
  const cy = effect.tile.y * tileSize + tileSize * 0.5;
  const life = Math.max(0, Math.min(1, effect.remainingMs / KATARINA_BLADE_ARMED_MS));
  const urgent = life < 0.25;
  ctx.save();

  // Availability ring draining with the armed window.
  ctx.beginPath();
  ctx.arc(cx, cy, tileSize * 0.42, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * life);
  ctx.strokeStyle = urgent
    ? "rgba(255, 60, 60, 0.9)"
    : "rgba(220, 40, 60, 0.75)";
  ctx.lineWidth = 3;
  ctx.stroke();

  // Dagger: silver blade angled into the ground + crimson glow.
  ctx.translate(cx, cy);
  ctx.rotate(-0.6);
  ctx.fillStyle = "rgba(230, 235, 245, 0.95)";
  ctx.beginPath();
  ctx.moveTo(0, -tileSize * 0.3);
  ctx.lineTo(tileSize * 0.07, 0);
  ctx.lineTo(0, tileSize * 0.08);
  ctx.lineTo(-tileSize * 0.07, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(120, 20, 30, 0.95)";
  ctx.fillRect(-tileSize * 0.1, tileSize * 0.08, tileSize * 0.2, tileSize * 0.06);
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, tileSize * (0.16 + (1 - life) * 0.05), 0, Math.PI * 2);
  ctx.fillStyle = `rgba(220, 40, 60, ${0.22 + (urgent ? 0.15 : 0)})`;
  ctx.fill();
  ctx.restore();
}

/** Crimson slash ring when Katarina blinks to the dagger. */
export function drawKatarinaShunpo(
  ctx: CanvasRenderingContext2D,
  effect: KatarinaShunpoEffect,
  tileSize: number,
): void {
  const progress = 1 - Math.max(0, Math.min(1, effect.remainingMs / KATARINA_SHUNPO_VISUAL_MS));
  const cx = effect.tile.x * tileSize + tileSize * 0.5;
  const cy = effect.tile.y * tileSize + tileSize * 0.5;
  const alpha = 0.85 * (1 - progress);
  ctx.save();
  // Slash ring covering the Chebyshev-1 kill zone.
  const r = tileSize * (0.5 + progress * 1.1);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(255, 70, 80, ${alpha})`;
  ctx.lineWidth = 4 - progress * 2;
  ctx.stroke();
  // Dagger arcs sweeping the ring.
  for (let i = 0; i < 4; i += 1) {
    const a = progress * Math.PI * 1.6 + (i * Math.PI) / 2;
    const px = cx + Math.cos(a) * r;
    const py = cy + Math.sin(a) * r;
    ctx.beginPath();
    ctx.arc(px, py, tileSize * 0.08, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(235, 240, 250, ${alpha})`;
    ctx.fill();
  }
  ctx.restore();
}

export function advanceKatarinaWorldEffects(
  effects: readonly ChampionWorldEffect[],
  deltaMs: number,
): ChampionWorldEffect[] {
  return effects
    .map((effect) => {
      if (
        !isKatarinaBladeEffect(effect) &&
        !isKatarinaShunpoEffect(effect)
      ) {
        return effect;
      }
      return { ...effect, remainingMs: effect.remainingMs - deltaMs };
    })
    .filter((effect) => {
      if (isKatarinaBladeEffect(effect)) {
        return effect.remainingMs > 0 && !isKatarinaBladeConsumed(effect.ownerId);
      }
      if (isKatarinaShunpoEffect(effect)) {
        return effect.remainingMs > 0;
      }
      return true;
    });
}

export const KATARINA_VISUAL_ADAPTER: ChampionVisualAdapter = {
  skillId: KATARINA_SKILL_ID,
  resolveAnimation: resolveKatarinaAnimation,
  advanceWorldEffects: advanceKatarinaWorldEffects,
  getHudStatus: (player, language) => {
    if (player.skill.phase === "channeling") {
      return {
        label: language === "pt" ? "ARREMESSO" : "THROW",
        tone: "success",
        critical: false,
        dangerEtaMs: null,
      };
    }
    if (player.skill.phase === "releasing") {
      const sec = Math.max(0, player.skill.channelRemainingMs / 1000).toFixed(1);
      return {
        label: language === "pt" ? `ADAGA ${sec}s` : `DAGGER ${sec}s`,
        tone: "success",
        critical: false,
        dangerEtaMs: null,
      };
    }
    return null;
  },
  drawWorldEffect: (ctx, effect, tileSize) => {
    if (isKatarinaBladeEffect(effect)) {
      drawKatarinaBlade(ctx, effect, tileSize);
    }
    if (isKatarinaShunpoEffect(effect)) {
      drawKatarinaShunpo(ctx, effect, tileSize);
    }
  },
};
export function createChampionVisualAdapter(): ChampionVisualAdapter {
  return KATARINA_VISUAL_ADAPTER;
}
