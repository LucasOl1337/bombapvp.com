import { GameApp } from "../src/original-game/Engine/game-app.ts";
import { createDefaultArenaDefinition } from "../src/original-game/Arenas/arena.ts";
import { GameAppCharacterizationKernel } from "../src/online/game/game-app-characterization-kernel.ts";
import { createServerGameAssets, getServerRosterIndex } from "../src/online/game/server-game-assets.ts";
import { DuelMatchQueue, placementFromRequestLocation } from "../src/online/matchmaking/duel-queue.ts";
import {
  decodeClientControlMessage,
  encodeServerControlMessage,
} from "../src/online/protocol/control-messages.ts";
import { decodeServerFrameEnvelope } from "../src/online/protocol/frame-envelope.ts";
import { decodePlayerCommand } from "../src/online/protocol/input-codec.ts";
import { OnlineSnapshotCodec } from "../src/online/protocol/snapshot-codec.ts";
import { AuthoritativeMatchRuntime } from "../src/online/runtime/authoritative-match.ts";
import {
  createMatchTicketPayload,
  matchTicketPayloadsEqual,
  randomOnlineId,
  signMatchTicket,
  verifyMatchTicket,
} from "../src/online/session/match-ticket.ts";

const LAB_ROUTES = new Map([
  ["/api/lab/health", { method: "GET", target: "/health" }],
  ["/api/lab/models", { method: "GET", target: "/models" }],
  ["/api/lab/decision", { method: "POST", target: "/decision" }],
]);

const ONLINE_STATUS_ROUTE = "/api/online";
const ONLINE_QUEUE_ROUTE = "/api/online/queue";
const ONLINE_MATCH_ROUTE = /^\/api\/online\/matches\/([A-Za-z0-9_-]{16,64})$/u;
const ONLINE_QUEUE_OBJECT_NAME = "duel-1v1-v1:queue:v1";
const MATCH_SCHEDULER_INTERVAL_MS = 50;
const RECONNECT_WINDOW_MS = 10_000;
const PEER_JOIN_TIMEOUT_MS = 20_000;
const TERMINAL_ACK_TIMEOUT_MS = 1_000;
const MAX_PROTOCOL_STRIKES = 8;

function json(status, body) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function isWebSocketUpgrade(request) {
  return request.headers.get("Upgrade")?.toLowerCase() === "websocket";
}

function hasValidOnlineTicketSecret(env) {
  return typeof env.ONLINE_TICKET_SECRET === "string"
    && new TextEncoder().encode(env.ONLINE_TICKET_SECRET).byteLength >= 32;
}

function requestIdFromBody(body) {
  if (!body) return null;
  try {
    const value = JSON.parse(new TextDecoder().decode(body));
    return typeof value?.requestId === "string" && value.requestId.length > 0
      ? value.requestId
      : null;
  } catch {
    return null;
  }
}

function decisionError(status, code, requestId) {
  return json(status, {
    ok: false,
    error: { code },
    ...(requestId ? { requestId } : {}),
  });
}

