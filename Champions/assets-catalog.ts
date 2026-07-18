import type { CharacterId } from "./contracts";
import type { ChampionAssets } from "./assets";
import { RANNI_CHARACTER_ID } from "./ranni/definition";
import { RANNI_ASSETS } from "./ranni/assets";
import { KILLER_BEE_CHARACTER_ID } from "./killer-bee/definition";
import { KILLER_BEE_ASSETS } from "./killer-bee/assets";
import { CROCODILO_CHARACTER_ID } from "./crocodilo-arcano/definition";
import { CROCODILO_ASSETS } from "./crocodilo-arcano/assets";
import { NICO_CHARACTER_ID } from "./nico/definition";
import { NICO_ASSETS } from "./nico/assets";
import { NIX_EMBER_CHARACTER_ID } from "./nix-ember/definition";
import { NIX_EMBER_ASSETS } from "./nix-ember/assets";
import { PENDULA_CHARACTER_ID } from "./pendula/definition";
import { PENDULA_ASSETS } from "./pendula/assets";

export type ChampionAssetEntry = Readonly<{
  characterId: CharacterId;
  assets: ChampionAssets;
}>;

const ASSET_ENTRIES: readonly ChampionAssetEntry[] = Object.freeze([
  { characterId: RANNI_CHARACTER_ID, assets: RANNI_ASSETS },
  { characterId: KILLER_BEE_CHARACTER_ID, assets: KILLER_BEE_ASSETS },
  { characterId: CROCODILO_CHARACTER_ID, assets: CROCODILO_ASSETS },
  { characterId: NICO_CHARACTER_ID, assets: NICO_ASSETS },
  { characterId: NIX_EMBER_CHARACTER_ID, assets: NIX_EMBER_ASSETS },
  { characterId: PENDULA_CHARACTER_ID, assets: PENDULA_ASSETS },
]);
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
