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
import type {
  KatarinaBladeEffect,
  KatarinaShunpoEffect,
} from "./contracts";
import {
  KATARINA_SKILL_COOLDOWN_MS,
  KATARINA_SKILL_ID,
} from "./identity";

export {
  KATARINA_CHARACTER_ID,
  KATARINA_SKILL_ID,
  KATARINA_SKILL_COOLDOWN_MS,
} from "./identity";

/**
 * Katarina fantasy: Bouncing Blade → Shunpo.
 * Cast 1 throws a dagger down the lane; it sticks into the last free tile
 * before a wall/crate/bomb and waits. Re-cast blinks Katarina to the dagger
 * and slashes every enemy around it.
 */
export const KATARINA_BLADE_RANGE_TILES = 4;
export const KATARINA_THROW_CHANNEL_MS = 180;
export const KATARINA_BLADE_ARMED_MS = 5_000;
export const KATARINA_BLADE_EXPIRE_COOLDOWN_MS = 4_000;
export const KATARINA_FIZZLE_COOLDOWN_MS = 1_500;
/** Chebyshev radius of the Shunpo slash around the dagger. */
export const KATARINA_SLASH_RADIUS = 1;
export const KATARINA_SHUNPO_VISUAL_MS = 320;
export const KATARINA_CAST_FRAME_MS = 50;

const directionDelta: Record<Direction, TileCoord> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export type KatarinaSkillContext = Pick<
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
  | "soundManager"
>;

/** Dagger landing tile keyed by player id (present during throw + armed). */
const bladeTileByPlayerId = new Map<number, TileCoord>();
/** Owners whose blade was consumed (blink or expiry) — visuals drop the effect. */
const consumedBladePlayerIds = new Set<number>();

/** Test-only: reset module blade bookkeeping between cases. */
export function resetKatarinaBladesForTests(): void {
  bladeTileByPlayerId.clear();
  consumedBladePlayerIds.clear();
}

/** Visual adapter hook: should the blade world effect be dropped? */
export function isKatarinaBladeConsumed(ownerId: number): boolean {
  return consumedBladePlayerIds.has(ownerId);
}

function tileCenter(tile: TileCoord): PixelCoord {
  return {
    x: tile.x * TILE_SIZE + TILE_SIZE * 0.5,
    y: tile.y * TILE_SIZE + TILE_SIZE * 0.5,
  };
}

function isBlockedForBlade(
  tile: TileCoord,
  context: KatarinaSkillContext,
): boolean {
  const key = tileKey(tile.x, tile.y);
  if (context.arena.solid.has(key) || context.arena.breakable.has(key)) {
    return true;
  }
  return context.bombs.some(
    (bomb) => bomb.tile.x === tile.x && bomb.tile.y === tile.y,
  );
}

/**
 * Dagger landing: last free tile on the cardinal ray (up to range) before a
 * wall, crate or bomb. Players do not block the dagger — it sticks under them.
 * Null when the first tile is already blocked (fizzle).
 */
export function computeBladeLanding(
  origin: TileCoord,
  direction: Direction,
  context: KatarinaSkillContext,
): TileCoord | null {
  const delta = directionDelta[direction];
  let landing: TileCoord | null = null;
  for (let step = 1; step <= KATARINA_BLADE_RANGE_TILES; step += 1) {
    const tile = { x: origin.x + delta.x * step, y: origin.y + delta.y * step };
    if (isBlockedForBlade(tile, context)) {
      break;
    }
    landing = tile;
  }
  return landing;
}

function chebyshev(a: TileCoord, b: TileCoord): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

/** Free tiles adjacent (ring 1) to the dagger, nearest-first to Katarina. */
function blinkFallbackTiles(
  blade: TileCoord,
  player: PlayerState,
  context: KatarinaSkillContext,
): TileCoord[] {
  const from = context.getTileFromPosition(player.position);
  const ring: TileCoord[] = [];
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) continue;
      ring.push({ x: blade.x + dx, y: blade.y + dy });
    }
  }
  return ring.sort(
    (a, b) => chebyshev(a, from) - chebyshev(b, from),
  );
}

