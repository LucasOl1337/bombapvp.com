import type {
  Direction,
  PixelCoord,
  PlayerState,
} from "../../src/original-game/Gameplay/types";
import type { SkillContext } from "../../src/original-game/ultimate/shared";
import type { ChampionSkillAdapter } from "../runtime-contracts";
import { RANNI_SKILL_COOLDOWN_MS, RANNI_SKILL_ID } from "./identity";

export { RANNI_CHARACTER_ID, RANNI_SKILL_COOLDOWN_MS } from "./identity";

export const RANNI_SKILL_CHANNEL_MS = 1_500;

export function retainOverlappingRanniProjectedBombEgress(
  player: PlayerState,
  overlappingBombIds: readonly number[],
): void {
  const overlapping = new Set(overlappingBombIds);
  player.skill.projectedBombEgressIds = (
    player.skill.projectedBombEgressIds ?? []
  ).filter((bombId) => overlapping.has(bombId));
}

export function simulateProjectedMovement(
  player: PlayerState,
  startPosition: PixelCoord,
  desiredDirection: Direction,
  projectedLastMoveDirection: Direction | null,
  deltaMs: number,
  context: SkillContext,
) {
  const ghost = context.clonePlayerState(player);
  ghost.position = { ...startPosition };
  ghost.tile = context.getTileFromPosition(startPosition);
  ghost.velocity = { x: 0, y: 0 };
  ghost.lastMoveDirection = projectedLastMoveDirection;
  const actualDirection = context.resolveMovementDirection(
    ghost,
    desiredDirection,
    deltaMs,
    ghost.skill.projectedBombEgressIds ?? [],
  );
  ghost.direction = actualDirection;
  context.movePlayerSimulated(
    ghost,
    actualDirection,
    deltaMs,
    ghost.skill.projectedBombEgressIds ?? [],
  );
  const overlappingBombIds = (ghost.skill.projectedBombEgressIds ?? []).filter(
    (bombId) => {
      const bomb = context.bombs.find((item) => item.id === bombId);
      return Boolean(
        bomb && context.isPositionOverlappingTile(ghost.position, bomb.tile),
      );
    },
  );
  retainOverlappingRanniProjectedBombEgress(ghost, overlappingBombIds);
  return {
    position: { ...ghost.position },
    lastMoveDirection: ghost.lastMoveDirection,
    direction: ghost.direction,
    projectedBombEgressIds: [...(ghost.skill.projectedBombEgressIds ?? [])],
  };
}

export function grantRanniProjectedBombEgress(
  player: PlayerState,
  bombId: number,
): void {
  if (
    player.skill.id !== RANNI_SKILL_ID ||
    player.skill.phase !== "channeling" ||
    player.skill.projectedBombEgressIds?.includes(bombId)
  ) {
    return;
  }
  player.skill.projectedBombEgressIds = [
    ...(player.skill.projectedBombEgressIds ?? []),
    bombId,
  ];
}

export function getRanniProjectedMovementIgnoredBombIds(
  player: PlayerState,
): readonly number[] {
  return player.skill.id === RANNI_SKILL_ID &&
    player.skill.phase === "channeling"
    ? (player.skill.projectedBombEgressIds ?? [])
    : [];
}

export function notifyRanniBombPlaced(
  player: PlayerState,
  bombId: number,
  overlapsProjectedPosition: boolean,
): void {
  if (overlapsProjectedPosition) grantRanniProjectedBombEgress(player, bombId);
}

export function notifyRanniBombRemoved(
  player: PlayerState,
  bombId: number,
): void {
  player.skill.projectedBombEgressIds = (
    player.skill.projectedBombEgressIds ?? []
  ).filter((id) => id !== bombId);
}

export function startRanniIceBlink(player: PlayerState): void {
  player.skill.phase = "channeling";
  player.skill.channelRemainingMs = RANNI_SKILL_CHANNEL_MS;
  player.skill.castElapsedMs = 0;
  player.skill.projectedPosition = { ...player.position };
  player.skill.projectedLastMoveDirection = player.lastMoveDirection;
  player.skill.projectedBombEgressIds = [];
  player.velocity.x = 0;
  player.velocity.y = 0;
}

