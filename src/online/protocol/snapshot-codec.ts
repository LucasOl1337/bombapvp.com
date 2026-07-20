import type { OnlineGameSnapshot } from "../../original-game/NetCode/protocol";
import type { MatchStateCodec } from "../runtime/simulation-kernel";

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });

// Tokens are global and intentionally impossible to confuse with normal game
// property names. Unknown future keys survive unchanged for forward debugging.
const SNAPSHOT_KEYS = [
  "serverTimeMs", "serverTick", "frameId", "ackedInputSeq", "mode", "roomMode",
  "arena", "breakableTiles", "powerUps", "players", "bombs", "flames", "magicBeams",
  "nextBombId", "score", "roundNumber", "roundTimeMs", "paused", "roundOutcome",
  "matchWinner", "animationClockMs", "suddenDeathActive", "suddenDeathTickMs",
  "suddenDeathIndex", "suddenDeathClosedTiles", "suddenDeathClosingTiles",
  "showDangerOverlay", "showBombPreview", "selectedCharacterIndex", "activePlayerIds",
  "botPlayerIds", "endlessStats", "id", "name", "status", "themeId", "grid", "tiles",
  "solid", "breakable", "spawns", "version", "createdAt", "updatedAt", "randomSeed",
  "wrapPortals", "suddenDeathPath", "spawnMap", "width", "height", "playerId", "tile",
  "direction", "type", "revealed", "collected", "active", "position", "velocity", "alive",
  "lastMoveDirection", "maxBombs", "activeBombs", "flameRange", "speedLevel", "remoteLevel",
  "shieldCharges", "bombPassLevel", "kickLevel", "shortFuseLevel", "flameGuardMs",
  "spawnProtectionMs", "perfectStartWindowMs", "perfectStartBoostMs", "breakawayBoostMs",
  "pickupSprintMs", "skill", "phase", "channelRemainingMs", "cooldownRemainingMs",
  "castElapsedMs", "projectedPosition", "projectedLastMoveDirection",
  "projectedBombEgressIds", "ownerId", "fuseMs", "ownerCanPass", "bodyEgressPlayerIds",
  "remainingMs", "style", "origin", "ownerCanPass", "elapsedMs", "impacted", "winner",
  "reason", "message", "countdownMs", "kills", "roundWins", "deaths", "selfDeaths",
  "opponentDeaths", "suddenDeathDeaths", "environmentDeaths", "x", "y",
] as const;

const ENCODED_KEY = new Map<string, string>(
  SNAPSHOT_KEYS.map((key, index) => [key, `~${index.toString(36)}`]),
);
const DECODED_KEY = new Map<string, string>(
  [...ENCODED_KEY].map(([key, token]) => [token, key]),
);
const DELETION_MARKER = Object.freeze({ "~delete": 1 });
const ARRAY_PATCH_ITEMS = "~array";
const ARRAY_PATCH_LENGTH = "~length";

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
type JsonObject = { [key: string]: JsonValue };

export type SnapshotDecodeResult =
  | Readonly<{ ok: true; snapshot: OnlineGameSnapshot }>
  | Readonly<{ ok: false; code: "invalid-json" | "invalid-root" | "invalid-patch" }>;

export class OnlineSnapshotCodec implements MatchStateCodec<OnlineGameSnapshot> {
  encodeKeyframe(snapshot: OnlineGameSnapshot): Uint8Array {
    return encoder.encode(JSON.stringify(compact(snapshot)));
  }

  encodeDelta(baseline: OnlineGameSnapshot, current: OnlineGameSnapshot): Uint8Array {
    const patch = createPatch(compact(baseline), compact(current));
    return encoder.encode(JSON.stringify(patch ?? {}));
  }

  decodeKeyframe(payload: Uint8Array): SnapshotDecodeResult {
    const value = parsePayload(payload);
    if (!value) return { ok: false, code: "invalid-json" };
    if (!isPlainObject(value)) return { ok: false, code: "invalid-root" };
    const expanded = expand(value);
    return isPlainObject(expanded)
      ? { ok: true, snapshot: expanded as unknown as OnlineGameSnapshot }
      : { ok: false, code: "invalid-root" };
  }

  applyDelta(baseline: OnlineGameSnapshot, payload: Uint8Array): SnapshotDecodeResult {
    const patch = parsePayload(payload);
    if (!patch) return { ok: false, code: "invalid-json" };
    if (!isPlainObject(patch) || isDeletionMarker(patch)) {
      return { ok: false, code: "invalid-patch" };
    }
    const next = applyPatch(compact(baseline), patch);
    if (!isPlainObject(next)) return { ok: false, code: "invalid-patch" };
    const expanded = expand(next);
    return isPlainObject(expanded)
      ? { ok: true, snapshot: expanded as unknown as OnlineGameSnapshot }
      : { ok: false, code: "invalid-patch" };
  }
}

