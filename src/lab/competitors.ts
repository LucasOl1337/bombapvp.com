import type { PlayerId } from "../original-game/Gameplay/types.ts";
import {
  getLocalBotMetadataById,
  getLocalBotMetadataByModel,
  type LocalBotId,
} from "../original-game/Engine/bot-catalog";

function requireLocalBotModel(id: LocalBotId): `bot-${LocalBotId}` {
  const bot = getLocalBotMetadataById(id);
  if (!bot) throw new Error(`local_bot_metadata_missing:${id}`);
  return bot.model;
}

export const LAB_V1_MODEL = requireLocalBotModel("v1");
export const LAB_V2_MODEL = requireLocalBotModel("v2");
export const LAB_V3_MODEL = requireLocalBotModel("v3");
export const LAB_BOMB_MODEL = requireLocalBotModel("bomb");
export const LAB_PINGO_MODEL = requireLocalBotModel("pingo");
export const LAB_MIN_COMPETITORS = 2;
export const LAB_MAX_COMPETITORS = 4;

export type LabMatchCompetitor = Readonly<{
  playerId: PlayerId;
  model: string;
  kind: LocalBotId | "llm";
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
    if (!getLocalBotMetadataByModel(model) && label) params.set(`label${index + 1}`, label);
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
    const bot = getLocalBotMetadataByModel(model);
    return {
      playerId: (index + 1) as PlayerId,
      model,
      kind: bot?.id ?? "llm",
      label: bot?.label ?? (selectedLabel || model),
    };
  });
}
