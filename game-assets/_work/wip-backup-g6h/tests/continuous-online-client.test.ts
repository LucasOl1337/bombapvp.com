import { describe, expect, it, vi } from "vitest";
import {
  createContinuousOnlineClient,
  createContinuousOnlineUrl,
  type ContinuousOnlineStatus,
} from "../src/original-game/NetCode/continuous-online-client.ts";
import type { MatchStartConfig, OnlineGameSnapshot } from "../src/original-game/NetCode/protocol.ts";

class FakeWebSocket extends EventTarget {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  static instances: FakeWebSocket[] = [];

  readonly url: string;
  readyState = FakeWebSocket.CONNECTING;
  sent: string[] = [];

  constructor(url: string | URL) {
    super();
    this.url = String(url);
    FakeWebSocket.instances.push(this);
  }

  open(): void {
    this.readyState = FakeWebSocket.OPEN;
    this.dispatchEvent(new Event("open"));
  }

  receive(data: unknown): void {
    this.dispatchEvent(new MessageEvent("message", { data }));
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.readyState = FakeWebSocket.CLOSED;
    this.dispatchEvent(new CloseEvent("close"));
  }
}

describe("continuous online browser client", () => {
  it("builds a same-origin continuous websocket URL", () => {
    expect(createContinuousOnlineUrl({ protocol: "https:", host: "bombapvp.com" })).toBe(
      "wss://bombapvp.com/api/online?mode=continuous",
    );
    expect(createContinuousOnlineUrl({ protocol: "http:", host: "localhost:5173" })).toBe(
      "ws://localhost:5173/api/online?mode=continuous",
    );
  });

  it("requests an endless continuous match with the selected character and sends guest input sequences", () => {
    FakeWebSocket.instances = [];
    const statuses: ContinuousOnlineStatus[] = [];
    const game = {
      startOnlineMatch: vi.fn(),
      applyOnlineSnapshot: vi.fn(),
    };
    const client = createContinuousOnlineClient(game, {
      selectedCharacterIndex: 2,
      location: { protocol: "https:", host: "bombapvp.com" },
      WebSocketCtor: FakeWebSocket as unknown as typeof WebSocket,
      now: () => 1234,
      onStatus: (status) => statuses.push(status),
    });

    expect(client.session.role).toBe("guest");
    client.connect();
    const socket = FakeWebSocket.instances[0];
    expect(socket?.url).toBe("wss://bombapvp.com/api/online?mode=continuous");

    socket?.open();
    expect(socket?.sent.map((payload) => JSON.parse(payload))).toEqual([
      { type: "endless-match", characterIndex: 2 },
    ]);

    client.session.sendGuestInput({
      direction: "right",
      bombPressed: true,
      detonatePressed: false,
      skillPressed: false,
      skillHeld: true,
    }, 7);

    expect(socket?.sent.map((payload) => JSON.parse(payload))[1]).toEqual({
      type: "guest-input",
      inputSeq: 7,
      sentAtMs: 1234,
      input: {
        direction: "right",
        bombPressed: true,
        detonatePressed: false,
        skillPressed: false,
        skillHeld: true,
      },
    });
    expect(statuses.map(({ state }) => state)).toEqual(["connecting", "waiting"]);
  });

  it("applies only match-started and host-snapshot server messages", () => {
    FakeWebSocket.instances = [];
    const statuses: ContinuousOnlineStatus[] = [];
    const config = { localPlayerId: 2 } as MatchStartConfig;
    const snapshot = { frameId: 9 } as OnlineGameSnapshot;
    const game = {
      startOnlineMatch: vi.fn(),
      applyOnlineSnapshot: vi.fn(),
    };
    const client = createContinuousOnlineClient(game, {
      selectedCharacterIndex: 1,
      location: { protocol: "https:", host: "bombapvp.com" },
      WebSocketCtor: FakeWebSocket as unknown as typeof WebSocket,
      onStatus: (status) => statuses.push(status),
    });

    client.connect();
    const socket = FakeWebSocket.instances[0];
    socket?.open();
    socket?.receive(JSON.stringify({ type: "match-started", config }));
    socket?.receive(JSON.stringify({ type: "host-snapshot", snapshot }));
    socket?.receive(JSON.stringify({ type: "chat-message", body: "ignored" }));

    expect(game.startOnlineMatch).toHaveBeenCalledExactlyOnceWith(config);
    expect(game.applyOnlineSnapshot).toHaveBeenCalledExactlyOnceWith(snapshot);
    expect(statuses.at(-1)).toEqual({
      state: "error",
      message: "Online server sent an unsupported message.",
    });
  });

  it("surfaces server errors and unexpected closes instead of falling back offline", () => {
    FakeWebSocket.instances = [];
    const statuses: ContinuousOnlineStatus[] = [];
    const game = {
      startOnlineMatch: vi.fn(),
      applyOnlineSnapshot: vi.fn(),
    };
    const client = createContinuousOnlineClient(game, {
      selectedCharacterIndex: 0,
      location: { protocol: "https:", host: "bombapvp.com" },
      WebSocketCtor: FakeWebSocket as unknown as typeof WebSocket,
      onStatus: (status) => statuses.push(status),
    });

    client.connect();
    const socket = FakeWebSocket.instances[0];
    socket?.open();
    socket?.receive(JSON.stringify({ type: "error", message: "no host available" }));
    socket?.close();

    expect(game.startOnlineMatch).not.toHaveBeenCalled();
    expect(statuses.slice(-2)).toEqual([
      { state: "error", message: "no host available" },
      { state: "closed", message: "Online connection closed. Return and try again." },
    ]);
  });
});
