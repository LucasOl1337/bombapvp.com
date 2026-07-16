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
  kind: "v1" | "v2" | "llm";
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
  kind: "v1" | "v2" | "llm";
}>;

type PlayerAccumulator = {
  competitor: Competitor;
  status: LabTelemetryStatus;
  decisions: number;
  motorTicks: number;
  safetyOverrides: number;
  errors: number;
  decisionMsTotal: number;
  decisionMsLast: number | null;
  decisionMsSamples: number[];
  upstreamMsTotal: number;
  upstreamSamples: number;
  transportMsTotal: number;
  transportSamples: number;
  pollGapMsTotal: number;
  pollGapSamples: number;
  pairedRoundTripMsTotal: number;
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

function round(value: number, digits = 2): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function average(total: number, count: number): number | null {
  return count > 0 ? round(total / count) : null;
}

function percentile95(samples: readonly number[]): number | null {
  if (samples.length === 0) return null;
  const sorted = [...samples].sort((left, right) => left - right);
  return round(sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)]!);
}

function percentage(count: number, total: number): number {
  return total > 0 ? round((count / total) * 100, 1) : 0;
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
    decisionMsTotal: 0,
    decisionMsLast: null,
    decisionMsSamples: [],
    upstreamMsTotal: 0,
    upstreamSamples: 0,
    transportMsTotal: 0,
    transportSamples: 0,
    pollGapMsTotal: 0,
    pollGapSamples: 0,
    pairedRoundTripMsTotal: 0,
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
  const startedAtMs = now();
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
        player.pollGapMsTotal += Math.max(0, now() - player.lastDecisionRecordedAtMs);
        player.pollGapSamples += 1;
        player.pairedRoundTripMsTotal += player.lastDecisionRoundTripMs;
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

    const decisionMs = Math.max(0, event.decisionMs);
    player.lastDecisionRecordedAtMs = now();
    player.lastDecisionRoundTripMs = decisionMs;
    player.status = "acting";
    player.decisions += 1;
    player.decisionMsTotal += decisionMs;
    player.decisionMsLast = decisionMs;
    player.decisionMsSamples.push(decisionMs);
    if (player.decisionMsSamples.length > MAX_TIMING_SAMPLES) player.decisionMsSamples.shift();

    if (typeof event.upstreamLatencyMs === "number" && Number.isFinite(event.upstreamLatencyMs)) {
      const upstreamMs = Math.max(0, event.upstreamLatencyMs);
      player.upstreamMsTotal += upstreamMs;
      player.upstreamSamples += 1;
      player.transportMsTotal += Math.max(0, decisionMs - upstreamMs);
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
        inputTokens: player.usage.inputTokens + Math.max(0, event.usage.inputTokens),
        outputTokens: player.usage.outputTokens + Math.max(0, event.usage.outputTokens),
        totalTokens: player.usage.totalTokens + Math.max(0, event.usage.totalTokens),
      };
    }
  };

  const read = (snapshot: OnlineGameSnapshot): LabTelemetryReport => {
    const sampledAtMs = now();
    const sessionElapsedMs = Math.max(0, sampledAtMs - startedAtMs);
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
        const averageDecisionMs = average(entry.decisionMsTotal, entry.decisions);
        const averagePollGapMs = average(entry.pollGapMsTotal, entry.pollGapSamples);
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
            upstreamAverageMs: average(entry.upstreamMsTotal, entry.upstreamSamples),
            transportAverageMs: average(entry.transportMsTotal, entry.transportSamples),
            pollGapAverageMs: averagePollGapMs,
            pollingUtilizationPct: entry.pollGapSamples === 0
              ? null
              : percentage(
                entry.pairedRoundTripMsTotal,
                entry.pairedRoundTripMsTotal + entry.pollGapMsTotal,
              ),
          },
          decisions: {
            count: entry.decisions,
            perSecond: round(entry.decisions / elapsedSeconds),
            errors: entry.errors,
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
              : round(Math.max(0, sampledAtMs - entry.lastActionAtMs)),
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
