import type {
  Direction,
  PixelCoord,
  PlayerId,
  PlayerState,
  TileCoord,
} from "../../src/original-game/Gameplay/types";
import { tileKey } from "../../src/original-game/Arenas/arena";
import { TILE_SIZE } from "../../src/original-game/PersonalConfig/config";
import type { SkillContext } from "../../src/original-game/ultimate/shared";
import type { ChampionSkillAdapter } from "../runtime-contracts";
import type { MadaraFireballEffect } from "./contracts";
import {
  MADARA_SKILL_COOLDOWN_MS,
  MADARA_SKILL_ID,
} from "./identity";

export {
  MADARA_CHARACTER_ID,
  MADARA_SKILL_ID,
  MADARA_SKILL_COOLDOWN_MS,
} from "./identity";

/** Madara fantasy: Fireball Jutsu — straight-line fireball that burns crates. */
export const MADARA_FIREBALL_RANGE_TILES = 4;
export const MADARA_MAX_BURNED_BOXES = 3;
export const MADARA_CHANNEL_MS = 220;
export const MADARA_FIREBALL_VISUAL_MS = 520;
export const MADARA_FIRE_LINGER_MS = 2_500;
export const MADARA_CAST_FRAME_MS = 55;
export const MADARA_FIZZLE_COOLDOWN_MS = 1_500;

const directionDelta: Record<Direction, TileCoord> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export type MadaraSkillContext = Pick<
  SkillContext,
  | "arena"
  | "bombs"
  | "players"
  | "activePlayerIds"
  | "addChampionWorldEffect"
  | "canOccupyPosition"
  | "getTileFromPosition"
  | "normalizeArenaPosition"
  | "tryAbsorbInstantHit"
  | "breakCrateAtKey"
  | "addFlame"
  | "soundManager"
>;

function tileCenter(tile: TileCoord): PixelCoord {
  return {
    x: tile.x * TILE_SIZE + TILE_SIZE * 0.5,
    y: tile.y * TILE_SIZE + TILE_SIZE * 0.5,
  };
}

function isOutOfBounds(tile: TileCoord, context: MadaraSkillContext): boolean {
  const { width, height } = context.arena.config.grid;
  return tile.x < 0 || tile.x >= width || tile.y < 0 || tile.y >= height;
}

function isSolid(tile: TileCoord, context: MadaraSkillContext): boolean {
  const key = tileKey(tile.x, tile.y);
  return context.arena.solid.has(key) || context.arena.breakable.has(key);
}

function isBomb(tile: TileCoord, context: MadaraSkillContext): boolean {
  return context.bombs.some(
    (bomb) => bomb.tile.x === tile.x && bomb.tile.y === tile.y,
  );
}

function isBlocked(tile: TileCoord, context: MadaraSkillContext): boolean {
  return isOutOfBounds(tile, context) || isSolid(tile, context) || isBomb(tile, context);
}

function findPlayerOnTile(
  tile: TileCoord,
  excludeId: number,
  context: MadaraSkillContext,
): PlayerState | null {
  for (const id of context.activePlayerIds) {
    if (id === excludeId) continue;
    const other = context.players[id];
    if (!other?.alive) continue;
    const otherTile = context.getTileFromPosition(other.position);
    if (otherTile.x === tile.x && otherTile.y === tile.y) {
      return other;
    }
  }
  return null;
}

/** Lateral tiles relative to the fireball direction (left + right of the end tile). */
function lateralTiles(
  tile: TileCoord,
  direction: Direction,
): TileCoord[] {
  switch (direction) {
    case "up":
    case "down":
      return [
        { x: tile.x - 1, y: tile.y },
        { x: tile.x + 1, y: tile.y },
      ];
    case "left":
    case "right":
      return [
        { x: tile.x, y: tile.y - 1 },
        { x: tile.x, y: tile.y + 1 },
      ];
  }
}

export interface MadaraFireballResult {
  /** Tiles the fireball actually occupied (not including start tile). */
  pathTiles: TileCoord[];
  detonation: TileCoord;
  boxesBurned: number;
  hitPlayer: boolean;
}

/**
 * Resolve the fireball path instantly. It stops on the first solid wall, bomb,
 * or player, or after burning `MADARA_MAX_BURNED_BOXES` crates. The detonation
 * tile is the last free tile processed.
 */
export function resolveFireballPath(
  origin: TileCoord,
  direction: Direction,
  ownerId: PlayerId,
  context: MadaraSkillContext,
): MadaraFireballResult | null {
  const delta = directionDelta[direction];
  const pathTiles: TileCoord[] = [];
  let boxesBurned = 0;
  let hitPlayer = false;
  let detonation: TileCoord | null = null;

  for (let step = 1; step <= MADARA_FIREBALL_RANGE_TILES; step += 1) {
    const tile = { x: origin.x + delta.x * step, y: origin.y + delta.y * step };

    if (isOutOfBounds(tile, context)) {
      break;
    }

    const key = tileKey(tile.x, tile.y);

    if (context.arena.solid.has(key)) {
      break;
    }

    const victim = findPlayerOnTile(tile, ownerId, context);
    if (victim) {
      pathTiles.push({ ...tile });
      detonation = { ...tile };
      hitPlayer = true;
      context.tryAbsorbInstantHit(victim, ownerId);
      break;
    }

    if (context.arena.breakable.has(key)) {
      context.breakCrateAtKey(key);
      boxesBurned += 1;
      pathTiles.push({ ...tile });
      detonation = { ...tile };
      if (boxesBurned >= MADARA_MAX_BURNED_BOXES) {
        break;
      }
      continue;
    }

    if (isBomb(tile, context)) {
      // Fireball detonates before the bomb (same as a wall for safety).
      break;
    }

    pathTiles.push({ ...tile });
    detonation = { ...tile };
  }

  if (!detonation) {
    return null;
  }

  return { pathTiles, detonation, boxesBurned, hitPlayer };
}

