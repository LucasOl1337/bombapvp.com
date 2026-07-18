import type { PlayerId, TileCoord } from "../../src/original-game/Gameplay/types";

/** Expanding stone-crack ring after Seismic Crack fires. */
export interface BramSeismicEffect {
  kind: "bram-seismic";
  ownerId: PlayerId;
  origin: TileCoord;
  remainingMs: number;
  maxRadiusTiles: number;
  brokenCount: number;
}
