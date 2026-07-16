import "./original-game.css";
import { loadGameAssets } from "./Engine/assets";
import { GameApp } from "./Engine/game-app";
import { createLabClient } from "../lab/client";
import { startLabController } from "../lab/controller";
import { parseLabMatchCompetitors } from "../lab/competitors";
import { createLabTelemetry, type LabTelemetryReport } from "../lab/telemetry";
import { renderLabTelemetryPanel } from "../lab/telemetry-panel";
import type { PlayerId } from "./Gameplay/types";

declare global {
  interface Window {
    get_lab_telemetry?: () => LabTelemetryReport;
  }
}

const rootElement = document.querySelector<HTMLElement>("#app");

if (!rootElement) throw new Error("Original Bomba PvP game root was not found.");
const root: HTMLElement = rootElement;

const CHARACTER_IDS = [
  "03a976fb-7313-4064-a477-5bb9b0760034",
  "6ee8baa5-3277-413b-ae0e-2659b9cc52e9",
  "d083c3dc-7162-4391-8628-6adde0b8d8d6",
  "5474c45c-2987-43e0-af2c-a6500c836881",
] as const;

async function bootOriginalGame(): Promise<void> {
  const params = new URLSearchParams(window.location.search);
  const selectedCharacterId = params.get("character");
  const selectedCharacterIndex = Math.max(0, CHARACTER_IDS.indexOf(
    selectedCharacterId as (typeof CHARACTER_IDS)[number],
  ));
  const mode = params.get("mode") === "continuous"
    ? "continuous"
    : params.get("mode") === "lab" ? "lab" : "training";
  const hostname = window.location.hostname.replace(/^www\./, "");

  document.documentElement.lang = hostname === "bombpvp.com" ? "en" : "pt-BR";
  const assets = await loadGameAssets();
  root.replaceChildren();
  root.removeAttribute("aria-live");

  const game = new GameApp(root, assets);
  game.setLanguage(hostname === "bombpvp.com" ? "en" : "pt");
  game.setOfflinePreferredCharacter(selectedCharacterIndex);
  game.start();

  if (mode === "lab") {
    const competitors = parseLabMatchCompetitors(params);
    const telemetry = createLabTelemetry(competitors);
    const activePlayerIds = competitors.map(({ playerId }) => playerId);
    const botPlayerIds = competitors
      .filter(({ kind }) => kind === "v1")
      .map(({ playerId }) => playerId);
    const playerLabels: Record<PlayerId, string> = { 1: "", 2: "", 3: "", 4: "" };
    competitors.forEach(({ playerId, label }) => {
      playerLabels[playerId] = label;
    });

    game.startServerAuthoritativeMatch(
      activePlayerIds,
      { 1: 0, 2: 1, 3: 2, 4: 3 },
      {
        roomMode: "endless",
        botPlayerIds,
        playerLabels,
        botDecisionObserver: ({ playerId, decision, computeMs }) => telemetry.record({
          type: "decision",
          playerId,
          decisionMs: computeMs,
          action: decision,
        }),
      },
    );

    const statusPanel = document.createElement("aside");
    statusPanel.className = "lab-live-status";
    statusPanel.setAttribute("aria-label", document.documentElement.lang === "en" ? "Live bot telemetry" : "Telemetria ao vivo dos bots");
    document.body.append(statusPanel);

    const readTelemetry = (): LabTelemetryReport => telemetry.read(game.exportOnlineSnapshot());
    window.get_lab_telemetry = readTelemetry;
    const refreshPanel = (): void => renderLabTelemetryPanel(
      statusPanel,
      readTelemetry(),
      document.documentElement.lang === "en",
    );
    refreshPanel();
    const refreshTimer = window.setInterval(refreshPanel, 500);

    const llmCompetitors = competitors
      .filter(({ kind }) => kind === "llm")
      .map(({ playerId, model }) => ({ playerId, model }));
    const stop = llmCompetitors.length > 0
      ? startLabController(game, createLabClient(), llmCompetitors, (event) => {
          if (event.type === "decision") {
            telemetry.record({
              type: "decision",
              playerId: event.playerId,
              decisionMs: event.result.roundTripMs,
              upstreamLatencyMs: event.result.upstreamLatencyMs,
              action: event.result.decision,
              usage: event.result.usage,
            });
            return;
          }
          if (event.type === "request") {
            telemetry.record({ type: "request", playerId: event.playerId });
            return;
          }
          telemetry.record({ type: "status", playerId: event.status.playerId, status: event.status.state });
          if (event.status.state === "error") telemetry.record({ type: "error", playerId: event.status.playerId });
        })
      : () => undefined;
    window.addEventListener("pagehide", () => {
      stop();
      window.clearInterval(refreshTimer);
      delete window.get_lab_telemetry;
    }, { once: true });
    return;
  }

  game.startOfflineBotMatch(mode === "training" ? 1 : 3, mode === "training" ? "classic" : "endless");
}

void bootOriginalGame().catch((error: unknown) => {
  console.error("Original Bomba PvP gameplay failed to start", error);
  root.dataset.state = "error";
  root.textContent = document.documentElement.lang === "en"
    ? "The original arena failed to load. Return and try again."
    : "A arena original não carregou. Volte e tente novamente.";
});
