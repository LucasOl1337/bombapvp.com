import portraitUrl from "./assets/portrait.png?url";
import { createChampionAssets } from "../assets";
export const RANNI_ASSETS = createChampionAssets(
  portraitUrl,
  { width: 160, height: 160 },
  import.meta.glob("./assets/animations/*.png", {
    eager: true,
    import: "default",
    query: "?url",
  }) as Record<string, string>,
);
