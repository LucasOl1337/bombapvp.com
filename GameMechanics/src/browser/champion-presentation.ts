import type { GameEvent, SkillId } from "../contracts.ts";
import {
  CROCODILO_EMERALD_SURGE_SKILL_ID,
  KILLER_BEE_WING_DASH_SKILL_ID,
  RANNI_ICE_BLINK_SKILL_ID,
  THRESH_DEATH_SENTENCE_SKILL_ID,
  ZED_LIVING_SHADOW_SKILL_ID,
} from "../contracts.ts";
import { RANNI_CHANNEL_MS } from "../modules/skills/index.ts";

/**
 * How each champion looks when its skill opens and closes.
 *
 * One module per champion, each answering only for itself. Adding a champion
 * means adding a file and one registry line — no central branch grows, and the
 * new champion's timings can be tested without touching anyone else's.
 *
 * Champions return declarative cues rather than touching FX state, so this
 * module stays free of both the DOM and the renderer's mutable containers.
 */

/**
 * Which sprite sequence to play, in order of preference. The renderer knows
 * which of these a champion actually has frames for; the first available wins.
 */
export type ActionSource = "skill" | "bomb";

export type PresentationCue =
  /** Play a sprite sequence, optionally locked to a kernel-owned duration. */
  | Readonly<{
      kind: "play-action";
      prefer: readonly ActionSource[];
      durationMs?: number;
      buildMs?: number;
    }>
  /** Stop the current sequence — something else takes over the frame. */
  | Readonly<{ kind: "clear-action" }>
  /** Launch the Death Sentence chain; the pull follows the event's targets. */
  | Readonly<{ kind: "hook-shot" }>;

export type ChampionPresentation = Readonly<{
  skillId: SkillId;
  onChannelStart?: (
    event: Extract<GameEvent, { type: "skill-channel-started" }>,
  ) => readonly PresentationCue[];
  onResolved?: (
    event: Extract<GameEvent, { type: "skill-resolved" }>,
  ) => readonly PresentationCue[];
}>;

/** Fast six-frame build-up before the full ice prison is held. */
const RANNI_FREEZE_BUILD_MS = 240;
/**
 * Living Shadow cast telegraph: build through the cast frames, then release so
 * free-move locomotion can read while the 2000 ms channel continues.
 */
const ZED_CAST_TELEGRAPH_MS = 1_000;
const ZED_CAST_BUILD_MS = 700;
/** Readable swap recovery after a valid Living Shadow teleport. */
const ZED_SWAP_RECOVERY_MS = 720;
/** Short cancel/fail pose after timeout, invalid swap, or death cleanup. */
const ZED_SHADOW_CANCEL_MS = 420;

/** Default cast pose: whatever skill sequence the champion has, free-running. */
const PLAIN_CAST: readonly PresentationCue[] = Object.freeze([
  Object.freeze({ kind: "play-action" as const, prefer: Object.freeze(["skill" as const]) }),
]);

/**
 * Ranni — Ice Blink. The body freezes for the whole channel, then the blink's
 * own landing effect takes the frame, so the frozen pose is dropped outright.
 */
export const RANNI_PRESENTATION: ChampionPresentation = Object.freeze({
  skillId: RANNI_ICE_BLINK_SKILL_ID,
  onChannelStart: () => [{
    kind: "play-action" as const,
    prefer: ["skill" as const],
    durationMs: RANNI_CHANNEL_MS,
    buildMs: RANNI_FREEZE_BUILD_MS,
  }],
  onResolved: () => [{ kind: "clear-action" as const }],
});

/**
 * Zed — Living Shadow. A committed swap recovers through the bomb sequence,
 * which reads as landing; anything else is a shorter cancel pose. `outcome`
 * comes from the kernel, so the two are never told apart by cooldown length.
 */
export const ZED_PRESENTATION: ChampionPresentation = Object.freeze({
  skillId: ZED_LIVING_SHADOW_SKILL_ID,
  onChannelStart: () => [{
    kind: "play-action" as const,
    prefer: ["skill" as const],
    durationMs: ZED_CAST_TELEGRAPH_MS,
    buildMs: ZED_CAST_BUILD_MS,
  }],
  onResolved: (event: Extract<GameEvent, { type: "skill-resolved" }>) =>
    event.outcome === "hit"
      ? [{
          kind: "play-action" as const,
          prefer: ["bomb" as const, "skill" as const],
          durationMs: ZED_SWAP_RECOVERY_MS,
        }]
      : [{
          kind: "play-action" as const,
          prefer: ["skill" as const],
          durationMs: ZED_SHADOW_CANCEL_MS,
        }],
});

/** Thresh — Death Sentence. The chain flies on every cast, hit or whiff. */
export const THRESH_PRESENTATION: ChampionPresentation = Object.freeze({
  skillId: THRESH_DEATH_SENTENCE_SKILL_ID,
  onChannelStart: () => PLAIN_CAST,
  onResolved: () => [{ kind: "hook-shot" as const }],
});

/** Killer Bee — Wing Dash. The dash itself is the effect; no extra pose. */
export const KILLER_BEE_PRESENTATION: ChampionPresentation = Object.freeze({
  skillId: KILLER_BEE_WING_DASH_SKILL_ID,
  onChannelStart: () => PLAIN_CAST,
});

/** Crocodilo — Emerald Surge. Plain cast pose while the surge resolves. */
export const CROCODILO_PRESENTATION: ChampionPresentation = Object.freeze({
  skillId: CROCODILO_EMERALD_SURGE_SKILL_ID,
  onChannelStart: () => PLAIN_CAST,
});

export const CHAMPION_PRESENTATIONS: readonly ChampionPresentation[] = Object.freeze([
  RANNI_PRESENTATION,
  ZED_PRESENTATION,
  THRESH_PRESENTATION,
  KILLER_BEE_PRESENTATION,
  CROCODILO_PRESENTATION,
]);

const BY_SKILL_ID = new Map<SkillId, ChampionPresentation>(
  CHAMPION_PRESENTATIONS.map((presentation) => [presentation.skillId, presentation]),
);

/**
 * Presentation for a skill, or null when that champion has none registered.
 * A missing entry is silent by design: the arena still plays the default cast
 * pose the renderer picks, it just gets no champion-specific timing.
 */
export function championPresentationFor(skillId: SkillId): ChampionPresentation | null {
  return BY_SKILL_ID.get(skillId) ?? null;
}
