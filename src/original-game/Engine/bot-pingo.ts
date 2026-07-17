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
  TileCoord,
} from "../Gameplay/types";
import { getBombFuseMsForPlayer } from "../Gameplay/powerups";
import type { BotContext, BotDecision } from "./bot-ai";
import { SUDDEN_DEATH_TICK_MS } from "./danger-map";

const ESCAPE_BUFFER_MS = 220;
const RANNI_EMERGENCY_PHASE_WINDOW_MS = 1_300;
const TURN_CENTER_TOLERANCE_PX = 2;

const steps: ReadonlyArray<Readonly<{ direction: Direction; dx: number; dy: number }>> = [
  { direction: "up", dx: 0, dy: -1 },
  { direction: "left", dx: -1, dy: 0 },
  { direction: "down", dx: 0, dy: 1 },
  { direction: "right", dx: 1, dy: 0 },
];
const oppositeDirection: Readonly<Record<Direction, Direction>> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

function key(tile: TileCoord): string {
  return `${tile.x},${tile.y}`;
}

function isInside(tile: TileCoord, context: BotContext): boolean {
  return tile.x >= 0
    && tile.y >= 0
    && tile.x < context.arena.config.grid.width
    && tile.y < context.arena.config.grid.height;
}

function adjacentTile(
  tile: TileCoord,
  step: Readonly<{ dx: number; dy: number }>,
  context: BotContext,
): TileCoord {
  const adjacent = { x: tile.x + step.dx, y: tile.y + step.dy };
  if (isInside(adjacent, context)) {
    return adjacent;
  }
  const isPortal = context.arena.config.wrapPortals.some((portal) => (
    portal.x === tile.x && portal.y === tile.y
  ));
  if (!isPortal) {
    return adjacent;
  }
  return {
    x: (adjacent.x + context.arena.config.grid.width) % context.arena.config.grid.width,
    y: (adjacent.y + context.arena.config.grid.height) % context.arena.config.grid.height,
  };
}

function isWalkable(tile: TileCoord, context: BotContext): boolean {
  const tileId = key(tile);
  return isInside(tile, context)
    && !context.arena.solid.has(tileId)
    && !context.arena.breakable.has(tileId)
    && !context.bombs.some((bomb) => key(bomb.tile) === tileId);
}

function blastTiles(bomb: BombState, context: BotContext): TileCoord[] {
  const result = [bomb.tile];
  for (const { dx, dy } of steps) {
    for (let distance = 1; distance <= bomb.flameRange; distance += 1) {
      const tile = { x: bomb.tile.x + dx * distance, y: bomb.tile.y + dy * distance };
      const tileId = key(tile);
      if (!isInside(tile, context) || context.arena.solid.has(tileId)) {
        break;
      }
      result.push(tile);
      if (context.arena.breakable.has(tileId)) {
        break;
      }
    }
  }
  return result;
}

function buildThreatArrival(context: BotContext): Map<string, number> {
  const arrival = new Map<string, number>();
  const effectiveFuse = new Map(context.bombs.map((bomb) => [bomb.id, bomb.fuseMs]));
  for (let pass = 0; pass < context.bombs.length; pass += 1) {
    let changed = false;
    for (const source of context.bombs) {
      const sourceFuse = effectiveFuse.get(source.id) ?? source.fuseMs;
      const sourceBlast = new Set(blastTiles(source, context).map(key));
      for (const triggered of context.bombs) {
        const triggeredFuse = effectiveFuse.get(triggered.id) ?? triggered.fuseMs;
        if (sourceBlast.has(key(triggered.tile)) && sourceFuse < triggeredFuse) {
          effectiveFuse.set(triggered.id, sourceFuse);
          changed = true;
        }
      }
    }
    if (!changed) {
      break;
    }
  }
  for (const flame of context.flames) {
    arrival.set(key(flame.tile), 0);
  }
  for (const bomb of context.bombs) {
    const fuseMs = effectiveFuse.get(bomb.id) ?? bomb.fuseMs;
    for (const tile of blastTiles(bomb, context)) {
      const tileId = key(tile);
      arrival.set(tileId, Math.min(arrival.get(tileId) ?? Number.POSITIVE_INFINITY, fuseMs));
    }
  }
  if (context.suddenDeathActive) {
    for (let index = context.suddenDeathIndex; index < context.suddenDeathPath.length; index += 1) {
      const tileId = key(context.suddenDeathPath[index]);
      const closureMs = context.suddenDeathTickMs
        + (index - context.suddenDeathIndex) * SUDDEN_DEATH_TICK_MS;
      arrival.set(tileId, Math.min(arrival.get(tileId) ?? Number.POSITIVE_INFINITY, closureMs));
    }
  }
  return arrival;
}

