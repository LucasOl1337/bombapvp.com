import portraitUrl from "./assets/portrait.png?url";
import grimoireUrl from "./assets/effects/nico-grimoire.png?url";
import { createChampionAssets } from "../assets";
import { NICO_CHARACTER_ID } from "./definition";
export const NICO_ASSETS = createChampionAssets(
  portraitUrl,
  { width: 116, height: 116 },
  import.meta.glob("./assets/animations/*.png", {
    eager: true,
    import: "default",
    query: "?url",
  }) as Record<string, string>,
  ["attack"],
  { grimoire: grimoireUrl },
);
export const CHAMPION_ASSET_ENTRY = Object.freeze({
  characterId: NICO_CHARACTER_ID,
  assets: NICO_ASSETS,
});
