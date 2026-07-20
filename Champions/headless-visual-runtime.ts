import type { ChampionVisualRuntime } from "./visual-contracts";
import { advanceChampionWorldEffects } from "./world-effects";

/**
 * Presentation-free runtime for authoritative simulations. Gameplay-owned
 * effect lifetimes remain active; canvas, HUD and animation state do not load.
 */
export function createHeadlessChampionVisualRuntime(): ChampionVisualRuntime {
  return {
    resolveAnimation: () => null,
    updateSkillChannel: (player, direction, pressed, held, deltaMs, update) => (
      update(player, direction, pressed, held, deltaMs)
    ),
    advance: () => undefined,
    reset: () => undefined,
    getHudStatus: () => null,
    advanceWorldEffects: advanceChampionWorldEffects,
    drawWorldEffect: () => undefined,
    drawSkillPresentation: () => undefined,
  };
}
