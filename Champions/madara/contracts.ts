import type { Direction, PlayerId, TileCoord } from "../../src/original-game/Gameplay/types";

/** Fireball projectile traveling along a cardinal lane. */
export interface MadaraFireballEffect {
  kind: "madara-fireball-jutsu";
  ownerId: PlayerId;
  origin: TileCoord;
  direction: Direction;
  detonation: TileCoord;
  pathTiles: readonly TileCoord[];
  remainingMs: number;
}
