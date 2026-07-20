import type { PlayerId, TileCoord } from "../../src/original-game/Gameplay/types";

/** Golden sonic shock along the Dragon's Rage kick line. */
export interface LeeSinDragonRageEffect {
  kind: "lee-sin-dragon-rage";
  ownerId: PlayerId;
  origin: TileCoord;
  /** Unit vector of the kick (cardinal). */
  direction: TileCoord;
  remainingMs: number;
  maxDistanceTiles: number;
  hit: boolean;
}
