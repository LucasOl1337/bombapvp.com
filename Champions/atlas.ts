/**
 * Champion atlas runtime.
 *
 * Each champion ships one WebP atlas plus a JSON manifest built offline by
 * `GameMechanics/scripts/build-champion-atlas.ts`. Two costs disappear versus
 * the previous one-PNG-per-frame pipeline:
 *
 * - Hundreds of image requests collapse to one per champion.
 * - Opaque bounds arrive precomputed, so the renderer no longer runs
 *   `getImageData` per sprite to trim transparent padding at runtime.
 *
 * Frames stay addressable as plain strings ("atlas:<slug>:<key>") so every
 * existing consumer that passes `readonly string[]` around keeps working; only
 * the draw site resolves a reference into an atlas region.
 */

export type AtlasFrameRegion = Readonly<{
  x: number;
  y: number;
  w: number;
  h: number;
  /** Distance the trimmed content sits from the authored frame origin. */
  offsetX: number;
  offsetY: number;
  /** Authored frame box, before trimming. */
  sourceW: number;
  sourceH: number;
}>;

export type ChampionAtlasManifest = Readonly<{
  slug: string;
  atlas: string;
  atlasWidth: number;
  atlasHeight: number;
  frameCount: number;
  /**
   * Median opaque bounds of the idle frames. Supersedes the hand-tuned
   * ARENA_OPTICAL_SCALE constants: how much of the authored cell a champion
   * actually fills is measured, not guessed.
   */
  footprint: Readonly<{
    width: number;
    height: number;
    sourceWidth: number;
    sourceHeight: number;
  }>;
  counts: Readonly<Record<string, number>>;
  frames: Readonly<Record<string, AtlasFrameRegion>>;
}>;

const REFERENCE_PREFIX = "atlas:";

/** Build the opaque frame reference consumers pass around as a string. */
export function atlasFrameReference(slug: string, frameKey: string): string {
  return `${REFERENCE_PREFIX}${slug}:${frameKey}`;
}

export function isAtlasFrameReference(value: string): boolean {
  return value.startsWith(REFERENCE_PREFIX);
}

type ParsedReference = Readonly<{ slug: string; frameKey: string }>;

function parseReference(reference: string): ParsedReference | null {
  if (!isAtlasFrameReference(reference)) return null;
  const rest = reference.slice(REFERENCE_PREFIX.length);
  const separator = rest.indexOf(":");
  if (separator <= 0) return null;
  return { slug: rest.slice(0, separator), frameKey: rest.slice(separator + 1) };
}

const manifestModules = import.meta.glob("./*/assets/atlas.json", {
  eager: true,
  import: "default",
}) as Record<string, ChampionAtlasManifest>;

// Atlas bitmaps stay lazy (`?url` only) so selecting one champion does not pull
// the artwork for the rest of the roster.
const atlasUrlModules = import.meta.glob("./*/assets/atlas.webp", {
  eager: true,
  import: "default",
  query: "?url",
}) as Record<string, string>;

function slugFromPath(modulePath: string): string {
  const match = /^\.\/([^/]+)\/assets\//.exec(modulePath);
  if (!match?.[1]) throw new Error(`Unexpected champion atlas path: ${modulePath}`);
  return match[1];
}

const MANIFESTS = new Map<string, ChampionAtlasManifest>();
for (const [modulePath, manifest] of Object.entries(manifestModules)) {
  MANIFESTS.set(slugFromPath(modulePath), manifest);
}

const ATLAS_URLS = new Map<string, string>();
for (const [modulePath, url] of Object.entries(atlasUrlModules)) {
  ATLAS_URLS.set(slugFromPath(modulePath), url);
}

export function getChampionAtlasManifest(slug: string): ChampionAtlasManifest | undefined {
  return MANIFESTS.get(slug);
}

export function getChampionAtlasUrl(slug: string): string | undefined {
  return ATLAS_URLS.get(slug);
}

export function listAtlasChampionSlugs(): readonly string[] {
  return Object.freeze([...MANIFESTS.keys()].sort());
}

/**
 * Frame keys for one action/facing run, in authored order.
 * Returns an empty array when the champion has no frames for that pair, which
 * callers already treat as "animation unavailable".
 */
export function atlasFrameReferences(
  slug: string,
  action: string,
  facing: string,
): readonly string[] {
  const manifest = MANIFESTS.get(slug);
  if (!manifest) return [];
  const total = manifest.counts[`${action}-${facing}`] ?? 0;
  const references: string[] = [];
  for (let index = 0; index < total; index += 1) {
    references.push(atlasFrameReference(slug, `${action}-${facing}-${index}`));
  }
  return Object.freeze(references);
}

export function atlasStaticReference(slug: string, facing: string): string | undefined {
  const manifest = MANIFESTS.get(slug);
  if (!manifest?.frames[`static-${facing}`]) return undefined;
  return atlasFrameReference(slug, `static-${facing}`);
}

export type ResolvedAtlasFrame = Readonly<{
  slug: string;
  url: string;
  region: AtlasFrameRegion;
}>;

/** Resolve a reference into the atlas URL plus source rect for `drawImage`. */
export function resolveAtlasFrame(reference: string): ResolvedAtlasFrame | null {
  const parsed = parseReference(reference);
  if (!parsed) return null;
  const manifest = MANIFESTS.get(parsed.slug);
  const url = ATLAS_URLS.get(parsed.slug);
  if (!manifest || !url) return null;
  const region = manifest.frames[parsed.frameKey];
  if (!region) return null;
  return { slug: parsed.slug, url, region };
}

/**
 * Body fill of a classic padded pack (Ranni/Killer Bee sit at or below this).
 * Packs filling more of the cell get scaled down toward the same optical size.
 * Both constants are fitted against the previously hand-tuned per-champion
 * values, reproducing all five within 0.02.
 */
const OPTICAL_REFERENCE_FILL = 0.501;
const OPTICAL_MIN_SCALE = 0.8;

/**
 * Optical arena scale derived from measured artwork.
 *
 * Packs differ in how much of the authored cell the character body fills, so
 * drawing every champion at the same height makes dense packs read oversized.
 * The ratio is now measured from the idle footprint instead of carried as a
 * per-champion constant. Presentation only — hitboxes are kernel-side.
 */
export function championOpticalScale(slug: string): number {
  const manifest = MANIFESTS.get(slug);
  if (!manifest) return 1;
  const { height, sourceHeight } = manifest.footprint;
  if (height <= 0 || sourceHeight <= 0) return 1;
  const fill = height / sourceHeight;
  if (fill <= OPTICAL_REFERENCE_FILL) return 1;
  // Floor keeps an unusually dense pack from shrinking into the floor tiles.
  return Math.max(OPTICAL_MIN_SCALE, Math.min(1, OPTICAL_REFERENCE_FILL / fill));
}
