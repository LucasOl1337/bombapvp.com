import { GameApp } from "../src/original-game/Engine/game-app.ts";
import { createDefaultArenaDefinition } from "../src/original-game/Arenas/arena.ts";
import { getArenaThemeById } from "../src/original-game/Arenas/arena-theme-library.ts";
import { createOfflineBotMatchSetup } from "../src/original-game/Engine/bot-registry.ts";

const LAB_ROUTES = new Map([
  ["/api/lab/health", { method: "GET", target: "/health" }],
  ["/api/lab/models", { method: "GET", target: "/models" }],
  ["/api/lab/decision", { method: "POST", target: "/decision" }],
]);

const ONLINE_ROOM_NAME = "endless-pvp";
const ONLINE_ROUTE = "/api/online";
const ONLINE_PLAYER_IDS = [1, 2, 3, 4];
const ONLINE_SNAPSHOT_INTERVAL_MS = 50;

function emptyFrameSet() {
  return { up: [], down: [], left: [], right: [] };
}

function emptyDirectionalSprites() {
  return {
    up: null,
    down: null,
    left: null,
    right: null,
    idle: emptyFrameSet(),
    walk: emptyFrameSet(),
    run: emptyFrameSet(),
    cast: emptyFrameSet(),
    attack: emptyFrameSet(),
    death: emptyFrameSet(),
  };
}

export function createServerGameAssets() {
  const sprites = emptyDirectionalSprites();
  const theme = getArenaThemeById("tournament-clean");
  if (!theme) throw new Error("server_arena_theme_missing");
  return {
    players: { 1: sprites, 2: sprites, 3: sprites, 4: sprites },
    characterRoster: ONLINE_PLAYER_IDS.map((playerId) => ({
      id: `server-seat-${playerId}`,
      name: `Seat ${playerId}`,
      size: null,
      selectionIndex: playerId - 1,
      defaultSlot: playerId,
      sprites,
    })),
    characterSpriteLoader: async () => sprites,
    arenaTheme: theme,
    floor: { base: null, lane: null, spawn: null },
    props: { wall: null, crate: null, bomb: null, flame: null, crateBreakFrames: [] },
    effects: { speedSparkTrail: null },
    ui: { victoryEmblem: null, stalemateEmblem: null },
    hud: {
      panelLocal: null,
      panelRival: null,
      panelCenter: null,
      chipUlt: null,
      iconBomb: null,
      iconFlame: null,
      iconSpeed: null,
    },
    powerUps: {},
  };
}

