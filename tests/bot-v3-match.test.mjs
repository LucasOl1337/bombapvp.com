// @vitest-environment node

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createDefaultArenaDefinition } from "../src/original-game/Arenas/arena.ts";
import { GameApp } from "../src/original-game/Engine/game-app.ts";
import { BOT_V3_CHARACTER_INDEX } from "../src/original-game/Engine/bot-v3.ts";

// Compatibility floor for this safety patch. Promotion still requires the
// independent 10-consecutive-win gate documented in docs/gameplay.md.
const DEPLOYED_BASELINE_V3_WINS = 1;

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

function shuffled(values, seed) {
  const result = [...values];
  const random = seededRandom(seed);
  for (let index = result.length - 1; index > 0; index -= 1) {
    const selected = Math.floor(random() * (index + 1));
    [result[index], result[selected]] = [result[selected], result[index]];
  }
  return result;
}

function fairRandomLineups() {
  const lineups = [];
  for (let cycle = 0; cycle < 3; cycle += 1) {
    const slots = shuffled([1, 2, 3], `v3-position-cycle-${cycle}`);
    const offsets = shuffled([0, 1, 2], `v3-order-cycle-${cycle}`);
    for (const offset of offsets) {
      lineups.push({
        v3: slots[offset],
        v2: slots[(offset + 1) % 3],
        v1: slots[(offset + 2) % 3],
      });
    }
  }
  const extra = shuffled([1, 2, 3], "v3-position-extra");
  lineups.push({ v3: extra[0], v2: extra[1], v1: extra[2] });
  return lineups;
}

function playMatch(matchIndex, lineup, seedPrefix = "v3-fair-match") {
  const baseArena = createDefaultArenaDefinition();
  const arena = {
    ...baseArena,
    tiles: { ...baseArena.tiles, breakable: [] },
    randomSeed: `${seedPrefix}-${matchIndex}`,
  };
  const game = new GameApp({}, assets(), arena);
  const actions = { decisions: 0, skills: 0, bombs: 0 };
  const deaths = [];
  const alive = { 1: true, 2: true, 3: true };
  let previousSnapshot = null;
  let v3DeathContext = null;
  game.startServerAuthoritativeMatch(
    [1, 2, 3],
    {
      1: BOT_V3_CHARACTER_INDEX,
      2: BOT_V3_CHARACTER_INDEX,
      3: BOT_V3_CHARACTER_INDEX,
      4: BOT_V3_CHARACTER_INDEX,
    },
    {
      roomMode: "endless",
      botPlayerIds: [1, 2, 3],
      botV2PlayerIds: [lineup.v2],
      botV3PlayerIds: [lineup.v3],
      botDecisionObserver: ({ playerId, decision }) => {
        if (playerId !== lineup.v3) return;
        actions.decisions += 1;
        if (decision.useSkill) actions.skills += 1;
        if (decision.placeBomb) actions.bombs += 1;
      },
    },
  );

  for (let tick = 0; tick < 4_000; tick += 1) {
    game.advanceServerSimulation(50);
    const snapshot = game.exportOnlineSnapshot();
    for (const playerId of [1, 2, 3]) {
      if (alive[playerId] && !snapshot.players[playerId].alive) {
        alive[playerId] = false;
        deaths.push({ playerId, tick, tile: snapshot.players[playerId].tile });
        if (playerId === lineup.v3 && previousSnapshot) {
          v3DeathContext = {
            player: previousSnapshot.players[playerId],
            opponents: [1, 2, 3].filter((id) => id !== playerId).map((id) => previousSnapshot.players[id]),
            bombs: previousSnapshot.bombs,
            flames: previousSnapshot.flames,
          };
        }
      }
    }
    if (snapshot.roundOutcome) {
      return {
        seed: arena.randomSeed,
        lineup,
        winner: snapshot.roundOutcome.winner,
        reason: snapshot.roundOutcome.reason,
        ticks: tick,
        actions,
        deaths,
        deathStats: snapshot.endlessStats,
        v3DeathContext,
      };
    }
    previousSnapshot = snapshot;
  }
  throw new Error(`v3_match_timeout:${matchIndex}`);
}

describe("bot determinístico V3", () => {
  it("usa uma política própria, sem delegar aos algoritmos V1 ou V2", () => {
    const source = readFileSync(new URL("../src/original-game/Engine/bot-v3.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/getBot(?:V1|V2)?Decision\s*\(/);
    expect(source).toContain("buildThreatMap");
    expect(source).toContain("search(");
  });

  it("descarta a variante V3 ao sair da sessão do laboratório", () => {
    const game = new GameApp({}, assets(), createDefaultArenaDefinition());
    game.startServerAuthoritativeMatch(
      [1, 2, 3],
      { 1: 0, 2: 0, 3: 0, 4: 0 },
      { botPlayerIds: [1, 2, 3], botV2PlayerIds: [2], botV3PlayerIds: [3] },
    );
    expect(game.botV3ControlledPlayers).toMatchObject({ 1: false, 2: false, 3: true });

    game.clearOnlinePeer();

    expect(game.botV3ControlledPlayers).toEqual({ 1: false, 2: false, 3: false, 4: false });
  });

  it("executa dez partidas pós-hotfix com posições aleatórias e sem autoeliminação", () => {
    const lineups = fairRandomLineups();
    const slotCounts = { 1: 0, 2: 0, 3: 0 };
    for (const lineup of lineups) slotCounts[lineup.v3] += 1;

    expect(lineups).toHaveLength(10);
    expect(new Set(lineups.map(({ v3 }) => v3))).toEqual(new Set([1, 2, 3]));
    expect(Math.max(...Object.values(slotCounts)) - Math.min(...Object.values(slotCounts))).toBeLessThanOrEqual(1);

    const outcomes = lineups.map((lineup, index) => playMatch(index, lineup));
    console.log(JSON.stringify({
      slotCounts,
      outcomes: outcomes.map(({ seed, lineup, winner, ticks, actions, deathStats }) => ({
        seed,
        lineup,
        winner,
        ticks,
        actions,
        v3Stats: {
          kills: deathStats?.kills?.[lineup.v3] ?? 0,
          deaths: deathStats?.deaths?.[lineup.v3] ?? 0,
          selfDeaths: deathStats?.selfDeaths?.[lineup.v3] ?? 0,
        },
      })),
    }, null, 2));
    expect(outcomes).toHaveLength(10);
    expect(outcomes.filter(({ winner, lineup }) => winner === lineup.v3).length)
      .toBeGreaterThanOrEqual(DEPLOYED_BASELINE_V3_WINS);
    expect(outcomes.every(({ deathStats, lineup }) => (
      (deathStats?.selfDeaths?.[lineup.v3] ?? 0) === 0
    ))).toBe(true);
  }, 60_000);

  it("generaliza a segurança para dez seeds não usadas no hotfix", () => {
    const outcomes = fairRandomLineups().map((lineup, index) => (
      playMatch(index, lineup, "stone-v3-generalization")
    ));

    expect(outcomes).toHaveLength(10);
    expect(outcomes.filter(({ winner, lineup }) => winner === lineup.v3).length)
      .toBeGreaterThanOrEqual(DEPLOYED_BASELINE_V3_WINS);
    expect(outcomes.every(({ deathStats, lineup }) => (
      (deathStats?.selfDeaths?.[lineup.v3] ?? 0) === 0
    ))).toBe(true);
  }, 60_000);
});
