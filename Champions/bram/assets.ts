import portraitUrl from "./assets/portrait.png?url";
import { createChampionAssets } from "../assets";
import { BRAM_CHARACTER_ID } from "./definition";

export const BRAM_ASSETS = createChampionAssets(
  portraitUrl,
  { width: 124, height: 124 },
  import.meta.glob("./assets/animations/*.png", {
    eager: true,
    import: "default",
    query: "?url",
  }) as Record<string, string>,
);
export const CHAMPION_ASSET_ENTRY = Object.freeze({
  characterId: BRAM_CHARACTER_ID,
  assets: BRAM_ASSETS,
});
