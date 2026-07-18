import { describe, expect, it, vi } from "vitest";
import {
  createLabClient,
  LabPublicError,
  type LabDecider,
  type LabDecisionResult,
} from "../src/lab/client.ts";
import type { LabMatchCompetitor } from "../src/lab/competitors.ts";
import {
  startLabRuntime,
  type LabMatch,
  type LabMatchSession,
} from "../src/lab/runtime.ts";
import type { PlayerId } from "../src/original-game/Gameplay/types.ts";
import type { OnlineGameSnapshot, OnlineInputState } from "../src/original-game/NetCode/protocol.ts";

function gameSnapshot(): OnlineGameSnapshot {
  const player = (id: 1 | 2) => ({
    id,
    name: `P${id}`,
    active: true,
    tile: { x: id, y: id },
    position: { x: id * 32, y: id * 32 },
    velocity: { x: 0, y: 0 },
    alive: true,
    direction: "right" as const,
    lastMoveDirection: "right" as const,
    maxBombs: 2,
    activeBombs: 0,
    flameRange: 3,
    speedLevel: 1,
    remoteLevel: 0,
    shieldCharges: 0,
    bombPassLevel: 0,
    kickLevel: 0,
    shortFuseLevel: 0,
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
      id: "arena",
      name: "Arena",
      status: "active",
      themeId: "test",
      grid: { width: 5, height: 5 },
      tiles: { solid: [], breakable: [] },
      spawns: [],
      version: "v1",
      createdAt: "",
      updatedAt: "",
      wrapPortals: [],
      suddenDeathPath: [],
      spawnMap: {} as OnlineGameSnapshot["arena"]["spawnMap"],
    },
    breakableTiles: [],
    powerUps: [],
    players: {
      1: player(1),
      2: player(2),
      3: { id: 3, name: "P3", active: false } as OnlineGameSnapshot["players"][3],
      4: { id: 4, name: "P4", active: false } as OnlineGameSnapshot["players"][4],
    },
    bombs: [],
    flames: [],
    magicBeams: [],
    nextBombId: 1,
    score: { 1: 0, 2: 0, 3: 0, 4: 0 },
    roundNumber: 1,
    roundTimeMs: 0,
    paused: false,
    roundOutcome: null,
    matchWinner: null,
    animationClockMs: 0,
    suddenDeathActive: false,
    suddenDeathTickMs: 0,
    suddenDeathIndex: 0,
    suddenDeathClosedTiles: [],
    suddenDeathClosingTiles: [],
    showDangerOverlay: false,
    showBombPreview: false,
    selectedCharacterIndex: { 1: 0, 2: 1, 3: 2, 4: 3 },
    activePlayerIds: [1, 2],
    botPlayerIds: [1],
    endlessStats: {
      kills: { 1: 0, 2: 0, 3: 0, 4: 0 },
      roundWins: { 1: 0, 2: 0, 3: 0, 4: 0 },
      deaths: { 1: 0, 2: 0, 3: 0, 4: 0 },
      selfDeaths: { 1: 0, 2: 0, 3: 0, 4: 0 },
      opponentDeaths: { 1: 0, 2: 0, 3: 0, 4: 0 },
      suddenDeathDeaths: { 1: 0, 2: 0, 3: 0, 4: 0 },
      environmentDeaths: { 1: 0, 2: 0, 3: 0, 4: 0 },
    },
  };
}

function expectOnlyFiniteNumbers(value: unknown): void {
  if (typeof value === "number") {
    expect(Number.isFinite(value)).toBe(true);
    expect(value).toBeGreaterThanOrEqual(0);
    return;
  }
  if (Array.isArray(value)) {
    for (const entry of value) expectOnlyFiniteNumbers(entry);
    return;
  }
  if (value && typeof value === "object") {
    for (const entry of Object.values(value)) expectOnlyFiniteNumbers(entry);
  }
}

class FakeMatch implements LabMatch {
  public session: LabMatchSession | null = null;
  public snapshot = gameSnapshot();
  public readonly clearedPlayers: PlayerId[] = [];
  public readonly appliedInputs: Array<Readonly<{ playerId: PlayerId; input: OnlineInputState }>> = [];
  public safetyInput: OnlineInputState | null = null;

  startSession(session: LabMatchSession): void {
    this.session = session;
  }

  readSnapshot(): OnlineGameSnapshot {
    return this.snapshot;
  }

  setPlayerInput(playerId: PlayerId, input: OnlineInputState): void {
    this.appliedInputs.push({ playerId, input });
  }

