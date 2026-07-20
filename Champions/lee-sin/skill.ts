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
import type { LeeSinDragonRageEffect } from "./contracts";
import {
  LEE_SIN_SKILL_COOLDOWN_MS,
  LEE_SIN_SKILL_ID,
} from "./identity";

export {
  LEE_SIN_CHARACTER_ID,
  LEE_SIN_SKILL_ID,
  LEE_SIN_SKILL_COOLDOWN_MS,
} from "./identity";

/** Lee Sin fantasy: Resonating lunge + Dragon's Rage knockback. */
export const LEE_SIN_DASH_DISTANCE_PX = TILE_SIZE * 3;
export const LEE_SIN_DASH_DURATION_MS = 260;
export const LEE_SIN_DASH_MIN_DURATION_MS = 100;
export const LEE_SIN_DASH_BLOCKED_COOLDOWN_MS = 320;
export const LEE_SIN_DASH_FRAME_MS = 45;
/** Knock victim up to this many tiles past their current tile. */
export const LEE_SIN_KNOCKBACK_TILES = 3;
export const LEE_SIN_KICK_VISUAL_MS = 420;
/** How far past the dash end we still accept a victim on the ray. */
export const LEE_SIN_KICK_LOOKAHEAD_TILES = 1;

const directionDelta: Record<Direction, TileCoord> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

/** Dash start pixel, keyed by player id — needed so kick hits people we dashed through. */
const dashOriginByPlayerId = new Map<number, PixelCoord>();
/** Prevent double-kick if finish is called twice in one channel. */
const kickConsumedByPlayerId = new Map<number, boolean>();

export type LeeSinSkillContext = Pick<
  SkillContext,
  | "arena"
  | "bombs"
  | "players"
  | "activePlayerIds"
  | "addChampionWorldEffect"
  | "canOccupyPosition"
  | "getTileFromPosition"
  | "normalizeArenaPosition"
  | "getWrappedDelta"
  | "isPositionOverlappingTile"
  | "tryAbsorbInstantHit"
  | "breakCrateAtKey"
  | "soundManager"
>;

function tileCenter(tile: TileCoord): PixelCoord {
  return {
    x: tile.x * TILE_SIZE + TILE_SIZE * 0.5,
    y: tile.y * TILE_SIZE + TILE_SIZE * 0.5,
  };
}

function clearDashTracking(playerId: number): void {
  dashOriginByPlayerId.delete(playerId);
  kickConsumedByPlayerId.delete(playerId);
}

/** Test-only: reset module dash/kick bookkeeping between cases. */
export function resetLeeSinDashTrackingForTests(): void {
  dashOriginByPlayerId.clear();
  kickConsumedByPlayerId.clear();
}

export function getDashDistancePx(
  from: PixelCoord,
  to: PixelCoord,
  direction: Direction,
  context: LeeSinSkillContext,
): number {
  const width = context.arena.config.grid.width * TILE_SIZE;
  const height = context.arena.config.grid.height * TILE_SIZE;
  return direction === "left" || direction === "right"
    ? Math.abs(context.getWrappedDelta(to.x, from.x, width))
    : Math.abs(context.getWrappedDelta(to.y, from.y, height));
}

export function hasReachedSkillTarget(
  position: PixelCoord,
  target: PixelCoord,
  context: LeeSinSkillContext,
): boolean {
  const width = context.arena.config.grid.width * TILE_SIZE;
  const height = context.arena.config.grid.height * TILE_SIZE;
  const dx = context.getWrappedDelta(target.x, position.x, width);
  const dy = context.getWrappedDelta(target.y, position.y, height);
  return Math.hypot(dx, dy) <= 0.5;
}

function isLandingBlocked(
  tile: TileCoord,
  subject: PlayerState,
  context: LeeSinSkillContext,
  reserved: ReadonlySet<string>,
  ignorePlayerIds: ReadonlySet<number> = new Set(),
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
    if (ignorePlayerIds.has(playerId)) continue;
    const other = context.players[playerId];
    if (!other?.alive) continue;
    const otherTile = context.getTileFromPosition(other.position);
    if (otherTile.x === tile.x && otherTile.y === tile.y) {
      return true;
    }
  }
  return false;
}

