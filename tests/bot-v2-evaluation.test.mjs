// @vitest-environment node

import { describe, expect, it } from "vitest";
import { GameApp } from "../src/original-game/Engine/game-app.ts";
import { createDefaultArenaDefinition } from "../src/original-game/Arenas/arena.ts";
import { BOT_V2_CHARACTER_INDEX, getBotV2Decision } from "../src/original-game/Engine/bot-v2.ts";
import { TILE_SIZE } from "../src/original-game/PersonalConfig/config.ts";

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

function countAuthoritativeSkillStart(previousPhase, currentPhase, requestCount) {
  return requestCount > 0 && previousPhase !== "channeling" && currentPhase === "channeling" ? 1 : 0;
}

function bodyBombOverlapArea(position, tile) {
  const tileCenter = {
    x: tile.x * TILE_SIZE + TILE_SIZE / 2,
    y: tile.y * TILE_SIZE + TILE_SIZE / 2,
  };
  const playerHalf = TILE_SIZE / 2;
  const tileHalf = TILE_SIZE / 2;
  const overlapWidth = Math.max(
    0,
    Math.min(playerHalf, position.x - tileCenter.x + tileHalf)
      - Math.max(-playerHalf, position.x - tileCenter.x - tileHalf),
  );
  const overlapHeight = Math.max(
    0,
    Math.min(playerHalf, position.y - tileCenter.y + tileHalf)
      - Math.max(-playerHalf, position.y - tileCenter.y - tileHalf),
  );
  return overlapWidth * overlapHeight;
}

