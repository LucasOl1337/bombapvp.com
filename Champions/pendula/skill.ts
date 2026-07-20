import type {
  Direction,
  PixelCoord,
  PlayerState,
  TileCoord,
} from "../../src/original-game/Gameplay/types";
import { tileKey } from "../../src/original-game/Arenas/arena";
import { TILE_SIZE } from "../../src/original-game/PersonalConfig/config";
import type { SkillContext } from "../../src/original-game/ultimate/shared";
import type { ChampionSkillAdapter } from "../runtime-contracts";
import type { PendulaPullEffect } from "./contracts";
import {
  PENDULA_SKILL_COOLDOWN_MS,
  PENDULA_SKILL_ID,
} from "./identity";

export {
  PENDULA_CHARACTER_ID,
  PENDULA_SKILL_COOLDOWN_MS,
} from "./identity";

/** Short wind-up; once started the cast always completes (no cancel on release). */
export const PENDULA_SKILL_CHANNEL_MS = 300;
export const PENDULA_VOLUNTARY_CANCEL_COOLDOWN_MS = 200;
/** Chebyshev radius: enemies within this range of Pendula are pulled. */
export const PENDULA_PULL_RANGE = 4;
/** Prefer landing targets this far from Pendula (1 = adjacent tile). */
export const PENDULA_PULL_STOP_DISTANCE = 1;
export const PENDULA_PULL_VISUAL_MS = 280;

export type PendulaSkillContext = Pick<
  SkillContext,
  | "arena"
  | "bombs"
  | "players"
  | "activePlayerIds"
  | "addChampionWorldEffect"
  | "canOccupyPosition"
  | "getTileFromPosition"
  | "normalizeArenaPosition"
  | "soundManager"
>;

function chebyshev(a: TileCoord, b: TileCoord): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

function tileCenter(tile: TileCoord): PixelCoord {
  return {
    x: tile.x * TILE_SIZE + TILE_SIZE * 0.5,
    y: tile.y * TILE_SIZE + TILE_SIZE * 0.5,
  };
}

function isLandingBlocked(
  tile: TileCoord,
  subject: PlayerState,
  context: PendulaSkillContext,
  reserved: ReadonlySet<string>,
): boolean {
  const key = tileKey(tile.x, tile.y);
  if (context.arena.solid.has(key) || context.arena.breakable.has(key)) {
    return true;
  }
  if (reserved.has(key)) {
    return true;
  }
  if (context.bombs.some((bomb) => bomb.tile.x === tile.x && bomb.tile.y === tile.y)) {
    return true;
  }
  for (const playerId of context.activePlayerIds) {
    if (playerId === subject.id) continue;
    const other = context.players[playerId];
    if (!other?.alive) continue;
    // Prefer live position tile over possibly-stale other.tile.
    const otherTile = context.getTileFromPosition(other.position);
    if (otherTile.x === tile.x && otherTile.y === tile.y) {
      return true;
    }
  }
  return false;
}

/**
 * Orianna-style yank: teleport the victim to the best free landing tile near
 * Pendula (prefer adjacent). Does not require a free path through walls —
 * the Ball pulls through obstacles as long as the landing tile is free.
 */
export function pullPlayerToward(
  victim: PlayerState,
  center: TileCoord,
  context: PendulaSkillContext,
  reserved: Set<string>,
): boolean {
  if (!victim.alive) {
    return false;
  }
  const from = context.getTileFromPosition(victim.position);
  const startDist = chebyshev(center, from);
  if (startDist > PENDULA_PULL_RANGE || startDist <= 0) {
    return false;
  }
  // Already on the stop ring (adjacent) — nothing to do.
  if (startDist <= PENDULA_PULL_STOP_DISTANCE) {
    return false;
  }

  let bestTile: TileCoord | null = null;
  let bestRing = Infinity;
  let bestToVictim = Infinity;

  // Prefer stop ring (adjacent), then expand outward if packed.
  const maxRing = Math.min(PENDULA_PULL_RANGE, startDist - 1);
  for (let ring = PENDULA_PULL_STOP_DISTANCE; ring <= maxRing; ring += 1) {
    let foundOnRing = false;
    for (let dy = -ring; dy <= ring; dy += 1) {
      for (let dx = -ring; dx <= ring; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
        const tile = { x: center.x + dx, y: center.y + dy };
        if (isLandingBlocked(tile, victim, context, reserved)) {
          continue;
        }
        const landing = tileCenter(tile);
        if (!context.canOccupyPosition(victim, landing)) {
          continue;
        }
        const toVictim = chebyshev(from, tile);
        if (ring < bestRing || (ring === bestRing && toVictim < bestToVictim)) {
          bestTile = tile;
          bestRing = ring;
          bestToVictim = toVictim;
          foundOnRing = true;
        }
      }
    }
    if (foundOnRing) {
      break;
    }
  }

  if (!bestTile) {
    // Fallback: step one tile closer (cardinal preferred) even if full yank fails.
    const stepX = center.x === from.x ? 0 : center.x > from.x ? 1 : -1;
    const stepY = center.y === from.y ? 0 : center.y > from.y ? 1 : -1;
    const steps: TileCoord[] =
      stepX !== 0 && stepY !== 0
        ? [
            { x: from.x + stepX, y: from.y },
            { x: from.x, y: from.y + stepY },
            { x: from.x + stepX, y: from.y + stepY },
          ]
        : [{ x: from.x + stepX, y: from.y + stepY }];
    for (const tile of steps) {
      if (isLandingBlocked(tile, victim, context, reserved)) continue;
      const landing = tileCenter(tile);
      if (!context.canOccupyPosition(victim, landing)) continue;
      bestTile = tile;
      break;
    }
  }

  if (!bestTile) {
    return false;
  }

  const landing = context.normalizeArenaPosition(tileCenter(bestTile));
  victim.position = { ...landing };
  victim.tile = context.getTileFromPosition(victim.position);
  victim.velocity.x = 0;
  victim.velocity.y = 0;
  reserved.add(tileKey(victim.tile.x, victim.tile.y));
  return true;
}