export async function handleRequest(request, env, fetchImpl = globalThis.fetch) {
  const url = new URL(request.url);
  if (url.pathname === ONLINE_STATUS_ROUTE) {
    if (request.method !== "GET") return json(405, { ok: false, error: "method_not_allowed" });
    return json(200, {
      ok: true,
      mode: "duel-1v1-v1",
      available: Boolean(
        hasValidOnlineTicketSecret(env)
        && env.ONLINE_MATCHMAKING_ROOM
        && env.ONLINE_MATCH,
      ),
    });
  }
  if (url.pathname === ONLINE_QUEUE_ROUTE) {
    if (!isWebSocketUpgrade(request)) return json(426, { ok: false, error: "websocket_required" });
    if (!hasValidOnlineTicketSecret(env) || !env.ONLINE_MATCHMAKING_ROOM) {
      return json(503, { ok: false, error: "online_queue_not_configured" });
    }
    const id = env.ONLINE_MATCHMAKING_ROOM.idFromName(ONLINE_QUEUE_OBJECT_NAME);
    return env.ONLINE_MATCHMAKING_ROOM.get(id).fetch(request);
  }
  const matchRoute = ONLINE_MATCH_ROUTE.exec(url.pathname);
  if (matchRoute) {
    if (!isWebSocketUpgrade(request)) return json(426, { ok: false, error: "websocket_required" });
    if (!hasValidOnlineTicketSecret(env) || !env.ONLINE_MATCH) {
      return json(503, { ok: false, error: "online_match_not_configured" });
    }
    const matchId = matchRoute[1];
    const placement = normalizePlacement(url.searchParams.get("placement"));
    const id = env.ONLINE_MATCH.idFromName(matchId);
    return env.ONLINE_MATCH.get(id, { locationHint: placement }).fetch(request);
  }
  if (!url.pathname.startsWith("/api/lab/")) return env.ASSETS.fetch(request);

  const route = LAB_ROUTES.get(url.pathname);
  if (!route) return json(404, { ok: false, error: "not_found" });
  if (request.method !== route.method) return json(405, { ok: false, error: "method_not_allowed" });
  const body = request.method === "POST" ? await request.arrayBuffer() : undefined;
  const requestId = route.target === "/decision" ? requestIdFromBody(body) : null;
  if (!env.LAB_BROKER_URL || !env.LAB_BROKER_SECRET) {
    return route.target === "/decision"
      ? decisionError(503, "lab_broker_not_configured", requestId)
      : json(503, { ok: false, error: "lab_broker_not_configured" });
  }
  const target = new URL(route.target, `${String(env.LAB_BROKER_URL).replace(/\/+$/, "")}/`);
  const headers = new Headers({ "x-bomba-lab-secret": env.LAB_BROKER_SECRET });
  const contentType = request.headers.get("Content-Type");
  if (contentType) headers.set("Content-Type", contentType);
  let response;
  try {
    response = await fetchImpl(new Request(target, {
      method: request.method,
      headers,
      body,
      redirect: "manual",
    }));
  } catch {
    return route.target === "/decision"
      ? decisionError(502, "lab_broker_unavailable", requestId)
      : json(502, { ok: false, error: "lab_broker_unavailable" });
  }
  const responseHeaders = new Headers({
    "Content-Type": response.headers.get("Content-Type") || "application/json",
    "Cache-Control": "no-store",
  });
  const retryAfter = response.headers.get("Retry-After");
  if (retryAfter) responseHeaders.set("Retry-After", retryAfter);
  return new Response(response.body, { status: response.status, headers: responseHeaders });
}

export default {
  fetch(request, env) {
    return handleRequest(request, env);
  },
};

export { createServerGameAssets };

