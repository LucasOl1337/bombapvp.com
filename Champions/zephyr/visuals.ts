import type {
  ChampionAnimationContext,
  ChampionAnimationResult,
  ChampionVisualAdapter,
} from "../visual-contracts";
import { ZEPHYR_SKILL_ID } from "./definition";

export function resolveZephyrAnimation(
  ctx: ChampionAnimationContext,
): ChampionAnimationResult | null {
  if (ctx.player.skill.phase !== "channeling" && ctx.player.skill.phase !== "releasing") {
    return null;
  }
  const exact = ctx.cycles.cast[ctx.direction] ?? [];
  const frames = exact.length
    ? exact
    : ctx.runFrames.length
      ? ctx.runFrames
      : ctx.attackFrames;
  if (!frames.length) return null;
  return { frames, frameMs: 70, playback: "hold" };
}

export const ZEPHYR_VISUAL_ADAPTER: ChampionVisualAdapter = {
  skillId: ZEPHYR_SKILL_ID,
  resolveAnimation: resolveZephyrAnimation,
};
export function createChampionVisualAdapter(): ChampionVisualAdapter {
  return ZEPHYR_VISUAL_ADAPTER;
}
