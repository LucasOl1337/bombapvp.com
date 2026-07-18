import { tileKey } from "../Arenas/arena";
import type { Direction, PixelCoord, PlayerState, TileCoord } from "../Gameplay/types";
import { TILE_SIZE } from "../PersonalConfig/config";
import {
  canBotSafelyPlaceBomb,
  getBotDecision,
} from "./bot-ai";
import type { BotContext, BotDecision } from "./bot-contracts";
import { KILLER_BEE_SKILL_ID } from "../../../Champions/killer-bee/definition";

export const BOT_V2_CHARACTER_INDEX = 1;

const DASH_MAX_DISTANCE = 6;
const DASH_SAMPLE_PX = 4;
const DASH_SAFETY_WINDOW_MS = 500;
const DIRECTION_DELTA: Record<Direction, TileCoord> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

type Target = Readonly<{ player: PlayerState; distance: number }>;

function closestEnemy(player: PlayerState, context: BotContext): Target | null {
  let closest: Target | null = null;
  for (const playerId of context.activePlayerIds) {
    if (playerId === player.id) continue;
    const enemy = context.players[playerId];
    if (!enemy.active || !enemy.alive) continue;
    const distance = Math.abs(player.tile.x - enemy.tile.x) + Math.abs(player.tile.y - enemy.tile.y);
    if (!closest || distance < closest.distance) closest = { player: enemy, distance };
  }
  return closest;
}

function alignedDirection(player: PlayerState, target: PlayerState): Direction | null {
  if (player.tile.y === target.tile.y) return target.tile.x > player.tile.x ? "right" : "left";
  if (player.tile.x === target.tile.x) return target.tile.y > player.tile.y ? "down" : "up";
  return null;
}

function getPositionTile(position: PixelCoord) {
  return { x: Math.floor(position.x / TILE_SIZE), y: Math.floor(position.y / TILE_SIZE) };
}

function hasTacticalDashLane(player: PlayerState, direction: Direction, context: BotContext): boolean {
  const delta = DIRECTION_DELTA[direction];
  let tile = { ...player.tile };
  for (let step = 0; step < 2; step += 1) {
    tile = { x: tile.x + delta.x, y: tile.y + delta.y };
    const { width, height } = context.arena.config.grid;
    if (tile.x < 0 || tile.y < 0 || tile.x >= width || tile.y >= height) return false;
    const key = tileKey(tile.x, tile.y);
    if (
      context.arena.solid.has(key)
      || context.arena.breakable.has(key)
      || context.bombs.some((bomb) => bomb.tile.x === tile.x && bomb.tile.y === tile.y)
    ) return false;
  }
  return true;
}

function getSafeDashDirection(player: PlayerState, target: Target, context: BotContext): Direction | null {
  if (
    player.skill.id !== KILLER_BEE_SKILL_ID
    || player.skill.phase !== "idle"
    || player.skill.cooldownRemainingMs > 0
    || player.spawnProtectionMs > 0
    || target.distance < 2
    || target.distance > DASH_MAX_DISTANCE
    || !context.dangerMap
  ) return null;

  const direction = alignedDirection(player, target.player);
  if (!direction || !hasTacticalDashLane(player, direction, context)) return null;

  const projectedPosition = context.projectSkillTarget(player, direction);
  const horizontal = direction === "left" || direction === "right";
  const projectedDistancePx = Math.abs(horizontal
    ? projectedPosition.x - player.position.x
    : projectedPosition.y - player.position.y);
  if (projectedDistancePx < 1) return null;

  const delta = DIRECTION_DELTA[direction];
  for (let distancePx = DASH_SAMPLE_PX; distancePx <= projectedDistancePx; distancePx += DASH_SAMPLE_PX) {
    const samplePosition = {
      x: player.position.x + delta.x * Math.min(distancePx, projectedDistancePx),
      y: player.position.y + delta.y * Math.min(distancePx, projectedDistancePx),
    };
    const tile = getPositionTile(samplePosition);
    const dangerEtaMs = context.dangerMap.get(tileKey(tile.x, tile.y));
    if (dangerEtaMs !== undefined && dangerEtaMs <= DASH_SAFETY_WINDOW_MS) return null;
  }
  return direction;
}

/**
 * V2 preserves V1's deterministic navigation and safe bomb routing, then adds
 * a contact attack and a straight-line Killer Bee dash through safe corridors.
 */
export function getBotV2Decision(player: PlayerState, context: BotContext): BotDecision {
  const base = getBotDecision(player, context);
  const target = closestEnemy(player, context);
  if (!target) return base;

  const dashDirection = !base.placeBomb && !base.detonate
    ? getSafeDashDirection(player, target, context)
    : null;
  if (dashDirection) {
    return {
      ...base,
      direction: dashDirection,
      placeBomb: false,
      useSkill: true,
      skillHeld: false,
      skillAction: "start",
      targetId: target.player.id,
      intent: "chase-enemy",
    };
  }

  const bombAlreadyOnTile = context.bombs.some((bomb) => (
    bomb.tile.x === player.tile.x && bomb.tile.y === player.tile.y
  ));
  const canContactTrap = target.distance === 0
    && player.spawnProtectionMs <= 0
    && player.activeBombs < player.maxBombs
    && !bombAlreadyOnTile
    && canBotSafelyPlaceBomb(player, context);
  if (!canContactTrap) return base;

  return {
    ...base,
    placeBomb: true,
    targetId: target.player.id,
    intent: "bomb-attack",
  };
}
