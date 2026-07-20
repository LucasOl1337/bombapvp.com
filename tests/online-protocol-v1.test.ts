import { describe, expect, it } from "vitest";
import {
  decodePlayerCommand,
  encodePlayerCommand,
  MAX_CLIENT_GAMEPLAY_PACKET_BYTES,
  PLAYER_COMMAND_PACKET_BYTES,
} from "../src/online/protocol/input-codec.ts";
import {
  decodeServerFrameEnvelope,
  encodeServerFrameEnvelope,
  MAX_DELTA_PAYLOAD_BYTES,
  MAX_KEYFRAME_PAYLOAD_BYTES,
  SERVER_FRAME_HEADER_BYTES,
} from "../src/online/protocol/frame-envelope.ts";
import type { PlayerCommand } from "../src/online/protocol/contracts.ts";

const COMMAND: PlayerCommand = {
  seq: 4_294_967_295,
  clientTick: 99,
  lastServerTick: 88,
  direction: "left",
  bombPressed: true,
  detonatePressed: false,
  skillPressed: true,
  skillHeld: true,
};

describe("online protocol v1", () => {
  it("round-trips a bounded 16-byte player command without carrying a seat id", () => {
    const packet = encodePlayerCommand(COMMAND);

    expect(packet).toHaveLength(PLAYER_COMMAND_PACKET_BYTES);
    expect(packet.byteLength).toBeLessThanOrEqual(MAX_CLIENT_GAMEPLAY_PACKET_BYTES);
    expect(decodePlayerCommand(packet)).toEqual({ ok: true, command: COMMAND });
  });

  it("rejects malformed, oversized, future-version and reserved input packets", () => {
    expect(decodePlayerCommand(new Uint8Array(15))).toEqual({ ok: false, code: "invalid-length" });
    expect(decodePlayerCommand(new Uint8Array(65))).toEqual({ ok: false, code: "packet-too-large" });

    const future = encodePlayerCommand(COMMAND);
    future[1] = 2;
    expect(decodePlayerCommand(future)).toEqual({ ok: false, code: "unsupported-protocol-version" });

    const reserved = encodePlayerCommand(COMMAND);
    reserved[2] = (reserved[2] ?? 0) | 0x80;
    expect(decodePlayerCommand(reserved)).toEqual({ ok: false, code: "reserved-bit-set" });

    const badDirection = encodePlayerCommand(COMMAND);
    badDirection[2] = ((badDirection[2] ?? 0) & 0xf8) | 0x07;
    expect(decodePlayerCommand(badDirection)).toEqual({ ok: false, code: "invalid-direction" });
  });

  it("rejects non-uint32 counters before encoding", () => {
    expect(() => encodePlayerCommand({ ...COMMAND, seq: -1 })).toThrow(RangeError);
    expect(() => encodePlayerCommand({ ...COMMAND, clientTick: Number.NaN })).toThrow(RangeError);
  });

  it("round-trips keyframe and delta envelopes with explicit baselines", () => {
    const keyframePayload = new Uint8Array([1, 2, 3]);
    const keyframePacket = encodeServerFrameEnvelope({
      kind: "keyframe",
      serverTick: 120,
      frameId: 10,
      ackInputSeq: 8,
      baselineFrameId: 0,
      payload: keyframePayload,
    });
    expect(keyframePacket).toHaveLength(SERVER_FRAME_HEADER_BYTES + keyframePayload.byteLength);
    expect(decodeServerFrameEnvelope(keyframePacket)).toEqual({
      ok: true,
      frame: {
        kind: "keyframe",
        serverTick: 120,
        frameId: 10,
        ackInputSeq: 8,
        baselineFrameId: 0,
        payload: keyframePayload,
      },
    });

    const deltaPayload = new Uint8Array([9, 8]);
    expect(decodeServerFrameEnvelope(encodeServerFrameEnvelope({
      kind: "delta",
      serverTick: 123,
      frameId: 11,
      ackInputSeq: 9,
      baselineFrameId: 10,
      payload: deltaPayload,
    }))).toEqual({
      ok: true,
      frame: {
        kind: "delta",
        serverTick: 123,
        frameId: 11,
        ackInputSeq: 9,
        baselineFrameId: 10,
        payload: deltaPayload,
      },
    });
  });

  it("enforces keyframe/delta byte budgets and baseline semantics", () => {
    expect(() => encodeServerFrameEnvelope({
      kind: "keyframe",
      serverTick: 1,
      frameId: 1,
      ackInputSeq: 0,
      baselineFrameId: 1,
      payload: new Uint8Array(),
    })).toThrow(/baselineFrameId/);
    expect(() => encodeServerFrameEnvelope({
      kind: "delta",
      serverTick: 1,
      frameId: 2,
      ackInputSeq: 0,
      baselineFrameId: 1,
      payload: new Uint8Array(MAX_DELTA_PAYLOAD_BYTES + 1),
    })).toThrow(/exceeds/);
    expect(() => encodeServerFrameEnvelope({
      kind: "keyframe",
      serverTick: 1,
      frameId: 1,
      ackInputSeq: 0,
      baselineFrameId: 0,
      payload: new Uint8Array(MAX_KEYFRAME_PAYLOAD_BYTES + 1),
    })).toThrow(/exceeds/);
  });
});
