// @vitest-environment node

import { describe, expect, it, vi } from "vitest";
import { GameApp } from "../src/original-game/Engine/game-app.ts";

function neutralInput(overrides = {}) {
  return {
    direction: "right",
    bombPressed: false,
    detonatePressed: false,
    skillPressed: false,
    skillHeld: false,
    ...overrides,
  };
}

function guestHarness(sendGuestInput) {
  return {
    onlineSession: { role: "guest", sendGuestInput },
    onlineLocalPlayerId: 1,
    onlineOutgoingInputs: {
      1: neutralInput({ bombPressed: true }),
      2: neutralInput(),
      3: neutralInput(),
      4: neutralInput(),
    },
    onlineInputCooldownMs: 0,
    onlineNextInputSeq: 0,
    onlinePendingInputs: [],
  };
}

describe("30 Hz online input lane", () => {
  it("sends at 30 Hz while retaining one-shot presses until transport acceptance", () => {
    const sendGuestInput = vi.fn(() => false);
    const game = guestHarness(sendGuestInput);
    const forward = GameApp.prototype.forwardGuestInput;

    forward.call(game, 1000 / 60);
    expect(sendGuestInput).toHaveBeenCalledWith(expect.objectContaining({ bombPressed: true }), 1);
    expect(game.onlineNextInputSeq).toBe(0);
    expect(game.onlineOutgoingInputs[1].bombPressed).toBe(true);
    expect(game.onlinePendingInputs).toEqual([]);

    sendGuestInput.mockReturnValue(true);
    forward.call(game, 1000 / 60);
    expect(game.onlineNextInputSeq).toBe(1);
    expect(game.onlineOutgoingInputs[1].bombPressed).toBe(false);
    expect(game.onlinePendingInputs).toHaveLength(1);

    forward.call(game, 1000 / 60);
    expect(sendGuestInput).toHaveBeenCalledTimes(2);
    forward.call(game, 1000 / 60);
    expect(sendGuestInput).toHaveBeenCalledTimes(3);
    expect(sendGuestInput).toHaveBeenLastCalledWith(expect.objectContaining({ bombPressed: false }), 2);
  });
});
