import { describe, expect, it } from "vitest";
import {
  createCombatPresentation,
  type ChampionAction,
  type CombatPresentationDeps,
  type LabFxAnchor,
  type LabFxCategory,
} from "../src/browser/combat-presentation.ts";
import type { CompetitorId, GameEvent, TileCoord } from "../src/contracts.ts";
import {
  RANNI_ICE_BLINK_SKILL_ID,
  THRESH_DEATH_SENTENCE_SKILL_ID,
  ZED_LIVING_SHADOW_SKILL_ID,
} from "../src/contracts.ts";

/**
 * These tests exercise the presentation module through its interface. They
 * replace source-text greps over main.ts, which passed whenever a string
 * happened to appear and broke whenever code moved.
 */

const ALPHA = "competitor-a" as CompetitorId;
const BETA = "competitor-b" as CompetitorId;

type Recorded = { category: LabFxCategory; anchor: LabFxAnchor; startMs: number };

function harness(overrides: Partial<CombatPresentationDeps> = {}) {
  const labFx: Recorded[] = [];
  const hudPulses: { competitorId: CompetitorId; type: string }[] = [];
  let rotationResets = 0;
  const presentation = createCombatPresentation({
    bombActionFor: () => "attack" as ChampionAction,
    skillActionFor: () => "cast" as ChampionAction,
    powerUpLabel: (type) => (type === "bomb-up" ? "+BOMB" : "+RANGE"),
    prefersReducedMotion: false,
    queueLabFx: (category, anchor, startMs) => labFx.push({ category, anchor, startMs }),
    pulseHudStat: (competitorId, type) => hudPulses.push({ competitorId, type }),
    resetLabRotation: () => { rotationResets += 1; },
    ...overrides,
  });
  return { presentation, labFx, hudPulses, resets: () => rotationResets };
}

function tile(x: number, y: number): TileCoord {
  return Object.freeze({ x, y });
}

function channelStarted(skillId: GameEvent extends never ? never : string): GameEvent {
  return {
    type: "skill-channel-started",
    competitorId: ALPHA,
    skillId: skillId as never,
    aim: "right",
    origin: tile(1, 1),
    channelMs: 400,
  } as GameEvent;
}

function resolved(
  skillId: string,
  outcome: "hit" | "miss" | "cancelled",
  targets: readonly CompetitorId[] = [],
): GameEvent {
  return {
    type: "skill-resolved",
    competitorId: ALPHA,
    skillId: skillId as never,
    outcome,
    aim: "right",
    origin: tile(1, 1),
    targets,
  } as GameEvent;
}

describe("combat presentation — world events", () => {
  it("shows a revealed power-up and clears the marker once it is collected", () => {
    const { presentation, hudPulses } = harness();
    presentation.observe([
      { type: "power-up-revealed", at: tile(3, 4), powerUpType: "bomb-up" },
    ], 100);
    expect(presentation.presentationFx).toHaveLength(1);
    expect(presentation.presentationFx[0]).toMatchObject({
      kind: "power-reveal", tileX: 3, tileY: 4, label: "+BOMB",
    });
    expect(presentation.powerUpRevealFx.get("3,4")).toBe(100);

    presentation.observe([{
      type: "power-up-collected",
      competitorId: ALPHA, at: tile(3, 4), powerUpType: "bomb-up",
      maxBombs: 2, flameRange: 2,
    }], 200);
    expect(presentation.powerUpRevealFx.has("3,4")).toBe(false);
    expect(presentation.presentationFx.at(-1)?.kind).toBe("power-collect");
    expect(hudPulses).toEqual([{ competitorId: ALPHA, type: "bomb-up" }]);
  });

  it("links a chained explosion only when the earlier blast reached its tile", () => {
    const { presentation } = harness();
    presentation.observe([
      { type: "bomb-placed", bombId: 1, competitorId: ALPHA, at: tile(1, 1) },
      { type: "bomb-placed", bombId: 2, competitorId: ALPHA, at: tile(1, 3) },
    ], 0);
    presentation.bombTilesById.set(1, tile(1, 1));
    presentation.bombTilesById.set(2, tile(1, 3));

    presentation.observe([{
      type: "bomb-exploded", bombId: 1, competitorId: ALPHA,
      flameTiles: [tile(1, 1), tile(1, 2), tile(1, 3)],
    }], 10);
    expect(presentation.chainSparkFx).toHaveLength(0);

    presentation.observe([{
      type: "bomb-exploded", bombId: 2, competitorId: ALPHA,
      flameTiles: [tile(1, 3)],
    }], 60);
    expect(presentation.chainSparkFx).toHaveLength(1);
    expect(presentation.chainSparkFx[0]).toMatchObject({
      fromTile: { x: 1, y: 1 }, toTile: { x: 1, y: 3 },
    });
  });

  it("does not link an explosion outside the chain window", () => {
    const { presentation } = harness();
    presentation.bombTilesById.set(1, tile(1, 1));
    presentation.bombTilesById.set(2, tile(1, 3));
    presentation.observe([{
      type: "bomb-exploded", bombId: 1, competitorId: ALPHA,
      flameTiles: [tile(1, 1), tile(1, 3)],
    }], 0);
    presentation.observe([{
      type: "bomb-exploded", bombId: 2, competitorId: ALPHA,
      flameTiles: [tile(1, 3)],
    }], 5_000);
    expect(presentation.chainSparkFx).toHaveLength(0);
  });

  it("suppresses screen shake when the player asked for reduced motion", () => {
    const shaking = harness().presentation;
    const still = harness({ prefersReducedMotion: true }).presentation;
    const blast: GameEvent = {
      type: "bomb-exploded", bombId: 1, competitorId: ALPHA, flameTiles: [tile(1, 1)],
    };
    shaking.observe([blast], 0);
    still.observe([blast], 0);
    expect(shaking.screenShakeOffset(20)).not.toEqual({ x: 0, y: 0 });
    expect(still.screenShakeOffset(20)).toEqual({ x: 0, y: 0 });
  });

  it("captures a death pose only when the competitor was already on screen", () => {
    const { presentation } = harness();
    const elimination: GameEvent = {
      type: "competitor-eliminated", competitorId: ALPHA, causes: [],
    };
    presentation.observe([elimination], 100);
    expect(presentation.deathAnims.has(ALPHA)).toBe(false);

    presentation.competitorPoses.set(ALPHA, { x: 48, y: 96, facing: "south" });
    presentation.observe([elimination], 200);
    expect(presentation.deathAnims.get(ALPHA)).toMatchObject({
      position: { x: 48, y: 96 }, facing: "south", startMs: 200,
    });
  });

  it("wipes every effect and resets lab rotation when a round starts", () => {
    const { presentation, resets } = harness();
    presentation.observe([
      { type: "power-up-revealed", at: tile(1, 1), powerUpType: "flame-up" },
      { type: "crate-destroyed", at: tile(2, 2) },
    ], 0);
    expect(presentation.presentationFx.length + presentation.crateBreakFx.length).toBe(2);

    presentation.observe([{ type: "round-started", roundNumber: 2, roundSeed: "s" }], 10);
    expect(presentation.presentationFx).toHaveLength(0);
    expect(presentation.crateBreakFx).toHaveLength(0);
    expect(resets()).toBe(1);
  });

  it("caps each effect backlog so a long match cannot grow unbounded", () => {
    const { presentation } = harness();
    for (let i = 0; i < 40; i += 1) {
      presentation.observe([{ type: "crate-destroyed", at: tile(i, 0) }], i);
    }
    expect(presentation.crateBreakFx).toHaveLength(24);
    // Oldest dropped first: the newest crate survives.
    expect(presentation.crateBreakFx.at(-1)?.tile.x).toBe(39);
  });
});

