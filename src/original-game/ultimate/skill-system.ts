import type {
  CharacterSkillId,
  Direction,
  PlayerId,
  PlayerState,
} from "../Gameplay/types";
import type { SkillContext } from "./shared";
import { createDefaultPlayerSkillState } from "./shared";
import { getChampionSkillAdapter } from "../../../Champions/runtime";

export type { SkillContext } from "./shared";
export {
  createDefaultPlayerSkillState,
} from "./shared";
export {
  CHARACTER_SKILL_DEFINITIONS,
  getCharacterSkillDefinition,
  getCharacterSkillId,
} from "../../../Champions/runtime";

export function syncPlayerSkill(
  player: PlayerState,
  _context: SkillContext,
  getPlayerSkillId: (playerId: PlayerId) => CharacterSkillId | null,
): void {
  const expectedSkillId = getPlayerSkillId(player.id);
  if (player.skill.id === expectedSkillId) {
    return;
  }
  player.skill = createDefaultPlayerSkillState(expectedSkillId);
}

export function advancePlayerSkillTimers(player: PlayerState, deltaMs: number): void {
  if (player.skill.phase !== "cooldown" || !Number.isFinite(deltaMs) || deltaMs <= 0) {
    return;
  }
  player.skill.cooldownRemainingMs = Math.max(0, player.skill.cooldownRemainingMs - deltaMs);
  if (player.skill.cooldownRemainingMs <= 0) {
    player.skill.phase = "idle";
    player.skill.castElapsedMs = 0;
  }
}

export function activatePlayerSkill(
  player: PlayerState,
  desiredDirection: Direction | null,
  context: SkillContext,
): void {
  if (!player.alive || player.skill.phase !== "idle") {
    return;
  }
  getChampionSkillAdapter(player.skill.id)?.activate(player, desiredDirection, context);
}

export function updatePlayerSkillChannel(
  player: PlayerState,
  desiredDirection: Direction | null,
  skillPressed: boolean,
  skillHeld: boolean,
  deltaMs: number,
  context: SkillContext,
): boolean {
  if (player.skill.phase !== "channeling" && player.skill.phase !== "releasing") {
    return false;
  }
  return getChampionSkillAdapter(player.skill.id)?.update(player, desiredDirection, skillPressed, skillHeld, deltaMs, context) ?? false;
}

export function isPlayerImmuneDuringSkillChannel(player: PlayerState): boolean {
  return getChampionSkillAdapter(player.skill.id)?.immune?.(player) ?? false;
}
