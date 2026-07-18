import portraitUrl from "./assets/portrait.png?url";
import { createChampionAssets } from "../assets";
import { AEGIS_CHARACTER_ID } from "./definition";

export const AEGIS_ASSETS = createChampionAssets(
  portraitUrl,
  { width: 124, height: 124 },
  import.meta.glob("./assets/animations/*.png", {
    eager: true,
    import: "default",
    query: "?url",
  }) as Record<string, string>,
);
export const CHAMPION_ASSET_ENTRY = Object.freeze({
  characterId: AEGIS_CHARACTER_ID,
  assets: AEGIS_ASSETS,
});
