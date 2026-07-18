import portraitUrl from "./assets/portrait.png?url";
import { createChampionAssets } from "../assets";
import { RANNI_CHARACTER_ID } from "./definition";
export const RANNI_ASSETS = createChampionAssets(
  portraitUrl,
  { width: 160, height: 160 },
  import.meta.glob("./assets/animations/*.png", {
    eager: true,
    import: "default",
    query: "?url",
  }) as Record<string, string>,
);
export const CHAMPION_ASSET_ENTRY = Object.freeze({
  characterId: RANNI_CHARACTER_ID,
  assets: RANNI_ASSETS,
});