function igniteDetonation(
  detonation: TileCoord,
  direction: Direction,
  ownerId: PlayerId,
  context: MadaraSkillContext,
): void {
  const candidates = [
    { ...detonation },
    ...lateralTiles(detonation, direction),
  ];
  for (const tile of candidates) {
    if (isBlocked(tile, context)) continue;
    context.addFlame(tile, MADARA_FIRE_LINGER_MS, "normal", ownerId);
  }
}

function spawnFireballEffect(
  origin: TileCoord,
  direction: Direction,
  result: MadaraFireballResult,
  ownerId: PlayerId,
  context: MadaraSkillContext,
): void {
  const effect: MadaraFireballEffect = {
    kind: "madara-fireball-jutsu",
    ownerId,
    origin: { ...origin },
    direction,
    detonation: { ...result.detonation },
    pathTiles: result.pathTiles,
    remainingMs: MADARA_FIREBALL_VISUAL_MS,
  };
  context.addChampionWorldEffect(effect);
}

/** Fire the fireball, apply crate breaks / player hit / flames, and spawn FX. */
export function fireFireballJutsu(
  player: PlayerState,
  direction: Direction,
  context: MadaraSkillContext,
): boolean {
  const origin = context.getTileFromPosition(player.position);
  const result = resolveFireballPath(origin, direction, player.id, context);
  if (!result) {
    return false;
  }
  igniteDetonation(result.detonation, direction, player.id, context);
  spawnFireballEffect(origin, direction, result, player.id, context);
  context.soundManager.playOneShot(
    result.hitPlayer || result.boxesBurned > 0 ? "bombExplode" : "powerCollect",
  );
  return true;
}

export const MADARA_SKILL_ADAPTER: ChampionSkillAdapter = {
  skillId: MADARA_SKILL_ID,
  activate: (player, direction, context) =>
    startFireballJutsu(player, direction, context),
  update: (player, direction, _pressed, _held, deltaMs, context) =>
    updateFireballJutsu(player, direction, deltaMs, context),
  projectTarget: computeFireballTarget,
};
export const CHAMPION_SKILL_ADAPTER = MADARA_SKILL_ADAPTER;

function isFirstTileBlocked(tile: TileCoord, context: MadaraSkillContext): boolean {
  if (isOutOfBounds(tile, context)) return true;
  const key = tileKey(tile.x, tile.y);
  if (context.arena.solid.has(key)) return true;
  return isBomb(tile, context);
}

export function startFireballJutsu(
  player: PlayerState,
  desiredDirection: Direction | null,
  context: MadaraSkillContext,
): void {
  if (player.skill.id !== MADARA_SKILL_ID) {
    return;
  }
  const aim =
    desiredDirection ?? player.lastMoveDirection ?? player.direction;
  const origin = context.getTileFromPosition(player.position);
  const firstTile = {
    x: origin.x + directionDelta[aim].x,
    y: origin.y + directionDelta[aim].y,
  };
  if (isFirstTileBlocked(firstTile, context)) {
    // Lane blocked right in front — fizzle with a short refund.
    finishFireballJutsu(player, MADARA_FIZZLE_COOLDOWN_MS);
    return;
  }
  player.direction = aim;
  player.lastMoveDirection = aim;
  player.skill.phase = "channeling";
  player.skill.channelRemainingMs = MADARA_CHANNEL_MS;
  player.skill.cooldownRemainingMs = 0;
  player.skill.castElapsedMs = 0;
  player.skill.projectedPosition = null;
  player.skill.projectedLastMoveDirection = aim;
  player.velocity.x = 0;
  player.velocity.y = 0;
}

export function updateFireballJutsu(
  player: PlayerState,
  _desiredDirection: Direction | null,
  deltaMs: number,
  context: MadaraSkillContext,
): boolean {
  if (player.skill.id !== MADARA_SKILL_ID) {
    return false;
  }
  if (!Number.isFinite(deltaMs) || deltaMs <= 0) {
    return player.skill.phase === "channeling";
  }
  if (player.skill.phase !== "channeling") {
    return false;
  }

  player.velocity.x = 0;
  player.velocity.y = 0;
  player.skill.channelRemainingMs = Math.max(
    0,
    player.skill.channelRemainingMs - deltaMs,
  );
  player.skill.castElapsedMs += deltaMs;

  if (player.skill.channelRemainingMs <= 0) {
    const aim =
      player.skill.projectedLastMoveDirection ?? player.lastMoveDirection ?? player.direction;
    fireFireballJutsu(player, aim, context);
    finishFireballJutsu(player, MADARA_SKILL_COOLDOWN_MS);
  }
  return true;
}

export function finishFireballJutsu(
  player: PlayerState,
  cooldownMs: number,
): void {
  if (player.skill.id !== MADARA_SKILL_ID) {
    return;
  }
  player.velocity.x = 0;
  player.velocity.y = 0;
  player.skill.phase = "cooldown";
  player.skill.channelRemainingMs = 0;
  player.skill.cooldownRemainingMs = cooldownMs;
  player.skill.castElapsedMs = 0;
  player.skill.projectedPosition = null;
  player.skill.projectedLastMoveDirection = null;
}

/** Aim preview: center of the farthest tile the fireball can reach. */
export function computeFireballTarget(
  player: PlayerState,
  direction: Direction,
  context: MadaraSkillContext,
): PixelCoord {
  const origin = context.getTileFromPosition(player.position);
  const result = resolveFireballPath(origin, direction, player.id, context);
  const target = result?.detonation ?? origin;
  return context.normalizeArenaPosition(tileCenter(target));
}
