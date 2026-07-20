import { tileKey } from "../Arenas/arena";
import { BASE_MOVE_MS, FLAME_DURATION_MS, MIN_MOVE_MS, SPEED_STEP_MS, TILE_SIZE } from "../PersonalConfig/config";
import { RANNI_SKILL_CHANNEL_MS } from "../../../Champions/ranni/skill";
import { RANNI_SKILL_ID } from "../../../Champions/ranni/definition";
import { bodyTouchedTileIndices } from "../Gameplay/player-body";
import type {
  BombState,
  Direction,
  PlayerState,
  PowerUpType,
  TileCoord,
} from "../Gameplay/types";
import type { BotContext, BotDecision } from "./bot-contracts";
import { SUDDEN_DEATH_FALL_MS, SUDDEN_DEATH_TICK_MS } from "./danger-map";

export const BOT_V3_CHARACTER_INDEX = 0;

const DIRECTIONS: readonly Direction[] = ["up", "left", "down", "right"];
const DELTA: Record<Direction, TileCoord> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};
const DANGER_REACTION_MS = 1_200;
const ARRIVAL_MARGIN_MS = 220;
const PROJECTED_MOVEMENT_STEP_MS = 1_000 / 60;
const PHASE_COMMIT_WINDOW_MS = RANNI_SKILL_CHANNEL_MS - FLAME_DURATION_MS;

type SearchNode = Readonly<{
  tile: TileCoord;
  firstDirection: Direction | null;
  steps: number;
}>;

type ForecastBomb = {
  tile: TileCoord;
  flameRange: number;
  fuseMs: number;
};

function distance(left: TileCoord, right: TileCoord): number {
  return Math.abs(left.x - right.x) + Math.abs(left.y - right.y);
}

function moveDuration(player: PlayerState): number {
  return Math.max(MIN_MOVE_MS, BASE_MOVE_MS - player.speedLevel * SPEED_STEP_MS);
}

function orderedDirections(player: PlayerState): readonly Direction[] {
  const offset = (player.id - 1) % DIRECTIONS.length;
  return [...DIRECTIONS.slice(offset), ...DIRECTIONS.slice(0, offset)];
}

function activeEnemies(player: PlayerState, context: BotContext): PlayerState[] {
  return context.activePlayerIds
    .filter((id) => id !== player.id)
    .map((id) => context.players[id])
    .filter((enemy) => enemy.active && enemy.alive)
    .sort((left, right) => distance(player.tile, left.tile) - distance(player.tile, right.tile) || left.id - right.id);
}

function inBounds(tile: TileCoord, context: BotContext): boolean {
  return tile.x >= 0
    && tile.y >= 0
    && tile.x < context.arena.config.grid.width
    && tile.y < context.arena.config.grid.height;
}

function isOpen(tile: TileCoord, start: TileCoord, player: PlayerState, context: BotContext): boolean {
  const key = tileKey(tile.x, tile.y);
  if (!inBounds(tile, context) || context.arena.solid.has(key) || context.arena.breakable.has(key)) return false;
  return !context.bombs.some((bomb) => (
    bomb.tile.x === tile.x
    && bomb.tile.y === tile.y
    && (tile.x !== start.x || tile.y !== start.y)
    && !(
      context.isPlayerOverlappingTile(player, bomb.tile)
      && (
        player.skill.phase === "channeling"
          ? player.skill.projectedBombEgressIds?.includes(bomb.id)
          : bomb.bodyEgressPlayerIds?.includes(player.id)
      )
    )
  ));
}

function blastTiles(bomb: Pick<BombState, "tile" | "flameRange">, context: BotContext): TileCoord[] {
  const result: TileCoord[] = [{ ...bomb.tile }];
  for (const direction of DIRECTIONS) {
    const delta = DELTA[direction];
    for (let step = 1; step <= bomb.flameRange; step += 1) {
      const tile = { x: bomb.tile.x + delta.x * step, y: bomb.tile.y + delta.y * step };
      if (!inBounds(tile, context)) break;
      const key = tileKey(tile.x, tile.y);
      if (context.arena.solid.has(key)) break;
      result.push(tile);
      if (context.arena.breakable.has(key)) break;
    }
  }
  return result;
}

