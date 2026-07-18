import type {
  Direction,
  PixelCoord,
  PlayerId,
  PlayerState,
} from "../../src/original-game/Gameplay/types";
import type {
  ChampionAnimationContext,
  ChampionAnimationResult,
  ChampionPresentationContext,
  ChampionVisualAdapter,
  SkillChannelUpdate,
} from "../visual-contracts";
import { RANNI_SKILL_CHANNEL_MS } from "./skill";
import { RANNI_SKILL_ID } from "./definition";
export type RanniFeedback = Readonly<{
  kind: "blocked" | "failed";
  position: PixelCoord;
  elapsedMs: number;
}>;
export const RANNI_BLINK_FEEDBACK_MS = 800,
  RANNI_PROJECTION_MIN_DISTANCE_PX = 1;
export function buildRanniProjectionFeedbackGeometry(
  origin: PixelCoord,
  target: PixelCoord,
  attemptedDirection: boolean,
) {
  const distancePx = Math.hypot(target.x - origin.x, target.y - origin.y);
  const hasDisplacement = distancePx >= RANNI_PROJECTION_MIN_DISTANCE_PX;
  return {
    originX: origin.x,
    originY: origin.y,
    targetX: target.x,
    targetY: target.y,
    distancePx,
    hasDisplacement,
    blocked: attemptedDirection && !hasDisplacement,
  };
}
export class RanniVisualState {
  private feedback = new Map<
    PlayerId,
    { kind: "blocked" | "failed"; position: PixelCoord; elapsedMs: number }
  >();
  update(
    player: PlayerState,
    direction: Direction | null,
    pressed: boolean,
    held: boolean,
    deltaMs: number,
    run: SkillChannelUpdate,
  ) {
    const active =
      player.skill.id === RANNI_SKILL_ID && player.skill.phase === "channeling";
    const origin = active ? { ...player.position } : null;
    const before = active
      ? { ...(player.skill.projectedPosition ?? player.position) }
      : null;
    const handled = run(player, direction, pressed, held, deltaMs);
    if (!active || !origin || !before) return handled;
    if (player.skill.phase !== "channeling") {
      const result = buildRanniProjectionFeedbackGeometry(
        origin,
        player.position,
        Boolean(direction),
      );
      if (!result.hasDisplacement)
        this.feedback.set(player.id, {
          kind: "failed",
          position: { ...player.position },
          elapsedMs: 0,
        });
      else this.feedback.delete(player.id);
      return handled;
    }
    if (direction) {
      const after = player.skill.projectedPosition ?? before;
      const step = buildRanniProjectionFeedbackGeometry(before, after, true);
      if (step.blocked)
        this.feedback.set(player.id, {
          kind: "blocked",
          position: { ...after },
          elapsedMs: 0,
        });
      else this.feedback.delete(player.id);
    }
    return handled;
  }
  advance(ms: number, ids: readonly PlayerId[]) {
    for (const id of ids) {
      const f = this.feedback.get(id);
      if (!f) continue;
      f.elapsedMs += ms;
      if (f.elapsedMs >= RANNI_BLINK_FEEDBACK_MS) this.feedback.delete(id);
    }
  }
  reset() {
    this.feedback.clear();
  }
  get(id: PlayerId): RanniFeedback | null {
    return this.feedback.get(id) ?? null;
  }
}
export function resolveRanniAnimation(
  c: ChampionAnimationContext,
): ChampionAnimationResult | null {
  return c.player.skill.phase === "channeling" && c.castFrames.length
    ? { frames: c.castFrames, frameMs: c.skillFrameMs, playback: "hold" }
    : null;
}

