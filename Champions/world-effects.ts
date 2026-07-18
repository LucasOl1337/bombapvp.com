import type { NicoBeamEffect } from "./nico/contracts";
import type { PendulaPullEffect } from "./pendula/contracts";
import type { MirelleTideSwapEffect } from "./mirelle/contracts";
import { CHAMPION_MEMBERSHIP } from "./membership";

/** Extensible union of character-owned effects persisted by the generic engine. */
export type ChampionWorldEffect =
  | NicoBeamEffect
  | PendulaPullEffect
  | MirelleTideSwapEffect;

/** Compile-time exhaustive ownership table for every persisted effect kind. */
export const CHAMPION_WORLD_EFFECT_OWNER_SKILL_IDS = Object.freeze({
  "nico-beam": CHAMPION_MEMBERSHIP.nico.skillId,
  "pendula-pull": CHAMPION_MEMBERSHIP.pendula.skillId,
  "mirelle-tide-swap": CHAMPION_MEMBERSHIP.mirelle.skillId,
} satisfies Record<ChampionWorldEffect["kind"], string>);

export function isPendulaPullEffect(
  effect: ChampionWorldEffect,
): effect is PendulaPullEffect {
  return effect.kind === "pendula-pull";
}

/** @deprecated Use isPendulaPullEffect */
export function isPendulaShockwaveEffect(
  effect: ChampionWorldEffect,
): effect is PendulaPullEffect {
  return isPendulaPullEffect(effect);
}

export function isNicoBeamEffect(
  effect: ChampionWorldEffect,
): effect is NicoBeamEffect {
  return effect.kind === "nico-beam";
}

export function isMirelleTideSwapEffect(
  effect: ChampionWorldEffect,
): effect is MirelleTideSwapEffect {
  return effect.kind === "mirelle-tide-swap";
}
