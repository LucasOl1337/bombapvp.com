// @vitest-environment node

import { describe, it } from "vitest";
import { createDefaultArenaDefinition } from "../../../src/original-game/Arenas/arena.ts";
import { GameApp } from "../../../src/original-game/Engine/game-app.ts";
import {
  BOT_V2_CHARACTER_INDEX,
  getBotV2Decision,
} from "../../../src/original-game/Engine/bot-v2.ts";

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

function diagnoseDuel(seed, evaluatedPlayerId) {
  const game = new GameApp({}, assets(), { ...createDefaultArenaDefinition(), randomSeed: seed });
  const recentDecisions = [];
  let currentTick = -1;
  let previousSnapshot = null;
  let deathContext = null;
  game.startServerAuthoritativeMatch(
    [1, 2],
    { 1: BOT_V2_CHARACTER_INDEX, 2: BOT_V2_CHARACTER_INDEX, 3: 2, 4: 3 },
    {
      roomMode: "endless",
      botPlayerIds: [1, 2],
      botDecisionPolicies: { [evaluatedPlayerId]: getBotV2Decision },
      botDecisionObserver: ({ playerId, decision }) => {
        if (playerId !== evaluatedPlayerId) return;
        const live = game.exportOnlineSnapshot();
        const state = live.players[evaluatedPlayerId];
        recentDecisions.push({
          tick: currentTick,
          decision,
          player: {
            tile: state.tile,
            position: state.position,
            direction: state.direction,
            lastMoveDirection: state.lastMoveDirection,
            skillPhase: state.skill.phase,
            cooldownRemainingMs: state.skill.cooldownRemainingMs,
          },
          bombs: live.bombs.map((bomb) => ({
            id: bomb.id,
            ownerId: bomb.ownerId,
            tile: bomb.tile,
            fuseMs: Math.round(bomb.fuseMs),
          })),
        });
        if (recentDecisions.length > 60) recentDecisions.shift();
      },
    },
  );

  let wasAlive = true;
  for (currentTick = 0; currentTick < 4_000; currentTick += 1) {
    game.advanceServerSimulation(50);
    const snapshot = game.exportOnlineSnapshot();
    const isAlive = snapshot.players[evaluatedPlayerId].alive;
    if (wasAlive && !isAlive && previousSnapshot) {
      deathContext = {
        tick: currentTick,
        player: previousSnapshot.players[evaluatedPlayerId],
        opponent: previousSnapshot.players[evaluatedPlayerId === 1 ? 2 : 1],
        bombs: previousSnapshot.bombs,
        flames: previousSnapshot.flames,
        recentDecisions: [...recentDecisions],
      };
    }
    wasAlive = isAlive;
    previousSnapshot = snapshot;
    if (snapshot.roundOutcome) {
      const selfDeaths = snapshot.endlessStats?.selfDeaths?.[evaluatedPlayerId] ?? 0;
      return selfDeaths > 0 ? { seed, evaluatedPlayerId, selfDeaths, deathContext } : null;
    }
  }
  throw new Error(`diagnostic_timeout:${seed}:p${evaluatedPlayerId}`);
}

describe("diagnóstico temporário das autoeliminações V2", () => {
  it("imprime apenas mortes próprias no lote de generalização", () => {
    const failures = [];
    const selectedSeed = process.env.V2_DIAG_SEED ?? null;
    const selectedPlayer = process.env.V2_DIAG_PLAYER === undefined
      ? null
      : Number.parseInt(process.env.V2_DIAG_PLAYER, 10);
    for (const seed of [
      "stone-v2-generalization-a",
      "stone-v2-generalization-b",
      "stone-v2-generalization-c",
      "stone-v2-generalization-d",
    ]) {
      if (selectedSeed !== null && seed !== selectedSeed) continue;
      for (const evaluatedPlayerId of [1, 2]) {
        if (selectedPlayer !== null && evaluatedPlayerId !== selectedPlayer) continue;
        const outcome = diagnoseDuel(seed, evaluatedPlayerId);
        if (outcome) failures.push(outcome);
      }
    }
    console.log(JSON.stringify(failures.map((failure) => ({
      seed: failure.seed,
      evaluatedPlayerId: failure.evaluatedPlayerId,
      selfDeaths: failure.selfDeaths,
      death: failure.deathContext && {
        tick: failure.deathContext.tick,
        tile: failure.deathContext.player.tile,
        position: failure.deathContext.player.position,
        skill: failure.deathContext.player.skill,
        bombs: failure.deathContext.bombs,
        flames: failure.deathContext.flames,
      },
      trace: failure.deathContext?.recentDecisions.map((entry) => ({
        tick: entry.tick,
        x: Math.round(entry.player.position.x * 10) / 10,
        y: Math.round(entry.player.position.y * 10) / 10,
        tile: entry.player.tile,
        actual: entry.player.direction,
        requested: entry.decision.direction ?? null,
        placeBomb: Boolean(entry.decision.placeBomb),
        bombs: entry.bombs.map((bomb) => [bomb.id, bomb.tile.x, bomb.tile.y, bomb.fuseMs]),
      })),
    })), null, 2));
  }, 60_000);
});
