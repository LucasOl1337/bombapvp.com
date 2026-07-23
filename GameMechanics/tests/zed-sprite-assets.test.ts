import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";

const ANIMATION_ROOT = join(
  process.cwd(),
  "Champions",
  "zed",
  "assets",
  "animations",
);
const ACTIONS = ["idle", "walk", "run", "cast", "attack", "death"] as const;
const DIRECTIONS = ["north", "south", "east", "west"] as const;
const FRAME_COUNTS = { idle: 6, walk: 8, run: 8, cast: 8, attack: 8, death: 8 } as const;
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

type DecodedPng = Readonly<{ width: number; height: number; rgba: Buffer }>;

function paeth(left: number, above: number, upperLeft: number): number {
  const estimate = left + above - upperLeft;
  const leftDistance = Math.abs(estimate - left);
  const aboveDistance = Math.abs(estimate - above);
  const upperLeftDistance = Math.abs(estimate - upperLeft);
  if (leftDistance <= aboveDistance && leftDistance <= upperLeftDistance) return left;
  return aboveDistance <= upperLeftDistance ? above : upperLeft;
}

function decodeRgbaPng(path: string): DecodedPng {
  const encoded = readFileSync(path);
  expect(encoded.subarray(0, 8), path).toEqual(PNG_SIGNATURE);

  let width = 0;
  let height = 0;
  const compressed: Buffer[] = [];
  for (let offset = 8; offset < encoded.length; ) {
    const length = encoded.readUInt32BE(offset);
    const type = encoded.toString("ascii", offset + 4, offset + 8);
    const data = encoded.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      expect(data[8], `${path}: bit depth`).toBe(8);
      expect(data[9], `${path}: color type`).toBe(6);
      expect(data[12], `${path}: interlace`).toBe(0);
    } else if (type === "IDAT") {
      compressed.push(data);
    }
    offset += length + 12;
  }

  const scanlines = inflateSync(Buffer.concat(compressed));
  const stride = width * 4;
  const rgba = Buffer.alloc(stride * height);
  let sourceOffset = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = scanlines[sourceOffset++];
    if (filter === undefined || filter > 4) {
      throw new Error(`${path}: unsupported PNG filter ${filter}`);
    }
    for (let x = 0; x < stride; x += 1) {
      const raw = scanlines[sourceOffset++];
      const outputOffset = y * stride + x;
      const left = x >= 4 ? rgba[outputOffset - 4]! : 0;
      const above = y > 0 ? rgba[outputOffset - stride]! : 0;
      const upperLeft = x >= 4 && y > 0 ? rgba[outputOffset - stride - 4]! : 0;
      const predictor =
        filter === 0
          ? 0
          : filter === 1
            ? left
            : filter === 2
              ? above
              : filter === 3
                ? Math.floor((left + above) / 2)
                : paeth(left, above, upperLeft);
      rgba[outputOffset] = (raw! + predictor) & 0xff;
    }
  }
  return { width, height, rgba };
}

function opaqueComponents(image: DecodedPng): readonly number[] {
  const { width, height, rgba } = image;
  const occupied = new Uint8Array(width * height);
  for (let index = 0; index < width * height; index += 1) {
    occupied[index] = rgba[index * 4 + 3]! > 24 ? 1 : 0;
  }

  const seen = new Uint8Array(occupied.length);
  const components: number[] = [];
  for (let start = 0; start < occupied.length; start += 1) {
    if (!occupied[start] || seen[start]) continue;
    let size = 0;
    const pending = [start];
    seen[start] = 1;
    while (pending.length > 0) {
      const current = pending.pop()!;
      size += 1;
      const x = current % width;
      const y = Math.floor(current / width);
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const nextX = x + dx;
          const nextY = y + dy;
          if (nextX < 0 || nextX >= width || nextY < 0 || nextY >= height) continue;
          const next = nextY * width + nextX;
          if (occupied[next] && !seen[next]) {
            seen[next] = 1;
            pending.push(next);
          }
        }
      }
    }
    components.push(size);
  }
  return components.sort((left, right) => right - left);
}

