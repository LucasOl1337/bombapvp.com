import { tileKey } from "../Arenas/arena";
import { getBombFuseMsForPlayer } from "../Gameplay/powerups";
import {
  BASE_MOVE_MS,
  MIN_MOVE_MS,
  SPEED_STEP_MS,
  TILE_SIZE,
} from "../PersonalConfig/config";
import type {
  BombState,
  Direction,
  PlayerState,
  PowerUpType,
  TileCoord,
} from "../Gameplay/types";
import type { BotContext, BotDecision } from "./bot-contracts";
import { RANNI_SKILL_ID } from "../../../Champions/ranni/definition";

export const BOMB_CHARACTER_INDEX = 0;

const DIRECTIONS: readonly Direction[] = ["up", "left", "down", "right"];
const DELTA: Readonly<Record<Direction, TileCoord>> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};
const ARRIVAL_MARGIN_MS = 180;
const REACTION_WINDOW_MS = 1_300;
const TURN_CENTER_TOLERANCE_PX = 2;
const POWER_UP_SCORE: Readonly<Record<PowerUpType, number>> = {
  "shield-up": 10,
  "bomb-pass-up": 9,
  "speed-up": 8,
  "flame-up": 7,
  "bomb-up": 6,
  "remote-up": 5,
  "kick-up": 4,
  "short-fuse-up": 3,
};

type RouteNode = Readonly<{
  tile: TileCoord;
  firstDirection: Direction | null;
  steps: number;
}>;

function moveDuration(player: PlayerState): number {
  return Math.max(MIN_MOVE_MS, BASE_MOVE_MS - player.speedLevel * SPEED_STEP_MS);
}

function distance(left: TileCoord, right: TileCoord): number {
  return Math.abs(left.x - right.x) + Math.abs(left.y - right.y);
}

function inBounds(tile: TileCoord, context: BotContext): boolean {
  return tile.x >= 0
    && tile.y >= 0
    && tile.x < context.arena.config.grid.width
    && tile.y < context.arena.config.grid.height;
}

function adjacentTile(
  tile: TileCoord,
  direction: Direction,
  context: BotContext,
): TileCoord {
  const delta = DELTA[direction];
  const adjacent = { x: tile.x + delta.x, y: tile.y + delta.y };
  if (inBounds(adjacent, context)) return adjacent;
  const isPortal = context.arena.config.wrapPortals.some((portal) => (
    portal.x === tile.x && portal.y === tile.y
  ));
  if (!isPortal) return adjacent;
  return {
    x: (adjacent.x + context.arena.config.grid.width) % context.arena.config.grid.width,
    y: (adjacent.y + context.arena.config.grid.height) % context.arena.config.grid.height,
  };
}

function isOpen(
  tile: TileCoord,
  origin: TileCoord,
  context: BotContext,
  blockedTile?: TileCoord,
): boolean {
  if (!inBounds(tile, context)) return false;
  const key = tileKey(tile.x, tile.y);
  if (context.arena.solid.has(key) || context.arena.breakable.has(key)) return false;
  if (
    blockedTile
    && tile.x === blockedTile.x
    && tile.y === blockedTile.y
    && (tile.x !== origin.x || tile.y !== origin.y)
  ) return false;
  return !context.bombs.some((bomb) => (
    bomb.tile.x === tile.x
    && bomb.tile.y === tile.y
    && (tile.x !== origin.x || tile.y !== origin.y)
  ));
}

function blastTiles(
  bomb: Pick<BombState, "tile" | "flameRange">,
  context: BotContext,
): TileCoord[] {
  const tiles: TileCoord[] = [{ ...bomb.tile }];
  for (const direction of DIRECTIONS) {
    const delta = DELTA[direction];
    for (let step = 1; step <= bomb.flameRange; step += 1) {
      const tile = {
        x: bomb.tile.x + delta.x * step,
        y: bomb.tile.y + delta.y * step,
      };
      if (!inBounds(tile, context)) break;
      const key = tileKey(tile.x, tile.y);
      if (context.arena.solid.has(key)) break;
      tiles.push(tile);
      if (context.arena.breakable.has(key)) break;
    }
  }
  return tiles;
}

