import type { CharacterId } from "./contracts";
import type { ChampionAssets } from "./assets";
import {
  CHAMPION_MEMBERSHIP,
  getChampionSlugFromModulePath,
  listChampionMembership,
} from "./membership";

export type ChampionAssetEntry = Readonly<{
  characterId: CharacterId;
  assets: ChampionAssets;
}>;

type ChampionAssetModule = Readonly<{
  CHAMPION_ASSET_ENTRY: ChampionAssetEntry;
}>;

const assetModules = import.meta.glob<ChampionAssetModule>("./*/assets.ts", {
  eager: true,
});
const discoveredByCharacterId = new Map(
  Object.entries(assetModules).map(([modulePath, { CHAMPION_ASSET_ENTRY }]) => {
    const slug = getChampionSlugFromModulePath(modulePath, "assets");
    if (!slug) throw new Error(`Unexpected Champion asset module: ${modulePath}`);
    if (
      CHAMPION_ASSET_ENTRY.characterId !== CHAMPION_MEMBERSHIP[slug].characterId
    ) {
      throw new Error(`Champion asset entry does not match folder: ${slug}`);
    }
    return [CHAMPION_ASSET_ENTRY.characterId, CHAMPION_ASSET_ENTRY] as const;
  }),
);
const ASSET_ENTRIES: readonly ChampionAssetEntry[] = Object.freeze(
  listChampionMembership().map(({ slug, characterId }) => {
    const entry = discoveredByCharacterId.get(characterId);
    if (!entry) throw new Error(`Missing Champion asset entry: ${slug}`);
    return entry;
  }),
);
if (discoveredByCharacterId.size !== ASSET_ENTRIES.length) {
  throw new Error("Champion asset entries do not match canonical membership");
}
const ASSETS_BY_ID = new Map(
  ASSET_ENTRIES.map(({ characterId, assets }) => [characterId, assets]),
);

export function getChampionAssets(characterId: CharacterId): ChampionAssets {
  const assets = ASSETS_BY_ID.get(characterId);
  if (!assets) throw new Error(`Missing Champion assets: ${characterId}`);
  return assets;
}

export function listChampionAssetEntries(): readonly ChampionAssetEntry[] {
  return ASSET_ENTRIES;
}