/**
 * Push victim along the kick ray up to LEE_SIN_KNOCKBACK_TILES free tiles.
 * Returns how many tiles moved (0 if blocked immediately).
 */
export function knockbackPlayer(
  victim: PlayerState,
  direction: Direction,
  context: LeeSinSkillContext,
  reserved: Set<string>,
  ignorePlayerIds: ReadonlySet<number> = new Set(),
): number {
  if (!victim.alive) return 0;
  const delta = directionDelta[direction];
  let tile = context.getTileFromPosition(victim.position);
  let moved = 0;

  for (let step = 0; step < LEE_SIN_KNOCKBACK_TILES; step += 1) {
    const next = { x: tile.x + delta.x, y: tile.y + delta.y };
    if (isLandingBlocked(next, victim, context, reserved, ignorePlayerIds)) {
      break;
    }
    const landing = context.normalizeArenaPosition(tileCenter(next));
    // canOccupyPosition may still block on bombs/terrain; player-player is handled above.
    if (!context.canOccupyPosition(victim, landing)) {
      break;
    }
    tile = next;
    moved += 1;
  }

  if (moved === 0) {
    // Still "hit" the body — zero velocity so they don't keep walking through the kick.
    victim.velocity.x = 0;
    victim.velocity.y = 0;
    return 0;
  }

  const landing = context.normalizeArenaPosition(tileCenter(tile));
  victim.position = { ...landing };
  victim.tile = context.getTileFromPosition(victim.position);
  victim.velocity.x = 0;
  victim.velocity.y = 0;
  reserved.add(tileKey(victim.tile.x, victim.tile.y));
  return moved;
}

/**
 * Distance along the kick axis from origin tile toward direction.
 * Negative = behind the origin; null = off the cardinal ray.
 */
export function rayDistanceAlong(
  origin: TileCoord,
  tile: TileCoord,
  direction: Direction,
): number | null {
  const delta = directionDelta[direction];
  if (delta.x !== 0) {
    if (tile.y !== origin.y) return null;
    const dx = tile.x - origin.x;
    if (dx === 0) return 0;
    if (Math.sign(dx) !== delta.x) return null;
    return Math.abs(dx);
  }
  if (tile.x !== origin.x) return null;
  const dy = tile.y - origin.y;
  if (dy === 0) return 0;
  if (Math.sign(dy) !== delta.y) return null;
  return Math.abs(dy);
}

function kickPathMaxAlong(
  origin: TileCoord,
  end: TileCoord,
  direction: Direction,
): number {
  const endAlong = rayDistanceAlong(origin, end, direction) ?? 0;
  return (
    Math.max(endAlong, Math.ceil(LEE_SIN_DASH_DISTANCE_PX / TILE_SIZE)) +
    LEE_SIN_KICK_LOOKAHEAD_TILES
  );
}

/** Cardinal tiles the kick corridor covers (origin → end + lookahead). */
export function kickPathTiles(
  origin: TileCoord,
  end: TileCoord,
  direction: Direction,
): TileCoord[] {
  const delta = directionDelta[direction];
  const maxAlong = kickPathMaxAlong(origin, end, direction);
  const tiles: TileCoord[] = [];
  for (let step = 0; step <= maxAlong; step += 1) {
    tiles.push({
      x: origin.x + delta.x * step,
      y: origin.y + delta.y * step,
    });
  }
  return tiles;
}

/**
 * First living enemy on the kick corridor from dash path origin through caster
 * and slightly past the landing — so dashing *through* someone still hits them.
 * Uses tile ray + body-overlap so slightly off-center bodies still count.
 */
