import { monotonicNow } from "../shared/monotonic-time";

export type LabModelProfile = Readonly<{
  id: string;
  label: string;
  route: string;
}>;

export type LabDecision = Readonly<{
  direction: "up" | "down" | "left" | "right" | null;
  placeBomb: boolean;
  detonate: boolean;
  useSkill: boolean;
}>;

export type LabDecisionRequest = Readonly<{
  model: string;
  observation: unknown;
  /**
   * Correlation identifier created by the caller. It is optional only while
   * the legacy controller is being migrated; createLabClient always supplies
   * one on the wire.
   */
  requestId?: string;
}>;

export type LabTokenUsage = Readonly<{
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}>;

export type LabDecisionResult = Readonly<{
  decision: LabDecision;
  roundTripMs: number;
  upstreamLatencyMs: number | null;
  usage: LabTokenUsage | null;
  /** Echoed by the broker, matching the request correlation identifier. */
  requestId: string;
}>;

export type LabPublicErrorDetails = Readonly<{
  status: number;
  code: string;
  requestId: string;
  retryAfterMs: number | null;
}>;

/** A transport-safe error surface for the Lab broker. */
export class LabPublicError extends Error implements LabPublicErrorDetails {
  public readonly status: number;
  public readonly code: string;
  public readonly requestId: string;
  public readonly retryAfterMs: number | null;

  constructor(details: LabPublicErrorDetails) {
    super(details.code);
    this.name = "LabPublicError";
    this.status = details.status;
    this.code = details.code;
    this.requestId = details.requestId;
    this.retryAfterMs = details.retryAfterMs;
  }
}

export interface LabProfileSource {
  listProfiles(signal?: AbortSignal): Promise<LabModelProfile[]>;
}

export interface LabDecider {
  decide(request: LabDecisionRequest, signal?: AbortSignal): Promise<LabDecisionResult>;
}

export interface LabClient extends LabProfileSource, LabDecider {}

let nextLabRequestSequence = 0;

/**
 * Opaque correlation ids are deliberately not derived from player, model or
 * observation data, so they can be safely logged by every transport hop.
 */
export function createLabRequestId(): string {
  nextLabRequestSequence += 1;
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `lab-${crypto.randomUUID()}`;
  }
  return `lab-${Date.now().toString(36)}-${nextLabRequestSequence.toString(36)}`;
}

function asProfile(value: unknown): LabModelProfile | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<LabModelProfile>;
  if (!candidate.id || !candidate.label || !candidate.route) return null;
  return { id: candidate.id, label: candidate.label, route: candidate.route };
}

function asDecision(value: unknown): LabDecision | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<LabDecision>;
  const directions = ["up", "down", "left", "right", null];
  if (!directions.includes(candidate.direction ?? null)) return null;
  if (
    typeof candidate.placeBomb !== "boolean"
    || typeof candidate.detonate !== "boolean"
    || typeof candidate.useSkill !== "boolean"
  ) return null;
  return {
    direction: candidate.direction ?? null,
    placeBomb: candidate.placeBomb,
    detonate: candidate.detonate,
    useSkill: candidate.useSkill,
  };
}

function asUsage(value: unknown): LabTokenUsage | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<LabTokenUsage>;
  if (
    typeof candidate.inputTokens !== "number"
    || typeof candidate.outputTokens !== "number"
    || typeof candidate.totalTokens !== "number"
  ) return null;
  return {
    inputTokens: Math.max(0, candidate.inputTokens),
    outputTokens: Math.max(0, candidate.outputTokens),
    totalTokens: Math.max(0, candidate.totalTokens),
  };
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  const data = await response.json() as unknown;
  if (!data || typeof data !== "object") throw new Error("invalid_lab_response");
  if (!response.ok || (data as { ok?: boolean }).ok !== true) {
    throw new Error(String((data as { error?: unknown }).error ?? `lab_http_${response.status}`));
  }
  return data as Record<string, unknown>;
}

function retryAfterMs(response: Response, data: Record<string, unknown>): number | null {
  if (typeof data.retryAfterMs === "number" && Number.isFinite(data.retryAfterMs)) {
    return Math.max(0, Math.round(data.retryAfterMs));
  }
  const header = response.headers.get("Retry-After");
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, Math.round(seconds * 1_000));
  const dateMs = Date.parse(header);
  return Number.isFinite(dateMs) ? Math.max(0, dateMs - Date.now()) : null;
}

function errorCode(data: Record<string, unknown>, status: number): string {
  const error = data.error;
  if (error && typeof error === "object" && typeof (error as { code?: unknown }).code === "string") {
    return (error as { code: string }).code;
  }
  if (typeof data.code === "string") return data.code;
  if (typeof error === "string") return error;
  return `lab_http_${status}`;
}

async function readDecisionResponse(
  response: Response,
  requestId: string,
): Promise<Record<string, unknown>> {
  let data: Record<string, unknown>;
  try {
    const value = await response.json() as unknown;
    data = value && typeof value === "object" ? value as Record<string, unknown> : {};
  } catch {
    throw new LabPublicError({
      status: response.status,
      code: "invalid_lab_response",
      requestId,
      retryAfterMs: retryAfterMs(response, {}),
    });
  }
  const echoedRequestId = typeof data.requestId === "string" ? data.requestId : null;
  if (echoedRequestId !== requestId) {
    throw new LabPublicError({
      status: response.status,
      code: "lab_request_id_mismatch",
      requestId,
      retryAfterMs: retryAfterMs(response, data),
    });
  }
  if (!response.ok || data.ok !== true) {
    throw new LabPublicError({
      status: response.status,
      code: errorCode(data, response.status),
      requestId,
      retryAfterMs: retryAfterMs(response, data),
    });
  }
  return data;
}

export function createLabClient(
  fetchImpl: typeof fetch = fetch,
  now: () => number = monotonicNow,
): LabClient {
  return {
    async listProfiles(signal) {
      const data = await readJson(await fetchImpl("/api/lab/models", signal ? { signal } : undefined));
      if (!Array.isArray(data.profiles)) throw new Error("invalid_lab_profiles");
      return data.profiles.map(asProfile).filter((profile): profile is LabModelProfile => profile !== null);
    },

    async decide(request, signal) {
      const startedAtMs = now();
      const requestId = request.requestId ?? createLabRequestId();
      let response: Response;
      try {
        response = await fetchImpl("/api/lab/decision", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...request, requestId }),
          ...(signal ? { signal } : {}),
        });
      } catch {
        throw new LabPublicError({
          status: 0,
          code: "lab_network_error",
          requestId,
          retryAfterMs: null,
        });
      }
      const data = await readDecisionResponse(response, requestId);
      const decision = asDecision(data.decision);
      if (!decision) {
        throw new LabPublicError({
          status: response.status,
          code: "invalid_lab_decision",
          requestId,
          retryAfterMs: null,
        });
      }
      return {
        decision,
        roundTripMs: Math.max(0, now() - startedAtMs),
        upstreamLatencyMs: typeof data.latencyMs === "number" ? Math.max(0, data.latencyMs) : null,
        usage: asUsage(data.usage),
        requestId,
      };
    },
  };
}