function json(status, body) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
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
  if (url.pathname === ONLINE_ROUTE) {
    if (request.headers.get("Upgrade") !== "websocket") {
      return json(426, { ok: false, error: "websocket_required" });
    }
    const room = env.ONLINE_MATCHMAKING_ROOM;
    if (!room) return json(503, { ok: false, error: "online_room_not_configured" });
    const id = room.idFromName(ONLINE_ROOM_NAME);
    return room.get(id).fetch(request);
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

export class OnlineMatchmakingRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sockets = new Map();
    this.nextClientOrdinal = 1;
    this.serverTimeMs = 0;
    this.serverTick = 0;
    this.frameId = 0;
    this.ackedInputSeq = { 1: 0, 2: 0, 3: 0, 4: 0 };
    this.interval = null;
    this.game = null;
    this.botDecisionPolicies = {};
    this.botCharacterSelections = { 1: 0, 2: 1, 3: 2, 4: 3 };
    this.botPlayerLabels = { 1: "BOT", 2: "BOT", 3: "BOT", 4: "BOT" };
    this.startGame();
  }

  async fetch(request) {
    if (request.headers.get("Upgrade") !== "websocket") {
      return json(426, { ok: false, error: "websocket_required" });
    }
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.acceptSocket(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  connectFakeSocket(socket) {
    return this.acceptSocket(socket);
  }

  startGame() {
    if (this.game) return;
    const setup = createOfflineBotMatchSetup({ mode: "continuous", bot: null });
    this.botDecisionPolicies = { ...setup.options.botDecisionPolicies };
    this.botCharacterSelections = { 1: 0, 2: 1, 3: 2, 4: 3, ...setup.options.botCharacterSelections };
    this.botPlayerLabels = { 1: "BOT", 2: "BOT", 3: "BOT", 4: "BOT", ...setup.options.playerLabels };
    const characterSelections = { 1: 0, 2: 1, 3: 2, 4: 3, ...setup.options.botCharacterSelections };
    const botIds = [1, 2, 3, 4];
    this.game = new GameApp({ append: () => undefined }, createServerGameAssets(), createDefaultArenaDefinition());
    this.game.startServerAuthoritativeMatch(ONLINE_PLAYER_IDS, characterSelections, {
      roomMode: "endless",
      botPlayerIds: botIds,
      botDecisionPolicies: this.botDecisionPolicies,
      playerLabels: this.botPlayerLabels,
      showWorldPlayerLabels: true,
      hideNativeHud: true,
    });
  }

  acceptSocket(socket) {
    this.startGame();
    const seat = this.claimFreeSeat();
    if (seat === null) {
      if (typeof socket.accept === "function") socket.accept();
      this.send(socket, { type: "error", message: "room_full" });
      if (typeof socket.close === "function") socket.close(1013, "room_full");
      return null;
    }
    const clientId = `online-${this.nextClientOrdinal++}`;
    const entry = { socket, seat, clientId };
    this.sockets.set(socket, entry);
    if (typeof socket.accept === "function") socket.accept();
    this.game.takeoverServerBotSeat(seat, { playerLabel: `P${seat}`, characterSelection: seat - 1 });
    socket.addEventListener("message", (event) => this.handleSocketMessage(socket, event.data));
    socket.addEventListener("close", () => this.handleSocketClose(socket));
    socket.addEventListener("error", () => this.handleSocketClose(socket));
    this.ensureBroadcastLoop();
    this.broadcastMatchStarted();
    this.sendSnapshot(socket);
    return entry;
  }

  claimFreeSeat() {
    const occupied = new Set([...this.sockets.values()].map((entry) => entry.seat));
    return ONLINE_PLAYER_IDS.find((playerId) => !occupied.has(playerId)) ?? null;
  }

  handleSocketMessage(socket, data) {
    const entry = this.sockets.get(socket);
    if (!entry) return;
    let message;
    try {
      message = JSON.parse(typeof data === "string" ? data : new TextDecoder().decode(data));
    } catch {
      this.send(socket, { type: "error", message: "invalid_json" });
      return;
    }
    if (message?.type !== "guest-input" || !message.input || typeof message.inputSeq !== "number") return;
    this.ackedInputSeq[entry.seat] = Math.max(this.ackedInputSeq[entry.seat] ?? 0, message.inputSeq);
    this.game.replaceServerPlayerInput(entry.seat, {
      direction: message.input.direction ?? null,
      bombPressed: Boolean(message.input.bombPressed),
      detonatePressed: Boolean(message.input.detonatePressed),
      skillPressed: Boolean(message.input.skillPressed),
      skillHeld: Boolean(message.input.skillHeld),
    });
  }

  handleSocketClose(socket) {
    const entry = this.sockets.get(socket);
    if (!entry) return;
    this.sockets.delete(socket);
    this.game.releaseServerSeatToBot(entry.seat, {
      playerLabel: this.botPlayerLabels[entry.seat] ?? "BOT",
      characterSelection: this.botCharacterSelections[entry.seat] ?? entry.seat - 1,
      botDecisionPolicy: this.botDecisionPolicies[entry.seat],
    });
    this.ackedInputSeq[entry.seat] = 0;
    this.broadcastMatchStarted();
    if (this.sockets.size === 0 && this.interval !== null) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  ensureBroadcastLoop() {
    if (this.interval !== null) return;
    this.interval = setInterval(() => this.broadcastSnapshotTick(ONLINE_SNAPSHOT_INTERVAL_MS), ONLINE_SNAPSHOT_INTERVAL_MS);
  }

  broadcastSnapshotTick(deltaMs = ONLINE_SNAPSHOT_INTERVAL_MS) {
    this.game.advanceServerSimulation(deltaMs);
    this.serverTimeMs += deltaMs;
    this.serverTick += 1;
    this.frameId += 1;
    for (const socket of this.sockets.keys()) this.sendSnapshot(socket);
  }

  buildMatchConfig(seat) {
    const botPlayerIds = ONLINE_PLAYER_IDS.filter((playerId) => ![...this.sockets.values()].some((entry) => entry.seat === playerId));
    return {
      roomCode: ONLINE_ROOM_NAME,
      role: "guest",
      roomMode: "endless",
      arena: this.game.exportOnlineSnapshot().arena,
      localPlayerId: seat,
      activePlayerIds: [...ONLINE_PLAYER_IDS],
      botPlayerIds,
      characterSelections: { 1: 0, 2: 1, 3: 2, 4: 3 },
      playerLabels: Object.fromEntries(ONLINE_PLAYER_IDS.map((playerId) => [playerId, botPlayerIds.includes(playerId) ? "BOT" : `P${playerId}`])),
    };
  }

  sessionState() {
    return { kind: "in-endless-match", intent: "queue_endless", roomCode: ONLINE_ROOM_NAME, roomMode: "endless", roomKind: "endless" };
  }

  broadcastMatchStarted() {
    for (const entry of this.sockets.values()) {
      this.send(entry.socket, { type: "match-started", config: this.buildMatchConfig(entry.seat), sessionState: this.sessionState() });
    }
  }

  stampedSnapshot() {
    const snapshot = this.game.exportOnlineSnapshot();
    return {
      ...snapshot,
      serverTimeMs: this.serverTimeMs,
      serverTick: this.serverTick,
      frameId: this.frameId,
      ackedInputSeq: { ...this.ackedInputSeq },
      paused: false,
      roomMode: "endless",
      activePlayerIds: [...ONLINE_PLAYER_IDS],
      botPlayerIds: ONLINE_PLAYER_IDS.filter((playerId) => ![...this.sockets.values()].some((entry) => entry.seat === playerId)),
    };
  }

  sendSnapshot(socket) {
    this.send(socket, { type: "host-snapshot", snapshot: this.stampedSnapshot() });
  }

  send(socket, message) {
    try {
      socket.send(JSON.stringify(message));
    } catch {
      this.handleSocketClose(socket);
    }
  }
}
