import { monotonicNow } from "../shared/monotonic-time";
import {
  createLabRequestId,
  LabPublicError,
  type LabDecider,
  type LabDecision,
} from "./client";
import type { LabMatchCompetitor } from "./competitors";
import {
  createLabTelemetry,
  type LabTelemetryAction,
  type LabTelemetryEvent,
  type LabTelemetryReport,
} from "./telemetry";
import type { LocalBotId } from "../original-game/Engine/bot-catalog";
import type { PlayerId } from "../original-game/Gameplay/types";
import type { OnlineGameSnapshot, OnlineInputState } from "../original-game/NetCode/protocol";

export const LAB_DEFAULT_DECISION_LANES = 1;
export const LAB_MAX_DECISION_LANES = 4;
export const LAB_MAX_IN_FLIGHT_PER_COMPETITOR = 1;
export const LAB_MAX_RETRY_AFTER_MS = 30_000;

export type LabLocalCompetitor = Readonly<{
  playerId: PlayerId;
  kind: LocalBotId;
}>;

export type LabLocalDecisionMeasurement = Readonly<{
  playerId: PlayerId;
  decision: LabTelemetryAction;
  computeMs: number;
}>;

export type LabMatchSession = Readonly<{
  activePlayerIds: readonly PlayerId[];
  localCompetitors: readonly LabLocalCompetitor[];
  playerLabels: Readonly<Record<PlayerId, string>>;
  recordLocalDecision(measurement: LabLocalDecisionMeasurement): void;
}>;

/** The small authoritative port that the Lab runtime needs from a match. */
export interface LabMatch {
  startSession(session: LabMatchSession): void;
  readSnapshot(): OnlineGameSnapshot;
  setPlayerInput(playerId: PlayerId, input: OnlineInputState): void;
  replacePlayerInput?(playerId: PlayerId, input: OnlineInputState): void;
  clearPlayerInput(playerId: PlayerId): void;
  getSafetyInput?(playerId: PlayerId, intendedInput: OnlineInputState): OnlineInputState | null;
}

export type LabObservationFactory = (
  snapshot: OnlineGameSnapshot,
  playerId: PlayerId,
) => unknown;

export type LabRuntimeScheduling = Readonly<{
  /** Global concurrent remote requests. It is capped by the room and by four. */
  decisionLanes?: number;
  decisionPollMs?: number;
  motorIntervalMs?: number;
  /**
   * Optional end-to-end age budget for applying a remote decision.
   * Negative values clamp to zero; non-finite values disable the budget.
   */
  maxDecisionAgeMs?: number;
}>;

export type LabRuntime = Readonly<{
  readReport(): LabTelemetryReport;
  record(event: LabTelemetryEvent): void;
  stop(): void;
}>;

export type LabRuntimeOptions = Readonly<{
  match: LabMatch;
  decider: LabDecider;
  competitors: readonly LabMatchCompetitor[];
  /**
   * The old browser controller owns a richer tactical projection. The runtime
   * accepts it as a dependency instead of importing browser/controller state.
   */
  observe?: LabObservationFactory;
  scheduling?: LabRuntimeScheduling;
  now?: () => number;
}>;

type RemoteCompetitorState = {
  competitor: LabMatchCompetitor;
  request: {
    token: symbol;
    roundNumber: number;
    requestedAtMs: number;
    abort: AbortController;
  } | null;
  nextEligibleAtMs: number;
  intendedInput: OnlineInputState | null;
  intendedRound: number | null;
};

function createPlayerLabels(competitors: readonly LabMatchCompetitor[]): Record<PlayerId, string> {
  const labels: Record<PlayerId, string> = { 1: "", 2: "", 3: "", 4: "" };
  for (const competitor of competitors) labels[competitor.playerId] = competitor.label;
  return labels;
}

function defaultObservation(snapshot: OnlineGameSnapshot, playerId: PlayerId): unknown {
  return { playerId, snapshot };
}

function emptyInput(): OnlineInputState {
  return {
    direction: null,
    bombPressed: false,
    detonatePressed: false,
    skillPressed: false,
    skillHeld: false,
  };
}

function decisionInput(decision: LabDecision): OnlineInputState {
  return {
    direction: decision.direction,
    bombPressed: decision.placeBomb,
    detonatePressed: decision.detonate,
    skillPressed: decision.useSkill,
    skillHeld: false,
  };
}

