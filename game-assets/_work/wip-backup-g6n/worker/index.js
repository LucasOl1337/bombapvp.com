import { GameApp } from "../src/original-game/Engine/game-app.ts";
import { createDefaultArenaDefinition } from "../src/original-game/Arenas/arena.ts";
import { getArenaThemeById } from "../src/original-game/Arenas/arena-theme-library.ts";
import { createOfflineBotMatchSetup } from "../src/original-game/Engine/bot-registry.ts";
import { CHAMPION_DEFINITION as RANNI } from "../Champions/ranni/definition.ts";
import { CHAMPION_DEFINITION as BEE } from "../Champions/killer-bee/definition.ts";
import { CHAMPION_DEFINITION as CROCODILO } from "../Champions/crocodilo-arcano/definition.ts";
import { CHAMPION_DEFINITION as NICO } from "../Champions/nico/definition.ts";
import { CHAMPION_DEFINITION as NIX } from "../Champions/nix-ember/definition.ts";
import { CHAMPION_DEFINITION as PENDULA } from "../Champions/pendula/definition.ts";
import { CHAMPION_DEFINITION as MIRELLE } from "../Champions/mirelle/definition.ts";

const LAB_ROUTES = new Map([
  ["/api/lab/health", { method: "GET", target: "/health" }],
  ["/api/lab/models", { method: "GET", target: "/models" }],
  ["/api/lab/decision", { method: "POST", target: "/decision" }],
]);
const ONLINE_IDS = [1, 2, 3, 4];
const ONLINE_ROOM = "endless-pvp";
const CHARACTERS = [RANNI, BEE, CROCODILO, NICO, NIX, PENDULA, MIRELLE]
  .sort((a, b) => a.roster.order - b.roster.order);

function emptySprites() {
  const frames = () => ({ up: [], down: [], left: [], right: [] });
  return { up: null, down: null, left: null, right: null, idle: frames(), walk: frames(), run: frames(), cast: frames(), attack: frames(), death: frames() };
}

