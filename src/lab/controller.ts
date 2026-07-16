import type { PlayerId, PlayerState } from "../original-game/Gameplay/types.ts";
import type { OnlineGameSnapshot, OnlineInputState } from "../original-game/NetCode/protocol.ts";
import type { LabClient, LabDecision, LabDecisionResult } from "./client.ts";

type LabGame = Pick<{
  exportOnlineSnapshot(): OnlineGameSnapshot;
  setServerPlayerInput(playerId: PlayerId, input: OnlineInputState): void;
  clearServerPlayerInput(playerId: PlayerId): void;
}, "exportOnlineSnapshot" | "setServerPlayerInput" | "clearServerPlayerInput">;

export type LabCompetitor = Readonly<{ playerId: PlayerId; model: string }>;
export type LabControllerStatus = Readonly<{
  playerId: PlayerId;
  state: "waiting" | "thinking" | "acting" | "error" | "stopped";
  error?: string;
}>;
export type LabControllerEvent =
  | Readonly<{ type: "status"; status: LabControllerStatus }>
  | Readonly<{ type: "request"; playerId: PlayerId }>
  | Readonly<{ type: "decision"; playerId: PlayerId; result: LabDecisionResult }>;

const INACTIVE_POLL_INTERVAL_MS = 50;
const ERROR_RETRY_MIN_MS = 100;
const ERROR_RETRY_MAX_MS = 1_000;

function observePlayer(player: PlayerState) {
  return {
    id: player.id,
    tile: player.tile,
    position: player.position,
    velocity: player.velocity,
    direction: player.direction,
    lastMoveDirection: player.lastMoveDirection,
    alive: player.alive,
    bombsAvailable: Math.max(0, player.maxBombs - player.activeBombs),
    bombCapacity: player.maxBombs,
    flameRange: player.flameRange,
    speedLevel: player.speedLevel,
    remoteLevel: player.remoteLevel,
    shieldCharges: player.shieldCharges,
    bombPassLevel: player.bombPassLevel,
    kickLevel: player.kickLevel,
    shortFuseLevel: player.shortFuseLevel,
    flameGuardMs: player.flameGuardMs,
    spawnProtectionMs: player.spawnProtectionMs,
    skill: {
      id: player.skill.id,
      phase: player.skill.phase,
      channelRemainingMs: player.skill.channelRemainingMs,
      cooldownMs: player.skill.cooldownRemainingMs,
      projectedPosition: player.skill.projectedPosition,
    },
  };
}

export function buildLabObservation(snapshot: OnlineGameSnapshot, playerId: PlayerId) {
  const self = snapshot.players[playerId];
  return {
    playerId,
    frameId: snapshot.frameId,
    serverTimeMs: snapshot.serverTimeMs,
    round: snapshot.roundNumber,
    elapsedMs: snapshot.roundTimeMs,
    score: snapshot.score,
    endlessStats: snapshot.endlessStats,
    self: observePlayer(self),
    enemies: snapshot.activePlayerIds
      .filter((id) => id !== playerId)
      .map((id) => observePlayer(snapshot.players[id])),
    bombs: snapshot.bombs.map((bomb) => ({
      id: bomb.id,
      ownerId: bomb.ownerId,
      tile: bomb.tile,
      fuseMs: Math.round(bomb.fuseMs),
      flameRange: bomb.flameRange,
      ownerCanPass: bomb.ownerCanPass,
    })),
    flames: snapshot.flames.map((flame) => ({
      tile: flame.tile,
      remainingMs: Math.round(flame.remainingMs),
    })),
    magicBeams: snapshot.magicBeams.map((beam) => ({
      ownerId: beam.ownerId,
      origin: beam.origin,
      direction: beam.direction,
      tiles: beam.tiles,
      remainingMs: Math.round(beam.remainingMs),
    })),
    powerUps: snapshot.powerUps
      .filter((powerUp) => powerUp.revealed && !powerUp.collected)
      .map((powerUp) => ({ type: powerUp.type, tile: powerUp.tile })),
    arena: {
      grid: snapshot.arena.grid,
      solid: snapshot.arena.tiles.solid,
      breakable: snapshot.breakableTiles,
      wrapPortals: snapshot.arena.wrapPortals,
    },
    suddenDeath: {
      active: snapshot.suddenDeathActive,
      closedTiles: snapshot.suddenDeathClosedTiles,
      closingTiles: snapshot.suddenDeathClosingTiles,
    },
  };
}