function threatMap(
  context: BotContext,
  extraBomb?: Pick<BombState, "tile" | "flameRange" | "fuseMs">,
): Map<string, number> {
  const bombs = context.bombs.map((bomb) => ({
    tile: bomb.tile,
    flameRange: bomb.flameRange,
    fuseMs: bomb.fuseMs,
  }));
  if (extraBomb) bombs.push({ ...extraBomb });

  for (let pass = 0; pass < bombs.length; pass += 1) {
    let changed = false;
    for (const source of bombs) {
      const blast = new Set(blastTiles(source, context).map((tile) => tileKey(tile.x, tile.y)));
      for (const target of bombs) {
        if (source === target || !blast.has(tileKey(target.tile.x, target.tile.y))) continue;
        if (target.fuseMs > source.fuseMs) {
          target.fuseMs = source.fuseMs;
          changed = true;
        }
      }
    }
    if (!changed) break;
  }

  const threats = new Map<string, number>();
  for (const bomb of bombs) {
    for (const tile of blastTiles(bomb, context)) {
      const key = tileKey(tile.x, tile.y);
      threats.set(key, Math.min(threats.get(key) ?? Number.POSITIVE_INFINITY, bomb.fuseMs));
    }
  }
  for (const flame of context.flames) threats.set(tileKey(flame.tile.x, flame.tile.y), 0);
  for (const effect of context.suddenDeathClosureEffects) {
    threats.set(tileKey(effect.tile.x, effect.tile.y), 0);
  }
  return threats;
}

function safeEscapeDirection(
  player: PlayerState,
  enemies: readonly PlayerState[],
  context: BotContext,
  threats: ReadonlyMap<string, number>,
  blockedTile?: TileCoord,
): Direction | null {
  const queue: RouteNode[] = [{ tile: player.tile, firstDirection: null, steps: 0 }];
  const visited = new Set([tileKey(player.tile.x, player.tile.y)]);
  const stepMs = moveDuration(player);
  let best: RouteNode | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const node = queue[cursor]!;
    const dangerEta = threats.get(tileKey(node.tile.x, node.tile.y));
    const enemyDistance = enemies.length === 0
      ? 0
      : Math.min(...enemies.map((enemy) => distance(node.tile, enemy.tile)));
    if (dangerEta === undefined) {
      const score = enemyDistance * 100 - node.steps;
      if (score > bestScore) {
        best = node;
        bestScore = score;
      }
    }
    if (node.steps >= 12) continue;

    for (const direction of DIRECTIONS) {
      const tile = adjacentTile(node.tile, direction, context);
      const key = tileKey(tile.x, tile.y);
      if (visited.has(key) || !isOpen(tile, player.tile, context, blockedTile)) continue;
      const steps = node.steps + 1;
      const eta = threats.get(key);
      if (eta !== undefined && eta <= steps * stepMs + ARRIVAL_MARGIN_MS) continue;
      visited.add(key);
      queue.push({ tile, firstDirection: node.firstDirection ?? direction, steps });
    }
  }
  return best?.firstDirection ?? null;
}

function alignThreatenedEscapeToTileCenter(
  player: PlayerState,
  desired: Direction,
  context: BotContext,
  projected = false,
): Direction | null {
  const centerX = player.tile.x * TILE_SIZE + TILE_SIZE / 2;
  const centerY = player.tile.y * TILE_SIZE + TILE_SIZE / 2;
  const offsetX = player.position.x - centerX;
  const offsetY = player.position.y - centerY;
  let correction: Direction | null = null;

  if (
    (desired === "up" || desired === "down")
    && Math.abs(offsetX) > TURN_CENTER_TOLERANCE_PX
  ) {
    correction = offsetX > 0 ? "left" : "right";
  } else if (
    (desired === "left" || desired === "right")
    && Math.abs(offsetY) > TURN_CENTER_TOLERANCE_PX
  ) {
    correction = offsetY > 0 ? "up" : "down";
  }

  const canAdvance = (direction: Direction): boolean => {
    const option = projected
      ? context.evaluateProjectedMovementOption(player, direction, 1_000 / 60)
      : context.evaluateMovementOption(player, direction, 1_000 / 60);
    return context.canMovementOptionAdvance(player.position, option);
  };
  if (correction !== null && canAdvance(correction)) return correction;
  return canAdvance(desired) ? desired : null;
}

