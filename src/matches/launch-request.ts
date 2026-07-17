import {
  DEFAULT_CONTINUOUS_BOT_ID,
  DEFAULT_TRAINING_BOT_ID,
  getLocalBotMetadataById,
  getLocalBotMetadataByModel,
  type LocalBotId,
} from "../original-game/Engine/bot-catalog";

export type OfflineLaunchMode = "training" | "continuous";

export type OfflineLaunchRequest = Readonly<{
  mode: OfflineLaunchMode;
  character: string | null;
  bot: LocalBotId;
  botSelection: "explicit" | "default";
}>;

export type LabLaunchCompetitor = Readonly<{
  model: string;
  label?: string;
}>;

export type LabLaunchRequest = Readonly<{
  mode: "lab";
  competitors: readonly LabLaunchCompetitor[];
}>;

export type LaunchRequest = OfflineLaunchRequest | LabLaunchRequest;

export type LaunchRequestCandidate =
  | Readonly<{
      mode: OfflineLaunchMode;
      character: string | null;
      bot?: string | null;
    }>
  | Readonly<{
      mode: "lab";
      models: readonly string[];
      labels?: readonly string[];
    }>;

export type LaunchRequestError =
  | "lab_competitors_invalid"
  | "lab_competitors_missing"
  | "lab_competitor_gap";

export type LaunchRequestResult =
  | Readonly<{ ok: true; request: LaunchRequest }>
  | Readonly<{ ok: false; error: LaunchRequestError }>;

export const OFFLINE_LAUNCH_DEFAULTS: Readonly<Record<OfflineLaunchMode, LocalBotId>> =
  Object.freeze({
    training: DEFAULT_TRAINING_BOT_ID,
    continuous: DEFAULT_CONTINUOUS_BOT_ID,
  });

function normalizeLabLabel(label: string | null | undefined): string {
  return (label ?? "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 48);
}

export function resolveLaunchRequest(candidate: LaunchRequestCandidate): LaunchRequestResult {
  if (candidate.mode === "lab") {
    const models = candidate.models.map((model) => model.trim());
    if (models.length < 2 || models.length > 4 || models.some((model) => !model)) {
      return { ok: false, error: "lab_competitors_invalid" };
    }

    return {
      ok: true,
      request: {
        mode: "lab",
        competitors: models.map((model, index) => {
          const label = normalizeLabLabel(candidate.labels?.[index]);
          if (getLocalBotMetadataByModel(model) || !label) return { model };
          return { model, label };
        }),
      },
    };
  }

  const requestedBot = getLocalBotMetadataById(candidate.bot);
  return {
    ok: true,
    request: {
      mode: candidate.mode,
      character: candidate.character,
      bot: requestedBot?.id ?? OFFLINE_LAUNCH_DEFAULTS[candidate.mode],
      botSelection: requestedBot ? "explicit" : "default",
    },
  };
}

export function serializeLaunchRequest(request: LaunchRequest): readonly [string, string][] {
  if (request.mode === "lab") {
    return [
      ["mode", "lab"],
      ...request.competitors.flatMap((competitor, index): [string, string][] => {
        const slot = index + 1;
        return competitor.label
          ? [[`model${slot}`, competitor.model], [`label${slot}`, competitor.label]]
          : [[`model${slot}`, competitor.model]];
      }),
    ];
  }

  return [
    ["mode", request.mode],
    ...(request.character === null ? [] : [["character", request.character] as [string, string]]),
    ...(request.botSelection === "explicit" ? [["bot", request.bot] as [string, string]] : []),
  ];
}
