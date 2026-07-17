import type { PlayerId } from "../original-game/Gameplay/types.ts";
import type { OnlineGameSnapshot, OnlineInputState } from "../original-game/NetCode/protocol.ts";
import { LabPublicError } from "./client.ts";
import type { LabClient, LabDecision, LabDecisionResult } from "./client.ts";
import { buildLabObservation } from "./observation";
import {
  LAB_MAX_IN_FLIGHT_PER_COMPETITOR,
  LAB_MAX_RETRY_AFTER_MS,
} from "./runtime.ts";

export { buildLabObservation } from "./observation";

type LabGame = {
  exportOnlineSnapshot(): OnlineGameSnapshot;
  setServerPlayerInput(playerId: PlayerId, input: OnlineInputState): void;
  replaceServerPlayerInput?(playerId: PlayerId, input: OnlineInputState): void;
  clearServerPlayerInput(playerId: PlayerId): void;
  getServerSafetyInput?(playerId: PlayerId, intendedInput: OnlineInputState): OnlineInputState | null;
};

export type LabCompetitor = Readonly<{ playerId: PlayerId; model: string }>;
export type LabControllerStatus = Readonly<{
  playerId: PlayerId;
  state: "waiting" | "thinking" | "acting" | "error" | "stopped";
  error?: string;
}>;
export type LabControllerEvent =
  | Readonly<{ type: "status"; status: LabControllerStatus }>
  | Readonly<{ type: "request"; playerId: PlayerId }>
  | Readonly<{ type: "decision"; playerId: PlayerId; result: LabDecisionResult }>
  | Readonly<{ type: "motor"; playerId: PlayerId; safetyOverride: boolean }>;
export type LabControllerOptions = Readonly<{
  /** @deprecated Kept for source compatibility; concurrency is capped per competitor. */
  lunaDecisionLanes?: number;
}>;

const INACTIVE_POLL_INTERVAL_MS = 50;
const ERROR_RETRY_MIN_MS = 100;
const ERROR_RETRY_MAX_MS = 1_000;
export const LAB_EXECUTION_MOTOR_INTERVAL_MS = 50;

function retryDelayMs(error: unknown, consecutiveErrors: number): number {
  if (error instanceof LabPublicError && error.retryAfterMs !== null) {
    return Math.min(LAB_MAX_RETRY_AFTER_MS, Math.max(0, error.retryAfterMs));
  }
  return Math.min(
    ERROR_RETRY_MAX_MS,
    ERROR_RETRY_MIN_MS * (2 ** Math.max(0, consecutiveErrors - 1)),
  );
}