function moveDurationMs(player: PlayerState): number {
  return Math.max(MIN_MOVE_MS, BASE_MOVE_MS - player.speedLevel * SPEED_STEP_MS);
}

function prospectiveBombFor(player: PlayerState): BombState {
  return {
    id: -1,
    ownerId: player.id,
    tile: player.tile,
    fuseMs: getBombFuseMsForPlayer(player),
    ownerCanPass: true,
    flameRange: player.flameRange,
  };
}

function canHitOpponent(player: PlayerState, context: BotContext): boolean {
  const attack = new Set(blastTiles(prospectiveBombFor(player), context).map(key));
  return context.activePlayerIds.some((playerId) => {
    const opponent = context.players[playerId];
    return playerId !== player.id
      && opponent.active
      && opponent.alive
      && attack.has(key(opponent.tile));
  });
}

function canOpenTerrainFrom(tile: TileCoord, player: PlayerState, context: BotContext): boolean {
  const prospectiveBomb = { ...prospectiveBombFor(player), tile };
  return blastTiles(prospectiveBomb, context)
    .some((tile) => context.arena.breakable.has(key(tile)));
}

function canOpenTerrain(player: PlayerState, context: BotContext): boolean {
  return canOpenTerrainFrom(player.tile, player, context);
}

function ownBombEscapeDirection(player: PlayerState, context: BotContext): Direction | null {
  const fuseMs = getBombFuseMsForPlayer(player);
  const hypothetical = prospectiveBombFor(player);
  const projectedContext: BotContext = { ...context, bombs: [...context.bombs, hypothetical] };
  const threatArrival = buildThreatArrival(projectedContext);
  const ownBlast = new Set(blastTiles(hypothetical, projectedContext).map(key));
  const moveMs = moveDurationMs(player);
  const maxSteps = Math.max(1, Math.floor((fuseMs - ESCAPE_BUFFER_MS) / moveMs));
  const queue: Array<Readonly<{ tile: TileCoord; first: Direction | null; elapsedSteps: number }>> = [
    { tile: player.tile, first: null, elapsedSteps: 0 },
  ];
  const visited = new Set([key(player.tile)]);

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const current = queue[cursor];
    if (current.elapsedSteps > 0 && !ownBlast.has(key(current.tile))) {
      return current.first;
    }
    if (current.elapsedSteps >= maxSteps) {
      continue;
    }
    for (const step of steps) {
      const tile = { x: current.tile.x + step.dx, y: current.tile.y + step.dy };
      const tileId = key(tile);
      if (visited.has(tileId) || !isWalkable(tile, projectedContext)) {
        continue;
      }
      const elapsedSteps = current.elapsedSteps + 1;
      const arrival = threatArrival.get(tileId) ?? Number.POSITIVE_INFINITY;
      const safetyDeadlineSteps = ownBlast.has(tileId) ? elapsedSteps + 1 : elapsedSteps;
      if (arrival <= safetyDeadlineSteps * moveMs + ESCAPE_BUFFER_MS) {
        continue;
      }
      visited.add(tileId);
      queue.push({ tile, first: current.first ?? step.direction, elapsedSteps });
    }
  }
  return null;
}

function bombEscapeDirection(player: PlayerState, context: BotContext): Direction | null {
  if (context.botBombCooldownMs > 0
    || player.activeBombs >= player.maxBombs
    || (player.skill.id === "ranni-ice-blink" && player.skill.phase !== "idle")
    || context.bombs.some((bomb) => key(bomb.tile) === key(player.tile))
    || (!canHitOpponent(player, context) && !canOpenTerrain(player, context))) {
    return null;
  }
  return ownBombEscapeDirection(player, context);
}

