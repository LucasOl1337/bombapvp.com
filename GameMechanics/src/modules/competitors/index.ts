import type { CompetitorId, GameEvent, MatchConfig, SeatId } from "../../contracts.ts";
import {
  SPAWN_PROTECTION_MS,
  TICK_DURATION_MS,
} from "../../contracts.ts";
import { factsOfKind } from "../../kernel/facts.ts";
import type {
  ModuleSpec,
  SystemRunContext,
  SystemRunResult,
} from "../../kernel/protocol.ts";
import {
  assertCompetitorOrder,
  assertInteger,
  bodyOverlapsTile,
  freezeTile,
  isGameplayActive,
  type FlameEntry,
  type MatchSlice,
  type RosterEntry,
  type RosterSlice,
  type VitalsEntry,
  type VitalsSlice,
} from "../../kernel/world-state.ts";

/**
 * 3.0.0: roster is identity-only (competitorId + seatId).
 * maxBombs/flameRange live solely in Powerups progression (Decision 009).
 */
const MODULE_VERSION = "3.0.0";

function freezeVitalsEntry(entry: VitalsEntry): VitalsEntry {
  return Object.freeze({
    competitorId: entry.competitorId,
    alive: entry.alive,
    spawnProtectionRemainingMs: entry.spawnProtectionRemainingMs,
  });
}

/**
 * round-reset phase: apply multi-owner facts only.
 * - round-reset → revive all, protection 0 (armed later on playing-open)
 * - spawn-protection-arm → full protection on living competitors
 * Protection countdown lives in the dedicated protection phase, after Match may
 * enter sudden-death and before movement/damage observe the new boundary.
 */
function runVitalsReset(ctx: SystemRunContext): SystemRunResult {
  const vitals = ctx.read("vitals");
  const resets = factsOfKind(ctx.facts, "round-reset");
  const arms = factsOfKind(ctx.facts, "spawn-protection-arm");

  if (resets.length > 0) {
    const entries = vitals.entries.map((entry) =>
      freezeVitalsEntry({
        competitorId: entry.competitorId,
        alive: true,
        spawnProtectionRemainingMs: 0,
      }),
    );
    if (arms.length > 0) {
      return {
        writes: {
          vitals: Object.freeze({
            entries: Object.freeze(
              entries.map((entry) =>
                freezeVitalsEntry({
                  ...entry,
                  spawnProtectionRemainingMs: SPAWN_PROTECTION_MS,
                }),
              ),
            ),
          }),
        },
      };
    }
    return {
      writes: {
        vitals: Object.freeze({ entries: Object.freeze(entries) }),
      },
    };
  }

  if (arms.length > 0) {
    const entries = vitals.entries.map((entry) =>
      freezeVitalsEntry({
        competitorId: entry.competitorId,
        alive: entry.alive,
        spawnProtectionRemainingMs: entry.alive ? SPAWN_PROTECTION_MS : 0,
      }),
    );
    return {
      writes: {
        vitals: Object.freeze({ entries: Object.freeze(entries) }),
      },
    };
  }

  return {};
}

/**
 * `protection` phase (AFTER Match timer, BEFORE intent/locomotion/damage):
 * decrement protection in playing; force zero the same tick Match enters
 * sudden-death (observes timer's phase write via phase barrier).
 * Does not emit per-tick protection events.
 */
function runProtectionTimer(ctx: SystemRunContext): SystemRunResult {
  const match = ctx.read("match");
  const vitals = ctx.read("vitals");

  if (match.phase === "sudden-death") {
    const needsZero = vitals.entries.some(
      (entry) => entry.spawnProtectionRemainingMs !== 0,
    );
    if (!needsZero) return {};
    return {
      writes: {
        vitals: Object.freeze({
          entries: Object.freeze(
            vitals.entries.map((entry) =>
              freezeVitalsEntry({
                competitorId: entry.competitorId,
                alive: entry.alive,
                spawnProtectionRemainingMs: 0,
              }),
            ),
          ),
        }),
      },
    };
  }

  if (match.phase !== "playing") {
    return {};
  }

  let changed = false;
  const entries = vitals.entries.map((entry) => {
    if (!entry.alive || entry.spawnProtectionRemainingMs === 0) return entry;
    changed = true;
    return freezeVitalsEntry({
      competitorId: entry.competitorId,
      alive: true,
      spawnProtectionRemainingMs: Math.max(
        0,
        entry.spawnProtectionRemainingMs - TICK_DURATION_MS,
      ),
    });
  });
  if (!changed) return {};
  return {
    writes: {
      vitals: Object.freeze({ entries: Object.freeze(entries) }),
    },
  };
}

