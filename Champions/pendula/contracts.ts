import type { PlayerId, TileCoord } from "../../src/original-game/Gameplay/types";

/** Inward cyan/brass ring after Command: Pull fires. */
export interface PendulaPullEffect {
  kind: "pendula-pull";
  ownerId: PlayerId;
  origin: TileCoord;
  remainingMs: number;
  maxRadiusTiles: number;
}

/** @deprecated Alias kept so older imports type-check during rename. */
export type PendulaShockwaveEffect = PendulaPullEffect;
