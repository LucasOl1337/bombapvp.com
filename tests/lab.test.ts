import { describe, expect, it, vi } from "vitest";
import { createLabClient } from "../src/lab/client.ts";
import { buildLabObservation, startLabController } from "../src/lab/controller.ts";
import {
  createLabMatchParams,
  LAB_V1_MODEL,
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
      model3: LAB_V1_MODEL,
      model4: "cc/claude-fable-5",
    });

    expect(parseLabMatchCompetitors(params)).toEqual([
      { playerId: 1, model: LAB_V1_MODEL, kind: "v1", label: "V1" },
      { playerId: 2, model: "cx/gpt-5.6-sol", kind: "llm", label: "cx/gpt-5.6-sol" },
      { playerId: 3, model: LAB_V1_MODEL, kind: "v1", label: "V1" },
      { playerId: 4, model: "cc/claude-fable-5", kind: "llm", label: "cc/claude-fable-5" },
    ]);
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
        decision: { direction: "left", placeBomb: true, detonate: false, useSkill: false, durationMs: 400 },
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
      decision: { direction: "left", durationMs: 400 },
      roundTripMs: 45,
      upstreamLatencyMs: 35,
      usage: { inputTokens: 120, outputTokens: 18, totalTokens: 138 },
    });

    const payload = JSON.parse(String(requests[1]?.init?.body));
    expect(payload.model).toBe("cx/gpt-5.6-sol");
    expect(JSON.stringify(payload)).not.toMatch(/reasoning|thinking|effort/i);
  });

  it("converte uma decisao do modelo em input autoritativo", async () => {
    const inputs: Array<{ playerId: PlayerId; input: OnlineInputState }> = [];
    const events: unknown[] = [];
    const game = {
      exportOnlineSnapshot: () => snapshot(),
      setServerPlayerInput: (playerId: PlayerId, input: OnlineInputState) => inputs.push({ playerId, input }),
    };
    const client = {
      listProfiles: vi.fn(),
      decide: vi.fn(async () => ({
        decision: {
          direction: "down" as const,
          placeBomb: true,
          detonate: false,
          useSkill: true,
          durationMs: 400,
        },
        roundTripMs: 85,
        upstreamLatencyMs: 70,
        usage: { inputTokens: 100, outputTokens: 15, totalTokens: 115 },
      })),
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
  });
});
