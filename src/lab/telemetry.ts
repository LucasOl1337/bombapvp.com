import type { PlayerId } from "../original-game/Gameplay/types.ts";
import type { OnlineGameSnapshot } from "../original-game/NetCode/protocol.ts";
import { monotonicNow } from "../shared/monotonic-time";
import type { LabTokenUsage } from "./client.ts";

export type LabTelemetryStatus = "waiting" | "thinking" | "acting" | "error" | "stopped";

export type LabTelemetryUsage = LabTokenUsage;

export type LabTelemetryAction = Readonly<{
  direction: "up" | "down" | "left" | "right" | null;
  placeBomb: boolean;
  detonate?: boolean;
  useSkill?: boolean;
}>;

export type LabTelemetryEvent =
  | Readonly<{ type: "status"; playerId: PlayerId; status: LabTelemetryStatus }>
  | Readonly<{ type: "error"; playerId: PlayerId }>
  | Readonly<{ type: "request"; playerId: PlayerId }>
  | Readonly<{ type: "motor"; playerId: PlayerId; safetyOverride: boolean }>
  | Readonly<{
      type: "decision_discarded";
      reason: "stale";
      playerId: PlayerId;
      decisionMs: number;
      upstreamLatencyMs?: number | null;
      usage?: LabTelemetryUsage | null;
    }>
  | Readonly<{
      type: "decision";
      playerId: PlayerId;
      decisionMs: number;
      upstreamLatencyMs?: number | null;
      action: LabTelemetryAction;
      usage?: LabTelemetryUsage | null;
    }>;

export type LabTelemetryPlayerReport = Readonly<{
  playerId: PlayerId;
  label: string;
  kind: "v1" | "v2" | "v3" | "bomb" | "pingo" | "llm";
  status: LabTelemetryStatus;
  timing: Readonly<{
    kind: "compute" | "round-trip";
    lastMs: number | null;
    averageMs: number | null;
    p95Ms: number | null;
    upstreamAverageMs: number | null;
    transportAverageMs: number | null;
    pollGapAverageMs: number | null;
    pollingUtilizationPct: number | null;
  }>;
  decisions: Readonly<{
    count: number;
    perSecond: number;
    errors: number;
    discarded?: Readonly<{
      stale: Readonly<{
        count: number;
        timing: Readonly<{
          lastMs: number | null;
          averageMs: number | null;
          p95Ms: number | null;
          upstreamAverageMs: number | null;
          transportAverageMs: number | null;
        }>;
        tokens: LabTelemetryUsage;
      }>;
    }>;
  }>;
  motor: Readonly<{
    ticks: number;
    perSecond: number;
    safetyOverrides: number;
    safetyOverridePct: number;
  }>;
  actions: Readonly<{
    latest: LabTelemetryAction | null;
    latestAgeMs: number | null;
    changeRatePct: number;
    movementPct: number;
    bombIntentPct: number;
    detonateIntentPct: number;
    skillIntentPct: number;
  }>;
  tokens: LabTelemetryUsage;
  gameplay: Readonly<{
    alive: boolean;
    kills: number;
    roundWins: number;
    deaths: number;
    selfDeaths: number;
    opponentDeaths: number;
    suddenDeathDeaths: number;
    environmentDeaths: number;
    bombsAvailable: number;
    bombCapacity: number;
    flameRange: number;
    speedLevel: number;
    shieldCharges: number;
    remoteLevel: number;
    bombPassLevel: number;
    kickLevel: number;
    shortFuseLevel: number;
  }>;
}>;

export type LabTelemetryReport = Readonly<{
  sampledAtMs: number;
  sessionElapsedMs: number;
  players: readonly LabTelemetryPlayerReport[];
}>;

type Competitor = Readonly<{
  playerId: PlayerId;
  label: string;
  kind: "v1" | "v2" | "v3" | "bomb" | "pingo" | "llm";
}>;

