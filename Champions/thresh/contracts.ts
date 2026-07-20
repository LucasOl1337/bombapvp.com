import type { PlayerId, TileCoord } from "../../src/original-game/Gameplay/types";

/** Spectral chain left by Death Sentence along the hook line. */
export interface ThreshDeathSentenceEffect {
  kind: "thresh-death-sentence";
  ownerId: PlayerId;
  origin: TileCoord;
  /** Unit vector of the hook (cardinal). */
  direction: TileCoord;
  remainingMs: number;
  /** Tiles the hook actually travelled (victim distance or max free range). */
  reachTiles: number;
  hit: boolean;
}
