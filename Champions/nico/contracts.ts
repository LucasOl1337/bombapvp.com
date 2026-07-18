import type {
  Direction,
  PlayerId,
  TileCoord,
} from "../../src/original-game/Gameplay/types";

/** Runtime world effect produced exclusively by Nico's Arcane Beam. */
export interface NicoBeamEffect {
  ownerId: PlayerId;
  origin: TileCoord;
  direction: Direction;
  tiles: TileCoord[];
  remainingMs: number;
}