function buildBombForecast(
  context: BotContext,
  extraBomb?: Pick<BombState, "tile" | "flameRange" | "fuseMs">,
): ForecastBomb[] {
  const bombs: ForecastBomb[] = context.bombs.map((bomb) => ({
    tile: { ...bomb.tile },
    flameRange: bomb.flameRange,
    fuseMs: bomb.fuseMs,
  }));
  if (extraBomb) {
    bombs.push({
      tile: { ...extraBomb.tile },
      flameRange: extraBomb.flameRange,
      fuseMs: extraBomb.fuseMs,
    });
  }

  // Propagate deterministic chain reactions before projecting arrival times.
  for (let pass = 0; pass < bombs.length; pass += 1) {
    let changed = false;
    for (const source of bombs) {
      const hit = new Set(blastTiles(source as BombState, context).map((tile) => tileKey(tile.x, tile.y)));
      for (const target of bombs) {
        if (source === target || !hit.has(tileKey(target.tile.x, target.tile.y))) continue;
        if (target.fuseMs > source.fuseMs) {
          target.fuseMs = source.fuseMs;
          changed = true;
        }
      }
    }
    if (!changed) break;
  }
  return bombs;
}

function buildThreatMap(
  context: BotContext,
  extraBomb?: Pick<BombState, "tile" | "flameRange" | "fuseMs">,
): Map<string, number> {
  const bombs = buildBombForecast(context, extraBomb);

  const threats = new Map<string, number>();
  const mark = (tile: TileCoord, etaMs: number): void => {
    const key = tileKey(tile.x, tile.y);
    threats.set(key, Math.min(threats.get(key) ?? Number.POSITIVE_INFINITY, etaMs));
  };
  for (const flame of context.flames) mark(flame.tile, 0);
  for (const bomb of bombs) {
    for (const tile of blastTiles(bomb as BombState, context)) mark(tile, bomb.fuseMs);
  }
  for (let index = 0; index < Math.min(context.suddenDeathPath.length, context.suddenDeathIndex + 2); index += 1) {
    mark(context.suddenDeathPath[index]!, index < context.suddenDeathIndex ? 0 : context.suddenDeathTickMs);
  }
  for (const effect of context.suddenDeathClosureEffects) mark(effect.tile, 0);
  return threats;
}

/**
 * Tiles that would still be lethal at release, or become lethal before the
 * player has a fair physical-reaction window after release. While Ranni is
 * channeling, her projection may cross an earlier blast safely; only the
 * release window matters for choosing the ghost's destination.
 */
function buildProjectedReleaseThreatMap(player: PlayerState, context: BotContext): Map<string, number> {
  const releaseMs = Math.max(0, player.skill.channelRemainingMs);
  const safetyEndMs = releaseMs + DANGER_REACTION_MS;
  const threats = new Map<string, number>();
  const mark = (tile: TileCoord): void => {
    threats.set(tileKey(tile.x, tile.y), 0);
  };

  for (const flame of context.flames) {
    if (flame.remainingMs > releaseMs) {
      mark(flame.tile);
    }
  }
  for (const bomb of buildBombForecast(context)) {
    const flameEndMs = bomb.fuseMs + FLAME_DURATION_MS;
    if (bomb.fuseMs <= safetyEndMs && flameEndMs > releaseMs) {
      for (const tile of blastTiles(bomb, context)) mark(tile);
    }
  }
  for (const effect of context.suddenDeathClosureEffects) {
    const impactMs = effect.impacted ? 0 : Math.max(0, SUDDEN_DEATH_FALL_MS - effect.elapsedMs);
    if (impactMs <= safetyEndMs) mark(effect.tile);
  }
  if (context.suddenDeathActive) {
    for (let index = context.suddenDeathIndex; index < context.suddenDeathPath.length; index += 1) {
      const impactMs = context.suddenDeathTickMs
        + (index - context.suddenDeathIndex) * SUDDEN_DEATH_TICK_MS;
      if (impactMs > safetyEndMs) break;
      mark(context.suddenDeathPath[index]!);
    }
  }
  return threats;
}