function centerExitTimeMs(player: PlayerState, direction: Direction): number {
  const centerX = player.tile.x * TILE_SIZE + TILE_SIZE / 2;
  const centerY = player.tile.y * TILE_SIZE + TILE_SIZE / 2;
  const alignmentDistance = direction === "up" || direction === "down"
    ? Math.max(0, Math.abs(player.position.x - centerX) - TURN_CENTER_TOLERANCE_PX)
    : Math.max(0, Math.abs(player.position.y - centerY) - TURN_CENTER_TOLERANCE_PX);
  let boundaryDistance: number;
  switch (direction) {
    case "up":
      boundaryDistance = player.position.y - player.tile.y * TILE_SIZE;
      break;
    case "down":
      boundaryDistance = (player.tile.y + 1) * TILE_SIZE - player.position.y;
      break;
    case "left":
      boundaryDistance = player.position.x - player.tile.x * TILE_SIZE;
      break;
    case "right":
      boundaryDistance = (player.tile.x + 1) * TILE_SIZE - player.position.x;
      break;
  }
  return (alignmentDistance + Math.max(0, boundaryDistance)) / TILE_SIZE * moveDuration(player);
}

function hasRanniSafetyWindowForNewBomb(player: PlayerState): boolean {
  if (player.skill.id !== RANNI_SKILL_ID || player.skill.phase === "idle") return true;
  return player.skill.phase === "cooldown"
    && player.skill.cooldownRemainingMs + ARRIVAL_MARGIN_MS < getBombFuseMsForPlayer(player);
}

function attackBombEscapeDirection(
  player: PlayerState,
  target: PlayerState,
  enemies: readonly PlayerState[],
  context: BotContext,
): Direction | null {
  if (
    player.spawnProtectionMs > 0
    || target.spawnProtectionMs > 0
    || player.activeBombs >= player.maxBombs
    || !hasRanniSafetyWindowForNewBomb(player)
    || context.roomBombPlacementThrottleMs > 0
    || context.bombs.some((bomb) => bomb.tile.x === player.tile.x && bomb.tile.y === player.tile.y)
  ) return null;

  const projectedBomb = {
    tile: player.tile,
    flameRange: player.flameRange,
    fuseMs: getBombFuseMsForPlayer(player),
  };
  const projectedBlast = new Set(
    blastTiles(projectedBomb, context).map((tile) => tileKey(tile.x, tile.y)),
  );
  if (!projectedBlast.has(tileKey(target.tile.x, target.tile.y))) return null;

  const projectedThreats = threatMap(context, projectedBomb);
  return safeEscapeDirection(player, enemies, context, projectedThreats, player.tile);
}

function breakableBombEscapeDirection(
  player: PlayerState,
  enemies: readonly PlayerState[],
  context: BotContext,
): Direction | null {
  if (
    player.spawnProtectionMs > 0
    || player.activeBombs >= player.maxBombs
    || !hasRanniSafetyWindowForNewBomb(player)
    || context.roomBombPlacementThrottleMs > 0
    || context.bombs.some((bomb) => bomb.tile.x === player.tile.x && bomb.tile.y === player.tile.y)
  ) return null;
  const adjacentBreakable = DIRECTIONS.some((direction) => {
    const delta = DELTA[direction];
    return context.arena.breakable.has(tileKey(
      player.tile.x + delta.x,
      player.tile.y + delta.y,
    ));
  });
  if (!adjacentBreakable) return null;
  const projectedBomb = {
    tile: player.tile,
    flameRange: player.flameRange,
    fuseMs: getBombFuseMsForPlayer(player),
  };
  return safeEscapeDirection(
    player,
    enemies,
    context,
    threatMap(context, projectedBomb),
    player.tile,
  );
}

function triggeredBlastKeys(initialBomb: BombState, context: BotContext): Set<string> {
  const pending = [initialBomb];
  const triggered = new Set<number>();
  const blast = new Set<string>();
  while (pending.length > 0) {
    const bomb = pending.pop();
    if (!bomb || triggered.has(bomb.id)) continue;
    triggered.add(bomb.id);
    for (const tile of blastTiles(bomb, context)) blast.add(tileKey(tile.x, tile.y));
    for (const candidate of context.bombs) {
      if (!triggered.has(candidate.id) && blast.has(tileKey(candidate.tile.x, candidate.tile.y))) {
        pending.push(candidate);
      }
    }
  }
  return blast;
}

function isInsideOwnedBombBlast(player: PlayerState, context: BotContext): boolean {
  return context.bombs.some((bomb) => (
    bomb.ownerId === player.id
    && blastTiles(bomb, context).some((tile) => context.isPlayerOverlappingTile(player, tile))
  ));
}

