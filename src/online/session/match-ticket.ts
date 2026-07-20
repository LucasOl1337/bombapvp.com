import {
  CHAMPION_MEMBERSHIP,
  type CharacterId,
} from "../../../Champions/membership";
import { ONLINE_CONTENT_REVISION } from "../content-revision";
import {
  ONLINE_MODE_ID,
  ONLINE_PROTOCOL_VERSION,
} from "../protocol/contracts";
import type { PlacementHint } from "../protocol/control-messages";

export const MATCH_TICKET_LIFETIME_MS = 30_000;
export const MAX_MATCH_TICKET_BYTES = 1_536;

export type MatchTicketPayload = Readonly<{
  version: 1;
  matchId: string;
  simulationSeed: string;
  sessionId: string;
  seat: 1 | 2;
  characterId: CharacterId;
  peerCharacterId: CharacterId;
  placement: PlacementHint;
  issuedAtMs: number;
  expiresAtMs: number;
  nonce: string;
  protocolVersion: typeof ONLINE_PROTOCOL_VERSION;
  modeId: typeof ONLINE_MODE_ID;
  contentRevision: typeof ONLINE_CONTENT_REVISION;
}>;

export type MatchTicketVerifyResult =
  | Readonly<{ ok: true; payload: MatchTicketPayload }>
  | Readonly<{ ok: false; code: "invalid-ticket" | "expired-ticket" }>;

const CHARACTER_IDS = new Set<CharacterId>(
  Object.values(CHAMPION_MEMBERSHIP).map(({ characterId }) => characterId),
);
const ID_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;
const PLACEMENTS = new Set<PlacementHint>([
  "wnam", "enam", "sam", "weur", "eeur", "apac", "oc", "afr", "me",
]);

export async function signMatchTicket(
  payload: MatchTicketPayload,
  secret: string,
): Promise<string> {
  assertSecret(secret);
  if (!isMatchTicketPayload(payload)) throw new RangeError("invalid match ticket payload");
  const body = new TextEncoder().encode(canonicalTicketJson(payload));
  const signature = await crypto.subtle.sign("HMAC", await importSecret(secret), body);
  const token = `${base64UrlEncode(body)}.${base64UrlEncode(new Uint8Array(signature))}`;
  if (new TextEncoder().encode(token).byteLength > MAX_MATCH_TICKET_BYTES) {
    throw new RangeError("match ticket exceeds byte budget");
  }
  return token;
}

export async function verifyMatchTicket(
  token: string,
  secret: string,
  nowMs = Date.now(),
): Promise<MatchTicketVerifyResult> {
  try {
    assertSecret(secret);
    if (new TextEncoder().encode(token).byteLength > MAX_MATCH_TICKET_BYTES) {
      return { ok: false, code: "invalid-ticket" };
    }
    const parts = token.split(".");
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      return { ok: false, code: "invalid-ticket" };
    }
    const body = base64UrlDecode(parts[0]);
    const signature = base64UrlDecode(parts[1]);
    const valid = await crypto.subtle.verify(
      "HMAC",
      await importSecret(secret),
      ownedArrayBuffer(signature),
      ownedArrayBuffer(body),
    );
    if (!valid) return { ok: false, code: "invalid-ticket" };
    const value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body)) as unknown;
    if (!isMatchTicketPayload(value) || canonicalTicketJson(value) !== new TextDecoder().decode(body)) {
      return { ok: false, code: "invalid-ticket" };
    }
    if (value.expiresAtMs < nowMs || value.issuedAtMs > nowMs + 5_000) {
      return { ok: false, code: "expired-ticket" };
    }
    return { ok: true, payload: value };
  } catch {
    return { ok: false, code: "invalid-ticket" };
  }
}

