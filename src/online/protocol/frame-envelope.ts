import { ONLINE_PROTOCOL_VERSION } from "./contracts";

export const SERVER_KEYFRAME_PACKET_TYPE = 0x20;
export const SERVER_DELTA_PACKET_TYPE = 0x21;
export const SERVER_FRAME_HEADER_BYTES = 24;
export const MAX_KEYFRAME_PAYLOAD_BYTES = 8 * 1024;
export const MAX_DELTA_PAYLOAD_BYTES = 2 * 1024;

export type ServerFrameKind = "keyframe" | "delta";

export interface ServerFrameEnvelope {
  kind: ServerFrameKind;
  serverTick: number;
  frameId: number;
  ackInputSeq: number;
  baselineFrameId: number;
  payload: Uint8Array;
}

export type ServerFrameDecodeError =
  | "invalid-length"
  | "invalid-packet-type"
  | "unsupported-protocol-version"
  | "reserved-bit-set"
  | "payload-too-large"
  | "payload-length-mismatch"
  | "invalid-baseline";

export type ServerFrameDecodeResult =
  | Readonly<{ ok: true; frame: ServerFrameEnvelope }>
  | Readonly<{ ok: false; code: ServerFrameDecodeError }>;

export function encodeServerFrameEnvelope(frame: ServerFrameEnvelope): Uint8Array {
  assertUint32(frame.serverTick, "serverTick");
  assertUint32(frame.frameId, "frameId");
  assertUint32(frame.ackInputSeq, "ackInputSeq");
  assertUint32(frame.baselineFrameId, "baselineFrameId");
  assertFrameBaseline(frame.kind, frame.baselineFrameId);
  assertPayloadSize(frame.kind, frame.payload.byteLength);

  const packet = new Uint8Array(SERVER_FRAME_HEADER_BYTES + frame.payload.byteLength);
  packet[0] = frame.kind === "keyframe" ? SERVER_KEYFRAME_PACKET_TYPE : SERVER_DELTA_PACKET_TYPE;
  packet[1] = ONLINE_PROTOCOL_VERSION;
  packet[2] = 0;
  packet[3] = 0;

  const view = new DataView(packet.buffer);
  view.setUint32(4, frame.serverTick, true);
  view.setUint32(8, frame.frameId, true);
  view.setUint32(12, frame.ackInputSeq, true);
  view.setUint32(16, frame.baselineFrameId, true);
  view.setUint16(20, frame.payload.byteLength, true);
  view.setUint16(22, 0, true);
  packet.set(frame.payload, SERVER_FRAME_HEADER_BYTES);
  return packet;
}

export function decodeServerFrameEnvelope(packet: Uint8Array): ServerFrameDecodeResult {
  if (packet.byteLength < SERVER_FRAME_HEADER_BYTES) {
    return { ok: false, code: "invalid-length" };
  }
  const kind = packetTypeToKind(packet[0]);
  if (!kind) {
    return { ok: false, code: "invalid-packet-type" };
  }
  if (packet[1] !== ONLINE_PROTOCOL_VERSION) {
    return { ok: false, code: "unsupported-protocol-version" };
  }
  if (packet[2] !== 0 || packet[3] !== 0) {
    return { ok: false, code: "reserved-bit-set" };
  }

  const view = new DataView(packet.buffer, packet.byteOffset, packet.byteLength);
  if (view.getUint16(22, true) !== 0) {
    return { ok: false, code: "reserved-bit-set" };
  }
  const baselineFrameId = view.getUint32(16, true);
  if ((kind === "keyframe" && baselineFrameId !== 0) || (kind === "delta" && baselineFrameId === 0)) {
    return { ok: false, code: "invalid-baseline" };
  }

  const payloadLength = view.getUint16(20, true);
  const maxPayload = kind === "keyframe" ? MAX_KEYFRAME_PAYLOAD_BYTES : MAX_DELTA_PAYLOAD_BYTES;
  if (payloadLength > maxPayload) {
    return { ok: false, code: "payload-too-large" };
  }
  if (packet.byteLength !== SERVER_FRAME_HEADER_BYTES + payloadLength) {
    return { ok: false, code: "payload-length-mismatch" };
  }

  return {
    ok: true,
    frame: {
      kind,
      serverTick: view.getUint32(4, true),
      frameId: view.getUint32(8, true),
      ackInputSeq: view.getUint32(12, true),
      baselineFrameId,
      payload: packet.slice(SERVER_FRAME_HEADER_BYTES),
    },
  };
}

function packetTypeToKind(value: number | undefined): ServerFrameKind | null {
  if (value === SERVER_KEYFRAME_PACKET_TYPE) return "keyframe";
  if (value === SERVER_DELTA_PACKET_TYPE) return "delta";
  return null;
}

function assertFrameBaseline(kind: ServerFrameKind, baselineFrameId: number): void {
  if (kind === "keyframe" && baselineFrameId !== 0) {
    throw new RangeError("keyframe baselineFrameId must be zero");
  }
  if (kind === "delta" && baselineFrameId === 0) {
    throw new RangeError("delta baselineFrameId must reference a keyframe or frame");
  }
}

function assertPayloadSize(kind: ServerFrameKind, byteLength: number): void {
  const maximum = kind === "keyframe" ? MAX_KEYFRAME_PAYLOAD_BYTES : MAX_DELTA_PAYLOAD_BYTES;
  if (byteLength > maximum) {
    throw new RangeError(`${kind} payload exceeds ${maximum} bytes`);
  }
}

function assertUint32(value: number, field: string): void {
  if (!Number.isInteger(value) || value < 0 || value > 0xffff_ffff) {
    throw new RangeError(`${field} must be an unsigned 32-bit integer`);
  }
}
