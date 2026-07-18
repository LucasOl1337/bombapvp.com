import type {
  Direction,
  PlayerState,
  TileCoord,
} from "../../src/original-game/Gameplay/types";
import { tileKey } from "../../src/original-game/Arenas/arena";
import type { SkillContext } from "../../src/original-game/ultimate/shared";
import type { ChampionSkillAdapter } from "../runtime-contracts";
import type { PendulaShockwaveEffect } from "./contracts";
import {
  PENDULA_SKILL_COOLDOWN_MS,
  PENDULA_SKILL_ID,
} from "./definition";

export {
  PENDULA_CHARACTER_ID,
  PENDULA_SKILL_COOLDOWN_MS,
} from "./definition";

export const PENDULA_SKILL_CHANNEL_MS = 900;
export const PENDULA_VOLUNTARY_CANCEL_COOLDOWN_MS = 500;
export const PENDULA_SHOCKWAVE_RANGE = 2;
export const PENDULA_SHOCKWAVE_PUSH_TILES = 1;
export const PENDULA_SHOCKWAVE_VISUAL_MS = 320;
export const PENDULA_SHOCKWAVE_FUSE_PENALTY_MS = 80;
export const PENDULA_SHOCKWAVE_FUSE_FLOOR_MS = 400;

const directionDelta: Record<Direction, TileCoord> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

function chebyshev(a: TileCoord, b: TileCoord): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

function sign(n: number): number {
  if (n > 0) return 1;
  if (n < 0) return -1;
  return 0;
}

function isTileBlockedForBomb(
  tile: TileCoord,
  bombId: number,
  context: SkillContext,
): boolean {
  const key = tileKey(tile.x, tile.y);
  if (context.arena.solid.has(key) || context.arena.breakable.has(key)) {
    return true;
  }
  if (
    context.bombs.some(
      (item) =>
        item.id !== bombId && item.tile.x === tile.x && item.tile.y === tile.y,
    )
  ) {
    return true;
  }
  for (const playerId of context.activePlayerIds) {
    const other = context.players[playerId];
    if (
      other?.alive &&
      context.isPositionOverlappingTile(other.position, tile)
    ) {
      return true;
    }
  }
  return false;
}

function pushDirectionFromCenter(
  center: TileCoord,
  bombTile: TileCoord,
  fallback: Direction,
): TileCoord {
  const dx = sign(bombTile.x - center.x);
  const dy = sign(bombTile.y - center.y);
  if (dx === 0 && dy === 0) {
    return directionDelta[fallback];
  }
  // Prefer pure cardinals when diagonal (more readable bomb slides).
  if (dx !== 0 && dy !== 0) {
    return Math.abs(bombTile.x - center.x) >= Math.abs(bombTile.y - center.y)
      ? { x: dx, y: 0 }
      : { x: 0, y: dy };
  }
  return { x: dx, y: dy };
}

export function tryPushBombAway(
  bombId: number,
  center: TileCoord,
  fallbackDirection: Direction,
  context: SkillContext,
): boolean {
  const bomb = context.bombs.find((item) => item.id === bombId);
  if (!bomb) {
    return false;
  }
  const delta = pushDirectionFromCenter(center, bomb.tile, fallbackDirection);
  let target = { ...bomb.tile };
  let moved = 0;
  for (let step = 0; step < PENDULA_SHOCKWAVE_PUSH_TILES; step += 1) {
    const next = {
      x: target.x + delta.x,
      y: target.y + delta.y,
    };
    if (isTileBlockedForBomb(next, bomb.id, context)) {
      break;
    }
    target = next;
    moved += 1;
  }
  if (moved <= 0) {
    return false;
  }
  bomb.tile = target;
  bomb.ownerCanPass = false;
  bomb.bodyEgressPlayerIds = [];
  bomb.fuseMs = Math.max(
    PENDULA_SHOCKWAVE_FUSE_FLOOR_MS,
    bomb.fuseMs - moved * PENDULA_SHOCKWAVE_FUSE_PENALTY_MS,
  );
  return true;
}