function toInput(decision: LabDecision): OnlineInputState {
  return {
    direction: decision.direction,
    bombPressed: decision.placeBomb,
    detonatePressed: decision.detonate,
    skillPressed: decision.useSkill,
    skillHeld: false,
  };
}

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const finish = (): void => {
      clearTimeout(timeout);
      signal.removeEventListener("abort", finish);
      resolve();
    };
    const timeout = setTimeout(finish, ms);
    signal.addEventListener("abort", finish, { once: true });
  });
}

function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(new Error("lab_controller_stopped"));
  return new Promise<T>((resolve, reject) => {
    const abort = (): void => reject(new Error("lab_controller_stopped"));
    signal.addEventListener("abort", abort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", abort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener("abort", abort);
        reject(error);
      },
    );
  });
}

export function startLabController(
  game: LabGame,
  client: LabClient,
  competitors: readonly LabCompetitor[],
  onEvent: (event: LabControllerEvent) => void = () => undefined,
): () => void {
  const controller = new AbortController();
  const { signal } = controller;
  const cleanups = new Set<() => void>();

  for (const competitor of competitors) {
    game.clearServerPlayerInput(competitor.playerId);
  }

  for (const competitor of competitors) {
    void (async () => {
      let hasActiveInput = false;
      let consecutiveErrors = 0;
      let stopped = false;

      const clearInput = (force = false): void => {
        const shouldWrite = force || hasActiveInput;
        hasActiveInput = false;
        if (shouldWrite) game.clearServerPlayerInput(competitor.playerId);
      };

      const applyDecision = (decision: LabDecision): void => {
        hasActiveInput = true;
        game.setServerPlayerInput(competitor.playerId, toInput(decision));
      };

      const finish = (): void => {
        if (stopped) return;
        stopped = true;
        clearInput(true);
        onEvent({ type: "status", status: { playerId: competitor.playerId, state: "stopped" } });
        cleanups.delete(finish);
      };
      cleanups.add(finish);

      try {
        while (!signal.aborted) {
          const snapshot = game.exportOnlineSnapshot();
          const player = snapshot.players[competitor.playerId];
          if (snapshot.mode !== "match" || snapshot.paused || snapshot.roundOutcome || !player?.active || !player.alive) {
            clearInput();
            onEvent({ type: "status", status: { playerId: competitor.playerId, state: "waiting" } });
            await delay(INACTIVE_POLL_INTERVAL_MS, signal);
            continue;
          }

          try {
            onEvent({
              type: "status",
              status: { playerId: competitor.playerId, state: hasActiveInput ? "acting" : "thinking" },
            });
            onEvent({ type: "request", playerId: competitor.playerId });
            const result = await abortable(client.decide({
              model: competitor.model,
              observation: buildLabObservation(snapshot, competitor.playerId),
            }, signal), signal);
            if (signal.aborted) break;
            consecutiveErrors = 0;
            applyDecision(result.decision);
            onEvent({ type: "decision", playerId: competitor.playerId, result });
            onEvent({ type: "status", status: { playerId: competitor.playerId, state: "acting" } });
            // A real network request always yields. Protect alternate clients that resolve
            // synchronously from starving rendering and timers without slowing real polling.
            if (result.roundTripMs <= 0) await delay(0, signal);
          } catch (error) {
            if (signal.aborted) break;
            consecutiveErrors += 1;
            onEvent({
              type: "status",
              status: {
                playerId: competitor.playerId,
                state: "error",
                error: error instanceof Error ? error.message : "lab_decision_failed",
              },
            });
            const retryMs = Math.min(
              ERROR_RETRY_MAX_MS,
              ERROR_RETRY_MIN_MS * (2 ** Math.max(0, consecutiveErrors - 1)),
            );
            await delay(retryMs, signal);
          }
        }
      } finally {
        finish();
      }
    })();
  }

  return () => {
    if (signal.aborted) return;
    controller.abort();
    for (const cleanup of [...cleanups]) cleanup();
  };
}