export function firePendulaPull(
  player: PlayerState,
  context: PendulaSkillContext,
): number {
  const center = context.getTileFromPosition(player.position);
  const reserved = new Set<string>([tileKey(center.x, center.y)]);

  for (const playerId of context.activePlayerIds) {
    if (playerId === player.id) continue;
    const other = context.players[playerId];
    if (other?.alive) {
      const t = context.getTileFromPosition(other.position);
      reserved.add(tileKey(t.x, t.y));
    }
  }

  const victims = context.activePlayerIds
    .filter((id) => id !== player.id)
    .map((id) => context.players[id])
    .filter((other): other is PlayerState => Boolean(other?.alive))
    .map((other) => ({
      other,
      tile: context.getTileFromPosition(other.position),
    }))
    .filter(({ tile }) => chebyshev(center, tile) <= PENDULA_PULL_RANGE)
    .sort((a, b) => chebyshev(center, b.tile) - chebyshev(center, a.tile));

  let pulled = 0;
  for (const { other, tile } of victims) {
    reserved.delete(tileKey(tile.x, tile.y));
    if (pullPlayerToward(other, center, context, reserved)) {
      pulled += 1;
    } else {
      reserved.add(tileKey(tile.x, tile.y));
    }
  }

  const effect: PendulaPullEffect = {
    kind: "pendula-pull",
    ownerId: player.id,
    origin: { ...center },
    remainingMs: PENDULA_PULL_VISUAL_MS,
    maxRadiusTiles: PENDULA_PULL_RANGE,
  };
  context.addChampionWorldEffect(effect);
  context.soundManager.playOneShot("bomb_place");
  return pulled;
}

export const PENDULA_SKILL_ADAPTER: ChampionSkillAdapter = {
  skillId: PENDULA_SKILL_ID,
  activate: (player, direction) => startPendulaPull(player, direction),
  update: (player, direction, _pressed, _held, deltaMs, context) =>
    updatePendulaPullChannel(player, direction, deltaMs, context),
};
export const CHAMPION_SKILL_ADAPTER = PENDULA_SKILL_ADAPTER;

export function startPendulaPull(
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

/**
 * Channel always completes once started — release no longer cancels.
 * (Previous cancel-on-release made the pull feel broken on a short tap.)
 */
export function updatePendulaPullChannel(
  player: PlayerState,
  desiredDirection: Direction | null,
  deltaMs: number,
  context: PendulaSkillContext,
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
  player.skill.channelRemainingMs = Math.max(
    0,
    player.skill.channelRemainingMs - deltaMs,
  );
  player.skill.castElapsedMs += deltaMs;
  if (player.skill.channelRemainingMs <= 0) {
    firePendulaPull(player, context);
    finishPendulaPull(player);
  }
  return true;
}

export function cancelPendulaPull(player: PlayerState): void {
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

export function finishPendulaPull(player: PlayerState): void {
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

// ---- Backward-compatible aliases ----
/** @deprecated Use firePendulaPull */
export const firePendulaShockwave = firePendulaPull;
/** @deprecated Use startPendulaPull */
export const startPendulaShockwave = startPendulaPull;
/** @deprecated Use PENDULA_PULL_RANGE */
export const PENDULA_SHOCKWAVE_RANGE = PENDULA_PULL_RANGE;
/** @deprecated Use PENDULA_PULL_VISUAL_MS */
export const PENDULA_SHOCKWAVE_VISUAL_MS = PENDULA_PULL_VISUAL_MS;