function isTileOccupiedByPlayer(
  tile: TileCoord,
  selfId: number,
  context: KatarinaSkillContext,
): boolean {
  for (const id of context.activePlayerIds) {
    if (id === selfId) continue;
    const other = context.players[id];
    if (!other?.alive) continue;
    const otherTile = context.getTileFromPosition(other.position);
    if (otherTile.x === tile.x && otherTile.y === tile.y) {
      return true;
    }
  }
  return false;
}

function canLand(
  tile: TileCoord,
  player: PlayerState,
  context: KatarinaSkillContext,
): boolean {
  const key = tileKey(tile.x, tile.y);
  if (context.arena.solid.has(key) || context.arena.breakable.has(key)) {
    return false;
  }
  if (isTileOccupiedByPlayer(tile, player.id, context)) {
    return false;
  }
  return context.canOccupyPosition(
    player,
    context.normalizeArenaPosition(tileCenter(tile)),
  );
}

/** Enemies on tiles within the slash radius of the dagger. */
export function findSlashVictims(
  blade: TileCoord,
  player: PlayerState,
  context: KatarinaSkillContext,
): PlayerState[] {
  const victims: PlayerState[] = [];
  for (const id of context.activePlayerIds) {
    if (id === player.id) continue;
    const other = context.players[id];
    if (!other?.alive) continue;
    const tile = context.getTileFromPosition(other.position);
    if (chebyshev(tile, blade) <= KATARINA_SLASH_RADIUS) {
      victims.push(other);
    }
  }
  return victims;
}

function placeBlade(
  player: PlayerState,
  tile: TileCoord,
  context: KatarinaSkillContext,
): void {
  consumedBladePlayerIds.delete(player.id);
  bladeTileByPlayerId.set(player.id, { ...tile });
  const effect: KatarinaBladeEffect = {
    kind: "katarina-bouncing-blade",
    ownerId: player.id,
    tile: { ...tile },
    remainingMs: KATARINA_BLADE_ARMED_MS,
  };
  context.addChampionWorldEffect(effect);
  context.soundManager.playOneShot("powerCollect");
}

/** Shunpo: blink to the dagger (or nearest free ring tile) and slash. */
export function fireShunpo(
  player: PlayerState,
  context: KatarinaSkillContext,
): boolean {
  const blade = bladeTileByPlayerId.get(player.id);
  if (!blade) {
    return false;
  }
  bladeTileByPlayerId.delete(player.id);
  consumedBladePlayerIds.add(player.id);

  let landing: TileCoord | null = canLand(blade, player, context)
    ? blade
    : null;
  if (!landing) {
    for (const tile of blinkFallbackTiles(blade, player, context)) {
      if (canLand(tile, player, context)) {
        landing = tile;
        break;
      }
    }
  }

  if (landing) {
    player.position = context.normalizeArenaPosition(tileCenter(landing));
    player.tile = context.getTileFromPosition(player.position);
    player.velocity.x = 0;
    player.velocity.y = 0;
  }

  let hits = 0;
  for (const victim of findSlashVictims(blade, player, context)) {
    if (typeof context.tryAbsorbInstantHit === "function") {
      context.tryAbsorbInstantHit(victim, player.id);
      hits += 1;
    }
  }

  const effect: KatarinaShunpoEffect = {
    kind: "katarina-shunpo-slash",
    ownerId: player.id,
    tile: { ...blade },
    remainingMs: KATARINA_SHUNPO_VISUAL_MS,
  };
  context.addChampionWorldEffect(effect);
  context.soundManager.playOneShot(hits > 0 ? "bombExplode" : "bomb_place");
  return landing !== null;
}

export const KATARINA_SKILL_ADAPTER: ChampionSkillAdapter = {
  skillId: KATARINA_SKILL_ID,
  activate: (player, direction, context) =>
    startBouncingBlade(player, direction, context),
  update: (player, direction, pressed, _held, deltaMs, context) =>
    updateBouncingBlade(player, direction, pressed, deltaMs, context),
  projectTarget: computeBladeTarget,
};
export const CHAMPION_SKILL_ADAPTER = KATARINA_SKILL_ADAPTER;