  replacePlayerInput(playerId: PlayerId, input: OnlineInputState): void {
    this.appliedInputs.push({ playerId, input });
  }

  getSafetyInput(_playerId: PlayerId, _intendedInput: OnlineInputState): OnlineInputState | null {
    return this.safetyInput;
  }

  clearPlayerInput(playerId: PlayerId): void {
    this.clearedPlayers.push(playerId);
  }
}

const pendingDecider: LabDecider = {
  decide: vi.fn(() => new Promise<never>(() => undefined)),
};

describe("runtime do laboratorio", () => {
  it("inicia um roster misto e incorpora decisoes locais ao relatorio", () => {
    const match = new FakeMatch();
    const competitors: readonly LabMatchCompetitor[] = [
      { playerId: 1, model: "bot-v2", kind: "v2", label: "Bomb V2" },
      { playerId: 2, model: "cx/gpt-5.6-luna", kind: "llm", label: "Luna" },
    ];

    const runtime = startLabRuntime({ match, decider: pendingDecider, competitors });
    match.session?.recordLocalDecision({
      playerId: 1,
      computeMs: 3,
      decision: { direction: "right", placeBomb: true },
    });

    expect(match.session).toMatchObject({
      activePlayerIds: [1, 2],
      localCompetitors: [{ playerId: 1, kind: "v2" }],
      playerLabels: { 1: "Bomb V2", 2: "Luna", 3: "", 4: "" },
    });
    expect(runtime.readReport().players).toMatchObject([
      {
        playerId: 1,
        label: "Bomb V2",
        kind: "v2",
        decisions: { count: 1 },
        actions: { latest: { direction: "right", placeBomb: true } },
      },
      { playerId: 2, label: "Luna", kind: "llm" },
    ]);

    runtime.stop();
  });

  it("coordena uma decisao remota pelo port do jogo e a registra na telemetria", async () => {
    vi.useFakeTimers();
    const match = new FakeMatch();
    const never = new Promise<never>(() => undefined);
    const decider: LabDecider = {
      decide: vi.fn()
        .mockResolvedValueOnce({
          decision: { direction: "left", placeBomb: true, detonate: true, useSkill: false },
          roundTripMs: 80,
          upstreamLatencyMs: 50,
          usage: { inputTokens: 40, outputTokens: 5, totalTokens: 45 },
          requestId: "lab-test-1",
        })
        .mockReturnValue(never),
    };
    const competitors: readonly LabMatchCompetitor[] = [
      { playerId: 1, model: "cx/gpt-5.6-sol", kind: "llm", label: "Sol" },
    ];

    try {
      const runtime = startLabRuntime({
        match,
        decider,
        competitors,
        now: () => 100,
        observe: (_snapshot, playerId) => ({ playerId, tactical: true }),
        scheduling: { decisionPollMs: 100, motorIntervalMs: 10 },
      });
      await vi.advanceTimersByTimeAsync(50);

      expect(decider.decide).toHaveBeenCalledWith(expect.objectContaining({
        model: "cx/gpt-5.6-sol",
        observation: { playerId: 1, tactical: true },
        requestId: expect.stringMatching(/^lab-/),
      }), expect.any(AbortSignal));
      expect(runtime.readReport().players[0]).toMatchObject({
        status: "acting",
        timing: {
          lastMs: 80,
          averageMs: 80,
          upstreamAverageMs: 50,
          transportAverageMs: 30,
          pollGapAverageMs: null,
        },
        decisions: { count: 1, errors: 0 },
        actions: {
          latest: { direction: "left", placeBomb: true, detonate: true, useSkill: false },
        },
        tokens: { inputTokens: 40, outputTokens: 5, totalTokens: 45 },
      });
      expect(match.snapshot).toBeDefined();
      runtime.stop();
    } finally {
      vi.useRealTimers();
    }
  });

  it("suprime ataques quando a camada de seguranca substitui o movimento remoto", async () => {
    vi.useFakeTimers();
    const match = new FakeMatch();
    match.safetyInput = {
      direction: "right",
      bombPressed: false,
      detonatePressed: false,
      skillPressed: false,
      skillHeld: false,
    };
    const decider: LabDecider = {
      decide: vi.fn().mockResolvedValue({
        decision: { direction: "left", placeBomb: true, detonate: true, useSkill: true },
        roundTripMs: 10,
        upstreamLatencyMs: 5,
        usage: null,
        requestId: "lab-safety-1",
      }),
    };
    const runtime = startLabRuntime({
      match,
      decider,
      competitors: [{ playerId: 1, model: "cx/gpt-5.6-sol", kind: "llm", label: "Sol" }],
      scheduling: { decisionPollMs: 100, motorIntervalMs: 10 },
    });

    try {
      await vi.advanceTimersByTimeAsync(10);

      expect(match.appliedInputs[0]).toEqual({
        playerId: 1,
        input: {
          direction: "right",
          bombPressed: false,
          detonatePressed: false,
          skillPressed: false,
          skillHeld: false,
        },
      });
      expect(runtime.readReport().players[0]?.motor.safetyOverrides).toBe(1);
    } finally {
      runtime.stop();
      vi.useRealTimers();
    }
  });

  it("limita cada competidor remoto a uma requisicao em voo, mesmo com quatro lanes", async () => {
    vi.useFakeTimers();
    const match = new FakeMatch();
    const decide = vi.fn((
      _request: Parameters<LabDecider["decide"]>[0],
      _signal?: AbortSignal,
    ) => new Promise<never>(() => undefined));
    const decider: LabDecider = { decide };
    const runtime = startLabRuntime({
      match,
      decider,
      competitors: [
        { playerId: 1, model: "cx/gpt-5.6-luna", kind: "llm", label: "Luna" },
        { playerId: 2, model: "cx/gpt-5.6-sol", kind: "llm", label: "Sol" },
      ],
      scheduling: { decisionLanes: 4, decisionPollMs: 10 },
    });
    try {
      await vi.advanceTimersByTimeAsync(1_000);
      expect(decide).toHaveBeenCalledTimes(2);
      expect(decide.mock.calls.map(([request]) => request.observation)).toHaveLength(2);
    } finally {
      runtime.stop();
      vi.useRealTimers();
    }
  });

  it("cancela a leitura da rodada anterior antes de ocupar a lane com a rodada nova", async () => {
    vi.useFakeTimers();
    const match = new FakeMatch();
    const signals: AbortSignal[] = [];
    const decider: LabDecider = {
      decide: vi.fn((request, signal) => {
        signals.push(signal!);
        expect((request.observation as { snapshot: OnlineGameSnapshot }).snapshot.roundNumber)
          .toBe(signals.length);
        return new Promise<never>(() => undefined);
      }),
    };
    const runtime = startLabRuntime({
      match,
      decider,
      competitors: [{ playerId: 1, model: "cx/gpt-5.6-sol", kind: "llm", label: "Sol" }],
      scheduling: { decisionPollMs: 10 },
    });

    try {
      await vi.advanceTimersByTimeAsync(0);
      expect(decider.decide).toHaveBeenCalledTimes(1);
      expect(signals[0]?.aborted).toBe(false);

      match.snapshot = { ...match.snapshot, roundNumber: 2 };
      await vi.advanceTimersByTimeAsync(10);

      expect(signals[0]?.aborted).toBe(true);
      expect(decider.decide).toHaveBeenCalledTimes(2);
      expect(signals[1]?.aborted).toBe(false);
    } finally {
      runtime.stop();
      vi.useRealTimers();
    }
  });

  it.each(["observation", "decider"] as const)(
    "libera a lane quando o adapter de %s falha sincronicamente",
    async (failurePoint) => {
      vi.useFakeTimers();
      const match = new FakeMatch();
      const observe = vi.fn(() => ({ ok: true }));
      const decide = vi.fn(() => new Promise<never>(() => undefined));
      if (failurePoint === "observation") {
        observe.mockImplementationOnce(() => { throw new Error("observation_failed"); });
      } else {
        decide.mockImplementationOnce(() => { throw new Error("decider_failed"); });
      }
      const runtime = startLabRuntime({
        match,
        decider: { decide },
        competitors: [{ playerId: 1, model: "cx/gpt-5.6-sol", kind: "llm", label: "Sol" }],
        observe,
        scheduling: { decisionPollMs: 10 },
        now: () => Date.now(),
      });

      try {
        await vi.advanceTimersByTimeAsync(100);

        expect(observe).toHaveBeenCalledTimes(2);
        expect(decide).toHaveBeenCalledTimes(failurePoint === "observation" ? 1 : 2);
      } finally {
        runtime.stop();
        vi.useRealTimers();
      }
    },
  );

  it("nao reaplica na rodada seguinte uma intencao aceita na rodada anterior", async () => {
    vi.useFakeTimers();
    const match = new FakeMatch();
    const decider: LabDecider = {
      decide: vi.fn()
        .mockResolvedValueOnce({
          decision: { direction: "left", placeBomb: false, detonate: false, useSkill: false },
          roundTripMs: 10,
          upstreamLatencyMs: 5,
          usage: null,
          requestId: "lab-round-one",
        })
        .mockReturnValue(new Promise<never>(() => undefined)),
    };
    const runtime = startLabRuntime({
      match,
      decider,
      competitors: [{ playerId: 1, model: "cx/gpt-5.6-sol", kind: "llm", label: "Sol" }],
      scheduling: { decisionPollMs: 100, motorIntervalMs: 50 },
    });

    try {
      await vi.advanceTimersByTimeAsync(0);
      match.snapshot = { ...match.snapshot, roundNumber: 2 };
      await vi.advanceTimersByTimeAsync(50);

      expect(match.appliedInputs).toEqual([]);
      expect(match.clearedPlayers).toContain(1);
    } finally {
      runtime.stop();
      vi.useRealTimers();
    }
  });

  it("descarta da telemetria uma resposta que chegou depois da rodada", async () => {
    vi.useFakeTimers();
    const match = new FakeMatch();
    let resolveDecision!: (result: LabDecisionResult) => void;
    const decider: LabDecider = {
      decide: vi.fn(() => new Promise<LabDecisionResult>((resolve) => { resolveDecision = resolve; })),
    };
    const runtime = startLabRuntime({
      match,
      decider,
      competitors: [{ playerId: 1, model: "cx/gpt-5.6-sol", kind: "llm", label: "Sol" }],
      scheduling: { decisionPollMs: 100, motorIntervalMs: 50 },
    });

    try {
      await vi.advanceTimersByTimeAsync(0);
      match.snapshot = { ...match.snapshot, roundNumber: 2 };
      resolveDecision({
        decision: { direction: "right", placeBomb: true, detonate: false, useSkill: false },
        roundTripMs: 10,
        upstreamLatencyMs: 5,
        usage: null,
        requestId: "lab-stale-round-one",
      });
      await vi.advanceTimersByTimeAsync(0);

      expect(runtime.readReport().players[0]?.decisions.count).toBe(0);
      expect(match.appliedInputs).toEqual([]);
    } finally {
      runtime.stop();
      vi.useRealTimers();
    }
  });

  it("descarta como stale uma decisao que excede a idade maxima configurada", async () => {
    vi.useFakeTimers();
    const match = new FakeMatch();
    let clockMs = 0;
    let resolveDecision!: (result: LabDecisionResult) => void;
    const decider: LabDecider = {
      decide: vi.fn()
        .mockReturnValueOnce(new Promise<LabDecisionResult>((resolve) => {
          resolveDecision = resolve;
        }))
        .mockReturnValue(new Promise<never>(() => undefined)),
    };
    const runtime = startLabRuntime({
      match,
      decider,
      competitors: [{ playerId: 1, model: "cx/gpt-5.6-sol", kind: "llm", label: "Sol" }],
      scheduling: { decisionPollMs: 10, motorIntervalMs: 10, maxDecisionAgeMs: 6_000 },
      now: () => clockMs,
    });

    try {
      await vi.advanceTimersByTimeAsync(0);
      clockMs = 6_001;
      resolveDecision({
        decision: { direction: "left", placeBomb: true, detonate: false, useSkill: false },
        roundTripMs: 20,
        upstreamLatencyMs: 15,
        usage: { inputTokens: 120, outputTokens: 8, totalTokens: 128 },
        requestId: "lab-stale-age-1",
      });
      await vi.advanceTimersByTimeAsync(0);

      expect({
        appliedInputs: match.appliedInputs,
        player: runtime.readReport().players[0],
      }).toMatchObject({
        appliedInputs: [],
        player: {
          timing: { lastMs: null, averageMs: null },
          decisions: {
            count: 0,
            errors: 0,
            discarded: {
              stale: {
                count: 1,
                timing: {
                  lastMs: 6_001,
                  averageMs: 6_001,
                  upstreamAverageMs: 15,
                  transportAverageMs: 5_986,
                },
                tokens: { inputTokens: 120, outputTokens: 8, totalTokens: 128 },
              },
            },
          },
          tokens: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
          actions: { latest: null },
        },
      });
    } finally {
      runtime.stop();
      vi.useRealTimers();
    }
  });

  it("aplica a decisao cuja idade coincide com o limite inclusivo", async () => {
    vi.useFakeTimers();
    const match = new FakeMatch();
    let clockMs = 0;
    let resolveDecision!: (result: LabDecisionResult) => void;
    const decider: LabDecider = {
      decide: vi.fn()
        .mockReturnValueOnce(new Promise<LabDecisionResult>((resolve) => {
          resolveDecision = resolve;
        }))
        .mockReturnValue(new Promise<never>(() => undefined)),
    };
    const runtime = startLabRuntime({
      match,
      decider,
      competitors: [{ playerId: 1, model: "cx/gpt-5.6-sol", kind: "llm", label: "Sol" }],
      scheduling: { decisionPollMs: 10, motorIntervalMs: 10, maxDecisionAgeMs: 6_000 },
      now: () => clockMs,
    });

    try {
      await vi.advanceTimersByTimeAsync(0);
      clockMs = 6_000;
      resolveDecision({
        decision: { direction: "right", placeBomb: false, detonate: false, useSkill: false },
        roundTripMs: 20,
        upstreamLatencyMs: 15,
        usage: { inputTokens: 100, outputTokens: 6, totalTokens: 106 },
        requestId: "lab-fresh-boundary-1",
      });
      await vi.advanceTimersByTimeAsync(10);

      expect({
        appliedDirection: match.appliedInputs[0]?.input.direction,
        decisions: runtime.readReport().players[0]?.decisions,
      }).toMatchObject({
        appliedDirection: "right",
        decisions: { count: 1, errors: 0, discarded: { stale: { count: 0 } } },
      });
    } finally {
      runtime.stop();
      vi.useRealTimers();
    }
  });

  it("trata idade maxima negativa como zero", async () => {
    vi.useFakeTimers();
    const match = new FakeMatch();
    let clockMs = 0;
    let resolveDecision!: (result: LabDecisionResult) => void;
    const runtime = startLabRuntime({
      match,
      decider: {
        decide: vi.fn(() => new Promise<LabDecisionResult>((resolve) => {
          resolveDecision = resolve;
        })),
      },
      competitors: [{ playerId: 1, model: "cx/gpt-5.6-sol", kind: "llm", label: "Sol" }],
      scheduling: { maxDecisionAgeMs: -1 },
      now: () => clockMs,
    });

    try {
      await vi.advanceTimersByTimeAsync(0);
      clockMs = 1;
      resolveDecision({
        decision: { direction: "right", placeBomb: false, detonate: false, useSkill: false },
        roundTripMs: 1,
        upstreamLatencyMs: 1,
        usage: null,
        requestId: "lab-negative-age",
      });
      await vi.advanceTimersByTimeAsync(0);

      expect(runtime.readReport().players[0]?.decisions).toMatchObject({
        count: 0,
        errors: 0,
        discarded: { stale: { count: 1 } },
      });
    } finally {
      runtime.stop();
      vi.useRealTimers();
    }
  });

  it.each([
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
    ["-Infinity", Number.NEGATIVE_INFINITY],
  ] as const)(
    "falha fechado quando o delta do relogio nao e finito: %s",
    async (_caseName, invalidNow) => {
      vi.useFakeTimers();
      const match = new FakeMatch();
      let clockMs = 0;
      let resolveDecision!: (result: LabDecisionResult) => void;
      const decide = vi.fn()
        .mockReturnValueOnce(new Promise<LabDecisionResult>((resolve) => {
          resolveDecision = resolve;
        }))
        .mockReturnValue(new Promise<never>(() => undefined));
      const runtime = startLabRuntime({
        match,
        decider: { decide },
        competitors: [{ playerId: 1, model: "cx/gpt-5.6-sol", kind: "llm", label: "Sol" }],
        observe: (snapshot) => ({ frameId: snapshot.frameId }),
        scheduling: { decisionPollMs: 50, motorIntervalMs: 50, maxDecisionAgeMs: 6_000 },
        now: () => clockMs,
      });

      try {
        await vi.advanceTimersByTimeAsync(0);
        clockMs = invalidNow;
        resolveDecision({
          decision: { direction: "left", placeBomb: true, detonate: true, useSkill: true },
          roundTripMs: invalidNow,
          upstreamLatencyMs: invalidNow,
          usage: {
            inputTokens: invalidNow,
            outputTokens: invalidNow,
            totalTokens: invalidNow,
          },
          requestId: "lab-invalid-clock",
        });
        await vi.advanceTimersByTimeAsync(0);

        expectOnlyFiniteNumbers(runtime.readReport());

        clockMs = 10_000;
        match.snapshot = { ...match.snapshot, frameId: 7 };
        const report = runtime.readReport();
        expect({
          appliedInputs: match.appliedInputs,
          player: report.players[0],
        }).toMatchObject({
          appliedInputs: [],
          player: {
            timing: { lastMs: null, averageMs: null, p95Ms: null },
            decisions: {
              count: 0,
              errors: 0,
              discarded: {
                stale: {
                  count: 1,
                  timing: { lastMs: 0, averageMs: 0, p95Ms: 0 },
                  tokens: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
                },
              },
            },
            tokens: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
            actions: { latest: null },
          },
        });
        expectOnlyFiniteNumbers(report);

        await vi.advanceTimersByTimeAsync(49);
        expect(decide).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(1);
        expect(decide.mock.calls.map(([request]) => request.observation)).toEqual([
          { frameId: 0 },
          { frameId: 7 },
        ]);
      } finally {
        runtime.stop();
        vi.useRealTimers();
      }
    },
  );

  it("satura round e acumuladores extremos sem perder contagens ou amostras", () => {
    const match = new FakeMatch();
    const runtime = startLabRuntime({
      match,
      decider: { decide: vi.fn(() => new Promise<never>(() => undefined)) },
      competitors: [{ playerId: 1, model: "bot-v1", kind: "v1", label: "V1" }],
      now: () => Number.MAX_VALUE,
    });
    const action = {
      direction: "right" as const,
      placeBomb: false,
      detonate: false,
      useSkill: false,
    };
    const maxUsage = {
      inputTokens: Number.MAX_VALUE,
      outputTokens: Number.MAX_VALUE,
      totalTokens: Number.MAX_VALUE,
    };

    try {
      for (let index = 0; index < 2; index += 1) {
        runtime.record({
          type: "decision",
          playerId: 1,
          decisionMs: Number.MAX_VALUE,
          upstreamLatencyMs: Number.MAX_VALUE,
          usage: maxUsage,
          action,
        });
        runtime.record({
          type: "decision_discarded",
          reason: "stale",
          playerId: 1,
          decisionMs: Number.MAX_VALUE,
          upstreamLatencyMs: Number.MAX_VALUE,
          usage: maxUsage,
        });
      }
      for (let index = 0; index < 2; index += 1) {
        runtime.record({
          type: "decision",
          playerId: 1,
          decisionMs: Number.MAX_VALUE,
          upstreamLatencyMs: 0,
          action,
        });
        runtime.record({
          type: "decision_discarded",
          reason: "stale",
          playerId: 1,
          decisionMs: Number.MAX_VALUE,
          upstreamLatencyMs: 0,
        });
      }

      const report = runtime.readReport();
      const player = report.players[0]!;
      expect(report.sampledAtMs).toBe(Number.MAX_VALUE);
      expect(player.decisions.count).toBe(4);
      expect(player.decisions.discarded?.stale.count).toBe(4);
      expect(player.timing.averageMs).toBe(Number.MAX_VALUE);
      expect(player.timing.p95Ms).toBe(Number.MAX_VALUE);
      expect(player.timing.upstreamAverageMs! / Number.MAX_VALUE).toBeCloseTo(0.5, 12);
      expect(player.timing.transportAverageMs! / Number.MAX_VALUE).toBeCloseTo(0.5, 12);
      expect(player.decisions.discarded?.stale.timing.averageMs).toBe(Number.MAX_VALUE);
      expect(player.decisions.discarded?.stale.timing.p95Ms).toBe(Number.MAX_VALUE);
      expect(
        player.decisions.discarded!.stale.timing.upstreamAverageMs! / Number.MAX_VALUE,
      ).toBeCloseTo(0.5, 12);
      expect(
        player.decisions.discarded!.stale.timing.transportAverageMs! / Number.MAX_VALUE,
      ).toBeCloseTo(0.5, 12);
      expect(player.tokens).toEqual(maxUsage);
      expect(player.decisions.discarded?.stale.tokens).toEqual(maxUsage);
      expectOnlyFiniteNumbers(report);
    } finally {
      runtime.stop();
    }
  });

  it.each([
    ["iguais", Number.MAX_VALUE, Number.MAX_VALUE, 50],
    ["round-trip maior", Number.MAX_VALUE, Number.MAX_VALUE / 2, 66.7],
    ["gap maior", Number.MAX_VALUE / 2, Number.MAX_VALUE, 33.3],
  ] as const)(
    "calcula utilizacao overflow-safe para operandos extremos: %s",
    (_caseName, roundTripMs, pollGapMs, expectedUtilizationPct) => {
      const match = new FakeMatch();
      let clockMs = 0;
      const runtime = startLabRuntime({
        match,
        decider: { decide: vi.fn(() => new Promise<never>(() => undefined)) },
        competitors: [{ playerId: 1, model: "bot-v1", kind: "v1", label: "V1" }],
        now: () => clockMs,
      });

      try {
        runtime.record({
          type: "decision",
          playerId: 1,
          decisionMs: roundTripMs,
          action: {
            direction: "right",
            placeBomb: false,
            detonate: false,
            useSkill: false,
          },
        });
        clockMs = pollGapMs;
        runtime.record({ type: "request", playerId: 1 });

        const report = runtime.readReport();
        expect(report.players[0]?.timing.pollingUtilizationPct).toBe(expectedUtilizationPct);
        expectOnlyFiniteNumbers(report);
      } finally {
        runtime.stop();
      }
    },
  );

  it.each([
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
    ["-Infinity", Number.NEGATIVE_INFINITY],
  ] as const)(
    "nao armazena timing ou usage nao finito de uma decisao fresca: %s",
    async (_caseName, invalidMeasurement) => {
      vi.useFakeTimers();
      const match = new FakeMatch();
      let clockMs = 0;
      let resolveDecision!: (result: LabDecisionResult) => void;
      const runtime = startLabRuntime({
        match,
        decider: {
          decide: vi.fn(() => new Promise<LabDecisionResult>((resolve) => {
            resolveDecision = resolve;
          })),
        },
        competitors: [{ playerId: 1, model: "cx/gpt-5.6-sol", kind: "llm", label: "Sol" }],
        scheduling: { motorIntervalMs: 10, maxDecisionAgeMs: 6_000 },
        now: () => clockMs,
      });

      try {
        await vi.advanceTimersByTimeAsync(0);
        clockMs = 1;
        resolveDecision({
          decision: { direction: "right", placeBomb: false, detonate: false, useSkill: false },
          roundTripMs: invalidMeasurement,
          upstreamLatencyMs: invalidMeasurement,
          usage: {
            inputTokens: invalidMeasurement,
            outputTokens: invalidMeasurement,
            totalTokens: invalidMeasurement,
          },
          requestId: "lab-invalid-measurement",
        });
        await vi.advanceTimersByTimeAsync(10);

        const report = runtime.readReport();
        expect({
          appliedDirection: match.appliedInputs[0]?.input.direction,
          player: report.players[0],
        }).toMatchObject({
          appliedDirection: "right",
          player: {
            timing: {
              lastMs: 0,
              averageMs: 0,
              p95Ms: 0,
              upstreamAverageMs: null,
              transportAverageMs: null,
            },
            decisions: { count: 1, errors: 0, discarded: { stale: { count: 0 } } },
            tokens: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
          },
        });
        expectOnlyFiniteNumbers(report);
      } finally {
        runtime.stop();
        vi.useRealTimers();
      }
    },
  );

  it.each([
    ["ausente", {}],
    ["NaN", { maxDecisionAgeMs: Number.NaN }],
    ["Infinity", { maxDecisionAgeMs: Number.POSITIVE_INFINITY }],
    ["-Infinity", { maxDecisionAgeMs: Number.NEGATIVE_INFINITY }],
  ] as const)(
    "desabilita a idade maxima para valor nao finito ou ausente: %s",
    async (_caseName, scheduling) => {
      vi.useFakeTimers();
      const match = new FakeMatch();
      let clockMs = 0;
      let resolveDecision!: (result: LabDecisionResult) => void;
      const runtime = startLabRuntime({
        match,
        decider: {
          decide: vi.fn(() => new Promise<LabDecisionResult>((resolve) => {
            resolveDecision = resolve;
          })),
        },
        competitors: [{ playerId: 1, model: "cx/gpt-5.6-sol", kind: "llm", label: "Sol" }],
        scheduling,
        now: () => clockMs,
      });

      try {
        await vi.advanceTimersByTimeAsync(0);
        clockMs = 60_000;
        resolveDecision({
          decision: { direction: "right", placeBomb: false, detonate: false, useSkill: false },
          roundTripMs: 1,
          upstreamLatencyMs: 1,
          usage: null,
          requestId: "lab-disabled-age",
        });
        await vi.advanceTimersByTimeAsync(0);

        expect(runtime.readReport().players[0]?.decisions).toMatchObject({
          count: 1,
          errors: 0,
          discarded: { stale: { count: 0 } },
        });
      } finally {
        runtime.stop();
        vi.useRealTimers();
      }
    },
  );

  it("pede um snapshot novo sem backoff depois de descartar uma decisao stale", async () => {
    vi.useFakeTimers();
    const match = new FakeMatch();
    let clockMs = 0;
    let resolveDecision!: (result: LabDecisionResult) => void;
    const decide = vi.fn()
      .mockReturnValueOnce(new Promise<LabDecisionResult>((resolve) => {
        resolveDecision = resolve;
      }))
      .mockReturnValue(new Promise<never>(() => undefined));
    const runtime = startLabRuntime({
      match,
      decider: { decide },
      competitors: [{ playerId: 1, model: "cx/gpt-5.6-sol", kind: "llm", label: "Sol" }],
      observe: (snapshot) => ({ frameId: snapshot.frameId }),
      scheduling: { decisionPollMs: 50, maxDecisionAgeMs: 6_000 },
      now: () => clockMs,
    });

    try {
      await vi.advanceTimersByTimeAsync(0);
      clockMs = 6_001;
      resolveDecision({
        decision: { direction: "left", placeBomb: false, detonate: false, useSkill: false },
        roundTripMs: 20,
        upstreamLatencyMs: 15,
        usage: null,
        requestId: "lab-stale-repoll-1",
      });
      await vi.advanceTimersByTimeAsync(0);
      match.snapshot = { ...match.snapshot, frameId: 7 };
      await vi.advanceTimersByTimeAsync(49);
      expect(decide).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);

      expect(decide.mock.calls.map(([request]) => request.observation)).toEqual([
        { frameId: 0 },
        { frameId: 7 },
      ]);
    } finally {
      runtime.stop();
      vi.useRealTimers();
    }
  });

  it("respeita Retry-After publico com teto local de trinta segundos", async () => {
    vi.useFakeTimers();
    const match = new FakeMatch();
    const decider: LabDecider = {
      decide: vi.fn(() => Promise.reject(new LabPublicError({
        status: 429,
        code: "rate_limited",
        requestId: "lab-rate-limited",
        retryAfterMs: 120_000,
      }))),
    };
    const runtime = startLabRuntime({
      match,
      decider,
      competitors: [{ playerId: 1, model: "cx/gpt-5.6-sol", kind: "llm", label: "Sol" }],
      scheduling: { decisionPollMs: 10 },
      now: () => Date.now(),
    });
    try {
      await vi.advanceTimersByTimeAsync(29_999);
      expect(decider.decide).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
      expect(decider.decide).toHaveBeenCalledTimes(2);
    } finally {
      runtime.stop();
      vi.useRealTimers();
    }
  });

  it("mantem a correlacao e o erro publico do broker no client estreito", async () => {
    const fetchImpl = vi.fn((..._args: Parameters<typeof fetch>) => Promise.resolve(new Response(JSON.stringify({
      ok: false,
      error: { code: "model_disabled" },
      requestId: "lab-request-42",
    }), {
      status: 429,
      headers: { "Content-Type": "application/json", "Retry-After": "2" },
    })));
    const client = createLabClient(fetchImpl);

    await expect(client.decide({
      model: "cx/gpt-5.6-sol",
      observation: {},
      requestId: "lab-request-42",
    })).rejects.toMatchObject({
      status: 429,
      code: "model_disabled",
      requestId: "lab-request-42",
      retryAfterMs: 2_000,
    });
    const [, requestInit] = fetchImpl.mock.calls[0]!;
    expect(JSON.parse(String(requestInit!.body))).toMatchObject({
      requestId: "lab-request-42",
    });
  });

  it("exige que uma resposta de sucesso preserve a correlacao do pedido", async () => {
    const fetchImpl = vi.fn((..._args: Parameters<typeof fetch>) => Promise.resolve(new Response(JSON.stringify({
      ok: true,
      requestId: "lab-success-1",
      decision: { direction: null, placeBomb: false, detonate: false, useSkill: false },
    }), { status: 200, headers: { "Content-Type": "application/json" } })));
    const client = createLabClient(fetchImpl);

    await expect(client.decide({
      model: "cx/gpt-5.6-sol",
      observation: {},
      requestId: "lab-success-1",
    })).resolves.toMatchObject({ requestId: "lab-success-1" });
  });

  it("rejeita uma resposta publica que nao ecoa a correlacao do pedido", async () => {
    const fetchImpl = vi.fn((..._args: Parameters<typeof fetch>) => Promise.resolve(new Response(JSON.stringify({
      ok: false,
      error: { code: "unauthorized" },
    }), { status: 401, headers: { "Content-Type": "application/json" } })));
    const client = createLabClient(fetchImpl);

    await expect(client.decide({
      model: "cx/gpt-5.6-sol",
      observation: {},
      requestId: "lab-missing-echo-1",
    })).rejects.toMatchObject({
      status: 401,
      code: "lab_request_id_mismatch",
      requestId: "lab-missing-echo-1",
    });
  });
});
