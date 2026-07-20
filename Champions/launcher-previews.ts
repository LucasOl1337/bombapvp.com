/// <reference types="vite/client" />
/**
 * Launcher-only south-facing preview clips.
 * Intentionally NOT the full assets-catalog — keeps the home page lean.
 */
import {
  CHAMPION_MEMBERSHIP,
  type CharacterId,
  type ChampionSlug,
  listChampionMembership,
} from "./membership";

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
  nico: Object.freeze({ scale: 1.47, offsetXPercent: 0, offsetYPercent: 4 }),
  "nix-ember": Object.freeze({ scale: 0.82, offsetXPercent: 0, offsetYPercent: 1 }),
  pendula: Object.freeze({ scale: 0.74, offsetXPercent: 0, offsetYPercent: -1 }),
  mirelle: Object.freeze({ scale: 0.85, offsetXPercent: 0, offsetYPercent: 1 }),
  "lee-sin": Object.freeze({ scale: 0.86, offsetXPercent: 0, offsetYPercent: -1 }),
};

// Vite requires static glob strings (no runtime template interpolation).
const IDLE_MODULES = import.meta.glob("./*/assets/animations/idle-south-*.png", {
  eager: true,
  import: "default",
  query: "?url",
}) as Record<string, string>;
const WALK_MODULES = import.meta.glob("./*/assets/animations/walk-south-*.png", {
  eager: true,
  import: "default",
  query: "?url",
}) as Record<string, string>;
const RUN_MODULES = import.meta.glob("./*/assets/animations/run-south-*.png", {
  eager: true,
  import: "default",
  query: "?url",
}) as Record<string, string>;
const CAST_MODULES = import.meta.glob("./*/assets/animations/cast-south-*.png", {
  eager: true,
  import: "default",
  query: "?url",
}) as Record<string, string>;
const ATTACK_MODULES = import.meta.glob("./*/assets/animations/attack-south-*.png", {
  eager: true,
  import: "default",
  query: "?url",
}) as Record<string, string>;

const MODULES_BY_CLIP: Record<LauncherClipName, Record<string, string>> = {
  idle: IDLE_MODULES,
  walk: WALK_MODULES,
  run: RUN_MODULES,
  cast: CAST_MODULES,
  attack: ATTACK_MODULES,
};

function framesFromModules(
  modules: Record<string, string>,
  kind: LauncherClipName,
): Map<ChampionSlug, string[]> {
  const bySlug = new Map<ChampionSlug, Array<{ index: number; url: string }>>();
  const pattern = new RegExp(
    `^\\./([^/]+)/assets/animations/${kind}-south-(\\d+)\\.png$`,
  );

  for (const [path, url] of Object.entries(modules)) {
    const match = pattern.exec(path.replaceAll("\\", "/"));
    if (!match) continue;
    const slug = match[1];
    if (!slug || !(slug in CHAMPION_MEMBERSHIP)) continue;
    const list = bySlug.get(slug as ChampionSlug) ?? [];
    list.push({ index: Number(match[2]), url });
    bySlug.set(slug as ChampionSlug, list);
  }

  const sorted = new Map<ChampionSlug, string[]>();
  for (const [slug, frames] of bySlug) {
    frames.sort((a, b) => a.index - b.index);
    sorted.set(
      slug,
      frames.map((frame) => frame.url),
    );
  }
  return sorted;
}

const FRAMES_BY_CLIP = {
  idle: framesFromModules(MODULES_BY_CLIP.idle, "idle"),
  walk: framesFromModules(MODULES_BY_CLIP.walk, "walk"),
  run: framesFromModules(MODULES_BY_CLIP.run, "run"),
  cast: framesFromModules(MODULES_BY_CLIP.cast, "cast"),
  attack: framesFromModules(MODULES_BY_CLIP.attack, "attack"),
} as const;

/** Preferred showreel order: presence → movement → action. */
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
      const frames = FRAMES_BY_CLIP[name].get(slug) ?? [];
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
