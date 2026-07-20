import type { CompetitorId, TileCoord, WorldPosition } from "../contracts.ts";

/**
 * Typed, ephemeral, append-only facts between phases of the same tick.
 * Never domain events; never drive rules after the tick ends.
 * Facts emitted in a phase are only visible to later phases.
 *
 * Slice 3A: `round-reset` is the single multi-owner vertical reset fact.
 * `spawn-protection-arm` arms vitals when Match opens playing.
 * Slice 3B: `pressure-impact` is published in `pressure` and visible only
 * from `pressure-impact` onward in the same tick.
 */
/**
 * Raw Ordnance intent: tiles hit by blast that looked like crates during
 * local wave simulation. Arena is the sole authority that intersects this
 * with pre-state crates and may emit {@link CratesRemovedFact}.
 */
export type CratesDestroyedFact = Readonly<{
  kind: "crates-destroyed";
  tiles: readonly TileCoord[];
}>;

/**
 * Arena-applied crate removal (Decision 009). Only tiles that actually
 * existed in Arena pre-state. Powerups consumes this fact only — never
 * `crates-destroyed` — so spurious/repeated raw facts cannot respawn drops.
 */
export type CratesRemovedFact = Readonly<{
  kind: "crates-removed";
  tiles: readonly TileCoord[];
}>;

export type RoundResetFact = Readonly<{
  kind: "round-reset";
  roundNumber: number;
  roundSeed: string;
}>;

export type SpawnProtectionArmFact = Readonly<{
  kind: "spawn-protection-arm";
  roundNumber: number;
}>;

export type PressureImpactFact = Readonly<{
  kind: "pressure-impact";
  roundNumber: number;
  pressureIndex: number;
  tile: TileCoord;
}>;

export type SkillMovementFact = Readonly<{
  kind: "skill-movement";
  competitorId: CompetitorId;
  suppress: boolean;
  teleport: WorldPosition | null;
}>;

export type TickFact =
  | CratesDestroyedFact
  | CratesRemovedFact
  | RoundResetFact
  | SpawnProtectionArmFact
  | PressureImpactFact
  | SkillMovementFact;

export function factsOfKind<K extends TickFact["kind"]>(
  facts: readonly TickFact[],
  kind: K,
): readonly Extract<TickFact, { kind: K }>[] {
  return facts.filter((fact): fact is Extract<TickFact, { kind: K }> => fact.kind === kind);
}
