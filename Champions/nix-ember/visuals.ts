import type {
  ChampionAnimationContext,
  ChampionAnimationResult,
  ChampionVisualAdapter,
} from "../visual-contracts";
import { NIX_EMBER_VAULT_FRAME_MS } from "./skill";
import { NIX_EMBER_SKILL_ID } from "./definition";

export function resolveNixEmberAnimation(
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
    ? { frames, frameMs: NIX_EMBER_VAULT_FRAME_MS, playback: "loop" }
    : null;
}

export const NIX_EMBER_VISUAL_ADAPTER: ChampionVisualAdapter = {
  skillId: NIX_EMBER_SKILL_ID,
  resolveAnimation: resolveNixEmberAnimation,
};