export function findKickVictim(
  caster: PlayerState,
  direction: Direction,
  context: LeeSinSkillContext,
  pathOriginPx?: PixelCoord | null,
): PlayerState | null {
  const origin = context.getTileFromPosition(
    pathOriginPx ?? caster.position,
  );
  const end = context.getTileFromPosition(caster.position);
  const maxAlong = kickPathMaxAlong(origin, end, direction);
  const path = kickPathTiles(origin, end, direction);

  let best: PlayerState | null = null;
  let bestAlong = Infinity;

  for (const id of context.activePlayerIds) {
    if (id === caster.id) continue;
    const other = context.players[id];
    if (!other?.alive) continue;
    const tile = context.getTileFromPosition(other.position);

    let along = rayDistanceAlong(origin, tile, direction);
    if (along === null || along < 0 || along > maxAlong) {
      // Body may straddle a path tile even if center tile is off-axis by rounding.
      along = null;
      for (let step = 0; step < path.length; step += 1) {
        const pathTile = path[step]!;
        const overlaps =
          typeof context.isPositionOverlappingTile === "function"
            ? context.isPositionOverlappingTile(other.position, pathTile)
            : pathTile.x === tile.x && pathTile.y === tile.y;
        if (overlaps) {
          along = step;
          break;
        }
      }
    }
    if (along === null || along < 0 || along > maxAlong) continue;

    if (
      along < bestAlong ||
      (along === bestAlong && best !== null && other.id < best.id)
    ) {
      best = other;
      bestAlong = along;
    }
  }
  return best;
}

/** Smash soft blocks / arm bombs along the kick line (combat presence). */
function smashKickCorridor(
  origin: TileCoord,
  end: TileCoord,
  direction: Direction,
  context: LeeSinSkillContext,
): void {
  if (typeof context.breakCrateAtKey !== "function") return;
  for (const tile of kickPathTiles(origin, end, direction)) {
    const key = tileKey(tile.x, tile.y);
    context.breakCrateAtKey(key);
    const bomb = context.bombs.find(
      (item) => item.tile.x === tile.x && item.tile.y === tile.y,
    );
    if (bomb) {
      bomb.fuseMs = 0;
    }
  }
}

export function fireDragonRageKick(
  player: PlayerState,
  direction: Direction,
  context: LeeSinSkillContext,
  pathOriginPx?: PixelCoord | null,
): boolean {
  if (kickConsumedByPlayerId.get(player.id)) {
    return false;
  }
  kickConsumedByPlayerId.set(player.id, true);

  const originPx = pathOriginPx ?? dashOriginByPlayerId.get(player.id) ?? player.position;
  const origin = context.getTileFromPosition(originPx);
  const end = context.getTileFromPosition(player.position);

  // Soft walls / bombs on the line — kick is a combat ability, not a pure dash.
  smashKickCorridor(origin, end, direction, context);

  // Reserve other players/bombs, but NOT Lee Sin — the kick follows through his body
  // so a victim he overshot can still be thrown past his landing tile.
  const reserved = new Set<string>();
  for (const id of context.activePlayerIds) {
    if (id === player.id) continue;
    const other = context.players[id];
    if (!other?.alive) continue;
    const t = context.getTileFromPosition(other.position);
    reserved.add(tileKey(t.x, t.y));
  }

  const victim = findKickVictim(player, direction, context, originPx);
  let hit = false;
  let knockedTiles = 0;
  if (victim) {
    const vt = context.getTileFromPosition(victim.position);
    reserved.delete(tileKey(vt.x, vt.y));
    knockedTiles = knockbackPlayer(
      victim,
      direction,
      context,
      reserved,
      new Set([player.id]),
    );
    // Lethal kick — same instant-hit contract as Nico beam / Crocodilo surge.
    if (typeof context.tryAbsorbInstantHit === "function") {
      context.tryAbsorbInstantHit(victim, player.id);
    }
    hit = true;
  }

  const delta = directionDelta[direction];
  const effect: LeeSinDragonRageEffect = {
    kind: "lee-sin-dragon-rage",
    ownerId: player.id,
    origin: { ...origin },
    direction: { ...delta },
    remainingMs: LEE_SIN_KICK_VISUAL_MS,
    maxDistanceTiles:
      Math.ceil(LEE_SIN_DASH_DISTANCE_PX / TILE_SIZE) + LEE_SIN_KNOCKBACK_TILES,
    hit,
  };
  context.addChampionWorldEffect(effect);
  context.soundManager.playOneShot(hit ? "bombExplode" : "powerCollect");
  void knockedTiles;
  return hit;
}

