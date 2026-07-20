/**
 * Canvas presentation for flame tiles. Keeps sheet math out of GameApp.
 */
import type { FlameState } from "../Gameplay/types";
import { FLAME_DURATION_MS, TILE_SIZE } from "../PersonalConfig/config";

/** Bomb explosion multi-frame sheet: 4×4 = 16 frames, row-major (arc-flare pack). */
export const FLAME_ANIM_COLS = 6;
export const FLAME_ANIM_ROWS = 4;
export const FLAME_ANIM_FRAME_COUNT = FLAME_ANIM_COLS * FLAME_ANIM_ROWS;

const FLAME_DISSIPATE_TAIL_MS = 120;

export type FlameRenderAssets = Readonly<{
  flame: CanvasImageSource | null | undefined;
  flameAnimSheet?: CanvasImageSource | null | undefined;
}>;

export type FlameRenderOptions = Readonly<{
  animationClockMs: number;
  prefersReducedMotion: boolean;
  dissipateTailMs?: number;
  flameDurationMs?: number;
  tileSize?: number;
}>;

function isDrawableImage(
  image: CanvasImageSource | null | undefined,
): image is CanvasImageSource & { naturalWidth: number; naturalHeight: number } {
  if (!image || typeof image !== "object") return false;
  const candidate = image as { naturalWidth?: number; naturalHeight?: number };
  return (
    typeof candidate.naturalWidth === "number"
    && typeof candidate.naturalHeight === "number"
    && candidate.naturalWidth > 0
    && candidate.naturalHeight > 0
  );
}

function drawDissipatingImage(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  x: number,
  y: number,
  tileSize: number,
  alpha: number,
  dissipateScale: number,
  source?: Readonly<{ sx: number; sy: number; sw: number; sh: number }>,
): void {
  const centerX = x + tileSize * 0.5;
  const centerY = y + tileSize * 0.5;
  ctx.save();
  // Additive-ish blend makes fire read hotter over arena tiles without orange HUD boxes.
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = alpha;
  ctx.translate(centerX, centerY);
  // Slight overscale so blast fills the tile instead of looking like a tiny sticker.
  const scale = dissipateScale * 1.12;
  ctx.scale(scale, scale);
  ctx.translate(-centerX, -centerY);
  if (source) {
    ctx.drawImage(image, source.sx, source.sy, source.sw, source.sh, x, y, tileSize, tileSize);
  } else {
    ctx.drawImage(image, x, y, tileSize, tileSize);
  }
  ctx.restore();
}

