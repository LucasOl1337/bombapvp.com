import { describe, expect, it } from "vitest";
import { CHAMPION_MEMBERSHIP } from "../Champions/membership.ts";
import { ONLINE_CONTENT_REVISION } from "../src/online/content-revision.ts";
import {
  decodeClientControlMessage,
  decodeServerControlMessage,
  encodeClientControlMessage,
  encodeServerControlMessage,
  MAX_CONTROL_MESSAGE_BYTES,
} from "../src/online/protocol/control-messages.ts";
import { ONLINE_MODE_ID, ONLINE_PROTOCOL_VERSION } from "../src/online/protocol/contracts.ts";
import {
  createMatchTicketPayload,
  MATCH_TICKET_LIFETIME_MS,
  matchTicketPayloadsEqual,
  randomOnlineId,
  signMatchTicket,
  verifyMatchTicket,
} from "../src/online/session/match-ticket.ts";

const SECRET = "test-only-secret-that-is-at-least-32-bytes-long";

function queueJoin(overrides: Record<string, unknown> = {}) {
  return {
    type: "queue.join",
    protocolVersion: ONLINE_PROTOCOL_VERSION,
    modeId: ONLINE_MODE_ID,
    contentRevision: ONLINE_CONTENT_REVISION,
    characterId: CHAMPION_MEMBERSHIP.ranni.characterId,
    clientNonce: "0123456789abcdef",
    ...overrides,
  };
}

describe("bounded online control protocol", () => {
  it("accepts the exact queue contract and all current character ids", () => {
    for (const { characterId } of Object.values(CHAMPION_MEMBERSHIP)) {
      const decoded = decodeClientControlMessage(JSON.stringify(queueJoin({ characterId })));
      expect(decoded.ok).toBe(true);
    }
    expect(decodeClientControlMessage(encodeClientControlMessage({ type: "match.ended.ack" })))
      .toEqual({ ok: true, message: { type: "match.ended.ack" } });
    expect(decodeClientControlMessage(encodeClientControlMessage({ type: "match.ready.ack" })))
      .toEqual({ ok: true, message: { type: "match.ready.ack" } });
    expect(decodeClientControlMessage(JSON.stringify({ type: "match.ended.ack", eventId: "extra" })))
      .toEqual({ ok: false, code: "invalid-message" });
    expect(decodeClientControlMessage(JSON.stringify({ type: "match.ready.ack", generation: 1 })))
      .toEqual({ ok: false, code: "invalid-message" });
  });

  it("rejects oversized, extra-field, stale-revision and future-version controls", () => {
    expect(decodeClientControlMessage(new Uint8Array(MAX_CONTROL_MESSAGE_BYTES + 1)))
      .toEqual({ ok: false, code: "message-too-large" });
    expect(decodeClientControlMessage(JSON.stringify(queueJoin({ admin: true }))))
      .toEqual({ ok: false, code: "invalid-message" });
    expect(decodeClientControlMessage(JSON.stringify(queueJoin({ contentRevision: "old" }))))
      .toEqual({ ok: false, code: "content-revision-mismatch" });
    expect(decodeClientControlMessage(JSON.stringify(queueJoin({ protocolVersion: 2 }))))
      .toEqual({ ok: false, code: "unsupported-protocol" });
  });

  it("keeps server controls under the same byte ceiling", () => {
    const encoded = encodeServerControlMessage({
      type: "match.found",
      matchId: "0123456789abcdef",
      ticket: "signed-ticket",
      placement: "sam",
      connectPath: "/api/online/matches/0123456789abcdef",
    });
    expect(new TextEncoder().encode(encoded).byteLength).toBeLessThanOrEqual(MAX_CONTROL_MESSAGE_BYTES);
    expect(decodeServerControlMessage(encoded)).toEqual({
      ok: true,
      message: {
        type: "match.found",
        matchId: "0123456789abcdef",
        ticket: "signed-ticket",
        placement: "sam",
        connectPath: "/api/online/matches/0123456789abcdef",
      },
    });
  });

  it("rejects malformed server paths, extra fields and oversized controls", () => {
    expect(decodeServerControlMessage(JSON.stringify({
      type: "match.found",
      matchId: "0123456789abcdef",
      ticket: "signed-ticket",
      placement: "sam",
      connectPath: "/api/online/matches/another-match-id",
    }))).toEqual({ ok: false, code: "invalid-message" });
    expect(decodeServerControlMessage(JSON.stringify({
      type: "match.ready",
      matchId: "0123456789abcdef",
      sessionId: "session-00000001",
      seat: 1,
      reconnectToken: "reconnect-token-01",
      admin: true,
    }))).toEqual({ ok: false, code: "invalid-message" });
    expect(decodeServerControlMessage(JSON.stringify({
      type: "match.ended",
      reason: "forfeit",
      winnerSeat: 1,
    }))).toEqual({
      ok: true,
      message: { type: "match.ended", reason: "forfeit", winnerSeat: 1 },
    });
    expect(decodeServerControlMessage(JSON.stringify({
      type: "match.ended",
      reason: "client-claimed-win",
      winnerSeat: 1,
    }))).toEqual({ ok: false, code: "invalid-message" });
    expect(decodeServerControlMessage(new Uint8Array(MAX_CONTROL_MESSAGE_BYTES + 1)))
      .toEqual({ ok: false, code: "message-too-large" });
  });
});

describe("signed per-seat match tickets", () => {
  it("round-trips a canonical short-lived ticket", async () => {
    const now = 1_800_000_000_000;
    const payload = createMatchTicketPayload({
      matchId: randomOnlineId(),
      simulationSeed: randomOnlineId(),
      sessionId: randomOnlineId(),
      seat: 1,
      characterId: CHAMPION_MEMBERSHIP.ranni.characterId,
      peerCharacterId: CHAMPION_MEMBERSHIP["killer-bee"].characterId,
      placement: "sam",
      issuedAtMs: now,
      nonce: randomOnlineId(),
    });
    const ticket = await signMatchTicket(payload, SECRET);

    expect(matchTicketPayloadsEqual(payload, { ...payload })).toBe(true);
    expect(matchTicketPayloadsEqual(payload, { ...payload, nonce: randomOnlineId() })).toBe(false);
    expect(await verifyMatchTicket(ticket, SECRET, now + MATCH_TICKET_LIFETIME_MS - 1))
      .toEqual({ ok: true, payload });
    expect(await verifyMatchTicket(ticket, SECRET, now + MATCH_TICKET_LIFETIME_MS + 1))
      .toEqual({ ok: false, code: "expired-ticket" });
  });

  it("rejects tampering, wrong secrets and weak signing secrets", async () => {
    const now = 1_800_000_000_000;
    const payload = createMatchTicketPayload({
      matchId: randomOnlineId(),
      simulationSeed: randomOnlineId(),
      sessionId: randomOnlineId(),
      seat: 2,
      characterId: CHAMPION_MEMBERSHIP.nico.characterId,
      peerCharacterId: CHAMPION_MEMBERSHIP.pendula.characterId,
      placement: "enam",
      issuedAtMs: now,
      nonce: randomOnlineId(),
    });
    const ticket = await signMatchTicket(payload, SECRET);
    const tampered = `${ticket.slice(0, -2)}aa`;

    expect(await verifyMatchTicket(tampered, SECRET, now)).toEqual({ ok: false, code: "invalid-ticket" });
    expect(await verifyMatchTicket(ticket, `${SECRET}-wrong`, now)).toEqual({ ok: false, code: "invalid-ticket" });
    await expect(signMatchTicket(payload, "too-short")).rejects.toThrow(/32 bytes/);
  });
});