function compact(value: unknown): JsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return normalizeNumber(value);
  if (Array.isArray(value)) return value.map(compact);
  if (typeof value !== "object") return null;

  const result: JsonObject = {};
  for (const [key, child] of Object.entries(value)) {
    if (child === undefined) continue;
    result[ENCODED_KEY.get(key) ?? key] = compact(child);
  }
  return result;
}

function expand(value: JsonValue): JsonValue {
  if (Array.isArray(value)) return value.map(expand);
  if (!isPlainObject(value)) return value;
  const result: JsonObject = {};
  for (const [key, child] of Object.entries(value)) {
    result[DECODED_KEY.get(key) ?? key] = expand(child);
  }
  return result;
}

function createPatch(previous: JsonValue, current: JsonValue): JsonValue | undefined {
  if (Object.is(previous, current)) return undefined;
  if (Array.isArray(previous) && Array.isArray(current)) {
    if (deepEqual(previous, current)) return undefined;
    const items: JsonObject = {};
    for (let index = 0; index < current.length; index += 1) {
      const childPatch = index < previous.length
        ? createPatch(previous[index] ?? null, current[index] ?? null)
        : cloneJson(current[index] ?? null);
      if (childPatch !== undefined) items[String(index)] = childPatch;
    }
    const indexedPatch: JsonObject = {
      [ARRAY_PATCH_ITEMS]: items,
      [ARRAY_PATCH_LENGTH]: current.length,
    };
    return JSON.stringify(indexedPatch).length < JSON.stringify(current).length
      ? indexedPatch
      : current;
  }
  if (Array.isArray(previous) || Array.isArray(current)) return current;
  if (!isPlainObject(previous) || !isPlainObject(current)) return current;

  const patch: JsonObject = {};
  let changed = false;
  for (const key of new Set([...Object.keys(previous), ...Object.keys(current)])) {
    if (!(key in current)) {
      patch[key] = DELETION_MARKER;
      changed = true;
      continue;
    }
    const childPatch = createPatch(previous[key] ?? null, current[key] ?? null);
    if (childPatch !== undefined) {
      patch[key] = childPatch;
      changed = true;
    }
  }
  return changed ? patch : undefined;
}

function applyPatch(previous: JsonValue, patch: JsonValue): JsonValue {
  if (Array.isArray(previous) && isArrayPatch(patch)) {
    const next = previous.map(cloneJson);
    const length = patch[ARRAY_PATCH_LENGTH];
    const items = patch[ARRAY_PATCH_ITEMS];
    if (typeof length !== "number" || !Number.isInteger(length) || length < 0 || !isPlainObject(items)) {
      return cloneJson(patch);
    }
    next.length = length;
    for (const [rawIndex, childPatch] of Object.entries(items)) {
      const index = Number.parseInt(rawIndex, 10);
      if (!Number.isInteger(index) || index < 0 || index >= length) continue;
      next[index] = index < previous.length
        ? applyPatch(previous[index] ?? null, childPatch)
        : cloneJson(childPatch);
    }
    return next;
  }
  if (!isPlainObject(patch) || !isPlainObject(previous)) return cloneJson(patch);
  const next: JsonObject = { ...previous };
  for (const [key, childPatch] of Object.entries(patch)) {
    if (isDeletionMarker(childPatch)) {
      delete next[key];
      continue;
    }
    next[key] = key in previous
      ? applyPatch(previous[key] ?? null, childPatch)
      : cloneJson(childPatch);
  }
  return next;
}

function parsePayload(payload: Uint8Array): JsonValue | null {
  try {
    return JSON.parse(decoder.decode(payload)) as JsonValue;
  } catch {
    return null;
  }
}

function normalizeNumber(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (Number.isInteger(value)) return value;
  return Math.round(value * 1_000) / 1_000;
}

function isPlainObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isDeletionMarker(value: JsonValue): boolean {
  return isPlainObject(value)
    && Object.keys(value).length === 1
    && value["~delete"] === 1;
}

function isArrayPatch(value: JsonValue): value is JsonObject {
  return isPlainObject(value)
    && ARRAY_PATCH_ITEMS in value
    && ARRAY_PATCH_LENGTH in value;
}

function deepEqual(left: JsonValue, right: JsonValue): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function cloneJson(value: JsonValue): JsonValue {
  if (Array.isArray(value)) return value.map(cloneJson);
  if (!isPlainObject(value)) return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, cloneJson(child)]));
}