function bodyDanger(
  player: PlayerState,
  threats: ReadonlyMap<string, number>,
  context: BotContext,
): number | undefined {
  const touched = bodyTouchedTileIndices(player.position);
  const width = context.arena.config.grid.width;
  const height = context.arena.config.grid.height;
  let earliest: number | undefined;
  for (let rawY = touched.minTileY; rawY <= touched.maxTileY; rawY += 1) {
    const y = ((rawY % height) + height) % height;
    for (let rawX = touched.minTileX; rawX <= touched.maxTileX; rawX += 1) {
      const x = ((rawX % width) + width) % width;
      const etaMs = threats.get(tileKey(x, y));
      if (etaMs !== undefined && (earliest === undefined || etaMs < earliest)) {
        earliest = etaMs;
      }
    }
  }
  return earliest;
}

function search(
  player: PlayerState,
  context: BotContext,
  threats: ReadonlyMap<string, number>,
  score: (node: SearchNode) => number,
  maxSteps = 14,
): Direction | null {
  const start = { ...player.tile };
  const queue: SearchNode[] = [{ tile: start, firstDirection: null, steps: 0 }];
  const visited = new Set([tileKey(start.x, start.y)]);
  const stepMs = moveDuration(player);
  let best = queue[0]!;
  let bestScore = score(best);

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const node = queue[cursor]!;
    const nodeScore = score(node);
    if (nodeScore > bestScore) {
      best = node;
      bestScore = nodeScore;
    }
    if (node.steps >= maxSteps) continue;

    for (const direction of orderedDirections(player)) {
      const delta = DELTA[direction];
      const tile = { x: node.tile.x + delta.x, y: node.tile.y + delta.y };
      const key = tileKey(tile.x, tile.y);
      if (visited.has(key) || !isOpen(tile, start, player, context)) continue;
      const steps = node.steps + 1;
      const eta = threats.get(key);
      if (eta !== undefined && eta <= steps * stepMs + ARRIVAL_MARGIN_MS) continue;
      visited.add(key);
      queue.push({
        tile,
        firstDirection: node.firstDirection ?? direction,
        steps,
      });
    }
  }
  return best.firstDirection;
}

function openNeighborCount(tile: TileCoord, player: PlayerState, context: BotContext): number {
  return DIRECTIONS.reduce((count, direction) => {
    const delta = DELTA[direction];
    return count + (isOpen({ x: tile.x + delta.x, y: tile.y + delta.y }, player.tile, player, context) ? 1 : 0);
  }, 0);
}

function escapeDirection(
  player: PlayerState,
  enemies: readonly PlayerState[],
  threats: ReadonlyMap<string, number>,
  context: BotContext,
): Direction | null {
  return search(player, context, threats, (node) => {
    const dangerEta = threats.get(tileKey(node.tile.x, node.tile.y));
    const safety = dangerEta === undefined ? 8_000 : Math.min(8_000, dangerEta);
    const enemySpace = enemies.length > 0 ? Math.min(...enemies.map((enemy) => distance(node.tile, enemy.tile))) : 0;
    return safety * 10 + openNeighborCount(node.tile, player, context) * 500 + enemySpace * 45 - node.steps * 12;
  });
}

function projectedEscapeDirection(
  player: PlayerState,
  enemies: readonly PlayerState[],
  context: BotContext,
): Direction | null {
  const projectedPosition = player.skill.projectedPosition;
  if (!projectedPosition) return null;
  const projectedPlayer: PlayerState = {
    ...player,
    tile: {
      x: Math.floor(projectedPosition.x / TILE_SIZE),
      y: Math.floor(projectedPosition.y / TILE_SIZE),
    },
    position: { ...projectedPosition },
  };
  const releaseThreats = buildProjectedReleaseThreatMap(player, context);
  const projectedDanger = bodyDanger(projectedPlayer, releaseThreats, context);
  if (projectedDanger === undefined) return null;
  const projectedKey = tileKey(projectedPlayer.tile.x, projectedPlayer.tile.y);
  releaseThreats.set(
    projectedKey,
    Math.min(releaseThreats.get(projectedKey) ?? Number.POSITIVE_INFINITY, projectedDanger),
  );

  const direction = escapeDirection(projectedPlayer, enemies, releaseThreats, context);
  if (!direction) return null;
  const option = context.evaluateProjectedMovementOption(projectedPlayer, direction, PROJECTED_MOVEMENT_STEP_MS);
  return context.canMovementOptionAdvance(projectedPosition, option) ? direction : null;
}

