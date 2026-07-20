import { resolveGameAsset } from "../../../game-assets";
import type { ArenaThemeDefinition } from "./arena-theme-library";

export interface ArenaThemeSpriteSources {
  readonly floor: Readonly<{
    readonly base: readonly string[];
    readonly baseAlt: readonly string[];
    readonly baseAlt2: readonly string[];
    readonly baseAlt3: readonly string[];
    readonly lane: readonly string[];
    readonly spawn: readonly string[];
    readonly portal: readonly string[];
  }>;
  readonly props: Readonly<{
    readonly wall: readonly string[];
    readonly wallAlt: readonly string[];
    readonly crate: readonly string[];
    readonly crateAlt: readonly string[];
  }>;
}

export function resolveArenaThemeSpriteSources(theme: ArenaThemeDefinition): ArenaThemeSpriteSources | null {
  const tilePaths = theme.renderMode === "sprite" ? theme.tilePaths : undefined;
  if (!tilePaths) {
    return null;
  }

  return {
    floor: {
      base: [resolveGameAsset(tilePaths.base), resolveGameAsset("arena.shared.floor.base")],
      baseAlt: tilePaths.baseAlt ? [resolveGameAsset(tilePaths.baseAlt)] : [],
      baseAlt2: tilePaths.baseAlt2 ? [resolveGameAsset(tilePaths.baseAlt2)] : [],
      baseAlt3: tilePaths.baseAlt3 ? [resolveGameAsset(tilePaths.baseAlt3)] : [],
      lane: [resolveGameAsset(tilePaths.lane), resolveGameAsset("arena.shared.floor.lane")],
      spawn: [resolveGameAsset(tilePaths.spawn), resolveGameAsset("arena.shared.floor.spawn")],
      portal: tilePaths.portal ? [resolveGameAsset(tilePaths.portal)] : [],
    },
    props: {
      wall: [resolveGameAsset(tilePaths.wall), resolveGameAsset("arena.shared.wall")],
      wallAlt: tilePaths.wallAlt ? [resolveGameAsset(tilePaths.wallAlt)] : [],
      crate: [resolveGameAsset(tilePaths.crate), resolveGameAsset("gameplay.crate.sprite")],
      crateAlt: tilePaths.crateAlt ? [resolveGameAsset(tilePaths.crateAlt)] : [],
    },
  };
}
