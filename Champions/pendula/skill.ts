import type {
  Direction,
  PixelCoord,
  PlayerState,
  TileCoord,
} from "../../src/original-game/Gameplay/types";
import { tileKey } from "../../src/original-game/Arenas/arena";
import type { SkillContext } from "../../src/original-game/ultimate/shared";
import type { ChampionSkillAdapter } from "../runtime-contracts";
import type { PendulaPullEffect } from "./contracts";
import {
  PENDULA_SKILL_COOLDOWN_MS,
  PENDULA_SKILL_ID,
} from "./definition";

export {
  PENDULA_CHARACTER_ID,
  PENDULA_SKILL_COOLDOWN_MS,
} from "./definition";

/** Short wind-up before the Ball yanks enemies in (3× faster than the old 900 ms cast). */
export const PENDULA_SKILL_CHANNEL_MS = 300;
export const PENDULA_VOLUNTARY_CANCEL_COOLDOWN_MS = 200;
/** Chebyshev radius: enemies within this range of Pendula are pulled. */
export const PENDULA_PULL_RANGE = 3;
/** Prefer landing targets this far from Pendula (1 = adjacent tile). */
export const PENDULA_PULL_STOP_DISTANCE = 1;
export const PENDULA_PULL_VISUAL_MS = 280;

function chebyshev(a: TileCoord, b: TileCoord): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

function sign(n: number): number {
  if (n > 0) return 1;
  if (n < 0) return -1;
  return 0;
}

function tileSizeOf(context: SkillContext): number {
  return context.arena.config.grid.tileSize;
}

function tileCenter(tile: TileCoord, context: SkillContext): PixelCoord {
  const size = tileSizeOf(context);
  return {
    x: tile.x * size + size * 0.5,
    y: tile.y * size + size * 0.5,
  };
}

function isTileBlockedForPlayer(
  tile: TileCoord,
  subject: PlayerState,
  context: SkillContext,
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
    if (other.tile.x === tile.x && other.tile.y === tile.y) {
      return true;
    }
  }
  return false;
}

/**
 * Step the victim tile-by-tile toward `center`, stopping at the closest free
 * tile that is still outside / on the stop ring. Instant (no multi-frame travel).
 */
export function pullPlayerToward(
  victim: PlayerState,
  center: TileCoord,
  context: SkillContext,
  reserved: Set<string>,
): boolean {
  if (!victim.alive) {
    return false;
  }
  let tile = { ...victim.tile };
  if (chebyshev(center, tile) > PENDULA_PULL_RANGE) {
    return false;
  }
  if (chebyshev(center, tile) <= PENDULA_PULL_STOP_DISTANCE) {
    return false;
  }

  let moved = false;
  // Hard cap steps so a pathological map cannot loop.
  for (let step = 0; step < PENDULA_PULL_RANGE * 2; step += 1) {
    const dist = chebyshev(center, tile);
    if (dist <= PENDULA_PULL_STOP_DISTANCE) {
      break;
    }
    const dx = sign(center.x - tile.x);
    const dy = sign(center.y - tile.y);
    // Prefer pure cardinals when diagonal — more readable pulls.
    const candidates: TileCoord[] =
      dx !== 0 && dy !== 0
        ? [
            { x: tile.x + dx, y: tile.y },
            { x: tile.x, y: tile.y + dy },
            { x: tile.x + dx, y: tile.y + dy },
          ]
        : [{ x: tile.x + dx, y: tile.y + dy }];

    let advanced: TileCoord | null = null;
    for (const next of candidates) {
      if (isTileBlockedForPlayer(next, victim, context, reserved)) {
        continue;
      }
      const nextPos = tileCenter(next, context);
      if (!context.canOccupyPosition(victim, nextPos)) {
        continue;
      }
      advanced = next;
      break;
    }
    if (!advanced) {
      break;
    }
    tile = advanced;
    moved = true;
  }

  if (!moved) {
    return false;
  }

  const landing = tileCenter(tile, context);
  const normalized = context.normalizeArenaPosition(landing);
  victim.position = { ...normalized };
  victim.tile = context.getTileFromPosition(victim.position);
  victim.velocity.x = 0;
  victim.velocity.y = 0;
  reserved.add(tileKey(victim.tile.x, victim.tile.y));
  return true;
}

export function firePendulaPull(
  player: PlayerState,
  context: SkillContext,
): number {
  const center = context.getTileFromPosition(player.position);
  const reserved = new Set<string>([tileKey(center.x, center.y)]);
  // Reserve other living players' current tiles so we do not stomp them mid-pull
  // unless we deliberately move that player this cast.
  for (const playerId of context.activePlayerIds) {
    if (playerId === player.id) continue;
    const other = context.players[playerId];
    if (other?.alive) {
      reserved.add(tileKey(other.tile.x, other.tile.y));
    }
  }

  // Pull farthest first so closer tiles free up for nearer victims less often race.
  const victims = context.activePlayerIds
    .filter((id) => id !== player.id)
    .map((id) => context.players[id])
    .filter((other): other is PlayerState => Boolean(other?.alive))
    .filter((other) => chebyshev(center, other.tile) <= PENDULA_PULL_RANGE)
    .sort(
      (a, b) => chebyshev(center, b.tile) - chebyshev(center, a.tile),
    );

  let pulled = 0;
  for (const victim of victims) {
    // Free their current tile before moving so another pull can land there if needed.
    reserved.delete(tileKey(victim.tile.x, victim.tile.y));
    if (pullPlayerToward(victim, center, context, reserved)) {
      pulled += 1;
    } else {
      reserved.add(tileKey(victim.tile.x, victim.tile.y));
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
  update: (player, direction, _pressed, held, deltaMs, context) =>
    updatePendulaPullChannel(player, direction, held, deltaMs, context),
};

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

export function updatePendulaPullChannel(
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
  // Early release cancels with short cooldown.
  if (!skillHeld && player.skill.castElapsedMs > 0) {
    cancelPendulaPull(player);
    return true;
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

// ---- Backward-compatible aliases (tests / older call sites) ----
/** @deprecated Use firePendulaPull */
export const firePendulaShockwave = firePendulaPull;
/** @deprecated Use startPendulaPull */
export const startPendulaShockwave = startPendulaPull;
/** @deprecated Use PENDULA_PULL_RANGE */
export const PENDULA_SHOCKWAVE_RANGE = PENDULA_PULL_RANGE;
/** @deprecated Use PENDULA_PULL_VISUAL_MS */
export const PENDULA_SHOCKWAVE_VISUAL_MS = PENDULA_PULL_VISUAL_MS;
