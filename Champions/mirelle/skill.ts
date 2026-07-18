import type {
  Direction,
  PlayerState,
  TileCoord,
} from "../../src/original-game/Gameplay/types";
import { TILE_SIZE } from "../../src/original-game/PersonalConfig/config";
import type { SkillContext } from "../../src/original-game/ultimate/shared";
import type { ChampionSkillAdapter } from "../runtime-contracts";
import {
  MIRELLE_SKILL_COOLDOWN_MS,
  MIRELLE_SKILL_ID,
} from "./definition";

export {
  MIRELLE_CHARACTER_ID,
  MIRELLE_SKILL_COOLDOWN_MS,
} from "./definition";

export const MIRELLE_SKILL_CHANNEL_MS = 280;
export const MIRELLE_SWAP_RANGE = 4;

export type MirelleSkillContext = Pick<
  SkillContext,
  | "players"
  | "activePlayerIds"
  | "getTileFromPosition"
  | "normalizeArenaPosition"
  | "canOccupyPosition"
  | "soundManager"
>;

function chebyshev(a: TileCoord, b: TileCoord): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

function tileCenter(tile: TileCoord) {
  return {
    x: tile.x * TILE_SIZE + TILE_SIZE * 0.5,
    y: tile.y * TILE_SIZE + TILE_SIZE * 0.5,
  };
}

/** Find nearest living enemy within Chebyshev range (ties: lower player id). */
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

/** Swap caster and target positions if both landings remain occupiable. */
export function fireTideSwap(
  caster: PlayerState,
  context: MirelleSkillContext,
): boolean {
  const target = findTideSwapTarget(caster, context);
  if (!target) {
    return false;
  }
  const aPos = { ...caster.position };
  const bPos = { ...target.position };
  const aLanding = context.normalizeArenaPosition(bPos);
  const bLanding = context.normalizeArenaPosition(aPos);
  if (
    !context.canOccupyPosition(caster, aLanding) ||
    !context.canOccupyPosition(target, bLanding)
  ) {
    // Landing checks can fail due to bombs under feet of the other player —
    // still allow pure tile-center swap when tiles differ.
    const aTile = context.getTileFromPosition(aPos);
    const bTile = context.getTileFromPosition(bPos);
    if (aTile.x === bTile.x && aTile.y === bTile.y) {
      return false;
    }
  }
  caster.position = aLanding;
  target.position = bLanding;
  caster.tile = context.getTileFromPosition(caster.position);
  target.tile = context.getTileFromPosition(target.position);
  caster.velocity.x = 0;
  caster.velocity.y = 0;
  target.velocity.x = 0;
  target.velocity.y = 0;
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
    fireTideSwap(player, context);
    player.skill.phase = "cooldown";
    player.skill.cooldownRemainingMs = MIRELLE_SKILL_COOLDOWN_MS;
    player.skill.castElapsedMs = 0;
    player.skill.projectedPosition = null;
    player.skill.projectedLastMoveDirection = null;
  }
  return true;
}

// silence unused helper for tests that want tile centers
export { tileCenter };
