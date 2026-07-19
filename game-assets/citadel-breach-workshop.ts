/**
 * Non-shipping workshop registry for Citadel Breach concept art.
 * Not exported from game-assets/index — do not import from the launcher.
 * Engine/runtime may adopt pieces later when a real owner exists.
 */
import { resolveGameAsset, type GameAssetId } from "./catalog";

export type CitadelWorkshopVisual = Readonly<{
  id: GameAssetId;
  url: string;
}>;

function visual(id: GameAssetId): CitadelWorkshopVisual {
  return Object.freeze({ id, url: resolveGameAsset(id) });
}

/** Concept packs without gameplay ownership. Keep out of launcher entry. */
export const CITADEL_BREACH_WORKSHOP = Object.freeze({
  arena: Object.freeze([
    visual("arena.shared.citadel-conduit-floor"),
    visual("arena.shared.citadel-gate-obstacle"),
    visual("arena.shared.citadel-reactor-block"),
    visual("arena.shared.arc-rune-danger-telegraph"),
  ]),
  powerUps: Object.freeze([
    visual("gameplay.power-up.chain-reaction.icon"),
    visual("gameplay.power-up.breach-shard.icon"),
    visual("gameplay.power-up.echo-charge.icon"),
  ]),
  hud: Object.freeze([
    visual("ui.hud.chain-combo-meter"),
    visual("ui.hud.breach-status"),
    visual("ui.hud.echo-charge-ready"),
    visual("ui.hud.fuse-heat-meter"),
  ]),
  feedback: Object.freeze([
    visual("gameplay.feedback.bomb-kick"),
    visual("gameplay.feedback.bomb-plant-confirmation"),
  ]),
  effects: Object.freeze([
    visual("effect.explosion.arc-flare-impact"),
    visual("effect.explosion.bomb-anim"),
    visual("effect.combo.chain-pulse"),
    visual("effect.structural.rupture-burst"),
    visual("effect.alert.fuse-critical-pulse"),
    visual("effect.activation.echo-charge"),
    visual("effect.obstacle.citadel-gate-lock-pulse"),
  ]),
});
