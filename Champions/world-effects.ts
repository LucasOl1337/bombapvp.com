import type { NicoBeamEffect } from "./nico/contracts";
import type { PendulaPullEffect } from "./pendula/contracts";

/** Extensible union of character-owned effects persisted by the generic engine. */
export type ChampionWorldEffect = NicoBeamEffect | PendulaPullEffect;

export function isPendulaPullEffect(
  effect: ChampionWorldEffect,
): effect is PendulaPullEffect {
  return effect.kind === "pendula-pull";
}

/** @deprecated Use isPendulaPullEffect */
export function isPendulaShockwaveEffect(
  effect: ChampionWorldEffect,
): effect is PendulaPullEffect {
  return effect.kind === "pendula-pull" || (effect as { kind?: string }).kind === "pendula-shockwave";
}

export function isNicoBeamEffect(
  effect: ChampionWorldEffect,
): effect is NicoBeamEffect {
  return effect.kind === "nico-beam";
}
