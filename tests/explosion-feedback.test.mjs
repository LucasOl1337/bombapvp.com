// @vitest-environment node

import { describe, expect, it } from "vitest";
import { buildExplosionFeedbackGeometry, GameApp } from "../src/original-game/Engine/game-app.ts";

describe("geometria visual das explosoes", () => {
  it("marca a celula letal inteira, preservando apenas um pixel de respiro", () => {
    const geometry = buildExplosionFeedbackGeometry([
      { tile: { x: 3, y: 6 }, style: "normal", remainingMs: 500 },
    ]);

    expect(geometry.cells).toEqual([
      {
        x: 121,
        y: 241,
        width: 38,
        height: 38,
        style: "normal",
        remainingMs: 500,
      },
    ]);
  });

  it("conecta somente celulas ortogonais contiguas do mesmo blast", () => {
    const geometry = buildExplosionFeedbackGeometry([
      { tile: { x: 3, y: 6 }, style: "normal", remainingMs: 500 },
      { tile: { x: 4, y: 6 }, style: "normal", remainingMs: 450 },
      { tile: { x: 4, y: 7 }, style: "normal", remainingMs: 400 },
      { tile: { x: 5, y: 7 }, style: "toxic", remainingMs: 350 },
      { tile: { x: 8, y: 8 }, style: "normal", remainingMs: 300 },
    ]);

    expect(geometry.connectors).toEqual([
      { fromX: 140, fromY: 260, toX: 180, toY: 260, style: "normal" },
      { fromX: 180, fromY: 260, toX: 180, toY: 300, style: "normal" },
    ]);
  });

  it("registra feedback causal apenas quando uma explosao antecipa outra bomba", () => {
    const bomb = { id: 9, tile: { x: 4, y: 6 }, fuseMs: 900 };
    const game = {
      bombs: [bomb],
      chainReactionFeedback: [],
    };
    const queue = [];

    GameApp.prototype.armBombAtTile.call(game, { x: 4, y: 6 }, queue, { x: 4, y: 4 });
    GameApp.prototype.armBombAtTile.call(game, { x: 4, y: 6 }, queue, { x: 4, y: 5 });

    expect(bomb.fuseMs).toBe(0);
    expect(queue).toEqual([9]);
    expect(game.chainReactionFeedback).toEqual([
      {
        fromTile: { x: 4, y: 4 },
        toTile: { x: 4, y: 6 },
        elapsedMs: 0,
      },
    ]);
  });
});
