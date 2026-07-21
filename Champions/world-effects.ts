import type { NicoBeamEffect } from "./nico/contracts";
import type { PendulaPullEffect } from "./pendula/contracts";
import type { MirelleTideSwapEffect } from "./mirelle/contracts";
import type { LeeSinDragonRageEffect } from "./lee-sin/contracts";
import type { ThreshDeathSentenceEffect } from "./thresh/contracts";
import type {
  KatarinaBladeEffect,
  KatarinaShunpoEffect,
} from "./katarina/contracts";
import type { MadaraFireballEffect } from "./madara/contracts";
import { CHAMPION_MEMBERSHIP } from "./membership";

/** Extensible union of character-owned effects persisted by the generic engine. */
export type ChampionWorldEffect =
  | NicoBeamEffect
  | PendulaPullEffect
  | MirelleTideSwapEffect
  | LeeSinDragonRageEffect
  | ThreshDeathSentenceEffect
  | KatarinaBladeEffect
  | KatarinaShunpoEffect
  | MadaraFireballEffect;

/** Compile-time exhaustive ownership table for every persisted effect kind. */
export const CHAMPION_WORLD_EFFECT_OWNER_SKILL_IDS = Object.freeze({
  "nico-beam": CHAMPION_MEMBERSHIP.nico.skillId,
  "pendula-pull": CHAMPION_MEMBERSHIP.pendula.skillId,
  "mirelle-tide-swap": CHAMPION_MEMBERSHIP.mirelle.skillId,
  "lee-sin-dragon-rage": CHAMPION_MEMBERSHIP["lee-sin"].skillId,
  "thresh-death-sentence": CHAMPION_MEMBERSHIP["thresh"].skillId,
  "katarina-bouncing-blade": CHAMPION_MEMBERSHIP["katarina"].skillId,
  "katarina-shunpo-slash": CHAMPION_MEMBERSHIP["katarina"].skillId,
  "madara-fireball-jutsu": CHAMPION_MEMBERSHIP["madara"].skillId,
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

export function isLeeSinDragonRageEffect(
  effect: ChampionWorldEffect,
): effect is LeeSinDragonRageEffect {
  return effect.kind === "lee-sin-dragon-rage";
}

export function isThreshDeathSentenceEffect(
  effect: ChampionWorldEffect,
): effect is ThreshDeathSentenceEffect {
  return effect.kind === "thresh-death-sentence";
}

export function isKatarinaBladeEffect(
  effect: ChampionWorldEffect,
): effect is KatarinaBladeEffect {
  return effect.kind === "katarina-bouncing-blade";
}

export function isKatarinaShunpoEffect(
  effect: ChampionWorldEffect,
): effect is KatarinaShunpoEffect {
  return effect.kind === "katarina-shunpo-slash";
}

export function isMadaraFireballEffect(
  effect: ChampionWorldEffect,
): effect is MadaraFireballEffect {
  return effect.kind === "madara-fireball-jutsu";
}

/** Authoritative lifetime update shared by browser and headless runtimes. */
export function advanceChampionWorldEffects(
  effects: readonly ChampionWorldEffect[],
  deltaMs: number,
): ChampionWorldEffect[] {
  return effects.flatMap((effect) => {
    const remainingMs = effect.remainingMs - deltaMs;
    return remainingMs > 0 ? [{ ...effect, remainingMs }] : [];
  });
}
