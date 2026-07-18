import type {
  ChampionAnimationContext,
  ChampionAnimationResult,
  ChampionVisualAdapter,
} from "../visual-contracts";
import { KILLER_BEE_DASH_FRAME_MS } from "./skill";
import { KILLER_BEE_SKILL_ID } from "./definition";
export function resolveKillerBeeAnimation(
  c: ChampionAnimationContext,
): ChampionAnimationResult | null {
  if (c.player.skill.phase !== "channeling") return null;
  const exact = c.cycles.cast[c.direction] ?? [];
  const frames = exact.length
    ? exact
    : c.runFrames.length
      ? c.runFrames
      : c.attackFrames;
  return frames.length
    ? { frames, frameMs: KILLER_BEE_DASH_FRAME_MS, playback: "loop" }
    : null;
}
export const KILLER_BEE_VISUAL_ADAPTER: ChampionVisualAdapter = {
  skillId: KILLER_BEE_SKILL_ID,
  resolveAnimation: resolveKillerBeeAnimation,
};
export function createChampionVisualAdapter(): ChampionVisualAdapter {
  return KILLER_BEE_VISUAL_ADAPTER;
}
