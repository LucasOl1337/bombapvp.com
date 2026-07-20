import "./original-game.css";
import { loadGameAssets } from "./Engine/assets";
import { GameApp } from "./Engine/game-app";
import { createLabClient } from "../lab/client";
import { createLabMatchCompetitors } from "../lab/competitors";
import { buildLabObservation } from "../lab/observation";
import { startLabRuntime, type LabMatch } from "../lab/runtime";
import {
  createLocalBotAssignments,
  createOfflineBotMatchSetup,
  getLocalBotById,
} from "./Engine/bot-registry";
import type { LabTelemetryReport } from "../lab/telemetry";
import { createLabConsole } from "../lab/telemetry-panel";
import type { PlayerId } from "./Gameplay/types";
import { getCharacterDefinition } from "../../Champions";
import { launchRequestFromSearchParams } from "../matches/url-search-params";
import { startOnlineDuelGame } from "../online/client/game-app-online-session";
import type { DuelNetworkMetrics } from "../online/client/authoritative-duel-client";
import { SoundManager, SFX_MANIFEST } from "./Engine/sound-manager";
import { createChampionVisualRuntime } from "../../Champions/visual-runtime";

declare global {
  interface Window {
    get_lab_telemetry?: () => LabTelemetryReport;
    get_online_metrics?: () => DuelNetworkMetrics;
  }
}

const rootElement = document.querySelector<HTMLElement>("#app");

if (!rootElement) throw new Error("Original Bomba PvP game root was not found.");
const root: HTMLElement = rootElement;

async function bootOriginalGame(): Promise<void> {
  const params = new URLSearchParams(window.location.search);
  const launchResult = launchRequestFromSearchParams(params);
  if (!launchResult.ok) throw new Error(launchResult.error);
  const launchRequest = launchResult.request;
  const selectedCharacterIndex = launchRequest.mode === "lab"
    ? 0
    : getCharacterDefinition(launchRequest.character ?? "")?.roster.order ?? 0;
  const hostname = window.location.hostname.replace(/^www\./, "");

  document.documentElement.lang = hostname === "bombpvp.com" ? "en" : "pt-BR";
  if (launchRequest.mode === "lab" || launchRequest.mode === "online") {
    document.body.classList.add(launchRequest.mode === "lab" ? "lab-mode" : "online-mode");
    root.classList.add("experience-match__stage");
    root.dataset.fullscreen = "true";
  }
  const assets = await loadGameAssets();
  root.replaceChildren();
  root.removeAttribute("aria-live");

  const game = new GameApp(root, assets, undefined, {
    soundManager: new SoundManager(),
    soundManifest: SFX_MANIFEST,
    championVisuals: createChampionVisualRuntime(),
  });
  game.setLanguage(hostname === "bombpvp.com" ? "en" : "pt");
  game.setOfflinePreferredCharacter(selectedCharacterIndex);
  game.start();

  if (launchRequest.mode === "online") {
    const session = startOnlineDuelGame({
      game,
      root,
      characterId: launchRequest.character,
      language: hostname === "bombpvp.com" ? "en" : "pt",
    });
    window.get_online_metrics = session.readMetrics;
    window.addEventListener("pagehide", () => {
      session.dispose();
      delete window.get_online_metrics;
    }, { once: true });
    return;
  }

  if (launchRequest.mode === "lab") {
    const competitors = createLabMatchCompetitors(launchRequest);
    const match: LabMatch = {
      startSession(session) {
        const localBotAssignments = createLocalBotAssignments(
          session.localCompetitors.map(({ playerId, kind }) => ({
            playerId,
            bot: getLocalBotById(kind),
          })),
        );
        const characterSelections: Record<PlayerId, number> = { 1: 0, 2: 1, 3: 2, 4: 3 };
        Object.assign(characterSelections, localBotAssignments.characterSelections);
        game.startServerAuthoritativeMatch(
          [...session.activePlayerIds],
          characterSelections,
          {
            roomMode: "endless",
            botPlayerIds: session.localCompetitors.map(({ playerId }) => playerId),
            botDecisionPolicies: localBotAssignments.botDecisionPolicies,
            playerLabels: { ...session.playerLabels },
            hideNativeHud: true,
            showWorldPlayerLabels: true,
            botDecisionObserver: ({ playerId, decision, computeMs }) => session.recordLocalDecision({
              playerId,
              decision,
              computeMs,
            }),
          },
        );
      },
      readSnapshot: () => game.exportOnlineSnapshot(),
      setPlayerInput: (playerId, input) => game.setServerPlayerInput(playerId, input),
      replacePlayerInput: (playerId, input) => game.replaceServerPlayerInput(playerId, input),
      clearPlayerInput: (playerId) => game.clearServerPlayerInput(playerId),
      getSafetyInput: (playerId, input) => game.getServerSafetyInput(playerId, input),
    };
    const runtime = startLabRuntime({
      match,
      decider: createLabClient(),
      competitors,
      observe: buildLabObservation,
    });

    const labConsole = createLabConsole(document, document.documentElement.lang === "en");
    const readTelemetry = (): LabTelemetryReport => runtime.readReport();
    window.get_lab_telemetry = readTelemetry;
    const refreshPanel = (): void => labConsole.render(readTelemetry());
    refreshPanel();
    const refreshTimer = window.setInterval(refreshPanel, 500);

    window.addEventListener("pagehide", () => {
      runtime.stop();
      window.clearInterval(refreshTimer);
      labConsole.dispose();
      delete window.get_lab_telemetry;
    }, { once: true });
    return;
  }

  const offlineSetup = createOfflineBotMatchSetup(launchRequest);
  game.startOfflineBotMatch(offlineSetup.botFill, offlineSetup.roomMode, offlineSetup.options);
}

void bootOriginalGame().catch((error: unknown) => {
  console.error("Original Bomba PvP gameplay failed to start", error);
  root.dataset.state = "error";
  root.textContent = document.documentElement.lang === "en"
    ? "The original arena failed to load. Return and try again."
    : "A arena original não carregou. Volte e tente novamente.";
});