/**
 * pressure-impact barrier: simultaneously kill every living body with
 * positive AABB overlap on the impact tile (exact edge contact is safe).
 * Spawn protection never applies in sudden death.
 */
function runPressureImpactDamage(ctx: SystemRunContext): SystemRunResult {
  const impacts = factsOfKind(ctx.facts, "pressure-impact");
  if (impacts.length === 0) return {};

  const match = ctx.read("match");
  if (match.phase !== "sudden-death") {
    // Impacts only occur while Match is in sudden-death; ignore otherwise.
    return {};
  }

  const locomotion = ctx.read("locomotion");
  const vitals = ctx.read("vitals");
  const skills = ctx.read("skills");
  const immune = new Set(
    skills.entries
      .filter((entry) => entry.phase === "channeling")
      .map((entry) => entry.competitorId),
  );

  type Hit = Readonly<{
    competitorId: CompetitorId;
    pressureIndex: number;
    at: { x: number; y: number };
  }>;
  const hits: Hit[] = [];

  for (const entry of locomotion.entries) {
    const row = vitals.entries.find((item) => item.competitorId === entry.competitorId);
    if (!row?.alive) continue;
    if (immune.has(entry.competitorId)) continue;

    // Collect all overlapping impacts (stable order by pressureIndex).
    const overlapped = impacts
      .filter((fact) => bodyOverlapsTile(entry.position, fact.tile))
      .sort((left, right) => left.pressureIndex - right.pressureIndex);
    if (overlapped.length === 0) continue;

    const primary = overlapped[0]!;
    hits.push(
      Object.freeze({
        competitorId: entry.competitorId,
        pressureIndex: primary.pressureIndex,
        at: freezeTile(primary.tile),
      }),
    );
  }

  hits.sort((left, right) =>
    left.competitorId < right.competitorId
      ? -1
      : left.competitorId > right.competitorId
        ? 1
        : 0,
  );

  if (hits.length === 0) return {};

  const dead = new Set(hits.map((hit) => hit.competitorId));
  const events: GameEvent[] = hits.map((hit) =>
    Object.freeze({
      type: "competitor-eliminated" as const,
      competitorId: hit.competitorId,
      causes: Object.freeze([
        Object.freeze({
          kind: "pressure" as const,
          pressureIndex: hit.pressureIndex,
          at: freezeTile(hit.at),
        }),
      ]),
    }),
  );

  const nextVitals = vitals.entries.map((entry) => {
    if (!dead.has(entry.competitorId)) {
      return freezeVitalsEntry({
        competitorId: entry.competitorId,
        alive: entry.alive,
        spawnProtectionRemainingMs: 0,
      });
    }
    return freezeVitalsEntry({
      competitorId: entry.competitorId,
      alive: false,
      spawnProtectionRemainingMs: 0,
    });
  });

  return {
    writes: {
      vitals: Object.freeze({ entries: Object.freeze(nextVitals) }),
    },
    events,
  };
}

/**
 * Simultaneous damage: every living unprotected competitor whose body has
 * positive-area overlap with any flame tile is eliminated against the same
 * pre-state. Protected competitors ignore flames (no event, no extension).
 * Exact edge contact does not kill. Sole writer of vitals (with vitals-cycle).
 */
