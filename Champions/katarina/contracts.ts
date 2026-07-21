import type { PlayerId, TileCoord } from "../../src/original-game/Gameplay/types";

/** Dagger stuck in the ground, waiting for a Shunpo re-cast. */
export interface KatarinaBladeEffect {
  kind: "katarina-bouncing-blade";
  ownerId: PlayerId;
  tile: TileCoord;
  remainingMs: number;
}

/** Crimson slash flash when Katarina blinks to her dagger. */
export interface KatarinaShunpoEffect {
  kind: "katarina-shunpo-slash";
  ownerId: PlayerId;
  tile: TileCoord;
  remainingMs: number;
}
