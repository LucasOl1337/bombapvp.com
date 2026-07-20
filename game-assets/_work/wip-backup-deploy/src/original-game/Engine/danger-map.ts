import { BOMB_FUSE_MS } from "../PersonalConfig/config";
import type {
  ArenaState,
  BombState,
  FlameState,
  TileCoord,
} from "../Gameplay/types";
import { tileKey } from "../Gameplay/tile-key";
import {
  getBombBlastKeys as projectBombBlastKeys,
  projectBombDanger,
  type ExplosionBomb,
} from "./bomb-explosions";

export const DANGER_FORECAST_BOMB_FUSE_BUFFER_MS = 1000;
export const SUDDEN_DEATH_FALL_MS = 340;
export const SUDDEN_DEATH_TICK_MS = 900;

export interface DangerMapContext {
  bombs: BombState[];
  flames: FlameState[];
  arena: {
    config: Pick<ArenaState["config"], "grid">;
    solid: ReadonlySet<string>;
    breakable: ReadonlySet<string>;
  };
  suddenDeathActive: boolean;
  suddenDeathTickMs: number;
  suddenDeathIndex: number;
  suddenDeathPath: TileCoord[];
  suddenDeathClosureEffects: Array<{ tile: TileCoord; elapsedMs: number; impacted: boolean }>;
}

export interface ProjectedBomb {
  tile: TileCoord;
  range: number;
  fuseMs: number;
}

export function buildDangerMap(
  context: DangerMapContext,
  extraBomb?: ProjectedBomb,
): Map<string, number> {
  const danger = new Map<string, number>();
  const registerDanger = (key: string, fuseMs: number): void => {
    const previous = danger.get(key);
    if (previous === undefined || fuseMs < previous) {
      danger.set(key, fuseMs);
    }
  };

  const bombsToProject: ExplosionBomb[] = context.bombs
    .filter((bomb) => bomb.fuseMs <= BOMB_FUSE_MS + DANGER_FORECAST_BOMB_FUSE_BUFFER_MS)
    .map((bomb) => ({
      id: bomb.id,
      tile: bomb.tile,
      fuseMs: Math.max(0, bomb.fuseMs),
      flameRange: bomb.flameRange,
    }));

  if (extraBomb) {
    const extraBombId = bombsToProject.reduce((maxId, bomb) => Math.max(maxId, bomb.id), 0) + 1;
    bombsToProject.push({
      id: extraBombId,
      tile: extraBomb.tile,
      fuseMs: Math.max(0, extraBomb.fuseMs),
      flameRange: extraBomb.range,
    });
  }

  const projectedDanger = projectBombDanger({
    bombs: bombsToProject,
    arena: {
      width: context.arena.config.grid.width,
      height: context.arena.config.grid.height,
      solid: context.arena.solid,
      breakable: context.arena.breakable,
    },
  });
  for (const [key, fuseMs] of projectedDanger) {
    registerDanger(key, fuseMs);
  }

  for (const effect of context.suddenDeathClosureEffects) {
    if (!effect.impacted) {
      registerDanger(
        tileKey(effect.tile.x, effect.tile.y),
        Math.max(0, SUDDEN_DEATH_FALL_MS - effect.elapsedMs),
      );
    }
  }

  if (context.suddenDeathActive && context.suddenDeathIndex < context.suddenDeathPath.length) {
    const nextTickMs = Math.max(0, context.suddenDeathTickMs);
    for (let index = context.suddenDeathIndex; index < context.suddenDeathPath.length; index += 1) {
      const tile = context.suddenDeathPath[index];
      if (!tile) continue;
      registerDanger(
        tileKey(tile.x, tile.y),
        nextTickMs + (index - context.suddenDeathIndex) * SUDDEN_DEATH_TICK_MS,
      );
    }
  }

  return danger;
}

export function getBombBlastKeys(
  origin: TileCoord,
  range: number,
  arena: Pick<ArenaState, "config" | "solid" | "breakable">,
): Set<string> {
  return projectBombBlastKeys({
    origin,
    range,
    arena: {
      width: arena.config.grid.width,
      height: arena.config.grid.height,
      solid: arena.solid,
      breakable: arena.breakable,
    },
  });
}
