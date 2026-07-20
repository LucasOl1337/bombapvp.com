import { describe, expect, it } from "vitest";

import { getRuntimeAssetSources, resolveGameAsset } from "../game-assets/index.ts";
import { resolveArenaThemeSpriteSources } from "../src/original-game/Arenas/arena-theme-assets.ts";
import { getArenaThemeById } from "../src/original-game/Arenas/arena-theme-library.ts";

describe("arena theme asset source groups", () => {
  it("resolves required sprite roles with theme asset first and shared fallback second", () => {
    const theme = getArenaThemeById("arcane-citadel");
    expect(theme).toBeDefined();

    const sources = resolveArenaThemeSpriteSources(theme!);

    expect(sources?.floor.base).toEqual([
      resolveGameAsset("arena.theme.arcane-citadel.floor.base"),
      resolveGameAsset("arena.shared.floor.base"),
    ]);
    expect(sources?.floor.lane).toEqual([
      resolveGameAsset("arena.theme.arcane-citadel.floor.lane"),
      resolveGameAsset("arena.shared.floor.lane"),
    ]);
    expect(sources?.floor.spawn).toEqual([
      resolveGameAsset("arena.theme.arcane-citadel.floor.spawn"),
      resolveGameAsset("arena.shared.floor.spawn"),
    ]);
    expect(sources?.props.wall).toEqual([
      resolveGameAsset("arena.theme.arcane-citadel.wall"),
      resolveGameAsset("arena.shared.wall"),
    ]);
    expect(sources?.props.crate).toEqual([
      resolveGameAsset("arena.theme.arcane-citadel.crate"),
      resolveGameAsset("gameplay.crate.sprite"),
    ]);
  });

  it("keeps optional sprite variants theme-only with no fallback", () => {
    const theme = getArenaThemeById("tournament-clean");
    expect(theme).toBeDefined();

    const sources = resolveArenaThemeSpriteSources(theme!);

    expect(sources?.floor.baseAlt).toEqual([resolveGameAsset("arena.theme.tournament-clean.floor.base-alt")]);
    expect(sources?.floor.baseAlt2).toEqual([resolveGameAsset("arena.theme.tournament-clean.floor.base-alt2")]);
    expect(sources?.floor.baseAlt3).toEqual([resolveGameAsset("arena.theme.tournament-clean.floor.base-alt3")]);
    expect(sources?.floor.portal).toEqual([resolveGameAsset("arena.theme.tournament-clean.floor.portal")]);
    expect(sources?.props.wallAlt).toEqual([resolveGameAsset("arena.theme.tournament-clean.wall-alt")]);
    expect(sources?.props.crateAlt).toEqual([resolveGameAsset("arena.theme.tournament-clean.crate-alt")]);
  });

  it("returns empty optional groups when a sprite theme omits optional variants", () => {
    const theme = getArenaThemeById("arcane-citadel");
    expect(theme).toBeDefined();

    const sources = resolveArenaThemeSpriteSources(theme!);

    expect(sources?.floor.baseAlt).toEqual([]);
    expect(sources?.floor.baseAlt2).toEqual([]);
    expect(sources?.floor.baseAlt3).toEqual([]);
    expect(sources?.floor.portal).toEqual([]);
    expect(sources?.props.wallAlt).toEqual([]);
    expect(sources?.props.crateAlt).toEqual([]);
  });

  it("does not produce sprite source groups for procedural themes", () => {
    const theme = getArenaThemeById("verdant-ruins");
    expect(theme?.renderMode).toBe("procedural");

    expect(resolveArenaThemeSpriteSources(theme!)).toBeNull();
  });
});

describe("runtime asset source groups", () => {
  it("keeps stable non-theme runtime asset roles and ordering", () => {
    expect(getRuntimeAssetSources()).toEqual({
      crateBreakFrames: [
        resolveGameAsset("gameplay.crate.break.0"),
        resolveGameAsset("gameplay.crate.break.1"),
        resolveGameAsset("gameplay.crate.break.2"),
        resolveGameAsset("gameplay.crate.break.3"),
      ],
      bomb: {
        sprite: resolveGameAsset("gameplay.bomb.sprite"),
        flame: resolveGameAsset("gameplay.bomb.flame"),
        flameAnimSheet: resolveGameAsset("gameplay.bomb.flame.anim-sheet"),
      },
      effects: {
        speedSparkTrail: resolveGameAsset("effect.movement.speed-spark-trail"),
      },
      arenaOutcomeUi: {
        victoryEmblem: resolveGameAsset("ui.arena.victory-emblem"),
        stalemateEmblem: resolveGameAsset("ui.arena.stalemate-emblem"),
      },
      hudKit: {
        panelLocal: resolveGameAsset("ui.hud.chrome.local"),
        panelRival: resolveGameAsset("ui.hud.chrome.rival"),
        panelCenter: resolveGameAsset("ui.hud.chrome.center"),
        chipUlt: resolveGameAsset("ui.hud.chrome.ult"),
        iconBomb: resolveGameAsset("ui.hud.icon.bomb"),
        iconFlame: resolveGameAsset("ui.hud.icon.flame"),
        iconSpeed: resolveGameAsset("ui.hud.icon.speed"),
      },
    });
  });
});