export class OnlineMatchmakingRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.queue = new DuelMatchQueue();
    this.connections = new Map();
  }

  async fetch(request) {
    if (!isWebSocketUpgrade(request)) return json(426, { ok: false, error: "websocket_required" });
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.acceptSocket(server, request.cf ?? {});
    return new Response(null, { status: 101, webSocket: client });
  }

  connectFakeSocket(socket, location = {}) {
    return this.acceptSocket(socket, location);
  }

  acceptSocket(socket, location) {
    const entry = {
      socket,
      connectionId: randomOnlineId(),
      location,
      queued: false,
      matched: false,
      strikes: 0,
    };
    this.connections.set(socket, entry);
    socket.accept?.();
    socket.addEventListener?.("message", (event) => {
      void this.handleSocketMessage(socket, event.data);
    });
    socket.addEventListener?.("close", () => this.handleSocketClose(socket));
    socket.addEventListener?.("error", () => this.handleSocketClose(socket));
    return entry;
  }

  async handleSocketMessage(socket, data) {
    const entry = this.connections.get(socket);
    if (!entry || entry.matched) return;
    const decoded = decodeClientControlMessage(data);
    if (!decoded.ok) {
      this.protocolStrike(entry, decoded.code);
      return;
    }
    if (decoded.message.type === "queue.leave") {
      this.queue.remove(entry.connectionId);
      entry.queued = false;
      return;
    }
    if (decoded.message.type !== "queue.join") {
      this.protocolStrike(entry, "invalid-message");
      return;
    }
    if (entry.queued) {
      this.sendControl(socket, { type: "error", code: "already-queued", retryable: false });
      return;
    }

    const result = this.queue.enqueue({
      connectionId: entry.connectionId,
      clientNonce: decoded.message.clientNonce,
      characterId: decoded.message.characterId,
      joinedAtMs: Date.now(),
      region: placementFromRequestLocation(entry.location),
    });
    if (!result.ok) {
      this.sendControl(socket, { type: "error", code: result.code, retryable: false });
      return;
    }
    entry.queued = result.pair === null;
    if (!result.pair) {
      this.sendControl(socket, { type: "queue.status", state: "waiting", queuedAtMs: Date.now() });
      return;
    }
    await this.issueMatch(result.pair);
  }

  handleSocketClose(socket) {
    const entry = this.connections.get(socket);
    if (!entry) return;
    this.queue.remove(entry.connectionId);
    this.connections.delete(socket);
  }

  async issueMatch(pair) {
    if (!hasValidOnlineTicketSecret(this.env)) {
      for (const candidate of Object.values(pair.seats)) {
        const entry = this.findConnection(candidate.connectionId);
        if (entry) this.sendControl(entry.socket, { type: "error", code: "queue-unavailable", retryable: true });
      }
      return;
    }
    const matchId = randomOnlineId();
    const simulationSeed = randomOnlineId();
    const issuedAtMs = Date.now();
    for (const seat of [1, 2]) {
      const candidate = pair.seats[seat];
      const peer = pair.seats[seat === 1 ? 2 : 1];
      const entry = this.findConnection(candidate.connectionId);
      if (!entry) continue;
      const payload = createMatchTicketPayload({
        matchId,
        simulationSeed,
        sessionId: randomOnlineId(),
        seat,
        characterId: candidate.characterId,
        peerCharacterId: peer.characterId,
        placement: pair.placement,
        issuedAtMs,
        nonce: randomOnlineId(),
      });
      const ticket = await signMatchTicket(payload, this.env.ONLINE_TICKET_SECRET);
      entry.queued = false;
      entry.matched = true;
      this.sendControl(entry.socket, {
        type: "match.found",
        matchId,
        ticket,
        placement: pair.placement,
        connectPath: `/api/online/matches/${matchId}`,
      });
    }
  }

  findConnection(connectionId) {
    return [...this.connections.values()].find((entry) => entry.connectionId === connectionId) ?? null;
  }

  protocolStrike(entry, code) {
    entry.strikes += 1;
    this.sendControl(entry.socket, { type: "error", code, retryable: false });
    if (entry.strikes >= MAX_PROTOCOL_STRIKES) entry.socket.close?.(1008, "protocol_violation");
  }

  sendControl(socket, message) {
    try {
      socket.send(encodeServerControlMessage(message));
    } catch {
      this.handleSocketClose(socket);
    }
  }
}

