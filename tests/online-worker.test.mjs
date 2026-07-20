// @vitest-environment node

import { describe, expect, it, vi } from "vitest";
import { CHAMPION_MEMBERSHIP } from "../Champions/membership.ts";
import { ONLINE_CONTENT_REVISION } from "../src/online/content-revision.ts";
import { ONLINE_MODE_ID, ONLINE_PROTOCOL_VERSION } from "../src/online/protocol/contracts.ts";
import {
  decodeServerFrameEnvelope,
  encodeServerFrameEnvelope,
} from "../src/online/protocol/frame-envelope.ts";
import { encodePlayerCommand } from "../src/online/protocol/input-codec.ts";
import { OnlineSnapshotCodec } from "../src/online/protocol/snapshot-codec.ts";
import {
  createMatchTicketPayload,
  randomOnlineId,
  signMatchTicket,
  verifyMatchTicket,
} from "../src/online/session/match-ticket.ts";
import {
  createServerGameAssets,
  handleRequest,
  OnlineMatchmakingRoom,
  OnlineMatchRoom,
} from "../worker/index.js";

const SECRET = "worker-test-secret-that-is-at-least-32-bytes";

function createFakeSocket() {
  const listeners = new Map();
  return {
    sent: [],
    events: [],
    accepted: false,
    binaryType: "blob",
    acceptedWithBinaryType: null,
    closes: [],
    failNextSends: 0,
    accept() {
      this.acceptedWithBinaryType = this.binaryType;
      this.accepted = true;
    },
    send(message) {
      if (this.failNextSends > 0) {
        this.failNextSends -= 1;
        throw new Error("simulated_send_failure");
      }
      this.sent.push(message);
      this.events.push({ type: "send", message });
    },
    close(code, reason) {
      this.closes.push({ code, reason });
      this.events.push({ type: "close", code, reason });
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

function acknowledgeTerminal(socket) {
  socket.emit("message", JSON.stringify({ type: "match.ended.ack" }));
}

function acknowledgeReady(socket) {
  socket.emit("message", JSON.stringify({ type: "match.ready.ack" }));
}

function endedControls(socket, reason) {
  return controls(socket).filter((message) => (
    message.type === "match.ended" && (!reason || message.reason === reason)
  ));
}

function controls(socket) {
  return socket.sent
    .filter((message) => typeof message === "string")
    .map((message) => JSON.parse(message));
}

function binaryFrames(socket) {
  return socket.sent.filter((message) => message instanceof Uint8Array);
}

function queueJoin(characterId, clientNonce) {
  return JSON.stringify({
    type: "queue.join",
    protocolVersion: ONLINE_PROTOCOL_VERSION,
    modeId: ONLINE_MODE_ID,
    contentRevision: ONLINE_CONTENT_REVISION,
    characterId,
    clientNonce,
  });
}

async function createReciprocalTickets(nowMs = Date.now()) {
  const matchId = randomOnlineId();
  const simulationSeed = randomOnlineId();
  const first = createMatchTicketPayload({
    matchId,
    simulationSeed,
    sessionId: randomOnlineId(),
    seat: 1,
    characterId: CHAMPION_MEMBERSHIP.ranni.characterId,
    peerCharacterId: CHAMPION_MEMBERSHIP["killer-bee"].characterId,
    placement: "sam",
    issuedAtMs: nowMs,
    nonce: randomOnlineId(),
  });
  const second = createMatchTicketPayload({
    matchId,
    simulationSeed,
    sessionId: randomOnlineId(),
    seat: 2,
    characterId: CHAMPION_MEMBERSHIP["killer-bee"].characterId,
    peerCharacterId: CHAMPION_MEMBERSHIP.ranni.characterId,
    placement: "sam",
    issuedAtMs: nowMs,
    nonce: randomOnlineId(),
  });
  return {
    matchId,
    first,
    second,
    firstToken: await signMatchTicket(first, SECRET),
    secondToken: await signMatchTicket(second, SECRET),
  };
}

async function issueTicketsFromQueue() {
  const queueRoom = new OnlineMatchmakingRoom({}, { ONLINE_TICKET_SECRET: SECRET });
  const firstQueueSocket = createFakeSocket();
  const secondQueueSocket = createFakeSocket();
  queueRoom.connectFakeSocket(firstQueueSocket, { continent: "SA", country: "BR" });
  queueRoom.connectFakeSocket(secondQueueSocket, { continent: "SA", country: "AR" });
  await queueRoom.handleSocketMessage(
    firstQueueSocket,
    queueJoin(CHAMPION_MEMBERSHIP.ranni.characterId, "vertical-first-01"),
  );
  await queueRoom.handleSocketMessage(
    secondQueueSocket,
    queueJoin(CHAMPION_MEMBERSHIP["killer-bee"].characterId, "vertical-second-1"),
  );
  return {
    firstQueueSocket,
    secondQueueSocket,
    firstFound: controls(firstQueueSocket).find((message) => message.type === "match.found"),
    secondFound: controls(secondQueueSocket).find((message) => message.type === "match.found"),
  };
}

async function createStartedMatchRoom(nowMs = Date.now()) {
  const tickets = await createReciprocalTickets(nowMs);
  const room = new OnlineMatchRoom({}, { ONLINE_TICKET_SECRET: SECRET });
  const first = createFakeSocket();
  const second = createFakeSocket();
  expect((await room.connectFakeSocket(first, tickets.firstToken, nowMs)).ok).toBe(true);
  expect((await room.connectFakeSocket(second, tickets.secondToken, nowMs)).ok).toBe(true);
  acknowledgeReady(first);
  acknowledgeReady(second);
  return { tickets, room, first, second };
}

describe("Cloudflare online worker routes", () => {
  it("reports unavailable unless both Durable Objects and the ticket secret exist", async () => {
    const unavailable = await handleRequest(new Request("https://bombapvp.com/api/online"), {
      ASSETS: { fetch: vi.fn() },
    });
    expect(await unavailable.json()).toMatchObject({
      ok: true,
      mode: ONLINE_MODE_ID,
      available: false,
    });

    const available = await handleRequest(new Request("https://bombapvp.com/api/online"), {
      ONLINE_TICKET_SECRET: SECRET,
      ONLINE_MATCHMAKING_ROOM: {},
      ONLINE_MATCH: {},
    });
    expect(await available.json()).toMatchObject({ available: true });

    const weakSecret = await handleRequest(new Request("https://bombapvp.com/api/online"), {
      ONLINE_TICKET_SECRET: "configured-but-weak",
      ONLINE_MATCHMAKING_ROOM: {},
      ONLINE_MATCH: {},
    });
    expect(await weakSecret.json()).toMatchObject({ available: false });
  });

  it("routes queue and regional match upgrades to separate Durable Objects", async () => {
    const queueFetch = vi.fn(async () => new Response("queue"));
    const matchFetch = vi.fn(async () => new Response("match"));
    const queueId = { name: "queue-id" };
    const matchId = { name: "match-id" };
    const env = {
      ONLINE_TICKET_SECRET: SECRET,
      ONLINE_MATCHMAKING_ROOM: {
        idFromName: vi.fn(() => queueId),
        get: vi.fn(() => ({ fetch: queueFetch })),
      },
      ONLINE_MATCH: {
        idFromName: vi.fn(() => matchId),
        get: vi.fn(() => ({ fetch: matchFetch })),
      },
    };

    const queueRequest = new Request("https://bombapvp.com/api/online/queue", {
      headers: { Upgrade: "websocket" },
    });
    expect((await handleRequest(queueRequest, env)).status).toBe(200);
    expect(env.ONLINE_MATCHMAKING_ROOM.idFromName)
      .toHaveBeenCalledWith("duel-1v1-v1:queue:v1");
    expect(env.ONLINE_MATCHMAKING_ROOM.get).toHaveBeenCalledWith(queueId);
    expect(queueFetch).toHaveBeenCalledWith(queueRequest);

    const publicMatchId = "0123456789abcdef";
    const matchRequest = new Request(
      `https://bombapvp.com/api/online/matches/${publicMatchId}?placement=sam`,
      { headers: { Upgrade: "websocket" } },
    );
    expect((await handleRequest(matchRequest, env)).status).toBe(200);
    expect(env.ONLINE_MATCH.idFromName).toHaveBeenCalledWith(publicMatchId);
    expect(env.ONLINE_MATCH.get).toHaveBeenCalledWith(matchId, { locationHint: "sam" });
    expect(matchFetch).toHaveBeenCalledWith(matchRequest);
  });

  it("keeps production-safe logical assets without browser media loads", () => {
    const assets = createServerGameAssets();
    const expectedIds = Object.values(CHAMPION_MEMBERSHIP).map(({ characterId }) => characterId);

    expect(assets.characterRoster.map(({ id }) => id)).toEqual(expectedIds);
    expect(assets.characterRoster.every(({ sprites }) => sprites.idle.down.length === 0)).toBe(true);
    expect(assets.players[1].idle.down).toEqual([]);
    expect(assets.floor.base).toBeNull();
    expect(assets.props.bomb).toBeNull();
    expect(assets.arenaTheme.id).toBe("nova-prime");
  });
});

describe("duel matchmaking host", () => {
  it("matches two humans in-region and emits reciprocal, seat-scoped tickets", async () => {
    const room = new OnlineMatchmakingRoom({}, { ONLINE_TICKET_SECRET: SECRET });
    const first = createFakeSocket();
    const second = createFakeSocket();
    room.connectFakeSocket(first, { continent: "SA", country: "BR" });
    room.connectFakeSocket(second, { continent: "SA", country: "AR" });

    await room.handleSocketMessage(
      first,
      queueJoin(CHAMPION_MEMBERSHIP.ranni.characterId, "first-client-0001"),
    );
    expect(controls(first).at(-1)).toMatchObject({ type: "queue.status", state: "waiting" });

    await room.handleSocketMessage(
      second,
      queueJoin(CHAMPION_MEMBERSHIP["killer-bee"].characterId, "second-client-01"),
    );
    const firstFound = controls(first).find((message) => message.type === "match.found");
    const secondFound = controls(second).find((message) => message.type === "match.found");
    expect(firstFound).toMatchObject({ placement: "sam" });
    expect(secondFound).toMatchObject({ placement: "sam", matchId: firstFound.matchId });
    expect(firstFound).not.toHaveProperty("botPlayerIds");
    expect(firstFound).not.toHaveProperty("chat");

    const firstVerified = await verifyMatchTicket(firstFound.ticket, SECRET);
    const secondVerified = await verifyMatchTicket(secondFound.ticket, SECRET);
    expect(firstVerified.ok).toBe(true);
    expect(secondVerified.ok).toBe(true);
    if (!firstVerified.ok || !secondVerified.ok) return;
    expect(new Set([firstVerified.payload.seat, secondVerified.payload.seat])).toEqual(new Set([1, 2]));
    expect(firstVerified.payload.matchId).toBe(secondVerified.payload.matchId);
    expect(firstVerified.payload.simulationSeed).toBe(secondVerified.payload.simulationSeed);
    expect(firstVerified.payload.characterId).toBe(secondVerified.payload.peerCharacterId);
    expect(secondVerified.payload.characterId).toBe(firstVerified.payload.peerCharacterId);
  });
});

describe("authoritative per-match host", () => {
  it("characterizes queue to tickets to both seats to the final result in delivery order", async () => {
    const issued = await issueTicketsFromQueue();
    expect(controls(issued.firstQueueSocket)).toContainEqual(expect.objectContaining({
      type: "queue.status",
      state: "waiting",
    }));
    expect(issued.firstFound).toMatchObject({
      type: "match.found",
      matchId: issued.secondFound.matchId,
    });

    const room = new OnlineMatchRoom({}, { ONLINE_TICKET_SECRET: SECRET });
    const first = createFakeSocket();
    const second = createFakeSocket();
    const firstTicket = await verifyMatchTicket(issued.firstFound.ticket, SECRET);
    const secondTicket = await verifyMatchTicket(issued.secondFound.ticket, SECRET);
    expect(firstTicket.ok).toBe(true);
    expect(secondTicket.ok).toBe(true);
    if (!firstTicket.ok || !secondTicket.ok) return;
    expect((await room.connectFakeSocket(first, issued.firstFound.ticket)).ok).toBe(true);
    expect(controls(first)).toContainEqual(expect.objectContaining({
      type: "match.ready",
      seat: firstTicket.payload.seat,
    }));
    expect(binaryFrames(first)).toHaveLength(0);
    acknowledgeReady(first);

    expect((await room.connectFakeSocket(second, issued.secondFound.ticket)).ok).toBe(true);
    expect(controls(second)).toContainEqual(expect.objectContaining({
      type: "match.ready",
      seat: secondTicket.payload.seat,
    }));
    expect(binaryFrames(first)).toHaveLength(1);
    expect(binaryFrames(second)).toHaveLength(1);
    acknowledgeReady(second);

    const finalSnapshot = {
      ...room.kernel.capture(),
      mode: "match-result",
      matchWinner: 1,
    };
    const codec = new OnlineSnapshotCodec();
    const finalPacket = encodeServerFrameEnvelope({
      kind: "keyframe",
      serverTick: 1,
      frameId: 99,
      ackInputSeq: 0,
      baselineFrameId: 0,
      payload: codec.encodeKeyframe(finalSnapshot),
    });
    room.runtime = {
      advance: () => ({ overloaded: false }),
      ended: true,
      readFrame: () => finalPacket,
    };
    room.kernel = { capture: () => finalSnapshot };

    room.broadcastTick(17);

    for (const socket of [first, second]) {
      const finalFrameIndex = socket.events.findIndex((event) => event.message === finalPacket);
      const endedIndex = socket.events.findIndex((event) => (
        event.type === "send"
        && typeof event.message === "string"
        && JSON.parse(event.message).type === "match.ended"
      ));
      expect(finalFrameIndex).toBeGreaterThanOrEqual(0);
      expect(endedIndex).toBeGreaterThan(finalFrameIndex);
      expect(socket.closes).toHaveLength(0);

      const decodedFrame = decodeServerFrameEnvelope(socket.events[finalFrameIndex].message);
      expect(decodedFrame.ok).toBe(true);
      if (decodedFrame.ok) {
        const decodedState = codec.decodeKeyframe(decodedFrame.frame.payload);
        expect(decodedState.ok && decodedState.snapshot).toMatchObject({
          mode: "match-result",
          matchWinner: 1,
        });
      }
      expect(endedControls(socket, "completed")).toEqual([{
        type: "match.ended",
        reason: "completed",
        winnerSeat: 1,
      }]);
      acknowledgeTerminal(socket);
      expect(socket.closes).toEqual([{ code: 1000, reason: "match_ended" }]);
      expect(socket.events.findIndex((event) => event.type === "close")).toBeGreaterThan(endedIndex);
    }
  });

  it("starts only after both reciprocal tickets and acks seat-bound binary input", async () => {
    const tickets = await createReciprocalTickets();
    const room = new OnlineMatchRoom({}, { ONLINE_TICKET_SECRET: SECRET });
    const first = createFakeSocket();
    const second = createFakeSocket();

    expect((await room.connectFakeSocket(first, tickets.firstToken)).ok).toBe(true);
    expect(binaryFrames(first)).toHaveLength(0);
    expect((await room.connectFakeSocket(second, tickets.secondToken)).ok).toBe(true);

    expect(first.accepted).toBe(true);
    expect(second.accepted).toBe(true);
    expect(first.acceptedWithBinaryType).toBe("arraybuffer");
    expect(second.acceptedWithBinaryType).toBe("arraybuffer");
    const firstReady = controls(first).find((message) => message.type === "match.ready");
    const secondReady = controls(second).find((message) => message.type === "match.ready");
    expect(firstReady).toMatchObject({
      matchId: tickets.matchId,
      sessionId: tickets.first.sessionId,
      seat: 1,
    });
    expect(secondReady).toMatchObject({
      matchId: tickets.matchId,
      sessionId: tickets.second.sessionId,
      seat: 2,
    });
    acknowledgeReady(first);
    acknowledgeReady(second);

    const codec = new OnlineSnapshotCodec();
    const initialPacket = binaryFrames(second).at(-1);
    const initialEnvelope = decodeServerFrameEnvelope(initialPacket);
    expect(initialEnvelope.ok).toBe(true);
    if (!initialEnvelope.ok) return;
    const initialState = codec.decodeKeyframe(initialEnvelope.frame.payload);
    expect(initialState.ok).toBe(true);
    if (!initialState.ok) return;
    expect(initialState.snapshot.activePlayerIds).toEqual([1, 2]);
    expect(initialState.snapshot.botPlayerIds).toEqual([]);
    expect(initialState.snapshot.arena.randomSeed).toBe(tickets.first.simulationSeed);

    room.handleSocketMessage(second, encodePlayerCommand({
      seq: 1,
      clientTick: 0,
      lastServerTick: 0,
      direction: "left",
      bombPressed: false,
      detonatePressed: false,
      skillPressed: false,
      skillHeld: false,
    }));
    room.broadcastTick(50);

    const nextPacket = binaryFrames(second).at(-1);
    const nextEnvelope = decodeServerFrameEnvelope(nextPacket);
    expect(nextEnvelope.ok).toBe(true);
    if (!nextEnvelope.ok) return;
    expect(nextEnvelope.frame).toMatchObject({
      kind: "delta",
      ackInputSeq: 1,
      baselineFrameId: initialEnvelope.frame.frameId,
    });
    const nextState = codec.applyDelta(initialState.snapshot, nextEnvelope.frame.payload);
    expect(nextState.ok).toBe(true);
    if (!nextState.ok) return;
    expect(nextState.snapshot.activePlayerIds).toEqual([1, 2]);
    expect(nextState.snapshot.botPlayerIds).toEqual([]);
  });

  it("reconnects before and after match start, rotates tokens and recovers a dropped ready", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_800_000_000_000);
    try {
      const tickets = await createReciprocalTickets(Date.now());
      const room = new OnlineMatchRoom({}, { ONLINE_TICKET_SECRET: SECRET });
      const first = createFakeSocket();
      expect((await room.connectFakeSocket(first, tickets.firstToken)).ok).toBe(true);
      const firstReady = controls(first).find((message) => message.type === "match.ready");

      first.emit("close");
      const beforeStart = createFakeSocket();
      expect(room.connectFakeReconnectSocket(
        beforeStart,
        firstReady.sessionId,
        firstReady.reconnectToken,
      ).ok).toBe(true);
      const beforeStartReady = controls(beforeStart).find((message) => message.type === "match.ready");
      expect(beforeStartReady).toMatchObject({ sessionId: firstReady.sessionId, seat: 1 });
      expect(beforeStartReady.reconnectToken).not.toBe(firstReady.reconnectToken);
      acknowledgeReady(beforeStart);

      const second = createFakeSocket();
      expect((await room.connectFakeSocket(second, tickets.secondToken)).ok).toBe(true);
      acknowledgeReady(second);
      const clearInput = vi.spyOn(room.kernel, "clearInput");
      room.handleSocketMessage(beforeStart, encodePlayerCommand({
        seq: 1,
        clientTick: 0,
        lastServerTick: 0,
        direction: "right",
        bombPressed: false,
        detonatePressed: false,
        skillPressed: false,
        skillHeld: true,
      }));

      beforeStart.emit("close");
      expect(clearInput).toHaveBeenCalledWith(1);

      const droppedReady = createFakeSocket();
      droppedReady.failNextSends = 1;
      expect(room.connectFakeReconnectSocket(
        droppedReady,
        firstReady.sessionId,
        beforeStartReady.reconnectToken,
      ).ok).toBe(true);
      expect(controls(droppedReady).some((message) => message.type === "match.ready")).toBe(false);

      const recovered = createFakeSocket();
      expect(room.connectFakeReconnectSocket(
        recovered,
        firstReady.sessionId,
        beforeStartReady.reconnectToken,
      ).ok).toBe(true);
      const recoveredReady = controls(recovered).find((message) => message.type === "match.ready");
      expect(recoveredReady).toMatchObject({ sessionId: firstReady.sessionId, seat: 1 });
      expect(recoveredReady.reconnectToken).not.toBe(beforeStartReady.reconnectToken);
      expect(binaryFrames(recovered)).toHaveLength(1);
      acknowledgeReady(recovered);

      recovered.emit("close");
      expect(room.connectFakeReconnectSocket(
        createFakeSocket(),
        firstReady.sessionId,
        firstReady.reconnectToken,
      )).toEqual({ ok: false, code: "invalid-reconnect" });
      const finalSocket = createFakeSocket();
      expect(room.connectFakeReconnectSocket(
        finalSocket,
        firstReady.sessionId,
        recoveredReady.reconnectToken,
      ).ok).toBe(true);
      acknowledgeReady(finalSocket);

      room.endRoom("server-overload", null);
      acknowledgeTerminal(finalSocket);
      acknowledgeTerminal(second);
    } finally {
      vi.restoreAllMocks();
      vi.useRealTimers();
    }
  });

  it("allows only the same disconnected signed ticket to recover an initial dropped ready", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_800_000_000_000);
    try {
      const tickets = await createReciprocalTickets(Date.now());
      const room = new OnlineMatchRoom({}, { ONLINE_TICKET_SECRET: SECRET });
      const dropped = createFakeSocket();
      dropped.failNextSends = 1;
      vi.setSystemTime(tickets.first.expiresAtMs - 1);
      expect((await room.connectFakeSocket(dropped, tickets.firstToken)).ok).toBe(true);
      expect(controls(dropped).some((message) => message.type === "match.ready")).toBe(false);

      vi.advanceTimersByTime(2);
      const retry = createFakeSocket();
      expect((await room.connectFakeSocket(retry, tickets.firstToken)).ok).toBe(true);
      expect(controls(retry)).toContainEqual(expect.objectContaining({
        type: "match.ready",
        sessionId: tickets.first.sessionId,
        seat: 1,
      }));
      expect((await room.connectFakeSocket(createFakeSocket(), tickets.firstToken)).ok).toBe(false);

      retry.emit("close");
      expect((await room.connectFakeSocket(
        createFakeSocket(),
        tickets.firstToken,
        Date.now() + 10_000,
      )).ok).toBe(false);
      const finalSocket = createFakeSocket();
      expect((await room.connectFakeSocket(finalSocket, tickets.firstToken)).ok).toBe(true);
      const finalReady = controls(finalSocket).find((message) => message.type === "match.ready");
      acknowledgeReady(finalSocket);
      finalSocket.emit("close");
      expect((await room.connectFakeSocket(createFakeSocket(), tickets.firstToken)).ok).toBe(false);
      const reconnect = createFakeSocket();
      expect(room.connectFakeReconnectSocket(
        reconnect,
        finalReady.sessionId,
        finalReady.reconnectToken,
      ).ok).toBe(true);
      acknowledgeReady(reconnect);

      room.endRoom("peer-timeout", null);
      acknowledgeTerminal(reconnect);
    } finally {
      vi.useRealTimers();
    }
  });

  it("retires the initial ticket after ready ACK while the current reconnect token remains valid", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_800_000_000_000);
    try {
      const tickets = await createReciprocalTickets(Date.now());
      const room = new OnlineMatchRoom({}, { ONLINE_TICKET_SECRET: SECRET });
      const initial = createFakeSocket();
      expect((await room.connectFakeSocket(initial, tickets.firstToken)).ok).toBe(true);
      const initialReady = controls(initial).find((message) => message.type === "match.ready");
      acknowledgeReady(initial);

      vi.setSystemTime(tickets.first.expiresAtMs - 5_000);
      initial.emit("close");
      expect((await room.connectFakeSocket(
        createFakeSocket(),
        tickets.firstToken,
        tickets.first.expiresAtMs - 1,
      )).ok).toBe(false);
      expect((await room.connectFakeSocket(
        createFakeSocket(),
        tickets.firstToken,
        tickets.first.expiresAtMs + 1,
      )).ok).toBe(false);

      const reconnect = createFakeSocket();
      expect(room.connectFakeReconnectSocket(
        reconnect,
        initialReady.sessionId,
        initialReady.reconnectToken,
        tickets.first.expiresAtMs + 1,
      ).ok).toBe(true);
      acknowledgeReady(reconnect);
      room.endRoom("peer-timeout", null);
      acknowledgeTerminal(reconnect);
    } finally {
      vi.useRealTimers();
    }
  });

  it("retires the previous reconnect token only after the replacement ready is acknowledged", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_800_000_000_000);
    try {
      const tickets = await createReciprocalTickets(Date.now());
      const room = new OnlineMatchRoom({}, { ONLINE_TICKET_SECRET: SECRET });
      const initial = createFakeSocket();
      expect((await room.connectFakeSocket(initial, tickets.firstToken)).ok).toBe(true);
      const initialReady = controls(initial).find((message) => message.type === "match.ready");
      acknowledgeReady(initial);
      initial.emit("close");

      const firstReconnect = createFakeSocket();
      expect(room.connectFakeReconnectSocket(
        firstReconnect,
        initialReady.sessionId,
        initialReady.reconnectToken,
      ).ok).toBe(true);
      const replacementReady = controls(firstReconnect)
        .find((message) => message.type === "match.ready");
      acknowledgeReady(firstReconnect);
      firstReconnect.emit("close");

      expect(room.connectFakeReconnectSocket(
        createFakeSocket(),
        initialReady.sessionId,
        initialReady.reconnectToken,
      )).toEqual({ ok: false, code: "invalid-reconnect" });
      const current = createFakeSocket();
      expect(room.connectFakeReconnectSocket(
        current,
        initialReady.sessionId,
        replacementReady.reconnectToken,
      ).ok).toBe(true);
      acknowledgeReady(current);
      room.endRoom("peer-timeout", null);
      acknowledgeTerminal(current);
    } finally {
      vi.useRealTimers();
    }
  });

  it("ignores a delayed ready ACK from a socket that has already been replaced", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_800_000_000_000);
    try {
      const tickets = await createReciprocalTickets(Date.now());
      const room = new OnlineMatchRoom({}, { ONLINE_TICKET_SECRET: SECRET });
      const initial = createFakeSocket();
      expect((await room.connectFakeSocket(initial, tickets.firstToken)).ok).toBe(true);
      initial.emit("close");

      const replacement = createFakeSocket();
      expect((await room.connectFakeSocket(replacement, tickets.firstToken)).ok).toBe(true);
      acknowledgeReady(initial);
      replacement.emit("close");

      const recovered = createFakeSocket();
      expect((await room.connectFakeSocket(recovered, tickets.firstToken)).ok).toBe(true);
      acknowledgeReady(recovered);
      room.endRoom("peer-timeout", null);
      acknowledgeTerminal(recovered);
    } finally {
      vi.useRealTimers();
    }
  });

  it("expires a disconnected pre-start seat at ten seconds exactly once as peer-timeout", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_800_000_000_000);
    try {
      const tickets = await createReciprocalTickets(Date.now());
      const room = new OnlineMatchRoom({}, { ONLINE_TICKET_SECRET: SECRET });
      const first = createFakeSocket();
      const second = createFakeSocket();
      expect((await room.connectFakeSocket(first, tickets.firstToken)).ok).toBe(true);
      const ready = controls(first).find((message) => message.type === "match.ready");
      first.emit("close");
      expect((await room.connectFakeSocket(second, tickets.secondToken)).ok).toBe(true);

      vi.advanceTimersByTime(9_999);
      expect(endedControls(second)).toHaveLength(0);
      vi.advanceTimersByTime(1);
      expect(endedControls(second, "peer-timeout")).toHaveLength(1);
      expect(second.closes).toHaveLength(0);
      acknowledgeTerminal(second);
      expect(second.closes).toHaveLength(1);

      room.endRoom("peer-timeout", null);
      vi.advanceTimersByTime(20_000);
      expect(endedControls(second)).toHaveLength(1);
      expect(room.connectFakeReconnectSocket(
        createFakeSocket(),
        ready.sessionId,
        ready.reconnectToken,
      )).toEqual({ ok: false, code: "invalid-reconnect" });
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not let the original peer-arrival timeout truncate a late pre-start reconnect window", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_800_000_000_000);
    try {
      const tickets = await createReciprocalTickets(Date.now());
      const room = new OnlineMatchRoom({}, { ONLINE_TICKET_SECRET: SECRET });
      const first = createFakeSocket();
      const second = createFakeSocket();
      expect((await room.connectFakeSocket(first, tickets.firstToken)).ok).toBe(true);

      vi.advanceTimersByTime(19_000);
      first.emit("close");
      expect((await room.connectFakeSocket(second, tickets.secondToken)).ok).toBe(true);

      vi.advanceTimersByTime(1_000);
      expect(endedControls(second)).toHaveLength(0);
      vi.advanceTimersByTime(8_999);
      expect(endedControls(second)).toHaveLength(0);
      vi.advanceTimersByTime(1);
      expect(endedControls(second, "peer-timeout")).toHaveLength(1);
      acknowledgeTerminal(second);
    } finally {
      vi.useRealTimers();
    }
  });

  it("ends a post-start disconnect once as forfeit and seals the session", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_800_000_000_000);
    try {
      const { room, first, second } = await createStartedMatchRoom(Date.now());
      const ready = controls(first).find((message) => message.type === "match.ready");
      first.emit("close");

      vi.advanceTimersByTime(10_000);
      expect(endedControls(second, "forfeit")).toEqual([{
        type: "match.ended",
        reason: "forfeit",
        winnerSeat: 2,
      }]);
      acknowledgeTerminal(second);
      room.broadcastTick(1_000);
      room.endRoom("forfeit", 2);
      expect(endedControls(second)).toHaveLength(1);
      expect(room.connectFakeReconnectSocket(
        createFakeSocket(),
        ready.sessionId,
        ready.reconnectToken,
      )).toEqual({ ok: false, code: "invalid-reconnect" });
    } finally {
      vi.useRealTimers();
    }
  });

  it("ends overload once and waits for terminal ACK or the bounded close fallback", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_800_000_000_000);
    try {
      const { room, first, second } = await createStartedMatchRoom(Date.now());
      const ready = controls(first).find((message) => message.type === "match.ready");
      room.runtime = {
        advance: () => ({ overloaded: true }),
        ended: false,
        readFrame: () => null,
      };

      room.broadcastTick(50);
      room.broadcastTick(50);
      expect(endedControls(first, "server-overload")).toHaveLength(1);
      expect(endedControls(second, "server-overload")).toHaveLength(1);
      expect(first.closes).toHaveLength(0);
      expect(second.closes).toHaveLength(0);

      acknowledgeTerminal(first);
      expect(first.closes).toEqual([{ code: 1000, reason: "match_ended" }]);
      vi.advanceTimersByTime(999);
      expect(second.closes).toHaveLength(0);
      vi.advanceTimersByTime(1);
      expect(second.closes).toEqual([{ code: 1000, reason: "match_ended" }]);
      expect(endedControls(first)).toHaveLength(1);
      expect(endedControls(second)).toHaveLength(1);
      expect(room.connectFakeReconnectSocket(
        createFakeSocket(),
        ready.sessionId,
        ready.reconnectToken,
      )).toEqual({ ok: false, code: "invalid-reconnect" });
    } finally {
      vi.useRealTimers();
    }
  });

  it("rejects a replayed seat ticket and closes repeated malformed packets", async () => {
    const tickets = await createReciprocalTickets();
    const room = new OnlineMatchRoom({}, { ONLINE_TICKET_SECRET: SECRET });
    const first = createFakeSocket();
    const replay = createFakeSocket();
    expect((await room.connectFakeSocket(first, tickets.firstToken)).ok).toBe(true);
    expect((await room.connectFakeSocket(replay, tickets.firstToken)).ok).toBe(false);

    const second = createFakeSocket();
    expect((await room.connectFakeSocket(second, tickets.secondToken)).ok).toBe(true);
    for (let index = 0; index < 8; index += 1) {
      room.handleSocketMessage(second, new Uint8Array(65));
    }
    expect(second.closes.at(-1)).toEqual({ code: 1008, reason: "protocol_violation" });
  });
});
