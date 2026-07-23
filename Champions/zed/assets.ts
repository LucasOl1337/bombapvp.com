import portraitUrl from "./assets/portrait.png?url";
import { createChampionAssets } from "../assets";
import { ZED_CHARACTER_ID } from "./definition";

/** High-frame 160×160 install pack for the Living Shadow vertical slice. */
export const ZED_ASSETS = createChampionAssets(
  portraitUrl,
  { width: 160, height: 160 },
  import.meta.glob("./assets/animations/*.png", {
    eager: true,
    import: "default",
    query: "?url",
  }) as Record<string, string>,
);

export const CHAMPION_ASSET_ENTRY = Object.freeze({
  characterId: ZED_CHARACTER_ID,
  assets: ZED_ASSETS,
});
