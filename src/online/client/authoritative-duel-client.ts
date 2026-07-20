import type { CharacterId } from "../../../Champions/membership";
import type { OnlineGameSnapshot, OnlineInputState } from "../../original-game/NetCode/protocol";
import type { PlayerId } from "../../original-game/Gameplay/types";
import { ONLINE_CONTENT_REVISION } from "../content-revision";
import {
  type ClientControlMessage,
  decodeServerControlMessage,
  encodeClientControlMessage,
  type PlacementHint,
  type ServerControlMessage,
} from "../protocol/control-messages";
import { ONLINE_MODE_ID, ONLINE_PROTOCOL_VERSION } from "../protocol/contracts";
import {
  decodeServerFrameEnvelope,
  type ServerFrameEnvelope,
} from "../protocol/frame-envelope";
import { encodePlayerCommand } from "../protocol/input-codec";
import { OnlineSnapshotCodec } from "../protocol/snapshot-codec";

const SOCKET_OPEN = 1;
const MAX_QUEUE_RETRIES = 5;
const RECONNECT_WINDOW_MS = 10_000;
const SERVER_TICK_RATE = 60;

type TimerHandle = ReturnType<typeof setTimeout>;

export type DuelClientPhase =
  | "checking"
  | "connecting-queue"
  | "waiting"
  | "connecting-match"
  | "waiting-peer"
  | "playing"
  | "reconnecting"
  | "peer-reconnecting"
  | "ended"
  | "error"
  | "stopped";

export type DuelClientStatus = Readonly<{
  phase: DuelClientPhase;
  code?: string;
  attempt?: number;
  deadlineMs?: number | null;
  winnerSeat?: 1 | 2 | null;
}>;

export type DuelReady = Readonly<{
  matchId: string;
  sessionId: string;
  seat: 1 | 2;
  reconnectToken: string;
}>;

export type DuelNetworkMetrics = Readonly<{
  sentBytes: number;
  receivedBytes: number;
  frames: number;
  keyframes: number;
  deltas: number;
  resyncRequests: number;
  reconnects: number;
}>;

export interface WebSocketPort {
  binaryType: string;
  readonly readyState: number;
  send(data: string | ArrayBuffer | ArrayBufferView): void;
  close(code?: number, reason?: string): void;
  addEventListener(type: string, listener: (event: any) => void): void;
}

export type WebSocketFactory = (url: string) => WebSocketPort;

export interface AuthoritativeDuelClientOptions {
  readonly origin: string;
  readonly characterId: CharacterId;
  readonly socketFactory?: WebSocketFactory;
  readonly preflight?: () => Promise<boolean>;
  readonly now?: () => number;
  readonly schedule?: (callback: () => void, delayMs: number) => TimerHandle;
  readonly cancelSchedule?: (handle: TimerHandle) => void;
  readonly onStatus?: (status: DuelClientStatus) => void;
  readonly onReady?: (ready: DuelReady) => void;
  readonly onSnapshot?: (
    snapshot: OnlineGameSnapshot,
    frame: Readonly<Omit<ServerFrameEnvelope, "payload">>,
  ) => void;
}

type FoundMatch = Readonly<{
  matchId: string;
  ticket: string;
  placement: PlacementHint;
  connectPath: string;
}>;

/**
 * Browser transport for duel-1v1-v1. It never simulates authority locally:
 * the only upstream gameplay data is a 16-byte input command.
 */
export class AuthoritativeDuelClient {
  private readonly origin: string;
  private readonly characterId: CharacterId;
  private readonly socketFactory: WebSocketFactory;
  private readonly preflight: () => Promise<boolean>;
  private readonly now: () => number;
  private readonly schedule: (callback: () => void, delayMs: number) => TimerHandle;
  private readonly cancelSchedule: (handle: TimerHandle) => void;
  private readonly onStatus: (status: DuelClientStatus) => void;
  private readonly onReady: (ready: DuelReady) => void;
  private readonly onSnapshot: AuthoritativeDuelClientOptions["onSnapshot"];
  private readonly codec = new OnlineSnapshotCodec();
  private readonly clientNonce = createClientNonce();

