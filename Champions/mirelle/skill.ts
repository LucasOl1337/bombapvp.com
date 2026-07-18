import type {
  Direction,
  PixelCoord,
  PlayerState,
  TileCoord,
} from "../../src/original-game/Gameplay/types";
import { TILE_SIZE } from "../../src/original-game/PersonalConfig/config";
import type { SkillContext } from "../../src/original-game/ultimate/shared";
import type { ChampionSkillAdapter } from "../runtime-contracts";
import type { MirelleTideSwapEffect } from "./contracts";
import {
  MIRELLE_SKILL_COOLDOWN_MS,
  MIRELLE_SKILL_ID,
} from "./definition";

export {
  MIRELLE_CHARACTER_ID,
  MIRELLE_SKILL_COOLDOWN_MS,
} from "./definition";

/** Short wind-up; always completes once started (tap is enough). */
export const MIRELLE_SKILL_CHANNEL_MS = 220;
/** Chebyshev range for nearest living enemy. */
export const MIRELLE_SWAP_RANGE = 4;
/** Miss / no-target cooldown so a dry cast is not full 8s. */
export const MIRELLE_MISS_COOLDOWN_MS = 1_200;
/** How long the tide ribbon VFX lasts. */
export const MIRELLE_SWAP_VISUAL_MS = 420;

export type MirelleSkillContext = Pick<
  SkillContext,
  | "players"
  | "activePlayerIds"
  | "getTileFromPosition"
  | "normalizeArenaPosition"
  | "canOccupyPosition"
  | "addChampionWorldEffect"
  | "soundManager"
>;

function chebyshev(a: TileCoord, b: TileCoord): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

export function tileCenter(tile: TileCoord): PixelCoord {
  return {
    x: tile.x * TILE_SIZE + TILE_SIZE * 0.5,
    y: tile.y * TILE_SIZE + TILE_SIZE * 0.5,
  };
}

/** Nearest living enemy within Chebyshev range (ties → lower player id). */
export function findTideSwapTarget(
  caster: PlayerState,
  context: MirelleSkillContext,
): PlayerState | null {
  const origin = context.getTileFromPosition(caster.position);
  let best: PlayerState | null = null;
  let bestDist = Infinity;
  for (const id of context.activePlayerIds) {
    if (id === caster.id) continue;
    const other = context.players[id];
    if (!other?.alive) continue;
    const tile = context.getTileFromPosition(other.position);
    const dist = chebyshev(origin, tile);
    if (dist < 1 || dist > MIRELLE_SWAP_RANGE) continue;
    if (
      dist < bestDist ||
      (dist === bestDist && best !== null && other.id < best.id)
    ) {
      best = other;
      bestDist = dist;
    }
  }
  return best;
}

/**
 * Instant position swap to tile centers.
 * Returns false when no valid enemy is in range.
 */
export function fireTideSwap(
  caster: PlayerState,
  context: MirelleSkillContext,
): boolean {
  const target = findTideSwapTarget(caster, context);
  if (!target) {
    return false;
  }

  const aTile = context.getTileFromPosition(caster.position);
  const bTile = context.getTileFromPosition(target.position);
  if (aTile.x === bTile.x && aTile.y === bTile.y) {
    return false;
  }

  // Land on clean tile centers so both players settle on grid.
  const aLanding = context.normalizeArenaPosition(tileCenter(bTile));
  const bLanding = context.normalizeArenaPosition(tileCenter(aTile));

  // Soft occupy check: bombs under the other player should not hard-block a swap
  // (tide fantasy = phase through), but solid geometry is already encoded in tiles.
  void context.canOccupyPosition;

  const fromPx: PixelCoord = { ...caster.position };
  const toPx: PixelCoord = { ...target.position };

  caster.position = aLanding;
  target.position = bLanding;
  caster.tile = context.getTileFromPosition(caster.position);
  target.tile = context.getTileFromPosition(target.position);
  caster.velocity.x = 0;
  caster.velocity.y = 0;
  target.velocity.x = 0;
  target.velocity.y = 0;

  // Face each other after swap for readable body language.
  if (caster.tile.x !== target.tile.x) {
    caster.direction = caster.tile.x < target.tile.x ? "right" : "left";
    target.direction = target.tile.x < caster.tile.x ? "right" : "left";
  } else if (caster.tile.y !== target.tile.y) {
    caster.direction = caster.tile.y < target.tile.y ? "down" : "up";
    target.direction = target.tile.y < caster.tile.y ? "down" : "up";
  }
  caster.lastMoveDirection = caster.direction;
  target.lastMoveDirection = target.direction;

  const effect: MirelleTideSwapEffect = {
    kind: "mirelle-tide-swap",
    ownerId: caster.id,
    from: fromPx,
    to: toPx,
    fromTile: { ...aTile },
    toTile: { ...bTile },
    remainingMs: MIRELLE_SWAP_VISUAL_MS,
  };
  context.addChampionWorldEffect(effect);
  context.soundManager.playOneShot("powerCollect");
  return true;
}

export const MIRELLE_SKILL_ADAPTER: ChampionSkillAdapter = {
  skillId: MIRELLE_SKILL_ID,
  activate: (player, direction) => startMirelleTideSwap(player, direction),
  update: (player, direction, _p, _h, deltaMs, context) =>
    updateMirelleTideSwap(player, direction, deltaMs, context),
};
export const CHAMPION_SKILL_ADAPTER = MIRELLE_SKILL_ADAPTER;

export function startMirelleTideSwap(
  player: PlayerState,
  desiredDirection: Direction | null,
): void {
  if (player.skill.id !== MIRELLE_SKILL_ID) return;
  const aim =
    desiredDirection ?? player.lastMoveDirection ?? player.direction;
  player.direction = aim;
  player.lastMoveDirection = aim;
  player.skill.phase = "channeling";
  player.skill.channelRemainingMs = MIRELLE_SKILL_CHANNEL_MS;
  player.skill.cooldownRemainingMs = 0;
  player.skill.castElapsedMs = 0;
  player.skill.projectedPosition = null;
  player.skill.projectedLastMoveDirection = aim;
  player.velocity.x = 0;
  player.velocity.y = 0;
}

export function updateMirelleTideSwap(
  player: PlayerState,
  desiredDirection: Direction | null,
  deltaMs: number,
  context: MirelleSkillContext,
): boolean {
  if (player.skill.id !== MIRELLE_SKILL_ID) return false;
  if (!Number.isFinite(deltaMs) || deltaMs <= 0) return true;
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
    const hit = fireTideSwap(player, context);
    player.skill.phase = "cooldown";
    player.skill.cooldownRemainingMs = hit
      ? MIRELLE_SKILL_COOLDOWN_MS
      : MIRELLE_MISS_COOLDOWN_MS;
    player.skill.castElapsedMs = 0;
    player.skill.projectedPosition = null;
    player.skill.projectedLastMoveDirection = null;
  }
  return true;
}