export const LEE_SIN_SKILL_ADAPTER: ChampionSkillAdapter = {
  skillId: LEE_SIN_SKILL_ID,
  activate: (player, direction, context) =>
    startLeeSinDragonRage(player, direction, context),
  update: (player, _direction, _pressed, _held, deltaMs, context) =>
    updateLeeSinDragonRage(player, deltaMs, context),
  projectTarget: computeLeeSinDashTarget,
  allowsPlayerOverlap: true,
};
export const CHAMPION_SKILL_ADAPTER = LEE_SIN_SKILL_ADAPTER;

export function startLeeSinDragonRage(
  player: PlayerState,
  desiredDirection: Direction | null,
  context: LeeSinSkillContext,
): void {
  if (player.skill.id !== LEE_SIN_SKILL_ID) {
    return;
  }
  const dashDirection =
    desiredDirection ?? player.lastMoveDirection ?? player.direction;
  dashOriginByPlayerId.set(player.id, { ...player.position });
  kickConsumedByPlayerId.set(player.id, false);

  const target = computeLeeSinDashTarget(player, dashDirection, context);
  const dashDistance = getDashDistancePx(
    player.position,
    target,
    dashDirection,
    context,
  );
  if (dashDistance < 1) {
    // Stationary kick — still combat if someone is on the ray.
    fireDragonRageKick(player, dashDirection, context);
    player.skill.phase = "cooldown";
    player.skill.channelRemainingMs = 0;
    player.skill.cooldownRemainingMs = LEE_SIN_DASH_BLOCKED_COOLDOWN_MS;
    player.skill.castElapsedMs = 0;
    player.skill.projectedPosition = null;
    player.skill.projectedLastMoveDirection = null;
    player.velocity.x = 0;
    player.velocity.y = 0;
    clearDashTracking(player.id);
    return;
  }
  const durationMs = Math.max(
    LEE_SIN_DASH_MIN_DURATION_MS,
    Math.round(
      LEE_SIN_DASH_DURATION_MS * (dashDistance / LEE_SIN_DASH_DISTANCE_PX),
    ),
  );
  player.direction = dashDirection;
  player.lastMoveDirection = dashDirection;
  player.skill.phase = "channeling";
  player.skill.channelRemainingMs = durationMs;
  player.skill.castElapsedMs = 0;
  player.skill.projectedPosition = target;
  player.skill.projectedLastMoveDirection = dashDirection;
  player.velocity.x = 0;
  player.velocity.y = 0;
}

export function updateLeeSinDragonRage(
  player: PlayerState,
  deltaMs: number,
  context: LeeSinSkillContext,
): boolean {
  if (player.skill.id !== LEE_SIN_SKILL_ID) {
    return false;
  }
  if (!Number.isFinite(deltaMs) || deltaMs <= 0) {
    player.velocity.x = 0;
    player.velocity.y = 0;
    return true;
  }
  const dashDirection =
    player.skill.projectedLastMoveDirection ??
    player.lastMoveDirection ??
    player.direction;
  const target = player.skill.projectedPosition ?? player.position;
  const start = { ...player.position };
  const remainingMs = Math.max(0, player.skill.channelRemainingMs);
  const stepFraction =
    remainingMs <= 0 ? 1 : Math.min(1, deltaMs / remainingMs);
  const arenaPixelWidth = context.arena.config.grid.width * TILE_SIZE;
  const arenaPixelHeight = context.arena.config.grid.height * TILE_SIZE;
  const deltaX = context.getWrappedDelta(
    target.x,
    player.position.x,
    arenaPixelWidth,
  );
  const deltaY = context.getWrappedDelta(
    target.y,
    player.position.y,
    arenaPixelHeight,
  );
  const nextPosition = context.normalizeArenaPosition({
    x: player.position.x + deltaX * stepFraction,
    y: player.position.y + deltaY * stepFraction,
  });
  if (!context.canOccupyPosition(player, nextPosition)) {
    finishLeeSinDragonRage(
      player,
      context,
      player.position,
      LEE_SIN_DASH_BLOCKED_COOLDOWN_MS,
    );
    return true;
  }
  player.position = nextPosition;
  player.velocity = {
    x:
      context.getWrappedDelta(player.position.x, start.x, arenaPixelWidth) /
      (deltaMs / 1000),
    y:
      context.getWrappedDelta(player.position.y, start.y, arenaPixelHeight) /
      (deltaMs / 1000),
  };
  player.direction = dashDirection;
  player.lastMoveDirection = dashDirection;
  player.tile = context.getTileFromPosition(player.position);
  player.skill.channelRemainingMs = Math.max(0, remainingMs - deltaMs);
  player.skill.castElapsedMs += deltaMs;

  // Early contact: if we already share the ray with a victim mid-dash, resolve kick
  // at the end of this frame so combat does not wait for overshoot.
  if (
    !kickConsumedByPlayerId.get(player.id) &&
    findKickVictim(
      player,
      dashDirection,
      context,
      dashOriginByPlayerId.get(player.id),
    )
  ) {
    // Only force-finish if we're on/past the first victim tile.
    const origin = dashOriginByPlayerId.get(player.id) ?? player.position;
    const victim = findKickVictim(player, dashDirection, context, origin);
    if (victim) {
      const oTile = context.getTileFromPosition(origin);
      const cTile = context.getTileFromPosition(player.position);
      const vTile = context.getTileFromPosition(victim.position);
      const cAlong = rayDistanceAlong(oTile, cTile, dashDirection) ?? 0;
      const vAlong = rayDistanceAlong(oTile, vTile, dashDirection) ?? 0;
      if (cAlong >= vAlong) {
        finishLeeSinDragonRage(player, context);
        return true;
      }
    }
  }

  if (
    player.skill.channelRemainingMs <= 0 ||
    hasReachedSkillTarget(player.position, target, context)
  ) {
    finishLeeSinDragonRage(player, context);
  }
  return true;
}

