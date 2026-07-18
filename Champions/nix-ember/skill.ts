import type {
  Direction,
  PixelCoord,
  PlayerState,
  TileCoord,
} from "../../src/original-game/Gameplay/types";
import { TILE_SIZE } from "../../src/original-game/PersonalConfig/config";
import type { SkillContext } from "../../src/original-game/ultimate/shared";
import type { ChampionSkillAdapter } from "../runtime-contracts";
import {
  NIX_EMBER_SKILL_COOLDOWN_MS,
  NIX_EMBER_SKILL_ID,
} from "./definition";

export {
  NIX_EMBER_CHARACTER_ID,
  NIX_EMBER_SKILL_COOLDOWN_MS,
} from "./definition";

/** Ember Vault: short hop over a bomb/flame line and land ready to plant. */
export const NIX_EMBER_VAULT_DISTANCE_PX = TILE_SIZE * 2.5;
export const NIX_EMBER_VAULT_DURATION_MS = 280;
export const NIX_EMBER_VAULT_MIN_DURATION_MS = 100;
export const NIX_EMBER_VAULT_BLOCKED_COOLDOWN_MS = 350;
export const NIX_EMBER_VAULT_FRAME_MS = 70;

const directionDelta: Record<Direction, TileCoord> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export function getVaultDistancePx(
  from: PixelCoord,
  to: PixelCoord,
  direction: Direction,
  context: SkillContext,
): number {
  const width = context.arena.config.grid.width * TILE_SIZE;
  const height = context.arena.config.grid.height * TILE_SIZE;
  return direction === "left" || direction === "right"
    ? Math.abs(context.getWrappedDelta(to.x, from.x, width))
    : Math.abs(context.getWrappedDelta(to.y, from.y, height));
}

export function hasReachedVaultTarget(
  position: PixelCoord,
  target: PixelCoord,
  context: SkillContext,
): boolean {
  const width = context.arena.config.grid.width * TILE_SIZE;
  const height = context.arena.config.grid.height * TILE_SIZE;
  const dx = context.getWrappedDelta(target.x, position.x, width);
  const dy = context.getWrappedDelta(target.y, position.y, height);
  return Math.hypot(dx, dy) <= 0.5;
}

export const NIX_EMBER_SKILL_ADAPTER: ChampionSkillAdapter = {
  skillId: NIX_EMBER_SKILL_ID,
  activate: (player, direction, context) =>
    startNixEmberVault(player, direction, context),
  update: (player, _direction, _pressed, _held, deltaMs, context) =>
    updateNixEmberVault(player, deltaMs, context),
  projectTarget: computeNixEmberVaultTarget,
  allowsPlayerOverlap: true,
};

export function startNixEmberVault(
  player: PlayerState,
  desiredDirection: Direction | null,
  context: SkillContext,
): void {
  if (player.skill.id !== NIX_EMBER_SKILL_ID) {
    return;
  }
  const vaultDirection =
    desiredDirection ?? player.lastMoveDirection ?? player.direction;
  const target = computeNixEmberVaultTarget(player, vaultDirection, context);
  const vaultDistance = getVaultDistancePx(
    player.position,
    target,
    vaultDirection,
    context,
  );
  if (vaultDistance < 1) {
    player.skill.phase = "cooldown";
    player.skill.channelRemainingMs = 0;
    player.skill.cooldownRemainingMs = NIX_EMBER_VAULT_BLOCKED_COOLDOWN_MS;
    player.skill.castElapsedMs = 0;
    player.skill.projectedPosition = null;
    player.skill.projectedLastMoveDirection = null;
    player.velocity.x = 0;
    player.velocity.y = 0;
    return;
  }
  const durationMs = Math.max(
    NIX_EMBER_VAULT_MIN_DURATION_MS,
    Math.round(
      NIX_EMBER_VAULT_DURATION_MS *
        (vaultDistance / NIX_EMBER_VAULT_DISTANCE_PX),
    ),
  );
  player.direction = vaultDirection;
  player.lastMoveDirection = vaultDirection;
  player.skill.phase = "channeling";
  player.skill.channelRemainingMs = durationMs;
  player.skill.castElapsedMs = 0;
  player.skill.projectedPosition = target;
  player.skill.projectedLastMoveDirection = vaultDirection;
  player.velocity.x = 0;
  player.velocity.y = 0;
}

