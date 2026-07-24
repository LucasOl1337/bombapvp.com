/**
 * Offline champion atlas builder.
 *
 * Packs the per-frame PNGs under `Champions/<slug>/assets/animations/` into a
 * single WebP atlas plus a JSON manifest. Two runtime costs disappear as a
 * result: the hundreds of individual image requests, and the `getImageData`
 * trim probe the browser used to run per sprite (bounds are precomputed here).
 *
 * Determinism is a hard requirement — the same source frames must always yield
 * byte-identical output, otherwise every run pollutes the diff. Inputs are
 * therefore sorted, and packing is a pure function of the sorted order.
 *
 * Usage: node --experimental-strip-types GameMechanics/scripts/build-champion-atlas.ts [slug...]
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const CHAMPIONS_DIR = path.join(REPO_ROOT, "Champions");

/** Mirrors CHAMPION_ANIMATIONS in Champions/assets.ts. */
const ACTIONS = ["idle", "walk", "run", "cast", "attack", "death", "ultimate"] as const;
const FACINGS = ["north", "south", "west", "east"] as const;

type Action = (typeof ACTIONS)[number];
type Facing = (typeof FACINGS)[number];

const FRAME_PATTERN = new RegExp(
  `^(${ACTIONS.join("|")})-(${FACINGS.join("|")})-(\\d+)\\.png$`,
);
const STATIC_PATTERN = new RegExp(`^(${FACINGS.join("|")})\\.png$`);

/** WebP tops out at 16383px per side; stay well under while keeping rows short. */
const MAX_ATLAS_WIDTH = 2048;
/** Alpha at or below this is transparent for trimming purposes. */
const ALPHA_THRESHOLD = 1;

type SourceFrame = Readonly<{
  /** Sort key — also the manifest key. `static-<facing>` for idle statics. */
  key: string;
  file: string;
  action: Action | "static";
  facing: Facing;
  index: number;
}>;

type TrimmedFrame = Readonly<{
  source: SourceFrame;
  data: Buffer;
  width: number;
  height: number;
  /** Untrimmed frame size, so the renderer can restore original alignment. */
  sourceWidth: number;
  sourceHeight: number;
  offsetX: number;
  offsetY: number;
}>;

type PlacedFrame = TrimmedFrame & Readonly<{ x: number; y: number }>;

function collectSourceFrames(files: readonly string[]): SourceFrame[] {
  const frames: SourceFrame[] = [];
  for (const file of files) {
    const animated = FRAME_PATTERN.exec(file);
    if (animated) {
      frames.push({
        key: `${animated[1]}-${animated[2]}-${animated[3]}`,
        file,
        action: animated[1] as Action,
        facing: animated[2] as Facing,
        index: Number(animated[3]),
      });
      continue;
    }
    const still = STATIC_PATTERN.exec(file);
    if (still) {
      frames.push({
        key: `static-${still[1]}`,
        file,
        action: "static",
        facing: still[1] as Facing,
        index: 0,
      });
    }
  }
  // Group each action/facing run contiguously so a playing animation reads
  // neighbouring atlas regions; ties break on numeric index, never on the
  // hashed filename, so cycles keep their authored order.
  frames.sort((left, right) => {
    if (left.action !== right.action) return left.action < right.action ? -1 : 1;
    if (left.facing !== right.facing) return left.facing < right.facing ? -1 : 1;
    return left.index - right.index;
  });
  return frames;
}

/**
 * Trim transparent padding and record how far the content moved. Roughly a
 * third of each authored frame measured as empty padding, which is pure
 * download and upload cost at runtime.
 */
async function trimFrame(filePath: string, source: SourceFrame): Promise<TrimmedFrame> {
  const original = sharp(await readFile(filePath));
  const meta = await original.metadata();
  const sourceWidth = meta.width ?? 0;
  const sourceHeight = meta.height ?? 0;

  const trimmed = await sharp(await readFile(filePath))
    .trim({ threshold: ALPHA_THRESHOLD })
    .toBuffer({ resolveWithObject: true });

  // `trimOffsetLeft/Top` are negative distances from the original origin.
  const offsetX = -(trimmed.info.trimOffsetLeft ?? 0);
  const offsetY = -(trimmed.info.trimOffsetTop ?? 0);

  return {
    source,
    data: trimmed.data,
    width: trimmed.info.width,
    height: trimmed.info.height,
    sourceWidth,
    sourceHeight,
    offsetX,
    offsetY,
  };
}

/**
 * Shelf packing: fill a row until it overflows, then start a new one. Frames
 * arrive pre-sorted by action/facing, so a row holds related frames and the
 * result is a deterministic function of that order.
 */
