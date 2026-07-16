import type { PlayerState } from "../Gameplay/types";
import {
  canBotSafelyPlaceBomb,
  getBotDecision,
  type BotContext,
  type BotDecision,
} from "./bot-ai";

export const BOT_V2_CHARACTER_INDEX = 1;

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

/**
 * V2 preserves V1's deterministic navigation and safe bomb routing, then adds
 * a contact attack: if both players occupy the same tile, V2 plants first.
 */
export function getBotV2Decision(player: PlayerState, context: BotContext): BotDecision {
  const base = getBotDecision(player, context);
  const target = closestEnemy(player, context);
  if (!target) return base;

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