export function finishLeeSinDragonRage(
  player: PlayerState,
  context: LeeSinSkillContext,
  fallbackPosition: PixelCoord = player.position,
  cooldownMs: number = LEE_SIN_SKILL_COOLDOWN_MS,
): void {
  if (player.skill.id !== LEE_SIN_SKILL_ID) {
    return;
  }
  // Avoid re-entrant finish wiping cooldown twice without kick.
  if (player.skill.phase !== "channeling" && player.skill.phase !== "releasing") {
    // Still allow blocked stationary path that set cooldown already.
    if (player.skill.phase === "cooldown") {
      clearDashTracking(player.id);
      return;
    }
  }
  const projectedTarget = player.skill.projectedPosition ?? player.position;
  const target = context.canOccupyPosition(player, projectedTarget)
    ? projectedTarget
    : fallbackPosition;
  player.position = { ...target };
  player.tile = context.getTileFromPosition(player.position);
  const dashDirection =
    player.skill.projectedLastMoveDirection ??
    player.lastMoveDirection ??
    player.direction;
  if (player.skill.projectedLastMoveDirection) {
    player.direction = player.skill.projectedLastMoveDirection;
    player.lastMoveDirection = player.skill.projectedLastMoveDirection;
  }
  player.velocity.x = 0;
  player.velocity.y = 0;
  const origin = dashOriginByPlayerId.get(player.id) ?? null;
  fireDragonRageKick(player, dashDirection, context, origin);
  player.skill.phase = "cooldown";
  player.skill.channelRemainingMs = 0;
  player.skill.cooldownRemainingMs = cooldownMs;
  player.skill.castElapsedMs = 0;
  player.skill.projectedPosition = null;
  player.skill.projectedLastMoveDirection = null;
  clearDashTracking(player.id);
}

export function computeLeeSinDashTarget(
  player: PlayerState,
  direction: Direction,
  context: LeeSinSkillContext,
): PixelCoord {
  const delta = directionDelta[direction];
  const stepPx = 4;
  let position = { ...player.position };
  let travelledPx = 0;
  while (travelledPx < LEE_SIN_DASH_DISTANCE_PX) {
    const nextStep = Math.min(
      stepPx,
      LEE_SIN_DASH_DISTANCE_PX - travelledPx,
    );
    const candidate = context.normalizeArenaPosition({
      x: position.x + delta.x * nextStep,
      y: position.y + delta.y * nextStep,
    });
    if (!context.canOccupyPosition(player, candidate)) {
      break;
    }
    position = candidate;
    travelledPx += nextStep;
  }
  return position;
}
