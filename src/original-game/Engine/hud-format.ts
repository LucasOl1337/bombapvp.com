/**
 * Pure HUD string helpers — no canvas, no GameApp state.
 */
import type { PlayerState } from "../Gameplay/types";

/** Spaced tokens so level 0 never collides with adjacent letters (S0 → "S 0"). */
export function formatHudStatLine(
  player: Pick<PlayerState, "maxBombs" | "flameRange" | "speedLevel" | "shortFuseLevel">,
  includeShortFuse: boolean,
): string {
  const parts = [
    `B ${player.maxBombs}`,
    `F ${player.flameRange}`,
    `S ${player.speedLevel}`,
  ];
  if (includeShortFuse) {
    parts.push(`Q ${player.shortFuseLevel}`);
  }
  return parts.join(" · ");
}

export function drawHudPanel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  accent: string,
  colors: Readonly<{ panelBg: string; border: string }>,
): void {
  ctx.fillStyle = colors.panelBg;
  ctx.fillRect(x, y, width, height);
  ctx.fillStyle = accent;
  ctx.fillRect(x, y, 3, height);
  ctx.strokeStyle = colors.border;
  ctx.strokeRect(x + 0.5, y + 0.5, Math.max(1, width - 1), Math.max(1, height - 1));
}