function chainedBlastTiles(initialBomb: BombState, context: BotContext): Set<string> {
  const blast = new Set<string>();
  const explodedBombIds = new Set<number>();
  const queue = [initialBomb];
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const bomb = queue[cursor];
    if (explodedBombIds.has(bomb.id)) {
      continue;
    }
    explodedBombIds.add(bomb.id);
    const bombBlast = blastTiles(bomb, context);
    for (const tile of bombBlast) {
      blast.add(key(tile));
    }
    for (const candidate of context.bombs) {
      if (!explodedBombIds.has(candidate.id) && blast.has(key(candidate.tile))) {
        queue.push(candidate);
      }
    }
  }
  return blast;
}

function shouldDetonateRemote(player: PlayerState, context: BotContext): boolean {
  if (player.remoteLevel <= 0) {
    return false;
  }
  const oldestOwnedBomb = context.bombs
    .filter((bomb) => bomb.ownerId === player.id)
    .reduce<BombState | null>((oldest, bomb) => (
      oldest === null || bomb.id < oldest.id ? bomb : oldest
    ), null);
  if (!oldestOwnedBomb) {
    return false;
  }
  const immediateBlast = chainedBlastTiles(oldestOwnedBomb, context);
  const overlapsOwnBlast = [...immediateBlast].some((tileId) => {
    const [x, y] = tileId.split(",").map(Number);
    return context.isPlayerOverlappingTile(player, { x, y });
  });
  if (overlapsOwnBlast) {
    return false;
  }
  return context.activePlayerIds.some((playerId) => {
    const opponent = context.players[playerId];
    return playerId !== player.id
      && opponent.active
      && opponent.alive
      && immediateBlast.has(key(opponent.tile));
  });
}

function distance(a: TileCoord, b: TileCoord): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function reachableTerrainTiles(player: PlayerState, context: BotContext): ReadonlySet<string> {
  const queue = [player.tile];
  const visited = new Set([key(player.tile)]);
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const current = queue[cursor];
    for (const step of steps) {
      const tile = { x: current.x + step.dx, y: current.y + step.dy };
      const tileId = key(tile);
      if (visited.has(tileId)
        || !isInside(tile, context)
        || context.arena.solid.has(tileId)
        || context.arena.breakable.has(tileId)) {
        continue;
      }
      visited.add(tileId);
      queue.push(tile);
    }
  }
  return visited;
}

function strategicDirection(
  player: PlayerState,
  context: BotContext,
  threatArrival: ReadonlyMap<string, number>,
): Direction | null {
  const opponents = context.activePlayerIds
    .filter((playerId) => playerId !== player.id)
    .map((playerId) => context.players[playerId])
    .filter((opponent) => opponent.active && opponent.alive)
    .map((opponent) => opponent.tile);
  if (opponents.length === 0) {
    return null;
  }

  const reachableTerrain = reachableTerrainTiles(player, context);
  const powerUps = context.arena.powerUps
    .filter((powerUp) => powerUp.revealed
      && !powerUp.collected
      && reachableTerrain.has(key(powerUp.tile)))
    .map((powerUp) => powerUp.tile);
  const hasOpponentRoute = [...reachableTerrain].some((tileId) => {
    const [x, y] = tileId.split(",").map(Number);
    return opponents.some((opponent) => distance({ x, y }, opponent) <= 1);
  });
  const isGoal = powerUps.length > 0
    ? (tile: TileCoord) => powerUps.some((powerUp) => key(powerUp) === key(tile))
    : hasOpponentRoute
      ? (tile: TileCoord) => opponents.some((opponent) => distance(tile, opponent) <= 1)
      : (tile: TileCoord) => canOpenTerrainFrom(tile, player, context);
  const moveMs = moveDurationMs(player);
  const queue: Array<Readonly<{ tile: TileCoord; first: Direction; elapsedSteps: number }>> = [];
  const visited = new Set([key(player.tile)]);

  for (const step of steps) {
    const tile = { x: player.tile.x + step.dx, y: player.tile.y + step.dy };
    if (!isWalkable(tile, context)) {
      continue;
    }
    const arrival = threatArrival.get(key(tile)) ?? Number.POSITIVE_INFINITY;
    if (arrival <= moveMs + ESCAPE_BUFFER_MS) {
      continue;
    }
    visited.add(key(tile));
    queue.push({ tile, first: step.direction, elapsedSteps: 1 });
  }

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const current = queue[cursor];
    if (isGoal(current.tile)) {
      return current.first;
    }
    for (const step of steps) {
      const tile = { x: current.tile.x + step.dx, y: current.tile.y + step.dy };
      const tileId = key(tile);
      if (visited.has(tileId) || !isWalkable(tile, context)) {
        continue;
      }
      const elapsedSteps = current.elapsedSteps + 1;
      const arrival = threatArrival.get(tileId) ?? Number.POSITIVE_INFINITY;
      if (arrival <= elapsedSteps * moveMs + ESCAPE_BUFFER_MS) {
        continue;
      }
      visited.add(tileId);
      queue.push({ tile, first: current.first, elapsedSteps });
    }
  }
  return null;
}

