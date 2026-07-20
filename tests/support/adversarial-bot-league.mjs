import { createDefaultArenaDefinition } from "../../src/original-game/Arenas/arena.ts";
import { GameApp } from "../../src/original-game/Engine/game-app.ts";

const PLAYER_IDS = [1, 2];
const STEP_MS = 50;

function assets() {
  return {
    players: {},
    characterRoster: [
      { id: "03a976fb-7313-4064-a477-5bb9b0760034", name: "Ranni", size: null, selectionIndex: 0 },
      { id: "6ee8baa5-3277-413b-ae0e-2659b9cc52e9", name: "Killer Bee", size: null, selectionIndex: 1 },
      { id: "d083c3dc-7162-4391-8628-6adde0b8d8d6", name: "Crocodilo", size: null, selectionIndex: 2 },
      { id: "5474c45c-2987-43e0-af2c-a6500c836881", name: "Nico", size: null, selectionIndex: 3 },
    ],
    characterSpriteLoader: async () => null,
    arenaTheme: {},
    floor: { base: null, lane: null, spawn: null },
    props: { wall: null, crate: null, bomb: null, flame: null },
    powerUps: {},
  };
}

function seededRandom(seed) {
  let state = 2166136261;
  for (const character of seed) {
    state ^= character.charCodeAt(0);
    state = Math.imul(state, 16777619);
  }
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x1_0000_0000;
  };
}

function arenaFor(variant, seed) {
  const base = createDefaultArenaDefinition();
  let breakable = [...base.tiles.breakable];
  if (variant === "open-no-drops") breakable = [];
  if (variant === "sparse-breakables") {
    const random = seededRandom(`sparse:${seed}`);
    breakable = breakable.filter(() => random() < 0.34);
  }
  const spawnRandom = seededRandom(`spawns:${seed}`);
  const shuffledSpawns = [...base.spawns];
  for (let index = shuffledSpawns.length - 1; index > 0; index -= 1) {
    const selected = Math.floor(spawnRandom() * (index + 1));
    [shuffledSpawns[index], shuffledSpawns[selected]] = [shuffledSpawns[selected], shuffledSpawns[index]];
  }
  return {
    ...base,
    id: `${base.id}:${variant}`,
    name: `${base.name} · ${variant}`,
    randomSeed: seed,
    tiles: { ...base.tiles, breakable },
    spawns: shuffledSpawns.map((spawn, index) => ({
      ...spawn,
      playerId: index + 1,
      tile: { ...spawn.tile },
    })),
  };
}

function percentile(values, fraction) {
  if (values.length === 0) return 0;
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[Math.min(ordered.length - 1, Math.ceil(ordered.length * fraction) - 1)];
}

function computeSummary(values) {
  return {
    mean: values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length,
    p95: percentile(values, 0.95),
    max: values.length === 0 ? 0 : Math.max(...values),
  };
}

function deathCause(stats, playerId) {
  if (!stats) return null;
  if ((stats.selfDeaths?.[playerId] ?? 0) > 0) return "self";
  if ((stats.opponentDeaths?.[playerId] ?? 0) > 0) return "opponent";
  if ((stats.suddenDeathDeaths?.[playerId] ?? 0) > 0) return "sudden-death";
  if ((stats.environmentDeaths?.[playerId] ?? 0) > 0) return "environment";
  return null;
}

