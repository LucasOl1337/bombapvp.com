import type { TileCoord } from "./types";

export function tileKey(x: number, y: number): string {
  return `${x},${y}`;
}

export function parseTileKey(key: string): TileCoord {
  const [xText, yText] = key.split(",");
  return { x: Number(xText), y: Number(yText) };
}
