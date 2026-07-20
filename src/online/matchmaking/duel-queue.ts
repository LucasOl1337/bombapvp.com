import type { CharacterId } from "../../../Champions/membership";
import type { PlacementHint } from "../protocol/control-messages";

export type PlacementLatencySamples = Readonly<Partial<Record<PlacementHint, number>>>;

export type DuelQueueCandidate = Readonly<{
  connectionId: string;
  clientNonce: string;
  characterId: CharacterId;
  joinedAtMs: number;
  region: PlacementHint;
  latencyMs?: PlacementLatencySamples;
}>;

export type PlacementBasis = "same-region" | "probe-minimax" | "fallback-unmeasured";

export type DuelMatchPair = Readonly<{
  seats: Readonly<Record<1 | 2, DuelQueueCandidate>>;
  placement: PlacementHint;
  placementBasis: PlacementBasis;
}>;

export type EnqueueResult =
  | Readonly<{ ok: false; code: "already-queued" | "invalid-candidate" }>
  | Readonly<{ ok: true; pair: DuelMatchPair | null }>;

const PLACEMENTS: readonly PlacementHint[] = [
  "wnam", "enam", "sam", "weur", "eeur", "apac", "oc", "afr", "me",
];

export class DuelMatchQueue {
  private readonly waiting: DuelQueueCandidate[] = [];
  private readonly byConnection = new Map<string, DuelQueueCandidate>();

  get size(): number {
    return this.waiting.length;
  }

  enqueue(candidate: DuelQueueCandidate): EnqueueResult {
    if (!isValidCandidate(candidate)) return { ok: false, code: "invalid-candidate" };
    if (this.byConnection.has(candidate.connectionId)) {
      return { ok: false, code: "already-queued" };
    }
    const opponentIndex = this.waiting.findIndex((waiting) => (
      waiting.clientNonce !== candidate.clientNonce
    ));
    if (opponentIndex < 0) {
      this.waiting.push(candidate);
      this.byConnection.set(candidate.connectionId, candidate);
      return { ok: true, pair: null };
    }

    const opponent = this.waiting.splice(opponentIndex, 1)[0]!;
    this.byConnection.delete(opponent.connectionId);
    return { ok: true, pair: createPair(opponent, candidate) };
  }

  remove(connectionId: string): boolean {
    const candidate = this.byConnection.get(connectionId);
    if (!candidate) return false;
    this.byConnection.delete(connectionId);
    const index = this.waiting.indexOf(candidate);
    if (index >= 0) this.waiting.splice(index, 1);
    return true;
  }

  snapshot(): readonly DuelQueueCandidate[] {
    return this.waiting.map((candidate) => ({ ...candidate }));
  }
}

export function selectPlacement(
  first: DuelQueueCandidate,
  second: DuelQueueCandidate,
): Readonly<{ placement: PlacementHint; basis: PlacementBasis }> {
  if (first.region === second.region) {
    return { placement: first.region, basis: "same-region" };
  }

  const measured = PLACEMENTS.flatMap((placement) => {
    const firstLatency = first.latencyMs?.[placement];
    const secondLatency = second.latencyMs?.[placement];
    return isValidLatency(firstLatency) && isValidLatency(secondLatency)
      ? [{
          placement,
          maximum: Math.max(firstLatency, secondLatency),
          spread: Math.abs(firstLatency - secondLatency),
          total: firstLatency + secondLatency,
        }]
      : [];
  }).sort((left, right) => (
    left.maximum - right.maximum
    || left.spread - right.spread
    || left.total - right.total
    || left.placement.localeCompare(right.placement)
  ));
  if (measured[0]) return { placement: measured[0].placement, basis: "probe-minimax" };

  return {
    placement: fallbackPlacement(first.region, second.region),
    basis: "fallback-unmeasured",
  };
}

export function placementFromRequestLocation(input: Readonly<{
  continent?: string | null;
  country?: string | null;
}>): PlacementHint {
  const continent = input.continent?.toUpperCase();
  const country = input.country?.toUpperCase();
  if (continent === "SA") return "sam";
  if (continent === "NA") return country === "US" || country === "CA" ? "enam" : "enam";
  if (continent === "EU") return "weur";
  if (continent === "AS") return ["AE", "BH", "IL", "JO", "KW", "LB", "OM", "QA", "SA", "TR"]
    .includes(country ?? "") ? "me" : "apac";
  if (continent === "OC") return "oc";
  if (continent === "AF") return "afr";
  return "enam";
}

function createPair(first: DuelQueueCandidate, second: DuelQueueCandidate): DuelMatchPair {
  const placement = selectPlacement(first, second);
  const swap = stableHash(`${first.clientNonce}:${second.clientNonce}`) % 2 === 1;
  return {
    seats: swap ? { 1: second, 2: first } : { 1: first, 2: second },
    placement: placement.placement,
    placementBasis: placement.basis,
  };
}

function fallbackPlacement(first: PlacementHint, second: PlacementHint): PlacementHint {
  const pair = new Set([first, second]);
  if (pair.has("sam") && (pair.has("enam") || pair.has("wnam"))) return "enam";
  if (pair.has("enam") && (pair.has("weur") || pair.has("eeur"))) return "enam";
  if (pair.has("weur") && pair.has("eeur")) return "weur";
  if (pair.has("apac") && pair.has("oc")) return "apac";
  if (pair.has("afr") && (pair.has("weur") || pair.has("me"))) return "weur";
  if (pair.has("me") && (pair.has("weur") || pair.has("eeur") || pair.has("apac"))) return "me";
  return "enam";
}

function isValidCandidate(candidate: DuelQueueCandidate): boolean {
  return candidate.connectionId.length > 0
    && candidate.clientNonce.length >= 16
    && candidate.characterId.length > 0
    && Number.isSafeInteger(candidate.joinedAtMs)
    && candidate.joinedAtMs >= 0
    && PLACEMENTS.includes(candidate.region)
    && Object.values(candidate.latencyMs ?? {}).every(isValidLatency);
}

function isValidLatency(value: number | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 2_000;
}

function stableHash(value: string): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}