function projectedRanniPlayer(player: PlayerState): PlayerState {
  const position = player.skill.projectedPosition ?? player.position;
  return {
    ...player,
    position,
    tile: {
      x: Math.floor(position.x / TILE_SIZE),
      y: Math.floor(position.y / TILE_SIZE),
    },
  };
}

function isOverlappingAnyBlast(player: PlayerState, context: BotContext): boolean {
  if (context.flames.some((flame) => context.isPlayerOverlappingTile(player, flame.tile))) {
    return true;
  }
  return context.bombs.some((bomb) => (
    blastTiles(bomb, context).some((tile) => context.isPlayerOverlappingTile(player, tile))
  ));
}

function continuousOverlapEscapeDirection(
  player: PlayerState,
  context: BotContext,
): Direction | null {
  const blast = [
    ...context.flames.map((flame) => flame.tile),
    ...context.bombs.flatMap((bomb) => blastTiles(bomb, context)),
  ].filter((tile) => context.isPlayerOverlappingTile(player, tile));
  if (blast.length === 0) return null;

  const source = blast.reduce((furthest, tile) => {
    const dx = player.position.x - (tile.x + 0.5) * TILE_SIZE;
    const dy = player.position.y - (tile.y + 0.5) * TILE_SIZE;
    const distanceSquared = dx * dx + dy * dy;
    return distanceSquared > furthest.distanceSquared
      ? { tile, distanceSquared }
      : furthest;
  }, { tile: blast[0]!, distanceSquared: Number.NEGATIVE_INFINITY }).tile;
  const dx = player.position.x - (source.x + 0.5) * TILE_SIZE;
  const dy = player.position.y - (source.y + 0.5) * TILE_SIZE;
  if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? "left" : "right";
  if (Math.abs(dy) > 0) return dy < 0 ? "up" : "down";
  return null;
}

function overlappingEnemyExitDirection(
  player: PlayerState,
  enemies: readonly PlayerState[],
  context: BotContext,
): Direction | null {
  const enemy = enemies.find((candidate) => (
    context.isPlayerOverlappingTile(player, candidate.tile)
  ));
  if (!enemy) return null;

  const centerX = (enemy.tile.x + 0.5) * TILE_SIZE;
  const centerY = (enemy.tile.y + 0.5) * TILE_SIZE;
  const dx = player.position.x - centerX;
  const dy = player.position.y - centerY;
  const preferred: Direction[] = Math.abs(dx) >= Math.abs(dy)
    ? [dx >= 0 ? "right" : "left", dy >= 0 ? "down" : "up"]
    : [dy >= 0 ? "down" : "up", dx >= 0 ? "right" : "left"];
  return preferred.find((direction) => {
    const destination = adjacentTile(player.tile, direction, context);
    if (context.flames.some((flame) => (
      flame.remainingMs > 0
      && flame.ownerId === player.id
      && flame.tile.x === destination.x
      && flame.tile.y === destination.y
    ))) {
      return false;
    }
    const option = context.evaluateMovementOption(player, direction, 1_000 / 60);
    return context.canMovementOptionAdvance(player.position, option);
  }) ?? null;
}

type CommittedOwnFlameEscape = Readonly<
  | { hazard: false }
  | { hazard: true; direction: Direction | null }
>;

function committedOwnFlameEscape(
  player: PlayerState,
  context: BotContext,
): CommittedOwnFlameEscape {
  const committedDirection = context.botCommittedDirection[player.id];
  if (!committedDirection) return { hazard: false };
  const committedDestination = adjacentTile(player.tile, committedDirection, context);
  const committedIntoOwnFlame = context.flames.some((flame) => (
    flame.remainingMs > 0
    && flame.ownerId === player.id
    && flame.tile.x === committedDestination.x
    && flame.tile.y === committedDestination.y
  ));
  if (!committedIntoOwnFlame) return { hazard: false };

  const direction = DIRECTIONS.find((candidateDirection) => {
    if (candidateDirection === committedDirection) return false;
    const destination = adjacentTile(player.tile, candidateDirection, context);
    if (context.flames.some((flame) => (
      flame.remainingMs > 0
      && flame.tile.x === destination.x
      && flame.tile.y === destination.y
    ))) {
      return false;
    }
    const option = context.evaluateMovementOption(player, candidateDirection, 1_000 / 60);
    return context.canMovementOptionAdvance(player.position, option);
  }) ?? null;
  return { hazard: true, direction };
}

