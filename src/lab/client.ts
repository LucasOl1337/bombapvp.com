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
  durationMs: number;
}>;

export type LabDecisionRequest = Readonly<{
  model: string;
  observation: unknown;
}>;

export interface LabClient {
  listProfiles(signal?: AbortSignal): Promise<LabModelProfile[]>;
  decide(request: LabDecisionRequest, signal?: AbortSignal): Promise<LabDecision>;
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
    || typeof candidate.durationMs !== "number"
  ) return null;
  return {
    direction: candidate.direction ?? null,
    placeBomb: candidate.placeBomb,
    detonate: candidate.detonate,
    useSkill: candidate.useSkill,
    durationMs: Math.max(250, Math.min(1200, candidate.durationMs)),
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

export function createLabClient(fetchImpl: typeof fetch = fetch): LabClient {
  return {
    async listProfiles(signal) {
      const data = await readJson(await fetchImpl("/api/lab/models", signal ? { signal } : undefined));
      if (!Array.isArray(data.profiles)) throw new Error("invalid_lab_profiles");
      return data.profiles.map(asProfile).filter((profile): profile is LabModelProfile => profile !== null);
    },

    async decide(request, signal) {
      const data = await readJson(await fetchImpl("/api/lab/decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
        ...(signal ? { signal } : {}),
      }));
      const decision = asDecision(data.decision);
      if (!decision) throw new Error("invalid_lab_decision");
      return decision;
    },
  };
}
