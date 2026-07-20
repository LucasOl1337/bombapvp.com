/**
 * Pure match HUD presentation builder.
 *
 * This module owns HUD state translation and geometry, but not canvas painting,
 * assets, colors, or GameApp internals.
 */
import type { PlayerId } from "../Gameplay/types";
import {
  computeRivalSlotWidth,
  ellipsisText,
  formatHudScoreLine,
  HUD_LAYOUT,
  partitionHudPlayers,
} from "./hud-format";

export type HudLanguage = "pt" | "en";
export type HudMode = "endless" | "standard";
export type HudSkillPhase = "idle" | "channeling" | "releasing" | "cooldown" | "inactive";
export type HudStatusTone = "success" | "muted" | "danger";

export interface MatchHudStatusSnapshot {
  readonly label: string;
  readonly tone: HudStatusTone;
  readonly critical: boolean;
}

export interface MatchHudSkillSnapshot {
  readonly hasUltimate: boolean;
  readonly phase: HudSkillPhase;
  readonly cooldownRemainingMs: number;
  readonly cooldownTotalMs: number;
  readonly castElapsedMs: number;
  readonly channelRemainingMs: number;
}

export interface MatchHudPlayerSnapshot {
  readonly id: PlayerId;
  readonly slotLabel: string;
  readonly displayName: string;
  readonly alive: boolean;
  readonly wins: number;
  readonly kills?: number;
  readonly status: MatchHudStatusSnapshot;
  readonly skill: MatchHudSkillSnapshot;
  readonly recentPickupLabel?: string | null;
  readonly recentPickupTone?: "normal" | "highlight" | "power" | null;
}

export interface MatchHudSnapshot {
  readonly canvasWidth: number;
  readonly activePlayerIds: readonly PlayerId[];
  readonly localPlayerId: PlayerId;
  readonly mode: HudMode;
  readonly language: HudLanguage;
  readonly roundNumber: number;
  readonly targetWins: number;
  readonly roundTimeMs: number;
  readonly suddenDeath: { readonly label: string; readonly progress: number; readonly active: boolean } | null;
  readonly players: Readonly<Record<PlayerId, MatchHudPlayerSnapshot>>;
}