function drawProceduralFlame(
  ctx: CanvasRenderingContext2D,
  flame: FlameState,
  x: number,
  y: number,
  tileSize: number,
  alpha: number,
  dissipateScale: number,
): void {
  const centerX = x + tileSize * 0.5;
  const centerY = y + tileSize * 0.5;
  const palette = flame.style === "toxic"
    ? {
      outer: `rgba(72, 214, 136, ${alpha})`,
      inner: `rgba(192, 255, 177, ${alpha})`,
    }
    : {
      outer: `rgba(255, 160, 74, ${alpha})`,
      inner: `rgba(255, 244, 159, ${alpha})`,
    };

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.scale(dissipateScale, dissipateScale);
  ctx.translate(-centerX, -centerY);
  ctx.fillStyle = palette.outer;
  ctx.fillRect(x + 4, y + 4, tileSize - 8, tileSize - 8);
  ctx.fillStyle = palette.inner;
  ctx.beginPath();
  ctx.moveTo(x + 16, y + 5);
  ctx.lineTo(x + 26, y + 16);
  ctx.lineTo(x + 16, y + 27);
  ctx.lineTo(x + 6, y + 16);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawToxicAura(
  ctx: CanvasRenderingContext2D,
  flame: FlameState,
  x: number,
  y: number,
  tileSize: number,
  alpha: number,
  animationClockMs: number,
): void {
  const centerX = x + tileSize * 0.5;
  const centerY = y + tileSize * 0.5;
  const auraPulse = 0.72 + 0.28 * (0.5 + 0.5 * Math.sin(
    animationClockMs / 110 + flame.tile.x * 0.7 + flame.tile.y * 0.45,
  ));
  ctx.save();
  ctx.globalAlpha = alpha * (0.34 + auraPulse * 0.18);
  ctx.fillStyle = "rgba(76, 255, 166, 0.34)";
  ctx.beginPath();
  ctx.arc(centerX, centerY, 15 + auraPulse * 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = alpha * (0.56 + auraPulse * 0.22);
  ctx.strokeStyle = "rgba(169, 255, 204, 0.9)";
  ctx.lineWidth = 1 + auraPulse * 0.9;
  ctx.beginPath();
  ctx.arc(centerX, centerY, 16.5 + auraPulse * 3, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/** Draw one flame tile (additive warm bloom → sheet → static sprite → procedural fallback). */
export function drawFlameTile(
  ctx: CanvasRenderingContext2D,
  flame: FlameState,
  assets: FlameRenderAssets,
  options: FlameRenderOptions,
): void {
  const tileSize = options.tileSize ?? TILE_SIZE;
  const dissipateTailMs = options.dissipateTailMs ?? FLAME_DISSIPATE_TAIL_MS;
  const flameDurationMs = options.flameDurationMs ?? FLAME_DURATION_MS;
  const x = flame.tile.x * tileSize;
  const y = flame.tile.y * tileSize;
  const alpha = Math.min(1, Math.max(0, flame.remainingMs) / dissipateTailMs);
  const dissipateScale = 0.9 + alpha * 0.1;

  if (flame.style === "toxic") {
    drawToxicAura(ctx, flame, x, y, tileSize, alpha, options.animationClockMs);
  } else {
    // NOVA PRIME: additive bloom so blasts read as light, not stickers.
    const centerX = x + tileSize * 0.5;
    const centerY = y + tileSize * 0.5;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const bloom = ctx.createRadialGradient(centerX, centerY, 2, centerX, centerY, tileSize * 0.72);
    bloom.addColorStop(0, `rgba(255, 196, 96, ${0.3 * alpha})`);
    bloom.addColorStop(0.55, `rgba(255, 110, 40, ${0.14 * alpha})`);
    bloom.addColorStop(1, "rgba(255, 80, 30, 0)");
    ctx.fillStyle = bloom;
    ctx.fillRect(x - tileSize * 0.3, y - tileSize * 0.3, tileSize * 1.6, tileSize * 1.6);
    ctx.restore();
  }

  if (!flame.style || flame.style === "normal") {
    const sheet = assets.flameAnimSheet;
    const canUseSheet = isDrawableImage(sheet) && !options.prefersReducedMotion;
    if (canUseSheet && sheet) {
      const elapsedMs = Math.max(0, flameDurationMs - flame.remainingMs);
      const frameMs = Math.max(1, Math.floor(flameDurationMs / FLAME_ANIM_FRAME_COUNT));
      const frameIndex = Math.min(
        FLAME_ANIM_FRAME_COUNT - 1,
        Math.floor(elapsedMs / frameMs),
      );
      const col = frameIndex % FLAME_ANIM_COLS;
      const row = Math.floor(frameIndex / FLAME_ANIM_COLS);
      const frameWidth = sheet.naturalWidth / FLAME_ANIM_COLS;
      const frameHeight = sheet.naturalHeight / FLAME_ANIM_ROWS;
      drawDissipatingImage(ctx, sheet, x, y, tileSize, alpha, dissipateScale, {
        sx: col * frameWidth,
        sy: row * frameHeight,
        sw: frameWidth,
        sh: frameHeight,
      });
      return;
    }
    if (assets.flame) {
      drawDissipatingImage(ctx, assets.flame, x, y, tileSize, alpha, dissipateScale);
      return;
    }
  }

  drawProceduralFlame(ctx, flame, x, y, tileSize, alpha, dissipateScale);
}
