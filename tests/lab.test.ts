import { describe, expect, it, vi } from "vitest";
import { createLabClient } from "../src/lab/client.ts";
import type { LabClient } from "../src/lab/client.ts";
import { buildLabObservation, startLabController } from "../src/lab/controller.ts";
import {
  createLabMatchParams,
  LAB_V1_MODEL,
  LAB_V2_MODEL,
  LAB_V3_MODEL,
  parseLabMatchCompetitors,
} from "../src/lab/competitors.ts";
import type { OnlineGameSnapshot, OnlineInputState } from "../src/original-game/NetCode/protocol.ts";
import type { PlayerId } from "../src/original-game/Gameplay/types.ts";

function snapshot(): OnlineGameSnapshot {
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
      tiles: { solid: ["0,0"], breakable: ["2,2"] },
      spawns: [],
      version: "v1",
      createdAt: "",
      updatedAt: "",
      wrapPortals: [],
      suddenDeathPath: [],
      spawnMap: {} as OnlineGameSnapshot["arena"]["spawnMap"],
    },
    breakableTiles: ["2,2"],
    powerUps: [],
    players: {
      1: {
        id: 1, name: "P1", active: true, tile: { x: 1, y: 1 }, position: { x: 48, y: 48 },
        velocity: { x: 0, y: 0 }, alive: true, direction: "right", lastMoveDirection: "right",
        maxBombs: 1, activeBombs: 0, flameRange: 1, speedLevel: 0, remoteLevel: 0,
        shieldCharges: 0, bombPassLevel: 0, kickLevel: 0, shortFuseLevel: 0,
        flameGuardMs: 0, spawnProtectionMs: 0,
        skill: { id: null, phase: "idle", channelRemainingMs: 0, cooldownRemainingMs: 0, castElapsedMs: 0, projectedPosition: null, projectedLastMoveDirection: null },
      },
      2: {
        id: 2, name: "P2", active: true, tile: { x: 3, y: 3 }, position: { x: 112, y: 112 },
        velocity: { x: 0, y: 0 }, alive: true, direction: "left", lastMoveDirection: "left",
        maxBombs: 1, activeBombs: 0, flameRange: 1, speedLevel: 0, remoteLevel: 0,
        shieldCharges: 0, bombPassLevel: 0, kickLevel: 0, shortFuseLevel: 0,
        flameGuardMs: 0, spawnProtectionMs: 0,
        skill: { id: null, phase: "idle", channelRemainingMs: 0, cooldownRemainingMs: 0, castElapsedMs: 0, projectedPosition: null, projectedLastMoveDirection: null },
      },
      3: { id: 3, name: "P3", active: false } as OnlineGameSnapshot["players"][3],
      4: { id: 4, name: "P4", active: false } as OnlineGameSnapshot["players"][4],
    },
    bombs: [], flames: [], magicBeams: [], nextBombId: 1,
    score: { 1: 0, 2: 0, 3: 0, 4: 0 }, roundNumber: 1, roundTimeMs: 1000,
    paused: false, roundOutcome: null, matchWinner: null, animationClockMs: 1000,
    suddenDeathActive: false, suddenDeathTickMs: 0, suddenDeathIndex: 0,
    suddenDeathClosedTiles: [], suddenDeathClosingTiles: [], showDangerOverlay: false,
    showBombPreview: false, selectedCharacterIndex: { 1: 0, 2: 1, 3: 2, 4: 3 },
    activePlayerIds: [1, 2], botPlayerIds: [], endlessStats: null,
  };
}

