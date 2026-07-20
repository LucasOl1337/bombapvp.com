import { resolveGameAsset } from "./catalog";

export interface RuntimeAssetSources {
  readonly crateBreakFrames: readonly [string, string, string, string];
  readonly bomb: Readonly<{
    readonly sprite: string;
    readonly flame: string;
    readonly flameAnimSheet: string;
  }>;
  readonly effects: Readonly<{
    readonly speedSparkTrail: string;
  }>;
  readonly arenaOutcomeUi: Readonly<{
    readonly victoryEmblem: string;
    readonly stalemateEmblem: string;
  }>;
  readonly hudKit: Readonly<{
    readonly panelLocal: string;
    readonly panelRival: string;
    readonly panelCenter: string;
    readonly chipUlt: string;
    readonly iconBomb: string;
    readonly iconFlame: string;
    readonly iconSpeed: string;
  }>;
}

export function getRuntimeAssetSources(): RuntimeAssetSources {
  return {
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
  };
}
