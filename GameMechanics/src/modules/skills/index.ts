import type {
  CompetitorId,
  Direction,
  MatchConfig,
  SkillId,
  WorldPosition,
} from "../../contracts.ts";
import { RANNI_ICE_BLINK_SKILL_ID, TICK_DURATION_MS } from "../../contracts.ts";
import type { CommandRejection } from "../../kernel/commands.ts";
import { factsOfKind } from "../../kernel/facts.ts";
import type {
  ModuleSpec,
  SystemRunContext,
  SystemRunResult,
} from "../../kernel/protocol.ts";
import {
  activeDirection,
  assertInteger,
  assertPosition,
  bodiesOverlap,
  crateKeySet,
  effectiveSolidKeySet,
  findIntent,
  findLocomotion,
  findVitals,
  freezePosition,
  isGameplayActive,
  type SkillEntry,
  type SkillsSlice,
} from "../../kernel/world-state.ts";
import {
  attemptDirection,
  isStaticallyValid,
  preOverlappingBombKeys,
} from "../locomotion/index.ts";

export const RANNI_CHANNEL_MS = 1_500 as const;
export const RANNI_COOLDOWN_MS = 8_000 as const;

const MODULE_VERSION = "1.0.0";
const DIRECTIONS = new Set<Direction>(["up", "down", "left", "right"]);
const PHASES = new Set<SkillEntry["phase"]>(["idle", "channeling", "cooldown"]);

function freezeEntry(entry: SkillEntry): SkillEntry {
  return Object.freeze({
    competitorId: entry.competitorId,
    skillId: entry.skillId,
    phase: entry.phase,
    channelRemainingMs: entry.channelRemainingMs,
    cooldownRemainingMs: entry.cooldownRemainingMs,
    projection: entry.projection ? freezePosition(entry.projection) : null,
    bombEgressKeys: Object.freeze([...entry.bombEgressKeys]),
  });
}

function initialSkills(config: MatchConfig): SkillsSlice {
  return Object.freeze({
    entries: Object.freeze(
      config.seats
        .filter((seat) => seat.skillId === RANNI_ICE_BLINK_SKILL_ID)
        .map((seat) =>
          freezeEntry({
            competitorId: seat.competitorId,
            skillId: RANNI_ICE_BLINK_SKILL_ID,
            phase: "idle",
            channelRemainingMs: 0,
            cooldownRemainingMs: 0,
            projection: null,
            bombEgressKeys: Object.freeze([]),
          }),
        ),
    ),
  });
}

function idle(entry: SkillEntry): SkillEntry {
  return freezeEntry({
    ...entry,
    phase: "idle",
    channelRemainingMs: 0,
    cooldownRemainingMs: 0,
    projection: null,
    bombEgressKeys: Object.freeze([]),
  });
}

function cooldown(entry: SkillEntry): SkillEntry {
  return freezeEntry({
    ...entry,
    phase: "cooldown",
    channelRemainingMs: 0,
    cooldownRemainingMs: RANNI_COOLDOWN_MS,
    projection: null,
    bombEgressKeys: Object.freeze([]),
  });
}

function reject(
  command: SystemRunContext["commands"][number],
  reason: CommandRejection["reason"],
): CommandRejection {
  return Object.freeze({
    sequence: command.envelope.sequence,
    seatId: command.envelope.seatId,
    reason,
  });
}

function projectionCanFinish(
  ctx: SystemRunContext,
  competitorId: CompetitorId,
  projection: WorldPosition,
  bombEgressKeys: readonly string[],
): boolean {
  const arena = ctx.read("arena");
  const pressure = ctx.read("pressure");
  const bombs = ctx.read("bombs").items;
  const solid = effectiveSolidKeySet(arena, pressure);
  const crates = crateKeySet(arena);
  if (!isStaticallyValid(
    projection,
    projection,
    solid,
    crates,
    bombs,
    new Set(bombEgressKeys),
  )) return false;

  const locomotion = ctx.read("locomotion");
  const vitals = ctx.read("vitals");
  for (const other of locomotion.entries) {
    if (other.competitorId === competitorId) continue;
    if (!findVitals(vitals, other.competitorId)?.alive) continue;
    if (bodiesOverlap(projection, other.position)) return false;
  }
  return true;
}

function runSkillsReset(ctx: SystemRunContext): SystemRunResult {
  if (factsOfKind(ctx.facts, "round-reset").length === 0) return {};
  return { writes: { skills: initialSkills(ctx.config) } };
}

