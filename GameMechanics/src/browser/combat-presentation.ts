import type {
  CompetitorId,
  Direction,
  GameEvent,
  PowerUpType,
  SkillId,
  TileCoord,
} from "../contracts.ts";
import { THRESH_HOOK_RANGE } from "../modules/skills/index.ts";
import {
  championPresentationFor,
  type ActionSource,
  type PresentationCue,
} from "./champion-presentation.ts";

/**
 * Everything the arena draws that the kernel does not own.
 *
 * This module is the single owner of combat FX state. It exists so the rules
 * that turn kernel events into visible effects — which effect, how long, when
 * it is dropped, how many are kept — can be exercised through an interface
 * instead of being read out of the renderer's source text.
 *
 * It deliberately holds no canvas, no DOM and no clock: `observe` takes the
 * events and the timestamp, and the renderer reads the state back. Nothing here
 * infers kernel outcomes; skill results arrive as `skill-resolved` events.
 */

export type Facing = "north" | "south" | "east" | "west";

/** Champion sprite sequences the presentation can start. */
export type ChampionAction = "attack" | "cast" | "ultimate";

export type PresentationFx = Readonly<{
  kind: "power-reveal" | "power-collect";
  tileX: number;
  tileY: number;
  powerUpType: PowerUpType;
  label: string;
  startMs: number;
}>;

export type CrateBreakFx = Readonly<{ tile: TileCoord; startMs: number }>;

export type ChainSparkFx = Readonly<{
  fromTile: TileCoord;
  toTile: TileCoord;
  startMs: number;
}>;

export type BlinkTrailFx = Readonly<{
  from: { x: number; y: number };
  to: { x: number; y: number };
  startMs: number;
}>;

export type PressureWarnFx = Readonly<{
  tile: TileCoord;
  startMs: number;
  durationMs: number;
}>;

export type DeathAnim = Readonly<{
  position: { x: number; y: number };
  facing: Facing;
  startMs: number;
}>;

export type TimedChampionAction = Readonly<{
  action: ChampionAction;
  startMs: number;
  /** Kernel-owned duration that keeps presentation in lockstep. */
  durationMs?: number;
  /** Entrance duration before holding the action's last frame. */
  buildMs?: number;
}>;

/** Thresh Death Sentence hook projectile visual state. */
export type HookProjectileFx = Readonly<{
  ownerId: CompetitorId;
  originTile: TileCoord;
  direction: Direction;
  reachTiles: number;
  hit: boolean;
  startMs: number;
}>;

/** Thresh hook victim pull — the victim slides along the chain. */
export type HookPullFx = Readonly<{
  victimId: CompetitorId;
  /** Victim position before the teleport (fixed-point world units). */
  fromPos: { x: number; y: number };
  /** Victim position after the teleport (fixed-point world units). */
  toPos: { x: number; y: number };
  /** Thresh tile at the moment of the pull (chain origin). */
  threshTile: TileCoord;
  startMs: number;
}>;

export type RecentExplosion = Readonly<{
  bombId: number;
  tile: TileCoord;
  flameTiles: readonly TileCoord[];
  startMs: number;
}>;

export type ProjectionPose = {
  x: number;
  y: number;
  facing: Facing;
  lastMoveMs: number;
  skillId: SkillId | null;
};

export type CompetitorPose = { x: number; y: number; facing: Facing };

/** Where a lab effect is anchored: an arena tile, or the HUD strip. */
export type LabFxAnchor = { tileX: number; tileY: number } | "hud";

/** Categories the renderer maps onto concrete lab packs. */
export type LabFxCategory = "bomb" | "hit" | "arena" | "power-up" | "hud";

/**
 * The few things the presentation cannot decide for itself.
 *
 * Each is a genuine outside fact: which sprite sequence a champion has frames
 * for, how a power-up reads in the active language, and whether the player
 * asked for reduced motion. Injecting them keeps the module free of the DOM.
 */
export type CombatPresentationDeps = Readonly<{
  /** Sequence to play when this competitor places a bomb (null = none). */
  bombActionFor: (competitorId: CompetitorId) => ChampionAction | null;
  /** Sequence to play when this competitor casts (null = none). */
  skillActionFor: (competitorId: CompetitorId) => ChampionAction | null;
  /** Localized floating label for a power-up. */
  powerUpLabel: (type: PowerUpType) => string;
  /** True when the player asked for reduced motion; suppresses screen shake. */
  prefersReducedMotion: boolean;
  /** Queue a generated lab effect. The renderer owns pack rotation. */
  queueLabFx: (category: LabFxCategory, anchor: LabFxAnchor, startMs: number) => void;
  /** Flash the HUD stat a power-up just changed. */
  pulseHudStat: (competitorId: CompetitorId, type: PowerUpType) => void;
  /** Reset lab pack rotation when a round starts over. */
  resetLabRotation: () => void;
}>;