export function firePendulaShockwave(
  player: PlayerState,
  context: SkillContext,
): number {
  const center = context.getTileFromPosition(player.position);
  const facing =
    player.skill.projectedLastMoveDirection ??
    player.lastMoveDirection ??
    player.direction;
  let pushed = 0;
  // Snapshot ids so concurrent tile moves do not skip bombs.
  const bombIds = context.bombs.map((bomb) => bomb.id);
  for (const bombId of bombIds) {
    const bomb = context.bombs.find((item) => item.id === bombId);
    if (!bomb) continue;
    if (chebyshev(center, bomb.tile) > PENDULA_SHOCKWAVE_RANGE) continue;
    if (tryPushBombAway(bomb.id, center, facing, context)) {
      pushed += 1;
    }
  }
  const effect: PendulaShockwaveEffect = {
    kind: "pendula-shockwave",
    ownerId: player.id,
    origin: { ...center },
    remainingMs: PENDULA_SHOCKWAVE_VISUAL_MS,
    maxRadiusTiles: PENDULA_SHOCKWAVE_RANGE,
  };
  context.addChampionWorldEffect(effect);
  context.soundManager.playOneShot("bomb_place");
  return pushed;
}

export const PENDULA_SKILL_ADAPTER: ChampionSkillAdapter = {
  skillId: PENDULA_SKILL_ID,
  activate: (player, direction) => startPendulaShockwave(player, direction),
  update: (player, direction, _pressed, held, deltaMs, context) =>
    updatePendulaShockwaveChannel(player, direction, held, deltaMs, context),
};

export function startPendulaShockwave(
  player: PlayerState,
  desiredDirection: Direction | null,
): void {
  if (player.skill.id !== PENDULA_SKILL_ID) {
    return;
  }
  const aim =
    desiredDirection ?? player.lastMoveDirection ?? player.direction;
  player.direction = aim;
  player.lastMoveDirection = aim;
  player.skill.phase = "channeling";
  player.skill.channelRemainingMs = PENDULA_SKILL_CHANNEL_MS;
  player.skill.cooldownRemainingMs = 0;
  player.skill.castElapsedMs = 0;
  player.skill.projectedPosition = null;
  player.skill.projectedLastMoveDirection = aim;
  player.velocity.x = 0;
  player.velocity.y = 0;
}

export function updatePendulaShockwaveChannel(
  player: PlayerState,
  desiredDirection: Direction | null,
  skillHeld: boolean,
  deltaMs: number,
  context: SkillContext,
): boolean {
  if (player.skill.id !== PENDULA_SKILL_ID) {
    return false;
  }
  if (!Number.isFinite(deltaMs) || deltaMs <= 0) {
    return true;
  }
  player.velocity.x = 0;
  player.velocity.y = 0;
  if (desiredDirection) {
    player.direction = desiredDirection;
    player.skill.projectedLastMoveDirection = desiredDirection;
  }
  // Early release cancels with short cooldown (like Nico/Crocodilo patterns).
  if (!skillHeld && player.skill.castElapsedMs > 0) {
    cancelPendulaShockwave(player);
    return true;
  }
  player.skill.channelRemainingMs = Math.max(
    0,
    player.skill.channelRemainingMs - deltaMs,
  );
  player.skill.castElapsedMs += deltaMs;
  if (player.skill.channelRemainingMs <= 0) {
    firePendulaShockwave(player, context);
    finishPendulaShockwave(player);
  }
  return true;
}

export function cancelPendulaShockwave(player: PlayerState): void {
  if (player.skill.id !== PENDULA_SKILL_ID) {
    return;
  }
  player.velocity.x = 0;
  player.velocity.y = 0;
  player.skill.phase = "cooldown";
  player.skill.channelRemainingMs = 0;
  player.skill.cooldownRemainingMs = PENDULA_VOLUNTARY_CANCEL_COOLDOWN_MS;
  player.skill.castElapsedMs = 0;
  player.skill.projectedPosition = null;
  player.skill.projectedLastMoveDirection = null;
}

export function finishPendulaShockwave(player: PlayerState): void {
  if (player.skill.id !== PENDULA_SKILL_ID) {
    return;
  }
  player.velocity.x = 0;
  player.velocity.y = 0;
  player.skill.phase = "cooldown";
  player.skill.channelRemainingMs = 0;
  player.skill.cooldownRemainingMs = PENDULA_SKILL_COOLDOWN_MS;
  player.skill.castElapsedMs = 0;
  player.skill.projectedPosition = null;
  player.skill.projectedLastMoveDirection = null;
}
