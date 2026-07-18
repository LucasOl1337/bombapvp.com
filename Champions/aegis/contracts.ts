import type { PlayerId, TileCoord } from "../../src/original-game/Gameplay/types";

export interface AegisBastionEffect {
  kind: "aegis-bastion";
  ownerId: PlayerId;
  origin: TileCoord;
  remainingMs: number;
}
