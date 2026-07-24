/// <reference types="vite/client" />
/**
 * Launcher-only south-facing preview clips.
 * Intentionally NOT the full assets-catalog — keeps the home page lean.
 */
import {
  type CharacterId,
  type ChampionSlug,
  listChampionMembership,
} from "./membership";
import { atlasFrameReferences } from "./atlas";

export type LauncherClipName = "idle" | "walk" | "run" | "cast" | "attack";

export type LauncherClip = Readonly<{
  name: LauncherClipName;
  frames: readonly string[];
}>;

/**
 * Optical presentation contract for the launcher portrait stage.
 *
 * Champion animation sheets intentionally use different canvas sizes and
 * transparent margins. Keeping this metadata beside the preview projection
 * prevents the home page from compensating for those differences with
 * character-specific CSS selectors.
 */
export type LauncherPresentation = Readonly<{
  scale: number;
  offsetXPercent: number;
  offsetYPercent: number;
}>;

export type LauncherPreview = Readonly<{
  characterId: CharacterId;
  /** Ordered showreel clips (only non-empty animations). */
  clips: readonly LauncherClip[];
  presentation: LauncherPresentation;
}>;

const DEFAULT_PRESENTATION: LauncherPresentation = Object.freeze({
  scale: 1,
  offsetXPercent: 0,
  offsetYPercent: 0,
});

/** Optically equalized from each champion's south-facing alpha bounds. */
const PRESENTATION_BY_SLUG: Partial<Record<ChampionSlug, LauncherPresentation>> = {
  ranni: Object.freeze({ scale: 1.42, offsetXPercent: 0, offsetYPercent: 3 }),
  "killer-bee": Object.freeze({ scale: 1.38, offsetXPercent: 0, offsetYPercent: 4 }),
  "crocodilo-arcano": Object.freeze({ scale: 1.3, offsetXPercent: 0, offsetYPercent: 2 }),
  thresh: Object.freeze({ scale: 0.86, offsetXPercent: 0, offsetYPercent: -1 }),
  zed: Object.freeze({ scale: 0.9, offsetXPercent: 0, offsetYPercent: 0 }),
};

/**
 * Preferred showreel order: presence → movement → action.
 *
 * Frames resolve to atlas references rather than per-PNG URLs, so the launcher
 * costs one bitmap per champion instead of ~40 eager image requests.
 */
const SHOWREEL_ORDER: readonly LauncherClipName[] = [
  "idle",
  "walk",
  "run",
  "cast",
  "attack",
];

const PREVIEWS_BY_ID = new Map<CharacterId, LauncherPreview>(
  listChampionMembership().map(({ slug, characterId }) => {
    const clips: LauncherClip[] = [];
    for (const name of SHOWREEL_ORDER) {
      const frames = atlasFrameReferences(slug, name, "south");
      if (frames.length === 0) continue;
      clips.push(Object.freeze({ name, frames: Object.freeze([...frames]) }));
    }
    return [
      characterId,
      Object.freeze({
        characterId,
        clips: Object.freeze(clips),
        presentation: PRESENTATION_BY_SLUG[slug] ?? DEFAULT_PRESENTATION,
      }) as LauncherPreview,
    ] as const;
  }),
);

export function getLauncherPreview(characterId: CharacterId): LauncherPreview | null {
  return PREVIEWS_BY_ID.get(characterId) ?? null;
}