function escapeDirection(
  player: PlayerState,
  context: BotContext,
  threatArrival: ReadonlyMap<string, number>,
): Direction | null {
  const moveMs = moveDurationMs(player);
  const currentArrival = threatArrival.get(key(player.tile)) ?? Number.POSITIVE_INFINITY;
  if (!Number.isFinite(currentArrival)) {
    return null;
  }
  const queue: Array<Readonly<{ tile: TileCoord; first: Direction | null; elapsedSteps: number }>> = [
    { tile: player.tile, first: null, elapsedSteps: 0 },
  ];
  const visited = new Set([key(player.tile)]);
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const current = queue[cursor];
    if (current.elapsedSteps > 0 && !threatArrival.has(key(current.tile))) {
      return current.first;
    }
    for (const step of steps) {
      const tile = { x: current.tile.x + step.dx, y: current.tile.y + step.dy };
      const tileId = key(tile);
      if (visited.has(tileId) || !isWalkable(tile, context)) {
        continue;
      }
      const elapsedSteps = current.elapsedSteps + 1;
      const arrival = threatArrival.get(tileId) ?? Number.POSITIVE_INFINITY;
      const mustLeaveAgain = Number.isFinite(arrival);
      const safetyDeadlineSteps = mustLeaveAgain ? elapsedSteps + 1 : elapsedSteps;
      if (arrival <= safetyDeadlineSteps * moveMs + ESCAPE_BUFFER_MS) {
        continue;
      }
      visited.add(tileId);
      queue.push({ tile, first: current.first ?? step.direction, elapsedSteps });
    }
  }
  return null;
}

function alignThreatenedMovementToTileCenter(
  player: PlayerState,
  desired: Direction | null,
  threatened: boolean,
  context: BotContext,
): Direction | null {
  if (!threatened) {
    return desired;
  }
  const centerX = player.tile.x * TILE_SIZE + TILE_SIZE / 2;
  const centerY = player.tile.y * TILE_SIZE + TILE_SIZE / 2;
  const offsetX = player.position.x - centerX;
  const offsetY = player.position.y - centerY;
  const needsHorizontalAlignment = desired === "up" || desired === "down";
  const needsVerticalAlignment = desired === "left" || desired === "right";

  const resolveCorrection = (correction: Direction): Direction | null => {
    const option = context.evaluateMovementOption(player, correction, 1_000 / 60);
    if (context.canMovementOptionAdvance(player.position, option)) {
      return correction;
    }
    const opposite = oppositeDirection[correction];
    const oppositeOption = context.evaluateMovementOption(player, opposite, 1_000 / 60);
    return context.canMovementOptionAdvance(player.position, oppositeOption) ? opposite : desired;
  };

  if ((needsHorizontalAlignment || desired === null)
    && Math.abs(offsetX) > TURN_CENTER_TOLERANCE_PX) {
    return resolveCorrection(offsetX > 0 ? "left" : "right");
  }
  if ((needsVerticalAlignment || desired === null)
    && Math.abs(offsetY) > TURN_CENTER_TOLERANCE_PX) {
    return resolveCorrection(offsetY > 0 ? "up" : "down");
  }
  return desired;
}