  private queueSocket: WebSocketPort | null = null;
  private matchSocket: WebSocketPort | null = null;
  private retryTimer: TimerHandle | null = null;
  private reconnectExpiryTimer: TimerHandle | null = null;
  private found: FoundMatch | null = null;
  private ready: DuelReady | null = null;
  private lastSnapshot: OnlineGameSnapshot | null = null;
  private lastFrameId = 0;
  private lastServerTick = 0;
  private lastFrameReceivedAtMs = 0;
  private queueAttempts = 0;
  private reconnectAttempts = 0;
  private reconnectStartedAtMs: number | null = null;
  private matchConnectStartedAtMs: number | null = null;
  private peerReconnecting: Readonly<{ seat: 1 | 2; deadlineMs: number | null }> | null = null;
  private awaitingKeyframe = true;
  private resyncRequested = false;
  private started = false;
  private stopped = false;
  private terminal = false;
  private phase: DuelClientPhase = "stopped";
  private mutableMetrics = {
    sentBytes: 0,
    receivedBytes: 0,
    frames: 0,
    keyframes: 0,
    deltas: 0,
    resyncRequests: 0,
    reconnects: 0,
  };

  constructor(options: AuthoritativeDuelClientOptions) {
    this.origin = options.origin;
    this.characterId = options.characterId;
    this.socketFactory = options.socketFactory ?? ((url) => new WebSocket(url) as unknown as WebSocketPort);
    this.preflight = options.preflight ?? (() => fetchOnlineAvailability(this.origin));
    this.now = options.now ?? (() => Date.now());
    this.schedule = options.schedule ?? ((callback, delayMs) => setTimeout(callback, delayMs));
    this.cancelSchedule = options.cancelSchedule ?? ((handle) => clearTimeout(handle));
    this.onStatus = options.onStatus ?? (() => undefined);
    this.onReady = options.onReady ?? (() => undefined);
    this.onSnapshot = options.onSnapshot;
  }

  public async start(): Promise<void> {
    if (this.started || this.stopped) return;
    this.started = true;
    this.publishStatus({ phase: "checking" });
    let available = false;
    try {
      available = await this.preflight();
    } catch {
      available = false;
    }
    if (this.stopped) return;
    if (!available) {
      this.fail("online-unavailable");
      return;
    }
    this.openQueue();
  }

