import type { PixelCoord, PlayerId } from "../../src/original-game/Gameplay/types";

export interface LumenFlashEffect {
  kind: "lumen-flash";
  ownerId: PlayerId;
  from: PixelCoord;
  to: PixelCoord;
  remainingMs: number;
}
