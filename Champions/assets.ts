/// <reference types="vite/client" />
import {
  atlasFrameReferences,
  atlasStaticReference,
  getChampionAtlasManifest,
} from "./atlas";

export const CHAMPION_DIRECTIONS = ["up", "down", "left", "right"] as const;
export const CHAMPION_ANIMATIONS = [
  "idle",
  "walk",
  "run",
  "cast",
  "attack",
  "death",
  "ultimate",
] as const;
export type ChampionDirection = (typeof CHAMPION_DIRECTIONS)[number];
export type ChampionAnimation = (typeof CHAMPION_ANIMATIONS)[number];
export type ChampionAssets = Readonly<{
  portraitUrl: string;
  size: Readonly<{ width: number; height: number }>;
  sourceFileCount: number;
  effects: Readonly<Record<string, string>>;
  staticSprites: Readonly<Record<ChampionDirection, string>>;
  animations: Readonly<
    Record<
      ChampionAnimation,
      Readonly<Record<ChampionDirection, readonly string[]>>
    >
  >;
}>;
const MAP = {
  north: "up",
  south: "down",
  west: "left",
  east: "right",
} as const;
/**
 * Build a champion's assets from its packed atlas.
 *
 * Frames are atlas references rather than per-file URLs, so a champion costs
 * one bitmap request instead of ~150. Same public shape as the PNG-glob path it
 * replaces, so consumers passing `readonly string[]` are unaffected.
 */
export function createChampionAtlasAssets(
  slug: string,
  portraitUrl: string,
  size: { width: number; height: number },
  disabledAnimations: readonly ChampionAnimation[] = [],
  effects: Readonly<Record<string, string>> = {},
): ChampionAssets {
  const manifest = getChampionAtlasManifest(slug);
  if (!manifest) {
    throw new Error(
      `Missing atlas for champion "${slug}". Run: npm run assets:champions`,
    );
  }

  const staticSprites = { up: "", down: "", left: "", right: "" };
  for (const facing of ["north", "south", "west", "east"] as const) {
    staticSprites[MAP[facing]] = atlasStaticReference(slug, facing) ?? "";
  }

  const animations = Object.fromEntries(
    CHAMPION_ANIMATIONS.map((animation) => [
      animation,
      Object.fromEntries(
        (["north", "south", "west", "east"] as const).map((facing) => [
          MAP[facing],
          disabledAnimations.includes(animation)
            ? Object.freeze([])
            : atlasFrameReferences(slug, animation, facing),
        ]),
      ),
    ]),
  ) as unknown as Record<
    ChampionAnimation,
    Record<ChampionDirection, readonly string[]>
  >;

  return Object.freeze({
    portraitUrl,
    size: Object.freeze(size),
    sourceFileCount: manifest.frameCount,
    effects: Object.freeze({ ...effects }),
    staticSprites: Object.freeze(staticSprites),
    animations: Object.freeze(animations),
  });
}

export function createChampionAssets(
  portraitUrl: string,
  size: { width: number; height: number },
  modules: Record<string, string>,
  disabledAnimations: readonly ChampionAnimation[] = [],
  effects: Readonly<Record<string, string>> = {},
): ChampionAssets {
  const staticSprites = { up: "", down: "", left: "", right: "" };
  const animations = Object.fromEntries(
    CHAMPION_ANIMATIONS.map((n) => [
      n,
      { up: [], down: [], left: [], right: [] },
    ]),
  ) as unknown as Record<
    ChampionAnimation,
    Record<ChampionDirection, string[]>
  >;
  const pending: Array<{
    animation: ChampionAnimation;
    direction: ChampionDirection;
    index: number;
    url: string;
  }> = [];
  for (const [path, url] of Object.entries(modules)) {
    const f = path.split("/").at(-1) ?? "";
    const s = /^(north|south|west|east)\.png$/.exec(f);
    if (s) {
      staticSprites[MAP[s[1] as keyof typeof MAP]] = url;
      continue;
    }
    const m =
      /^(idle|walk|run|cast|attack|death|ultimate)-(north|south|west|east)-(\d+)\.png$/.exec(
        f,
      );
    if (m && !disabledAnimations.includes(m[1] as ChampionAnimation)) {
      pending.push({
        animation: m[1] as ChampionAnimation,
        direction: MAP[m[2] as keyof typeof MAP],
        index: Number(m[3]),
        url,
      });
    }
  }
  // Sort by source filename index (not hashed URL) so walk/idle cycles play in order.
  pending.sort((a, b) => a.index - b.index);
  for (const item of pending) {
    animations[item.animation][item.direction].push(item.url);
  }
  return Object.freeze({
    portraitUrl,
    size: Object.freeze(size),
    sourceFileCount: Object.keys(modules).length,
    effects: Object.freeze({ ...effects }),
    staticSprites: Object.freeze(staticSprites),
    animations: Object.freeze(animations),
  });
}
