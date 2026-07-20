import {
  resolveLaunchRequest,
  serializeLaunchRequest,
  type LaunchRequest,
  type LaunchRequestResult,
} from "./launch-request";

function launchModeFromSearchParams(params: URLSearchParams): LaunchRequest["mode"] {
  if (params.get("mode") === "online") return "online";
  if (params.get("mode") === "continuous") return "continuous";
  if (params.get("mode") === "lab") return "lab";
  return "training";
}

export function launchRequestFromSearchParams(
  params: URLSearchParams,
  mode: LaunchRequest["mode"] = launchModeFromSearchParams(params),
): LaunchRequestResult {
  if (mode === "lab") {
    const models = Array.from({ length: 4 }, (_, index) => (
      params.get(`model${index + 1}`)?.trim() ?? ""
    ));
    if (models.slice(0, 2).some((model) => !model)) {
      return { ok: false, error: "lab_competitors_missing" };
    }

    const firstGap = models.findIndex((model) => !model);
    if (firstGap >= 0 && models.slice(firstGap + 1).some(Boolean)) {
      return { ok: false, error: "lab_competitor_gap" };
    }

    const competitorCount = firstGap < 0 ? models.length : firstGap;
    return resolveLaunchRequest({
      mode: "lab",
      models: models.slice(0, competitorCount),
      labels: Array.from({ length: competitorCount }, (_, index) => (
        params.get(`label${index + 1}`) ?? ""
      )),
    });
  }

  if (mode === "online") {
    return resolveLaunchRequest({
      mode: "online",
      character: params.get("character"),
    });
  }

  return resolveLaunchRequest({
    mode,
    character: params.get("character"),
    bot: params.get("bot"),
  });
}

export function launchRequestToSearchParams(request: LaunchRequest): URLSearchParams {
  return new URLSearchParams(Array.from(serializeLaunchRequest(request)));
}
