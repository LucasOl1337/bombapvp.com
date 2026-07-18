import portraitUrl from "./assets/portrait.png?url";
import { createChampionAssets } from "../assets";

export const PENDULA_ASSETS = createChampionAssets(
  portraitUrl,
  { width: 124, height: 124 },
  import.meta.glob("./assets/animations/*.png", {
    eager: true,
    import: "default",
    query: "?url",
  }) as Record<string, string>,
);
