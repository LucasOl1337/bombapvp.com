// @vitest-environment node

import { describe, expect, it } from "vitest";
import { createDefaultArenaDefinition } from "../src/original-game/Arenas/arena.ts";
import { GameApp } from "../src/original-game/Engine/game-app.ts";

function assets() {
  return {
    players: {},
    characterRoster: [
      { id: "seat-character-one", name: "Seat One", size: null, selectionIndex: 0 },
      { id: "seat-character-two", name: "Seat Two", size: null, selectionIndex: 1 },
    ],
    characterSpriteLoader: async () => null,
    arenaTheme: {},
    floor: { base: null, lane: null, spawn: null },
    props: { wall: null, crate: null, bomb: null, flame: null },
    powerUps: {},
  };
}

function neutralInput(direction = null) {
  return {
    direction,
    bombPressed: false,
    detonatePressed: false,
    skillPressed: false,
    skillHeld: false,
  };
}

function createDuelMatch() {
  const arena = createDefaultArenaDefinition();
  const game = new GameApp({}, assets(), arena);
  game.startServerAuthoritativeMatch(
    [1, 2],
    { 1: 0, 2: 1, 3: 0, 4: 0 },
    {
      arena,
      roomMode: "classic",
      botPlayerIds: [],
      playerLabels: { 1: "Player One", 2: "Player Two", 3: "", 4: "" },
    },
  );
  game.advanceServerSimulation(1_300);
  return game;
}

describe("server-authoritative duel seat lane", () => {
  it("starts exactly two human competitors without Completers", () => {
    const snapshot = createDuelMatch().exportOnlineSnapshot();

    expect(snapshot.roomMode).toBe("classic");
    expect(snapshot.activePlayerIds).toEqual([1, 2]);
    expect(snapshot.botPlayerIds).toEqual([]);
    expect(snapshot.players[1].name).toBe("Player One");
    expect(snapshot.players[2].name).toBe("Player Two");
  });

  it("applies commands only to the server-selected human seat", () => {
    const game = createDuelMatch();
    const before = game.exportOnlineSnapshot();

    game.replaceServerPlayerInput(2, neutralInput("left"));
    game.advanceServerSimulation(300);
    const after = game.exportOnlineSnapshot();

    expect(after.players[1].position).toEqual(before.players[1].position);
    expect(after.players[2].position.x).toBeLessThan(before.players[2].position.x);
    expect(after.botPlayerIds).toEqual([]);
  });

  it("neutralizes a disconnected seat without inserting a bot", () => {
    const game = createDuelMatch();
    game.replaceServerPlayerInput(2, neutralInput("left"));
    game.advanceServerSimulation(100);
    game.clearServerPlayerInput(2);
    const disconnected = game.exportOnlineSnapshot();

    game.advanceServerSimulation(200);
    const after = game.exportOnlineSnapshot();

    expect(after.players[2].position).toEqual(disconnected.players[2].position);
    expect(after.players[2].alive).toBe(true);
    expect(after.botPlayerIds).toEqual([]);
  });

  it("does not let manual Escape pause a server-authoritative online match", () => {
    const game = createDuelMatch();
    let consumed = false;
    game.input = {
      consumePress: (code) => {
        if (code === "Escape" && !consumed) {
          consumed = true;
          return true;
        }
        return false;
      },
      endFrame: () => undefined,
      clearPresses: () => undefined,
      isDown: () => false,
      getMovementDirection: () => null,
      getDirectionFromCodes: () => null,
    };

    game.advanceServerSimulation(1_000 / 60);

    expect(consumed).toBe(false);
    expect(game.exportOnlineSnapshot().paused).toBe(false);
  });
});
