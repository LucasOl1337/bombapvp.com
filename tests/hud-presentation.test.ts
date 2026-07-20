import { describe, expect, it } from "vitest";

import type { PlayerId } from "../src/original-game/Gameplay/types";
import {
  createMatchHudPresentation,
  type HudLanguage,
  type HudMode,
  type HudSkillPhase,
  type MatchHudPlayerSnapshot,
  type MatchHudSnapshot,
} from "../src/original-game/Engine/hud-presentation";
import { HUD_LAYOUT } from "../src/original-game/Engine/hud-format";

const IDS = [1, 2, 3, 4] as const satisfies readonly PlayerId[];

function player(
  id: PlayerId,
  overrides: Partial<MatchHudPlayerSnapshot> = {},
): MatchHudPlayerSnapshot {
  return {
    id,
    slotLabel: `P${id}`,
    displayName: `Player ${id}`,
    alive: true,
    wins: id - 1,
    kills: id + 1,
    status: { label: "LIVE", tone: "success", critical: false },
    skill: {
      hasUltimate: false,
      phase: "inactive",
      cooldownRemainingMs: 0,
      cooldownTotalMs: 0,
      castElapsedMs: 0,
      channelRemainingMs: 0,
    },
    recentPickupLabel: null,
    recentPickupTone: null,
    ...overrides,
  };
}

function snapshot(overrides: Partial<MatchHudSnapshot> = {}): MatchHudSnapshot {
  return {
    canvasWidth: 960,
    activePlayerIds: IDS,
    localPlayerId: 1,
    mode: "standard",
    language: "en",
    roundNumber: 2,
    targetWins: 3,
    roundTimeMs: 91_200,
    suddenDeath: null,
    players: {
      1: player(1),
      2: player(2),
      3: player(3),
      4: player(4),
    },
    ...overrides,
  };
}

function ultimate(phase: HudSkillPhase, cooldownRemainingMs = 0) {
  return {
    hasUltimate: true,
    phase,
    cooldownRemainingMs,
    cooldownTotalMs: 10_000,
    castElapsedMs: 300,
    channelRemainingMs: 700,
  } as const;
}

