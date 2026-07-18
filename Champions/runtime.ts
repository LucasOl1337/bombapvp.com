import type {
  Direction,
  PixelCoord,
  PlayerState,
} from "../src/original-game/Gameplay/types";
import type { SkillContext } from "../src/original-game/ultimate/shared";
import type { ChampionSkillAdapter } from "./runtime-contracts";
import { RANNI_SKILL_ADAPTER } from "./ranni/skill";
import { KILLER_BEE_SKILL_ADAPTER } from "./killer-bee/skill";
import { CROCODILO_SKILL_ADAPTER } from "./crocodilo-arcano/skill";
import { NICO_SKILL_ADAPTER } from "./nico/skill";
import { NIX_EMBER_SKILL_ADAPTER } from "./nix-ember/skill";
import {
  getCharacterSkillDefinition,
  getCharacterSkillId,
  listCharacterSkillDefinitions,
} from "./catalog";

const adapters: readonly ChampionSkillAdapter[] = Object.freeze([
  RANNI_SKILL_ADAPTER,
  KILLER_BEE_SKILL_ADAPTER,
  CROCODILO_SKILL_ADAPTER,
  NICO_SKILL_ADAPTER,
  NIX_EMBER_SKILL_ADAPTER,
]);
const adaptersBySkillId = new Map(
  adapters.map((adapter) => [adapter.skillId, adapter]),
);

export const CHARACTER_SKILL_DEFINITIONS = listCharacterSkillDefinitions();
export { getCharacterSkillDefinition, getCharacterSkillId };

export function getChampionSkillAdapter(
  skillId: PlayerState["skill"]["id"],
): ChampionSkillAdapter | null {
  return skillId ? (adaptersBySkillId.get(skillId) ?? null) : null;
}

export function getChampionProjectedMovementIgnoredBombIds(
  player: PlayerState,
): readonly number[] {
  return (
    getChampionSkillAdapter(player.skill.id)?.projectedIgnoredBombIds?.(
      player,
    ) ?? []
  );
}

export function projectChampionSkillTarget(
  player: PlayerState,
  direction: Direction,
  context: SkillContext,
): PixelCoord {
  return (
    getChampionSkillAdapter(player.skill.id)?.projectTarget?.(
      player,
      direction,
      context,
    ) ?? player.position
  );
}

export function championSkillAllowsPlayerOverlap(player: PlayerState): boolean {
  return getChampionSkillAdapter(player.skill.id)?.allowsPlayerOverlap === true;
}

export function notifyChampionBombPlaced(
  players: Iterable<PlayerState>,
  bombId: number,
  overlaps: (player: PlayerState) => boolean,
): void {
  for (const player of players)
    getChampionSkillAdapter(player.skill.id)?.bombPlaced?.(
      player,
      bombId,
      overlaps(player),
    );
}

export function notifyChampionBombRemoved(
  players: Iterable<PlayerState>,
  bombId: number,
): void {
  for (const player of players)
    getChampionSkillAdapter(player.skill.id)?.bombRemoved?.(player, bombId);
}