function runDamage(ctx: SystemRunContext): SystemRunResult {
  const match = ctx.read("match");
  if (!isGameplayActive(match.phase)) {
    return {};
  }

  const flames = ctx.read("flames");
  const locomotion = ctx.read("locomotion");
  const vitals = ctx.read("vitals");
  const skills = ctx.read("skills");
  const immune = new Set(
    skills.entries
      .filter((entry) => entry.phase === "channeling")
      .map((entry) => entry.competitorId),
  );

  // Effective protection: sudden-death is always unprotected even if residual.
  const effectiveProtection = (entry: VitalsEntry): number => {
    if (match.phase === "sudden-death") return 0;
    return entry.spawnProtectionRemainingMs;
  };

  type Hit = Readonly<{
    competitorId: CompetitorId;
    causes: FlameEntry["causes"];
  }>;
  const hits: Hit[] = [];

  for (const entry of locomotion.entries) {
    const row = vitals.entries.find((item) => item.competitorId === entry.competitorId);
    if (!row?.alive) continue;
    if (immune.has(entry.competitorId)) continue;
    if (effectiveProtection(row) > 0) continue;

    const merged: FlameEntry["causes"][number][] = [];
    const seen = new Set<string>();
    for (const flame of flames.items) {
      if (!bodyOverlapsTile(entry.position, flame.tile)) continue;
      for (const cause of flame.causes) {
        const key = `${cause.bombId}|${cause.ownerId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push(cause);
      }
    }
    if (merged.length === 0) continue;

    merged.sort((left, right) => {
      if (left.bombId !== right.bombId) return left.bombId - right.bombId;
      return left.ownerId < right.ownerId ? -1 : left.ownerId > right.ownerId ? 1 : 0;
    });

    hits.push(
      Object.freeze({
        competitorId: entry.competitorId,
        causes: Object.freeze(merged),
      }),
    );
  }

  hits.sort((left, right) =>
    left.competitorId < right.competitorId
      ? -1
      : left.competitorId > right.competitorId
        ? 1
        : 0,
  );

  if (hits.length === 0) {
    // Still may need to persist sudden-death zeroing if vitals-cycle ran earlier
    // with residual — already handled in vitals-cycle. Damage is no-op.
    return {};
  }

  const dead = new Set(hits.map((hit) => hit.competitorId));
  const events: GameEvent[] = hits.map((hit) =>
    Object.freeze({
      type: "competitor-eliminated" as const,
      competitorId: hit.competitorId,
      causes: Object.freeze(
        hit.causes.map((cause) =>
          Object.freeze({
            kind: "bomb" as const,
            bombId: cause.bombId,
            ownerId: cause.ownerId,
          }),
        ),
      ),
    }),
  );

  const nextVitals = vitals.entries.map((entry) => {
    if (!dead.has(entry.competitorId)) {
      // Keep protection as-is (already decremented in timer/cycle systems).
      if (match.phase === "sudden-death" && entry.spawnProtectionRemainingMs !== 0) {
        return freezeVitalsEntry({
          competitorId: entry.competitorId,
          alive: entry.alive,
          spawnProtectionRemainingMs: 0,
        });
      }
      return entry;
    }
    return freezeVitalsEntry({
      competitorId: entry.competitorId,
      alive: false,
      spawnProtectionRemainingMs: 0,
    });
  });

  return {
    writes: {
      vitals: Object.freeze({ entries: Object.freeze(nextVitals) }),
    },
    events,
  };
}

function initialRosterVitals(config: MatchConfig): {
  roster: RosterSlice;
  vitals: VitalsSlice;
} {
  const rosterEntries: RosterEntry[] = [];
  const vitalsEntries: VitalsEntry[] = [];
  for (const assignment of config.seats) {
    rosterEntries.push(
      Object.freeze({
        competitorId: assignment.competitorId,
        seatId: assignment.seatId,
      }),
    );
    vitalsEntries.push(
      freezeVitalsEntry({
        competitorId: assignment.competitorId,
        alive: true,
        spawnProtectionRemainingMs: 0,
      }),
    );
  }
  return {
    roster: Object.freeze({ entries: Object.freeze(rosterEntries) }),
    vitals: Object.freeze({ entries: Object.freeze(vitalsEntries) }),
  };
}

function restoreRosterVitals(
  rawRoster: unknown,
  rawVitals: unknown,
  config: MatchConfig,
): { roster: RosterSlice; vitals: VitalsSlice } {
  const seatOrder = config.seats.map((seat) => seat.competitorId);
  const seatByCompetitor = new Map(
    config.seats.map((seat) => [seat.competitorId, seat.seatId] as const),
  );
  const seatSet = new Set(seatOrder);

  if (!rawRoster || typeof rawRoster !== "object") {
    throw new Error("slices.roster must be an object.");
  }
  const rosterRaw = rawRoster as { entries?: unknown };
  if (!Array.isArray(rosterRaw.entries)) {
    throw new Error("slices.roster.entries must be an array.");
  }
  const rosterEntries = rosterRaw.entries.map((entry, index) => {
    if (!entry || typeof entry !== "object") {
      throw new Error(`slices.roster.entries[${index}] is invalid.`);
    }
    const row = entry as Record<string, unknown>;
    if (typeof row.competitorId !== "string" || !seatSet.has(row.competitorId as CompetitorId)) {
      throw new Error(`slices.roster.entries[${index}].competitorId is invalid.`);
    }
    if (typeof row.seatId !== "string") {
      throw new Error(`slices.roster.entries[${index}].seatId is invalid.`);
    }
    const expectedSeat = seatByCompetitor.get(row.competitorId as CompetitorId);
    if (row.seatId !== expectedSeat) {
      throw new Error(
        `slices.roster.entries[${index}].seatId must match MatchConfig for that competitor.`,
      );
    }
    // Reject legacy roster stats — progression is the sole source (Decision 009).
    if ("maxBombs" in row) {
      throw new Error(
        `slices.roster.entries[${index}] rejects maxBombs (use slices.progression).`,
      );
    }
    if ("flameRange" in row) {
      throw new Error(
        `slices.roster.entries[${index}] rejects flameRange (use slices.progression).`,
      );
    }
    return Object.freeze({
      competitorId: row.competitorId as CompetitorId,
      seatId: row.seatId as SeatId,
    });
  });
  assertCompetitorOrder(rosterEntries, seatOrder, "slices.roster.entries");

  if (!rawVitals || typeof rawVitals !== "object") {
    throw new Error("slices.vitals must be an object.");
  }
  const vitalsRaw = rawVitals as { entries?: unknown };
  if (!Array.isArray(vitalsRaw.entries)) {
    throw new Error("slices.vitals.entries must be an array.");
  }
  const vitalsEntries = vitalsRaw.entries.map((entry, index) => {
    if (!entry || typeof entry !== "object") {
      throw new Error(`slices.vitals.entries[${index}] is invalid.`);
    }
    const row = entry as Record<string, unknown>;
    if (typeof row.competitorId !== "string" || !seatSet.has(row.competitorId as CompetitorId)) {
      throw new Error(`slices.vitals.entries[${index}].competitorId is invalid.`);
    }
    if (typeof row.alive !== "boolean") {
      throw new Error(`slices.vitals.entries[${index}].alive must be boolean.`);
    }
    const spawnProtectionRemainingMs = assertInteger(
      row.spawnProtectionRemainingMs,
      `slices.vitals.entries[${index}].spawnProtectionRemainingMs`,
    );
    if (spawnProtectionRemainingMs % TICK_DURATION_MS !== 0) {
      throw new Error(
        `slices.vitals.entries[${index}].spawnProtectionRemainingMs must be tick-aligned.`,
      );
    }
    if (spawnProtectionRemainingMs > SPAWN_PROTECTION_MS) {
      throw new Error(
        `slices.vitals.entries[${index}].spawnProtectionRemainingMs exceeds SPAWN_PROTECTION_MS.`,
      );
    }
    if (!row.alive && spawnProtectionRemainingMs !== 0) {
      throw new Error(
        `slices.vitals.entries[${index}] dead competitor cannot carry spawn protection.`,
      );
    }
    return freezeVitalsEntry({
      competitorId: row.competitorId as CompetitorId,
      alive: row.alive,
      spawnProtectionRemainingMs,
    });
  });
  assertCompetitorOrder(vitalsEntries, seatOrder, "slices.vitals.entries");

  return {
    roster: Object.freeze({ entries: Object.freeze(rosterEntries) }),
    vitals: Object.freeze({ entries: Object.freeze(vitalsEntries) }),
  };
}


export const competitorsModule: ModuleSpec = Object.freeze({
  id: "competitors",
  version: MODULE_VERSION,
  owns: Object.freeze(["roster", "vitals"] as const),
  systems: Object.freeze([
    Object.freeze({
      id: "vitals-reset-system",
      phase: "round-reset" as const,
      reads: Object.freeze(["vitals", "match"] as const),
      writes: Object.freeze(["vitals"] as const),
      run: runVitalsReset,
    }),
    Object.freeze({
      id: "protection-timer-system",
      phase: "protection" as const,
      reads: Object.freeze(["vitals", "match"] as const),
      writes: Object.freeze(["vitals"] as const),
      run: runProtectionTimer,
    }),
    Object.freeze({
      id: "competitors-pressure-impact-system",
      phase: "pressure-impact" as const,
      reads: Object.freeze(["locomotion", "vitals", "match", "skills"] as const),
      writes: Object.freeze(["vitals"] as const),
      run: runPressureImpactDamage,
    }),
    Object.freeze({
      id: "damage-system",
      phase: "damage" as const,
      reads: Object.freeze(["flames", "locomotion", "vitals", "match", "skills"] as const),
      writes: Object.freeze(["vitals"] as const),
      run: runDamage,
    }),
  ]),
  codecs: Object.freeze({
    initial(config: MatchConfig) {
      return Object.freeze(initialRosterVitals(config));
    },
    restore(
      rawOwned: Readonly<Partial<Record<"roster" | "vitals", unknown>>>,
      config: MatchConfig,
    ) {
      return Object.freeze(
        restoreRosterVitals(rawOwned.roster, rawOwned.vitals, config),
      );
    },
  }),
});
