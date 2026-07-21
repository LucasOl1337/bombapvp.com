import portraitUrl from "./assets/portrait.png?url";
import { createChampionAssets } from "../assets";
import { KATARINA_CHARACTER_ID } from "./definition";

/** Dense high-res pack: 160px final cells for sharper arena read. */
export const KATARINA_ASSETS = createChampionAssets(
  portraitUrl,
  { width: 160, height: 160 },
  import.meta.glob("./assets/animations/*.png", {
    eager: true,
    import: "default",
    query: "?url",
  }) as Record<string, string>,
);

export const CHAMPION_ASSET_ENTRY = Object.freeze({
  characterId: KATARINA_CHARACTER_ID,
  assets: KATARINA_ASSETS,
});
