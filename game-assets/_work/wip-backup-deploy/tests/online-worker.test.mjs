import { describe, expect, it, vi } from "vitest";
import { handleRequest, OnlineMatchmakingRoom, createServerGameAssets } from "../worker/index.js";

function createFakeSocket() {
  const listeners = new Map();
  return {
    sent: [],
    accepted: false,
    accept() {
      this.accepted = true;
    },
    send(message) {
      this.sent.push(JSON.parse(message));
    },
    addEventListener(type, listener) {
      const current = listeners.get(type) ?? [];
      current.push(listener);
      listeners.set(type, current);
    },
    emit(type, data) {
      for (const listener of listeners.get(type) ?? []) listener({ data });
    },
  };
}

describe("Cloudflare online worker lane", () => {
  it("routes /api/online websocket upgrades to the named Durable Object", async () => {
    const fetch = vi.fn(async () => new Response("switched", { status: 200 }));
    const stub = { fetch };
    const env = {
      ASSETS: { fetch: vi.fn(async () => new Response("asset")) },
      ONLINE_MATCHMAKING_ROOM: {
        idFromName: vi.fn((name) => ({ name })),
        get: vi.fn(() => stub),
      },
    };

    const response = await handleRequest(new Request("https://bombapvp.com/api/online", {
      headers: { Upgrade: "websocket" },
    }), env);

    expect(response.status).toBe(200);
    expect(env.ONLINE_MATCHMAKING_ROOM.idFromName).toHaveBeenCalledWith("endless-pvp");
    expect(env.ONLINE_MATCHMAKING_ROOM.get).toHaveBeenCalledWith({ name: "endless-pvp" });
    expect(fetch).toHaveBeenCalledOnce();
    expect(env.ASSETS.fetch).not.toHaveBeenCalled();
  });

  it("keeps production-safe headless assets without browser image loads", () => {
    const assets = createServerGameAssets();

    expect(assets.characterRoster).toHaveLength(4);
    expect(assets.players[1].idle.down).toEqual([]);
    expect(assets.floor.base).toBeNull();
    expect(assets.props.bomb).toBeNull();
    expect(assets.arenaTheme.id).toBe("tournament-clean");
  });

  it("assigns a free bot seat, stamps snapshots, and acks guest input by seat", () => {
    const room = new OnlineMatchmakingRoom({}, {});
    const first = createFakeSocket();
    const second = createFakeSocket();

    const firstEntry = room.connectFakeSocket(first);
    const secondEntry = room.connectFakeSocket(second);
    room.broadcastSnapshotTick(50);

    expect(first.accepted).toBe(true);
    expect(firstEntry.seat).toBe(1);
    expect(secondEntry.seat).toBe(2);
    expect(first.sent.some((message) => message.type === "match-started" && message.config.localPlayerId === 1)).toBe(true);
    expect(second.sent.some((message) => message.type === "match-started" && message.config.localPlayerId === 2)).toBe(true);

    const snapshotMessage = first.sent.findLast((message) => message.type === "host-snapshot");
    expect(snapshotMessage.snapshot.roomMode).toBe("endless");
    expect(snapshotMessage.snapshot.activePlayerIds).toEqual([1, 2, 3, 4]);
    expect(snapshotMessage.snapshot.botPlayerIds).toEqual([3, 4]);
    expect(snapshotMessage.snapshot.paused).toBe(false);
    expect(snapshotMessage.snapshot.serverTimeMs).toBe(50);
    expect(snapshotMessage.snapshot.serverTick).toBe(1);
    expect(snapshotMessage.snapshot.frameId).toBe(1);

    second.emit("message", JSON.stringify({
      type: "guest-input",
      inputSeq: 7,
      sentAtMs: 1,
      input: { direction: "left", bombPressed: true, detonatePressed: false, skillPressed: false },
    }));
    room.broadcastSnapshotTick(50);

    const acked = second.sent.findLast((message) => message.type === "host-snapshot").snapshot.ackedInputSeq;
    expect(acked[1]).toBe(0);
    expect(acked[2]).toBe(7);

    second.emit("close");
    expect(first.sent.findLast((message) => message.type === "match-started").config.botPlayerIds).toContain(2);
    room.handleSocketClose(first);
  });
});
