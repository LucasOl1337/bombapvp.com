import type { PlayerId, TileCoord } from "../../src/original-game/Gameplay/types";

/** Purple hex pulse over bomb tiles after Fuse Hex. */
export interface HexaHexEffect {
  kind: "hexa-hex";
  ownerId: PlayerId;
  origin: TileCoord;
  remainingMs: number;
  maxRadiusTiles: number;
  hexedCount: number;
  bombTiles: TileCoord[];
}
