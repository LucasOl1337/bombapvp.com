import { describe, expect, it } from "vitest";
import { createLabTelemetry } from "../src/lab/telemetry.ts";
import type { OnlineGameSnapshot } from "../src/original-game/NetCode/protocol.ts";

function gameSnapshot(): OnlineGameSnapshot {
  const player = (id: 1 | 2, alive: boolean) => ({
    id,
    name: `P${id}`,
    active: true,
    tile: { x: id, y: id },
    position: { x: id * 32, y: id * 32 },
    velocity: { x: 0, y: 0 },
    alive,
    direction: "right" as const,
    lastMoveDirection: "right" as const,
    maxBombs: id + 1,
    activeBombs: 1,
    flameRange: id + 2,
    speedLevel: id,
    remoteLevel: id - 1,
    shieldCharges: id - 1,
    bombPassLevel: id - 1,
    kickLevel: id - 1,
    shortFuseLevel: id - 1,
    flameGuardMs: 0,
    spawnProtectionMs: 0,
    skill: {
      id: null,
      phase: "idle" as const,
      channelRemainingMs: 0,
      cooldownRemainingMs: 0,
      castElapsedMs: 0,
      projectedPosition: null,
      projectedLastMoveDirection: null,
    },
  });
  return {
    serverTimeMs: 0,
    serverTick: 0,
    frameId: 0,
    ackedInputSeq: { 1: 0, 2: 0, 3: 0, 4: 0 },
    mode: "match",
    roomMode: "endless",
    arena: {
      id: "arena", name: "Arena", status: "active", themeId: "test",
      grid: { width: 5, height: 5 }, tiles: { solid: [], breakable: [] }, spawns: [],
      version: "v1", createdAt: "", updatedAt: "", wrapPortals: [], suddenDeathPath: [],
      spawnMap: {} as OnlineGameSnapshot["arena"]["spawnMap"],
    },
    breakableTiles: [], powerUps: [],
    players: {
      1: player(1, true),
      2: player(2, false),
      3: { id: 3, name: "P3", active: false } as OnlineGameSnapshot["players"][3],
      4: { id: 4, name: "P4", active: false } as OnlineGameSnapshot["players"][4],
    },
    bombs: [], flames: [], magicBeams: [], nextBombId: 1,
    score: { 1: 1, 2: 0, 3: 0, 4: 0 }, roundNumber: 2, roundTimeMs: 30_000,
    paused: false, roundOutcome: null, matchWinner: null, animationClockMs: 2_000,
    suddenDeathActive: false, suddenDeathTickMs: 0, suddenDeathIndex: 0,
    suddenDeathClosedTiles: [], suddenDeathClosingTiles: [], showDangerOverlay: false,
    showBombPreview: false, selectedCharacterIndex: { 1: 0, 2: 1, 3: 2, 4: 3 },
    activePlayerIds: [1, 2], botPlayerIds: [1],
    endlessStats: {
      kills: { 1: 3, 2: 1, 3: 0, 4: 0 },
      roundWins: { 1: 1, 2: 0, 3: 0, 4: 0 },
      deaths: { 1: 2, 2: 4, 3: 0, 4: 0 },
      selfDeaths: { 1: 1, 2: 2, 3: 0, 4: 0 },
      opponentDeaths: { 1: 1, 2: 1, 3: 0, 4: 0 },
      suddenDeathDeaths: { 1: 0, 2: 1, 3: 0, 4: 0 },
      environmentDeaths: { 1: 0, 2: 0, 3: 0, 4: 0 },
    },
  };
}

