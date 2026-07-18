import type { PlayerId, TileCoord } from "../../src/original-game/Gameplay/types";

/** Expanding wind ring after Gale Scatter. */
export interface ZephyrGaleEffect {
  kind: "zephyr-gale";
  ownerId: PlayerId;
  origin: TileCoord;
  remainingMs: number;
  maxRadiusTiles: number;
  pushedCount: number;
}