function isActiveRound(snapshot: OnlineGameSnapshot, playerId: PlayerId, requestedRound?: number | null): boolean {
  const player = snapshot.players[playerId];
  return snapshot.mode === "match"
    && !snapshot.paused
    && !snapshot.roundOutcome
    && (requestedRound === undefined || requestedRound === null || snapshot.roundNumber === requestedRound)
    && Boolean(player?.active && player.alive);
}

function resolvedLaneCount(
  requestedLanes: number | undefined,
  remoteCompetitorCount: number,
): number {
  const desired = Number.isFinite(requestedLanes)
    ? Math.floor(requestedLanes ?? LAB_DEFAULT_DECISION_LANES)
    : LAB_DEFAULT_DECISION_LANES;
  return Math.max(1, Math.min(LAB_MAX_DECISION_LANES, remoteCompetitorCount, desired));
}

function nonNegativeFinite(value: number): number | null {
  return Number.isFinite(value) ? Math.max(0, value) : null;
}

function retryDelayMs(error: unknown): number {
  if (error instanceof LabPublicError && error.retryAfterMs !== null) {
    return Math.min(LAB_MAX_RETRY_AFTER_MS, Math.max(0, error.retryAfterMs));
  }
  return 100;
}

function nonAttackingSafetyInput(
  intended: OnlineInputState,
  safety: OnlineInputState | null | undefined,
): OnlineInputState {
  if (!safety) return intended;
  return {
    direction: safety.direction,
    bombPressed: false,
    detonatePressed: false,
    skillPressed: false,
    skillHeld: false,
  };
}

/**
 * Starts an in-process Lab session. It owns remote polling and telemetry but
 * deliberately knows nothing about DOM, rendering, URLs or visual timers.
 */