export interface HudRectPresentation {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface MatchHudCenterPresentation extends HudRectPresentation {
  readonly modeLabel: string;
  readonly timerText: string;
  readonly timerY: number;
  readonly suddenDeath: MatchHudSnapshot["suddenDeath"];
}

export interface MatchHudRivalPresentation extends HudRectPresentation {
  readonly playerId: PlayerId;
  readonly slotLabel: string;
  readonly name: string;
  readonly scoreText: string;
  readonly ultimateLabel: string;
  readonly status: MatchHudStatusSnapshot;
}

export interface HudLocalPowerRailPresentation {
  readonly x: number;
  readonly width: number;
  readonly gap: number;
  readonly minSlotWidth: number;
  readonly maxSlotWidth: number;
  readonly slotHeight: number;
}

export interface HudUltimateChipPresentation {
  readonly visible: boolean;
  readonly ready: boolean;
  readonly casting: boolean;
  readonly onCooldown: boolean;
  readonly label: string;
  readonly text: string;
  readonly progress: number;
}

export interface MatchHudLocalPresentation extends HudRectPresentation {
  readonly playerId: PlayerId;
  readonly youLabel: string;
  readonly nameText: string;
  readonly nameTone: "normal" | "highlight" | "power";
  readonly status: MatchHudStatusSnapshot;
  readonly score: { readonly wins: number; readonly kills: number };
  readonly identityWidth: number;
  readonly contentInsetX: number;
  readonly powerRail: HudLocalPowerRailPresentation;
  readonly ultimateWidth: number;
  readonly ultimateGap: number;
  readonly rightInset: number;
  readonly ultimateChip: HudUltimateChipPresentation;
}

export interface MatchHudPresentation {
  readonly height: number;
  readonly compactBackdrop: boolean;
  readonly localPlayerId: PlayerId;
  readonly leftRivalIds: readonly PlayerId[];
  readonly rightRivalIds: readonly PlayerId[];
  readonly center: MatchHudCenterPresentation;
  readonly rivals: readonly MatchHudRivalPresentation[];
  readonly local: MatchHudLocalPresentation;
}

export function createMatchHudPresentation(snapshot: MatchHudSnapshot): MatchHudPresentation {
  const { leftRivals, rightRivals } = partitionHudPlayers(snapshot.activePlayerIds, snapshot.localPlayerId);
  const pad = HUD_LAYOUT.paddingX;
  const gap = HUD_LAYOUT.gap;
  const centerWidth = Math.min(HUD_LAYOUT.centerMaxWidth, HUD_LAYOUT.centerWidth + 20);
  const centerX = Math.round((snapshot.canvasWidth - centerWidth) / 2);
  const topY = HUD_LAYOUT.topRowY;
  const topH = HUD_LAYOUT.topRowHeight;

  const center: MatchHudCenterPresentation = {
    x: centerX,
    y: topY,
    width: centerWidth,
    height: topH,
    modeLabel: snapshot.mode === "endless"
      ? `R${snapshot.roundNumber} · ENDLESS`
      : `R${snapshot.roundNumber} · FT${snapshot.targetWins}`,
    timerText: Math.ceil(snapshot.roundTimeMs / 1000).toString().padStart(2, "0"),
    timerY: topY + (snapshot.suddenDeath ? 28 : 30),
    suddenDeath: snapshot.suddenDeath,
  };

  const leftGutter = Math.max(0, centerX - pad - gap);
  const leftSlotW = computeRivalSlotWidth(leftGutter, Math.max(1, leftRivals.length));
  const leftGroupWidth = leftRivals.length > 0
    ? leftSlotW * leftRivals.length + gap * (leftRivals.length - 1)
    : 0;
  // Keep sparse matchups attached to the clock instead of pinning a lone left
  // rival to the canvas edge. Four-player groups still naturally fill the gutter.
  const leftStartX = centerX - gap - leftGroupWidth;
  const rightStartX = centerX + centerWidth + gap;
  const rightGutter = Math.max(0, snapshot.canvasWidth - pad - rightStartX);
  const rightSlotW = computeRivalSlotWidth(rightGutter, Math.max(1, rightRivals.length));
  const rivals = [
    ...leftRivals.map((playerId, index) => buildRival(snapshot, playerId, leftStartX + index * (leftSlotW + gap), topY, leftSlotW, topH)),
    ...rightRivals.map((playerId, index) => buildRival(snapshot, playerId, rightStartX + index * (rightSlotW + gap), topY, rightSlotW, topH)),
  ];

  const localWidth = snapshot.canvasWidth - pad * 2;
  const localPlayer = snapshot.players[snapshot.localPlayerId];
  const localNameBudget = localWidth < 520 ? HUD_LAYOUT.localNameMax - 4 : HUD_LAYOUT.localNameMax;
  const recentTone = localPlayer.recentPickupTone ?? null;
  const ultimateChip = buildUltimateChip(localPlayer.skill, snapshot.language);
  const ultimateWidth = ultimateChip.visible ? HUD_LAYOUT.localUltimateWidth : 0;
  const ultimateGap = ultimateChip.visible ? HUD_LAYOUT.localSectionGap : 0;
  const powerRailX = pad + HUD_LAYOUT.localIdentityWidth + HUD_LAYOUT.localSectionGap;
  const powerRailRight = pad + localWidth - HUD_LAYOUT.localRightInset - ultimateWidth - ultimateGap;
  const local: MatchHudLocalPresentation = {
    x: pad,
    y: HUD_LAYOUT.localPanelY,
    width: localWidth,
    height: HUD_LAYOUT.localPanelHeight,
    playerId: snapshot.localPlayerId,
    youLabel: snapshot.language === "pt" ? "VOCÊ" : "YOU",
    nameText: ellipsisText(localPlayer.recentPickupLabel ?? localPlayer.displayName, localNameBudget),
    nameTone: recentTone ?? "normal",
    status: localPlayer.status,
    score: { wins: localPlayer.wins, kills: localPlayer.kills ?? 0 },
    identityWidth: HUD_LAYOUT.localIdentityWidth,
    contentInsetX: HUD_LAYOUT.localInsetX,
    powerRail: {
      x: powerRailX,
      width: Math.max(HUD_LAYOUT.skillSlotMinWidth, powerRailRight - powerRailX),
      gap: HUD_LAYOUT.skillSlotGap,
      minSlotWidth: HUD_LAYOUT.skillSlotMinWidth,
      maxSlotWidth: HUD_LAYOUT.skillSlotMaxWidth,
      slotHeight: HUD_LAYOUT.skillSlotHeight,
    },
    ultimateWidth,
    ultimateGap,
    rightInset: HUD_LAYOUT.localRightInset,
    ultimateChip,
  };

  return {
    height: HUD_LAYOUT.height,
    compactBackdrop: false,
    localPlayerId: snapshot.localPlayerId,
    leftRivalIds: leftRivals,
    rightRivalIds: rightRivals,
    center,
    rivals,
    local,
  };
}

function buildRival(
  snapshot: MatchHudSnapshot,
  playerId: PlayerId,
  x: number,
  y: number,
  width: number,
  height: number,
): MatchHudRivalPresentation {
  const player = snapshot.players[playerId];
  const slotW = Math.max(HUD_LAYOUT.rivalSlotMinWidth, width);
  // Reserve a real score column. Code-unit budgets are deliberately conservative
  // because the canvas cannot measure text inside this pure presentation seam.
  const nameBudget = slotW <= 160
    ? Math.max(6, HUD_LAYOUT.rivalNameMax - 6)
    : slotW <= 180
      ? HUD_LAYOUT.rivalNameMax - 4
      : HUD_LAYOUT.rivalNameMax - 2;
  return {
    x,
    y,
    width: slotW,
    height,
    playerId,
    slotLabel: player.slotLabel,
    name: ellipsisText(player.displayName, nameBudget),
    scoreText: formatHudScoreLine(snapshot.mode, { kills: player.kills ?? 0, wins: player.wins }),
    ultimateLabel: buildRivalUltimateLabel(player, snapshot.language),
    status: player.status,
  };
}

function buildRivalUltimateLabel(player: MatchHudPlayerSnapshot, language: HudLanguage): string {
  if (!player.alive) return "DOWN";
  if (player.status.tone === "danger" && player.status.critical) return player.status.label;
  if (!player.skill.hasUltimate) return "LIVE";
  if (player.skill.phase === "channeling" || player.skill.phase === "releasing") return "CAST";
  if (player.skill.phase === "cooldown" && player.skill.cooldownRemainingMs > 0) {
    return `ULT ${(player.skill.cooldownRemainingMs / 1000).toFixed(1)}`;
  }
  if (player.skill.phase === "idle") return language === "pt" ? "ULT OK" : "ULT RDY";
  return "LIVE";
}

function buildUltimateChip(skill: MatchHudSkillSnapshot, language: HudLanguage): HudUltimateChipPresentation {
  if (!skill.hasUltimate) {
    return { visible: false, ready: false, casting: false, onCooldown: false, label: "", text: "", progress: 0 };
  }
  const ready = skill.phase === "idle";
  const casting = skill.phase === "channeling" || skill.phase === "releasing";
  const onCooldown = skill.phase === "cooldown" && skill.cooldownRemainingMs > 0;
  let label = language === "pt" ? "ULT" : "ULT";
  let progress = 0;
  if (ready) {
    label = language === "pt" ? "OK" : "RDY";
    progress = 1;
  } else if (casting) {
    const total = Math.max(1, skill.castElapsedMs + skill.channelRemainingMs);
    label = "CAST";
    progress = Math.max(0, Math.min(1, skill.castElapsedMs / total));
  } else if (onCooldown) {
    const totalCd = Math.max(skill.cooldownRemainingMs, skill.cooldownTotalMs || skill.cooldownRemainingMs);
    label = `${(skill.cooldownRemainingMs / 1000).toFixed(1)}`;
    progress = 1 - Math.max(0, Math.min(1, skill.cooldownRemainingMs / totalCd));
  }
  return {
    visible: true,
    ready,
    casting,
    onCooldown,
    label,
    text: ready ? "ULT" : label,
    progress,
  };
}
