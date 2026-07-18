import type {
  ArenaState,
  PlayerState,
  TileCoord,
} from "../../src/original-game/Gameplay/types";
import type {
  ChampionAnimationContext,
  ChampionAnimationResult,
  ChampionVisualAdapter,
} from "../visual-contracts";
import type { ChampionWorldEffect } from "../world-effects";
import type { NicoBeamEffect } from "./contracts";
import {
  NICO_BEAM_CORE_WIDTH_PX,
  NICO_BEAM_DURATION_MS,
  NICO_BEAM_GLOW_WIDTH_PX,
  NICO_SKILL_CHANNEL_MS,
  NICO_SKILL_RELEASE_MS,
  collectNicoBeamTiles,
} from "./skill";
import { NICO_SKILL_ID } from "./definition";
export function resolveNicoAnimation(
  c: ChampionAnimationContext,
): ChampionAnimationResult | null {
  const exact = c.cycles.cast[c.direction] ?? [],
    walk = c.cycles.walk[c.direction] ?? [],
    idle = c.cycles.idle[c.direction] ?? [],
    fallback = walk.length ? walk : idle.length ? idle : c.runFrames;
  if (c.player.skill.phase === "channeling") {
    const frames =
      exact.length >= 3 ? exact.slice(0, -1) : exact.length ? exact : fallback;
    return frames.length
      ? {
          frames,
          frameMs: Math.max(
            c.skillFrameMs,
            Math.floor(NICO_SKILL_CHANNEL_MS / frames.length),
          ),
          playback: "hold",
        }
      : null;
  }
  if (c.player.skill.phase === "releasing") {
    const frames =
      exact.length >= 2 ? exact.slice(-2) : exact.length ? exact : fallback;
    return frames.length
      ? {
          frames,
          frameMs: Math.max(
            60,
            Math.floor(NICO_SKILL_RELEASE_MS / frames.length),
          ),
          playback: "hold",
        }
      : null;
  }
  return null;
}

