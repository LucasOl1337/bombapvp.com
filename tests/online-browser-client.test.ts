import { describe, expect, it, vi } from "vitest";
import { CHAMPION_MEMBERSHIP } from "../Champions/membership.ts";
import { AuthoritativeDuelClient, type WebSocketPort } from "../src/online/client/authoritative-duel-client.ts";
import { ONLINE_CONTENT_REVISION } from "../src/online/content-revision.ts";
import { ONLINE_MODE_ID, ONLINE_PROTOCOL_VERSION } from "../src/online/protocol/contracts.ts";
import { encodeServerFrameEnvelope } from "../src/online/protocol/frame-envelope.ts";
import { decodePlayerCommand } from "../src/online/protocol/input-codec.ts";
import { OnlineSnapshotCodec } from "../src/online/protocol/snapshot-codec.ts";
import type { OnlineGameSnapshot } from "../src/original-game/NetCode/protocol.ts";

class FakeSocket implements WebSocketPort {
  public binaryType = "blob";
  public readyState = 0;
  public readonly sent: Array<string | ArrayBuffer | ArrayBufferView> = [];
  private readonly listeners = new Map<string, Array<(event: any) => void>>();

  constructor(public readonly url: string) {}

  send(data: string | ArrayBuffer | ArrayBufferView): void {
    if (this.readyState !== 1) throw new Error("socket_not_open");
    this.sent.push(data);
  }

  close(code = 1000, reason = ""): void {
    if (this.readyState === 3) return;
    this.readyState = 3;
    this.emit("close", { code, reason, wasClean: code === 1000 });
  }

  addEventListener(type: string, listener: (event: any) => void): void {
    const current = this.listeners.get(type) ?? [];
    current.push(listener);
    this.listeners.set(type, current);
  }

  open(): void {
    this.readyState = 1;
    this.emit("open", {});
  }

  receive(data: string | Uint8Array): void {
    this.emit("message", { data });
  }

  serverClose(code = 1006): void {
    this.readyState = 3;
    this.emit("close", { code, reason: "network", wasClean: false });
  }

