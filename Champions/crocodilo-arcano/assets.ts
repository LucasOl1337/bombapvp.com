import portraitUrl from "./assets/portrait.png?url";
import { createChampionAtlasAssets } from "../assets";
import { CROCODILO_CHARACTER_ID } from "./definition";

export const CROCODILO_ASSETS = createChampionAtlasAssets(
  "crocodilo-arcano",
  portraitUrl,
  { width: 156, height: 156 },
);

export const CHAMPION_ASSET_ENTRY = Object.freeze({
  characterId: CROCODILO_CHARACTER_ID,
  assets: CROCODILO_ASSETS,
});
