// @vitest-environment node

import { describe, expect, it } from "vitest";
import { GameApp } from "../src/original-game/Engine/game-app.ts";
import { createDefaultArenaDefinition } from "../src/original-game/Arenas/arena.ts";
import { BOT_V2_CHARACTER_INDEX } from "../src/original-game/Engine/bot-v2.ts";

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

function playDuel(seed, evaluatedPlayerId, useV2) {
  const arena = { ...createDefaultArenaDefinition(), randomSeed: seed };
  const game = new GameApp({}, assets(), arena);
  const actions = { decisions: 0, skillStarts: 0, skillHolds: 0, bombs: 0 };
  const skillIds = new Set();
  game.startServerAuthoritativeMatch(
    [1, 2],
    { 1: BOT_V2_CHARACTER_INDEX, 2: BOT_V2_CHARACTER_INDEX, 3: 2, 4: 3 },
    {
      roomMode: "endless",
      botPlayerIds: [1, 2],
      botV2PlayerIds: useV2 ? [evaluatedPlayerId] : [],
      botDecisionObserver: ({ playerId, decision }) => {
        if (playerId !== evaluatedPlayerId) return;
        actions.decisions += 1;
        if (decision.useSkill) actions.skillStarts += 1;
        if (decision.skillHeld) actions.skillHolds += 1;
        if (decision.placeBomb) actions.bombs += 1;
      },
    },
  );

  for (let tick = 0; tick < 4_000; tick += 1) {
    game.advanceServerSimulation(50);
    const snapshot = game.exportOnlineSnapshot();
    skillIds.add(snapshot.players[evaluatedPlayerId].skill.id);
    if (snapshot.roundOutcome) {
      return {
        winner: snapshot.roundOutcome.winner,
        selfDeaths: snapshot.endlessStats?.selfDeaths?.[evaluatedPlayerId] ?? 0,
        opponentDeaths: snapshot.endlessStats?.opponentDeaths?.[evaluatedPlayerId] ?? 0,
        actions,
        skillIds: [...skillIds],
      };
    }
  }
  throw new Error(`duel_timeout:${seed}:p${evaluatedPlayerId}`);
}

function evaluate(useV2) {
  const duels = [];
  for (const seed of ["v2-a", "v2-b", "v2-c", "v2-d"]) {
    duels.push({ seed, evaluatedPlayerId: 1, ...playDuel(seed, 1, useV2) });
    duels.push({ seed, evaluatedPlayerId: 2, ...playDuel(seed, 2, useV2) });
  }
  return {
    duels,
    wins: duels.filter((duel) => duel.winner === duel.evaluatedPlayerId).length,
    selfDeaths: duels.reduce((total, duel) => total + duel.selfDeaths, 0),
  };
}

describe("avaliação balanceada do bot V2", () => {
  it("não regride contra o V1 ao alternar seed e lado da arena", () => {
    const baseline = evaluate(false);
    const result = evaluate(true);
    console.log(JSON.stringify({ baseline, result }, null, 2));
    expect(new Set(result.duels.flatMap((duel) => duel.skillIds))).toEqual(new Set(["killer-bee-wing-dash"]));
    expect(result.selfDeaths).toBeLessThanOrEqual(baseline.selfDeaths);
    expect(result.wins).toBeGreaterThan(baseline.wins);
  }, 30_000);

  it("descarta a variante V2 ao sair da sessão do laboratório", () => {
    const game = new GameApp({}, assets(), createDefaultArenaDefinition());
    game.startServerAuthoritativeMatch(
      [1, 2],
      { 1: BOT_V2_CHARACTER_INDEX, 2: BOT_V2_CHARACTER_INDEX, 3: 2, 4: 3 },
      { botPlayerIds: [1, 2], botV2PlayerIds: [1] },
    );
    expect(game.botV2ControlledPlayers).toMatchObject({ 1: true, 2: false });

    game.clearOnlinePeer();

    expect(game.botV2ControlledPlayers).toEqual({ 1: false, 2: false, 3: false, 4: false });
  });
});
