import portraitUrl from "./assets/portrait.png?url";
import { createChampionAssets } from "../assets";
import { MADARA_CHARACTER_ID } from "./definition";

export const MADARA_ASSETS = createChampionAssets(
  portraitUrl,
  { width: 160, height: 160 },
  import.meta.glob("./assets/animations/*.png", {
    eager: true,
    import: "default",
    query: "?url",
  }) as Record<string, string>,
);

export const CHAMPION_ASSET_ENTRY = Object.freeze({
  characterId: MADARA_CHARACTER_ID,
  assets: MADARA_ASSETS,
});