function canApplyDecision(
  requestSequence: number,
  lastAppliedRequestSequence: number,
  requestedRound: number,
  currentSnapshot: OnlineGameSnapshot,
  playerId: PlayerId,
): boolean {
  const currentPlayer = currentSnapshot.players[playerId];
  return requestSequence > lastAppliedRequestSequence
    && currentSnapshot.mode === "match"
    && !currentSnapshot.paused
    && !currentSnapshot.roundOutcome
    && currentSnapshot.roundNumber === requestedRound
    && Boolean(currentPlayer?.active && currentPlayer.alive);
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
  _options: LabControllerOptions = {},
): () => void {
  const controller = new AbortController();
  const { signal } = controller;
  const cleanups = new Set<() => void>();
  const motorHandlers = new Set<(snapshot: OnlineGameSnapshot) => void>();

  for (const competitor of competitors) {
    game.clearServerPlayerInput(competitor.playerId);
  }

  const motorTimer = setInterval(() => {
    if (signal.aborted || motorHandlers.size === 0) return;
    const snapshot = game.exportOnlineSnapshot();
    for (const handler of motorHandlers) handler(snapshot);
  }, LAB_EXECUTION_MOTOR_INTERVAL_MS);

  for (const competitor of competitors) {
    let hasActiveInput = false;
    let stopped = false;
    let latestDirection: OnlineInputState["direction"] = null;
    let pendingBomb = false;
    let pendingDetonate = false;
    let pendingSkill = false;
    let motorRoundNumber: number | null = null;
    let nextRequestSequence = 1;
    let lastAppliedRequestSequence = 0;

    const resetIntent = (): void => {
      latestDirection = null;
      pendingBomb = false;
      pendingDetonate = false;
      pendingSkill = false;
    };

    const clearInput = (force = false): void => {
      const shouldWrite = force || hasActiveInput;
      hasActiveInput = false;
      if (shouldWrite) game.clearServerPlayerInput(competitor.playerId);
    };

    const runMotorTick = (snapshot: OnlineGameSnapshot): void => {
      if (signal.aborted || stopped) return;
      const player = snapshot.players[competitor.playerId];
      const active = snapshot.mode === "match"
        && !snapshot.paused
        && !snapshot.roundOutcome
        && Boolean(player?.active && player.alive);
      if (!active) {
        motorRoundNumber = null;
        resetIntent();
        clearInput();
        return;
      }
      if (motorRoundNumber !== snapshot.roundNumber) {
        motorRoundNumber = snapshot.roundNumber;
        resetIntent();
      }

      const intendedInput: OnlineInputState = {
        direction: latestDirection,
        bombPressed: pendingBomb,
        detonatePressed: pendingDetonate,
        skillPressed: pendingSkill,
        skillHeld: false,
      };
      const safetyInput = game.getServerSafetyInput?.(competitor.playerId, intendedInput) ?? null;
      const safetyOverride = safetyInput !== null && (
        safetyInput.direction !== intendedInput.direction
        || intendedInput.bombPressed
        || intendedInput.detonatePressed
        || intendedInput.skillPressed
        || Boolean(intendedInput.skillHeld)
      );
      const appliedInput: OnlineInputState = safetyOverride
        ? {
            direction: safetyInput!.direction,
            bombPressed: false,
            detonatePressed: false,
            skillPressed: false,
            skillHeld: false,
          }
        : intendedInput;

      pendingBomb = false;
      pendingDetonate = false;
      pendingSkill = false;
      hasActiveInput = true;
      if (safetyInput !== null && game.replaceServerPlayerInput) {
        game.replaceServerPlayerInput(competitor.playerId, appliedInput);
      } else {
        game.setServerPlayerInput(competitor.playerId, appliedInput);
      }
      onEvent({
        type: "motor",
        playerId: competitor.playerId,
        safetyOverride,
      });
    };

    const applyDecision = (decision: LabDecision, roundNumber: number): void => {
      const input = toInput(decision);
      motorRoundNumber = roundNumber;
      latestDirection = input.direction;
      pendingBomb ||= input.bombPressed;
      pendingDetonate ||= input.detonatePressed;
      pendingSkill ||= input.skillPressed;
      runMotorTick(game.exportOnlineSnapshot());
    };

    motorHandlers.add(runMotorTick);

    const finish = (): void => {
      if (stopped) return;
      stopped = true;
      motorHandlers.delete(runMotorTick);
      resetIntent();
      clearInput(true);
      onEvent({ type: "status", status: { playerId: competitor.playerId, state: "stopped" } });
      cleanups.delete(finish);
    };
    cleanups.add(finish);

    const runDecisionLane = async (): Promise<void> => {
      let consecutiveErrors = 0;
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
          const requestSequence = nextRequestSequence;
          nextRequestSequence += 1;
          const result = await abortable(client.decide({
            model: competitor.model,
            observation: buildLabObservation(snapshot, competitor.playerId),
          }, signal), signal);
          if (signal.aborted) break;
          consecutiveErrors = 0;

          const currentSnapshot = game.exportOnlineSnapshot();
          const canApply = canApplyDecision(
            requestSequence,
            lastAppliedRequestSequence,
            snapshot.roundNumber,
            currentSnapshot,
            competitor.playerId,
          );
          if (canApply) {
            lastAppliedRequestSequence = requestSequence;
            applyDecision(result.decision, currentSnapshot.roundNumber);
            onEvent({ type: "decision", playerId: competitor.playerId, result });
            onEvent({ type: "status", status: { playerId: competitor.playerId, state: "acting" } });
          }
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
          const retryMs = retryDelayMs(error, consecutiveErrors);
          await delay(retryMs, signal);
        }
      }
    };

    void Promise.all(
      Array.from(
        { length: LAB_MAX_IN_FLIGHT_PER_COMPETITOR },
        () => runDecisionLane(),
      ),
    ).finally(finish);
  }

  return () => {
    if (signal.aborted) return;
    clearInterval(motorTimer);
    controller.abort();
    for (const cleanup of [...cleanups]) cleanup();
  };
}
