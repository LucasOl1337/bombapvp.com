import type {
  Direction,
  PixelCoord,
  PlayerState,
} from "../src/original-game/Gameplay/types";
import type { SkillContext } from "../src/original-game/ultimate/shared";
import type { ChampionSkillAdapter } from "./runtime-contracts";
import type { CharacterSkillDefinition } from "./contracts";
import {
  CHAMPION_MEMBERSHIP,
  listChampionMembership,
  type ChampionSlug,
} from "./membership";

/**
 * Explicit skill adapter registry (no import.meta.glob).
 * Required so the Cloudflare Worker bundle can load the same adapters as Vite.
 */
import { CHAMPION_SKILL_ADAPTER as ranniSkill } from "./ranni/skill";
import { CHAMPION_SKILL_ADAPTER as killerBeeSkill } from "./killer-bee/skill";
import { CHAMPION_SKILL_ADAPTER as crocodiloSkill } from "./crocodilo-arcano/skill";
import { CHAMPION_SKILL_ADAPTER as nicoSkill } from "./nico/skill";
import { CHAMPION_SKILL_ADAPTER as nixEmberSkill } from "./nix-ember/skill";
import { CHAMPION_SKILL_ADAPTER as pendulaSkill } from "./pendula/skill";
import { CHAMPION_SKILL_ADAPTER as mirelleSkill } from "./mirelle/skill";
import { CHAMPION_SKILL_ADAPTER as leeSinSkill } from "./lee-sin/skill";
import { CHAMPION_SKILL_ADAPTER as threshSkill } from "./thresh/skill";

const SKILL_ADAPTERS_BY_SLUG = Object.freeze({
  ranni: ranniSkill,
  "killer-bee": killerBeeSkill,
  "crocodilo-arcano": crocodiloSkill,
  nico: nicoSkill,
  "nix-ember": nixEmberSkill,
  pendula: pendulaSkill,
  mirelle: mirelleSkill,
  "lee-sin": leeSinSkill,
  thresh: threshSkill,
} satisfies Record<ChampionSlug, ChampionSkillAdapter>);

const discoveredAdapters = listChampionMembership().map(({ slug, skillId }) => {
  const adapter = SKILL_ADAPTERS_BY_SLUG[slug];
  if (!adapter) throw new Error(`Missing Champion skill adapter: ${slug}`);
  if (adapter.skillId !== skillId) {
    throw new Error(`Champion skill adapter does not match membership: ${slug}`);
  }
  return adapter;
});
const adaptersBySkillId = new Map(
  discoveredAdapters.map((adapter) => [adapter.skillId, adapter]),
);
if (adaptersBySkillId.size !== listChampionMembership().length) {
  throw new Error("Champion skill adapters do not match canonical membership");
}

export const CHARACTER_SKILL_DEFINITIONS: readonly CharacterSkillDefinition[] =
  Object.freeze(
    listChampionMembership().map(({ characterId, skillId, skillCooldownMs }) =>
      Object.freeze({
        characterId,
        skillId,
        cooldownMs: skillCooldownMs,
      }),
    ),
  );
const skillDefinitionByCharacterId = new Map(
  CHARACTER_SKILL_DEFINITIONS.map((definition) => [
    definition.characterId,
    definition,
  ]),
);

export function getCharacterSkillDefinition(
  id: string,
): CharacterSkillDefinition | null {
  return (
    skillDefinitionByCharacterId.get(
      id as CharacterSkillDefinition["characterId"],
    ) ?? null
  );
}

export function getCharacterSkillId(
  id: string,
): CharacterSkillDefinition["skillId"] | null {
  return getCharacterSkillDefinition(id)?.skillId ?? null;
}

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

// Keep membership symbol used for type-level exhaustiveness of the registry.
void CHAMPION_MEMBERSHIP;