export function updateNixEmberVault(
  player: PlayerState,
  deltaMs: number,
  context: SkillContext,
): boolean {
  if (player.skill.id !== NIX_EMBER_SKILL_ID) {
    return false;
  }
  if (!Number.isFinite(deltaMs) || deltaMs <= 0) {
    player.velocity.x = 0;
    player.velocity.y = 0;
    return true;
  }
  const vaultDirection =
    player.skill.projectedLastMoveDirection ??
    player.lastMoveDirection ??
    player.direction;
  const target = player.skill.projectedPosition ?? player.position;
  const start = { ...player.position };
  const remainingMs = Math.max(0, player.skill.channelRemainingMs);
  const stepFraction =
    remainingMs <= 0 ? 1 : Math.min(1, deltaMs / remainingMs);
  const arenaPixelWidth = context.arena.config.grid.width * TILE_SIZE;
  const arenaPixelHeight = context.arena.config.grid.height * TILE_SIZE;
  const deltaX = context.getWrappedDelta(
    target.x,
    player.position.x,
    arenaPixelWidth,
  );
  const deltaY = context.getWrappedDelta(
    target.y,
    player.position.y,
    arenaPixelHeight,
  );
  const nextPosition = context.normalizeArenaPosition({
    x: player.position.x + deltaX * stepFraction,
    y: player.position.y + deltaY * stepFraction,
  });
  if (!context.canOccupyPosition(player, nextPosition)) {
    finishNixEmberVault(
      player,
      context,
      player.position,
      NIX_EMBER_VAULT_BLOCKED_COOLDOWN_MS,
    );
    return true;
  }
  player.position = nextPosition;
  player.velocity = {
    x:
      context.getWrappedDelta(player.position.x, start.x, arenaPixelWidth) /
      (deltaMs / 1000),
    y:
      context.getWrappedDelta(player.position.y, start.y, arenaPixelHeight) /
      (deltaMs / 1000),
  };
  player.direction = vaultDirection;
  player.lastMoveDirection = vaultDirection;
  player.tile = context.getTileFromPosition(player.position);
  player.skill.channelRemainingMs = Math.max(0, remainingMs - deltaMs);
  player.skill.castElapsedMs += deltaMs;
  if (
    player.skill.channelRemainingMs <= 0 ||
    hasReachedVaultTarget(player.position, target, context)
  ) {
    finishNixEmberVault(player, context);
  }
  return true;
}

export function finishNixEmberVault(
  player: PlayerState,
  context: SkillContext,
  fallbackPosition: PixelCoord = player.position,
  cooldownMs: number = NIX_EMBER_SKILL_COOLDOWN_MS,
): void {
  if (player.skill.id !== NIX_EMBER_SKILL_ID) {
    return;
  }
  const projectedTarget = player.skill.projectedPosition ?? player.position;
  const target = context.canOccupyPosition(player, projectedTarget)
    ? projectedTarget
    : fallbackPosition;
  player.position = { ...target };
  player.tile = context.getTileFromPosition(player.position);
  if (player.skill.projectedLastMoveDirection) {
    player.direction = player.skill.projectedLastMoveDirection;
    player.lastMoveDirection = player.skill.projectedLastMoveDirection;
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

export function computeNixEmberVaultTarget(
  player: PlayerState,
  direction: Direction,
  context: SkillContext,
): PixelCoord {
  const delta = directionDelta[direction];
  const stepPx = 4;
  let position = { ...player.position };
  let travelledPx = 0;
  while (travelledPx < NIX_EMBER_VAULT_DISTANCE_PX) {
    const nextStep = Math.min(
      stepPx,
      NIX_EMBER_VAULT_DISTANCE_PX - travelledPx,
    );
    const candidate = context.normalizeArenaPosition({
      x: position.x + delta.x * nextStep,
      y: position.y + delta.y * nextStep,
    });
    if (!context.canOccupyPosition(player, candidate)) {
      break;
    }
    position = candidate;
    travelledPx += nextStep;
  }
  return position;
}
