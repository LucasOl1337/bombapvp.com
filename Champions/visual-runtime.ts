import type {
  ChampionVisualAdapter,
  ChampionVisualRuntime,
} from "./visual-contracts";
import {
  CHAMPION_MEMBERSHIP,
  getChampionSlugFromModulePath,
  listChampionMembership,
} from "./membership";
import {
  CHAMPION_WORLD_EFFECT_OWNER_SKILL_IDS,
  type ChampionWorldEffect,
} from "./world-effects";

type ChampionVisualModule = Readonly<{
  createChampionVisualAdapter: () => ChampionVisualAdapter;
}>;

const visualModules = import.meta.glob<ChampionVisualModule>("./*/visuals.ts", {
  eager: true,
});

export function createChampionVisualRuntime(): ChampionVisualRuntime {
  const discoveredAdapters = Object.entries(visualModules).map(
    ([modulePath, { createChampionVisualAdapter }]) => {
      const slug = getChampionSlugFromModulePath(modulePath, "visuals");
      if (!slug) throw new Error(`Unexpected Champion visuals module: ${modulePath}`);
      const adapter = createChampionVisualAdapter();
      if (adapter.skillId !== CHAMPION_MEMBERSHIP[slug].skillId) {
        throw new Error(`Champion visual adapter does not match folder: ${slug}`);
      }
      return adapter;
    },
  );
  const discoveredBySkillId = new Map(
    discoveredAdapters.map((adapter) => [adapter.skillId, adapter]),
  );
  const adapters = Object.freeze(
    listChampionMembership().map(({ slug, skillId }) => {
      const adapter = discoveredBySkillId.get(skillId);
      if (!adapter) throw new Error(`Missing Champion visual adapter: ${slug}`);
      return adapter;
    }),
  );
  if (discoveredBySkillId.size !== adapters.length) {
    throw new Error("Champion visual adapters do not match canonical membership");
  }
  const adaptersBySkillId = new Map(
    adapters.map((adapter) => [adapter.skillId, adapter]),
  );
  const worldEffectAdapter = (effect: ChampionWorldEffect) => {
    const ownerSkillId = CHAMPION_WORLD_EFFECT_OWNER_SKILL_IDS[effect.kind];
    const adapter = adaptersBySkillId.get(ownerSkillId);
    if (!adapter) throw new Error(`Missing owner for world effect: ${effect.kind}`);
    return adapter;
  };

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
      const nextEffects: ChampionWorldEffect[] = [];
      for (const effect of effects) {
        const adapter = worldEffectAdapter(effect);
        const advanced = adapter.advanceWorldEffects?.([effect], deltaMs);
        if (!advanced) {
          throw new Error(`Owner cannot advance world effect: ${effect.kind}`);
        }
        nextEffects.push(...advanced);
      }
      return nextEffects;
    },
    drawWorldEffect: (ctx, effect, tileSize) => {
      const adapter = worldEffectAdapter(effect);
      if (!adapter.drawWorldEffect) {
        throw new Error(`Owner cannot draw world effect: ${effect.kind}`);
      }
      adapter.drawWorldEffect(ctx, effect, tileSize);
    },
    drawSkillPresentation: (context) => {
      for (const adapter of adapters) adapter.drawPresentation?.(context);
    },
  };
}
