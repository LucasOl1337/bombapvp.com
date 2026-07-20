import type {
  Direction,
  PixelCoord,
  PlayerState,
} from "../src/original-game/Gameplay/types";
import type { SkillContext } from "../src/original-game/ultimate/shared";
import type { ChampionSkillAdapter } from "./runtime-contracts";
import { listChampionMembership } from "./membership";
import {
  getCharacterSkillDefinition,
  getCharacterSkillId,
  listCharacterSkillDefinitions,
} from "./catalog";
import { CHAMPION_SKILL_ADAPTER as RANNI } from "./ranni/skill";
import { CHAMPION_SKILL_ADAPTER as BEE } from "./killer-bee/skill";
import { CHAMPION_SKILL_ADAPTER as CROCODILO } from "./crocodilo-arcano/skill";
import { CHAMPION_SKILL_ADAPTER as NICO } from "./nico/skill";
import { CHAMPION_SKILL_ADAPTER as NIX } from "./nix-ember/skill";
import { CHAMPION_SKILL_ADAPTER as PENDULA } from "./pendula/skill";
import { CHAMPION_SKILL_ADAPTER as MIRELLE } from "./mirelle/skill";

const discoveredAdapters: ChampionSkillAdapter[] = [RANNI, BEE, CROCODILO, NICO, NIX, PENDULA, MIRELLE];
const adaptersBySkillId = new Map(
  discoveredAdapters.map((adapter) => [adapter.skillId, adapter]),
);
for (const { slug, skillId } of listChampionMembership()) {
  if (!adaptersBySkillId.has(skillId)) {
    throw new Error(`Missing Champion skill adapter: ${slug}`);
  }
}
if (adaptersBySkillId.size !== listChampionMembership().length) {
  throw new Error("Champion skill adapters do not match canonical membership");
}

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