function runSkills(ctx: SystemRunContext): SystemRunResult {
  const skills = ctx.read("skills");
  const match = ctx.read("match");
  const vitals = ctx.read("vitals");
  const locomotion = ctx.read("locomotion");
  const intent = ctx.read("intent");
  const arena = ctx.read("arena");
  const pressure = ctx.read("pressure");
  const bombs = ctx.read("bombs").items;
  const commands = ctx.commands.filter(
    (command) => command.envelope.command.type === "use-skill",
  );
  type SkillCommand = (typeof commands)[number];
  const commandsByCompetitor = new Map<CompetitorId, SkillCommand[]>();
  for (const command of commands) {
    const list = commandsByCompetitor.get(command.competitorId) ?? [];
    list.push(command);
    commandsByCompetitor.set(command.competitorId, list);
  }
  const rejections: CommandRejection[] = [];

  if (!isGameplayActive(match.phase)) {
    for (const command of commands) rejections.push(reject(command, "not-playing"));
    return { rejections };
  }

  const solid = effectiveSolidKeySet(arena, pressure);
  const crates = crateKeySet(arena);
  const movementFacts: Array<{
    kind: "skill-movement";
    competitorId: CompetitorId;
    suppress: boolean;
    teleport: WorldPosition | null;
  }> = [];

  const byCompetitor = new Map(skills.entries.map((entry) => [entry.competitorId, entry] as const));
  const nextEntries = skills.entries.map((current) => {
    const alive = findVitals(vitals, current.competitorId)?.alive === true;
    const ownCommands = commandsByCompetitor.get(current.competitorId) ?? [];
    if (!alive) {
      for (const command of ownCommands) rejections.push(reject(command, "competitor-dead"));
      return current;
    }

    if (current.phase === "cooldown") {
      const remaining = Math.max(0, current.cooldownRemainingMs - TICK_DURATION_MS);
      if (remaining === 0) {
        const command = ownCommands[0];
        for (const duplicate of ownCommands.slice(1)) {
          rejections.push(reject(duplicate, "skill-unavailable"));
        }
        if (!command) return idle(current);
        const loco = findLocomotion(locomotion, current.competitorId);
        if (!loco) {
          rejections.push(reject(command, "skill-unavailable"));
          return idle(current);
        }
        movementFacts.push({
          kind: "skill-movement",
          competitorId: current.competitorId,
          suppress: true,
          teleport: null,
        });
        return freezeEntry({
          ...current,
          phase: "channeling",
          channelRemainingMs: RANNI_CHANNEL_MS - TICK_DURATION_MS,
          cooldownRemainingMs: 0,
          projection: loco.position,
          bombEgressKeys: Object.freeze([...preOverlappingBombKeys(loco.position, bombs)].sort()),
        });
      }
      for (const command of ownCommands) rejections.push(reject(command, "skill-unavailable"));
      return freezeEntry({ ...current, cooldownRemainingMs: remaining });
    }

    if (current.phase === "idle") {
      const command = ownCommands[0];
      for (const duplicate of ownCommands.slice(1)) {
        rejections.push(reject(duplicate, "skill-unavailable"));
      }
      if (!command) return current;
      const loco = findLocomotion(locomotion, current.competitorId);
      if (!loco) {
        rejections.push(reject(command, "skill-unavailable"));
        return current;
      }
      movementFacts.push({
        kind: "skill-movement",
        competitorId: current.competitorId,
        suppress: true,
        teleport: null,
      });
      return freezeEntry({
        ...current,
        phase: "channeling",
        channelRemainingMs: RANNI_CHANNEL_MS - TICK_DURATION_MS,
        cooldownRemainingMs: 0,
        projection: loco.position,
        bombEgressKeys: Object.freeze([...preOverlappingBombKeys(loco.position, bombs)].sort()),
      });
    }

    const projection = current.projection;
    if (!projection) return cooldown(current);
    const canCompleteManually = current.channelRemainingMs < RANNI_CHANNEL_MS;
    const completionRequested = ownCommands.length > 0 && canCompleteManually;
    if (ownCommands.length > 0 && !canCompleteManually) {
      for (const command of ownCommands) rejections.push(reject(command, "skill-unavailable"));
    } else if (ownCommands.length > 1) {
      for (const duplicate of ownCommands.slice(1)) {
        rejections.push(reject(duplicate, "skill-unavailable"));
      }
    }

    const intentEntry = findIntent(intent, current.competitorId);
    const direction = intentEntry ? activeDirection(intentEntry) : null;
    const attempted = direction
      ? attemptDirection(
          projection,
          direction,
          solid,
          crates,
          bombs,
          new Set(current.bombEgressKeys),
        )
      : projection;
    const blockedByBody = locomotion.entries.some((other) =>
      other.competitorId !== current.competitorId
      && findVitals(vitals, other.competitorId)?.alive
      && bodiesOverlap(attempted, other.position)
    );
    const projected = blockedByBody ? projection : attempted;
    const remaining = Math.max(0, current.channelRemainingMs - TICK_DURATION_MS);
    const completes = completionRequested || remaining === 0;

    if (completes) {
      movementFacts.push({
        kind: "skill-movement",
        competitorId: current.competitorId,
        suppress: true,
        teleport: projectionCanFinish(
          ctx,
          current.competitorId,
          projected,
          current.bombEgressKeys,
        ) ? projected : null,
      });
      return cooldown(current);
    }

    movementFacts.push({
      kind: "skill-movement",
      competitorId: current.competitorId,
      suppress: true,
      teleport: null,
    });
    return freezeEntry({
      ...current,
      channelRemainingMs: remaining,
      projection: projected,
      bombEgressKeys: Object.freeze([...preOverlappingBombKeys(projected, bombs)].sort()),
    });
  });

  for (const command of commands) {
    if (!byCompetitor.has(command.competitorId)) {
      const alive = findVitals(vitals, command.competitorId)?.alive === true;
      rejections.push(reject(command, alive ? "skill-unavailable" : "competitor-dead"));
    }
  }

  return {
    writes: { skills: Object.freeze({ entries: Object.freeze(nextEntries) }) },
    facts: Object.freeze(movementFacts),
    rejections,
  };
}