export function createServerGameAssets() {
  const sprites = emptySprites();
  const arenaTheme = getArenaThemeById("tournament-clean");
  if (!arenaTheme) throw new Error("server_arena_theme_missing");
  return {
    players: { 1: sprites, 2: sprites, 3: sprites, 4: sprites },
    characterRoster: CHARACTERS.map((character, selectionIndex) => ({
      id: character.id, name: character.name, size: null, selectionIndex,
      order: character.roster.order, sprites,
      ...(character.roster.defaultSlot === undefined ? {} : { defaultSlot: character.roster.defaultSlot }),
    })),
    characterSpriteLoader: async () => sprites,
    arenaTheme,
    floor: { base: null, lane: null, spawn: null },
    props: { wall: null, crate: null, bomb: null, flame: null, crateBreakFrames: [] },
    effects: { speedSparkTrail: null },
    ui: { victoryEmblem: null, stalemateEmblem: null },
    hud: { panelLocal: null, panelRival: null, panelCenter: null, chipUlt: null, iconBomb: null, iconFlame: null, iconSpeed: null },
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
  if (url.pathname === "/api/online") {
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") return json(426, { ok: false, error: "websocket_required" });
    if (!env.ONLINE_MATCHMAKING_ROOM) return json(503, { ok: false, error: "online_room_not_configured" });
    const id = env.ONLINE_MATCHMAKING_ROOM.idFromName(ONLINE_ROOM);
    return env.ONLINE_MATCHMAKING_ROOM.get(id).fetch(request);
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
    this.acked = { 1: 0, 2: 0, 3: 0, 4: 0 };
    this.serverTimeMs = 0;
    this.serverTick = 0;
    this.timer = null;
    const setup = createOfflineBotMatchSetup({ mode: "continuous", bot: null });
    this.botPolicies = { ...setup.options.botDecisionPolicies };
    this.botCharacters = { 1: 0, 2: 1, 3: 2, 4: 3, ...setup.options.botCharacterSelections };
    this.botLabels = { 1: "BOT", 2: "BOT", 3: "BOT", 4: "BOT", ...setup.options.playerLabels };
    this.game = new GameApp({ append: () => undefined }, createServerGameAssets(), createDefaultArenaDefinition());
    this.game.startServerAuthoritativeMatch(ONLINE_IDS, this.botCharacters, {
      roomMode: "endless", botPlayerIds: ONLINE_IDS, botDecisionPolicies: this.botPolicies,
      playerLabels: this.botLabels, showWorldPlayerLabels: true, hideNativeHud: true,
    });
  }

  async fetch(request) {
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") return json(426, { ok: false, error: "websocket_required" });
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.acceptSocket(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  connectFakeSocket(socket) { return this.acceptSocket(socket); }

  acceptSocket(socket) {
    socket.accept?.();
    const occupied = new Set([...this.sockets.values()].map((entry) => entry.seat));
    const seat = ONLINE_IDS.find((id) => !occupied.has(id)) ?? null;
    if (seat === null) {
      this.send(socket, { type: "error", message: "room_full" });
      socket.close?.(1013, "room_full");
      return null;
    }
    const entry = { socket, seat, characterSelection: seat - 1 };
    this.sockets.set(socket, entry);
    this.game.takeoverServerBotSeat(seat, { playerLabel: `P${seat}`, characterSelection: entry.characterSelection });
    socket.addEventListener("message", (event) => this.onMessage(socket, event.data));
    socket.addEventListener("close", () => this.onClose(socket));
    socket.addEventListener("error", () => this.onClose(socket));
    this.broadcastStarted();
    this.sendSnapshot(socket);
    if (this.timer === null) this.timer = setInterval(() => this.tick(), 50);
    return entry;
  }

  onMessage(socket, data) {
    const entry = this.sockets.get(socket);
    if (!entry) return;
    let message;
    try { message = JSON.parse(typeof data === "string" ? data : new TextDecoder().decode(data)); }
    catch { return this.send(socket, { type: "error", message: "invalid_json" }); }
    if (message?.type === "endless-match") {
      const value = Number.isInteger(message.characterIndex) ? message.characterIndex : 0;
      entry.characterSelection = ((value % CHARACTERS.length) + CHARACTERS.length) % CHARACTERS.length;
      this.game.setServerCharacterSelection(entry.seat, entry.characterSelection);
      return this.broadcastStarted();
    }
    if (message?.type !== "guest-input" || !message.input || !Number.isInteger(message.inputSeq)) return;
    this.acked[entry.seat] = Math.max(this.acked[entry.seat], message.inputSeq);
    this.game.setServerPlayerInput(entry.seat, {
      direction: ["up", "down", "left", "right"].includes(message.input.direction) ? message.input.direction : null,
      bombPressed: Boolean(message.input.bombPressed), detonatePressed: Boolean(message.input.detonatePressed),
      skillPressed: Boolean(message.input.skillPressed), skillHeld: Boolean(message.input.skillHeld),
    });
  }

  onClose(socket) {
    const entry = this.sockets.get(socket);
    if (!entry) return;
    this.sockets.delete(socket);
    this.game.releaseServerSeatToBot(entry.seat, {
      playerLabel: this.botLabels[entry.seat] ?? "BOT",
      characterSelection: this.botCharacters[entry.seat] ?? entry.seat - 1,
      botDecisionPolicy: this.botPolicies[entry.seat],
    });
    this.acked[entry.seat] = 0;
    this.broadcastStarted();
    if (this.sockets.size === 0 && this.timer !== null) { clearInterval(this.timer); this.timer = null; }
  }

  handleSocketClose(socket) { this.onClose(socket); }

  humans() { return new Set([...this.sockets.values()].map((entry) => entry.seat)); }
  botIds() { const humans = this.humans(); return ONLINE_IDS.filter((id) => !humans.has(id)); }
  selections() {
    return Object.fromEntries(ONLINE_IDS.map((id) => {
      const human = [...this.sockets.values()].find((entry) => entry.seat === id);
      return [id, human?.characterSelection ?? this.botCharacters[id] ?? id - 1];
    }));
  }
  config(seat) {
    const botPlayerIds = this.botIds();
    return {
      roomCode: ONLINE_ROOM, role: "guest", roomMode: "endless",
      arena: this.game.exportOnlineSnapshot().arena, localPlayerId: seat,
      activePlayerIds: [...ONLINE_IDS], botPlayerIds, characterSelections: this.selections(),
      playerLabels: Object.fromEntries(ONLINE_IDS.map((id) => [id, botPlayerIds.includes(id) ? this.botLabels[id] : `P${id}`])),
    };
  }
  broadcastStarted() { for (const entry of this.sockets.values()) this.send(entry.socket, { type: "match-started", config: this.config(entry.seat) }); }
  tick(deltaMs = 50) {
    this.game.advanceServerSimulation(deltaMs);
    this.serverTimeMs += deltaMs;
    this.serverTick += 1;
    for (const socket of this.sockets.keys()) this.sendSnapshot(socket);
  }
  broadcastSnapshotTick(deltaMs = 50) { this.tick(deltaMs); }
  snapshot() {
    return { ...this.game.exportOnlineSnapshot(), serverTimeMs: this.serverTimeMs, serverTick: this.serverTick,
      frameId: this.serverTick, ackedInputSeq: { ...this.acked }, paused: false, roomMode: "endless",
      activePlayerIds: [...ONLINE_IDS], botPlayerIds: this.botIds() };
  }
  sendSnapshot(socket) { this.send(socket, { type: "host-snapshot", snapshot: this.snapshot() }); }
  send(socket, message) { try { socket.send(JSON.stringify(message)); } catch { this.onClose(socket); } }
}