function projectedBombEgressDirection(
  player: PlayerState,
  context: BotContext,
): Direction | null {
  const projectedPosition = player.skill.projectedPosition;
  if (!projectedPosition || (player.skill.projectedBombEgressIds?.length ?? 0) === 0) {
    return null;
  }
  const projectedPlayer: PlayerState = {
    ...player,
    tile: {
      x: Math.floor(projectedPosition.x / TILE_SIZE),
      y: Math.floor(projectedPosition.y / TILE_SIZE),
    },
    position: { ...projectedPosition },
  };
  const candidates = [player.skill.projectedLastMoveDirection, ...orderedDirections(player)]
    .filter((direction, index, directions): direction is Direction => (
      direction !== null && directions.indexOf(direction) === index
    ));
  return candidates.find((direction) => {
    const option = context.evaluateProjectedMovementOption(
      projectedPlayer,
      direction,
      PROJECTED_MOVEMENT_STEP_MS,
    );
    return context.canMovementOptionAdvance(projectedPosition, option);
  }) ?? null;
}

function isProjectionTrappedOnBomb(player: PlayerState, context: BotContext): boolean {
  const projectedPosition = player.skill.projectedPosition;
  if (!projectedPosition || (player.skill.projectedBombEgressIds?.length ?? 0) > 0) return false;
  const projectedPlayer: PlayerState = {
    ...player,
    tile: {
      x: Math.floor(projectedPosition.x / TILE_SIZE),
      y: Math.floor(projectedPosition.y / TILE_SIZE),
    },
    position: { ...projectedPosition },
  };
  return context.bombs.some((bomb) => (
    context.isPlayerOverlappingTile(projectedPlayer, bomb.tile)
    && bomb.bodyEgressPlayerIds?.includes(player.id)
  ));
}

function isProjectionOnActiveFlame(player: PlayerState, context: BotContext): boolean {
  const projectedPosition = player.skill.projectedPosition;
  if (!projectedPosition) return false;
  const projectedPlayer: PlayerState = {
    ...player,
    tile: {
      x: Math.floor(projectedPosition.x / TILE_SIZE),
      y: Math.floor(projectedPosition.y / TILE_SIZE),
    },
    position: { ...projectedPosition },
  };
  return context.flames.some((flame) => (
    flame.remainingMs > 0
    && context.isPlayerOverlappingTile(projectedPlayer, flame.tile)
  ));
}

function physicalBombEgressDirection(
  player: PlayerState,
  preferred: Direction | null,
  context: BotContext,
): Direction | null {
  const hasBodyEgress = context.bombs.some((bomb) => (
    context.isPlayerOverlappingTile(player, bomb.tile)
    && (
      (bomb.ownerId === player.id && bomb.ownerCanPass)
      || bomb.bodyEgressPlayerIds?.includes(player.id)
    )
  ));
  if (!hasBodyEgress) return null;

  const candidates = [preferred, ...orderedDirections(player)]
    .filter((direction, index, directions): direction is Direction => (
      direction !== null && directions.indexOf(direction) === index
    ));
  return candidates.find((direction) => {
    const option = context.evaluateMovementOption(player, direction, PROJECTED_MOVEMENT_STEP_MS);
    return context.canMovementOptionAdvance(player.position, option);
  }) ?? null;
}

function hasClearAttackLine(from: TileCoord, target: TileCoord, range: number, context: BotContext): boolean {
  if (from.x !== target.x && from.y !== target.y) return false;
  if (distance(from, target) > range) return false;
  const dx = Math.sign(target.x - from.x);
  const dy = Math.sign(target.y - from.y);
  for (let step = 1; step < distance(from, target); step += 1) {
    const key = tileKey(from.x + dx * step, from.y + dy * step);
    if (context.arena.solid.has(key) || context.arena.breakable.has(key)) return false;
  }
  return true;
}

