import { describe, expect, it } from "vitest";
import { getBotDecision } from "../src/gameplay/bot-ai.ts";
import { BotTrainingGame } from "../src/gameplay/engine.ts";

describe("bot training engine", () => {
  it("inicia uma rodada local com um humano e três bots", () => {
    const game = new BotTrainingGame();
    const snapshot = game.getSnapshot();

    expect(snapshot.status).toBe("playing");
    expect(snapshot.players.filter((player) => player.kind === "human")).toHaveLength(1);
    expect(snapshot.players.filter((player) => player.kind === "bot")).toHaveLength(3);
    expect(snapshot.players.every((player) => player.alive)).toBe(true);
    expect(snapshot.crates.size).toBeGreaterThan(20);
  });

  it("move o jogador, planta a bomba e resolve a explosão", () => {
    const game = new BotTrainingGame();
    game.moveHuman("right");
    game.setHumanDirection(null);

    expect(game.getSnapshot().players.find((player) => player.id === 1)?.tile).toEqual({ x: 2, y: 1 });
    expect(game.placeBomb()).toBe(true);
    expect(game.placeBomb()).toBe(false);
    expect(game.getSnapshot().bombs).toHaveLength(1);

    for (let step = 0; step < 38; step += 1) game.advance(50);

    expect(game.getSnapshot().bombs.some((bomb) => bomb.ownerId === 1)).toBe(false);
    expect(game.getSnapshot().flames.length).toBeGreaterThan(0);
  });

  it("faz o bot abandonar uma zona que vai explodir", () => {
    const game = new BotTrainingGame();
    const snapshot = game.getSnapshot();
    const bot = snapshot.players.find((player) => player.id === 2);
    if (!bot) throw new Error("Bot fixture was not created");
    snapshot.bombs.push({
      id: 99,
      ownerId: 1,
      tile: { ...bot.tile },
      fuseMs: 900,
      radius: 2,
    });

    expect(getBotDecision(snapshot, bot)).toMatchObject({
      placeBomb: false,
    });
    expect(getBotDecision(snapshot, bot).direction).not.toBeNull();
  });

  it("restaura a arena completa ao reiniciar", () => {
    const game = new BotTrainingGame();
    game.moveHuman("right");
    game.placeBomb();
    game.restart();

    expect(game.getSnapshot()).toMatchObject({
      elapsedMs: 0,
      status: "playing",
      bombs: [],
      flames: [],
    });
    expect(game.getSnapshot().players.every((player) => player.alive)).toBe(true);
  });
});
