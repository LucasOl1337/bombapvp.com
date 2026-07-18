import type { NicoBeamEffect } from "./nico/contracts";
import type { PendulaPullEffect } from "./pendula/contracts";
import type { MirelleTideSwapEffect } from "./mirelle/contracts";
import type { BramSeismicEffect } from "./bram/contracts";
import type { ZephyrGaleEffect } from "./zephyr/contracts";
import type { HexaHexEffect } from "./hexa/contracts";
import type { AegisBastionEffect } from "./aegis/contracts";
import type { LumenFlashEffect } from "./lumen/contracts";
import { CHAMPION_MEMBERSHIP } from "./membership";

/** Extensible union of character-owned effects persisted by the generic engine. */
export type ChampionWorldEffect =
  | NicoBeamEffect
  | PendulaPullEffect
  | MirelleTideSwapEffect
  | BramSeismicEffect
  | ZephyrGaleEffect
  | HexaHexEffect
  | AegisBastionEffect
  | LumenFlashEffect;

/** Compile-time exhaustive ownership table for every persisted effect kind. */
export const CHAMPION_WORLD_EFFECT_OWNER_SKILL_IDS = Object.freeze({
  "nico-beam": CHAMPION_MEMBERSHIP.nico.skillId,
  "pendula-pull": CHAMPION_MEMBERSHIP.pendula.skillId,
  "mirelle-tide-swap": CHAMPION_MEMBERSHIP.mirelle.skillId,
  "bram-seismic": CHAMPION_MEMBERSHIP.bram.skillId,
  "zephyr-gale": CHAMPION_MEMBERSHIP.zephyr.skillId,
  "hexa-hex": CHAMPION_MEMBERSHIP.hexa.skillId,
  "aegis-bastion": CHAMPION_MEMBERSHIP.aegis.skillId,
  "lumen-flash": CHAMPION_MEMBERSHIP.lumen.skillId,
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

export function isBramSeismicEffect(
  effect: ChampionWorldEffect,
): effect is BramSeismicEffect {
  return effect.kind === "bram-seismic";
}

export function isZephyrGaleEffect(
  effect: ChampionWorldEffect,
): effect is ZephyrGaleEffect {
  return effect.kind === "zephyr-gale";
}

export function isHexaHexEffect(
  effect: ChampionWorldEffect,
): effect is HexaHexEffect {
  return effect.kind === "hexa-hex";
}

export function isAegisBastionEffect(
  effect: ChampionWorldEffect,
): effect is AegisBastionEffect {
  return effect.kind === "aegis-bastion";
}

export function isLumenFlashEffect(
  effect: ChampionWorldEffect,
): effect is LumenFlashEffect {
  return effect.kind === "lumen-flash";
}
