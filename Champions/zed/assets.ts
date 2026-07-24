import portraitUrl from "./assets/portrait.png?url";
import { createChampionAtlasAssets } from "../assets";
import { ZED_CHARACTER_ID } from "./definition";

/** High-frame 160×160 install pack for the Living Shadow vertical slice. */
export const ZED_ASSETS = createChampionAtlasAssets(
  "zed",
  portraitUrl,
  { width: 160, height: 160 },
);

export const CHAMPION_ASSET_ENTRY = Object.freeze({
  characterId: ZED_CHARACTER_ID,
  assets: ZED_ASSETS,
});