export function createMatchTicketPayload(input: Readonly<{
  matchId: string;
  simulationSeed: string;
  sessionId: string;
  seat: 1 | 2;
  characterId: CharacterId;
  peerCharacterId: CharacterId;
  placement: PlacementHint;
  issuedAtMs: number;
  nonce: string;
}>): MatchTicketPayload {
  return {
    version: 1,
    matchId: input.matchId,
    simulationSeed: input.simulationSeed,
    sessionId: input.sessionId,
    seat: input.seat,
    characterId: input.characterId,
    peerCharacterId: input.peerCharacterId,
    placement: input.placement,
    issuedAtMs: input.issuedAtMs,
    expiresAtMs: input.issuedAtMs + MATCH_TICKET_LIFETIME_MS,
    nonce: input.nonce,
    protocolVersion: ONLINE_PROTOCOL_VERSION,
    modeId: ONLINE_MODE_ID,
    contentRevision: ONLINE_CONTENT_REVISION,
  };
}

export function matchTicketPayloadsEqual(
  first: MatchTicketPayload,
  second: MatchTicketPayload,
): boolean {
  return canonicalTicketJson(first) === canonicalTicketJson(second);
}

export function randomOnlineId(byteLength = 18): string {
  if (!Number.isInteger(byteLength) || byteLength < 12 || byteLength > 48) {
    throw new RangeError("online id entropy must be between 12 and 48 bytes");
  }
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

function canonicalTicketJson(payload: MatchTicketPayload): string {
  return JSON.stringify({
    version: payload.version,
    matchId: payload.matchId,
    simulationSeed: payload.simulationSeed,
    sessionId: payload.sessionId,
    seat: payload.seat,
    characterId: payload.characterId,
    peerCharacterId: payload.peerCharacterId,
    placement: payload.placement,
    issuedAtMs: payload.issuedAtMs,
    expiresAtMs: payload.expiresAtMs,
    nonce: payload.nonce,
    protocolVersion: payload.protocolVersion,
    modeId: payload.modeId,
    contentRevision: payload.contentRevision,
  });
}

function isMatchTicketPayload(value: unknown): value is MatchTicketPayload {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const ticket = value as Record<string, unknown>;
  return Object.keys(ticket).length === 14
    && ticket.version === 1
    && typeof ticket.matchId === "string" && ID_PATTERN.test(ticket.matchId)
    && typeof ticket.simulationSeed === "string" && ID_PATTERN.test(ticket.simulationSeed)
    && typeof ticket.sessionId === "string" && ID_PATTERN.test(ticket.sessionId)
    && (ticket.seat === 1 || ticket.seat === 2)
    && typeof ticket.characterId === "string" && CHARACTER_IDS.has(ticket.characterId as CharacterId)
    && typeof ticket.peerCharacterId === "string" && CHARACTER_IDS.has(ticket.peerCharacterId as CharacterId)
    && typeof ticket.placement === "string" && PLACEMENTS.has(ticket.placement as PlacementHint)
    && isSafeTimestamp(ticket.issuedAtMs)
    && isSafeTimestamp(ticket.expiresAtMs)
    && (ticket.expiresAtMs as number) - (ticket.issuedAtMs as number) === MATCH_TICKET_LIFETIME_MS
    && typeof ticket.nonce === "string" && ID_PATTERN.test(ticket.nonce)
    && ticket.protocolVersion === ONLINE_PROTOCOL_VERSION
    && ticket.modeId === ONLINE_MODE_ID
    && ticket.contentRevision === ONLINE_CONTENT_REVISION;
}

function isSafeTimestamp(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

async function importSecret(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function assertSecret(secret: string): void {
  if (new TextEncoder().encode(secret).byteLength < 32) {
    throw new RangeError("match ticket secret must contain at least 32 bytes");
  }
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/u, "");
}

function base64UrlDecode(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/u.test(value)) throw new Error("invalid base64url");
  const padded = value.replace(/-/g, "+").replace(/_/g, "/")
    + "=".repeat((4 - value.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function ownedArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}
