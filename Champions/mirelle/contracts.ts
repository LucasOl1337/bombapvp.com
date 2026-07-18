import type {
  PixelCoord,
  PlayerId,
  TileCoord,
} from "../../src/original-game/Gameplay/types";

/** Tide ribbon between the two swap anchors after Tide Swap fires. */
export interface MirelleTideSwapEffect {
  kind: "mirelle-tide-swap";
  ownerId: PlayerId;
  from: PixelCoord;
  to: PixelCoord;
  fromTile: TileCoord;
  toTile: TileCoord;
  remainingMs: number;
}
