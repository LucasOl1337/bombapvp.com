import portraitUrl from "./assets/portrait.png?url";
import { createChampionAssets } from "../assets";
import { THRESH_CHARACTER_ID } from "./definition";

/** Dense high-res pack: 160px final cells for sharper arena read. */
export const THRESH_ASSETS = createChampionAssets(
  portraitUrl,
  { width: 160, height: 160 },
  import.meta.glob("./assets/animations/*.png", {
    eager: true,
    import: "default",
    query: "?url",
  }) as Record<string, string>,
);

export const CHAMPION_ASSET_ENTRY = Object.freeze({
  characterId: THRESH_CHARACTER_ID,
  assets: THRESH_ASSETS,
});
