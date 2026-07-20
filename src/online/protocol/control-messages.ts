import {
  CHAMPION_MEMBERSHIP,
  type CharacterId,
} from "../../../Champions/membership";
import { ONLINE_CONTENT_REVISION } from "../content-revision";
import {
  ONLINE_MODE_ID,
  ONLINE_PROTOCOL_VERSION,
  type OnlineModeId,
  type OnlineProtocolVersion,
} from "./contracts";

export const MAX_CONTROL_MESSAGE_BYTES = 2_048;

export type QueueJoinMessage = Readonly<{
  type: "queue.join";
  protocolVersion: OnlineProtocolVersion;
  modeId: OnlineModeId;
  contentRevision: typeof ONLINE_CONTENT_REVISION;
  characterId: CharacterId;
  clientNonce: string;
}>;

export type ClientControlMessage =
  | QueueJoinMessage
  | Readonly<{ type: "queue.leave" }>
  | Readonly<{ type: "frame.resync" }>
  | Readonly<{ type: "match.ready.ack" }>
  | Readonly<{ type: "match.ended.ack" }>;

export type ServerControlMessage =
  | Readonly<{
      type: "queue.status";
      state: "waiting";
      queuedAtMs: number;
    }>
  | Readonly<{
      type: "match.found";
      matchId: string;
      ticket: string;
      placement: PlacementHint;
      connectPath: string;
    }>
  | Readonly<{
      type: "match.ready";
      matchId: string;
      sessionId: string;
      seat: 1 | 2;
      reconnectToken: string;
    }>
  | Readonly<{
      type: "peer.status";
      seat: 1 | 2;
      state: "connecting" | "connected" | "reconnecting" | "forfeited";
      deadlineMs: number | null;
    }>
  | Readonly<{
      type: "match.ended";
      reason: "completed" | "forfeit" | "server-overload" | "peer-timeout";
      winnerSeat: 1 | 2 | null;
    }>
  | Readonly<{
      type: "error";
      code: ControlErrorCode;
      retryable: boolean;
    }>;

export type ControlErrorCode =
  | "invalid-message"
  | "message-too-large"
  | "unsupported-protocol"
  | "content-revision-mismatch"
  | "invalid-character"
  | "already-queued"
  | "queue-unavailable"
  | "invalid-ticket"
  | "match-unavailable"
  | "rate-limited";

export type PlacementHint =
  | "wnam"
  | "enam"
  | "sam"
  | "weur"
  | "eeur"
  | "apac"
  | "oc"
  | "afr"
  | "me";

export type ControlDecodeResult =
  | Readonly<{ ok: true; message: ClientControlMessage }>
  | Readonly<{ ok: false; code: ControlErrorCode }>;

export type ServerControlDecodeResult =
  | Readonly<{ ok: true; message: ServerControlMessage }>
  | Readonly<{ ok: false; code: "invalid-message" | "message-too-large" }>;

const CHARACTER_IDS = new Set<CharacterId>(
  Object.values(CHAMPION_MEMBERSHIP).map(({ characterId }) => characterId),
);
const NONCE_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;
const ID_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;
const MATCH_PATH_PATTERN = /^\/api\/online\/matches\/([A-Za-z0-9_-]{16,64})$/u;
const PLACEMENTS = new Set<PlacementHint>([
  "wnam", "enam", "sam", "weur", "eeur", "apac", "oc", "afr", "me",
]);
const CONTROL_ERROR_CODES = new Set<ControlErrorCode>([
  "invalid-message",
  "message-too-large",
  "unsupported-protocol",
  "content-revision-mismatch",
  "invalid-character",
  "already-queued",
  "queue-unavailable",
  "invalid-ticket",
  "match-unavailable",
  "rate-limited",
]);

export function decodeClientControlMessage(data: string | ArrayBuffer | Uint8Array): ControlDecodeResult {
  const bytes = toBytes(data);
  if (bytes.byteLength > MAX_CONTROL_MESSAGE_BYTES) {
    return { ok: false, code: "message-too-large" };
  }
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    return { ok: false, code: "invalid-message" };
  }
  if (!isRecord(value) || typeof value.type !== "string") {
    return { ok: false, code: "invalid-message" };
  }
  if (
    value.type === "queue.leave"
    || value.type === "frame.resync"
    || value.type === "match.ready.ack"
    || value.type === "match.ended.ack"
  ) {
    return Object.keys(value).length === 1
      ? { ok: true, message: { type: value.type } }
      : { ok: false, code: "invalid-message" };
  }
  if (value.type !== "queue.join") return { ok: false, code: "invalid-message" };
  if (value.protocolVersion !== ONLINE_PROTOCOL_VERSION || value.modeId !== ONLINE_MODE_ID) {
    return { ok: false, code: "unsupported-protocol" };
  }
  if (value.contentRevision !== ONLINE_CONTENT_REVISION) {
    return { ok: false, code: "content-revision-mismatch" };
  }
  if (typeof value.characterId !== "string" || !CHARACTER_IDS.has(value.characterId as CharacterId)) {
    return { ok: false, code: "invalid-character" };
  }
  if (typeof value.clientNonce !== "string" || !NONCE_PATTERN.test(value.clientNonce)) {
    return { ok: false, code: "invalid-message" };
  }
  if (!hasExactKeys(value, [
    "type",
    "protocolVersion",
    "modeId",
    "contentRevision",
    "characterId",
    "clientNonce",
  ])) {
    return { ok: false, code: "invalid-message" };
  }
  return {
    ok: true,
    message: {
      type: "queue.join",
      protocolVersion: ONLINE_PROTOCOL_VERSION,
      modeId: ONLINE_MODE_ID,
      contentRevision: ONLINE_CONTENT_REVISION,
      characterId: value.characterId as CharacterId,
      clientNonce: value.clientNonce,
    },
  };
}