type PlayerAccumulator = {
  competitor: Competitor;
  status: LabTelemetryStatus;
  decisions: number;
  motorTicks: number;
  safetyOverrides: number;
  errors: number;
  staleDecisions: number;
  staleDecisionMsTotal: number;
  staleDecisionMsAverage: number | null;
  staleDecisionMsLast: number | null;
  staleDecisionMsSamples: number[];
  staleUpstreamMsTotal: number;
  staleUpstreamMsAverage: number | null;
  staleUpstreamSamples: number;
  staleTransportMsTotal: number;
  staleTransportMsAverage: number | null;
  staleTransportSamples: number;
  staleUsage: LabTelemetryUsage;
  decisionMsTotal: number;
  decisionMsAverage: number | null;
  decisionMsLast: number | null;
  decisionMsSamples: number[];
  upstreamMsTotal: number;
  upstreamMsAverage: number | null;
  upstreamSamples: number;
  transportMsTotal: number;
  transportMsAverage: number | null;
  transportSamples: number;
  pollGapMsTotal: number;
  pollGapMsAverage: number | null;
  pollGapSamples: number;
  pairedRoundTripMsTotal: number;
  pairedRoundTripMsAverage: number | null;
  lastDecisionRecordedAtMs: number | null;
  lastDecisionRoundTripMs: number | null;
  actionChanges: number;
  movementIntents: number;
  bombIntents: number;
  detonateIntents: number;
  skillIntents: number;
  lastActionKey: string | null;
  lastAction: LabTelemetryAction | null;
  lastActionAtMs: number | null;
  usage: LabTelemetryUsage;
};

const MAX_TIMING_SAMPLES = 240;

function nonNegativeFinite(value: number): number | null {
  return Number.isFinite(value) ? Math.max(0, value) : null;
}

function nonNegativeFiniteOrZero(value: number): number {
  return nonNegativeFinite(value) ?? 0;
}

function saturatingAdd(left: number, right: number): number {
  const safeLeft = nonNegativeFiniteOrZero(left);
  const safeRight = nonNegativeFiniteOrZero(right);
  return safeLeft > Number.MAX_VALUE - safeRight
    ? Number.MAX_VALUE
    : safeLeft + safeRight;
}

/** Overflow-safe online mean; identical samples remain bit-exact. */
function onlineAverage(
  currentAverage: number | null,
  sampleCount: number,
  sample: number,
): number {
  const safeSample = nonNegativeFiniteOrZero(sample);
  if (currentAverage === null || sampleCount <= 0) return safeSample;
  if (currentAverage === safeSample) return safeSample;
  const nextCount = sampleCount + 1;
  return saturatingAdd(
    currentAverage * (sampleCount / nextCount),
    safeSample / nextCount,
  );
}

function round(value: number, digits = 2): number {
  const safeValue = nonNegativeFiniteOrZero(value);
  const scale = 10 ** digits;
  if (!Number.isFinite(scale) || scale <= 0 || safeValue > Number.MAX_VALUE / scale) {
    return safeValue;
  }
  return Math.round(safeValue * scale) / scale;
}

function percentile95(samples: readonly number[]): number | null {
  if (samples.length === 0) return null;
  const sorted = [...samples].sort((left, right) => left - right);
  return round(sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)]!);
}

function percentage(count: number, total: number): number {
  return total > 0 ? round((count / total) * 100, 1) : 0;
}

function pairPercentage(part: number, other: number): number {
  const safePart = nonNegativeFiniteOrZero(part);
  const safeOther = nonNegativeFiniteOrZero(other);
  const largest = Math.max(safePart, safeOther);
  if (largest === 0) return 0;
  const normalizedPart = safePart / largest;
  const normalizedOther = safeOther / largest;
  return round((normalizedPart / (normalizedPart + normalizedOther)) * 100, 1);
}

function actionKey(action: LabTelemetryAction): string {
  return [
    action.direction ?? "idle",
    action.placeBomb ? "bomb" : "-",
    action.detonate ? "detonate" : "-",
    action.useSkill ? "skill" : "-",
  ].join(":");
}

