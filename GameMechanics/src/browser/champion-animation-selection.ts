export type AnimationFacing = "south" | "north" | "east" | "west";

export type FacingFrames = Readonly<
  Record<AnimationFacing, readonly string[]>
>;

export type SkillAnimationAction = "attack" | "cast" | "ultimate";
export type ChampionAnimationAction =
  | "idle"
  | "walk"
  | "run"
  | SkillAnimationAction
  | "death";

export type IntegratedAnimationManifest = Readonly<{
  runtimeIntegration?: boolean;
  runtimeAction?: string;
  runtimeDirection?: string;
  champion?: Readonly<{ slug?: string }>;
}>;

export type IntegratedAnimationOverrides = Readonly<
  Partial<Record<ChampionAnimationAction, AnimationFacing>>
>;

const CHAMPION_ACTIONS = new Set<ChampionAnimationAction>([
  "idle",
  "walk",
  "run",
  "attack",
  "cast",
  "ultimate",
  "death",
]);
const FACINGS = new Set<AnimationFacing>(["south", "north", "east", "west"]);

export function selectFacingFrames(
  frames: FacingFrames,
  facing: AnimationFacing,
  integratedDirection?: AnimationFacing,
): readonly string[] {
  if (integratedDirection && frames[integratedDirection].length > 0) {
    return frames[integratedDirection];
  }
  if (frames[facing].length > 0) return frames[facing];
  if (frames.south.length > 0) return frames.south;
  return frames.north.length > 0
    ? frames.north
    : frames.east.length > 0
      ? frames.east
      : frames.west;
}

export function selectSkillAnimationAction(
  available: Readonly<Record<SkillAnimationAction, boolean>>,
  integratedActions: readonly SkillAnimationAction[],
): SkillAnimationAction | null {
  for (const action of ["ultimate", "attack", "cast"] as const) {
    if (integratedActions.includes(action) && available[action]) return action;
  }
  for (const action of ["ultimate", "cast", "attack"] as const) {
    if (available[action]) return action;
  }
  return null;
}

export function selectBombAnimationAction(
  available: Readonly<Record<SkillAnimationAction, boolean>>,
  integratedActions: readonly SkillAnimationAction[],
): SkillAnimationAction | null {
  if (integratedActions.includes("cast") && available.cast) return "cast";
  return available.cast ? "cast" : null;
}

export function didLivingShadowSwapSucceed(
  cooldownRemainingMs: number,
  failCooldownMs: number,
): boolean {
  return cooldownRemainingMs > failCooldownMs;
}

/** Maps an elapsed presentation clock onto a finite, non-looping sequence. */
export function timedAnimationFrameIndex(
  frameCount: number,
  ageMs: number,
  durationMs: number,
): number | null {
  if (frameCount <= 0 || durationMs <= 0 || ageMs < 0 || ageMs >= durationMs) {
    return null;
  }
  return Math.min(frameCount - 1, Math.floor((ageMs / durationMs) * frameCount));
}

export function collectIntegratedAnimationOverrides(
  manifests: readonly IntegratedAnimationManifest[],
): ReadonlyMap<string, IntegratedAnimationOverrides> {
  const mutable = new Map<
    string,
    Partial<Record<ChampionAnimationAction, AnimationFacing>>
  >();
  for (const manifest of manifests) {
    const slug = manifest.champion?.slug;
    const action = manifest.runtimeAction as ChampionAnimationAction | undefined;
    const direction = manifest.runtimeDirection as AnimationFacing | undefined;
    if (
      manifest.runtimeIntegration !== true
      || !slug
      || !action
      || !direction
      || !CHAMPION_ACTIONS.has(action)
      || !FACINGS.has(direction)
    ) {
      continue;
    }
    const current = mutable.get(slug) ?? {};
    current[action] = direction;
    mutable.set(slug, current);
  }
  return new Map(
    [...mutable].map(([slug, actions]) => [slug, Object.freeze({ ...actions })]),
  );
}
