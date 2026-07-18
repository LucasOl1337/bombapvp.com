import portraitUrl from "./assets/portrait.png?url";
import { createChampionAssets } from "../assets";
import { CROCODILO_CHARACTER_ID } from "./definition";
export const CROCODILO_ASSETS = createChampionAssets(
  portraitUrl,
  { width: 156, height: 156 },
  import.meta.glob("./assets/animations/*.png", {
    eager: true,
    import: "default",
    query: "?url",
  }) as Record<string, string>,
);
export const CHAMPION_ASSET_ENTRY = Object.freeze({
  characterId: CROCODILO_CHARACTER_ID,
  assets: CROCODILO_ASSETS,
});