function restoreSkills(raw: unknown, config: MatchConfig): SkillsSlice {
  if (!raw || typeof raw !== "object") throw new Error("slices.skills must be an object.");
  const rows = (raw as { entries?: unknown }).entries;
  if (!Array.isArray(rows)) throw new Error("slices.skills.entries must be an array.");
  const assigned = config.seats.filter((seat) => seat.skillId).map((seat) => seat.competitorId);
  const entries = rows.map((value, index) => {
    if (!value || typeof value !== "object") {
      throw new Error(`slices.skills.entries[${index}] is invalid.`);
    }
    const row = value as Record<string, unknown>;
    if (row.competitorId !== assigned[index]) {
      throw new Error("slices.skills.entries must follow assigned config seat order.");
    }
    if (row.skillId !== RANNI_ICE_BLINK_SKILL_ID) {
      throw new Error(`slices.skills.entries[${index}].skillId is invalid.`);
    }
    if (typeof row.phase !== "string" || !PHASES.has(row.phase as SkillEntry["phase"])) {
      throw new Error(`slices.skills.entries[${index}].phase is invalid.`);
    }
    const phase = row.phase as SkillEntry["phase"];
    const channelRemainingMs = assertInteger(
      row.channelRemainingMs,
      `slices.skills.entries[${index}].channelRemainingMs`,
    );
    const cooldownRemainingMs = assertInteger(
      row.cooldownRemainingMs,
      `slices.skills.entries[${index}].cooldownRemainingMs`,
    );
    if (channelRemainingMs % TICK_DURATION_MS !== 0 || channelRemainingMs > RANNI_CHANNEL_MS) {
      throw new Error(`slices.skills.entries[${index}].channelRemainingMs is invalid.`);
    }
    if (cooldownRemainingMs % TICK_DURATION_MS !== 0 || cooldownRemainingMs > RANNI_COOLDOWN_MS) {
      throw new Error(`slices.skills.entries[${index}].cooldownRemainingMs is invalid.`);
    }
    const projection = row.projection === null ? null : assertPosition(
      row.projection,
      `slices.skills.entries[${index}].projection`,
    );
    if (!Array.isArray(row.bombEgressKeys) || row.bombEgressKeys.some((key) => typeof key !== "string")) {
      throw new Error(`slices.skills.entries[${index}].bombEgressKeys is invalid.`);
    }
    if (phase === "idle" && (projection || channelRemainingMs !== 0 || cooldownRemainingMs !== 0)) {
      throw new Error(`slices.skills.entries[${index}] idle state is inconsistent.`);
    }
    if (phase === "channeling" && (!projection || channelRemainingMs === 0 || cooldownRemainingMs !== 0)) {
      throw new Error(`slices.skills.entries[${index}] channeling state is inconsistent.`);
    }
    if (phase === "cooldown" && (projection || channelRemainingMs !== 0 || cooldownRemainingMs === 0)) {
      throw new Error(`slices.skills.entries[${index}] cooldown state is inconsistent.`);
    }
    return freezeEntry({
      competitorId: row.competitorId as CompetitorId,
      skillId: row.skillId as SkillId,
      phase,
      channelRemainingMs,
      cooldownRemainingMs,
      projection,
      bombEgressKeys: Object.freeze([...(row.bombEgressKeys as string[])]),
    } as SkillEntry);
  });
  if (entries.length !== assigned.length) {
    throw new Error("slices.skills.entries must list every assigned skill exactly once.");
  }
  return Object.freeze({ entries: Object.freeze(entries) });
}

export const skillsModule: ModuleSpec = Object.freeze({
  id: "skills",
  version: MODULE_VERSION,
  owns: Object.freeze(["skills"] as const),
  systems: Object.freeze([
    Object.freeze({
      id: "skills-reset-system",
      phase: "round-reset" as const,
      reads: Object.freeze(["skills"] as const),
      writes: Object.freeze(["skills"] as const),
      run: runSkillsReset,
    }),
    Object.freeze({
      id: "skills-system",
      phase: "skill" as const,
      reads: Object.freeze([
        "skills",
        "match",
        "vitals",
        "locomotion",
        "intent",
        "arena",
        "pressure",
        "bombs",
      ] as const),
      writes: Object.freeze(["skills"] as const),
      run: runSkills,
    }),
  ]),
  codecs: Object.freeze({
    initial(config: MatchConfig) {
      return Object.freeze({ skills: initialSkills(config) });
    },
    restore(rawOwned: Readonly<Partial<Record<"skills", unknown>>>, config: MatchConfig) {
      return Object.freeze({ skills: restoreSkills(rawOwned.skills, config) });
    },
  }),
});