export function updateRanniIceBlinkChannel(
  player: PlayerState,
  desiredDirection: Direction | null,
  skillPressed: boolean,
  deltaMs: number,
  context: SkillContext,
): boolean {
  if (player.skill.id !== RANNI_SKILL_ID) {
    return false;
  }
  player.velocity.x = 0;
  player.velocity.y = 0;
  if (!Number.isFinite(deltaMs) || deltaMs <= 0) {
    return true;
  }
  if (skillPressed && player.skill.castElapsedMs > 0) {
    finishRanniBlink(player, context);
    return true;
  }
  if (!player.skill.projectedPosition) {
    player.skill.projectedPosition = { ...player.position };
  }
  const overlappingBombIds = (player.skill.projectedBombEgressIds ?? []).filter(
    (bombId) => {
      const bomb = context.bombs.find((item) => item.id === bombId);
      return Boolean(
        bomb &&
          player.skill.projectedPosition &&
          context.isPositionOverlappingTile(
            player.skill.projectedPosition,
            bomb.tile,
          ),
      );
    },
  );
  retainOverlappingRanniProjectedBombEgress(player, overlappingBombIds);
  if (desiredDirection) {
    const simulated = simulateProjectedMovement(
      player,
      player.skill.projectedPosition,
      desiredDirection,
      player.skill.projectedLastMoveDirection,
      deltaMs,
      context,
    );
    player.skill.projectedPosition = simulated.position;
    player.skill.projectedLastMoveDirection = simulated.lastMoveDirection;
    player.skill.projectedBombEgressIds = simulated.projectedBombEgressIds;
    player.direction = simulated.direction;
  }

  player.skill.channelRemainingMs = Math.max(
    0,
    player.skill.channelRemainingMs - deltaMs,
  );
  player.skill.castElapsedMs += deltaMs;
  if (player.skill.channelRemainingMs <= 0) {
    finishRanniBlink(player, context);
  }
  return true;
}

export function finishRanniBlink(
  player: PlayerState,
  context: SkillContext,
): void {
  if (player.skill.id !== RANNI_SKILL_ID) {
    return;
  }
  const target = player.skill.projectedPosition ?? player.position;
  const canMoveToTarget = context.canOccupyPosition(player, target);
  if (canMoveToTarget) {
    player.position = { ...target };
    player.tile = context.getTileFromPosition(player.position);
  }
  if (player.skill.projectedLastMoveDirection) {
    player.lastMoveDirection = player.skill.projectedLastMoveDirection;
    player.direction = player.skill.projectedLastMoveDirection;
  }
  player.velocity.x = 0;
  player.velocity.y = 0;
  player.skill.phase = "cooldown";
  player.skill.channelRemainingMs = 0;
  player.skill.cooldownRemainingMs = RANNI_SKILL_COOLDOWN_MS;
  player.skill.castElapsedMs = 0;
  player.skill.projectedPosition = null;
  player.skill.projectedLastMoveDirection = null;
  player.skill.projectedBombEgressIds = [];
}

export function isRanniImmuneDuringChannel(player: PlayerState): boolean {
  return (
    player.skill.id === RANNI_SKILL_ID && player.skill.phase === "channeling"
  );
}

export const RANNI_SKILL_ADAPTER: ChampionSkillAdapter = {
  skillId: RANNI_SKILL_ID,
  activate: (player) => startRanniIceBlink(player),
  update: (player, direction, pressed, _held, deltaMs, context) =>
    updateRanniIceBlinkChannel(player, direction, pressed, deltaMs, context),
  immune: isRanniImmuneDuringChannel,
  projectedIgnoredBombIds: getRanniProjectedMovementIgnoredBombIds,
  bombPlaced: notifyRanniBombPlaced,
  bombRemoved: notifyRanniBombRemoved,
};
export const CHAMPION_SKILL_ADAPTER = RANNI_SKILL_ADAPTER;
