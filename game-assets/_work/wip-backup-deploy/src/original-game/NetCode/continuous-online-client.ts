import type { GameApp } from "../Engine/game-app";
import type {
  ClientMessage,
  MatchStartConfig,
  OnlineGameSnapshot,
  OnlineInputState,
  OnlineSessionBridge,
} from "./protocol";

type ContinuousServerMessage =
  | { type: "match-started"; config: MatchStartConfig }
  | { type: "host-snapshot"; snapshot: OnlineGameSnapshot }
  | { type: "error"; message?: string };

export type ContinuousOnlineState = "connecting" | "waiting" | "playing" | "error" | "closed";

export interface ContinuousOnlineStatus {
  state: ContinuousOnlineState;
  message: string;
}

export interface ContinuousOnlineClientOptions {
  selectedCharacterIndex: number;
  location: Pick<Location, "protocol" | "host">;
  WebSocketCtor: typeof WebSocket;
  now?: () => number;
  onStatus?: (status: ContinuousOnlineStatus) => void;
}

export interface ContinuousOnlineClient {
  session: OnlineSessionBridge;
  connect(): void;
  close(code?: number, reason?: string): void;
}

export function createContinuousOnlineClient(
  game: Pick<GameApp, "startOnlineMatch" | "applyOnlineSnapshot">,
  options: ContinuousOnlineClientOptions,
): ContinuousOnlineClient {
  const now = options.now ?? (() => Date.now());
  let socket: WebSocket | null = null;
  let closedByClient = false;
  let lastState: ContinuousOnlineState | null = null;

  const publish = (state: ContinuousOnlineState, message: string): void => {
    lastState = state;
    options.onStatus?.({ state, message });
  };

  const sendJson = (message: ClientMessage): void => {
    if (!socket || socket.readyState !== options.WebSocketCtor.OPEN) {
      if (lastState !== "closed" && lastState !== "error") {
        publish("error", "Online connection is not open.");
      }
      return;
    }
    socket.send(JSON.stringify(message));
  };

  const session: OnlineSessionBridge = {
    role: "guest",
    roomCode: null,
    sendGuestInput(input: OnlineInputState, inputSeq: number): void {
      sendJson({
        type: "guest-input",
        inputSeq,
        sentAtMs: now(),
        input,
      });
    },
    sendHostSnapshot(): void {
      // Continuous browser clients are guests only in this bounded lane.
    },
    sendMatchResultChoice(): void {
      // Rematch/lobby flow is intentionally out of scope for continuous online.
    },
  };

  return {
    session,
    connect(): void {
      if (socket && socket.readyState !== options.WebSocketCtor.CLOSED) {
        return;
      }
      closedByClient = false;
      publish("connecting", "Connecting to online arena…");
      socket = new options.WebSocketCtor(createContinuousOnlineUrl(options.location));
      socket.addEventListener("open", () => {
        publish("waiting", "Connected. Finding a continuous arena…");
        sendJson({ type: "endless-match", characterIndex: options.selectedCharacterIndex });
      });
      socket.addEventListener("message", (event: MessageEvent) => {
        const message = parseContinuousServerMessage(event.data);
        if (!message) {
          publish("error", "Online server sent an unsupported message.");
          return;
        }
        if (message.type === "match-started") {
          game.startOnlineMatch(message.config);
          publish("playing", "Online match started.");
          return;
        }
        if (message.type === "host-snapshot") {
          game.applyOnlineSnapshot(message.snapshot);
          return;
        }
        publish("error", message.message?.trim() || "Online server reported an error.");
      });
      socket.addEventListener("error", () => {
        publish("error", "Online connection failed.");
      });
      socket.addEventListener("close", () => {
        if (!closedByClient) {
          publish("closed", "Online connection closed. Return and try again.");
        }
      });
    },
    close(code?: number, reason?: string): void {
      closedByClient = true;
      socket?.close(code, reason);
      socket = null;
    },
  };
}

export function createContinuousOnlineUrl(location: Pick<Location, "protocol" | "host">): string {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${location.host}/api/online?mode=continuous`;
}

function parseContinuousServerMessage(data: unknown): ContinuousServerMessage | null {
  if (typeof data !== "string") {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch {
    return null;
  }
  if (!isRecord(parsed) || typeof parsed.type !== "string") {
    return null;
  }
  if (parsed.type === "match-started" && isRecord(parsed.config)) {
    return parsed as ContinuousServerMessage;
  }
  if (parsed.type === "host-snapshot" && isRecord(parsed.snapshot)) {
    return parsed as ContinuousServerMessage;
  }
  if (parsed.type === "error") {
    return parsed as ContinuousServerMessage;
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
