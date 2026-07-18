import type { PlayerId, TileCoord } from "../../src/original-game/Gameplay/types";

/** Expanding brass ring after Command: Shockwave fires. */
export interface PendulaShockwaveEffect {
  kind: "pendula-shockwave";
  ownerId: PlayerId;
  origin: TileCoord;
  remainingMs: number;
  maxRadiusTiles: number;
}
