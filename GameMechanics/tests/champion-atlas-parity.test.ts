/**
 * Guards the offline atlas pipeline against silent asset loss.
 *
 * The atlas is a generated artifact: nothing at runtime re-reads the source
 * PNGs, so a dropped frame or a stale manifest would surface only as a visual
 * glitch in one direction of one animation. These assertions compare the
 * committed manifests back against the authored frames on disk.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const CHAMPIONS_ROOT = join(process.cwd(), "Champions");
const ACTIONS = ["idle", "walk", "run", "cast", "attack", "death", "ultimate"] as const;
const FACINGS = ["north", "south", "west", "east"] as const;

type AtlasFrame = Readonly<{
  x: number;
  y: number;
  w: number;
  h: number;
  offsetX: number;
  offsetY: number;
  sourceW: number;
  sourceH: number;
}>;

type AtlasManifest = Readonly<{
  slug: string;
  atlas: string;
  atlasWidth: number;
  atlasHeight: number;
  frameCount: number;
  footprint: Readonly<{
    width: number;
    height: number;
    sourceWidth: number;
    sourceHeight: number;
  }>;
  counts: Readonly<Record<string, number>>;
  frames: Readonly<Record<string, AtlasFrame>>;
}>;

/** Champion directories are the source of truth for who must have an atlas. */
function listChampionSlugs(): string[] {
  return readdirSync(CHAMPIONS_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("_"))
    .map((entry) => entry.name)
    .filter((slug) => {
      try {
        return statSync(join(CHAMPIONS_ROOT, slug, "assets", "animations")).isDirectory();
      } catch {
        return false;
      }
    })
    .sort();
}

function readManifest(slug: string): AtlasManifest {
  return JSON.parse(
    readFileSync(join(CHAMPIONS_ROOT, slug, "assets", "atlas.json"), "utf8"),
  ) as AtlasManifest;
}

function sourceFrameNames(slug: string): string[] {
  return readdirSync(join(CHAMPIONS_ROOT, slug, "assets", "animations")).filter((file) =>
    file.endsWith(".png"),
  );
}

const SLUGS = listChampionSlugs();

describe("champion atlas parity", () => {
  it("discovers the champion roster on disk", () => {
    expect(SLUGS.length).toBeGreaterThan(0);
  });

  for (const slug of SLUGS) {
    describe(slug, () => {
      const manifest = readManifest(slug);
      const sources = sourceFrameNames(slug);

      it("ships an atlas bitmap next to its manifest", () => {
        expect(manifest.slug).toBe(slug);
        expect(manifest.atlas).toBe("atlas.webp");
        const bitmap = statSync(join(CHAMPIONS_ROOT, slug, "assets", "atlas.webp"));
        expect(bitmap.isFile()).toBe(true);
        expect(bitmap.size).toBeGreaterThan(0);
      });

      it("packs every authored frame exactly once", () => {
        // Every source PNG must have a manifest entry, and vice versa — a
        // one-directional check would miss both loss and staleness.
        const expectedKeys = sources
          .map((file) => {
            const animated =
              /^(idle|walk|run|cast|attack|death|ultimate)-(north|south|west|east)-(\d+)\.png$/.exec(
                file,
              );
            if (animated) return `${animated[1]}-${animated[2]}-${animated[3]}`;
            const still = /^(north|south|west|east)\.png$/.exec(file);
            return still ? `static-${still[1]}` : null;
          })
          .filter((key): key is string => key !== null)
          .sort();

        expect(Object.keys(manifest.frames).sort()).toEqual(expectedKeys);
        expect(manifest.frameCount).toBe(expectedKeys.length);
      });

      it("reports per action-facing counts that match the source files", () => {
        for (const action of ACTIONS) {
          for (const facing of FACINGS) {
            const prefix = `${action}-${facing}-`;
            const onDisk = sources.filter((file) => file.startsWith(prefix)).length;
            expect(manifest.counts[`${action}-${facing}`] ?? 0).toBe(onDisk);
          }
        }
      });

      it("keeps every frame region inside the atlas bounds", () => {
        for (const [key, frame] of Object.entries(manifest.frames)) {
          expect(frame.w, `${key} width`).toBeGreaterThan(0);
          expect(frame.h, `${key} height`).toBeGreaterThan(0);
          expect(frame.x, `${key} x`).toBeGreaterThanOrEqual(0);
          expect(frame.y, `${key} y`).toBeGreaterThanOrEqual(0);
          expect(frame.x + frame.w, `${key} right edge`).toBeLessThanOrEqual(
            manifest.atlasWidth,
          );
          expect(frame.y + frame.h, `${key} bottom edge`).toBeLessThanOrEqual(
            manifest.atlasHeight,
          );
        }
      });

      it("keeps trimmed content within its original source frame", () => {
        // offsetX/offsetY restore pre-trim alignment; if the trimmed box escaped
        // the source box the sprite would drift on screen.
        for (const [key, frame] of Object.entries(manifest.frames)) {
          expect(frame.offsetX, `${key} offsetX`).toBeGreaterThanOrEqual(0);
          expect(frame.offsetY, `${key} offsetY`).toBeGreaterThanOrEqual(0);
          expect(frame.offsetX + frame.w, `${key} trimmed right`).toBeLessThanOrEqual(
            frame.sourceW,
          );
          expect(frame.offsetY + frame.h, `${key} trimmed bottom`).toBeLessThanOrEqual(
            frame.sourceH,
          );
        }
      });

      it("derives a usable optical footprint", () => {
        const { width, height, sourceWidth, sourceHeight } = manifest.footprint;
        expect(width).toBeGreaterThan(0);
        expect(height).toBeGreaterThan(0);
        expect(width).toBeLessThanOrEqual(sourceWidth);
        expect(height).toBeLessThanOrEqual(sourceHeight);
      });

      it("has no overlapping frame regions", () => {
        // Overlap means one frame's pixels bleed into another's draw call.
        const frames = Object.entries(manifest.frames);
        for (let i = 0; i < frames.length; i += 1) {
          for (let j = i + 1; j < frames.length; j += 1) {
            const [keyA, a] = frames[i]!;
            const [keyB, b] = frames[j]!;
            const disjoint =
              a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;
            expect(disjoint, `${keyA} overlaps ${keyB}`).toBe(true);
          }
        }
      });
    });
  }
});
