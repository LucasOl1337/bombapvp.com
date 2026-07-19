/**
 * Launcher-safe marketing assets only.
 * Do not import `./catalog` from here — that would pull the full arena bundle into the home page.
 */
import citadelBreachKeyArtUrl from "./marketing/citadel-breach-key-art-v1-20260718-1517.png?url";
import citadelBreachLauncherBannerUrl from "./marketing/citadel-breach-launcher-banner-v1-20260718-1726.png?url";

export type MarketingVisual = Readonly<{
  id: string;
  url: string;
}>;

function visual(id: string, url: string): MarketingVisual {
  return Object.freeze({ id, url });
}

/** Citadel Breach marketing surfaces for the launcher home. */
export const CITADEL_BREACH_MARKETING = Object.freeze({
  banner: visual(
    "marketing.citadel-breach.launcher-banner",
    citadelBreachLauncherBannerUrl,
  ),
  keyArt: visual(
    "marketing.citadel-breach.key-art",
    citadelBreachKeyArtUrl,
  ),
});