describe("Zed sprite asset QA", () => {
  it("ships complete transparent single-pose directional frames", () => {
    const expected = new Set<string>(DIRECTIONS.map((direction) => `${direction}.png`));
    for (const action of ACTIONS) {
      for (const direction of DIRECTIONS) {
        for (let index = 0; index < FRAME_COUNTS[action]; index += 1) {
          expected.add(`${action}-${direction}-${index}.png`);
        }
      }
    }
    expect(new Set(readdirSync(ANIMATION_ROOT))).toEqual(expected);

    for (const file of expected) {
      const image = decodeRgbaPng(join(ANIMATION_ROOT, file));
      expect([image.width, image.height], file).toEqual([160, 160]);

      let opaquePixels = 0;
      let magentaPixels = 0;
      let minX = image.width;
      let minY = image.height;
      let maxX = -1;
      let maxY = -1;
      for (let pixel = 0; pixel < image.width * image.height; pixel += 1) {
        const offset = pixel * 4;
        const red = image.rgba[offset]!;
        const green = image.rgba[offset + 1]!;
        const blue = image.rgba[offset + 2]!;
        const alpha = image.rgba[offset + 3]!;
        if (alpha <= 24) continue;
        opaquePixels += 1;
        const x = pixel % image.width;
        const y = Math.floor(pixel / image.width);
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
        if (red >= 150 && red - green >= 60 && blue - green >= 20) magentaPixels += 1;
      }

      expect(opaquePixels, `${file}: empty frame`).toBeGreaterThan(500);
      expect(opaquePixels, `${file}: oversized opaque bounds`).toBeLessThan(8_500);
      expect(maxX - minX + 1, `${file}: implausible content width`).toBeLessThan(145);
      expect(maxY - minY + 1, `${file}: implausible content height`).toBeLessThan(155);
      expect(magentaPixels / opaquePixels, `${file}: magenta source plate`).toBeLessThan(0.02);

      const components = opaqueComponents(image);
      expect(components[0], `${file}: missing primary pose`).toBeGreaterThan(500);
      expect(components[1] ?? 0, `${file}: multiple character poses`).toBeLessThan(
        components[0]! * 0.18,
      );
    }
  });

  it("requires perceptible motion energy on locomotion and cast families", () => {
    // Calibrated against shipped Killer Bee: distinct limb phases without multi-pose sheets.
    // Mean consecutive opaque-sample channel delta must clear a readable floor.
    const sequences: ReadonlyArray<{
      action: (typeof ACTIONS)[number];
      direction: (typeof DIRECTIONS)[number];
      minMeanDelta: number;
      minUnique: number;
    }> = [
      { action: "walk", direction: "south", minMeanDelta: 18, minUnique: 4 },
      { action: "run", direction: "south", minMeanDelta: 18, minUnique: 4 },
      { action: "cast", direction: "south", minMeanDelta: 16, minUnique: 3 },
      { action: "attack", direction: "south", minMeanDelta: 16, minUnique: 3 },
      { action: "walk", direction: "east", minMeanDelta: 16, minUnique: 3 },
      { action: "cast", direction: "east", minMeanDelta: 16, minUnique: 3 },
      { action: "walk", direction: "west", minMeanDelta: 16, minUnique: 3 },
      { action: "walk", direction: "north", minMeanDelta: 12, minUnique: 3 },
    ];

    for (const { action, direction, minMeanDelta, minUnique } of sequences) {
      const count = FRAME_COUNTS[action];
      const frames: DecodedPng[] = [];
      const hashes = new Set<string>();
      for (let index = 0; index < count; index += 1) {
        const path = join(ANIMATION_ROOT, `${action}-${direction}-${index}.png`);
        const encoded = readFileSync(path);
        hashes.add(encoded.toString("hex", 0, Math.min(encoded.length, 64)) + String(encoded.length));
        frames.push(decodeRgbaPng(path));
      }
      expect(hashes.size, `${action}-${direction} unique frames`).toBeGreaterThanOrEqual(minUnique);

      const deltas: number[] = [];
      for (let index = 0; index < frames.length - 1; index += 1) {
        const left = frames[index]!;
        const right = frames[index + 1]!;
        let sum = 0;
        let samples = 0;
        const pixels = left.width * left.height;
        for (let pixel = 0; pixel < pixels; pixel += 1) {
          const offset = pixel * 4;
          const leftAlpha = left.rgba[offset + 3]!;
          const rightAlpha = right.rgba[offset + 3]!;
          if (leftAlpha <= 24 && rightAlpha <= 24) continue;
          samples += 1;
          sum +=
            (Math.abs(left.rgba[offset]! - right.rgba[offset]!) +
              Math.abs(left.rgba[offset + 1]! - right.rgba[offset + 1]!) +
              Math.abs(left.rgba[offset + 2]! - right.rgba[offset + 2]!) +
              Math.abs(leftAlpha - rightAlpha)) /
            4;
        }
        deltas.push(samples === 0 ? 0 : sum / samples);
      }
      const meanDelta = deltas.reduce((a, b) => a + b, 0) / Math.max(1, deltas.length);
      expect(meanDelta, `${action}-${direction} motion energy`).toBeGreaterThanOrEqual(minMeanDelta);
    }

    // Killer Bee remains a motion floor reference and must still look animated.
    const kbRoot = join(process.cwd(), "Champions", "killer-bee", "assets", "animations");
    const kbFrames: DecodedPng[] = [];
    for (let index = 0; index < 8; index += 1) {
      kbFrames.push(decodeRgbaPng(join(kbRoot, `run-south-${index}.png`)));
    }
    let kbSum = 0;
    let kbPairs = 0;
    for (let index = 0; index < kbFrames.length - 1; index += 1) {
      const left = kbFrames[index]!;
      const right = kbFrames[index + 1]!;
      let sum = 0;
      let samples = 0;
      const pixels = left.width * left.height;
      for (let pixel = 0; pixel < pixels; pixel += 1) {
        const offset = pixel * 4;
        if (left.rgba[offset + 3]! <= 24 && right.rgba[offset + 3]! <= 24) continue;
        samples += 1;
        sum +=
          (Math.abs(left.rgba[offset]! - right.rgba[offset]!) +
            Math.abs(left.rgba[offset + 1]! - right.rgba[offset + 1]!) +
            Math.abs(left.rgba[offset + 2]! - right.rgba[offset + 2]!) +
            Math.abs(left.rgba[offset + 3]! - right.rgba[offset + 3]!)) /
          4;
      }
      if (samples > 0) {
        kbSum += sum / samples;
        kbPairs += 1;
      }
    }
    expect(kbSum / Math.max(1, kbPairs)).toBeGreaterThan(20);
  });
});
