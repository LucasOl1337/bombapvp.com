/**
 * Pure HUD string / layout helpers — no canvas, no GameApp state.
 */
import type { PlayerId, PlayerState } from "../Gameplay/types";

/** Shared two-row match HUD geometry (windowed + fullscreen). */
export const HUD_LAYOUT = {
  /** Visual match HUD height; independent from stable world-space geometry. */
  height: 112,
  /** Top strip: rival slots + match center. */
  topRowY: 6,
  topRowHeight: 42,
  /** Bottom strip: dedicated local player panel. */
  localPanelY: 54,
  localPanelHeight: 52,
  /** Isolated match meta (round / timer / mode). */
  centerWidth: 188,
  centerMaxWidth: 220,
  rivalSlotMinWidth: 136,
  rivalSlotMaxWidth: 200,
  paddingX: 8,
  gap: 8,
  /** Local panel rhythm: identity | centered upgrades | ultimate. */
  localInsetX: 14,
  localIdentityWidth: 236,
  localRightInset: 12,
  localUltimateWidth: 66,
  localSectionGap: 10,
  skillSlotGap: 8,
  skillSlotMinWidth: 50,
  skillSlotMaxWidth: 72,
  skillSlotHeight: 30,
  /** Name budgets (code units) for stable ellipsis. */
  rivalNameMax: 14,
  localNameMax: 20,
} as const;

const ELLIPSIS = "…";

/**
 * Stable single-ellipsis truncation for long display names.
 * Example: ellipsisText("Crocodilo Arcano", 12) → "Crocodilo A…"
 */
export function ellipsisText(text: string, maxLength: number): string {
  if (maxLength <= 0) {
    return "";
  }
  if (text.length <= maxLength) {
    return text;
  }
  if (maxLength === 1) {
    return ELLIPSIS;
  }
  const keep = Math.max(1, maxLength - ELLIPSIS.length);
  return `${text.slice(0, keep)}${ELLIPSIS}`;
}

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

/** Compact score line for rival slots (endless K/W or first-to wins). */
export function formatHudScoreLine(
  mode: "endless" | "standard",
  stats: { kills?: number; wins: number },
): string {
  if (mode === "endless") {
    return `K${stats.kills ?? 0} W${stats.wins}`;
  }
  return `W${stats.wins}`;
}

/**
 * Split active players into local + left/right rival groups for the top strip.
 * Local always goes to the dedicated bottom panel; rivals sit beside center meta.
 */
export function partitionHudPlayers(
  activePlayerIds: readonly PlayerId[],
  localPlayerId: PlayerId,
): { localPlayerId: PlayerId; leftRivals: PlayerId[]; rightRivals: PlayerId[] } {
  const rivals = activePlayerIds.filter((id) => id !== localPlayerId);
  if (rivals.length === 0) {
    return { localPlayerId, leftRivals: [], rightRivals: [] };
  }
  if (rivals.length === 1) {
    return { localPlayerId, leftRivals: [], rightRivals: [rivals[0]!] };
  }
  if (rivals.length === 2) {
    return { localPlayerId, leftRivals: [rivals[0]!], rightRivals: [rivals[1]!] };
  }
  // 3 rivals (4-player match): 2 left, 1 right keeps center meta readable.
  const split = Math.ceil(rivals.length / 2);
  return {
    localPlayerId,
    leftRivals: rivals.slice(0, split),
    rightRivals: rivals.slice(split),
  };
}

/** Even slot widths for a side gutter between padding and center panel. */
export function computeRivalSlotWidth(
  availableWidth: number,
  slotCount: number,
  minWidth: number = HUD_LAYOUT.rivalSlotMinWidth,
  maxWidth: number = HUD_LAYOUT.rivalSlotMaxWidth,
  gap: number = HUD_LAYOUT.gap,
): number {
  if (slotCount <= 0) {
    return 0;
  }
  const usable = Math.max(0, availableWidth - gap * Math.max(0, slotCount - 1));
  const raw = Math.floor(usable / slotCount);
  return Math.max(minWidth, Math.min(maxWidth, raw));
}