export class OnlineMatchRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.matchId = null;
    this.sessions = new Map();
    this.socketSessions = new Map();
    this.runtime = null;
    this.kernel = null;
    this.codec = new OnlineSnapshotCodec();
    this.interval = null;
    this.peerJoinTimer = null;
    this.peerJoinDeadlineMs = null;
    this.lastSchedulerAtMs = 0;
    this.roomEnded = false;
  }

  async fetch(request) {
    if (!isWebSocketUpgrade(request)) return json(426, { ok: false, error: "websocket_required" });
    if (this.roomEnded) return json(410, { ok: false, error: "match_ended" });
    const url = new URL(request.url);
    const matchId = ONLINE_MATCH_ROUTE.exec(url.pathname)?.[1];
    if (!matchId) return json(404, { ok: false, error: "match_not_found" });

    const ticket = url.searchParams.get("ticket");
    const sessionId = url.searchParams.get("sessionId");
    const reconnectToken = url.searchParams.get("reconnectToken");
    let attachment;
    if (ticket) {
      const nowMs = Date.now();
      const storedRetry = this.authorizeStoredTicketRetry(ticket, matchId, nowMs);
      if (storedRetry.ok) {
        attachment = storedRetry.attachment;
      } else {
        const verified = await verifyMatchTicket(ticket, this.env.ONLINE_TICKET_SECRET ?? "", nowMs);
        const authorized = verified.ok
          ? this.authorizeTicket(verified.payload, ticket, matchId, nowMs)
          : { ok: false };
        if (!verified.ok || !authorized.ok) {
          return json(401, { ok: false, error: "invalid_ticket" });
        }
        attachment = authorized.attachment;
      }
    } else {
      const authorized = this.authorizeReconnect(sessionId, reconnectToken, Date.now());
      if (!authorized.ok) {
        return json(401, { ok: false, error: "invalid_reconnect" });
      }
      attachment = authorized.attachment;
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    if (attachment.kind === "ticket") {
      this.attachTicketSocket(server, attachment.payload, attachment.ticketToken, true);
    } else if (attachment.kind === "ticket-retry") {
      this.attachTicketRetrySocket(server, attachment.session, true);
    } else {
      this.attachReconnectSocket(server, attachment.session, attachment.presentedToken, true);
    }
    return new Response(null, { status: 101, webSocket: client });
  }

  async connectFakeSocket(socket, ticket, nowMs = Date.now()) {
    if (this.roomEnded) return { ok: false, code: "invalid-ticket" };
    const storedRetry = this.authorizeStoredTicketRetry(ticket, this.matchId, nowMs);
    if (storedRetry.ok) {
      this.attachTicketRetrySocket(socket, storedRetry.attachment.session, false);
      return { ok: true, payload: storedRetry.attachment.session.payload };
    }
    const verified = await verifyMatchTicket(ticket, this.env.ONLINE_TICKET_SECRET ?? "", nowMs);
    if (!verified.ok) return verified;
    const authorized = this.authorizeTicket(verified.payload, ticket, verified.payload.matchId, nowMs);
    if (!authorized.ok) return { ok: false, code: "invalid-ticket" };
    if (authorized.attachment.kind === "ticket") {
      this.attachTicketSocket(socket, verified.payload, ticket, false);
    } else {
      this.attachTicketRetrySocket(socket, authorized.attachment.session, false);
    }
    return { ok: true, payload: verified.payload };
  }

  connectFakeReconnectSocket(socket, sessionId, reconnectToken, nowMs = Date.now()) {
    const authorized = this.authorizeReconnect(sessionId, reconnectToken, nowMs);
    if (!authorized.ok) return { ok: false, code: "invalid-reconnect" };
    this.attachReconnectSocket(
      socket,
      authorized.attachment.session,
      authorized.attachment.presentedToken,
      false,
    );
    return { ok: true, sessionId };
  }

  authorizeStoredTicketRetry(ticketToken, matchId, nowMs) {
    if (this.roomEnded || this.matchId !== matchId) return { ok: false };
    const session = [...this.sessions.values()]
      .find((candidate) => candidate.ticketToken === ticketToken);
    if (
      !session
      || session.socket
      || session.reconnectDeadlineMs === null
      || nowMs >= session.reconnectDeadlineMs
    ) return { ok: false };
    return { ok: true, attachment: { kind: "ticket-retry", session } };
  }

  authorizeTicket(payload, ticketToken, matchId, nowMs) {
    if (this.roomEnded || payload.matchId !== matchId) return { ok: false };
    const existing = this.sessions.get(payload.seat);
    if (!existing) return { ok: true, attachment: { kind: "ticket", payload, ticketToken } };
    if (
      existing.socket
      || existing.reconnectDeadlineMs === null
      || nowMs >= existing.reconnectDeadlineMs
      || existing.ticketToken !== ticketToken
      || !matchTicketPayloadsEqual(existing.payload, payload)
    ) return { ok: false };
    return { ok: true, attachment: { kind: "ticket-retry", session: existing } };
  }

  authorizeReconnect(sessionId, reconnectToken, nowMs) {
    if (this.roomEnded || !reconnectToken) return { ok: false };
    const session = [...this.sessions.values()]
      .find((candidate) => candidate.payload.sessionId === sessionId);
    if (
      !session
      || session.socket
      || session.reconnectDeadlineMs === null
      || nowMs >= session.reconnectDeadlineMs
      || (reconnectToken !== session.reconnectToken
        && reconnectToken !== session.fallbackReconnectToken)
    ) return { ok: false };
    return {
      ok: true,
      attachment: { kind: "reconnect", session, presentedToken: reconnectToken },
    };
  }

  attachTicketSocket(socket, payload, ticketToken, startLoop) {
    if (this.matchId !== null && this.matchId !== payload.matchId) {
      socket.close?.(1008, "match_id_mismatch");
      return;
    }
    this.matchId = payload.matchId;
    const session = {
      payload,
      ticketToken,
      socket,
      reconnectToken: randomOnlineId(),
      fallbackReconnectToken: null,
      awaitingReadyAck: false,
      reconnectDeadlineMs: null,
      reconnectTimer: null,
      terminalCloseTimer: null,
      awaitingTerminalAck: false,
      lastFrameId: 0,
      forceKeyframe: true,
      strikes: 0,
      startLoop,
    };
    this.sessions.set(payload.seat, session);
    this.bindSocket(session);
    this.sendReady(session);
    this.broadcastPeerStatus();
    this.ensurePeerJoinTimer();
    if (this.hasBothConnectedSeats()) this.startMatch();
  }

  attachTicketRetrySocket(socket, session, startLoop) {
    this.reattachSessionSocket(socket, session, null, startLoop);
  }

  attachReconnectSocket(socket, session, presentedToken, startLoop) {
    this.reattachSessionSocket(socket, session, presentedToken, startLoop);
  }

  reattachSessionSocket(socket, session, fallbackReconnectToken, startLoop) {
    const previous = session.socket;
    if (previous) {
      this.socketSessions.delete(previous);
      previous.close?.(4001, "session_replaced");
    }
    this.clearReconnectTimer(session);
    session.socket = socket;
    session.awaitingReadyAck = false;
    session.fallbackReconnectToken = fallbackReconnectToken;
    session.reconnectToken = randomOnlineId();
    session.reconnectDeadlineMs = null;
    session.lastFrameId = 0;
    session.forceKeyframe = true;
    session.strikes = 0;
    session.startLoop = startLoop;
    this.runtime?.reconnect(this.peerFor(session));
    this.bindSocket(session);
    this.sendReady(session);
    this.broadcastPeerStatus();
    if (!this.runtime && this.hasBothConnectedSeats()) this.startMatch();
    if (this.runtime) {
      this.sendFrame(session);
      this.ensureScheduler();
    }
  }

  hasBothConnectedSeats() {
    return Boolean(this.sessions.get(1)?.socket && this.sessions.get(2)?.socket);
  }

  ensurePeerJoinTimer() {
    if (this.runtime || this.roomEnded || this.peerJoinTimer !== null) return;
    this.peerJoinDeadlineMs ??= Date.now() + PEER_JOIN_TIMEOUT_MS;
    const delayMs = Math.max(0, this.peerJoinDeadlineMs - Date.now());
    this.peerJoinTimer = setTimeout(() => {
      this.peerJoinTimer = null;
      if (this.peerJoinDeadlineMs !== null && Date.now() < this.peerJoinDeadlineMs) {
        this.ensurePeerJoinTimer();
        return;
      }
      if (!this.runtime && !this.roomEnded) this.endRoom("peer-timeout", null);
    }, delayMs);
  }

  clearPeerJoinTimer() {
    if (this.peerJoinTimer !== null) {
      clearTimeout(this.peerJoinTimer);
      this.peerJoinTimer = null;
    }
    this.peerJoinDeadlineMs = null;
  }

  extendPeerJoinDeadline(deadlineMs) {
    if (this.runtime || this.roomEnded) return;
    this.peerJoinDeadlineMs = Math.max(this.peerJoinDeadlineMs ?? 0, deadlineMs);
    if (this.peerJoinTimer !== null) {
      clearTimeout(this.peerJoinTimer);
      this.peerJoinTimer = null;
    }
    this.ensurePeerJoinTimer();
  }

  bindSocket(session) {
    const socket = session.socket;
    this.socketSessions.set(socket, session);
    // Current Workers compatibility dates deliver binary messages as Blob unless opted out.
    socket.binaryType = "arraybuffer";
    socket.accept?.();
    socket.addEventListener?.("message", (event) => this.handleSocketMessage(socket, event.data));
    socket.addEventListener?.("close", () => this.handleSocketClose(socket));
    socket.addEventListener?.("error", () => this.handleSocketClose(socket));
  }

  startMatch() {
    if (this.runtime || this.roomEnded || !this.hasBothConnectedSeats()) return;
    const first = this.sessions.get(1);
    const second = this.sessions.get(2);
    if (!first || !second || !reciprocalTickets(first.payload, second.payload)) {
      for (const session of this.sessions.values()) session.socket?.close?.(1008, "ticket_pair_mismatch");
      return;
    }
    const firstRosterIndex = getServerRosterIndex(first.payload.characterId);
    const secondRosterIndex = getServerRosterIndex(second.payload.characterId);
    if (firstRosterIndex === null || secondRosterIndex === null) {
      for (const session of this.sessions.values()) session.socket?.close?.(1008, "character_not_available");
      return;
    }
    const arenaDefinition = {
      ...createDefaultArenaDefinition(),
      randomSeed: first.payload.simulationSeed,
    };
    const game = new GameApp({}, createServerGameAssets(), arenaDefinition);
    const kernel = new GameAppCharacterizationKernel({
      game,
      seats: {
        1: { characterId: first.payload.characterId, rosterIndex: firstRosterIndex },
        2: { characterId: second.payload.characterId, rosterIndex: secondRosterIndex },
      },
    });
    this.kernel = kernel;
    this.runtime = new AuthoritativeMatchRuntime({
      matchId: this.matchId,
      peers: [this.peerFor(first), this.peerFor(second)],
      kernel,
      codec: this.codec,
    });
    this.clearPeerJoinTimer();
    this.broadcastPeerStatus();
    for (const session of this.sessions.values()) this.sendFrame(session);
    this.ensureScheduler();
  }

  handleSocketMessage(socket, data) {
    const session = this.socketSessions.get(socket);
    if (!session || session.socket !== socket) return;
    if (typeof data === "string") {
      const decoded = decodeClientControlMessage(data);
      if (decoded.ok && decoded.message.type === "match.ended.ack") {
        if (this.roomEnded && session.awaitingTerminalAck) this.closeTerminalSocket(session);
        else this.protocolStrike(session, "invalid-message");
        return;
      }
      if (decoded.ok && decoded.message.type === "match.ready.ack") {
        if (!this.roomEnded && session.awaitingReadyAck) this.confirmReady(session);
        return;
      }
      if (!this.runtime || this.roomEnded) return;
      if (decoded.ok && decoded.message.type === "frame.resync") {
        session.forceKeyframe = true;
        this.sendFrame(session);
        return;
      }
      this.protocolStrike(session, decoded.ok ? "invalid-message" : decoded.code);
      return;
    }
    if (!this.runtime || this.roomEnded) return;
    const bytes = data instanceof Uint8Array
      ? data
      : data instanceof ArrayBuffer
        ? new Uint8Array(data)
        : null;
    if (!bytes) {
      this.protocolStrike(session, "invalid-message");
      return;
    }
    const decoded = decodePlayerCommand(bytes);
    if (!decoded.ok) {
      this.protocolStrike(session, "invalid-message");
      return;
    }
    const acceptance = this.runtime.accept(this.peerFor(session), decoded.command);
    if (!acceptance.ok && acceptance.code !== "rate-limited") {
      this.protocolStrike(session, "invalid-message");
    }
  }

  handleSocketClose(socket) {
    const session = this.socketSessions.get(socket);
    if (!session || session.socket !== socket) return;
    this.socketSessions.delete(socket);
    session.socket = null;
    session.awaitingReadyAck = false;
    if (this.roomEnded) {
      this.clearTerminalCloseTimer(session);
      session.awaitingTerminalAck = false;
      return;
    }
    session.reconnectDeadlineMs = Date.now() + RECONNECT_WINDOW_MS;
    if (!this.runtime) this.extendPeerJoinDeadline(session.reconnectDeadlineMs);
    this.runtime?.disconnect(this.peerFor(session));
    this.broadcastPeerStatus();
    this.scheduleReconnectExpiry(session);
  }

  scheduleReconnectExpiry(session) {
    this.clearReconnectTimer(session);
    if (session.reconnectDeadlineMs === null || this.roomEnded) return;
    const delayMs = Math.max(0, session.reconnectDeadlineMs - Date.now());
    session.reconnectTimer = setTimeout(() => {
      session.reconnectTimer = null;
      if (session.socket || session.reconnectDeadlineMs === null || this.roomEnded) return;
      if (Date.now() < session.reconnectDeadlineMs) {
        this.scheduleReconnectExpiry(session);
        return;
      }
      session.reconnectDeadlineMs = null;
      if (!this.runtime) {
        this.endRoom("peer-timeout", null);
        return;
      }
      this.broadcastControl({
        type: "peer.status",
        seat: session.payload.seat,
        state: "forfeited",
        deadlineMs: null,
      });
      const winnerSeat = session.payload.seat === 1 ? 2 : 1;
      this.endRoom("forfeit", winnerSeat);
    }, delayMs);
  }

  clearReconnectTimer(session) {
    if (session.reconnectTimer === null) return;
    clearTimeout(session.reconnectTimer);
    session.reconnectTimer = null;
  }

  broadcastTick(elapsedMs = MATCH_SCHEDULER_INTERVAL_MS) {
    if (!this.runtime || this.roomEnded) return;
    const advance = this.runtime.advance(elapsedMs);
    for (const session of this.sessions.values()) {
      if (session.socket) this.sendFrame(session);
    }
    if (this.runtime.ended) {
      const winner = this.kernel?.capture().matchWinner;
      this.endRoom("completed", winner === 1 || winner === 2 ? winner : null);
      return;
    }
    if (advance.overloaded) {
      this.endRoom("server-overload", null);
      return;
    }
  }

  endRoom(reason, winnerSeat) {
    if (this.roomEnded) return;
    this.roomEnded = true;
    this.stopScheduler();
    this.clearPeerJoinTimer();
    for (const session of this.sessions.values()) {
      this.clearReconnectTimer(session);
      session.awaitingReadyAck = false;
      if (!session.socket) continue;
      session.awaitingTerminalAck = true;
      const sent = this.sendControl(session, { type: "match.ended", reason, winnerSeat });
      if (!sent || !session.socket) continue;
      session.terminalCloseTimer = setTimeout(() => {
        session.terminalCloseTimer = null;
        if (session.awaitingTerminalAck) this.closeTerminalSocket(session);
      }, TERMINAL_ACK_TIMEOUT_MS);
    }
  }

  closeTerminalSocket(session) {
    this.clearTerminalCloseTimer(session);
    session.awaitingTerminalAck = false;
    const socket = session.socket;
    if (!socket) return;
    this.socketSessions.delete(socket);
    session.socket = null;
    socket.close?.(1000, "match_ended");
  }

  clearTerminalCloseTimer(session) {
    if (session.terminalCloseTimer === null) return;
    clearTimeout(session.terminalCloseTimer);
    session.terminalCloseTimer = null;
  }

  ensureScheduler() {
    if (
      this.roomEnded
      || this.interval !== null
      || ![...this.sessions.values()].some((session) => session.startLoop)
    ) return;
    this.lastSchedulerAtMs = Date.now();
    this.interval = setInterval(() => {
      const now = Date.now();
      const elapsed = Math.max(0, now - this.lastSchedulerAtMs);
      this.lastSchedulerAtMs = now;
      this.broadcastTick(elapsed);
    }, MATCH_SCHEDULER_INTERVAL_MS);
  }

  stopScheduler() {
    if (this.interval === null) return;
    clearInterval(this.interval);
    this.interval = null;
  }

  sendFrame(session) {
    if (!this.runtime || !session.socket) return;
    const packet = this.runtime.readFrame(this.peerFor(session), {
      lastFrameId: session.lastFrameId,
      forceKeyframe: session.forceKeyframe,
    });
    if (!packet) return;
    try {
      session.socket.send(packet);
      const decoded = decodeServerFrameEnvelope(packet);
      if (decoded.ok) session.lastFrameId = decoded.frame.frameId;
      session.forceKeyframe = false;
    } catch {
      this.handleSocketClose(session.socket);
    }
  }

  sendReady(session) {
    session.awaitingReadyAck = this.sendControl(session, {
      type: "match.ready",
      matchId: this.matchId,
      sessionId: session.payload.sessionId,
      seat: session.payload.seat,
      reconnectToken: session.reconnectToken,
    });
  }

  confirmReady(session) {
    session.awaitingReadyAck = false;
    session.ticketToken = null;
    session.fallbackReconnectToken = null;
  }

  broadcastPeerStatus() {
    for (const observed of this.sessions.values()) {
      this.broadcastControl({
        type: "peer.status",
        seat: observed.payload.seat,
        state: observed.socket ? "connected" : "reconnecting",
        deadlineMs: observed.reconnectDeadlineMs,
      });
    }
    for (const seat of [1, 2]) {
      if (!this.sessions.has(seat)) {
        this.broadcastControl({ type: "peer.status", seat, state: "connecting", deadlineMs: null });
      }
    }
  }

  broadcastControl(message) {
    for (const session of this.sessions.values()) this.sendControl(session, message);
  }

  sendControl(session, message) {
    if (!session.socket) return false;
    try {
      session.socket.send(encodeServerControlMessage(message));
      return true;
    } catch {
      this.handleSocketClose(session.socket);
      return false;
    }
  }

  protocolStrike(session, code) {
    session.strikes += 1;
    this.sendControl(session, { type: "error", code, retryable: false });
    if (session.strikes >= MAX_PROTOCOL_STRIKES) session.socket?.close?.(1008, "protocol_violation");
  }

  peerFor(session) {
    return {
      sessionId: session.payload.sessionId,
      seat: session.payload.seat,
      characterId: session.payload.characterId,
    };
  }
}

function reciprocalTickets(first, second) {
  return first.matchId === second.matchId
    && first.simulationSeed === second.simulationSeed
    && first.placement === second.placement
    && first.seat === 1
    && second.seat === 2
    && first.characterId === second.peerCharacterId
    && second.characterId === first.peerCharacterId;
}

function normalizePlacement(value) {
  return ["wnam", "enam", "sam", "weur", "eeur", "apac", "oc", "afr", "me"].includes(value)
    ? value
    : "enam";
}