  private emit(type: string, event: any): void {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
}

function snapshot(): OnlineGameSnapshot {
  const player = (id: 1 | 2) => ({
    id,
    name: `P${id}`,
    active: true,
    tile: { x: id, y: 1 },
    position: { x: id * 40 + 20, y: 60 },
    velocity: { x: 0, y: 0 },
    alive: true,
    direction: "right" as const,
    lastMoveDirection: "right" as const,
    maxBombs: 1,
    activeBombs: 0,
    flameRange: 1,
    speedLevel: 0,
    remoteLevel: 0,
    shieldCharges: 0,
    bombPassLevel: 0,
    kickLevel: 0,
    shortFuseLevel: 0,
    flameGuardMs: 0,
    spawnProtectionMs: 0,
    perfectStartWindowMs: 0,
    perfectStartBoostMs: 0,
    breakawayBoostMs: 0,
    pickupSprintMs: 0,
    skill: {
      id: null,
      phase: "idle" as const,
      channelRemainingMs: 0,
      cooldownRemainingMs: 0,
      castElapsedMs: 0,
      projectedPosition: null,
      projectedLastMoveDirection: null,
      projectedBombEgressIds: [],
    },
  });
  return {
    serverTimeMs: 0,
    serverTick: 0,
    frameId: 0,
    ackedInputSeq: { 1: 0, 2: 0, 3: 0, 4: 0 },
    mode: "match",
    roomMode: "classic",
    arena: {
      id: "arena",
      name: "Arena",
      status: "active",
      themeId: "tournament-clean",
      grid: { width: 9, height: 9 },
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
      3: { ...player(1), id: 3, name: "P3", active: false, alive: false },
      4: { ...player(2), id: 4, name: "P4", active: false, alive: false },
    },
    bombs: [],
    flames: [],
    magicBeams: [],
    nextBombId: 1,
    score: { 1: 0, 2: 0, 3: 0, 4: 0 },
    roundNumber: 1,
    roundTimeMs: 90_000,
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
    selectedCharacterIndex: { 1: 0, 2: 1, 3: 0, 4: 0 },
    activePlayerIds: [1, 2],
    botPlayerIds: [],
    endlessStats: null,
  };
}

function matchFound() {
  return JSON.stringify({
    type: "match.found",
    matchId: "0123456789abcdef",
    ticket: "signed-ticket",
    placement: "sam",
    connectPath: "/api/online/matches/0123456789abcdef",
  });
}

function ready(reconnectToken = "reconnect-token-01") {
  return JSON.stringify({
    type: "match.ready",
    matchId: "0123456789abcdef",
    sessionId: "session-00000001",
    seat: 2,
    reconnectToken,
  });
}

async function flushMessages() {
  await Promise.resolve();
  await Promise.resolve();
}

async function connectThroughReady(
  client: AuthoritativeDuelClient,
  sockets: FakeSocket[],
  reconnectToken = "reconnect-token-01",
): Promise<FakeSocket> {
  await client.start();
  const queue = sockets[0]!;
  queue.open();
  queue.receive(matchFound());
  await flushMessages();
  const match = sockets[1]!;
  match.open();
  match.receive(ready(reconnectToken));
  await flushMessages();
  expect(match.sent).toContain(JSON.stringify({ type: "match.ready.ack" }));
  return match;
}

describe("authoritative browser duel client", () => {
  it("queues, applies keyframe/delta, sends only a 16-byte seat-bound command and reconnects", async () => {
    const sockets: FakeSocket[] = [];
    const scheduled: Array<() => void> = [];
    const statuses: string[] = [];
    const snapshots: OnlineGameSnapshot[] = [];
    let nowMs = 1_000;
    const codec = new OnlineSnapshotCodec();
    const client = new AuthoritativeDuelClient({
      origin: "https://bombapvp.com",
      characterId: CHAMPION_MEMBERSHIP.ranni.characterId,
      preflight: async () => true,
      socketFactory: (url) => {
        const socket = new FakeSocket(url);
        sockets.push(socket);
        return socket;
      },
      now: () => nowMs,
      schedule: (callback) => {
        scheduled.push(callback);
        return scheduled.length as never;
      },
      cancelSchedule: () => undefined,
      onStatus: ({ phase }) => statuses.push(phase),
      onSnapshot: (state) => snapshots.push(state),
    });

    await client.start();
    const queue = sockets[0]!;
    expect(queue.url).toBe("wss://bombapvp.com/api/online/queue");
    queue.open();
    expect(JSON.parse(queue.sent[0] as string)).toMatchObject({
      type: "queue.join",
      protocolVersion: ONLINE_PROTOCOL_VERSION,
      modeId: ONLINE_MODE_ID,
      contentRevision: ONLINE_CONTENT_REVISION,
      characterId: CHAMPION_MEMBERSHIP.ranni.characterId,
    });
    queue.receive(JSON.stringify({ type: "queue.status", state: "waiting", queuedAtMs: 1_000 }));
    await flushMessages();
    queue.receive(matchFound());
    await flushMessages();

    const match = sockets[1]!;
    expect(match.url).toContain("wss://bombapvp.com/api/online/matches/0123456789abcdef?");
    expect(match.url).toContain("placement=sam");
    expect(match.url).toContain("ticket=signed-ticket");
    match.open();
    match.receive(ready());
    await flushMessages();
    expect(match.sent).toContain(JSON.stringify({ type: "match.ready.ack" }));

    match.receive(new Uint8Array([0xff]));
    await flushMessages();
    expect(match.sent.map((message) => typeof message === "string" ? message : null))
      .toContain(JSON.stringify({ type: "frame.resync" }));

    const first = snapshot();
    match.receive(encodeServerFrameEnvelope({
      kind: "keyframe",
      serverTick: 3,
      frameId: 1,
      ackInputSeq: 0,
      baselineFrameId: 0,
      payload: codec.encodeKeyframe(first),
    }));
    await flushMessages();
    expect(snapshots.at(-1)).toMatchObject({
      serverTick: 3,
      frameId: 1,
      serverTimeMs: 50,
      activePlayerIds: [1, 2],
      botPlayerIds: [],
      ackedInputSeq: { 2: 0 },
    });

    expect(client.sendInput({
      direction: "left",
      bombPressed: true,
      detonatePressed: false,
      skillPressed: false,
      skillHeld: false,
    }, 1)).toBe(true);
    const command = decodePlayerCommand(match.sent.at(-1) as Uint8Array);
    expect(command).toEqual({
      ok: true,
      command: {
        seq: 1,
        clientTick: 3,
        lastServerTick: 3,
        direction: "left",
        bombPressed: true,
        detonatePressed: false,
        skillPressed: false,
        skillHeld: false,
      },
    });

    const second = snapshot();
    second.players[2].position.x -= 4;
    match.receive(encodeServerFrameEnvelope({
      kind: "delta",
      serverTick: 6,
      frameId: 2,
      ackInputSeq: 1,
      baselineFrameId: 1,
      payload: codec.encodeDelta(first, second)!,
    }));
    await flushMessages();
    expect(snapshots.at(-1)?.players[2].position.x).toBe(second.players[2].position.x);
    expect(snapshots.at(-1)?.ackedInputSeq[2]).toBe(1);

    nowMs = 2_000;
    match.serverClose();
    expect(statuses.at(-1)).toBe("reconnecting");
    scheduled.shift()?.();
    const reconnect = sockets[2]!;
    expect(reconnect.url).toContain("sessionId=session-00000001");
    expect(reconnect.url).toContain("reconnectToken=reconnect-token-01");
    reconnect.open();
    reconnect.receive(ready("reconnect-token-02"));
    await flushMessages();
    expect(reconnect.sent).toContain(JSON.stringify({ type: "match.ready.ack" }));
    reconnect.receive(encodeServerFrameEnvelope({
      kind: "keyframe",
      serverTick: 6,
      frameId: 2,
      ackInputSeq: 1,
      baselineFrameId: 0,
      payload: codec.encodeKeyframe(second),
    }));
    await flushMessages();

    expect(client.getMetrics()).toMatchObject({
      frames: 3,
      keyframes: 2,
      deltas: 1,
      reconnects: 1,
      resyncRequests: 1,
    });
    expect(statuses).toContain("waiting");
    expect(statuses.at(-1)).toBe("playing");
  });

  it("fails honestly at preflight without opening a socket or substituting an offline match", async () => {
    const socketFactory = vi.fn();
    const statuses: Array<{ phase: string; code?: string }> = [];
    const client = new AuthoritativeDuelClient({
      origin: "https://bombapvp.com",
      characterId: CHAMPION_MEMBERSHIP.nico.characterId,
      preflight: async () => false,
      socketFactory,
      onStatus: (status) => statuses.push(status),
    });

    await client.start();
    expect(socketFactory).not.toHaveBeenCalled();
    expect(statuses.at(-1)).toEqual({ phase: "error", code: "online-unavailable" });
  });

  it("applies the final frame, acknowledges every terminal reason and never reconnects afterward", async () => {
    for (const reason of ["completed", "forfeit", "peer-timeout", "server-overload"] as const) {
      const sockets: FakeSocket[] = [];
      const statuses: Array<{ phase: string; code?: string; winnerSeat?: 1 | 2 | null }> = [];
      const snapshots: OnlineGameSnapshot[] = [];
      const client = new AuthoritativeDuelClient({
        origin: "https://bombapvp.com",
        characterId: CHAMPION_MEMBERSHIP.ranni.characterId,
        preflight: async () => true,
        socketFactory: (url) => {
          const socket = new FakeSocket(url);
          sockets.push(socket);
          return socket;
        },
        onStatus: (status) => statuses.push(status),
        onSnapshot: (state) => snapshots.push(state),
      });
      const match = await connectThroughReady(client, sockets);

      if (reason === "completed") {
        const final = snapshot();
        final.mode = "match-result";
        final.matchWinner = 2;
        const codec = new OnlineSnapshotCodec();
        match.receive(encodeServerFrameEnvelope({
          kind: "keyframe",
          serverTick: 1,
          frameId: 1,
          ackInputSeq: 0,
          baselineFrameId: 0,
          payload: codec.encodeKeyframe(final),
        }));
        await flushMessages();
        expect(snapshots.at(-1)).toMatchObject({ mode: "match-result", matchWinner: 2 });
      }

      match.receive(JSON.stringify({ type: "match.ended", reason, winnerSeat: 2 }));
      await flushMessages();
      expect(statuses.at(-1)).toMatchObject({ phase: "ended", code: reason, winnerSeat: 2 });
      expect(match.sent).toContain(JSON.stringify({ type: "match.ended.ack" }));

      match.serverClose(1000);
      expect(statuses.at(-1)).toMatchObject({ phase: "ended", code: reason });
      expect(sockets).toHaveLength(2);
      client.stop();
    }
  });

  it("keeps peer-reconnecting through frames and local seat status until the rival returns", async () => {
    const sockets: FakeSocket[] = [];
    const statuses: string[] = [];
    const codec = new OnlineSnapshotCodec();
    const client = new AuthoritativeDuelClient({
      origin: "https://bombapvp.com",
      characterId: CHAMPION_MEMBERSHIP.ranni.characterId,
      preflight: async () => true,
      socketFactory: (url) => {
        const socket = new FakeSocket(url);
        sockets.push(socket);
        return socket;
      },
      onStatus: ({ phase }) => statuses.push(phase),
    });
    const match = await connectThroughReady(client, sockets);
    const first = snapshot();
    match.receive(encodeServerFrameEnvelope({
      kind: "keyframe",
      serverTick: 3,
      frameId: 1,
      ackInputSeq: 0,
      baselineFrameId: 0,
      payload: codec.encodeKeyframe(first),
    }));
    await flushMessages();

    match.receive(JSON.stringify({
      type: "peer.status",
      seat: 1,
      state: "reconnecting",
      deadlineMs: 11_000,
    }));
    await flushMessages();
    expect(statuses.at(-1)).toBe("peer-reconnecting");

    const second = snapshot();
    second.players[1].position.x += 4;
    match.receive(encodeServerFrameEnvelope({
      kind: "delta",
      serverTick: 6,
      frameId: 2,
      ackInputSeq: 0,
      baselineFrameId: 1,
      payload: codec.encodeDelta(first, second)!,
    }));
    await flushMessages();
    expect(statuses.at(-1)).toBe("peer-reconnecting");

    match.receive(JSON.stringify({
      type: "peer.status",
      seat: 2,
      state: "connected",
      deadlineMs: null,
    }));
    await flushMessages();
    expect(statuses.at(-1)).toBe("peer-reconnecting");

    match.receive(JSON.stringify({
      type: "peer.status",
      seat: 1,
      state: "connected",
      deadlineMs: null,
    }));
    await flushMessages();
    expect(statuses.at(-1)).toBe("playing");
  });

  it("expires a silent reconnect socket at exactly 10,000 ms without inflating attempts", async () => {
    const sockets: FakeSocket[] = [];
    const timers: Array<{ callback: () => void; delayMs: number; cancelled: boolean }> = [];
    const statuses: Array<{ phase: string; code?: string; attempt?: number }> = [];
    let nowMs = 1_000;
    const client = new AuthoritativeDuelClient({
      origin: "https://bombapvp.com",
      characterId: CHAMPION_MEMBERSHIP.ranni.characterId,
      preflight: async () => true,
      socketFactory: (url) => {
        const socket = new FakeSocket(url);
        sockets.push(socket);
        return socket;
      },
      now: () => nowMs,
      schedule: (callback, delayMs) => {
        const timer = { callback, delayMs, cancelled: false };
        timers.push(timer);
        return timer as never;
      },
      cancelSchedule: (handle) => { (handle as unknown as { cancelled: boolean }).cancelled = true; },
      onStatus: (status) => statuses.push(status),
    });
    const match = await connectThroughReady(client, sockets);

    match.serverClose();
    const retry = timers.find((timer) => timer.delayMs === 150 && !timer.cancelled)!;
    nowMs = 1_150;
    retry.callback();
    const reconnect = sockets[2]!;
    reconnect.open();

    const expiry = timers.find((timer) => timer.delayMs === 10_000 && !timer.cancelled)!;
    nowMs = 10_999;
    expect(statuses.at(-1)?.phase).toBe("reconnecting");
    nowMs = 11_000;
    expiry.callback();
    expect(statuses.at(-1)).toEqual({ phase: "error", code: "reconnect-expired" });
    expect(reconnect.readyState).toBe(3);
    expect(new Set(
      statuses.filter(({ phase }) => phase === "reconnecting").map(({ attempt }) => attempt),
    )).toEqual(new Set([1]));
  });

  it("retries the same signed ticket when the initial match socket drops before ready", async () => {
    const sockets: FakeSocket[] = [];
    const timers: Array<{ callback: () => void; delayMs: number; cancelled: boolean }> = [];
    let nowMs = 1_000;
    const client = new AuthoritativeDuelClient({
      origin: "https://bombapvp.com",
      characterId: CHAMPION_MEMBERSHIP.ranni.characterId,
      preflight: async () => true,
      socketFactory: (url) => {
        const socket = new FakeSocket(url);
        sockets.push(socket);
        return socket;
      },
      now: () => nowMs,
      schedule: (callback, delayMs) => {
        const timer = { callback, delayMs, cancelled: false };
        timers.push(timer);
        return timer as never;
      },
      cancelSchedule: (handle) => { (handle as unknown as { cancelled: boolean }).cancelled = true; },
    });
    await client.start();
    sockets[0]!.open();
    sockets[0]!.receive(matchFound());
    await flushMessages();
    const firstMatch = sockets[1]!;
    firstMatch.open();
    firstMatch.serverClose();

    const retry = timers.find((timer) => timer.delayMs === 150 && !timer.cancelled)!;
    nowMs = 1_150;
    retry.callback();
    const retriedMatch = sockets[2]!;
    expect(retriedMatch.url).toContain("ticket=signed-ticket");
    expect(retriedMatch.url).not.toContain("reconnectToken=");
    retriedMatch.open();
    retriedMatch.receive(ready());
    await flushMessages();
    expect(client.sendInput({
      direction: null,
      bombPressed: false,
      detonatePressed: false,
      skillPressed: false,
      skillHeld: false,
    }, 1)).toBe(true);
  });

  it("ignores a delayed ready from a replaced socket and never ACKs it on the new socket", async () => {
    const sockets: FakeSocket[] = [];
    const scheduled: Array<() => void> = [];
    const appliedTokens: string[] = [];
    const ackSeenDuringApply: boolean[] = [];
    const client = new AuthoritativeDuelClient({
      origin: "https://bombapvp.com",
      characterId: CHAMPION_MEMBERSHIP.ranni.characterId,
      preflight: async () => true,
      socketFactory: (url) => {
        const socket = new FakeSocket(url);
        sockets.push(socket);
        return socket;
      },
      schedule: (callback) => {
        scheduled.push(callback);
        return scheduled.length as never;
      },
      cancelSchedule: () => undefined,
      onReady: ({ reconnectToken }) => {
        appliedTokens.push(reconnectToken);
        ackSeenDuringApply.push(sockets.at(-1)?.sent.includes(
          JSON.stringify({ type: "match.ready.ack" }),
        ) ?? false);
      },
    });

    await client.start();
    sockets[0]!.open();
    sockets[0]!.receive(matchFound());
    await flushMessages();
    const oldSocket = sockets[1]!;
    oldSocket.open();
    oldSocket.receive(ready("old-ready-token-1"));
    oldSocket.serverClose();
    scheduled.shift()?.();
    const replacement = sockets[2]!;
    replacement.open();

    await flushMessages();
    expect(appliedTokens).toEqual([]);
    expect(replacement.sent).not.toContain(JSON.stringify({ type: "match.ready.ack" }));

    replacement.receive(ready("new-ready-token-1"));
    await flushMessages();
    expect(appliedTokens).toEqual(["new-ready-token-1"]);
    expect(ackSeenDuringApply).toEqual([false]);
    expect(replacement.sent).toContain(JSON.stringify({ type: "match.ready.ack" }));
  });
});