/** Backlog caps, per FX family. Oldest entries drop first. */
const FX_LIMITS = {
  presentation: 24,
  crateBreak: 24,
  chainSpark: 12,
  blinkTrail: 8,
  pressureWarn: 8,
  hookProjectile: 4,
} as const;

/** How long a blast still counts as the cause of a chained one. */
const CHAIN_LINK_WINDOW_MS = 250;
const RECENT_EXPLOSION_LIMIT = 8;
const SCREEN_SHAKE_MS = 160;
const SCREEN_SHAKE_BASE_PX = 4;
const SCREEN_SHAKE_MAX_PX = 6;
const SUDDEN_DEATH_FLASH_MS = 1400;

export function tileKeyOf(tile: TileCoord): string {
  return `${tile.x},${tile.y}`;
}

function trimTo<T>(list: T[], limit: number): void {
  if (list.length > limit) list.splice(0, list.length - limit);
}

export type CombatPresentation = ReturnType<typeof createCombatPresentation>;

export function createCombatPresentation(deps: CombatPresentationDeps) {
  const presentationFx: PresentationFx[] = [];
  const crateBreakFx: CrateBreakFx[] = [];
  const chainSparkFx: ChainSparkFx[] = [];
  const blinkTrailFx: BlinkTrailFx[] = [];
  const pressureWarnFx: PressureWarnFx[] = [];
  const hookProjectileFx: HookProjectileFx[] = [];
  const hookPullFx: HookPullFx[] = [];
  const recentExplosions: RecentExplosion[] = [];
  const deathAnims = new Map<CompetitorId, DeathAnim>();
  const championActionAnims = new Map<CompetitorId, TimedChampionAction>();
  const projectionPoses = new Map<CompetitorId, ProjectionPose>();
  const competitorPoses = new Map<CompetitorId, CompetitorPose>();
  const bombTilesById = new Map<number, TileCoord>();
  const bombPlaceFx = new Map<number, number>();
  const powerUpRevealFx = new Map<string, number>();
  /**
   * Post-teleport positions for hook victims, supplied by the renderer from the
   * snapshot it is about to draw. Kept separate from `competitorPoses`, which
   * still holds the pre-teleport pose the chain animates away from.
   */
  const pendingPullTargets = new Map<CompetitorId, { x: number; y: number }>();
  let screenShakeUntilMs = 0;
  let screenShakeAmplitudePx = 0;
  let suddenDeathFlashUntilMs = 0;

  /** Drop everything tied to a single round. Survives across rounds: nothing. */
  function clear(): void {
    presentationFx.length = 0;
    crateBreakFx.length = 0;
    chainSparkFx.length = 0;
    blinkTrailFx.length = 0;
    pressureWarnFx.length = 0;
    hookProjectileFx.length = 0;
    hookPullFx.length = 0;
    recentExplosions.length = 0;
    deathAnims.clear();
    championActionAnims.clear();
    projectionPoses.clear();
    competitorPoses.clear();
    bombTilesById.clear();
    bombPlaceFx.clear();
    powerUpRevealFx.clear();
    screenShakeUntilMs = 0;
    screenShakeAmplitudePx = 0;
    deps.resetLabRotation();
  }

  function ingestWorldEvent(event: GameEvent, nowMs: number): void {
    if (event.type === "power-up-revealed") {
      presentationFx.push({
        kind: "power-reveal",
        tileX: event.at.x,
        tileY: event.at.y,
        powerUpType: event.powerUpType,
        label: deps.powerUpLabel(event.powerUpType),
        startMs: nowMs,
      });
      powerUpRevealFx.set(tileKeyOf(event.at), nowMs);
      return;
    }
    if (event.type === "power-up-collected") {
      presentationFx.push({
        kind: "power-collect",
        tileX: event.at.x,
        tileY: event.at.y,
        powerUpType: event.powerUpType,
        label: deps.powerUpLabel(event.powerUpType),
        startMs: nowMs,
      });
      powerUpRevealFx.delete(tileKeyOf(event.at));
      deps.pulseHudStat(event.competitorId, event.powerUpType);
      deps.queueLabFx("power-up", { tileX: event.at.x, tileY: event.at.y }, nowMs);
      deps.queueLabFx("hud", "hud", nowMs);
      return;
    }
    if (event.type === "bomb-placed") {
      bombPlaceFx.set(event.bombId, nowMs);
      const action = deps.bombActionFor(event.competitorId);
      if (action) championActionAnims.set(event.competitorId, { action, startMs: nowMs });
      return;
    }
    if (event.type === "bomb-exploded") {
      // Screen shake stacks while a previous one is still decaying.
      if (!deps.prefersReducedMotion) {
        screenShakeAmplitudePx = nowMs < screenShakeUntilMs
          ? Math.min(SCREEN_SHAKE_MAX_PX, screenShakeAmplitudePx + 1)
          : SCREEN_SHAKE_BASE_PX;
        screenShakeUntilMs = nowMs + SCREEN_SHAKE_MS;
      }
      const originTile = bombTilesById.get(event.bombId) ?? event.flameTiles[0] ?? null;
      if (originTile) {
        // Chain link: a recent blast whose flames reached this bomb's tile.
        for (const previous of recentExplosions) {
          if (nowMs - previous.startMs > CHAIN_LINK_WINDOW_MS) continue;
          const linked = previous.flameTiles.some(
            (tile) => tile.x === originTile.x && tile.y === originTile.y,
          );
          if (linked) {
            chainSparkFx.push({ fromTile: previous.tile, toTile: originTile, startMs: nowMs });
            break;
          }
        }
        recentExplosions.push({
          bombId: event.bombId,
          tile: originTile,
          flameTiles: event.flameTiles,
          startMs: nowMs,
        });
        deps.queueLabFx("bomb", { tileX: originTile.x, tileY: originTile.y }, nowMs);
        trimTo(recentExplosions, RECENT_EXPLOSION_LIMIT);
      }
      bombPlaceFx.delete(event.bombId);
      bombTilesById.delete(event.bombId);
      return;
    }
    if (event.type === "crate-destroyed") {
      crateBreakFx.push({ tile: event.at, startMs: nowMs });
      deps.queueLabFx("hit", { tileX: event.at.x, tileY: event.at.y }, nowMs);
      return;
    }
    if (event.type === "competitor-eliminated") {
      const pose = competitorPoses.get(event.competitorId);
      if (pose) {
        deathAnims.set(event.competitorId, {
          position: { x: pose.x, y: pose.y },
          facing: pose.facing,
          startMs: nowMs,
        });
      }
      return;
    }
    if (event.type === "pressure-warning") {
      pressureWarnFx.push({
        tile: event.tile,
        startMs: nowMs,
        durationMs: Math.max(1, event.fallMs || event.remainingMs),
      });
      deps.queueLabFx("arena", { tileX: event.tile.x, tileY: event.tile.y }, nowMs);
      return;
    }
    if (event.type === "sudden-death-started") {
      suddenDeathFlashUntilMs = nowMs + SUDDEN_DEATH_FLASH_MS;
      return;
    }
    if (event.type === "round-started" || event.type === "restarted") {
      clear();
    }
  }

  /** First sequence the champion actually has frames for, else a plain cast. */
  function resolveAction(
    competitorId: CompetitorId,
    prefer: readonly ActionSource[],
  ): ChampionAction | null {
    for (const source of prefer) {
      const action = source === "bomb"
        ? deps.bombActionFor(competitorId)
        : deps.skillActionFor(competitorId);
      if (action) return action;
    }
    return null;
  }

  /**
   * Carry out one champion's cues.
   *
   * The champion module decides *what* should read on screen; this decides how
   * that lands in FX state. Neither knows the other's internals.
   */
  function applyCues(
    cues: readonly PresentationCue[],
    event: Extract<GameEvent, { type: "skill-channel-started" | "skill-resolved" }>,
    nowMs: number,
  ): void {
    for (const cue of cues) {
      if (cue.kind === "clear-action") {
        championActionAnims.delete(event.competitorId);
        continue;
      }
      if (cue.kind === "play-action") {
        const action = resolveAction(event.competitorId, cue.prefer);
        // A champion with no frames for any preferred sequence simply holds its
        // current pose — falling back to a sequence it lacks would draw nothing.
        if (!action) continue;
        championActionAnims.set(event.competitorId, {
          action,
          startMs: nowMs,
          ...(cue.durationMs === undefined ? {} : { durationMs: cue.durationMs }),
          ...(cue.buildMs === undefined ? {} : { buildMs: cue.buildMs }),
        });
        continue;
      }
      if (event.type !== "skill-resolved") continue;
      hookProjectileFx.push({
        ownerId: event.competitorId,
        originTile: event.origin,
        direction: event.aim,
        reachTiles: THRESH_HOOK_RANGE,
        hit: event.outcome === "hit",
        startMs: nowMs,
      });
      for (const victimId of event.targets) {
        const from = competitorPoses.get(victimId);
        const to = pendingPullTargets.get(victimId);
        if (!from || !to) continue;
        hookPullFx.push({
          victimId,
          fromPos: { x: from.x, y: from.y },
          toPos: { x: to.x, y: to.y },
          threshTile: event.origin,
          startMs: nowMs,
        });
      }
      pendingPullTargets.clear();
    }
  }

  /** Open a channel: ask the champion how its cast should read. */
  function ingestChannelStart(
    event: Extract<GameEvent, { type: "skill-channel-started" }>,
    nowMs: number,
  ): void {
    const champion = championPresentationFor(event.skillId);
    const cues = champion?.onChannelStart?.(event);
    if (cues) applyCues(cues, event, nowMs);
  }

  /**
   * Close a channel using the kernel's own verdict.
   *
   * `outcome` and `targets` reach the champion module untouched, so a failed
   * Living Shadow and a whiffed hook stay distinguishable without any adapter
   * reading cooldown magnitude.
   */
  function ingestSkillResolved(
    event: Extract<GameEvent, { type: "skill-resolved" }>,
    nowMs: number,
  ): void {
    const champion = championPresentationFor(event.skillId);
    const cues = champion?.onResolved?.(event);
    if (cues) applyCues(cues, event, nowMs);
  }

  /**
   * Fold one tick's events into visible state.
   *
   * `destinations` carries where hook victims ended up; without it a pull has a
   * start but no end, so the chain is skipped rather than drawn to nowhere.
   */
  function observe(
    events: readonly GameEvent[],
    nowMs: number,
    destinations?: ReadonlyMap<CompetitorId, { x: number; y: number }>,
  ): void {
    if (destinations) {
      pendingPullTargets.clear();
      for (const [id, pos] of destinations) pendingPullTargets.set(id, pos);
    }
    for (const event of events) {
      if (event.type === "skill-channel-started") ingestChannelStart(event, nowMs);
      else if (event.type === "skill-resolved") ingestSkillResolved(event, nowMs);
      else ingestWorldEvent(event, nowMs);
    }
    trimTo(presentationFx, FX_LIMITS.presentation);
    trimTo(crateBreakFx, FX_LIMITS.crateBreak);
    trimTo(chainSparkFx, FX_LIMITS.chainSpark);
    trimTo(blinkTrailFx, FX_LIMITS.blinkTrail);
    trimTo(pressureWarnFx, FX_LIMITS.pressureWarn);
    trimTo(hookProjectileFx, FX_LIMITS.hookProjectile);
  }

  /** Decaying camera offset, derived from the animation clock (never RNG). */
  function screenShakeOffset(animMs: number): { x: number; y: number } {
    if (animMs >= screenShakeUntilMs || screenShakeAmplitudePx <= 0) return { x: 0, y: 0 };
    const intensity = Math.min(1, (screenShakeUntilMs - animMs) / SCREEN_SHAKE_MS);
    const amplitude = screenShakeAmplitudePx * intensity;
    return {
      x: Math.sin(animMs * 0.073) * amplitude,
      y: Math.cos(animMs * 0.091) * amplitude,
    };
  }

  return {
    observe,
    clear,
    screenShakeOffset,
    suddenDeathFlashUntilMs: () => suddenDeathFlashUntilMs,
    // Mutable views the renderer sweeps as it draws and expires entries.
    presentationFx,
    crateBreakFx,
    chainSparkFx,
    blinkTrailFx,
    pressureWarnFx,
    hookProjectileFx,
    hookPullFx,
    recentExplosions,
    deathAnims,
    championActionAnims,
    projectionPoses,
    competitorPoses,
    bombTilesById,
    bombPlaceFx,
    powerUpRevealFx,
  };
}