function canRemoteFinish(player: PlayerState, target: PlayerState, context: BotContext): boolean {
  if (
    player.remoteLevel <= 0
    || target.spawnProtectionMs > 0
    || target.flameGuardMs > 0
  ) return false;
  const playerKey = tileKey(player.tile.x, player.tile.y);
  const targetKey = tileKey(target.tile.x, target.tile.y);
  return context.bombs.some((bomb) => {
    if (bomb.ownerId !== player.id) return false;
    const blast = triggeredBlastKeys(bomb, context);
    return blast.has(targetKey) && !blast.has(playerKey);
  });
}

function hasClearAttackLine(
  from: TileCoord,
  target: TileCoord,
  range: number,
  context: BotContext,
): boolean {
  const targetDistance = distance(from, target);
  if (targetDistance === 0 || targetDistance > range) return false;
  if (from.x !== target.x && from.y !== target.y) return false;
  const dx = Math.sign(target.x - from.x);
  const dy = Math.sign(target.y - from.y);
  for (let step = 1; step < targetDistance; step += 1) {
    const key = tileKey(from.x + dx * step, from.y + dy * step);
    if (context.arena.solid.has(key) || context.arena.breakable.has(key)) return false;
  }
  return true;
}

function pressureDirection(
  player: PlayerState,
  target: PlayerState,
  context: BotContext,
  threats: ReadonlyMap<string, number>,
): Direction | null {
  const queue: RouteNode[] = [{ tile: player.tile, firstDirection: null, steps: 0 }];
  const visited = new Set([tileKey(player.tile.x, player.tile.y)]);
  const stepMs = moveDuration(player);
  let best = queue[0]!;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const node = queue[cursor]!;
    const attackPosition = hasClearAttackLine(node.tile, target.tile, player.flameRange, context);
    const score = (attackPosition ? 100_000 : 0)
      - distance(node.tile, target.tile) * 1_000
      - node.steps * 5;
    if (score > bestScore) {
      best = node;
      bestScore = score;
    }
    if (node.steps >= 14) continue;

    for (const direction of DIRECTIONS) {
      const tile = adjacentTile(node.tile, direction, context);
      const key = tileKey(tile.x, tile.y);
      if (visited.has(key) || !isOpen(tile, player.tile, context)) continue;
      const steps = node.steps + 1;
      const eta = threats.get(key);
      if (eta !== undefined && eta <= steps * stepMs + ARRIVAL_MARGIN_MS) continue;
      visited.add(key);
      queue.push({ tile, firstDirection: node.firstDirection ?? direction, steps });
    }
  }
  return best.firstDirection;
}

function powerUpDirection(
  player: PlayerState,
  context: BotContext,
  threats: ReadonlyMap<string, number>,
): Direction | null {
  const visible = new Map(
    context.arena.powerUps
      .filter((powerUp) => powerUp.revealed && !powerUp.collected)
      .map((powerUp) => [tileKey(powerUp.tile.x, powerUp.tile.y), powerUp]),
  );
  if (visible.size === 0) return null;
  const queue: RouteNode[] = [{ tile: player.tile, firstDirection: null, steps: 0 }];
  const visited = new Set([tileKey(player.tile.x, player.tile.y)]);
  const stepMs = moveDuration(player);
  let best: RouteNode | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const node = queue[cursor]!;
    const powerUp = visible.get(tileKey(node.tile.x, node.tile.y));
    if (powerUp) {
      const score = POWER_UP_SCORE[powerUp.type] * 10_000 - node.steps;
      if (score > bestScore) {
        best = node;
        bestScore = score;
      }
    }
    if (node.steps >= 14) continue;
    for (const direction of DIRECTIONS) {
      const tile = adjacentTile(node.tile, direction, context);
      const key = tileKey(tile.x, tile.y);
      if (visited.has(key) || !isOpen(tile, player.tile, context)) continue;
      const steps = node.steps + 1;
      const eta = threats.get(key);
      if (eta !== undefined && eta <= steps * stepMs + ARRIVAL_MARGIN_MS) continue;
      visited.add(key);
      queue.push({ tile, firstDirection: node.firstDirection ?? direction, steps });
    }
  }
  return best?.firstDirection ?? null;
}

