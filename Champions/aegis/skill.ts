import type { Direction, PlayerState } from "../../src/original-game/Gameplay/types";
import type { SkillContext } from "../../src/original-game/ultimate/shared";
import type { ChampionSkillAdapter } from "../runtime-contracts";
import { AEGIS_SKILL_COOLDOWN_MS, AEGIS_SKILL_ID } from "./definition";

export { AEGIS_CHARACTER_ID, AEGIS_SKILL_COOLDOWN_MS } from "./definition";

export const AEGIS_SKILL_CHANNEL_MS = 250;
export const AEGIS_GUARD_MS = 900;

export type AegisSkillContext = Pick<SkillContext, "soundManager">;

export function fireBastionPulse(
  player: PlayerState,
  context: AegisSkillContext,
): void {
  player.flameGuardMs = Math.max(player.flameGuardMs, AEGIS_GUARD_MS);
  context.soundManager.playOneShot("shieldBlock");
}

export function isAegisImmuneDuringChannel(player: PlayerState): boolean {
  return (
    player.skill.id === AEGIS_SKILL_ID &&
    (player.skill.phase === "channeling" || player.skill.phase === "releasing")
  );
}

export const AEGIS_SKILL_ADAPTER: ChampionSkillAdapter = {
  skillId: AEGIS_SKILL_ID,
  activate: (player, direction) => startAegisBastionPulse(player, direction),
  update: (player, direction, _p, _h, deltaMs, context) =>
    updateAegisBastionPulse(player, direction, deltaMs, context),
  immune: isAegisImmuneDuringChannel,
};
export const CHAMPION_SKILL_ADAPTER = AEGIS_SKILL_ADAPTER;

export function startAegisBastionPulse(
  player: PlayerState,
  desiredDirection: Direction | null,
): void {
  if (player.skill.id !== AEGIS_SKILL_ID) return;
  const aim =
    desiredDirection ?? player.lastMoveDirection ?? player.direction;
  player.direction = aim;
  player.lastMoveDirection = aim;
  player.skill.phase = "channeling";
  player.skill.channelRemainingMs = AEGIS_SKILL_CHANNEL_MS;
  player.skill.cooldownRemainingMs = 0;
  player.skill.castElapsedMs = 0;
  player.skill.projectedPosition = null;
  player.skill.projectedLastMoveDirection = aim;
  player.velocity.x = 0;
  player.velocity.y = 0;
}

export function updateAegisBastionPulse(
  player: PlayerState,
  desiredDirection: Direction | null,
  deltaMs: number,
  context: AegisSkillContext,
): boolean {
  if (player.skill.id !== AEGIS_SKILL_ID) return false;
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
    fireBastionPulse(player, context);
    player.skill.phase = "cooldown";
    player.skill.cooldownRemainingMs = AEGIS_SKILL_COOLDOWN_MS;
    player.skill.castElapsedMs = 0;
    player.skill.projectedPosition = null;
    player.skill.projectedLastMoveDirection = null;
  }
  return true;
}