  public stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    this.clearRetry();
    this.clearReconnectExpiry();
    const queue = this.queueSocket;
    const match = this.matchSocket;
    this.queueSocket = null;
    this.matchSocket = null;
    closeSocket(queue, 1000, "client_stop");
    closeSocket(match, 1000, "client_stop");
    if (!this.terminal) this.publishStatus({ phase: "stopped" });
  }

  public sendInput(input: OnlineInputState, inputSeq: number): boolean {
    const socket = this.matchSocket;
    if (!socket || socket.readyState !== SOCKET_OPEN || !this.ready || this.phase === "ended") {
      return false;
    }
    const estimatedServerTick = this.estimateServerTick();
    const packet = encodePlayerCommand({
      seq: inputSeq,
      clientTick: estimatedServerTick,
      lastServerTick: this.lastServerTick,
      direction: input.direction,
      bombPressed: input.bombPressed,
      detonatePressed: input.detonatePressed,
      skillPressed: input.skillPressed,
      skillHeld: Boolean(input.skillHeld),
    });
    try {
      socket.send(packet);
      this.mutableMetrics.sentBytes += packet.byteLength;
      return true;
    } catch {
      return false;
    }
  }

  public getMetrics(): DuelNetworkMetrics {
    return Object.freeze({ ...this.mutableMetrics });
  }

  private openQueue(): void {
    if (this.stopped || this.terminal || this.found) return;
    this.clearRetry();
    this.queueAttempts += 1;
    this.publishStatus({ phase: "connecting-queue", attempt: this.queueAttempts });
    const socket = this.socketFactory(toWebSocketUrl("/api/online/queue", this.origin));
    socket.binaryType = "arraybuffer";
    this.queueSocket = socket;
    socket.addEventListener("open", () => {
      if (this.queueSocket !== socket || this.stopped) return;
      const message = encodeClientControlMessage({
        type: "queue.join",
        protocolVersion: ONLINE_PROTOCOL_VERSION,
        modeId: ONLINE_MODE_ID,
        contentRevision: ONLINE_CONTENT_REVISION,
        characterId: this.characterId,
        clientNonce: this.clientNonce,
      });
      socket.send(message);
      this.mutableMetrics.sentBytes += byteLength(message);
    });
    socket.addEventListener("message", (event) => {
      if (this.queueSocket === socket) void this.handleQueueMessage(event.data);
    });
    socket.addEventListener("close", () => {
      if (this.queueSocket !== socket) return;
      this.queueSocket = null;
      if (!this.found) this.retryQueue();
    });
    socket.addEventListener("error", () => undefined);
  }

  private async handleQueueMessage(raw: unknown): Promise<void> {
    const data = await normalizeSocketData(raw);
    if (data === null || this.stopped || this.found) return;
    this.mutableMetrics.receivedBytes += byteLength(data);
    const decoded = decodeServerControlMessage(data);
    if (!decoded.ok) {
      this.fail("invalid-queue-control");
      return;
    }
    const message = decoded.message;
    if (message.type === "queue.status") {
      this.queueAttempts = 0;
      this.publishStatus({ phase: "waiting" });
      return;
    }
    if (message.type === "error") {
      this.fail(message.code);
      return;
    }
    if (message.type !== "match.found") {
      this.fail("unexpected-queue-control");
      return;
    }
    this.found = {
      matchId: message.matchId,
      ticket: message.ticket,
      placement: message.placement,
      connectPath: message.connectPath,
    };
    const queue = this.queueSocket;
    this.queueSocket = null;
    closeSocket(queue, 1000, "match_found");
    this.openMatch(false);
  }

  private retryQueue(): void {
    if (this.stopped || this.terminal || this.found) return;
    if (this.queueAttempts >= MAX_QUEUE_RETRIES) {
      this.fail("queue-connection-failed");
      return;
    }
    const delayMs = Math.min(2_000, 200 * 2 ** Math.max(0, this.queueAttempts - 1));
    this.retryTimer = this.schedule(() => {
      this.retryTimer = null;
      this.openQueue();
    }, delayMs);
  }

  private openMatch(reconnect: boolean): void {
    if (this.stopped || this.terminal || !this.found) return;
    this.clearRetry();
    this.publishStatus({
      phase: reconnect ? "reconnecting" : "connecting-match",
      ...(this.reconnectAttempts > 0 ? { attempt: this.reconnectAttempts } : {}),
    });
    const url = new URL(this.found.connectPath, this.origin);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    url.searchParams.set("placement", this.found.placement);
    if (reconnect && this.ready) {
      url.searchParams.set("sessionId", this.ready.sessionId);
      url.searchParams.set("reconnectToken", this.ready.reconnectToken);
    } else {
      url.searchParams.set("ticket", this.found.ticket);
    }
    const socket = this.socketFactory(url.toString());
    socket.binaryType = "arraybuffer";
    this.matchSocket = socket;
    socket.addEventListener("message", (event) => {
      void this.handleMatchMessage(socket, event.data);
    });
    socket.addEventListener("close", () => {
      if (this.matchSocket !== socket) return;
      this.matchSocket = null;
      this.handleMatchDisconnect();
    });
    socket.addEventListener("error", () => undefined);
  }

  private async handleMatchMessage(sourceSocket: WebSocketPort, raw: unknown): Promise<void> {
    const data = await normalizeSocketData(raw);
    if (
      data === null
      || this.matchSocket !== sourceSocket
      || this.stopped
      || this.terminal
    ) return;
    this.mutableMetrics.receivedBytes += byteLength(data);
    if (typeof data === "string") {
      const decoded = decodeServerControlMessage(data);
      if (!decoded.ok) {
        this.fail("invalid-match-control");
        return;
      }
      this.handleMatchControl(decoded.message, sourceSocket);
      return;
    }
    this.handleFrame(data);
  }

  private handleMatchControl(message: ServerControlMessage, sourceSocket: WebSocketPort): void {
    if (message.type === "error") {
      this.fail(message.code);
      return;
    }
    if (message.type === "match.ready") {
      if (!this.found || message.matchId !== this.found.matchId) {
        this.fail("match-identity-mismatch");
        return;
      }
      if (
        this.ready
        && (message.sessionId !== this.ready.sessionId || message.seat !== this.ready.seat)
      ) {
        this.fail("session-identity-mismatch");
        return;
      }
      const wasReconnect = this.ready !== null;
      this.ready = {
        matchId: message.matchId,
        sessionId: message.sessionId,
        seat: message.seat,
        reconnectToken: message.reconnectToken,
      };
      if (wasReconnect) this.mutableMetrics.reconnects += 1;
      this.reconnectAttempts = 0;
      this.reconnectStartedAtMs = null;
      this.matchConnectStartedAtMs = null;
      this.peerReconnecting = null;
      this.clearRetry();
      this.clearReconnectExpiry();
      this.awaitingKeyframe = true;
      this.resyncRequested = false;
      this.onReady(this.ready);
      this.publishStatus({ phase: "waiting-peer" });
      this.sendReadyAck(sourceSocket);
      return;
    }
    if (message.type === "peer.status") {
      if (this.ready && message.seat !== this.ready.seat && message.state === "reconnecting") {
        this.peerReconnecting = { seat: message.seat, deadlineMs: message.deadlineMs };
        this.publishStatus({
          phase: "peer-reconnecting",
          deadlineMs: message.deadlineMs,
        });
        return;
      }
      if (
        this.ready
        && message.seat !== this.ready.seat
        && message.state === "connected"
      ) {
        this.peerReconnecting = null;
      }
      if (this.lastSnapshot && !this.awaitingKeyframe && !this.peerReconnecting) {
        this.publishStatus({ phase: "playing" });
      }
      return;
    }
    if (message.type === "match.ended") {
      this.terminal = true;
      this.clearRetry();
      this.clearReconnectExpiry();
      this.publishStatus({
        phase: "ended",
        code: message.reason,
        winnerSeat: message.winnerSeat,
      });
      this.sendMatchEndedAck(sourceSocket);
      return;
    }
    this.fail("unexpected-match-control");
  }

  private handleFrame(packet: Uint8Array): void {
    if (!this.ready) {
      this.fail("frame-before-ready");
      return;
    }
    const decoded = decodeServerFrameEnvelope(packet);
    if (!decoded.ok) {
      this.requestResync();
      return;
    }
    const frame = decoded.frame;
    if (
      frame.frameId < this.lastFrameId
      || (frame.frameId === this.lastFrameId && (!this.awaitingKeyframe || frame.kind !== "keyframe"))
    ) return;

    let decodedState;
    if (frame.kind === "keyframe") {
      decodedState = this.codec.decodeKeyframe(frame.payload);
    } else {
      if (
        this.awaitingKeyframe
        || !this.lastSnapshot
        || frame.baselineFrameId !== this.lastFrameId
      ) {
        this.requestResync();
        return;
      }
      decodedState = this.codec.applyDelta(this.lastSnapshot, frame.payload);
    }
    if (!decodedState.ok || !isDuelSnapshot(decodedState.snapshot)) {
      this.requestResync();
      return;
    }

    const snapshot = stampEnvelope(decodedState.snapshot, frame, this.ready.seat);
    this.lastSnapshot = snapshot;
    this.lastFrameId = frame.frameId;
    this.lastServerTick = frame.serverTick;
    this.lastFrameReceivedAtMs = this.now();
    this.awaitingKeyframe = false;
    this.resyncRequested = false;
    this.mutableMetrics.frames += 1;
    if (frame.kind === "keyframe") this.mutableMetrics.keyframes += 1;
    else this.mutableMetrics.deltas += 1;
    if (!this.peerReconnecting) this.publishStatus({ phase: "playing" });
    this.onSnapshot?.(snapshot, {
      kind: frame.kind,
      serverTick: frame.serverTick,
      frameId: frame.frameId,
      ackInputSeq: frame.ackInputSeq,
      baselineFrameId: frame.baselineFrameId,
    });
  }

  private requestResync(): void {
    if (this.resyncRequested) return;
    this.awaitingKeyframe = true;
    const socket = this.matchSocket;
    if (!socket || socket.readyState !== SOCKET_OPEN) return;
    if (this.sendMatchControl({ type: "frame.resync" })) {
      this.resyncRequested = true;
      this.mutableMetrics.resyncRequests += 1;
    }
  }

  private handleMatchDisconnect(): void {
    if (this.stopped || this.terminal) return;
    const nowMs = this.now();
    if (!this.ready) {
      this.matchConnectStartedAtMs ??= nowMs;
      const elapsedMs = nowMs - this.matchConnectStartedAtMs;
      if (elapsedMs >= RECONNECT_WINDOW_MS) {
        this.fail("match-connection-failed");
        return;
      }
      this.reconnectAttempts += 1;
      this.scheduleMatchRetry(false, elapsedMs);
      this.armReconnectExpiry(this.matchConnectStartedAtMs, "match-connection-failed");
      return;
    }
    this.reconnectStartedAtMs ??= nowMs;
    const elapsedMs = nowMs - this.reconnectStartedAtMs;
    if (elapsedMs >= RECONNECT_WINDOW_MS) {
      this.fail("reconnect-expired");
      return;
    }
    this.reconnectAttempts += 1;
    this.scheduleMatchRetry(true, elapsedMs);
    this.armReconnectExpiry(this.reconnectStartedAtMs, "reconnect-expired");
  }

  private scheduleMatchRetry(reconnect: boolean, elapsedMs: number): void {
    const delayMs = Math.min(
      RECONNECT_WINDOW_MS - elapsedMs,
      Math.min(1_500, 150 * 2 ** Math.min(4, this.reconnectAttempts - 1)),
    );
    this.publishStatus({
      phase: reconnect ? "reconnecting" : "connecting-match",
      attempt: this.reconnectAttempts,
    });
    let handle!: TimerHandle;
    handle = this.schedule(() => {
      if (this.retryTimer !== handle) return;
      this.retryTimer = null;
      const startedAtMs = reconnect ? this.reconnectStartedAtMs : this.matchConnectStartedAtMs;
      if (startedAtMs === null || this.now() - startedAtMs >= RECONNECT_WINDOW_MS) {
        this.fail(reconnect ? "reconnect-expired" : "match-connection-failed");
        return;
      }
      this.openMatch(reconnect);
    }, delayMs);
    this.retryTimer = handle;
  }

  private armReconnectExpiry(startedAtMs: number, code: string): void {
    if (this.reconnectExpiryTimer !== null) return;
    const delayMs = Math.max(0, RECONNECT_WINDOW_MS - (this.now() - startedAtMs));
    let handle!: TimerHandle;
    handle = this.schedule(() => {
      if (this.reconnectExpiryTimer !== handle) return;
      this.reconnectExpiryTimer = null;
      this.fail(code);
    }, delayMs);
    this.reconnectExpiryTimer = handle;
  }

  private sendMatchEndedAck(sourceSocket: WebSocketPort): void {
    this.sendMatchControl({ type: "match.ended.ack" }, sourceSocket);
  }

  private sendReadyAck(sourceSocket: WebSocketPort): void {
    this.sendMatchControl({ type: "match.ready.ack" }, sourceSocket);
  }

  private sendMatchControl(
    message: ClientControlMessage,
    sourceSocket: WebSocketPort | null = this.matchSocket,
  ): boolean {
    if (
      !sourceSocket
      || this.matchSocket !== sourceSocket
      || sourceSocket.readyState !== SOCKET_OPEN
    ) return false;
    const encoded = encodeClientControlMessage(message);
    try {
      sourceSocket.send(encoded);
      this.mutableMetrics.sentBytes += byteLength(encoded);
      return true;
    } catch {
      // The server also has a bounded terminal-close fallback.
      return false;
    }
  }

  private estimateServerTick(): number {
    if (this.lastFrameReceivedAtMs === 0) return this.lastServerTick;
    const elapsedTicks = Math.floor(Math.max(0, this.now() - this.lastFrameReceivedAtMs) * SERVER_TICK_RATE / 1_000);
    return Math.min(0xffff_ffff, this.lastServerTick + Math.min(180, elapsedTicks));
  }

  private fail(code: string): void {
    if (this.terminal || this.stopped) return;
    this.terminal = true;
    this.clearRetry();
    this.clearReconnectExpiry();
    this.publishStatus({ phase: "error", code });
    const queue = this.queueSocket;
    const match = this.matchSocket;
    this.queueSocket = null;
    this.matchSocket = null;
    closeSocket(queue, 1008, "client_error");
    closeSocket(match, 1008, "client_error");
  }

  private publishStatus(status: DuelClientStatus): void {
    if (this.phase === status.phase && status.phase === "playing") return;
    this.phase = status.phase;
    this.onStatus(Object.freeze({ ...status }));
  }

  private clearRetry(): void {
    if (this.retryTimer === null) return;
    this.cancelSchedule(this.retryTimer);
    this.retryTimer = null;
  }

  private clearReconnectExpiry(): void {
    if (this.reconnectExpiryTimer === null) return;
    this.cancelSchedule(this.reconnectExpiryTimer);
    this.reconnectExpiryTimer = null;
  }
}