export function playAdversarialMatch({
  seed,
  arenaVariant,
  characterIndex,
  policies,
  spawnOrder,
  maxTicks = 4_000,
}) {
  const arena = arenaFor(arenaVariant, seed);
  const game = new GameApp({}, assets(), arena);
  const latestDecision = { 1: null, 2: null };
  const computeMs = { 1: [], 2: [] };
  const decisions = { 1: 0, 2: 0 };
  const movementDecisions = { 1: 0, 2: 0 };
  const attackDecisions = { 1: 0, 2: 0 };
  const idleMs = { 1: 0, 2: 0 };
  const stuckMs = { 1: 0, 2: 0 };
  const currentStuckMs = { 1: 0, 2: 0 };
  const longestStuckMs = { 1: 0, 2: 0 };
  const previousTile = { 1: null, 2: null };

  game.startServerAuthoritativeMatch(
    PLAYER_IDS,
    { 1: characterIndex, 2: characterIndex, 3: characterIndex, 4: characterIndex },
    {
      roomMode: "endless",
      botPlayerIds: PLAYER_IDS,
      playerLabels: { 1: spawnOrder[0], 2: spawnOrder[1], 3: "", 4: "" },
      botDecisionPolicies: {
        1: policies[spawnOrder[0]],
        2: policies[spawnOrder[1]],
      },
      botDecisionObserver: ({ playerId, decision, computeMs: elapsedMs }) => {
        if (!PLAYER_IDS.includes(playerId)) return;
        latestDecision[playerId] = decision;
        computeMs[playerId].push(elapsedMs);
        decisions[playerId] += 1;
        if (decision.direction) movementDecisions[playerId] += 1;
        if (decision.placeBomb || decision.detonate || decision.useSkill) {
          attackDecisions[playerId] += 1;
        }
      },
    },
  );

  let snapshot = game.exportOnlineSnapshot();
  let ticks = 0;
  for (; ticks < maxTicks && !snapshot.roundOutcome; ticks += 1) {
    game.advanceServerSimulation(STEP_MS);
    snapshot = game.exportOnlineSnapshot();
    for (const playerId of PLAYER_IDS) {
      const player = snapshot.players[playerId];
      const tile = `${player.tile.x},${player.tile.y}`;
      const decision = latestDecision[playerId];
      if (player.alive && previousTile[playerId] === tile && decision) {
        const attacking = decision.placeBomb || decision.detonate || decision.useSkill;
        if (!decision.direction && !attacking) idleMs[playerId] += STEP_MS;
        if (decision.direction) {
          stuckMs[playerId] += STEP_MS;
          currentStuckMs[playerId] += STEP_MS;
          longestStuckMs[playerId] = Math.max(longestStuckMs[playerId], currentStuckMs[playerId]);
        } else {
          currentStuckMs[playerId] = 0;
        }
      } else {
        currentStuckMs[playerId] = 0;
      }
      previousTile[playerId] = tile;
    }
  }

  const stats = snapshot.endlessStats;
  const metrics = Object.fromEntries(PLAYER_IDS.map((playerId) => {
    const identity = spawnOrder[playerId - 1];
    return [identity, {
      playerId,
      decisions: decisions[playerId],
      movementDecisions: movementDecisions[playerId],
      attackDecisions: attackDecisions[playerId],
      idleMs: idleMs[playerId],
      stuckMs: stuckMs[playerId],
      longestStuckMs: longestStuckMs[playerId],
      computeMs: computeSummary(computeMs[playerId]),
      deaths: stats?.deaths?.[playerId] ?? 0,
      selfDeaths: stats?.selfDeaths?.[playerId] ?? 0,
      deathCause: deathCause(stats, playerId),
    }];
  }));
  const winner = snapshot.roundOutcome?.winner ?? null;
  return {
    seed,
    arenaVariant,
    spawnOrder: [...spawnOrder],
    spawnTiles: Object.fromEntries(PLAYER_IDS.map((playerId) => [
      spawnOrder[playerId - 1],
      arena.spawns.find((spawn) => spawn.playerId === playerId)?.tile,
    ])),
    characterIndex,
    ticks,
    durationMs: ticks * STEP_MS,
    timedOut: !snapshot.roundOutcome,
    winner: winner === null ? null : spawnOrder[winner - 1],
    reason: snapshot.roundOutcome?.reason ?? "harness-timeout",
    metrics,
  };
}

export function runMirroredSeries({ policies, cases, characterIndex = 0, maxTicks = 4_000 }) {
  const identities = Object.keys(policies);
  if (identities.length !== 2) throw new Error("adversarial_league_requires_two_policies");
  return cases.flatMap(({ seed, arenaVariant }) => [
    playAdversarialMatch({
      seed,
      arenaVariant,
      characterIndex,
      policies,
      spawnOrder: identities,
      maxTicks,
    }),
    playAdversarialMatch({
      seed,
      arenaVariant,
      characterIndex,
      policies,
      spawnOrder: [...identities].reverse(),
      maxTicks,
    }),
  ]);
}

export function summarizeSeries(outcomes, identities) {
  return Object.fromEntries(identities.map((identity) => {
    const metrics = outcomes.map((outcome) => outcome.metrics[identity]);
    const compute = metrics.map((entry) => entry.computeMs);
    return [identity, {
      wins: outcomes.filter((outcome) => outcome.winner === identity).length,
      losses: outcomes.filter((outcome) => outcome.winner && outcome.winner !== identity).length,
      draws: outcomes.filter((outcome) => outcome.winner === null).length,
      selfDeaths: metrics.reduce((sum, entry) => sum + entry.selfDeaths, 0),
      idleMs: metrics.reduce((sum, entry) => sum + entry.idleMs, 0),
      stuckMs: metrics.reduce((sum, entry) => sum + entry.stuckMs, 0),
      longestStuckMs: Math.max(0, ...metrics.map((entry) => entry.longestStuckMs)),
      decisions: metrics.reduce((sum, entry) => sum + entry.decisions, 0),
      computeMs: {
        mean: compute.reduce((sum, entry) => sum + entry.mean, 0) / Math.max(1, compute.length),
        p95: Math.max(0, ...compute.map((entry) => entry.p95)),
        max: Math.max(0, ...compute.map((entry) => entry.max)),
      },
    }];
  }));
}
