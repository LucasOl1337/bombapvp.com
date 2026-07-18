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

/** Channel while tide locks the target, then exchange. */
export const MIRELLE_SKILL_CHANNEL_MS = 450;
export const MIRELLE_SWAP_RANGE = 4;
export const MIRELLE_MISS_COOLDOWN_MS = 1_400;
export const MIRELLE_SWAP_VISUAL_MS = 480;
/** Brief tide shield after a successful enemy swap. */
export const MIRELLE_POST_SWAP_GUARD_MS = 450;

export type MirelleSkillContext = Pick<
  SkillContext,
  | "players"
  | "activePlayerIds"
  | "bombs"
  | "arena"
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

/** Nearest bomb in range when no enemy — tide steals the bomb's tile. */
export function findTideSwapBomb(
  caster: PlayerState,
  context: MirelleSkillContext,
): { id: number; tile: TileCoord } | null {
  const origin = context.getTileFromPosition(caster.position);
  let best: { id: number; tile: TileCoord } | null = null;
  let bestDist = Infinity;
  for (const bomb of context.bombs) {
    const dist = chebyshev(origin, bomb.tile);
    if (dist < 1 || dist > MIRELLE_SWAP_RANGE) continue;
    if (dist < bestDist || (dist === bestDist && best && bomb.id < best.id)) {
      best = { id: bomb.id, tile: { ...bomb.tile } };
      bestDist = dist;
    }
  }
  return best;
}

function faceToward(self: PlayerState, other: TileCoord): void {
  if (self.tile.x !== other.x) {
    self.direction = self.tile.x < other.x ? "right" : "left";
  } else if (self.tile.y !== other.y) {
    self.direction = self.tile.y < other.y ? "down" : "up";
  }
  self.lastMoveDirection = self.direction;
}

function spawnRibbon(
  ownerId: PlayerState["id"],
  from: PixelCoord,
  to: PixelCoord,
  fromTile: TileCoord,
  toTile: TileCoord,
  context: MirelleSkillContext,
): void {
  const effect: MirelleTideSwapEffect = {
    kind: "mirelle-tide-swap",
    ownerId,
    from: { ...from },
    to: { ...to },
    fromTile: { ...fromTile },
    toTile: { ...toTile },
    remainingMs: MIRELLE_SWAP_VISUAL_MS,
  };
  context.addChampionWorldEffect(effect);
}

/**
 * Tide Exchange:
 * 1) Prefer nearest living enemy → full position swap + short dual flame guard.
 * 2) Else nearest bomb in range → you take the bomb tile, bomb is teleported to your old tile.
 */
export function fireTideSwap(
  caster: PlayerState,
  context: MirelleSkillContext,
): boolean {
  const enemy = findTideSwapTarget(caster, context);
  if (enemy) {
    const aTile = context.getTileFromPosition(caster.position);
    const bTile = context.getTileFromPosition(enemy.position);
    if (aTile.x === bTile.x && aTile.y === bTile.y) return false;
    const fromPx = { ...caster.position };
    const toPx = { ...enemy.position };
    caster.position = context.normalizeArenaPosition(tileCenter(bTile));
    enemy.position = context.normalizeArenaPosition(tileCenter(aTile));
    caster.tile = context.getTileFromPosition(caster.position);
    enemy.tile = context.getTileFromPosition(enemy.position);
    caster.velocity = { x: 0, y: 0 };
    enemy.velocity = { x: 0, y: 0 };
    faceToward(caster, enemy.tile);
    faceToward(enemy, caster.tile);
    caster.flameGuardMs = Math.max(
      caster.flameGuardMs,
      MIRELLE_POST_SWAP_GUARD_MS,
    );
    enemy.flameGuardMs = Math.max(
      enemy.flameGuardMs,
      MIRELLE_POST_SWAP_GUARD_MS,
    );
    spawnRibbon(caster.id, fromPx, toPx, aTile, bTile, context);
    context.soundManager.playOneShot("powerCollect");
    return true;
  }

  const bombTarget = findTideSwapBomb(caster, context);
  if (!bombTarget) return false;
  const bomb = context.bombs.find((b) => b.id === bombTarget.id);
  if (!bomb) return false;
  const aTile = context.getTileFromPosition(caster.position);
  const bTile = { ...bomb.tile };
  if (aTile.x === bTile.x && aTile.y === bTile.y) return false;
  // Bomb lands on caster's old tile only if free of other bombs/solids.
  const bombKey = `${aTile.x},${aTile.y}`;
  if (
    context.arena.solid.has(bombKey) ||
    context.arena.breakable.has(bombKey) ||
    context.bombs.some(
      (b) => b.id !== bomb.id && b.tile.x === aTile.x && b.tile.y === aTile.y,
    )
  ) {
    return false;
  }
  const fromPx = { ...caster.position };
  const toPx = tileCenter(bTile);
  caster.position = context.normalizeArenaPosition(toPx);
  caster.tile = context.getTileFromPosition(caster.position);
  caster.velocity = { x: 0, y: 0 };
  bomb.tile = { ...aTile };
  bomb.ownerCanPass = false;
  bomb.bodyEgressPlayerIds = [];
  faceToward(caster, aTile);
  spawnRibbon(caster.id, fromPx, toPx, aTile, bTile, context);
  context.soundManager.playOneShot("bombPlace");
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
