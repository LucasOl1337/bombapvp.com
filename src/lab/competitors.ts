import type { PlayerId } from "../original-game/Gameplay/types";
import {
  getLocalBotMetadataById,
  getLocalBotMetadataByModel,
  type LocalBotId,
} from "../original-game/Engine/bot-catalog";
import { resolveLaunchRequest } from "../matches/launch-request";
import type { LabLaunchRequest } from "../matches/launch-request";
import {
  launchRequestFromSearchParams,
  launchRequestToSearchParams,
} from "../matches/url-search-params";

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

export function createLabMatchParams(
  models: readonly string[],
  labels: readonly string[] = [],
): URLSearchParams | null {
  const result = resolveLaunchRequest({ mode: "lab", models, labels });
  return result.ok ? launchRequestToSearchParams(result.request) : null;
}

export function parseLabMatchCompetitors(params: URLSearchParams): readonly LabMatchCompetitor[] {
  const result = launchRequestFromSearchParams(params, "lab");
  if (!result.ok) throw new Error(result.error);
  if (result.request.mode !== "lab") throw new Error("lab_competitors_missing");

  return createLabMatchCompetitors(result.request);
}

export function createLabMatchCompetitors(request: LabLaunchRequest): readonly LabMatchCompetitor[] {
  return request.competitors.map(({ model, label }, index) => {
    const bot = getLocalBotMetadataByModel(model);
    return {
      playerId: (index + 1) as PlayerId,
      model,
      kind: bot?.id ?? "llm",
      label: bot?.label ?? label ?? model,
    };
  });
}
