import type { PlayerId } from "../original-game/Gameplay/types.ts";

export const LAB_V1_MODEL = "bot-v1";
export const LAB_MIN_COMPETITORS = 2;
export const LAB_MAX_COMPETITORS = 4;

export type LabMatchCompetitor = Readonly<{
  playerId: PlayerId;
  model: string;
  kind: "v1" | "llm";
  label: string;
}>;

function normalizeLabel(label: string | null): string {
  return (label ?? "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 48);
}

export function createLabMatchParams(
  models: readonly string[],
  labels: readonly string[] = [],
): URLSearchParams | null {
  const normalizedModels = models.map((model) => model.trim());
  if (
    normalizedModels.length < LAB_MIN_COMPETITORS
    || normalizedModels.length > LAB_MAX_COMPETITORS
    || normalizedModels.some((model) => !model)
  ) return null;

  const params = new URLSearchParams({ mode: "lab" });
  normalizedModels.forEach((model, index) => {
    params.set(`model${index + 1}`, model);
    const label = normalizeLabel(labels[index] ?? null);
    if (model !== LAB_V1_MODEL && label) params.set(`label${index + 1}`, label);
  });
  return params;
}

export function parseLabMatchCompetitors(params: URLSearchParams): readonly LabMatchCompetitor[] {
  const models = Array.from({ length: LAB_MAX_COMPETITORS }, (_, index) => (
    params.get(`model${index + 1}`)?.trim() ?? ""
  ));

  if (models.slice(0, LAB_MIN_COMPETITORS).some((model) => !model)) {
    throw new Error("lab_competitors_missing");
  }

  const firstGap = models.findIndex((model) => !model);
  if (firstGap >= 0 && models.slice(firstGap + 1).some(Boolean)) {
    throw new Error("lab_competitor_gap");
  }

  return models.filter(Boolean).map((model, index) => {
    const selectedLabel = normalizeLabel(params.get(`label${index + 1}`));
    return {
      playerId: (index + 1) as PlayerId,
      model,
      kind: model === LAB_V1_MODEL ? "v1" : "llm",
      label: model === LAB_V1_MODEL ? "V1" : (selectedLabel || model),
    };
  });
}