function huntDirection(
  player: PlayerState,
  target: PlayerState,
  threats: ReadonlyMap<string, number>,
  context: BotContext,
): Direction | null {
  return search(player, context, threats, (node) => {
    const attackPosition = hasClearAttackLine(node.tile, target.tile, player.flameRange, context);
    const targetDistance = distance(node.tile, target.tile);
    const dangerEta = threats.get(tileKey(node.tile.x, node.tile.y));
    const unsafePenalty = dangerEta === undefined ? 0 : Math.max(0, 4_000 - dangerEta) * 2;
    return (attackPosition ? 100_000 : 0)
      - targetDistance * 900
      + openNeighborCount(node.tile, player, context) * 80
      - node.steps * 15
      - unsafePenalty;
  });
}

const POWER_UP_PRIORITY: Record<PowerUpType, number> = {
  "bomb-pass-up": 12,
  "shield-up": 11,
  "speed-up": 9,
  "flame-up": 8,
  "bomb-up": 7,
  "remote-up": 6,
  "kick-up": 5,
  "short-fuse-up": 4,
};

function powerUpDirection(
  player: PlayerState,
  threats: ReadonlyMap<string, number>,
  context: BotContext,
): Direction | null {
  const visible = new Map(
    context.arena.powerUps
      .filter((powerUp) => powerUp.revealed && !powerUp.collected)
      .map((powerUp) => [tileKey(powerUp.tile.x, powerUp.tile.y), powerUp]),
  );
  if (visible.size === 0) return null;
  return search(player, context, threats, (node) => {
    const powerUp = visible.get(tileKey(node.tile.x, node.tile.y));
    if (!powerUp) return -node.steps;
    const priority = POWER_UP_PRIORITY[powerUp.type]
      + (powerUp.type === "bomb-pass-up" && player.bombPassLevel === 0 ? 20 : 0)
      + (powerUp.type === "shield-up" && player.shieldCharges === 0 ? 16 : 0);
    return priority * 100_000 - node.steps * 100;
  });
}

function adjacentBreakable(player: PlayerState, context: BotContext): boolean {
  return DIRECTIONS.some((direction) => {
    const delta = DELTA[direction];
    return context.arena.breakable.has(tileKey(player.tile.x + delta.x, player.tile.y + delta.y));
  });
}

function canPlacePhaseBomb(player: PlayerState, target: PlayerState | null, context: BotContext): boolean {
  if (player.spawnProtectionMs > 0 || player.activeBombs >= player.maxBombs || context.roomBombPlacementThrottleMs > 0) return false;
  if (context.bombs.some((bomb) => bomb.tile.x === player.tile.x && bomb.tile.y === player.tile.y)) return false;
  return adjacentBreakable(player, context)
    || Boolean(target && (
      distance(player.tile, target.tile) <= 3
      || hasClearAttackLine(player.tile, target.tile, player.flameRange, context)
    ));
}

function hasRemoteBombThreat(player: PlayerState, context: BotContext): boolean {
  return context.bombs.some((bomb) => (
    bomb.ownerId !== player.id
    && context.players[bomb.ownerId].remoteLevel > 0
    && blastTiles(bomb, context).some((tile) => context.isPlayerOverlappingTile(player, tile))
  ));
}

function canRemoteStrike(player: PlayerState, target: PlayerState | null, context: BotContext): boolean {
  if (!target || player.remoteLevel <= 0 || target.spawnProtectionMs > 0 || target.flameGuardMs > 0) return false;
  const targetKey = tileKey(target.tile.x, target.tile.y);
  return context.bombs.some((bomb) => {
    if (bomb.ownerId !== player.id) return false;
    let hitsTarget = false;
    let hitsSelf = false;
    for (const tile of blastTiles(bomb, context)) {
      hitsTarget ||= tileKey(tile.x, tile.y) === targetKey;
      hitsSelf ||= context.isPlayerOverlappingTile(player, tile);
    }
    return hitsTarget && !hitsSelf;
  });
}

/**
 * V3 is an independent phase-bomber. It does not delegate to V1 or V2: it
 * projects chain reactions, searches safe routes, and uses Ranni's stationary
 * ice phase to survive blast zones while its own bombs control the arena.
 */
