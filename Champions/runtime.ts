import type {
  Direction,
  PixelCoord,
  PlayerState,
} from "../src/original-game/Gameplay/types";
import type { SkillContext } from "../src/original-game/ultimate/shared";
import type { ChampionSkillAdapter } from "./runtime-contracts";
import {
  CHAMPION_MEMBERSHIP,
  getChampionSlugFromModulePath,
  listChampionMembership,
} from "./membership";
import {
  getCharacterSkillDefinition,
  getCharacterSkillId,
  listCharacterSkillDefinitions,
} from "./catalog";

type ChampionSkillModule = Readonly<{
  CHAMPION_SKILL_ADAPTER: ChampionSkillAdapter;
}>;

const skillModules = import.meta.glob<ChampionSkillModule>("./*/skill.ts", {
  eager: true,
});
const discoveredAdapters = Object.entries(skillModules).map(
  ([modulePath, { CHAMPION_SKILL_ADAPTER }]) => {
    const slug = getChampionSlugFromModulePath(modulePath, "skill");
    if (!slug) throw new Error(`Unexpected Champion skill module: ${modulePath}`);
    if (CHAMPION_SKILL_ADAPTER.skillId !== CHAMPION_MEMBERSHIP[slug].skillId) {
      throw new Error(`Champion skill adapter does not match folder: ${slug}`);
    }
    return CHAMPION_SKILL_ADAPTER;
  },
);
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