function canDirectionAdvance(
  player: PlayerState,
  position: Readonly<{ x: number; y: number }>,
  direction: Direction,
  context: BotContext,
): boolean {
  const option = context.evaluateMovementOption(player, direction, 1_000 / 60);
  return context.canMovementOptionAdvance(position, option);
}

function canProjectedDirectionAdvance(
  player: PlayerState,
  position: Readonly<{ x: number; y: number }>,
  direction: Direction,
  context: BotContext,
): boolean {
  const option = context.evaluateProjectedMovementOption(player, direction, 1_000 / 60);
  return context.canMovementOptionAdvance(position, option);
}

function executableThreatenedDirection(
  player: PlayerState,
  desired: Direction | null,
  threatened: boolean,
  context: BotContext,
  threatArrival: ReadonlyMap<string, number>,
): Direction | null {
  if (!threatened || desired === null
    || canDirectionAdvance(player, player.position, desired, context)) {
    return desired;
  }
  const moveMs = moveDurationMs(player);
  let best: Readonly<{ direction: Direction; arrival: number }> | null = null;
  for (const step of steps) {
    if (step.direction === desired
      || !canDirectionAdvance(player, player.position, step.direction, context)) {
      continue;
    }
    const tile = { x: player.tile.x + step.dx, y: player.tile.y + step.dy };
    if (!isWalkable(tile, context)) {
      continue;
    }
    const arrival = threatArrival.get(key(tile)) ?? Number.POSITIVE_INFINITY;
    if (arrival <= moveMs + ESCAPE_BUFFER_MS) {
      continue;
    }
    if (best === null || arrival > best.arrival) {
      best = { direction: step.direction, arrival };
    }
  }
  return best?.direction ?? desired;
}

function shouldStartEmergencyPhase(
  player: PlayerState,
  threatArrival: ReadonlyMap<string, number>,
  escaping: Direction | null,
): boolean {
  if (player.skill.id !== "ranni-ice-blink" || player.skill.phase !== "idle") {
    return false;
  }
  const arrival = threatArrival.get(key(player.tile));
  if (arrival === undefined || arrival > RANNI_EMERGENCY_PHASE_WINDOW_MS) {
    return false;
  }
  const cannotClearCurrentTile = arrival <= moveDurationMs(player) + ESCAPE_BUFFER_MS;
  return escaping === null || cannotClearCurrentTile;
}

function isPositionOutsideAllBlasts(
  player: PlayerState,
  position: Readonly<{ x: number; y: number }>,
  context: BotContext,
): boolean {
  const projectedPlayer: PlayerState = {
    ...player,
    position,
  };
  if (context.flames.some((flame) => context.isPlayerOverlappingTile(projectedPlayer, flame.tile))) {
    return false;
  }
  return context.bombs.every((bomb) => (
    blastTiles(bomb, context).every((tile) => (
      !context.isPlayerOverlappingTile(projectedPlayer, tile)
    ))
  ));
}

function isPositionCentered(position: Readonly<{ x: number; y: number }>): boolean {
  const tileX = Math.floor(position.x / TILE_SIZE);
  const tileY = Math.floor(position.y / TILE_SIZE);
  const centerX = tileX * TILE_SIZE + TILE_SIZE / 2;
  const centerY = tileY * TILE_SIZE + TILE_SIZE / 2;
  return Math.abs(position.x - centerX) <= TURN_CENTER_TOLERANCE_PX
    && Math.abs(position.y - centerY) <= TURN_CENTER_TOLERANCE_PX;
}

function shouldReleaseEmergencyPhase(player: PlayerState, context: BotContext): boolean {
  return player.skill.id === "ranni-ice-blink"
    && player.skill.phase === "channeling"
    && player.skill.projectedPosition !== null
    && (player.skill.projectedBombEgressIds?.length ?? 0) === 0
    && isPositionCentered(player.skill.projectedPosition)
    && isPositionOutsideAllBlasts(player, player.skill.projectedPosition, context);
}