export function drawRanniPreview(
  ctx: CanvasRenderingContext2D,
  player: PlayerState,
  tileSize: number,
  clockMs: number,
  reducedMotion: boolean,
): void {
  const target = player.skill.projectedPosition ?? player.position,
    g = buildRanniProjectionFeedbackGeometry(player.position, target, false),
    charge = Math.max(
      0,
      Math.min(1, player.skill.castElapsedMs / RANNI_SKILL_CHANNEL_MS),
    ),
    pulse = reducedMotion ? 0.72 : 0.66 + Math.sin(clockMs / 95) * 0.12,
    radius = tileSize * (0.23 + charge * 0.04);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (g.hasDisplacement) {
    if (!reducedMotion) {
      ctx.setLineDash([5, 5]);
      ctx.lineDashOffset = -(clockMs / 55) % 10;
    }
    ctx.strokeStyle = `rgba(143, 224, 255, ${0.28 + charge * 0.28})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(g.originX, g.originY);
    ctx.lineTo(g.targetX, g.targetY);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.fillStyle = `rgba(117, 211, 255, ${0.1 + charge * 0.12})`;
  ctx.beginPath();
  ctx.arc(g.targetX, g.targetY, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = `rgba(226, 249, 255, ${pulse})`;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.translate(g.targetX, g.targetY);
  ctx.rotate(Math.PI * 0.25 + (reducedMotion ? 0 : clockMs / 1400));
  const diamond = tileSize * 0.13;
  ctx.strokeStyle = `rgba(179, 235, 255, ${0.45 + charge * 0.3})`;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(-diamond, -diamond, diamond * 2, diamond * 2);
  ctx.restore();
}

export function drawRanniFeedback(
  ctx: CanvasRenderingContext2D,
  feedback: RanniFeedback,
  tileSize: number,
  reducedMotion: boolean,
  language: "pt" | "en",
): void {
  const progress = Math.max(
      0,
      Math.min(1, feedback.elapsedMs / RANNI_BLINK_FEEDBACK_MS),
    ),
    alpha = Math.max(0, 1 - progress),
    failed = feedback.kind === "failed",
    radius = reducedMotion
      ? tileSize * 0.28
      : tileSize * (0.24 + progress * (failed ? 0.22 : 0.08)),
    color = failed ? "255, 102, 118" : "255, 184, 92",
    label = failed
      ? language === "pt"
        ? "SEM SALTO"
        : "NO BLINK"
      : language === "pt"
        ? "BLOQUEADO"
        : "BLOCKED";
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = `rgba(${color}, ${0.45 + alpha * 0.45})`;
  ctx.lineWidth = failed ? 3 : 2;
  ctx.beginPath();
  ctx.arc(feedback.position.x, feedback.position.y, radius, 0, Math.PI * 2);
  ctx.stroke();
  const cross = Math.max(6, radius * 0.52);
  ctx.beginPath();
  ctx.moveTo(feedback.position.x - cross, feedback.position.y - cross);
  ctx.lineTo(feedback.position.x + cross, feedback.position.y + cross);
  ctx.moveTo(feedback.position.x + cross, feedback.position.y - cross);
  ctx.lineTo(feedback.position.x - cross, feedback.position.y + cross);
  ctx.stroke();
  ctx.restore();
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.font = "700 7px Inter";
  ctx.lineWidth = 3;
  ctx.strokeStyle = `rgba(16, 12, 24, ${0.78 * alpha})`;
  ctx.strokeText(label, feedback.position.x, feedback.position.y - radius - 4);
  ctx.fillStyle = `rgba(${color}, ${alpha})`;
  ctx.fillText(label, feedback.position.x, feedback.position.y - radius - 4);
  ctx.restore();
}

export type RanniVisualAdapter = ChampionVisualAdapter & {
  getFeedback(playerId: PlayerId): RanniFeedback | null;
};

export function createRanniVisualAdapter(): RanniVisualAdapter {
  const state = new RanniVisualState();
  return {
    skillId: RANNI_SKILL_ID,
    resolveAnimation: resolveRanniAnimation,
    updateSkillChannel: (player, direction, pressed, held, deltaMs, update) =>
      state.update(player, direction, pressed, held, deltaMs, update),
    advance: (deltaMs, playerIds) => state.advance(deltaMs, playerIds),
    reset: () => state.reset(),
    getFeedback: (playerId) => state.get(playerId),
    getHudStatus: (player, language) =>
      player.skill.phase === "channeling" &&
      state.get(player.id)?.kind === "blocked"
        ? {
            label: language === "pt" ? "BLOQUEADO" : "BLOCKED",
            tone: "danger",
            critical: true,
            dangerEtaMs: null,
          }
        : null,
    drawPresentation: (context: ChampionPresentationContext) => {
      const feedback = state.get(context.player.id);
      if (feedback)
        drawRanniFeedback(
          context.ctx,
          feedback,
          context.tileSize,
          context.reducedMotion,
          context.language,
        );
      if (
        context.player.active &&
        context.player.alive &&
        context.player.skill.id === RANNI_SKILL_ID &&
        context.player.skill.phase === "channeling"
      ) {
        drawRanniPreview(
          context.ctx,
          context.player,
          context.tileSize,
          context.clockMs,
          context.reducedMotion,
        );
      }
    },
  };
}
