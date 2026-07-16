import type { PlayerId, PlayerState } from "../original-game/Gameplay/types.ts";
import type { OnlineGameSnapshot, OnlineInputState } from "../original-game/NetCode/protocol.ts";
import type { LabClient, LabDecision, LabDecisionResult } from "./client.ts";

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
  lunaDecisionLanes?: number;
}>;

const INACTIVE_POLL_INTERVAL_MS = 50;
const ERROR_RETRY_MIN_MS = 100;
const ERROR_RETRY_MAX_MS = 1_000;
const LUNA_LIGHT_DECISION_LANES = 4;
const LUNA_LIGHT_LANE_STAGGER_MS = 500;
export const LAB_EXECUTION_MOTOR_INTERVAL_MS = 50;

function decisionLaneCount(model: string, options: LabControllerOptions): number {
  if (model !== "cx/gpt-5.6-luna") return 1;
  const configuredLanes = options.lunaDecisionLanes ?? LUNA_LIGHT_DECISION_LANES;
  return Number.isFinite(configuredLanes)
    ? Math.max(1, Math.floor(configuredLanes))
    : LUNA_LIGHT_DECISION_LANES;
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
      ownerId: flame.ownerId ?? null,
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
  options: LabControllerOptions = {},
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
    let scheduledRoundNumber: number | null = null;
    let nextLaneStartAtMs = 0;

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
      let stagedRoundNumber: number | null = null;
      while (!signal.aborted) {
        const snapshot = game.exportOnlineSnapshot();
        const player = snapshot.players[competitor.playerId];
        if (snapshot.mode !== "match" || snapshot.paused || snapshot.roundOutcome || !player?.active || !player.alive) {
          stagedRoundNumber = null;
          clearInput();
          onEvent({ type: "status", status: { playerId: competitor.playerId, state: "waiting" } });
          await delay(INACTIVE_POLL_INTERVAL_MS, signal);
          continue;
        }

        if (stagedRoundNumber !== snapshot.roundNumber) {
          stagedRoundNumber = snapshot.roundNumber;
          const now = Date.now();
          if (scheduledRoundNumber !== snapshot.roundNumber) {
            scheduledRoundNumber = snapshot.roundNumber;
            nextLaneStartAtMs = now;
          }
          const scheduledStartAtMs = Math.max(now, nextLaneStartAtMs);
          nextLaneStartAtMs = scheduledStartAtMs + LUNA_LIGHT_LANE_STAGGER_MS;
          const staggerMs = scheduledStartAtMs - now;
          if (staggerMs > 0) {
            await delay(staggerMs, signal);
            continue;
          }
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
          const retryMs = Math.min(
            ERROR_RETRY_MAX_MS,
            ERROR_RETRY_MIN_MS * (2 ** Math.max(0, consecutiveErrors - 1)),
          );
          await delay(retryMs, signal);
        }
      }
    };

    void Promise.all(
      Array.from(
        { length: decisionLaneCount(competitor.model, options) },
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