function shouldHoldPostPhaseRefuge(
  player: PlayerState,
  context: BotContext,
  threatArrival: ReadonlyMap<string, number>,
): boolean {
  if (player.skill.id !== "ranni-ice-blink" || player.skill.phase !== "cooldown") {
    return false;
  }
  const imminentOwnedFuse = context.bombs
    .filter((bomb) => bomb.ownerId === player.id && bomb.fuseMs <= RANNI_EMERGENCY_PHASE_WINDOW_MS)
    .reduce((earliest, bomb) => Math.min(earliest, bomb.fuseMs), Number.POSITIVE_INFINITY);
  if (!Number.isFinite(imminentOwnedFuse)
    || !isPositionOutsideAllBlasts(player, player.position, context)) {
    return false;
  }
  const currentArrival = threatArrival.get(key(player.tile));
  return currentArrival === undefined || currentArrival > imminentOwnedFuse + ESCAPE_BUFFER_MS;
}

function channelEscapeDirection(player: PlayerState, context: BotContext): Direction | null {
  const projectedPosition = player.skill.projectedPosition;
  if (player.skill.phase !== "channeling" || projectedPosition === null) {
    return null;
  }
  const start = {
    x: Math.floor(projectedPosition.x / TILE_SIZE),
    y: Math.floor(projectedPosition.y / TILE_SIZE),
  };
  const projectedPlayer: PlayerState = {
    ...player,
    tile: start,
    position: projectedPosition,
  };
  const projectedDirection = player.skill.projectedLastMoveDirection;
  if (!isPositionCentered(projectedPosition)
    && projectedDirection !== null
    && canProjectedDirectionAdvance(projectedPlayer, projectedPosition, projectedDirection, context)) {
    return projectedDirection;
  }
  const queue: Array<Readonly<{ tile: TileCoord; first: Direction }>> = [];
  const visited = new Set([key(start)]);
  for (const step of steps) {
    const tile = adjacentTile(start, step, context);
    const tileId = key(tile);
    if (visited.has(tileId)
      || !isWalkable(tile, context)
      || !canProjectedDirectionAdvance(projectedPlayer, projectedPosition, step.direction, context)) {
      continue;
    }
    visited.add(tileId);
    queue.push({ tile, first: step.direction });
  }
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const current = queue[cursor];
    const center = {
      x: current.tile.x * TILE_SIZE + TILE_SIZE / 2,
      y: current.tile.y * TILE_SIZE + TILE_SIZE / 2,
    };
    if (isPositionOutsideAllBlasts(player, center, context)) {
      return current.first;
    }
    for (const step of steps) {
      const tile = adjacentTile(current.tile, step, context);
      const tileId = key(tile);
      if (visited.has(tileId) || !isWalkable(tile, context)) {
        continue;
      }
      visited.add(tileId);
      queue.push({ tile, first: current.first });
    }
  }
  return null;
}

export function getBotPingoDecision(player: PlayerState, context: BotContext): BotDecision {
  const threatArrival = buildThreatArrival(context);
  const plannedEscape = escapeDirection(player, context, threatArrival);
  const threatened = threatArrival.has(key(player.tile));
  const alignedEscape = alignThreatenedMovementToTileCenter(
    player,
    plannedEscape,
    threatened,
    context,
  );
  const escaping = executableThreatenedDirection(
    player,
    alignedEscape,
    threatened,
    context,
    threatArrival,
  );
  const releaseSkill = shouldReleaseEmergencyPhase(player, context);
  const useSkill = releaseSkill || shouldStartEmergencyPhase(player, threatArrival, escaping);
  const holdPostPhaseRefuge = shouldHoldPostPhaseRefuge(player, context, threatArrival);
  const detonate = !useSkill && !holdPostPhaseRefuge && shouldDetonateRemote(player, context);
  const attackEscape = escaping === null && !useSkill && !holdPostPhaseRefuge && !detonate
    ? bombEscapeDirection(player, context)
    : null;
  const placeBomb = attackEscape !== null;
  const direction = player.skill.phase === "channeling"
    ? releaseSkill ? null : channelEscapeDirection(player, context)
    : holdPostPhaseRefuge
      ? null
      : escaping ?? attackEscape ?? strategicDirection(player, context, threatArrival);
  return {
    direction,
    placeBomb,
    detonate,
    useSkill,
    skillAction: releaseSkill ? "release" : undefined,
  };
}