export function getBotV3Decision(player: PlayerState, context: BotContext): BotDecision {
  const enemies = activeEnemies(player, context);
  const target = enemies[0] ?? null;
  // The shared danger map is tile-based. Copy it before adding this player's
  // body-overlap danger so one bot cannot alter another bot's route search.
  const threats = new Map(context.dangerMap ?? buildThreatMap(context));
  const currentDanger = bodyDanger(player, threats, context);
  if (currentDanger !== undefined) {
    const currentKey = tileKey(player.tile.x, player.tile.y);
    threats.set(
      currentKey,
      Math.min(threats.get(currentKey) ?? Number.POSITIVE_INFINITY, currentDanger),
    );
  }
  const remoteThreat = hasRemoteBombThreat(player, context);

  if (player.skill.phase === "channeling") {
    const direction = projectedBombEgressDirection(player, context)
      ?? projectedEscapeDirection(player, enemies, context);
    const plannedPhysicalReleaseDirection = escapeDirection(player, enemies, threats, context);
    const executablePhysicalReleaseDirection = physicalBombEgressDirection(
      player,
      plannedPhysicalReleaseDirection,
      context,
    );
    const physicalReleaseDirection = executablePhysicalReleaseDirection === plannedPhysicalReleaseDirection
      ? plannedPhysicalReleaseDirection
      : null;
    const hasPhysicalReleaseBudget = currentDanger === undefined
      || currentDanger > moveDuration(player) + ARRIVAL_MARGIN_MS;
    if (
      direction === null
      && player.skill.castElapsedMs > 0
      && physicalReleaseDirection !== null
      && hasPhysicalReleaseBudget
      && !isProjectionOnActiveFlame(player, context)
      && isProjectionTrappedOnBomb(player, context)
    ) {
      return {
        direction: null,
        placeBomb: false,
        useSkill: true,
        skillAction: "release",
        targetId: target?.id,
      };
    }
    return {
      direction,
      placeBomb: false,
      targetId: target?.id,
    };
  }

  if (player.skill.phase === "releasing") {
    return { direction: null, placeBomb: false, targetId: target?.id };
  }

  const physicalEscape = escapeDirection(player, enemies, threats, context);
  const bodyEgressDirection = physicalBombEgressDirection(player, physicalEscape, context);
  if (bodyEgressDirection) {
    return { direction: bodyEgressDirection, placeBomb: false, targetId: target?.id };
  }

  const phaseWindowThreat = currentDanger !== undefined && currentDanger <= PHASE_COMMIT_WINDOW_MS;
  const shouldPhase = player.skill.id === RANNI_SKILL_ID
    && player.skill.phase === "idle"
    && (phaseWindowThreat || remoteThreat);
  if (shouldPhase) {
    return {
      direction: null,
      placeBomb: false,
      useSkill: true,
      targetId: target?.id,
    };
  }

  if (currentDanger !== undefined) {
    return { direction: physicalEscape, placeBomb: false };
  }

  if (player.skill.phase === "cooldown") {
    const nearestEnemyDistance = target ? distance(player.tile, target.tile) : Number.POSITIVE_INFINITY;
    const pickupDirection = nearestEnemyDistance >= 3 ? powerUpDirection(player, threats, context) : null;
    return {
      direction: pickupDirection ?? escapeDirection(player, enemies, threats, context),
      placeBomb: false,
      targetId: target?.id,
    };
  }

  const pickupDirection = powerUpDirection(player, threats, context);
  if (pickupDirection) {
    return { direction: pickupDirection, placeBomb: false };
  }

  if (canRemoteStrike(player, target, context)) {
    return {
      direction: null,
      placeBomb: false,
      detonate: true,
      targetId: target?.id,
      intent: "remote-detonation",
    };
  }

  if (canPlacePhaseBomb(player, target, context)) {
    return {
      direction: null,
      placeBomb: true,
      targetId: target?.id,
      intent: target && hasClearAttackLine(player.tile, target.tile, player.flameRange, context)
        ? "bomb-attack"
        : undefined,
    };
  }

  if (target) {
    return {
      direction: huntDirection(player, target, threats, context),
      placeBomb: false,
      targetId: target.id,
      intent: "chase-enemy",
    };
  }

  return { direction: escapeDirection(player, enemies, threats, context), placeBomb: false };
}