function playDuel(seed, evaluatedPlayerId, useV2) {
  const arena = { ...createDefaultArenaDefinition(), randomSeed: seed };
  const game = new GameApp({}, assets(), arena);
  const actions = { decisions: 0, skillRequests: 0, skillStarts: 0, skillHolds: 0, bombs: 0, skillEvents: [] };
  const skillIds = new Set();
  let previousSkillPhase = "idle";
  game.startServerAuthoritativeMatch(
    [1, 2],
    { 1: BOT_V2_CHARACTER_INDEX, 2: BOT_V2_CHARACTER_INDEX, 3: 2, 4: 3 },
    {
      roomMode: "endless",
      botPlayerIds: [1, 2],
      botDecisionPolicies: useV2 ? { [evaluatedPlayerId]: getBotV2Decision } : {},
      botDecisionObserver: ({ playerId, decision }) => {
        if (playerId !== evaluatedPlayerId) return;
        actions.decisions += 1;
        if (decision.useSkill) {
          actions.skillRequests += 1;
          const state = game.exportOnlineSnapshot().players[evaluatedPlayerId];
          actions.skillEvents.push({
            decision: actions.decisions,
            direction: decision.direction,
            tile: state.tile,
            position: state.position,
            activeBombs: state.activeBombs,
          });
        }
        if (decision.skillHeld) actions.skillHolds += 1;
        if (decision.placeBomb) actions.bombs += 1;
      },
    },
  );

  for (let tick = 0; tick < 4_000; tick += 1) {
    const requestsBeforeAdvance = actions.skillRequests;
    game.advanceServerSimulation(50);
    const snapshot = game.exportOnlineSnapshot();
    const evaluatedSkill = snapshot.players[evaluatedPlayerId].skill;
    skillIds.add(evaluatedSkill.id);
    actions.skillStarts += countAuthoritativeSkillStart(
      previousSkillPhase,
      evaluatedSkill.phase,
      actions.skillRequests - requestsBeforeAdvance,
    );
    previousSkillPhase = evaluatedSkill.phase;
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

function evaluate(useV2, seeds = ["v2-a", "v2-b", "v2-c", "v2-d"]) {
  const duels = [];
  for (const seed of seeds) {
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
  it("conta o cast que começa no mesmo avanço em que o cooldown zera", () => {
    expect(countAuthoritativeSkillStart("cooldown", "channeling", 1)).toBe(1);
    expect(countAuthoritativeSkillStart("cooldown", "cooldown", 1)).toBe(0);
  });

  it("observa cooldown→channeling e request rejeitado em avanços reais do GameApp", () => {
    function createInstrumentedGame(policy) {
      const arena = createDefaultArenaDefinition();
      const openArena = { ...arena, tiles: { ...arena.tiles, breakable: [] } };
      const game = new GameApp({}, assets(), openArena);
      let skillRequests = 0;
      game.startServerAuthoritativeMatch(
        [1, 2],
        { 1: BOT_V2_CHARACTER_INDEX, 2: BOT_V2_CHARACTER_INDEX, 3: 2, 4: 3 },
        {
          arena: openArena,
          roomMode: "endless",
          botPlayerIds: [1],
          botDecisionPolicies: { 1: policy },
          botDecisionObserver: ({ playerId, decision }) => {
            if (playerId === 1 && decision.useSkill) skillRequests += 1;
          },
        },
      );
      game.advanceServerSimulation(1_300);
      const snapshot = game.exportOnlineSnapshot();
      Object.assign(snapshot.players[1], {
        position: { x: 60, y: 60 },
        tile: { x: 1, y: 1 },
        direction: "right",
        lastMoveDirection: "right",
        spawnProtectionMs: 0,
      });
      Object.assign(snapshot.players[2], {
        position: { x: 180, y: 60 },
        tile: { x: 4, y: 1 },
      });
      game.applyOnlineSnapshot(snapshot);
      return { game, getSkillRequests: () => skillRequests };
    }

    let positiveArmed = false;
    const positive = createInstrumentedGame((player) => ({
      direction: "right",
      placeBomb: false,
      useSkill: positiveArmed && player.skill.phase === "idle",
      skillAction: "start",
    }));
    const positiveSnapshot = positive.game.exportOnlineSnapshot();
    positiveSnapshot.players[1].skill.phase = "cooldown";
    positiveSnapshot.players[1].skill.cooldownRemainingMs = 10;
    positive.game.applyOnlineSnapshot(positiveSnapshot);
    positiveArmed = true;
    const positiveRequestsBefore = positive.getSkillRequests();
    const positivePreviousPhase = positive.game.exportOnlineSnapshot().players[1].skill.phase;
    positive.game.advanceServerSimulation(50);
    const positiveAfter = positive.game.exportOnlineSnapshot().players[1].skill.phase;
    const positiveRequestCount = positive.getSkillRequests() - positiveRequestsBefore;

    expect(positivePreviousPhase).toBe("cooldown");
    expect(positiveAfter).toBe("channeling");
    expect(positiveRequestCount).toBe(1);
    expect(countAuthoritativeSkillStart(
      positivePreviousPhase,
      positiveAfter,
      positiveRequestCount,
    )).toBe(1);

    let negativeArmed = false;
    let negativeIssued = false;
    const negative = createInstrumentedGame(() => {
      const useSkill = negativeArmed && !negativeIssued;
      if (useSkill) negativeIssued = true;
      return { direction: "right", placeBomb: false, useSkill, skillAction: "start" };
    });
    const negativeSnapshot = negative.game.exportOnlineSnapshot();
    negativeSnapshot.players[1].skill.phase = "cooldown";
    negativeSnapshot.players[1].skill.cooldownRemainingMs = 100;
    negative.game.applyOnlineSnapshot(negativeSnapshot);
    negativeArmed = true;
    const negativeRequestsBefore = negative.getSkillRequests();
    const negativePreviousPhase = negative.game.exportOnlineSnapshot().players[1].skill.phase;
    negative.game.advanceServerSimulation(50);
    const negativeAfter = negative.game.exportOnlineSnapshot().players[1].skill.phase;
    const negativeRequestCount = negative.getSkillRequests() - negativeRequestsBefore;

    expect(negativeRequestCount).toBe(1);
    expect(negativeAfter).toBe("cooldown");
    expect(countAuthoritativeSkillStart(
      negativePreviousPhase,
      negativeAfter,
      negativeRequestCount,
    )).toBe(0);
  });

  it("não regride contra o V1 ao alternar seed e lado da arena", () => {
    const baseline = evaluate(false);
    const result = evaluate(true);
    console.log(JSON.stringify({ baseline, result }, null, 2));
    const skillStarts = result.duels.reduce((total, duel) => total + duel.actions.skillStarts, 0);
    const skillRequests = result.duels.reduce((total, duel) => total + duel.actions.skillRequests, 0);
    const hasOffCenterDash = result.duels.some((duel) => duel.actions.skillEvents.some((event) => {
      const lanePosition = event.direction === "left" || event.direction === "right"
        ? event.position.y
        : event.position.x;
      const laneCenter = Math.floor(lanePosition / TILE_SIZE) * TILE_SIZE + TILE_SIZE / 2;
      return Math.abs(lanePosition - laneCenter) > 1;
    }));
    expect(new Set(result.duels.flatMap((duel) => duel.skillIds))).toEqual(new Set(["killer-bee-wing-dash"]));
    expect(result.selfDeaths).toBe(0);
    expect(result.wins).toBeGreaterThan(baseline.wins);
    expect(result.wins).toBeGreaterThanOrEqual(5);
    expect(skillStarts).toBeGreaterThan(0);
    expect(skillStarts).toBe(skillRequests);
    expect(hasOffCenterDash).toBe(true);
  }, 30_000);

  it("rebaselineia v2-d/P1 quando o rival usa a saída corporal monotônica", () => {
    const arena = { ...createDefaultArenaDefinition(), randomSeed: "v2-d" };
    const game = new GameApp({}, assets(), arena);
    game.startServerAuthoritativeMatch(
      [1, 2],
      { 1: BOT_V2_CHARACTER_INDEX, 2: BOT_V2_CHARACTER_INDEX, 3: 2, 4: 3 },
      { roomMode: "endless", botPlayerIds: [1, 2], botDecisionPolicies: { 1: getBotV2Decision } },
    );

    let trackedBombId = null;
    let overlapAtObservation = null;
    let minimumOverlapWhileAlive = Number.POSITIVE_INFINITY;
    let clearedBeforeResolution = false;
    let grantRemovedAfterClear = false;
    let outcome = null;
    for (let tick = 0; tick < 4_000; tick += 1) {
      game.advanceServerSimulation(50);
      const snapshot = game.exportOnlineSnapshot();
      const victim = snapshot.players[2];
      if (trackedBombId === null) {
        const bodyBomb = snapshot.bombs.find((bomb) => (
          bomb.ownerId === 1
          && bomb.tile.x === 2
          && bomb.tile.y === 2
          && bomb.bodyEgressPlayerIds?.includes(2)
        ));
        if (bodyBomb) {
          trackedBombId = bodyBomb.id;
          overlapAtObservation = bodyBombOverlapArea(victim.position, bodyBomb.tile);
        }
      }

      const trackedBomb = trackedBombId === null
        ? null
        : snapshot.bombs.find((bomb) => bomb.id === trackedBombId);
      if (trackedBomb) {
        const overlapArea = bodyBombOverlapArea(victim.position, trackedBomb.tile);
        minimumOverlapWhileAlive = Math.min(minimumOverlapWhileAlive, overlapArea);
        if (overlapArea === 0) {
          clearedBeforeResolution = true;
          grantRemovedAfterClear ||= !trackedBomb.bodyEgressPlayerIds?.includes(2);
        }
      }
      if (snapshot.roundOutcome) {
        outcome = {
          winner: snapshot.roundOutcome.winner,
          reason: snapshot.roundOutcome.reason,
          selfDeaths: snapshot.endlessStats?.selfDeaths?.[1] ?? 0,
        };
        break;
      }
    }

    expect(trackedBombId).not.toBeNull();
    expect(overlapAtObservation).toBeGreaterThan(0);
    expect(minimumOverlapWhileAlive).toBeLessThan(overlapAtObservation);
    expect(clearedBeforeResolution).toBe(true);
    expect(grantRemovedAfterClear).toBe(true);
    expect(outcome).toEqual({ winner: null, reason: "timer", selfDeaths: 0 });
  }, 30_000);

  it("mantém todos os casts e selfs seguros em um prefixo não usado na calibração", () => {
    const result = evaluate(true, [
      "stone-v2-generalization-a",
      "stone-v2-generalization-b",
      "stone-v2-generalization-c",
      "stone-v2-generalization-d",
    ]);
    const skillStarts = result.duels.reduce((total, duel) => total + duel.actions.skillStarts, 0);
    const skillRequests = result.duels.reduce((total, duel) => total + duel.actions.skillRequests, 0);

    expect(result.selfDeaths).toBe(0);
    expect(skillStarts).toBe(skillRequests);
  }, 30_000);

  it("encerra a política V2 ao sair da sessão do laboratório", () => {
    const game = new GameApp({}, assets(), createDefaultArenaDefinition());
    let decisions = 0;
    game.startServerAuthoritativeMatch(
      [1, 2],
      { 1: BOT_V2_CHARACTER_INDEX, 2: BOT_V2_CHARACTER_INDEX, 3: 2, 4: 3 },
      {
        botPlayerIds: [1, 2],
        botDecisionPolicies: { 1: getBotV2Decision },
        botDecisionObserver: ({ playerId }) => {
          if (playerId === 1) decisions += 1;
        },
      },
    );
    game.advanceServerSimulation(50);
    expect(decisions).toBeGreaterThan(0);

    const decisionsBeforeClear = decisions;
    game.clearOnlinePeer();
    game.advanceServerSimulation(50);

    expect(game.exportOnlineSnapshot().mode).toBe("menu");
    expect(decisions).toBe(decisionsBeforeClear);
  });
});
