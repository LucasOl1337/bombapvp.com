import portraitUrl from "./assets/portrait.png?url";
import { createChampionAtlasAssets } from "../assets";
import { KILLER_BEE_CHARACTER_ID } from "./definition";

export const KILLER_BEE_ASSETS = createChampionAtlasAssets(
  "killer-bee",
  portraitUrl,
  { width: 124, height: 124 },
);

export const CHAMPION_ASSET_ENTRY = Object.freeze({
  characterId: KILLER_BEE_CHARACTER_ID,
  assets: KILLER_BEE_ASSETS,
});