export function startLabRuntime(options: LabRuntimeOptions): LabRuntime {
  const { match, competitors, decider } = options;
  const now = options.now ?? monotonicNow;
  const telemetry = createLabTelemetry(competitors, now);
  const observe = options.observe ?? defaultObservation;
  const localCompetitors = competitors.flatMap(({ playerId, kind }) => (
    kind === "llm" ? [] : [{ playerId, kind }]
  ));
  const remotes: RemoteCompetitorState[] = competitors
    .filter((competitor) => competitor.kind === "llm")
    .map((competitor) => ({
      competitor,
      request: null,
      nextEligibleAtMs: 0,
      intendedInput: null,
      intendedRound: null,
    }));
  const laneCount = resolvedLaneCount(options.scheduling?.decisionLanes, remotes.length);
  const decisionPollMs = Math.max(10, Math.floor(options.scheduling?.decisionPollMs ?? 50));
  const motorIntervalMs = Math.max(10, Math.floor(options.scheduling?.motorIntervalMs ?? 50));
  const configuredMaxDecisionAgeMs = options.scheduling?.maxDecisionAgeMs;
  const maxDecisionAgeMs = typeof configuredMaxDecisionAgeMs === "number"
    ? nonNegativeFinite(configuredMaxDecisionAgeMs)
    : null;
  let stopped = false;
  let cursor = 0;

  match.startSession({
    activePlayerIds: competitors.map(({ playerId }) => playerId),
    localCompetitors,
    playerLabels: createPlayerLabels(competitors),
    recordLocalDecision: ({ playerId, decision, computeMs }) => telemetry.record({
      type: "decision",
      playerId,
      decisionMs: computeMs,
      action: decision,
    }),
  });

  const applyMotor = (): void => {
    if (stopped) return;
    const snapshot = match.readSnapshot();
    for (const remote of remotes) {
      const { playerId } = remote.competitor;
      if (!remote.intendedInput) continue;
      if (remote.intendedRound !== snapshot.roundNumber || !isActiveRound(snapshot, playerId)) {
        remote.intendedInput = null;
        remote.intendedRound = null;
        match.clearPlayerInput(playerId);
        continue;
      }
      const safetyInput = match.getSafetyInput?.(playerId, remote.intendedInput);
      const safeInput = nonAttackingSafetyInput(remote.intendedInput, safetyInput);
      const safetyOverride = safetyInput !== null && safetyInput !== undefined;
      if (match.replacePlayerInput) {
        match.replacePlayerInput(playerId, safeInput);
      } else {
        match.setPlayerInput(playerId, safeInput);
      }
      telemetry.record({ type: "motor", playerId, safetyOverride });
      remote.intendedInput = {
        ...remote.intendedInput,
        bombPressed: false,
        detonatePressed: false,
        skillPressed: false,
      };
    }
  };

  const requestDecision = (remote: RemoteCompetitorState, snapshot: OnlineGameSnapshot): void => {
    const { competitor } = remote;
    const request = {
      token: Symbol("lab-decision-request"),
      roundNumber: snapshot.roundNumber,
      requestedAtMs: now(),
      abort: new AbortController(),
    };
    remote.request = request;
    telemetry.record({ type: "request", playerId: competitor.playerId });
    telemetry.record({ type: "status", playerId: competitor.playerId, status: "thinking" });
    void Promise.resolve().then(() => decider.decide({
      model: competitor.model,
      observation: observe(snapshot, competitor.playerId),
      requestId: createLabRequestId(),
    }, request.abort.signal)).then(
      (result) => {
        if (stopped || request.abort.signal.aborted || remote.request?.token !== request.token) return;
        const current = match.readSnapshot();
        if (isActiveRound(current, competitor.playerId, request.roundNumber)) {
          const acceptanceAgeMs = nonNegativeFinite(now() - request.requestedAtMs);
          if (acceptanceAgeMs === null
            || (maxDecisionAgeMs !== null && acceptanceAgeMs > maxDecisionAgeMs)) {
            telemetry.record({
              type: "decision_discarded",
              reason: "stale",
              playerId: competitor.playerId,
              decisionMs: acceptanceAgeMs ?? 0,
              upstreamLatencyMs: result.upstreamLatencyMs,
              usage: result.usage,
            });
            return;
          }
          telemetry.record({
            type: "decision",
            playerId: competitor.playerId,
            decisionMs: result.roundTripMs,
            upstreamLatencyMs: result.upstreamLatencyMs,
            action: result.decision,
            usage: result.usage,
          });
          remote.intendedInput = decisionInput(result.decision);
          remote.intendedRound = current.roundNumber;
        }
      },
      (error: unknown) => {
        if (stopped || request.abort.signal.aborted || remote.request?.token !== request.token) return;
        telemetry.record({ type: "error", playerId: competitor.playerId });
        remote.nextEligibleAtMs = now() + retryDelayMs(error);
      },
    ).finally(() => {
      if (remote.request?.token === request.token) remote.request = null;
    });
  };

  const pump = (): void => {
    if (stopped || remotes.length === 0) return;
    const snapshot = match.readSnapshot();
    for (const remote of remotes) {
      const request = remote.request;
      if (!request || isActiveRound(snapshot, remote.competitor.playerId, request.roundNumber)) continue;
      request.abort.abort();
      if (remote.request?.token === request.token) remote.request = null;
    }
    const inFlight = remotes.filter((remote) => remote.request !== null).length;
    const available = laneCount - inFlight;
    if (available <= 0) return;
    let started = 0;
    for (let offset = 0; offset < remotes.length && started < available; offset += 1) {
      const index = (cursor + offset) % remotes.length;
      const remote = remotes[index]!;
      if (remote.request || remote.nextEligibleAtMs > now()) continue;
      if (!isActiveRound(snapshot, remote.competitor.playerId)) continue;
      requestDecision(remote, snapshot);
      cursor = (index + 1) % remotes.length;
      started += 1;
    }
  };

  const decisionTimer = setInterval(pump, decisionPollMs);
  const motorTimer = setInterval(applyMotor, motorIntervalMs);
  pump();

  return {
    readReport: () => telemetry.read(match.readSnapshot()),
    record: telemetry.record,
    stop: () => {
      if (stopped) return;
      stopped = true;
      clearInterval(decisionTimer);
      clearInterval(motorTimer);
      for (const competitor of competitors) {
        telemetry.record({ type: "status", playerId: competitor.playerId, status: "stopped" });
      }
      for (const remote of remotes) {
        remote.request?.abort.abort();
        remote.request = null;
        match.clearPlayerInput(remote.competitor.playerId);
        remote.intendedInput = emptyInput();
        remote.intendedRound = null;
      }
    },
  };
}
