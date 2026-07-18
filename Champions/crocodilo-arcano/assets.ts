import portraitUrl from "./assets/portrait.png?url";
import { createChampionAssets } from "../assets";
export const CROCODILO_ASSETS = createChampionAssets(
  portraitUrl,
  { width: 156, height: 156 },
  import.meta.glob("./assets/animations/*.png", {
    eager: true,
    import: "default",
    query: "?url",
  }) as Record<string, string>,
);
