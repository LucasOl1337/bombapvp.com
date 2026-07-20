import type { CharacterId } from "../../../Champions/membership";
import type { GameApp } from "../../original-game/Engine/game-app";
import type {
  OnlineSessionBridge,
  OnlineGameSnapshot,
} from "../../original-game/NetCode/protocol";
import type { PlayerId } from "../../original-game/Gameplay/types";
import {
  AuthoritativeDuelClient,
  type DuelNetworkMetrics,
  type DuelReady,
} from "./authoritative-duel-client";
import {
  createOnlineDuelConnectionOverlay,
  type OnlineUiLanguage,
} from "./online-duel-status-ui";

export type { OnlineUiLanguage } from "./online-duel-status-ui";

export interface OnlineDuelGameHandle {
  readonly client: AuthoritativeDuelClient;
  readMetrics(): DuelNetworkMetrics;
  dispose(): void;
}

export function startOnlineDuelGame(options: Readonly<{
  game: GameApp;
  root: HTMLElement;
  characterId: CharacterId;
  language: OnlineUiLanguage;
  origin?: string;
}>): OnlineDuelGameHandle {
  const overlay = createOnlineDuelConnectionOverlay(
    options.root.ownerDocument,
    options.root,
    options.language,
  );
  let disposed = false;
  let matchStarted = false;
  let ready: DuelReady | null = null;
  let client!: AuthoritativeDuelClient;

  const session: OnlineSessionBridge = {
    role: "guest",
    roomCode: null,
    sendGuestInput(input, inputSeq) {
      return client.sendInput(input, inputSeq);
    },
    sendHostSnapshot: () => undefined,
    sendMatchResultChoice(choice) {
      client.stop();
      if (choice === "rematch") {
        window.location.assign(window.location.href);
      } else {
        window.location.assign("/");
      }
    },
  };

  client = new AuthoritativeDuelClient({
    origin: options.origin ?? window.location.origin,
    characterId: options.characterId,
    onStatus(status) {
      overlay.render(status, ready?.seat ?? null);
    },
    onReady(nextReady) {
      ready = nextReady;
      session.roomCode = nextReady.matchId;
    },
    onSnapshot(snapshot) {
      if (!ready || disposed) return;
      if (!matchStarted) {
        options.game.startOnlineMatch(createMatchStartConfig(snapshot, ready, options.language));
        matchStarted = true;
        options.game.applyOnlineSnapshot(snapshot);
        return;
      }
      // The transport has already expanded deltas into a complete snapshot.
      // Keep the full path for initial hydration only: it rebuilds the arena
      // and invalidates its expensive static canvas cache. Steady-state frames
      // use the incremental path, which refreshes dynamic state and invalidates
      // terrain only when the topology actually changed.
      options.game.applyOnlineFrame(snapshot);
    },
  });

  options.game.attachOnlineSession(session);
  const onPageHide = (): void => client.stop();
  window.addEventListener("pagehide", onPageHide, { once: true });
  void client.start();

  return {
    client,
    readMetrics: () => client.getMetrics(),
    dispose() {
      if (disposed) return;
      disposed = true;
      window.removeEventListener("pagehide", onPageHide);
      client.stop();
      overlay.dispose();
    },
  };
}

function createMatchStartConfig(
  snapshot: OnlineGameSnapshot,
  ready: DuelReady,
  language: OnlineUiLanguage,
) {
  const localLabel = language === "en" ? "YOU" : "VOCÊ";
  const rivalLabel = language === "en" ? "RIVAL" : "RIVAL";
  const playerLabels: Record<PlayerId, string> = {
    1: ready.seat === 1 ? localLabel : rivalLabel,
    2: ready.seat === 2 ? localLabel : rivalLabel,
    3: "",
    4: "",
  };
  return {
    roomCode: ready.matchId,
    role: "guest" as const,
    roomMode: "classic" as const,
    arena: snapshot.arena,
    localPlayerId: ready.seat,
    activePlayerIds: [1, 2] as PlayerId[],
    botPlayerIds: [] as PlayerId[],
    characterSelections: { ...snapshot.selectedCharacterIndex },
    playerLabels,
  };
}