describe("createMatchHudPresentation", () => {
  it("builds a solo HUD with only the local panel", () => {
    const hud = createMatchHudPresentation(snapshot({ activePlayerIds: [1] }));

    expect(hud.rivals).toEqual([]);
    expect(hud.local.playerId).toBe(1);
    expect(hud.local.youLabel).toBe("YOU");
    expect(hud.center.modeLabel).toBe("R2 · FT3");
    expect(hud.center.timerText).toBe("92");
  });

  it("places one rival to the right of center and formats endless score", () => {
    const hud = createMatchHudPresentation(snapshot({ activePlayerIds: [1, 2], mode: "endless" }));

    expect(hud.leftRivalIds).toEqual([]);
    expect(hud.rightRivalIds).toEqual([2]);
    expect(hud.rivals[0]?.scoreText).toBe("K3 W1");
    expect(hud.center.modeLabel).toBe("R2 · ENDLESS");
  });

  it("supports non-P1 local seats in three-player matches", () => {
    const hud = createMatchHudPresentation(snapshot({ activePlayerIds: [1, 2, 3], localPlayerId: 2 }));

    expect(hud.local.playerId).toBe(2);
    expect(hud.rivals.map((rival) => rival.playerId).sort()).toEqual([1, 3]);
    expect(hud.leftRivalIds).toEqual([1]);
    expect(hud.rightRivalIds).toEqual([3]);
    const left = hud.rivals.find((rival) => rival.playerId === 1)!;
    const right = hud.rivals.find((rival) => rival.playerId === 3)!;
    expect(hud.center.x - (left.x + left.width)).toBe(HUD_LAYOUT.gap);
    expect(right.x - (hud.center.x + hud.center.width)).toBe(HUD_LAYOUT.gap);
  });

  it("keeps four-player geometry centered and within HUD rows", () => {
    const hud = createMatchHudPresentation(snapshot());

    expect(hud.center.x + hud.center.width / 2).toBe(480);
    expect(hud.center.width).toBeLessThanOrEqual(HUD_LAYOUT.centerMaxWidth);
    expect(hud.rivals).toHaveLength(3);
    expect(hud.rivals.every((rival) => rival.y === HUD_LAYOUT.topRowY)).toBe(true);
    expect(hud.rivals.every((rival) => rival.height === HUD_LAYOUT.topRowHeight)).toBe(true);
    expect(hud.local.y + hud.local.height).toBeLessThanOrEqual(hud.height);
    expect(hud.local.powerRail.x).toBeGreaterThanOrEqual(hud.local.x + hud.local.identityWidth);
    expect(hud.local.powerRail.x + hud.local.powerRail.width + hud.local.ultimateGap + hud.local.ultimateWidth)
      .toBeLessThanOrEqual(hud.local.x + hud.local.width - hud.local.rightInset);
    expect(Math.max(...hud.leftRivalIds.map((id) => hud.rivals.find((rival) => rival.playerId === id)?.x ?? 0)))
      .toBeLessThan(hud.center.x);
    expect(Math.min(...hud.rightRivalIds.map((id) => hud.rivals.find((rival) => rival.playerId === id)?.x ?? 0)))
      .toBeGreaterThan(hud.center.x);
  });

  it("localizes ultimate ready labels for rivals and local identity", () => {
    const make = (language: HudLanguage) => createMatchHudPresentation(snapshot({
      activePlayerIds: [1, 2],
      language,
      players: {
        1: player(1, { skill: ultimate("idle") }),
        2: player(2, { skill: ultimate("idle") }),
        3: player(3),
        4: player(4),
      },
    }));

    expect(make("en").rivals[0]?.ultimateLabel).toBe("ULT RDY");
    expect(make("pt").rivals[0]?.ultimateLabel).toBe("ULT OK");
    expect(make("pt").local.youLabel).toBe("VOCÊ");
    expect(make("en").local.ultimateChip.text).toBe("ULT");
    expect(make("en").local.ultimateWidth).toBe(HUD_LAYOUT.localUltimateWidth);
  });

  it("returns ultimate space to the local power rail when no skill is equipped", () => {
    const withoutUltimate = createMatchHudPresentation(snapshot({ activePlayerIds: [1, 2] }));
    const withUltimate = createMatchHudPresentation(snapshot({
      activePlayerIds: [1, 2],
      players: {
        1: player(1, { skill: ultimate("idle") }),
        2: player(2),
        3: player(3),
        4: player(4),
      },
    }));

    expect(withoutUltimate.local.ultimateWidth).toBe(0);
    expect(withoutUltimate.local.powerRail.width).toBeGreaterThan(withUltimate.local.powerRail.width);
  });

  it("translates cooldown, casting, danger, and down labels without gameplay state", () => {
    const hud = createMatchHudPresentation(snapshot({
      activePlayerIds: [1, 2, 3, 4],
      players: {
        1: player(1, { skill: ultimate("cooldown", 5_200) }),
        2: player(2, { skill: ultimate("cooldown", 4_400) }),
        3: player(3, { skill: ultimate("channeling") }),
        4: player(4, {
          alive: false,
          status: { label: "DOWN", tone: "muted", critical: false },
          skill: ultimate("idle"),
        }),
      },
    }));

    expect(hud.local.ultimateChip.onCooldown).toBe(true);
    expect(hud.local.ultimateChip.label).toBe("5.2");
    expect(hud.rivals.find((rival) => rival.playerId === 2)?.ultimateLabel).toBe("ULT 4.4");
    expect(hud.rivals.find((rival) => rival.playerId === 3)?.ultimateLabel).toBe("CAST");
    expect(hud.rivals.find((rival) => rival.playerId === 4)?.ultimateLabel).toBe("DOWN");

    const danger = createMatchHudPresentation(snapshot({
      activePlayerIds: [1, 2],
      players: {
        1: player(1),
        2: player(2, { status: { label: "DANGER 0.4s", tone: "danger", critical: true }, skill: ultimate("idle") }),
        3: player(3),
        4: player(4),
      },
    }));
    expect(danger.rivals[0]?.ultimateLabel).toBe("DANGER 0.4s");
  });

  it("applies narrow name budgets and preserves pickup name override", () => {
    const hud = createMatchHudPresentation(snapshot({
      canvasWidth: 360,
      activePlayerIds: [1, 2],
      players: {
        1: player(1, { displayName: "Very Long Local Champion Name", recentPickupLabel: "+Massive Power x10", recentPickupTone: "power" }),
        2: player(2, { displayName: "Extremely Long Rival Champion Name" }),
        3: player(3),
        4: player(4),
      },
    }));

    expect(hud.local.nameText.length).toBeLessThanOrEqual(HUD_LAYOUT.localNameMax - 4);
    expect(hud.local.nameText).toContain("…");
    expect(hud.local.nameTone).toBe("power");
    expect(hud.rivals[0]?.name.length).toBeLessThanOrEqual(HUD_LAYOUT.rivalNameMax);
  });

  it("keeps standard score semantics as wins only", () => {
    const hud = createMatchHudPresentation(snapshot({ mode: "standard" satisfies HudMode, activePlayerIds: [1, 2] }));

    expect(hud.rivals[0]?.scoreText).toBe("W1");
    expect(hud.local.score).toEqual({ wins: 0, kills: 2 });
  });
});