describe("combat presentation — skills use the kernel's verdict", () => {
  it("opens a cast sequence with Ice Blink's build timing", () => {
    const { presentation } = harness();
    presentation.observe([channelStarted(RANNI_ICE_BLINK_SKILL_ID)], 50);
    const anim = presentation.championActionAnims.get(ALPHA);
    expect(anim).toMatchObject({ action: "cast", startMs: 50 });
    expect(anim?.buildMs).toBeGreaterThan(0);
    expect(anim?.durationMs).toBeGreaterThan(0);
  });

  it("drops the frozen-body sequence when Ice Blink resolves", () => {
    const { presentation } = harness();
    presentation.observe([channelStarted(RANNI_ICE_BLINK_SKILL_ID)], 0);
    presentation.observe([resolved(RANNI_ICE_BLINK_SKILL_ID, "hit")], 100);
    expect(presentation.championActionAnims.has(ALPHA)).toBe(false);
  });

  it("plays swap recovery on a successful Living Shadow and a shorter cancel otherwise", () => {
    const { presentation } = harness();
    presentation.observe([resolved(ZED_LIVING_SHADOW_SKILL_ID, "hit")], 0);
    const swap = presentation.championActionAnims.get(ALPHA)!;
    presentation.observe([resolved(ZED_LIVING_SHADOW_SKILL_ID, "cancelled")], 100);
    const cancel = presentation.championActionAnims.get(ALPHA)!;

    expect(swap.durationMs).toBeGreaterThan(cancel.durationMs!);
    // A committed swap recovers through the bomb sequence, a cancel through cast.
    expect(swap.action).toBe("attack");
    expect(cancel.action).toBe("cast");
  });

  it("falls back to cast when a champion has no bomb sequence frames", () => {
    const { presentation } = harness({ bombActionFor: () => null });
    presentation.observe([resolved(ZED_LIVING_SHADOW_SKILL_ID, "hit")], 0);
    expect(presentation.championActionAnims.get(ALPHA)?.action).toBe("cast");
  });

  it("fires a hook projectile whose hit flag is the kernel's outcome", () => {
    const { presentation } = harness();
    presentation.observe([resolved(THRESH_DEATH_SENTENCE_SKILL_ID, "miss")], 0);
    expect(presentation.hookProjectileFx).toHaveLength(1);
    expect(presentation.hookProjectileFx[0]).toMatchObject({
      ownerId: ALPHA, hit: false, direction: "right", originTile: { x: 1, y: 1 },
    });
    expect(presentation.hookPullFx).toHaveLength(0);
  });

  it("pulls exactly the victims the kernel named, from their pre-teleport pose", () => {
    const { presentation } = harness();
    presentation.competitorPoses.set(BETA, { x: 500, y: 100, facing: "west" });
    presentation.observe(
      [resolved(THRESH_DEATH_SENTENCE_SKILL_ID, "hit", [BETA])],
      0,
      new Map([[BETA, { x: 120, y: 100 }]]),
    );
    expect(presentation.hookProjectileFx[0]?.hit).toBe(true);
    expect(presentation.hookPullFx).toHaveLength(1);
    expect(presentation.hookPullFx[0]).toMatchObject({
      victimId: BETA, fromPos: { x: 500, y: 100 }, toPos: { x: 120, y: 100 },
    });
  });

  it("skips a pull when the victim's destination is unknown", () => {
    const { presentation } = harness();
    presentation.competitorPoses.set(BETA, { x: 500, y: 100, facing: "west" });
    presentation.observe([resolved(THRESH_DEATH_SENTENCE_SKILL_ID, "hit", [BETA])], 0);
    expect(presentation.hookPullFx).toHaveLength(0);
  });
});
