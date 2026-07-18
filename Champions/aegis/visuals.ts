import type {
  ChampionAnimationContext,
  ChampionAnimationResult,
  ChampionVisualAdapter,
} from "../visual-contracts";
import { AEGIS_SKILL_ID } from "./definition";

export function resolveAegisAnimation(
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

export const AEGIS_VISUAL_ADAPTER: ChampionVisualAdapter = {
  skillId: AEGIS_SKILL_ID,
  resolveAnimation: resolveAegisAnimation,
};
export function createChampionVisualAdapter(): ChampionVisualAdapter {
  return AEGIS_VISUAL_ADAPTER;
}
