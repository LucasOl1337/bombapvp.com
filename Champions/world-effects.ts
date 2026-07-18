import type { NicoBeamEffect } from "./nico/contracts";
import type { PendulaShockwaveEffect } from "./pendula/contracts";

/** Extensible union of character-owned effects persisted by the generic engine. */
export type ChampionWorldEffect = NicoBeamEffect | PendulaShockwaveEffect;

export function isPendulaShockwaveEffect(
  effect: ChampionWorldEffect,
): effect is PendulaShockwaveEffect {
  return (
    typeof effect === "object" &&
    effect !== null &&
    "kind" in effect &&
    (effect as PendulaShockwaveEffect).kind === "pendula-shockwave"
  );
}

/** Nico beams are the legacy shape without a kind tag. */
export function isNicoBeamEffect(
  effect: ChampionWorldEffect,
): effect is NicoBeamEffect {
  return !isPendulaShockwaveEffect(effect);
}