function createAccumulator(competitor: Competitor): PlayerAccumulator {
  return {
    competitor,
    status: competitor.kind === "llm" ? "waiting" : "acting",
    decisions: 0,
    motorTicks: 0,
    safetyOverrides: 0,
    errors: 0,
    staleDecisions: 0,
    staleDecisionMsTotal: 0,
    staleDecisionMsAverage: null,
    staleDecisionMsLast: null,
    staleDecisionMsSamples: [],
    staleUpstreamMsTotal: 0,
    staleUpstreamMsAverage: null,
    staleUpstreamSamples: 0,
    staleTransportMsTotal: 0,
    staleTransportMsAverage: null,
    staleTransportSamples: 0,
    staleUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    decisionMsTotal: 0,
    decisionMsAverage: null,
    decisionMsLast: null,
    decisionMsSamples: [],
    upstreamMsTotal: 0,
    upstreamMsAverage: null,
    upstreamSamples: 0,
    transportMsTotal: 0,
    transportMsAverage: null,
    transportSamples: 0,
    pollGapMsTotal: 0,
    pollGapMsAverage: null,
    pollGapSamples: 0,
    pairedRoundTripMsTotal: 0,
    pairedRoundTripMsAverage: null,
    lastDecisionRecordedAtMs: null,
    lastDecisionRoundTripMs: null,
    actionChanges: 0,
    movementIntents: 0,
    bombIntents: 0,
    detonateIntents: 0,
    skillIntents: 0,
    lastActionKey: null,
    lastAction: null,
    lastActionAtMs: null,
    usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
  };
}