export function startBouncingBlade(
  player: PlayerState,
  desiredDirection: Direction | null,
  context: KatarinaSkillContext,
): void {
  if (player.skill.id !== KATARINA_SKILL_ID) {
    return;
  }
  const aim =
    desiredDirection ?? player.lastMoveDirection ?? player.direction;
  const landing = computeBladeLanding(
    context.getTileFromPosition(player.position),
    aim,
    context,
  );
  if (!landing) {
    // Lane fully blocked — dagger fizzles at her feet.
    player.skill.phase = "cooldown";
    player.skill.channelRemainingMs = 0;
    player.skill.cooldownRemainingMs = KATARINA_FIZZLE_COOLDOWN_MS;
    player.skill.castElapsedMs = 0;
    player.skill.projectedPosition = null;
    player.skill.projectedLastMoveDirection = null;
    return;
  }
  player.direction = aim;
  player.lastMoveDirection = aim;
  bladeTileByPlayerId.set(player.id, landing);
  player.skill.phase = "channeling";
  player.skill.channelRemainingMs = KATARINA_THROW_CHANNEL_MS;
  player.skill.cooldownRemainingMs = 0;
  player.skill.castElapsedMs = 0;
  player.skill.projectedPosition = null;
  player.skill.projectedLastMoveDirection = aim;
  player.velocity.x = 0;
  player.velocity.y = 0;
}

/**
 * Two-stage driver. Throw channel: brief wind-up, then the dagger sticks and
 * the skill enters "releasing" (armed). While armed, update returns false so
 * Katarina keeps moving/bombing; a re-press blinks (Shunpo). Expiry without
 * re-press refunds half the cooldown.
 */
export function updateBouncingBlade(
  player: PlayerState,
  _desiredDirection: Direction | null,
  pressed: boolean,
  deltaMs: number,
  context: KatarinaSkillContext,
): boolean {
  if (player.skill.id !== KATARINA_SKILL_ID) {
    return false;
  }
  if (!Number.isFinite(deltaMs) || deltaMs <= 0) {
    return player.skill.phase === "channeling";
  }

  if (player.skill.phase === "channeling") {
    player.velocity.x = 0;
    player.velocity.y = 0;
    player.skill.channelRemainingMs = Math.max(
      0,
      player.skill.channelRemainingMs - deltaMs,
    );
    player.skill.castElapsedMs += deltaMs;
    if (player.skill.channelRemainingMs <= 0) {
      const blade = bladeTileByPlayerId.get(player.id);
      if (blade) {
        placeBlade(player, blade, context);
      }
      player.skill.phase = "releasing";
      player.skill.channelRemainingMs = KATARINA_BLADE_ARMED_MS;
      player.skill.castElapsedMs = 0;
    }
    return true;
  }

  if (player.skill.phase === "releasing") {
    if (pressed) {
      fireShunpo(player, context);
      finishBouncingBlade(player, KATARINA_SKILL_COOLDOWN_MS);
      return true;
    }
    player.skill.channelRemainingMs = Math.max(
      0,
      player.skill.channelRemainingMs - deltaMs,
    );
    player.skill.castElapsedMs += deltaMs;
    if (player.skill.channelRemainingMs <= 0) {
      bladeTileByPlayerId.delete(player.id);
      consumedBladePlayerIds.add(player.id);
      finishBouncingBlade(player, KATARINA_BLADE_EXPIRE_COOLDOWN_MS);
    }
    // Armed dagger does not consume input — Katarina keeps moving/bombing.
    return false;
  }
  return false;
}

export function finishBouncingBlade(
  player: PlayerState,
  cooldownMs: number,
): void {
  if (player.skill.id !== KATARINA_SKILL_ID) {
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

/** Aim preview: where the dagger would stick. */
export function computeBladeTarget(
  player: PlayerState,
  direction: Direction,
  context: KatarinaSkillContext,
): PixelCoord {
  const origin = context.getTileFromPosition(player.position);
  const landing = computeBladeLanding(origin, direction, context) ?? origin;
  return context.normalizeArenaPosition(tileCenter(landing));
}
