export type AnimationLabVisualCategory = "bomb" | "hit" | "power-up" | "arena" | "hud";

const EFFECT_SIZE_TILES: Readonly<Record<AnimationLabVisualCategory, number>> = Object.freeze({
  bomb: 1.45,
  hit: 0.9,
  "power-up": 0.8,
  arena: 1.05,
  hud: 0.7,
});

export function animationLabSizeTiles(category: AnimationLabVisualCategory): number {
  return EFFECT_SIZE_TILES[category];
}

type OpaqueFrameSize = Readonly<{
  width: number;
  height: number;
}>;

type DestinationOptions = Readonly<{
  centerX: number;
  centerY: number;
  tileSize: number;
  sizeTiles: number;
}>;

export type AnimationLabDestinationRect = Readonly<{
  x: number;
  y: number;
  width: number;
  height: number;
}>;

/** Fit the opaque part of a generated frame, not its transparent 256px cell. */
export function animationLabDestinationRect(
  frame: OpaqueFrameSize,
  options: DestinationOptions,
): AnimationLabDestinationRect {
  const width = Math.max(1, frame.width);
  const height = Math.max(1, frame.height);
  const maxSize = options.tileSize * options.sizeTiles;
  const scale = maxSize / Math.max(width, height);
  const destinationWidth = width * scale;
  const destinationHeight = height * scale;
  return Object.freeze({
    x: options.centerX - destinationWidth / 2,
    y: options.centerY - destinationHeight / 2,
    width: destinationWidth,
    height: destinationHeight,
  });
}