function packFrames(frames: readonly TrimmedFrame[]): {
  placed: PlacedFrame[];
  width: number;
  height: number;
} {
  const placed: PlacedFrame[] = [];
  let cursorX = 0;
  let cursorY = 0;
  let rowHeight = 0;
  let widest = 0;

  for (const frame of frames) {
    if (cursorX > 0 && cursorX + frame.width > MAX_ATLAS_WIDTH) {
      cursorY += rowHeight;
      cursorX = 0;
      rowHeight = 0;
    }
    placed.push({ ...frame, x: cursorX, y: cursorY });
    cursorX += frame.width;
    rowHeight = Math.max(rowHeight, frame.height);
    widest = Math.max(widest, cursorX);
  }

  return { placed, width: Math.max(1, widest), height: Math.max(1, cursorY + rowHeight) };
}

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[middle - 1]! + sorted[middle]!) / 2)
    : sorted[middle]!;
}

/**
 * Median opaque bounds of the idle frames, in source-frame units.
 *
 * This replaces ARENA_OPTICAL_SCALE, whose per-champion constants were tuned by
 * hand because packs differ in how much of the cell the character fills. The
 * renderer can now derive that ratio instead of carrying a magic number per
 * champion.
 */
function computeFootprint(frames: readonly TrimmedFrame[]): {
  width: number;
  height: number;
  sourceWidth: number;
  sourceHeight: number;
} {
  const idle = frames.filter((frame) => frame.source.action === "idle");
  const sample = idle.length > 0 ? idle : frames;
  return {
    width: median(sample.map((frame) => frame.width)),
    height: median(sample.map((frame) => frame.height)),
    sourceWidth: median(sample.map((frame) => frame.sourceWidth)),
    sourceHeight: median(sample.map((frame) => frame.sourceHeight)),
  };
}

async function buildChampion(slug: string): Promise<boolean> {
  const animationsDir = path.join(CHAMPIONS_DIR, slug, "assets", "animations");
  let entries: string[];
  try {
    entries = await readdir(animationsDir);
  } catch {
    console.warn(`  ${slug}: no animations directory, skipped.`);
    return false;
  }

  const sources = collectSourceFrames(entries.filter((file) => file.endsWith(".png")).sort());
  if (sources.length === 0) {
    console.warn(`  ${slug}: no recognisable frames, skipped.`);
    return false;
  }

  const trimmed: TrimmedFrame[] = [];
  for (const source of sources) {
    trimmed.push(await trimFrame(path.join(animationsDir, source.file), source));
  }

  const { placed, width, height } = packFrames(trimmed);

  const atlas = await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(placed.map((frame) => ({ input: frame.data, left: frame.x, top: frame.y })))
    // effort: 6 keeps encoding deterministic and reasonably fast; lossless
    // would undo most of the size win on these soft-edged sprites.
    .webp({ quality: 90, effort: 6 })
    .toBuffer();

  const frameEntries: Record<string, unknown> = {};
  for (const frame of placed) {
    frameEntries[frame.source.key] = {
      x: frame.x,
      y: frame.y,
      w: frame.width,
      h: frame.height,
      offsetX: frame.offsetX,
      offsetY: frame.offsetY,
      sourceW: frame.sourceWidth,
      sourceH: frame.sourceHeight,
    };
  }

  const counts: Record<string, number> = {};
  for (const frame of placed) {
    if (frame.source.action === "static") continue;
    const key = `${frame.source.action}-${frame.source.facing}`;
    counts[key] = (counts[key] ?? 0) + 1;
  }

  const manifest = {
    slug,
    atlas: "atlas.webp",
    atlasWidth: width,
    atlasHeight: height,
    frameCount: placed.length,
    footprint: computeFootprint(trimmed),
    /** Per action-facing frame totals; the parity test asserts against source. */
    counts: Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b))),
    frames: Object.fromEntries(
      Object.entries(frameEntries).sort(([a], [b]) => a.localeCompare(b)),
    ),
  };

  const outDir = path.join(CHAMPIONS_DIR, slug, "assets");
  await writeFile(path.join(outDir, "atlas.webp"), atlas);
  await writeFile(path.join(outDir, "atlas.json"), `${JSON.stringify(manifest, null, 2)}\n`);

  const sourceBytes = (
    await Promise.all(
      sources.map(async (source) =>
        (await readFile(path.join(animationsDir, source.file))).length,
      ),
    )
  ).reduce((total, size) => total + size, 0);

  const saved = ((1 - atlas.length / sourceBytes) * 100).toFixed(0);
  console.log(
    `  ${slug.padEnd(18)} ${String(placed.length).padStart(3)} frames  ` +
      `${(sourceBytes / 1048576).toFixed(2)} MB -> ${(atlas.length / 1048576).toFixed(2)} MB ` +
      `(${saved}% smaller, ${width}x${height})`,
  );
  return true;
}

async function discoverSlugs(): Promise<string[]> {
  const entries = await readdir(CHAMPIONS_DIR, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("_"))
    .map((entry) => entry.name)
    .sort();
}

async function main(): Promise<void> {
  const requested = process.argv.slice(2);
  const slugs = requested.length > 0 ? requested : await discoverSlugs();
  console.log(`Building champion atlases (${slugs.length}):`);
  let built = 0;
  for (const slug of slugs) {
    if (await buildChampion(slug)) built += 1;
  }
  console.log(`Done: ${built}/${slugs.length} atlases written.`);
}

await main();