export function drawNicoBeam(
  ctx: CanvasRenderingContext2D,
  beam: NicoBeamEffect,
  tileSize: number,
): void {
  const origin = {
      x: beam.origin.x * tileSize + tileSize * 0.5,
      y: beam.origin.y * tileSize + tileSize * 0.5,
    },
    last = beam.tiles.at(-1) ?? beam.origin,
    end = {
      x: last.x * tileSize + tileSize * 0.5,
      y: last.y * tileSize + tileSize * 0.5,
    },
    progress = Math.max(
      0,
      Math.min(1, beam.remainingMs / NICO_BEAM_DURATION_MS),
    ),
    glow = 0.24 + progress * 0.32,
    core = 0.48 + progress * 0.44,
    g = ctx.createLinearGradient(origin.x, origin.y, end.x, end.y);
  g.addColorStop(0, `rgba(214, 169, 255, ${glow})`);
  g.addColorStop(0.2, `rgba(171, 82, 255, ${glow + 0.08})`);
  g.addColorStop(0.7, `rgba(118, 44, 255, ${glow + 0.1})`);
  g.addColorStop(1, `rgba(234, 185, 255, ${glow})`);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const [style, width] of [
    [
      `rgba(153, 70, 255, ${glow * 0.25})`,
      NICO_BEAM_GLOW_WIDTH_PX + tileSize * 0.7,
    ],
    [g, NICO_BEAM_GLOW_WIDTH_PX],
    [`rgba(255, 241, 255, ${core})`, NICO_BEAM_CORE_WIDTH_PX],
  ] as const) {
    ctx.strokeStyle = style;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(origin.x, origin.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
  }
  for (const tile of beam.tiles) {
    const x = tile.x * tileSize,
      y = tile.y * tileSize;
    ctx.fillStyle = `rgba(153, 58, 255, ${0.12 + progress * 0.14})`;
    ctx.fillRect(x + 4, y + 4, tileSize - 8, tileSize - 8);
    ctx.strokeStyle = `rgba(245, 219, 255, ${0.18 + progress * 0.2})`;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 4.5, y + 4.5, tileSize - 9, tileSize - 9);
  }
  ctx.fillStyle = `rgba(245, 230, 255, ${0.5 + progress * 0.25})`;
  ctx.beginPath();
  ctx.arc(
    origin.x,
    origin.y,
    tileSize * (0.18 + (1 - progress) * 0.08),
    0,
    Math.PI * 2,
  );
  ctx.fill();
  ctx.fillStyle = `rgba(128, 36, 255, ${0.26 + progress * 0.2})`;
  ctx.beginPath();
  ctx.arc(origin.x, origin.y, tileSize * 0.42, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawNicoPreview(
  ctx: CanvasRenderingContext2D,
  player: PlayerState,
  arena: Pick<ArenaState, "solid" | "config">,
  getTile: (p: { x: number; y: number }) => TileCoord,
  tileSize: number,
  clockMs: number,
): void {
  const direction =
      player.skill.projectedLastMoveDirection ??
      player.lastMoveDirection ??
      player.direction,
    origin = getTile(player.position),
    tiles = collectNicoBeamTiles(
      origin,
      direction,
      arena.solid,
      arena.config.grid,
    );
  if (!tiles.length) return;
  const last = tiles.at(-1)!,
    from = {
      x: origin.x * tileSize + tileSize * 0.5,
      y: origin.y * tileSize + tileSize * 0.5,
    },
    to = {
      x: last.x * tileSize + tileSize * 0.5,
      y: last.y * tileSize + tileSize * 0.5,
    },
    charge = Math.max(
      0,
      Math.min(1, player.skill.castElapsedMs / NICO_SKILL_CHANNEL_MS),
    ),
    pulse = 0.55 + Math.sin(clockMs / 90) * 0.18,
    tileAlpha = 0.05 + charge * 0.1 + pulse * 0.03,
    lineAlpha = 0.12 + charge * 0.18;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.setLineDash([6, 6]);
  ctx.lineCap = "round";
  ctx.strokeStyle = `rgba(197, 132, 255, ${lineAlpha})`;
  ctx.lineWidth = NICO_BEAM_GLOW_WIDTH_PX * 0.66;
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
  ctx.setLineDash([]);
  for (const tile of tiles) {
    const x = tile.x * tileSize,
      y = tile.y * tileSize;
    ctx.fillStyle = `rgba(145, 52, 255, ${tileAlpha})`;
    ctx.fillRect(x + 5, y + 5, tileSize - 10, tileSize - 10);
    ctx.strokeStyle = `rgba(245, 226, 255, ${lineAlpha * 0.85})`;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 5.5, y + 5.5, tileSize - 11, tileSize - 11);
  }
  ctx.fillStyle = `rgba(245, 235, 255, ${0.18 + charge * 0.18})`;
  ctx.beginPath();
  ctx.arc(from.x, from.y, tileSize * (0.2 + charge * 0.08), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
export function advanceNicoBeamEffects(
  effects: readonly ChampionWorldEffect[],
  deltaMs: number,
): ChampionWorldEffect[] {
  return effects
    .map((effect) => ({ ...effect, remainingMs: effect.remainingMs - deltaMs }))
    .filter((effect) => effect.remainingMs > 0);
}
export const NICO_VISUAL_ADAPTER: ChampionVisualAdapter = {
  skillId: NICO_SKILL_ID,
  resolveAnimation: resolveNicoAnimation,
  drawPresentation: (c) => {
    if (
      c.player.active &&
      c.player.alive &&
      c.player.skill.id === NICO_SKILL_ID &&
      c.player.skill.phase === "channeling"
    )
      drawNicoPreview(
        c.ctx,
        c.player,
        c.arena,
        c.getTile,
        c.tileSize,
        c.clockMs,
      );
  },
  advanceWorldEffects: advanceNicoBeamEffects,
  drawWorldEffect: drawNicoBeam,
};