export function encodeClientControlMessage(message: ClientControlMessage): string {
  return encodeControlMessage(message, "client");
}

export function encodeServerControlMessage(message: ServerControlMessage): string {
  return encodeControlMessage(message, "server");
}

function encodeControlMessage(
  message: ClientControlMessage | ServerControlMessage,
  lane: "client" | "server",
): string {
  const encoded = JSON.stringify(message);
  if (new TextEncoder().encode(encoded).byteLength > MAX_CONTROL_MESSAGE_BYTES) {
    throw new RangeError(`${lane} control message exceeds byte budget`);
  }
  return encoded;
}

/** Strictly decodes the untrusted control lane received by browser clients. */
export function decodeServerControlMessage(
  data: string | ArrayBuffer | Uint8Array,
): ServerControlDecodeResult {
  const bytes = toBytes(data);
  if (bytes.byteLength > MAX_CONTROL_MESSAGE_BYTES) {
    return { ok: false, code: "message-too-large" };
  }
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    return { ok: false, code: "invalid-message" };
  }
  if (!isRecord(value) || typeof value.type !== "string") {
    return { ok: false, code: "invalid-message" };
  }

  if (value.type === "queue.status") {
    if (
      !hasExactKeys(value, ["type", "state", "queuedAtMs"])
      || value.state !== "waiting"
      || !isSafeTimestamp(value.queuedAtMs)
    ) return { ok: false, code: "invalid-message" };
    return { ok: true, message: { type: "queue.status", state: "waiting", queuedAtMs: value.queuedAtMs } };
  }

  if (value.type === "match.found") {
    const pathMatch = typeof value.connectPath === "string"
      ? MATCH_PATH_PATTERN.exec(value.connectPath)
      : null;
    if (
      !hasExactKeys(value, ["type", "matchId", "ticket", "placement", "connectPath"])
      || typeof value.matchId !== "string"
      || !ID_PATTERN.test(value.matchId)
      || typeof value.ticket !== "string"
      || value.ticket.length === 0
      || new TextEncoder().encode(value.ticket).byteLength > 1_536
      || typeof value.placement !== "string"
      || !PLACEMENTS.has(value.placement as PlacementHint)
      || pathMatch?.[1] !== value.matchId
    ) return { ok: false, code: "invalid-message" };
    return {
      ok: true,
      message: {
        type: "match.found",
        matchId: value.matchId,
        ticket: value.ticket,
        placement: value.placement as PlacementHint,
        connectPath: value.connectPath as string,
      },
    };
  }

  if (value.type === "match.ready") {
    if (
      !hasExactKeys(value, ["type", "matchId", "sessionId", "seat", "reconnectToken"])
      || typeof value.matchId !== "string" || !ID_PATTERN.test(value.matchId)
      || typeof value.sessionId !== "string" || !ID_PATTERN.test(value.sessionId)
      || (value.seat !== 1 && value.seat !== 2)
      || typeof value.reconnectToken !== "string" || !ID_PATTERN.test(value.reconnectToken)
    ) return { ok: false, code: "invalid-message" };
    return {
      ok: true,
      message: {
        type: "match.ready",
        matchId: value.matchId,
        sessionId: value.sessionId,
        seat: value.seat,
        reconnectToken: value.reconnectToken,
      },
    };
  }

  if (value.type === "peer.status") {
    if (
      !hasExactKeys(value, ["type", "seat", "state", "deadlineMs"])
      || (value.seat !== 1 && value.seat !== 2)
      || !["connecting", "connected", "reconnecting", "forfeited"].includes(String(value.state))
      || (value.deadlineMs !== null && !isSafeTimestamp(value.deadlineMs))
    ) return { ok: false, code: "invalid-message" };
    return {
      ok: true,
      message: {
        type: "peer.status",
        seat: value.seat,
        state: value.state as "connecting" | "connected" | "reconnecting" | "forfeited",
        deadlineMs: value.deadlineMs as number | null,
      },
    };
  }

  if (value.type === "match.ended") {
    if (
      !hasExactKeys(value, ["type", "reason", "winnerSeat"])
      || !["completed", "forfeit", "server-overload", "peer-timeout"].includes(String(value.reason))
      || (value.winnerSeat !== null && value.winnerSeat !== 1 && value.winnerSeat !== 2)
    ) return { ok: false, code: "invalid-message" };
    return {
      ok: true,
      message: {
        type: "match.ended",
        reason: value.reason as "completed" | "forfeit" | "server-overload" | "peer-timeout",
        winnerSeat: value.winnerSeat as 1 | 2 | null,
      },
    };
  }

  if (value.type === "error") {
    if (
      !hasExactKeys(value, ["type", "code", "retryable"])
      || typeof value.code !== "string"
      || !CONTROL_ERROR_CODES.has(value.code as ControlErrorCode)
      || typeof value.retryable !== "boolean"
    ) return { ok: false, code: "invalid-message" };
    return {
      ok: true,
      message: {
        type: "error",
        code: value.code as ControlErrorCode,
        retryable: value.retryable,
      },
    };
  }

  return { ok: false, code: "invalid-message" };
}

function toBytes(data: string | ArrayBuffer | Uint8Array): Uint8Array {
  if (typeof data === "string") return new TextEncoder().encode(data);
  if (data instanceof Uint8Array) return data;
  return new Uint8Array(data);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function isSafeTimestamp(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}