async function fetchOnlineAvailability(origin: string): Promise<boolean> {
  const response = await fetch(new URL("/api/online", origin), {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) return false;
  const value = await response.json() as unknown;
  return isRecord(value)
    && value.ok === true
    && value.available === true
    && value.mode === ONLINE_MODE_ID;
}

function stampEnvelope(
  source: OnlineGameSnapshot,
  frame: ServerFrameEnvelope,
  seat: PlayerId,
): OnlineGameSnapshot {
  return {
    ...source,
    serverTimeMs: frame.serverTick * 1_000 / SERVER_TICK_RATE,
    serverTick: frame.serverTick,
    frameId: frame.frameId,
    ackedInputSeq: {
      ...source.ackedInputSeq,
      [seat]: frame.ackInputSeq,
    },
  };
}

function isDuelSnapshot(value: OnlineGameSnapshot): boolean {
  return value.roomMode === "classic"
    && Array.isArray(value.activePlayerIds)
    && value.activePlayerIds.length === 2
    && value.activePlayerIds[0] === 1
    && value.activePlayerIds[1] === 2
    && Array.isArray(value.botPlayerIds)
    && value.botPlayerIds.length === 0
    && isRecord(value.players)
    && isRecord(value.players[1])
    && isRecord(value.players[2])
    && isRecord(value.arena)
    && isRecord(value.selectedCharacterIndex)
    && Array.isArray(value.bombs)
    && Array.isArray(value.flames)
    && Array.isArray(value.breakableTiles)
    && Number.isSafeInteger(value.roundNumber)
    && Number.isFinite(value.roundTimeMs);
}

function toWebSocketUrl(path: string, origin: string): string {
  const url = new URL(path, origin);
  if (url.protocol === "https:") url.protocol = "wss:";
  else if (url.protocol === "http:") url.protocol = "ws:";
  else throw new Error("online origin must use http or https");
  return url.toString();
}

async function normalizeSocketData(value: unknown): Promise<string | Uint8Array | null> {
  if (typeof value === "string") return value;
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  if (typeof Blob !== "undefined" && value instanceof Blob) {
    return new Uint8Array(await value.arrayBuffer());
  }
  return null;
}

function closeSocket(socket: WebSocketPort | null, code: number, reason: string): void {
  if (!socket) return;
  try {
    socket.close(code, reason);
  } catch {
    // A browser may already have transitioned to CLOSED.
  }
}

function byteLength(value: string | Uint8Array): number {
  return typeof value === "string" ? new TextEncoder().encode(value).byteLength : value.byteLength;
}

function createClientNonce(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/u, "");
}

function isRecord(value: unknown): value is Record<string | number, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
