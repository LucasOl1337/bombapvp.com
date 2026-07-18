import type {
  PlayerState,
  TileCoord,
} from "../../src/original-game/Gameplay/types";
import type { SkillContext } from "../../src/original-game/ultimate/shared";
import type {
  ChampionAnimationContext,
  ChampionAnimationResult,
  ChampionVisualAdapter,
} from "../visual-contracts";
import {
  CROCODILO_SKILL_CHANNEL_MS,
  CROCODILO_SKILL_RELEASE_MS,
  computeCrocodiloSurgeTiles,
} from "./skill";
import { CROCODILO_SKILL_ID } from "./definition";
export function resolveCrocodiloAnimation(
  c: ChampionAnimationContext,
): ChampionAnimationResult | null {
  const exact = c.cycles.cast[c.direction] ?? [],
    idle = c.cycles.idle[c.direction] ?? [],
    fallback = exact.length
      ? exact
      : c.attackFrames.length
        ? c.attackFrames
        : c.runFrames.length
          ? c.runFrames
          : idle;
  if (c.player.skill.phase === "channeling") {
    const frames = exact.length >= 3 ? exact.slice(0, -1) : fallback;
    return frames.length
      ? {
          frames,
          frameMs: Math.max(
            c.skillFrameMs,
            Math.floor(CROCODILO_SKILL_CHANNEL_MS / frames.length),
          ),
          playback: "hold",
        }
      : null;
  }
  if (c.player.skill.phase === "releasing") {
    const frames = exact.length >= 2 ? exact.slice(-2) : fallback;
    return frames.length
      ? {
          frames,
          frameMs: Math.max(
            60,
            Math.floor(CROCODILO_SKILL_RELEASE_MS / frames.length),
          ),
          playback: "hold",
        }
      : null;
  }
  return null;
}
export function drawCrocodiloPreview(
  ctx: CanvasRenderingContext2D,
  player: PlayerState,
  getTile: (p: { x: number; y: number }) => TileCoord,
  skillContext: SkillContext,
  tileSize: number,
  clockMs: number,
): void {
  const origin = getTile(player.position),
    tiles = computeCrocodiloSurgeTiles(origin, skillContext);
  if (!tiles.length) return;
  const charge = Math.max(
      0,
      Math.min(1, player.skill.castElapsedMs / CROCODILO_SKILL_CHANNEL_MS),
    ),
    pulse = 0.52 + Math.sin(clockMs / 100) * 0.16,
    cx = origin.x * tileSize + tileSize * 0.5,
    cy = origin.y * tileSize + tileSize * 0.5;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = `rgba(176, 255, 122, ${0.18 + charge * 0.24})`;
  ctx.lineWidth = 2;
  for (const tile of tiles) {
    const x = tile.x * tileSize,
      y = tile.y * tileSize,
      tx = x + tileSize * 0.5,
      ty = y + tileSize * 0.5;
    ctx.fillStyle = `rgba(86, 214, 95, ${0.07 + charge * 0.1 + pulse * 0.03})`;
    ctx.fillRect(x + 4, y + 4, tileSize - 8, tileSize - 8);
    ctx.strokeStyle = `rgba(221, 255, 192, ${0.12 + charge * 0.18})`;
    ctx.strokeRect(x + 4.5, y + 4.5, tileSize - 9, tileSize - 9);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(tx, ty);
    ctx.stroke();
  }
  ctx.fillStyle = `rgba(122, 255, 107, ${0.12 + charge * 0.15})`;
  ctx.beginPath();
  ctx.arc(cx, cy, tileSize * (0.34 + charge * 0.08), 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = `rgba(232, 255, 196, ${0.18 + charge * 0.16})`;
  ctx.beginPath();
  ctx.arc(cx, cy, tileSize * (0.42 + pulse * 0.03), 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}
export const CROCODILO_VISUAL_ADAPTER: ChampionVisualAdapter = {
  skillId: CROCODILO_SKILL_ID,
  resolveAnimation: resolveCrocodiloAnimation,
  drawPresentation: (c) => {
    if (
      c.player.active &&
      c.player.alive &&
      c.player.skill.id === CROCODILO_SKILL_ID &&
      c.player.skill.phase === "channeling"
    )
      drawCrocodiloPreview(
        c.ctx,
        c.player,
        c.getTile,
        c.createSkillContext(),
        c.tileSize,
        c.clockMs,
      );
  },
};
