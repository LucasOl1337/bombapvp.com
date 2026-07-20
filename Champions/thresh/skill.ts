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
import type { ThreshDeathSentenceEffect } from "./contracts";
import {
  THRESH_SKILL_COOLDOWN_MS,
  THRESH_SKILL_ID,
} from "./identity";

export {
  THRESH_CHARACTER_ID,
  THRESH_SKILL_ID,
  THRESH_SKILL_COOLDOWN_MS,
} from "./identity";

/** Thresh fantasy: Death Sentence — straight skill-shot hook that yanks the first enemy hit. */
export const THRESH_HOOK_RANGE_TILES = 4;
/** Wind-up + hook travel; the cast always completes once started. */
export const THRESH_HOOK_CHANNEL_MS = 300;
export const THRESH_HOOK_VISUAL_MS = 420;
/** Whiffed hook refunds half the cooldown (catch fantasy without hard punishment). */
export const THRESH_HOOK_MISS_COOLDOWN_MS = 4_000;
export const THRESH_HOOK_FRAME_MS = 50;

const directionDelta: Record<Direction, TileCoord> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export type ThreshSkillContext = Pick<
  SkillContext,
  | "arena"
  | "bombs"
  | "players"
  | "activePlayerIds"
  | "addChampionWorldEffect"
  | "canOccupyPosition"
  | "getTileFromPosition"
  | "normalizeArenaPosition"
  | "isPositionOverlappingTile"
  | "soundManager"
>;

function tileCenter(tile: TileCoord): PixelCoord {
  return {
    x: tile.x * TILE_SIZE + TILE_SIZE * 0.5,
    y: tile.y * TILE_SIZE + TILE_SIZE * 0.5,
  };
}

function isWall(tile: TileCoord, context: ThreshSkillContext): boolean {
  const key = tileKey(tile.x, tile.y);
  return context.arena.solid.has(key) || context.arena.breakable.has(key);
}

/**
 * Free tiles the hook travels before a wall, starting at step 1 from origin.
 * Bombs do not block the hook (it flies over them); walls and crates do.
 */
export function hookPathTiles(
  origin: TileCoord,
  direction: Direction,
  context: ThreshSkillContext,
): TileCoord[] {
  const delta = directionDelta[direction];
  const path: TileCoord[] = [];
  for (let step = 1; step <= THRESH_HOOK_RANGE_TILES; step += 1) {
    const tile = { x: origin.x + delta.x * step, y: origin.y + delta.y * step };
    if (isWall(tile, context)) {
      break;
    }
    path.push(tile);
  }
  return path;
}

/** First living enemy on the hook path (tile match or body overlap). */
export function findHookVictim(
  caster: PlayerState,
  direction: Direction,
  context: ThreshSkillContext,
  maxDistance: number = THRESH_HOOK_RANGE_TILES,
): { victim: PlayerState; distance: number } | null {
  const origin = context.getTileFromPosition(caster.position);
  const path = hookPathTiles(origin, direction, context).slice(0, maxDistance);

  let best: PlayerState | null = null;
  let bestDistance = Infinity;

  for (const id of context.activePlayerIds) {
    if (id === caster.id) continue;
    const other = context.players[id];
    if (!other?.alive) continue;
    const tile = context.getTileFromPosition(other.position);

    let distance: number | null = null;
    for (let step = 0; step < path.length; step += 1) {
      const pathTile = path[step]!;
      const overlaps =
        typeof context.isPositionOverlappingTile === "function"
          ? context.isPositionOverlappingTile(other.position, pathTile)
          : pathTile.x === tile.x && pathTile.y === tile.y;
      if (overlaps) {
        distance = step + 1;
        break;
      }
    }
    if (distance === null) continue;

    if (
      distance < bestDistance ||
      (distance === bestDistance && best !== null && other.id < best.id)
    ) {
      best = other;
      bestDistance = distance;
    }
  }
  return best ? { victim: best, distance: bestDistance } : null;
}

function isLandingBlocked(
  tile: TileCoord,
  subject: PlayerState,
  context: ThreshSkillContext,
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
    const otherTile = context.getTileFromPosition(other.position);
    if (otherTile.x === tile.x && otherTile.y === tile.y) {
      return true;
    }
  }
  return false;
}

/**
 * Yank the victim along the hook line toward Thresh: lands on the free tile
 * closest to Thresh (adjacent preferred), never past Thresh's own tile.
 */
export function pullVictimAlongHookLine(
  victim: PlayerState,
  origin: TileCoord,
  direction: Direction,
  victimDistance: number,
  context: ThreshSkillContext,
  reserved: Set<string>,
): boolean {
  if (!victim.alive || victimDistance <= 1) {
    return false;
  }
  const delta = directionDelta[direction];
  for (let step = 1; step < victimDistance; step += 1) {
    const tile = { x: origin.x + delta.x * step, y: origin.y + delta.y * step };
    if (isLandingBlocked(tile, victim, context, reserved)) {
      continue;
    }
    const landing = context.normalizeArenaPosition(tileCenter(tile));
    if (!context.canOccupyPosition(victim, landing)) {
      continue;
    }
    victim.position = { ...landing };
    victim.tile = context.getTileFromPosition(victim.position);
    victim.velocity.x = 0;
    victim.velocity.y = 0;
    reserved.add(tileKey(victim.tile.x, victim.tile.y));
    return true;
  }
  // No free landing — chain still connects, victim stays but loses momentum.
  victim.velocity.x = 0;
  victim.velocity.y = 0;
  return false;
}

