import type {
  Direction,
  PlayerState,
  TileCoord,
} from "../../src/original-game/Gameplay/types";
import { tileKey } from "../../src/original-game/Arenas/arena";
import type { SkillContext } from "../../src/original-game/ultimate/shared";
import type { ChampionSkillAdapter } from "../runtime-contracts";
import type { ZephyrGaleEffect } from "./contracts";
import { ZEPHYR_SKILL_COOLDOWN_MS, ZEPHYR_SKILL_ID } from "./definition";

export { ZEPHYR_CHARACTER_ID, ZEPHYR_SKILL_COOLDOWN_MS } from "./definition";

export const ZEPHYR_SKILL_CHANNEL_MS = 220;
export const ZEPHYR_GALE_RANGE = 2;
export const ZEPHYR_PUSH_TILES = 1;
export const ZEPHYR_MISS_COOLDOWN_MS = 1_200;
export const ZEPHYR_GALE_VISUAL_MS = 360;

export type ZephyrSkillContext = Pick<
  SkillContext,
  | "arena"
  | "bombs"
  | "players"
  | "activePlayerIds"
  | "getTileFromPosition"
  | "isPositionOverlappingTile"
  | "addChampionWorldEffect"
  | "soundManager"
>;


function chebyshev(a: TileCoord, b: TileCoord): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

function sign(n: number): number {
  if (n > 0) return 1;
  if (n < 0) return -1;
  return 0;
}

function isBombLandingBlocked(
  tile: TileCoord,
  bombId: number,
  context: ZephyrSkillContext,
): boolean {
  const key = tileKey(tile.x, tile.y);
  if (context.arena.solid.has(key) || context.arena.breakable.has(key)) {
    return true;
  }
  if (
    context.bombs.some(
      (b) => b.id !== bombId && b.tile.x === tile.x && b.tile.y === tile.y,
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

export function pushBombAwayFromCenter(
  bombId: number,
  center: TileCoord,
  fallback: Direction,
  context: ZephyrSkillContext,
): boolean {
  const bomb = context.bombs.find((b) => b.id === bombId);
  if (!bomb) return false;
  let dx = sign(bomb.tile.x - center.x);
  let dy = sign(bomb.tile.y - center.y);
  if (dx === 0 && dy === 0) {
    const delta = {
      up: { x: 0, y: -1 },
      down: { x: 0, y: 1 },
      left: { x: -1, y: 0 },
      right: { x: 1, y: 0 },
    }[fallback];
    dx = delta.x;
    dy = delta.y;
  } else if (dx !== 0 && dy !== 0) {
    // Prefer cardinal for readability.
    if (Math.abs(bomb.tile.x - center.x) >= Math.abs(bomb.tile.y - center.y)) {
      dy = 0;
    } else {
      dx = 0;
    }
  }
  let target = { ...bomb.tile };
  let moved = 0;
  for (let step = 0; step < ZEPHYR_PUSH_TILES; step += 1) {
    const next = { x: target.x + dx, y: target.y + dy };
    if (isBombLandingBlocked(next, bomb.id, context)) break;
    target = next;
    moved += 1;
  }
  if (moved <= 0) return false;
  bomb.tile = target;
  bomb.ownerCanPass = false;
  bomb.bodyEgressPlayerIds = [];
  return true;
}

export function fireGaleScatter(
  player: PlayerState,
  context: ZephyrSkillContext,
): number {
  const center = context.getTileFromPosition(player.position);
  const facing =
    player.skill.projectedLastMoveDirection ??
    player.lastMoveDirection ??
    player.direction;
  let pushed = 0;
  const ids = context.bombs.map((b) => b.id);
  for (const id of ids) {
    const bomb = context.bombs.find((b) => b.id === id);
    if (!bomb) continue;
    if (chebyshev(center, bomb.tile) > ZEPHYR_GALE_RANGE) continue;
    if (pushBombAwayFromCenter(id, center, facing, context)) {
      pushed += 1;
    }
  }
  const effect: ZephyrGaleEffect = {
    kind: "zephyr-gale",
    ownerId: player.id,
    origin: { ...center },
    remainingMs: ZEPHYR_GALE_VISUAL_MS,
    maxRadiusTiles: ZEPHYR_GALE_RANGE,
    pushedCount: pushed,
  };
  context.addChampionWorldEffect(effect);
  context.soundManager.playOneShot(pushed > 0 ? "bombPlace" : "powerCollect");
  return pushed;
}

export const ZEPHYR_SKILL_ADAPTER: ChampionSkillAdapter = {
  skillId: ZEPHYR_SKILL_ID,
  activate: (player, direction) => startZephyrGaleScatter(player, direction),
  update: (player, direction, _p, _h, deltaMs, context) =>
    updateZephyrGaleScatter(player, direction, deltaMs, context),
};
export const CHAMPION_SKILL_ADAPTER = ZEPHYR_SKILL_ADAPTER;

export function startZephyrGaleScatter(
  player: PlayerState,
  desiredDirection: Direction | null,
): void {
  if (player.skill.id !== ZEPHYR_SKILL_ID) return;
  const aim =
    desiredDirection ?? player.lastMoveDirection ?? player.direction;
  player.direction = aim;
  player.lastMoveDirection = aim;
  player.skill.phase = "channeling";
  player.skill.channelRemainingMs = ZEPHYR_SKILL_CHANNEL_MS;
  player.skill.cooldownRemainingMs = 0;
  player.skill.castElapsedMs = 0;
  player.skill.projectedPosition = null;
  player.skill.projectedLastMoveDirection = aim;
  player.velocity.x = 0;
  player.velocity.y = 0;
}

export function updateZephyrGaleScatter(
  player: PlayerState,
  desiredDirection: Direction | null,
  deltaMs: number,
  context: ZephyrSkillContext,
): boolean {
  if (player.skill.id !== ZEPHYR_SKILL_ID) return false;
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
    const pushed = fireGaleScatter(player, context);
    player.skill.phase = "cooldown";
    player.skill.cooldownRemainingMs =
      pushed > 0 ? ZEPHYR_SKILL_COOLDOWN_MS : ZEPHYR_MISS_COOLDOWN_MS;
    player.skill.castElapsedMs = 0;
    player.skill.projectedPosition = null;
    player.skill.projectedLastMoveDirection = null;
  }
  return true;
}
