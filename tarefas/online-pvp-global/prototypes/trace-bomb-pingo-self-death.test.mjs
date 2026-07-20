// @vitest-environment node

import { describe, it } from "vitest";
import { createDefaultArenaDefinition } from "../../../src/original-game/Arenas/arena.ts";
import { GameApp } from "../../../src/original-game/Engine/game-app.ts";
import { getBombDecision } from "../../../src/original-game/Engine/bot-bomb.ts";
import { getBotPingoDecision } from "../../../src/original-game/Engine/bot-pingo.ts";

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

function traceMatch({ seed, variant, spawnOrder, identity }) {
  const game = new GameApp({}, assets(), arenaFor(variant, seed));
  const playerId = spawnOrder.indexOf(identity) + 1;
  const policies = { Bomb: getBombDecision, Pingo: getBotPingoDecision };
  const trace = [];
  let currentTick = -1;
  let previousSnapshot = null;
  let death = null;
  game.startServerAuthoritativeMatch(
    [1, 2],
    { 1: 0, 2: 0, 3: 0, 4: 0 },
    {
      roomMode: "endless",
      botPlayerIds: [1, 2],
      playerLabels: { 1: spawnOrder[0], 2: spawnOrder[1], 3: "", 4: "" },
      botDecisionPolicies: { 1: policies[spawnOrder[0]], 2: policies[spawnOrder[1]] },
      botDecisionObserver: ({ playerId: observedId, decision }) => {
        if (observedId !== playerId) return;
        const snapshot = game.exportOnlineSnapshot();
        const player = snapshot.players[playerId];
        trace.push({
          tick: currentTick,
          x: Math.round(player.position.x * 10) / 10,
          y: Math.round(player.position.y * 10) / 10,
          tile: player.tile,
          phase: player.skill.phase,
          channelMs: Math.round(player.skill.channelRemainingMs),
          projected: player.skill.projectedPosition && {
            x: Math.round(player.skill.projectedPosition.x * 10) / 10,
            y: Math.round(player.skill.projectedPosition.y * 10) / 10,
          },
          decision,
          bombs: snapshot.bombs.map((bomb) => [
            bomb.id,
            bomb.ownerId,
            bomb.tile.x,
            bomb.tile.y,
            Math.round(bomb.fuseMs),
          ]),
          flames: snapshot.flames.map((flame) => [
            flame.ownerId,
            flame.tile.x,
            flame.tile.y,
            Math.round(flame.remainingMs),
          ]),
        });
        if (trace.length > 30) trace.shift();
      },
    },
  );

  let wasAlive = true;
  for (currentTick = 0; currentTick < 4_000; currentTick += 1) {
    game.advanceServerSimulation(50);
    const snapshot = game.exportOnlineSnapshot();
    const alive = snapshot.players[playerId].alive;
    if (wasAlive && !alive) {
      death = {
        tick: currentTick,
        selfDeaths: snapshot.endlessStats?.selfDeaths?.[playerId] ?? 0,
        previous: previousSnapshot && {
          player: previousSnapshot.players[playerId],
          opponent: previousSnapshot.players[playerId === 1 ? 2 : 1],
          bombs: previousSnapshot.bombs,
          flames: previousSnapshot.flames,
        },
      };
    }
    wasAlive = alive;
    previousSnapshot = snapshot;
    if (snapshot.roundOutcome) break;
  }
  return { seed, variant, spawnOrder, identity, playerId, death, trace };
}

describe("rastreio de uma autoeliminação Bomb/Pingo", () => {
  it("imprime o quadro físico anterior à morte", () => {
    const seed = process.env.LEAGUE_TRACE_SEED;
    const variant = process.env.LEAGUE_TRACE_VARIANT;
    const identity = process.env.LEAGUE_TRACE_IDENTITY;
    const spawnOrder = process.env.LEAGUE_TRACE_ORDER?.split(",");
    if (!seed || !variant || !identity || spawnOrder?.length !== 2) {
      throw new Error("league_trace_env_required");
    }
    const result = traceMatch({ seed, variant, identity, spawnOrder });
    const compact = {
      ...result,
      death: result.death && {
        ...result.death,
        previous: result.death.previous && {
          player: result.death.previous.player,
          opponent: result.death.previous.opponent,
          bombs: result.death.previous.bombs.map((bomb) => ({
            id: bomb.id,
            ownerId: bomb.ownerId,
            tile: bomb.tile,
            fuseMs: Math.round(bomb.fuseMs),
            flameRange: bomb.flameRange,
          })),
          flames: result.death.previous.flames.map((flame) => ({
            ownerId: flame.ownerId,
            tile: flame.tile,
            remainingMs: Math.round(flame.remainingMs),
          })),
        },
      },
      trace: result.trace.map(({ tick, x, y, tile, phase, channelMs, projected, decision, bombs, flames }) => ({
        tick,
        x,
        y,
        tile,
        phase,
        channelMs,
        projected,
        decision,
        bombs,
        flames,
      })),
    };
    console.log(JSON.stringify(
      process.env.LEAGUE_TRACE_COMPACT === "1"
        ? {
            seed: compact.seed,
            variant: compact.variant,
            spawnOrder: compact.spawnOrder,
            identity: compact.identity,
            playerId: compact.playerId,
            death: compact.death,
          }
        : compact,
      null,
      2,
    ));
  }, 120_000);
});