/**
 * Resolve the hook up to `maxDistance` tiles: yank the first victim found,
 * spawn the chain visual. Returns true on hit.
 */
export function fireDeathSentenceReach(
  player: PlayerState,
  direction: Direction,
  context: ThreshSkillContext,
  maxDistance: number,
): boolean {
  const origin = context.getTileFromPosition(player.position);
  const path = hookPathTiles(origin, direction, context);
  const limit = Math.min(maxDistance, path.length);
  const found = findHookVictim(player, direction, context, limit);

  let hit = false;
  let reachTiles = limit;
  if (found) {
    reachTiles = found.distance;
    const reserved = new Set<string>([tileKey(origin.x, origin.y)]);
    for (const id of context.activePlayerIds) {
      if (id === player.id || id === found.victim.id) continue;
      const other = context.players[id];
      if (!other?.alive) continue;
      const t = context.getTileFromPosition(other.position);
      reserved.add(tileKey(t.x, t.y));
    }
    pullVictimAlongHookLine(
      found.victim,
      origin,
      direction,
      found.distance,
      context,
      reserved,
    );
    hit = true;
  }

  const delta = directionDelta[direction];
  const effect: ThreshDeathSentenceEffect = {
    kind: "thresh-death-sentence",
    ownerId: player.id,
    origin: { ...origin },
    direction: { ...delta },
    remainingMs: THRESH_HOOK_VISUAL_MS,
    reachTiles,
    hit,
  };
  context.addChampionWorldEffect(effect);
  context.soundManager.playOneShot(hit ? "bombExplode" : "powerCollect");
  return hit;
}

/** Full-range resolution (kept for tests and terminal flight tick). */
export function fireDeathSentence(
  player: PlayerState,
  direction: Direction,
  context: ThreshSkillContext,
): boolean {
  return fireDeathSentenceReach(
    player,
    direction,
    context,
    THRESH_HOOK_RANGE_TILES,
  );
}

export const THRESH_SKILL_ADAPTER: ChampionSkillAdapter = {
  skillId: THRESH_SKILL_ID,
  activate: (player, direction) => startThreshDeathSentence(player, direction),
  update: (player, direction, _pressed, _held, deltaMs, context) =>
    updateThreshDeathSentence(player, direction, deltaMs, context),
  projectTarget: computeThreshHookTarget,
};
export const CHAMPION_SKILL_ADAPTER = THRESH_SKILL_ADAPTER;

export function startThreshDeathSentence(
  player: PlayerState,
  desiredDirection: Direction | null,
): void {
  if (player.skill.id !== THRESH_SKILL_ID) {
    return;
  }
  const aim =
    desiredDirection ?? player.lastMoveDirection ?? player.direction;
  player.direction = aim;
  player.lastMoveDirection = aim;
  player.skill.phase = "channeling";
  player.skill.channelRemainingMs = THRESH_HOOK_CHANNEL_MS;
  player.skill.cooldownRemainingMs = 0;
  player.skill.castElapsedMs = 0;
  player.skill.projectedPosition = null;
  player.skill.projectedLastMoveDirection = aim;
  player.velocity.x = 0;
  player.velocity.y = 0;
}

/**
 * The hook is a live projectile: every tick it extends along the lane and
 * grabs the first enemy touched (contact = instant yank). If the flight
 * completes with no contact, the whiff refunds half the cooldown.
 */
export function updateThreshDeathSentence(
  player: PlayerState,
  desiredDirection: Direction | null,
  deltaMs: number,
  context: ThreshSkillContext,
): boolean {
  if (player.skill.id !== THRESH_SKILL_ID) {
    return false;
  }
  if (!Number.isFinite(deltaMs) || deltaMs <= 0) {
    return true;
  }
  player.velocity.x = 0;
  player.velocity.y = 0;
  player.skill.channelRemainingMs = Math.max(
    0,
    player.skill.channelRemainingMs - deltaMs,
  );
  player.skill.castElapsedMs += deltaMs;
  const aim =
    player.skill.projectedLastMoveDirection ??
    desiredDirection ??
    player.lastMoveDirection ??
    player.direction;
  const done = player.skill.channelRemainingMs <= 0;
  const progress = Math.min(1, player.skill.castElapsedMs / THRESH_HOOK_CHANNEL_MS);
  const reach = done
    ? THRESH_HOOK_RANGE_TILES
    : Math.max(1, Math.ceil(progress * THRESH_HOOK_RANGE_TILES));
  // Scan first (no side effects): only resolve — effect + sound — on contact
  // or on the terminal flight tick.
  const contact = findHookVictim(player, aim, context, reach);
  if (contact || done) {
    const hit = fireDeathSentenceReach(player, aim, context, reach);
    finishThreshDeathSentence(
      player,
      hit ? THRESH_SKILL_COOLDOWN_MS : THRESH_HOOK_MISS_COOLDOWN_MS,
    );
  }
  return true;
}

export function finishThreshDeathSentence(
  player: PlayerState,
  cooldownMs: number = THRESH_SKILL_COOLDOWN_MS,
): void {
  if (player.skill.id !== THRESH_SKILL_ID) {
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

/** Aim preview: center of the farthest tile the hook can reach. */
export function computeThreshHookTarget(
  player: PlayerState,
  direction: Direction,
  context: ThreshSkillContext,
): PixelCoord {
  const origin = context.getTileFromPosition(player.position);
  const path = hookPathTiles(origin, direction, context);
  const last = path.at(-1) ?? origin;
  return context.normalizeArenaPosition(tileCenter(last));
}