/** Independent deterministic policy owned by the Bomb training session. */
export function getBombDecision(player: PlayerState, context: BotContext): BotDecision {
  const enemies = context.activePlayerIds
    .filter((id) => id !== player.id)
    .map((id) => context.players[id])
    .filter((enemy) => enemy.active && enemy.alive);
  const threats = threatMap(context);
  const currentDanger = threats.get(tileKey(player.tile.x, player.tile.y));
  const escapingOwnedBomb = isInsideOwnedBombBlast(player, context);

  if (player.skill.phase === "channeling") {
    const projectedPlayer = projectedRanniPlayer(player);
    if (
      player.skill.castElapsedMs > 0
      && (player.skill.projectedBombEgressIds?.length ?? 0) === 0
      && !isOverlappingAnyBlast(projectedPlayer, context)
    ) {
      return {
        direction: null,
        placeBomb: false,
        useSkill: true,
        skillAction: "release",
      };
    }
    const routeDirection = safeEscapeDirection(
      projectedPlayer,
      enemies,
      context,
      threats,
    );
    const direction = routeDirection
      ? alignThreatenedEscapeToTileCenter(projectedPlayer, routeDirection, context, true)
      : continuousOverlapEscapeDirection(projectedPlayer, context);
    return {
      direction,
      placeBomb: false,
    };
  }

  if (player.skill.phase === "releasing") {
    return { direction: null, placeBomb: false };
  }

  if (
    escapingOwnedBomb
    || (currentDanger !== undefined && currentDanger <= REACTION_WINDOW_MS)
  ) {
    const routeDirection = safeEscapeDirection(player, enemies, context, threats);
    const direction = routeDirection
      ? alignThreatenedEscapeToTileCenter(player, routeDirection, context)
      : continuousOverlapEscapeDirection(player, context);
    const physicalEscapeDirection = routeDirection ?? direction;
    if (
      physicalEscapeDirection !== null
      && currentDanger !== undefined
      && currentDanger <= centerExitTimeMs(player, physicalEscapeDirection) + ARRIVAL_MARGIN_MS
      && player.skill.id === RANNI_SKILL_ID
      && player.skill.phase === "idle"
    ) {
      return { direction: null, placeBomb: false, useSkill: true };
    }
    if (
      direction === null
      && currentDanger !== undefined
      && currentDanger <= REACTION_WINDOW_MS
      && player.skill.id === RANNI_SKILL_ID
      && player.skill.phase === "idle"
    ) {
      return { direction: null, placeBomb: false, useSkill: true };
    }
    return {
      direction,
      placeBomb: false,
    };
  }

  const enemyExitDirection = overlappingEnemyExitDirection(player, enemies, context);
  if (enemyExitDirection) {
    return {
      direction: enemyExitDirection,
      placeBomb: false,
    };
  }

  const target = [...enemies].sort((left, right) => (
    distance(player.tile, left.tile) - distance(player.tile, right.tile)
    || left.id - right.id
  ))[0];
  if (target && canRemoteFinish(player, target, context)) {
    return {
      direction: null,
      placeBomb: false,
      detonate: true,
      targetId: target.id,
      intent: "remote-detonation",
    };
  }
  const attackEscapeDirection = target
    ? attackBombEscapeDirection(player, target, enemies, context)
    : null;
  if (target && attackEscapeDirection) {
    const committedFlameEscape = committedOwnFlameEscape(player, context);
    if (committedFlameEscape.hazard) {
      return {
        direction: committedFlameEscape.direction,
        placeBomb: false,
      };
    }
    return {
      direction: attackEscapeDirection,
      placeBomb: true,
      targetId: target.id,
      intent: "bomb-attack",
    };
  }
  const pickupDirection = powerUpDirection(player, context, threats);
  if (pickupDirection) {
    return { direction: pickupDirection, placeBomb: false, targetId: target?.id };
  }
  const breakableEscapeDirection = breakableBombEscapeDirection(player, enemies, context);
  if (breakableEscapeDirection) {
    return {
      direction: breakableEscapeDirection,
      placeBomb: true,
      targetId: target?.id,
    };
  }

  if (target) {
    return {
      direction: pressureDirection(player, target, context, threats),
      placeBomb: false,
      targetId: target.id,
      intent: "attack-position",
    };
  }

  return { direction: null, placeBomb: false };
}
