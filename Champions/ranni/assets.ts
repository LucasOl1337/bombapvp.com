import portraitUrl from "./assets/portrait.png?url";
import spiritWispStripUrl from "./assets/animations/spirit-wisp-strip.png?url";
import { createChampionAtlasAssets } from "../assets";
import { RANNI_CHARACTER_ID } from "./definition";

export const RANNI_ASSETS = createChampionAtlasAssets(
  "ranni",
  portraitUrl,
  { width: 160, height: 160 },
  [],
  { "spirit-wisp": spiritWispStripUrl },
);

export const CHAMPION_ASSET_ENTRY = Object.freeze({
  characterId: RANNI_CHARACTER_ID,
  assets: RANNI_ASSETS,
});
