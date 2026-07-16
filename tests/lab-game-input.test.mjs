import { describe, expect, it } from "vitest";
import { GameApp } from "../src/original-game/Engine/game-app.ts";

describe("input autoritativo do laboratorio", () => {
  it("descarta direcao e pulsos ainda latched ao limpar um bot", () => {
    const externalInputPlayers = { 1: false, 2: false, 3: false, 4: false };
    const onlineInputs = {
      1: { direction: "right", bombPressed: true, detonatePressed: true, skillPressed: true, skillHeld: true },
    };

    GameApp.prototype.clearServerPlayerInput.call({ externalInputPlayers, onlineInputs }, 1);

    expect(externalInputPlayers[1]).toBe(true);
    expect(onlineInputs[1]).toEqual({
      direction: null,
      bombPressed: false,
      detonatePressed: false,
      skillPressed: false,
      skillHeld: false,
    });
  });

  it("substitui e cancela pulsos latched quando o reflexo de seguranca assume", () => {
    const externalInputPlayers = { 1: false, 2: false, 3: false, 4: false };
    const onlineInputs = {
      1: { direction: "right", bombPressed: true, detonatePressed: true, skillPressed: true, skillHeld: true },
    };

    const game = { externalInputPlayers, onlineInputs };
    GameApp.prototype.setServerPlayerInput.call(game, 1, {
      direction: "up", bombPressed: true, detonatePressed: true, skillPressed: true, skillHeld: false,
    });
    expect(onlineInputs[1].bombPressed).toBe(true);

    GameApp.prototype.replaceServerPlayerInput.call(game, 1, {
      direction: "up", bombPressed: false, detonatePressed: false, skillPressed: false, skillHeld: false,
    });

    expect(onlineInputs[1]).toEqual({
      direction: "up", bombPressed: false, detonatePressed: false, skillPressed: false, skillHeld: false,
    });
  });
});