describe("telemetria do laboratorio", () => {
  it("aceita snapshots anteriores aos contadores de morte", () => {
    const snapshot = gameSnapshot();
    snapshot.endlessStats = {
      kills: { 1: 3, 2: 1, 3: 0, 4: 0 },
      roundWins: { 1: 1, 2: 0, 3: 0, 4: 0 },
    };
    const telemetry = createLabTelemetry([
      { playerId: 1, label: "V1", kind: "v1" },
    ], () => 0);

    expect(telemetry.read(snapshot).players[0]!.gameplay).toMatchObject({
      deaths: 0,
      selfDeaths: 0,
      opponentDeaths: 0,
      suddenDeathDeaths: 0,
      environmentDeaths: 0,
    });
  });

  it("resume velocidade, comportamento, tokens e resultado de cada bot", () => {
    let nowMs = 0;
    const telemetry = createLabTelemetry([
      { playerId: 1, label: "V1", kind: "v1" },
      { playerId: 2, label: "GPT", kind: "llm" },
    ], () => nowMs);

    telemetry.record({
      type: "decision", playerId: 1, decisionMs: 1,
      action: { direction: "right", placeBomb: true },
    });
    telemetry.record({
      type: "decision", playerId: 1, decisionMs: 3,
      action: { direction: null, placeBomb: false },
    });
    telemetry.record({ type: "request", playerId: 2 });
    nowMs = 100;
    telemetry.record({
      type: "decision", playerId: 2, decisionMs: 100, upstreamLatencyMs: 80,
      action: { direction: "left", placeBomb: false },
      usage: { inputTokens: 100, outputTokens: 10, totalTokens: 110 },
    });
    nowMs = 105;
    telemetry.record({ type: "request", playerId: 2 });
    nowMs = 305;
    telemetry.record({
      type: "decision", playerId: 2, decisionMs: 200, upstreamLatencyMs: 150,
      action: { direction: "left", placeBomb: true, detonate: true, useSkill: true },
      usage: { inputTokens: 120, outputTokens: 20, totalTokens: 140 },
    });
    telemetry.record({ type: "error", playerId: 2 });
    nowMs = 500;
    telemetry.record({ type: "request", playerId: 2 });
    telemetry.record({ type: "status", playerId: 2, status: "waiting" });
    nowMs = 1_500;
    telemetry.record({ type: "request", playerId: 2 });
    nowMs = 2_000;

    const report = telemetry.read(gameSnapshot());
    expect(report).toMatchObject({ sessionElapsedMs: 2_000 });
    expect(report.players[0]).toMatchObject({
      kind: "v1",
      timing: { kind: "compute", lastMs: 3, averageMs: 2, p95Ms: 3 },
      decisions: { count: 2, perSecond: 1, errors: 0 },
      actions: { changeRatePct: 100, movementPct: 50, bombIntentPct: 50 },
      gameplay: {
        alive: true, kills: 3, roundWins: 1, deaths: 2, selfDeaths: 1,
        opponentDeaths: 1, suddenDeathDeaths: 0, environmentDeaths: 0,
        bombsAvailable: 1, bombCapacity: 2,
        flameRange: 3, speedLevel: 1, remoteLevel: 0, bombPassLevel: 0, kickLevel: 0, shortFuseLevel: 0,
      },
    });
    expect(report.players[1]).toMatchObject({
      kind: "llm",
      status: "waiting",
      timing: {
        kind: "round-trip", averageMs: 150, p95Ms: 200,
        upstreamAverageMs: 115, transportAverageMs: 35, pollGapAverageMs: 5, pollingUtilizationPct: 95.2,
      },
      decisions: { count: 2, perSecond: 1, errors: 1 },
      actions: {
        latest: { direction: "left", placeBomb: true, detonate: true, useSkill: true },
        latestAgeMs: 1_695,
        changeRatePct: 100,
        bombIntentPct: 50,
        detonateIntentPct: 50,
        skillIntentPct: 50,
      },
      tokens: { inputTokens: 220, outputTokens: 30, totalTokens: 250 },
      gameplay: {
        alive: false, kills: 1, deaths: 4, selfDeaths: 2, opponentDeaths: 1,
        suddenDeathDeaths: 1, environmentDeaths: 0, bombsAvailable: 2, bombCapacity: 3, shieldCharges: 1,
        remoteLevel: 1, bombPassLevel: 1, kickLevel: 1, shortFuseLevel: 1,
      },
    });
  });
});
