import type {
  ChampionVisualAdapter,
  ChampionVisualRuntime,
} from "./visual-contracts";
import { createRanniVisualAdapter } from "./ranni/visuals";
import { KILLER_BEE_VISUAL_ADAPTER } from "./killer-bee/visuals";
import { CROCODILO_VISUAL_ADAPTER } from "./crocodilo-arcano/visuals";
import { NICO_VISUAL_ADAPTER } from "./nico/visuals";
import { NIX_EMBER_VISUAL_ADAPTER } from "./nix-ember/visuals";
import { PENDULA_VISUAL_ADAPTER } from "./pendula/visuals";

export function createChampionVisualRuntime(): ChampionVisualRuntime {
  const adapters: readonly ChampionVisualAdapter[] = Object.freeze([
    createRanniVisualAdapter(),
    KILLER_BEE_VISUAL_ADAPTER,
    CROCODILO_VISUAL_ADAPTER,
    NICO_VISUAL_ADAPTER,
    NIX_EMBER_VISUAL_ADAPTER,
    PENDULA_VISUAL_ADAPTER,
  ]);
  const adaptersBySkillId = new Map(
    adapters.map((adapter) => [adapter.skillId, adapter]),
  );

  return {
    resolveAnimation: (context) => {
      const skillId = context.player.skill.id;
      return skillId
        ? (adaptersBySkillId.get(skillId)?.resolveAnimation(context) ?? null)
        : null;
    },
    updateSkillChannel: (player, direction, pressed, held, deltaMs, update) => {
      const skillId = player.skill.id;
      return (
        (skillId
          ? adaptersBySkillId
              .get(skillId)
              ?.updateSkillChannel?.(
                player,
                direction,
                pressed,
                held,
                deltaMs,
                update,
              )
          : undefined) ?? update(player, direction, pressed, held, deltaMs)
      );
    },
    advance: (deltaMs, playerIds) => {
      for (const adapter of adapters) adapter.advance?.(deltaMs, playerIds);
    },
    reset: () => {
      for (const adapter of adapters) adapter.reset?.();
    },
    getHudStatus: (player, language) => {
      for (const adapter of adapters) {
        const status = adapter.getHudStatus?.(player, language);
        if (status) return status;
      }
      return null;
    },
    advanceWorldEffects: (effects, deltaMs) => {
      let nextEffects = [...effects];
      for (const adapter of adapters) {
        nextEffects =
          adapter.advanceWorldEffects?.(nextEffects, deltaMs) ?? nextEffects;
      }
      return nextEffects;
    },
    drawWorldEffect: (ctx, effect, tileSize) => {
      for (const adapter of adapters)
        adapter.drawWorldEffect?.(ctx, effect, tileSize);
    },
    drawSkillPresentation: (context) => {
      for (const adapter of adapters) adapter.drawPresentation?.(context);
    },
  };
}
