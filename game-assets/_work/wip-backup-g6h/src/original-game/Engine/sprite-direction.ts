import type { Direction } from "../Gameplay/types";
import type { DirectionalSprites } from "./assets";

export function spriteForDirection(
  sprites: DirectionalSprites,
  direction: Direction,
): HTMLImageElement | null {
  if (direction === "up") return sprites.up;
  if (direction === "down") return sprites.down;
  if (direction === "left") return sprites.left;
  return sprites.right;
}