export function createLabTelemetry(
  competitors: readonly Competitor[],
  now: () => number = monotonicNow,
): Readonly<{
  record(event: LabTelemetryEvent): void;
  read(snapshot: OnlineGameSnapshot): LabTelemetryReport;
}> {
  const startedAtMs = nonNegativeFiniteOrZero(now());
  const players = new Map<PlayerId, PlayerAccumulator>(
    competitors.map((competitor) => [competitor.playerId, createAccumulator(competitor)]),
  );

  const record = (event: LabTelemetryEvent): void => {
    const player = players.get(event.playerId);
    if (!player) return;
    if (event.type === "status") {
      player.status = event.status;
      if (event.status === "waiting" || event.status === "stopped") {
        player.lastDecisionRecordedAtMs = null;
        player.lastDecisionRoundTripMs = null;
      }
      return;
    }
    if (event.type === "error") {
      player.errors += 1;
      player.status = "error";
      player.lastDecisionRecordedAtMs = null;
      player.lastDecisionRoundTripMs = null;
      return;
    }
    if (event.type === "request") {
      if (player.lastDecisionRecordedAtMs !== null && player.lastDecisionRoundTripMs !== null) {
        const pollGapMs = nonNegativeFinite(now() - player.lastDecisionRecordedAtMs);
        if (pollGapMs !== null) {
          player.pollGapMsAverage = onlineAverage(
            player.pollGapMsAverage,
            player.pollGapSamples,
            pollGapMs,
          );
          player.pairedRoundTripMsAverage = onlineAverage(
            player.pairedRoundTripMsAverage,
            player.pollGapSamples,
            player.lastDecisionRoundTripMs,
          );
          player.pollGapMsTotal = saturatingAdd(player.pollGapMsTotal, pollGapMs);
          player.pollGapSamples += 1;
          player.pairedRoundTripMsTotal = saturatingAdd(
            player.pairedRoundTripMsTotal,
            player.lastDecisionRoundTripMs,
          );
        }
        player.lastDecisionRecordedAtMs = null;
        player.lastDecisionRoundTripMs = null;
      }
      return;
    }
    if (event.type === "motor") {
      player.motorTicks += 1;
      if (event.safetyOverride) player.safetyOverrides += 1;
      return;
    }
    if (event.type === "decision_discarded") {
      const decisionMs = nonNegativeFiniteOrZero(event.decisionMs);
      player.staleDecisionMsAverage = onlineAverage(
        player.staleDecisionMsAverage,
        player.staleDecisions,
        decisionMs,
      );
      player.staleDecisions += 1;
      player.staleDecisionMsTotal = saturatingAdd(player.staleDecisionMsTotal, decisionMs);
      player.staleDecisionMsLast = decisionMs;
      player.staleDecisionMsSamples.push(decisionMs);
      if (player.staleDecisionMsSamples.length > MAX_TIMING_SAMPLES) {
        player.staleDecisionMsSamples.shift();
      }
      if (typeof event.upstreamLatencyMs === "number" && Number.isFinite(event.upstreamLatencyMs)) {
        const upstreamMs = Math.max(0, event.upstreamLatencyMs);
        const transportMs = Math.max(0, decisionMs - upstreamMs);
        player.staleUpstreamMsAverage = onlineAverage(
          player.staleUpstreamMsAverage,
          player.staleUpstreamSamples,
          upstreamMs,
        );
        player.staleTransportMsAverage = onlineAverage(
          player.staleTransportMsAverage,
          player.staleTransportSamples,
          transportMs,
        );
        player.staleUpstreamMsTotal = saturatingAdd(player.staleUpstreamMsTotal, upstreamMs);
        player.staleUpstreamSamples += 1;
        player.staleTransportMsTotal = saturatingAdd(
          player.staleTransportMsTotal,
          transportMs,
        );
        player.staleTransportSamples += 1;
      }
      if (event.usage) {
        player.staleUsage = {
          inputTokens: saturatingAdd(player.staleUsage.inputTokens, event.usage.inputTokens),
          outputTokens: saturatingAdd(player.staleUsage.outputTokens, event.usage.outputTokens),
          totalTokens: saturatingAdd(player.staleUsage.totalTokens, event.usage.totalTokens),
        };
      }
      return;
    }

    const decisionMs = nonNegativeFiniteOrZero(event.decisionMs);
    player.lastDecisionRecordedAtMs = nonNegativeFinite(now());
    player.lastDecisionRoundTripMs = decisionMs;
    player.status = "acting";
    player.decisionMsAverage = onlineAverage(
      player.decisionMsAverage,
      player.decisions,
      decisionMs,
    );
    player.decisions += 1;
    player.decisionMsTotal = saturatingAdd(player.decisionMsTotal, decisionMs);
    player.decisionMsLast = decisionMs;
    player.decisionMsSamples.push(decisionMs);
    if (player.decisionMsSamples.length > MAX_TIMING_SAMPLES) player.decisionMsSamples.shift();

    if (typeof event.upstreamLatencyMs === "number" && Number.isFinite(event.upstreamLatencyMs)) {
      const upstreamMs = Math.max(0, event.upstreamLatencyMs);
      const transportMs = Math.max(0, decisionMs - upstreamMs);
      player.upstreamMsAverage = onlineAverage(
        player.upstreamMsAverage,
        player.upstreamSamples,
        upstreamMs,
      );
      player.transportMsAverage = onlineAverage(
        player.transportMsAverage,
        player.transportSamples,
        transportMs,
      );
      player.upstreamMsTotal = saturatingAdd(player.upstreamMsTotal, upstreamMs);
      player.upstreamSamples += 1;
      player.transportMsTotal = saturatingAdd(
        player.transportMsTotal,
        transportMs,
      );
      player.transportSamples += 1;
    }

    const nextAction = actionKey(event.action);
    if (player.lastActionKey !== null && player.lastActionKey !== nextAction) player.actionChanges += 1;
    player.lastActionKey = nextAction;
    player.lastAction = { ...event.action };
    player.lastActionAtMs = player.lastDecisionRecordedAtMs;
    if (event.action.direction !== null) player.movementIntents += 1;
    if (event.action.placeBomb) player.bombIntents += 1;
    if (event.action.detonate) player.detonateIntents += 1;
    if (event.action.useSkill) player.skillIntents += 1;

    if (event.usage) {
      player.usage = {
        inputTokens: saturatingAdd(player.usage.inputTokens, event.usage.inputTokens),
        outputTokens: saturatingAdd(player.usage.outputTokens, event.usage.outputTokens),
        totalTokens: saturatingAdd(player.usage.totalTokens, event.usage.totalTokens),
      };
    }
  };

  const read = (snapshot: OnlineGameSnapshot): LabTelemetryReport => {
    const sampledAtMs = nonNegativeFinite(now()) ?? startedAtMs;
    const sessionElapsedMs = nonNegativeFiniteOrZero(sampledAtMs - startedAtMs);
    const elapsedSeconds = Math.max(1, sessionElapsedMs / 1000);
    return {
      sampledAtMs: round(sampledAtMs),
      sessionElapsedMs: round(sessionElapsedMs),
      players: [...players.values()].map((entry) => {
        const player = snapshot.players[entry.competitor.playerId];
        const kills = snapshot.endlessStats?.kills[entry.competitor.playerId] ?? 0;
        const roundWins = snapshot.endlessStats?.roundWins[entry.competitor.playerId] ?? 0;
        const deaths = snapshot.endlessStats?.deaths?.[entry.competitor.playerId] ?? 0;
        const selfDeaths = snapshot.endlessStats?.selfDeaths?.[entry.competitor.playerId] ?? 0;
        const opponentDeaths = snapshot.endlessStats?.opponentDeaths?.[entry.competitor.playerId] ?? 0;
        const suddenDeathDeaths = snapshot.endlessStats?.suddenDeathDeaths?.[entry.competitor.playerId] ?? 0;
        const environmentDeaths = snapshot.endlessStats?.environmentDeaths?.[entry.competitor.playerId] ?? 0;
        const averageDecisionMs = entry.decisionMsAverage === null
          ? null
          : round(entry.decisionMsAverage);
        const averagePollGapMs = entry.pollGapMsAverage === null
          ? null
          : round(entry.pollGapMsAverage);
        return {
          playerId: entry.competitor.playerId,
          label: entry.competitor.label,
          kind: entry.competitor.kind,
          status: entry.status,
          timing: {
            kind: entry.competitor.kind === "llm" ? "round-trip" : "compute",
            lastMs: entry.decisionMsLast === null ? null : round(entry.decisionMsLast),
            averageMs: averageDecisionMs,
            p95Ms: percentile95(entry.decisionMsSamples),
            upstreamAverageMs: entry.upstreamMsAverage === null
              ? null
              : round(entry.upstreamMsAverage),
            transportAverageMs: entry.transportMsAverage === null
              ? null
              : round(entry.transportMsAverage),
            pollGapAverageMs: averagePollGapMs,
            pollingUtilizationPct: entry.pollGapSamples === 0
              ? null
              : pairPercentage(
                entry.pairedRoundTripMsAverage ?? 0,
                entry.pollGapMsAverage ?? 0,
              ),
          },
          decisions: {
            count: entry.decisions,
            perSecond: round(entry.decisions / elapsedSeconds),
            errors: entry.errors,
            discarded: {
              stale: {
                count: entry.staleDecisions,
                timing: {
                  lastMs: entry.staleDecisionMsLast === null
                    ? null
                    : round(entry.staleDecisionMsLast),
                  averageMs: entry.staleDecisionMsAverage === null
                    ? null
                    : round(entry.staleDecisionMsAverage),
                  p95Ms: percentile95(entry.staleDecisionMsSamples),
                  upstreamAverageMs: entry.staleUpstreamMsAverage === null
                    ? null
                    : round(entry.staleUpstreamMsAverage),
                  transportAverageMs: entry.staleTransportMsAverage === null
                    ? null
                    : round(entry.staleTransportMsAverage),
                },
                tokens: { ...entry.staleUsage },
              },
            },
          },
          motor: {
            ticks: entry.motorTicks,
            perSecond: round(entry.motorTicks / elapsedSeconds),
            safetyOverrides: entry.safetyOverrides,
            safetyOverridePct: percentage(entry.safetyOverrides, entry.motorTicks),
          },
          actions: {
            latest: entry.lastAction ? { ...entry.lastAction } : null,
            latestAgeMs: entry.lastActionAtMs === null
              ? null
              : round(nonNegativeFiniteOrZero(sampledAtMs - entry.lastActionAtMs)),
            changeRatePct: percentage(entry.actionChanges, Math.max(0, entry.decisions - 1)),
            movementPct: percentage(entry.movementIntents, entry.decisions),
            bombIntentPct: percentage(entry.bombIntents, entry.decisions),
            detonateIntentPct: percentage(entry.detonateIntents, entry.decisions),
            skillIntentPct: percentage(entry.skillIntents, entry.decisions),
          },
          tokens: { ...entry.usage },
          gameplay: {
            alive: Boolean(player?.active && player.alive),
            kills,
            roundWins,
            deaths,
            selfDeaths,
            opponentDeaths,
            suddenDeathDeaths,
            environmentDeaths,
            bombsAvailable: player?.active ? Math.max(0, player.maxBombs - player.activeBombs) : 0,
            bombCapacity: player?.active ? player.maxBombs : 0,
            flameRange: player?.active ? player.flameRange : 0,
            speedLevel: player?.active ? player.speedLevel : 0,
            shieldCharges: player?.active ? player.shieldCharges : 0,
            remoteLevel: player?.active ? player.remoteLevel : 0,
            bombPassLevel: player?.active ? player.bombPassLevel : 0,
            kickLevel: player?.active ? player.kickLevel : 0,
            shortFuseLevel: player?.active ? player.shortFuseLevel : 0,
          },
        };
      }),
    };
  };

  return { record, read };
}