describe("Laboratorio 9Router", () => {
  it("serializa somente salas válidas de dois a quatro competidores", () => {
    expect(createLabMatchParams([" bot-v1 ", "cx/gpt-5.6-sol"])?.toString()).toBe(
      "mode=lab&model1=bot-v1&model2=cx%2Fgpt-5.6-sol",
    );
    expect(createLabMatchParams([LAB_V1_MODEL])).toBeNull();
    expect(createLabMatchParams([LAB_V1_MODEL, LAB_V1_MODEL, LAB_V1_MODEL, LAB_V1_MODEL, LAB_V1_MODEL]))
      .toBeNull();
  });

  it("monta uma sala mista de até quatro competidores", () => {
    const params = new URLSearchParams({
      model1: LAB_V1_MODEL,
      model2: "cx/gpt-5.6-sol",
      label2: "GPT 5.6 Sol Ultra",
      model3: LAB_V1_MODEL,
      model4: "cc/claude-fable-5",
      label4: "Claude Fable 5",
    });

    expect(parseLabMatchCompetitors(params)).toEqual([
      { playerId: 1, model: LAB_V1_MODEL, kind: "v1", label: "V1" },
      { playerId: 2, model: "cx/gpt-5.6-sol", kind: "llm", label: "GPT 5.6 Sol Ultra" },
      { playerId: 3, model: LAB_V1_MODEL, kind: "v1", label: "V1" },
      { playerId: 4, model: "cc/claude-fable-5", kind: "llm", label: "Claude Fable 5" },
    ]);
  });

  it("reconhece o V2 como bot local determinístico e ignora labels externas", () => {
    const params = createLabMatchParams([LAB_V2_MODEL, LAB_V1_MODEL], ["falso", "falso"]);

    expect(params?.toString()).toBe("mode=lab&model1=bot-v2&model2=bot-v1");
    expect(parseLabMatchCompetitors(params!)).toEqual([
      { playerId: 1, model: LAB_V2_MODEL, kind: "v2", label: "V2" },
      { playerId: 2, model: LAB_V1_MODEL, kind: "v1", label: "V1" },
    ]);
  });

  it("reconhece o V3 como bot local determinístico e ignora labels externas", () => {
    const params = createLabMatchParams([LAB_V3_MODEL, LAB_V2_MODEL, LAB_V1_MODEL], ["x", "y", "z"]);

    expect(params?.toString()).toBe("mode=lab&model1=bot-v3&model2=bot-v2&model3=bot-v1");
    expect(parseLabMatchCompetitors(params!)).toEqual([
      { playerId: 1, model: LAB_V3_MODEL, kind: "v3", label: "V3" },
      { playerId: 2, model: LAB_V2_MODEL, kind: "v2", label: "V2" },
      { playerId: 3, model: LAB_V1_MODEL, kind: "v1", label: "V1" },
    ]);
  });

  it("monta o confronto V2 contra Luna Leve preservando tipos e rótulos", () => {
    const params = createLabMatchParams(
      [LAB_V2_MODEL, "cx/gpt-5.6-luna"],
      ["rótulo falso", "GPT 5.6 Luna Leve"],
    );

    expect(parseLabMatchCompetitors(params!)).toEqual([
      { playerId: 1, model: LAB_V2_MODEL, kind: "v2", label: "V2" },
      { playerId: 2, model: "cx/gpt-5.6-luna", kind: "llm", label: "GPT 5.6 Luna Leve" },
    ]);
  });

  it("preserva o nome do perfil selecionado sem confundir aliases da mesma rota", () => {
    const params = createLabMatchParams(
      [LAB_V1_MODEL, "cx/gpt-5.6-luna-xhigh"],
      ["V1", "GPT 5.6 Luna Ultra"],
    );

    expect(params?.get("label2")).toBe("GPT 5.6 Luna Ultra");
    expect(parseLabMatchCompetitors(params!).at(1)?.label).toBe("GPT 5.6 Luna Ultra");
  });

  it("rejeita salas com menos de dois competidores ou slots vazios", () => {
    expect(() => parseLabMatchCompetitors(new URLSearchParams({ model1: LAB_V1_MODEL })))
      .toThrow("lab_competitors_missing");
    expect(() => parseLabMatchCompetitors(new URLSearchParams({
      model1: LAB_V1_MODEL,
      model2: LAB_V1_MODEL,
      model4: LAB_V1_MODEL,
    }))).toThrow("lab_competitor_gap");
  });

  it("usa o catalogo confirmado e nunca envia configuracao de esforco", async () => {
    const requests: Array<{ url: string; init: RequestInit | undefined }> = [];
    let nowMs = 100;
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      requests.push({ url, init });
      if (url.endsWith("/models")) {
        return new Response(JSON.stringify({
          ok: true,
          profiles: [{ id: "sol", label: "Sol", route: "cx/gpt-5.6-sol" }],
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      nowMs = 145;
      return new Response(JSON.stringify({
        ok: true,
        decision: { direction: "left", placeBomb: true, detonate: false, useSkill: false },
        latencyMs: 35,
        usage: { inputTokens: 120, outputTokens: 18, totalTokens: 138 },
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    });
    const client = createLabClient(fetchMock as typeof fetch, () => nowMs);

    await expect(client.listProfiles()).resolves.toEqual([
      { id: "sol", label: "Sol", route: "cx/gpt-5.6-sol" },
    ]);
    await expect(client.decide({
      model: "cx/gpt-5.6-sol",
      observation: buildLabObservation(snapshot(), 1),
    })).resolves.toMatchObject({
      decision: { direction: "left" },
      roundTripMs: 45,
      upstreamLatencyMs: 35,
      usage: { inputTokens: 120, outputTokens: 18, totalTokens: 138 },
    });

    const payload = JSON.parse(String(requests[1]?.init?.body));
    expect(payload.model).toBe("cx/gpt-5.6-sol");
    expect(JSON.stringify(payload)).not.toMatch(/reasoning|thinking|effort/i);
  });

  it("entrega a LLM um snapshot tatico completo e atualizavel por frame", () => {
    const state = snapshot();
    state.frameId = 42;
    state.serverTimeMs = 1_234;
    state.players[1].remoteLevel = 1;
    state.players[1].kickLevel = 1;
    state.players[1].spawnProtectionMs = 750;
    state.players[2].bombPassLevel = 1;
    state.flames = [{ tile: { x: 2, y: 1 }, remainingMs: 300, ownerId: 2 }];
    state.magicBeams = [{
      ownerId: 2, origin: { x: 3, y: 3 }, direction: "left", tiles: [{ x: 2, y: 3 }], remainingMs: 200,
    }];

    expect(buildLabObservation(state, 1)).toMatchObject({
      frameId: 42,
      serverTimeMs: 1_234,
      self: {
        bombCapacity: 1, remoteLevel: 1, kickLevel: 1, spawnProtectionMs: 750,
        skill: { id: null, phase: "idle" },
      },
      enemies: [{ id: 2, bombPassLevel: 1, direction: "left" }],
      flames: [{ tile: { x: 2, y: 1 }, remainingMs: 300, ownerId: 2 }],
      magicBeams: [{ ownerId: 2, direction: "left", remainingMs: 200 }],
      arena: { wrapPortals: [] },
      suddenDeath: { active: false, closedTiles: [], closingTiles: [] },
    });
  });

  it("converte uma decisao do modelo em input autoritativo", async () => {
    const inputs: Array<{ playerId: PlayerId; input: OnlineInputState }> = [];
    const events: unknown[] = [];
    const game = {
      exportOnlineSnapshot: () => snapshot(),
      setServerPlayerInput: (playerId: PlayerId, input: OnlineInputState) => inputs.push({ playerId, input }),
      clearServerPlayerInput: (playerId: PlayerId) => inputs.push({
        playerId,
        input: { direction: null, bombPressed: false, detonatePressed: false, skillPressed: false, skillHeld: false },
      }),
    };
    const pendingDecision = new Promise<never>(() => undefined);
    const client = {
      listProfiles: vi.fn(),
      decide: vi.fn().mockResolvedValueOnce({
        decision: {
          direction: "down" as const,
          placeBomb: true,
          detonate: false,
          useSkill: true,
        },
        roundTripMs: 85,
        upstreamLatencyMs: 70,
        usage: { inputTokens: 100, outputTokens: 15, totalTokens: 115 },
      }).mockReturnValueOnce(pendingDecision),
    };

    const stop = startLabController(game, client, [
      { playerId: 1, model: "cx/gpt-5.6-sol" },
    ], (event) => events.push(event));
    await vi.waitFor(() => expect(inputs.some(({ input }) => input.direction === "down")).toBe(true));
    stop();

    expect(client.decide).toHaveBeenCalledWith(expect.objectContaining({
      model: "cx/gpt-5.6-sol",
      observation: expect.objectContaining({ playerId: 1, self: expect.objectContaining({ tile: { x: 1, y: 1 } }) }),
    }), expect.any(AbortSignal));
    expect(inputs.find(({ input }) => input.direction === "down")).toEqual({
      playerId: 1,
      input: { direction: "down", bombPressed: true, detonatePressed: false, skillPressed: true, skillHeld: false },
    });
    expect(events).toContainEqual(expect.objectContaining({
      type: "decision",
      playerId: 1,
      result: expect.objectContaining({ roundTripMs: 85, upstreamLatencyMs: 70 }),
    }));
    expect(inputs.at(-1)?.input).toEqual(expect.objectContaining({ direction: null, bombPressed: false }));
    expect(events).toContainEqual({
      type: "status",
      status: { playerId: 1, state: "stopped" },
    });
  });

  it("inicia a proxima leitura assim que recebe uma decisao", async () => {
    const game = {
      exportOnlineSnapshot: () => snapshot(),
      setServerPlayerInput: vi.fn(),
      clearServerPlayerInput: vi.fn(),
    };
    const pendingDecision = new Promise<never>(() => undefined);
    const client = {
      listProfiles: vi.fn(),
      decide: vi.fn()
        .mockResolvedValueOnce({
          decision: { direction: "right", placeBomb: false, detonate: false, useSkill: false },
          roundTripMs: 80,
          upstreamLatencyMs: 70,
          usage: null,
        })
        .mockReturnValueOnce(pendingDecision),
    };

    const stop = startLabController(game, client, [{ playerId: 1, model: "cx/gpt-5.6-sol" }]);
    await vi.waitFor(() => expect(client.decide).toHaveBeenCalledTimes(2), { timeout: 200 });
    stop();
  });

  it("escalona quatro leituras concorrentes do Luna para evitar snapshots duplicados", async () => {
    vi.useFakeTimers();
    const startedAt = Date.now();
    const game = {
      exportOnlineSnapshot: () => ({
        ...snapshot(),
        frameId: Date.now() - startedAt,
        serverTimeMs: Date.now() - startedAt,
      }),
      setServerPlayerInput: vi.fn(),
      clearServerPlayerInput: vi.fn(),
    };
    const pendingDecision = new Promise<never>(() => undefined);
    const client = {
      listProfiles: vi.fn(),
      decide: vi.fn().mockReturnValue(pendingDecision),
    };
    let stop: () => void = () => undefined;

    try {
      stop = startLabController(game, client, [{ playerId: 1, model: "cx/gpt-5.6-luna" }]);
      expect(client.decide).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(500);
      expect(client.decide).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(500);
      expect(client.decide).toHaveBeenCalledTimes(3);
      await vi.advanceTimersByTimeAsync(500);
      expect(client.decide).toHaveBeenCalledTimes(4);
      expect(client.decide.mock.calls.map(([request]) => (
        request.observation as { frameId: number }
      ).frameId)).toEqual([0, 500, 1_000, 1_500]);
    } finally {
      stop();
      vi.useRealTimers();
    }
  });

  it("restaura o escalonamento das lanes quando uma nova rodada fica ativa", async () => {
    vi.useFakeTimers();
    const startedAt = Date.now();
    let active = false;
    const game = {
      exportOnlineSnapshot: () => ({
        ...snapshot(),
        mode: active ? "match" as const : "boot" as const,
        frameId: Date.now() - startedAt,
        serverTimeMs: Date.now() - startedAt,
      }),
      setServerPlayerInput: vi.fn(),
      clearServerPlayerInput: vi.fn(),
    };
    const pendingDecision = new Promise<never>(() => undefined);
    const client = {
      listProfiles: vi.fn(),
      decide: vi.fn().mockReturnValue(pendingDecision),
    };
    let stop: () => void = () => undefined;

    try {
      stop = startLabController(game, client, [{ playerId: 1, model: "cx/gpt-5.6-luna" }]);
      await vi.advanceTimersByTimeAsync(2_000);
      expect(client.decide).not.toHaveBeenCalled();

      active = true;
      await vi.advanceTimersByTimeAsync(1_600);

      expect(client.decide).toHaveBeenCalledTimes(4);
      const requestedFrames = client.decide.mock.calls.map(([request]) => (
        request.observation as { frameId: number }
      ).frameId);
      expect(new Set(requestedFrames).size).toBe(4);
    } finally {
      stop();
      vi.useRealTimers();
    }
  });

  it("coordena o stagger quando requests da rodada anterior terminam em momentos diferentes", async () => {
    vi.useFakeTimers();
    const startedAt = Date.now();
    let roundNumber = 1;
    const game = {
      exportOnlineSnapshot: () => ({
        ...snapshot(),
        roundNumber,
        frameId: Date.now() - startedAt,
        serverTimeMs: Date.now() - startedAt,
      }),
      setServerPlayerInput: vi.fn(),
      clearServerPlayerInput: vi.fn(),
    };
    type DecisionResult = Awaited<ReturnType<LabClient["decide"]>>;
    const pendingResolvers: Array<(result: DecisionResult) => void> = [];
    const decide = vi.fn((_request: Parameters<LabClient["decide"]>[0]) => new Promise<DecisionResult>((resolve) => {
      pendingResolvers.push(resolve);
    }));
    const client: LabClient = {
      listProfiles: vi.fn(),
      decide,
    };
    const result: DecisionResult = {
      decision: { direction: "right", placeBomb: false, detonate: false, useSkill: false },
      roundTripMs: 2_000,
      upstreamLatencyMs: 1_900,
      usage: null,
    };
    let stop: () => void = () => undefined;

    try {
      stop = startLabController(game, client, [{ playerId: 1, model: "cx/gpt-5.6-luna" }]);
      await vi.advanceTimersByTimeAsync(1_600);
      expect(client.decide).toHaveBeenCalledTimes(4);
      const previousRoundResolvers = pendingResolvers.slice(0, 4);

      roundNumber = 2;
      previousRoundResolvers[2]!(result);
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(250);
      previousRoundResolvers[0]!(result);
      await vi.advanceTimersByTimeAsync(250);
      previousRoundResolvers[3]!(result);
      await vi.advanceTimersByTimeAsync(500);
      previousRoundResolvers[1]!(result);
      await vi.advanceTimersByTimeAsync(600);

      const newRoundFrames = decide.mock.calls
        .map(([request]) => request.observation as { round: number; frameId: number })
        .filter((observation) => observation.round === 2)
        .map((observation) => observation.frameId);
      expect(newRoundFrames).toEqual([1_600, 2_100, 2_600, 3_100]);
    } finally {
      stop();
      vi.useRealTimers();
    }
  });

  it("aumenta de quatro para sete decisões em cinco segundos ao dobrar as lanes do Luna", async () => {
    vi.useFakeTimers();
    const measureAppliedDecisions = async (lunaDecisionLanes: number): Promise<number> => {
      let appliedDecisions = 0;
      const game = {
        exportOnlineSnapshot: () => snapshot(),
        setServerPlayerInput: vi.fn(),
        clearServerPlayerInput: vi.fn(),
      };
      const client: LabClient = {
        listProfiles: vi.fn(),
        decide: vi.fn(() => new Promise<Awaited<ReturnType<LabClient["decide"]>>>((resolve) => {
          setTimeout(() => resolve({
            decision: { direction: "right", placeBomb: false, detonate: false, useSkill: false },
            roundTripMs: 2_000,
            upstreamLatencyMs: 1_900,
            usage: null,
          }), 2_000);
        })),
      };
      const stop = startLabController(
        game,
        client,
        [{ playerId: 1, model: "cx/gpt-5.6-luna" }],
        (event) => {
          if (event.type === "decision") appliedDecisions += 1;
        },
        { lunaDecisionLanes },
      );
      try {
        await vi.advanceTimersByTimeAsync(5_000);
        return appliedDecisions;
      } finally {
        stop();
        await vi.advanceTimersByTimeAsync(0);
      }
    };

    try {
      await expect(measureAppliedDecisions(2)).resolves.toBe(4);
      await expect(measureAppliedDecisions(4)).resolves.toBe(7);
    } finally {
      vi.useRealTimers();
    }
  });

  it("descarta a resposta antiga quando duas leituras do Luna chegam fora de ordem", async () => {
    const inputs: OnlineInputState[] = [];
    const game = {
      exportOnlineSnapshot: () => snapshot(),
      setServerPlayerInput: (_playerId: PlayerId, input: OnlineInputState) => inputs.push(input),
      clearServerPlayerInput: vi.fn(),
    };
    let resolveFirst!: (result: Awaited<ReturnType<LabClient["decide"]>>) => void;
    let resolveSecond!: (result: Awaited<ReturnType<LabClient["decide"]>>) => void;
    const first = new Promise<Awaited<ReturnType<LabClient["decide"]>>>((resolve) => { resolveFirst = resolve; });
    const second = new Promise<Awaited<ReturnType<LabClient["decide"]>>>((resolve) => { resolveSecond = resolve; });
    const pendingDecision = new Promise<never>(() => undefined);
    const result = (direction: "left" | "right") => ({
      decision: { direction, placeBomb: false, detonate: false, useSkill: false },
      roundTripMs: 100,
      upstreamLatencyMs: 90,
      usage: null,
    });
    const client: LabClient = {
      listProfiles: vi.fn(),
      decide: vi.fn()
        .mockReturnValueOnce(first)
        .mockReturnValueOnce(second)
        .mockReturnValue(pendingDecision),
    };

    const stop = startLabController(game, client, [{ playerId: 1, model: "cx/gpt-5.6-luna" }]);
    await vi.waitFor(() => expect(client.decide).toHaveBeenCalledTimes(2));
    resolveSecond(result("left"));
    await vi.waitFor(() => expect(inputs.at(-1)?.direction).toBe("left"));
    resolveFirst(result("right"));
    await vi.waitFor(() => expect(client.decide).toHaveBeenCalledTimes(4));

    expect(inputs.some(({ direction }) => direction === "right")).toBe(false);
    expect(inputs.at(-1)?.direction).toBe("left");
    stop();
  });

  it("descarta uma decisao que terminou depois do inicio da rodada seguinte", async () => {
    let roundNumber = 1;
    const game = {
      exportOnlineSnapshot: () => ({ ...snapshot(), roundNumber }),
      setServerPlayerInput: vi.fn(),
      clearServerPlayerInput: vi.fn(),
    };
    let resolveFirst!: (result: Awaited<ReturnType<LabClient["decide"]>>) => void;
    const first = new Promise<Awaited<ReturnType<LabClient["decide"]>>>((resolve) => { resolveFirst = resolve; });
    const pendingDecision = new Promise<never>(() => undefined);
    const client: LabClient = {
      listProfiles: vi.fn(),
      decide: vi.fn()
        .mockReturnValueOnce(first)
        .mockReturnValue(pendingDecision),
    };

    const stop = startLabController(game, client, [{ playerId: 1, model: "cx/gpt-5.6-luna" }]);
    await vi.waitFor(() => expect(client.decide).toHaveBeenCalledTimes(2));
    roundNumber = 2;
    resolveFirst({
      decision: { direction: "right", placeBomb: true, detonate: false, useSkill: false },
      roundTripMs: 100,
      upstreamLatencyMs: 90,
      usage: null,
    });
    await vi.waitFor(() => expect(client.decide).toHaveBeenCalledTimes(3));

    expect(game.setServerPlayerInput.mock.calls.some(([, input]) => (
      input.direction === "right" || input.bombPressed
    ))).toBe(false);
    stop();
  });

  it("mantem o ultimo movimento enquanto uma resposta lenta ainda esta em voo", async () => {
    const inputs: OnlineInputState[] = [];
    const game = {
      exportOnlineSnapshot: () => snapshot(),
      setServerPlayerInput: (_playerId: PlayerId, input: OnlineInputState) => inputs.push(input),
      clearServerPlayerInput: () => inputs.push({
        direction: null, bombPressed: false, detonatePressed: false, skillPressed: false, skillHeld: false,
      }),
    };
    const pendingDecision = new Promise<never>(() => undefined);
    const client = {
      listProfiles: vi.fn(),
      decide: vi.fn()
        .mockResolvedValueOnce({
          decision: { direction: "right", placeBomb: true, detonate: false, useSkill: false },
          roundTripMs: 13_000,
          upstreamLatencyMs: 12_900,
          usage: { inputTokens: 800, outputTokens: 1_000, totalTokens: 1_800 },
        })
        .mockReturnValueOnce(pendingDecision),
    };

    const stop = startLabController(game, client, [{ playerId: 1, model: "cx/gpt-5.6-luna-xhigh" }]);
    await vi.waitFor(() => expect(client.decide).toHaveBeenCalledTimes(2));
    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(inputs.at(-1)?.direction).toBe("right");
    stop();
  });

  it("cede ao navegador somente para clientes locais com resposta sincronica", async () => {
    const game = {
      exportOnlineSnapshot: () => snapshot(),
      setServerPlayerInput: vi.fn(),
      clearServerPlayerInput: vi.fn(),
    };
    const client = {
      listProfiles: vi.fn(),
      decide: vi.fn().mockResolvedValue({
        decision: { direction: null, placeBomb: false, detonate: false, useSkill: false },
        roundTripMs: 0,
        upstreamLatencyMs: 0,
        usage: null,
      }),
    };

    const stop = startLabController(game, client, [{ playerId: 1, model: "local/test" }]);
    await vi.waitFor(() => expect(client.decide.mock.calls.length).toBeGreaterThan(1), { timeout: 200 });
    stop();

    expect(client.decide.mock.calls.length).toBeLessThan(100);
  });

  it("substitui imediatamente a direcao anterior pela decisao mais nova", async () => {
    const inputs: OnlineInputState[] = [];
    const game = {
      exportOnlineSnapshot: () => snapshot(),
      setServerPlayerInput: (_playerId: PlayerId, input: OnlineInputState) => inputs.push(input),
      clearServerPlayerInput: () => inputs.push({
        direction: null, bombPressed: false, detonatePressed: false, skillPressed: false, skillHeld: false,
      }),
    };
    const pendingDecision = new Promise<never>(() => undefined);
    const client = {
      listProfiles: vi.fn(),
      decide: vi.fn()
        .mockResolvedValueOnce({
          decision: { direction: "right", placeBomb: false, detonate: false, useSkill: false },
          roundTripMs: 20,
          upstreamLatencyMs: 15,
          usage: null,
        })
        .mockImplementationOnce(async () => {
          await new Promise((resolve) => setTimeout(resolve, 20));
          return {
            decision: { direction: "left", placeBomb: false, detonate: false, useSkill: false },
            roundTripMs: 20,
            upstreamLatencyMs: 15,
            usage: null,
          };
        })
        .mockReturnValueOnce(pendingDecision),
    };

    const stop = startLabController(game, client, [{ playerId: 1, model: "cx/gpt-5.6-sol" }]);
    await vi.waitFor(() => expect(inputs.some(({ direction }) => direction === "left")).toBe(true));
    await new Promise((resolve) => setTimeout(resolve, 70));

    expect(inputs.at(-1)?.direction).toBe("left");
    stop();
  });

  it("executa a intencao remota em pelo menos dez ciclos locais por segundo", async () => {
    vi.useFakeTimers();
    const motorEvents: Array<{ safetyOverride: boolean }> = [];
    const game = {
      exportOnlineSnapshot: () => snapshot(),
      setServerPlayerInput: vi.fn(),
      clearServerPlayerInput: vi.fn(),
    };
    const pendingDecision = new Promise<never>(() => undefined);
    const client: LabClient = {
      listProfiles: vi.fn(),
      decide: vi.fn()
        .mockResolvedValueOnce({
          decision: { direction: "right", placeBomb: false, detonate: false, useSkill: false },
          roundTripMs: 20,
          upstreamLatencyMs: 15,
          usage: null,
        })
        .mockReturnValue(pendingDecision),
    };

    const stop = startLabController(game, client, [{ playerId: 1, model: "local/test" }], (event) => {
      if (event.type === "motor") motorEvents.push({ safetyOverride: event.safetyOverride });
    });
    try {
      await vi.advanceTimersByTimeAsync(1_000);
      expect(motorEvents.length).toBeGreaterThanOrEqual(20);
      expect(game.setServerPlayerInput).toHaveBeenCalledTimes(motorEvents.length);
    } finally {
      stop();
      vi.useRealTimers();
    }
  });

  it("consome bomba, detonacao e skill como pulsos unicos no motor local", async () => {
    vi.useFakeTimers();
    const inputs: OnlineInputState[] = [];
    const game = {
      exportOnlineSnapshot: () => snapshot(),
      setServerPlayerInput: (_playerId: PlayerId, input: OnlineInputState) => inputs.push(input),
      clearServerPlayerInput: vi.fn(),
    };
    const client: LabClient = {
      listProfiles: vi.fn(),
      decide: vi.fn()
        .mockResolvedValueOnce({
          decision: { direction: "right", placeBomb: true, detonate: true, useSkill: true },
          roundTripMs: 20,
          upstreamLatencyMs: 15,
          usage: null,
        })
        .mockReturnValue(new Promise<never>(() => undefined)),
    };

    const stop = startLabController(game, client, [{ playerId: 1, model: "local/test" }]);
    try {
      await vi.advanceTimersByTimeAsync(250);
      expect(inputs.filter((input) => input.bombPressed)).toHaveLength(1);
      expect(inputs.filter((input) => input.detonatePressed)).toHaveLength(1);
      expect(inputs.filter((input) => input.skillPressed)).toHaveLength(1);
      expect(inputs.at(-1)).toMatchObject({
        direction: "right", bombPressed: false, detonatePressed: false, skillPressed: false,
      });
    } finally {
      stop();
      vi.useRealTimers();
    }
  });

  it("prioriza o reflexo de seguranca sem permitir que ele invente ataques", async () => {
    vi.useFakeTimers();
    const inputs: OnlineInputState[] = [];
    const safetyInput: OnlineInputState = {
      direction: "up", bombPressed: true, detonatePressed: true, skillPressed: true, skillHeld: true,
    };
    const game = {
      exportOnlineSnapshot: () => snapshot(),
      setServerPlayerInput: (_playerId: PlayerId, input: OnlineInputState) => inputs.push(input),
      replaceServerPlayerInput: vi.fn((_playerId: PlayerId, input: OnlineInputState) => inputs.push(input)),
      clearServerPlayerInput: vi.fn(),
      getServerSafetyInput: vi.fn(() => safetyInput),
    };
    const client: LabClient = {
      listProfiles: vi.fn(),
      decide: vi.fn().mockReturnValue(new Promise<never>(() => undefined)),
    };
    const events: Array<{ safetyOverride: boolean }> = [];

    const stop = startLabController(game, client, [{ playerId: 1, model: "local/test" }], (event) => {
      if (event.type === "motor") events.push({ safetyOverride: event.safetyOverride });
    });
    try {
      await vi.advanceTimersByTimeAsync(100);
      expect(inputs.at(-1)).toEqual({
        direction: "up", bombPressed: false, detonatePressed: false, skillPressed: false, skillHeld: false,
      });
      expect(events.at(-1)?.safetyOverride).toBe(true);
      expect(game.replaceServerPlayerInput).toHaveBeenCalled();
    } finally {
      stop();
      vi.useRealTimers();
    }
  });

  it("cancela o latch sem contabilizar SAFE quando o reflexo devolve o mesmo input", async () => {
    vi.useFakeTimers();
    const game = {
      exportOnlineSnapshot: () => snapshot(),
      setServerPlayerInput: vi.fn(),
      replaceServerPlayerInput: vi.fn(),
      clearServerPlayerInput: vi.fn(),
      getServerSafetyInput: vi.fn((_playerId: PlayerId, intendedInput: OnlineInputState) => intendedInput),
    };
    const client: LabClient = {
      listProfiles: vi.fn(),
      decide: vi.fn().mockReturnValue(new Promise<never>(() => undefined)),
    };
    const events: boolean[] = [];
    const stop = startLabController(game, client, [{ playerId: 1, model: "local/test" }], (event) => {
      if (event.type === "motor") events.push(event.safetyOverride);
    });

    try {
      await vi.advanceTimersByTimeAsync(100);
      expect(events).toEqual([false, false]);
      expect(game.replaceServerPlayerInput).toHaveBeenCalledTimes(2);
    } finally {
      stop();
      vi.useRealTimers();
    }
  });

  it("compartilha um unico snapshot do motor entre competidores no mesmo tick", async () => {
    vi.useFakeTimers();
    const exportOnlineSnapshot = vi.fn(() => snapshot());
    const game = {
      exportOnlineSnapshot,
      setServerPlayerInput: vi.fn(),
      clearServerPlayerInput: vi.fn(),
    };
    const client: LabClient = {
      listProfiles: vi.fn(),
      decide: vi.fn().mockReturnValue(new Promise<never>(() => undefined)),
    };
    const stop = startLabController(game, client, [
      { playerId: 1, model: "local/test" },
      { playerId: 2, model: "local/test" },
    ]);

    try {
      exportOnlineSnapshot.mockClear();
      await vi.advanceTimersByTimeAsync(100);
      expect(exportOnlineSnapshot).toHaveBeenCalledTimes(2);
    } finally {
      stop();
      vi.useRealTimers();
    }
  });
});
