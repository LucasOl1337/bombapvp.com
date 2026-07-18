import { resolveGameAsset, type GameAssetId } from "./catalog";

export type CitadelBreachVisual = Readonly<{
  id: GameAssetId;
  url: string;
}>;

function visual(id: GameAssetId): CitadelBreachVisual {
  return Object.freeze({ id, url: resolveGameAsset(id) });
}

export const CITADEL_BREACH_VISUALS = Object.freeze({
  marketing: Object.freeze({
    banner: visual("marketing.citadel-breach.launcher-banner"),
    keyArt: visual("marketing.citadel-breach.key-art"),
  }),
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
    visual("effect.combo.chain-pulse"),
    visual("effect.structural.rupture-burst"),
    visual("effect.alert.fuse-critical-pulse"),
    visual("effect.activation.echo-charge"),
    visual("effect.obstacle.citadel-gate-lock-pulse"),
  ]),
});
