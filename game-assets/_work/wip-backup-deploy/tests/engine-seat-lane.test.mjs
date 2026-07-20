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

function createEndlessMatch() {
  const arena = createDefaultArenaDefinition();
  const game = new GameApp({}, assets(), arena);
  game.startServerAuthoritativeMatch(
    [1, 2, 3],
    { 1: 0, 2: 0, 3: 0, 4: 0 },
    {
      arena,
      roomMode: "endless",
      botPlayerIds: [2, 3],
      playerLabels: { 1: "Host", 2: "Seat Bot", 3: "Other Bot" },
    },
  );
  game.advanceServerSimulation(1_300);
  return game;
}

describe("server-authoritative engine seat lane", () => {
  it("atomically takes over a bot seat without resetting its live player state", () => {
    const game = createEndlessMatch();
    const before = game.exportOnlineSnapshot();
    before.players[2].position = { x: 96, y: 64 };
    before.players[2].tile = { x: 3, y: 2 };
    before.players[2].maxBombs = 3;
    before.players[2].flameRange = 4;
    before.players[2].speedLevel = 2;
    before.players[2].spawnProtectionMs = 777;
    game.applyOnlineSnapshot(before);

    expect(game.takeoverServerBotSeat(2, { playerLabel: "Human Guest", characterSelection: 1 })).toBe(true);

    const after = game.exportOnlineSnapshot();
    expect(after.botPlayerIds).toEqual([3]);
    expect(after.players[2]).toMatchObject({
      active: true,
      alive: true,
      name: "Human Guest",
      maxBombs: 3,
      flameRange: 4,
      speedLevel: 2,
    });
    expect(after.players[2].position).toEqual({ x: 96, y: 64 });
    expect(after.selectedCharacterIndex[2]).toBe(1);
    expect(after.players[3]).toMatchObject(before.players[3]);
  });

  it("releases a human seat back to bot without resetting unrelated bot state", () => {
    const game = createEndlessMatch();
    expect(game.takeoverServerBotSeat(2, { playerLabel: "Human Guest" })).toBe(true);
    const human = game.exportOnlineSnapshot();
    human.players[2].position = { x: 112, y: 64 };
    human.players[2].tile = { x: 3, y: 2 };
    human.players[2].maxBombs = 4;
    human.players[3].position = { x: 224, y: 192 };
    human.players[3].tile = { x: 7, y: 6 };
    human.players[3].flameRange = 5;
    game.applyOnlineSnapshot(human);

    expect(game.releaseServerSeatToBot(2, { playerLabel: null, characterSelection: 0 })).toBe(true);
    const after = game.exportOnlineSnapshot();

    expect(after.botPlayerIds).toEqual([2, 3]);
    expect(after.players[2]).toMatchObject({
      active: true,
      alive: true,
      name: "BOT",
      maxBombs: 4,
    });
    expect(after.players[2].position).toEqual({ x: 112, y: 64 });
    expect(after.players[3]).toMatchObject({
      position: { x: 224, y: 192 },
      tile: { x: 7, y: 6 },
      flameRange: 5,
      name: "Other Bot",
    });
    expect(after.selectedCharacterIndex[2]).toBe(0);
  });

  it("does not let manual Escape pause a server-authoritative online match", () => {
    const game = createEndlessMatch();
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
