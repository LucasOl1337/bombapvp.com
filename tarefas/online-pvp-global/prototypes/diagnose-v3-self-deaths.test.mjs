// @vitest-environment node

import { describe, it } from "vitest";
import { createDefaultArenaDefinition } from "../../../src/original-game/Arenas/arena.ts";
import { GameApp } from "../../../src/original-game/Engine/game-app.ts";
import {
  BOT_V3_CHARACTER_INDEX,
  getBotV3Decision,
} from "../../../src/original-game/Engine/bot-v3.ts";
import { getBotV2Decision } from "../../../src/original-game/Engine/bot-v2.ts";

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

function diagnoseMatch(matchIndex, lineup, seedPrefix) {
  const baseArena = createDefaultArenaDefinition();
  const arena = {
    ...baseArena,
    tiles: { ...baseArena.tiles, breakable: [] },
    randomSeed: `${seedPrefix}-${matchIndex}`,
  };
  const game = new GameApp({}, assets(), arena);
  const recentDecisions = [];
  let currentTick = -1;
  let previousSnapshot = null;
  game.startServerAuthoritativeMatch(
    [1, 2, 3],
    { 1: BOT_V3_CHARACTER_INDEX, 2: BOT_V3_CHARACTER_INDEX, 3: BOT_V3_CHARACTER_INDEX, 4: BOT_V3_CHARACTER_INDEX },
    {
      roomMode: "endless",
      botPlayerIds: [1, 2, 3],
      botDecisionPolicies: {
        [lineup.v2]: getBotV2Decision,
        [lineup.v3]: getBotV3Decision,
      },
      botDecisionObserver: ({ playerId, decision }) => {
        if (playerId !== lineup.v3) return;
        recentDecisions.push({ tick: currentTick, decision, player: previousSnapshot?.players[playerId] ?? null });
        if (recentDecisions.length > 90) recentDecisions.shift();
      },
    },
  );

  let wasAlive = true;
  for (currentTick = 0; currentTick < 4_000; currentTick += 1) {
    game.advanceServerSimulation(50);
    const snapshot = game.exportOnlineSnapshot();
    const isAlive = snapshot.players[lineup.v3].alive;
    if (wasAlive && !isAlive) {
      return {
        seed: arena.randomSeed,
        lineup,
        tick: currentTick,
        selfDeaths: snapshot.endlessStats?.selfDeaths?.[lineup.v3] ?? 0,
        beforeDeath: previousSnapshot && {
          player: previousSnapshot.players[lineup.v3],
          bombs: previousSnapshot.bombs,
          flames: previousSnapshot.flames,
        },
        recentDecisions,
      };
    }
    wasAlive = isAlive;
    previousSnapshot = snapshot;
    if (snapshot.roundOutcome) return null;
  }
  throw new Error(`diagnostic_timeout:${arena.randomSeed}`);
}

describe("diagnóstico temporário das autoeliminações V3", () => {
  it("imprime apenas mortes próprias nas duas famílias de seeds", () => {
    const failures = [];
    const selectedIndex = process.env.V3_DIAG_INDEX === undefined
      ? null
      : Number.parseInt(process.env.V3_DIAG_INDEX, 10);
    const prefixes = process.env.V3_DIAG_PREFIX
      ? [process.env.V3_DIAG_PREFIX]
      : ["v3-fair-match", "stone-v3-generalization"];
    for (const prefix of prefixes) {
      for (const [index, lineup] of fairRandomLineups().entries()) {
        if (selectedIndex !== null && index !== selectedIndex) continue;
        const outcome = diagnoseMatch(index, lineup, prefix);
        if (outcome?.selfDeaths > 0) failures.push(outcome);
      }
    }
    console.log(JSON.stringify(failures.map((failure) => ({
      seed: failure.seed,
      lineup: failure.lineup,
      tick: failure.tick,
      selfDeaths: failure.selfDeaths,
      player: failure.beforeDeath && {
        tile: failure.beforeDeath.player.tile,
        position: failure.beforeDeath.player.position,
        velocity: failure.beforeDeath.player.velocity,
        skill: failure.beforeDeath.player.skill,
      },
      bombs: failure.beforeDeath?.bombs,
      flames: failure.beforeDeath?.flames,
      recentDecisions: failure.recentDecisions.map(({ tick, decision, player }) => ({
        tick,
        decision,
        player: player && {
          tile: player.tile,
          position: player.position,
          skill: player.skill,
        },
      })),
    })), null, 2));
  }, 60_000);
});
