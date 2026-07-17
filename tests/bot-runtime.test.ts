import { describe, expect, it } from "vitest";
import {
  createBotRuntime,
  normalizeBotDecision,
} from "../src/original-game/Engine/bot-runtime.ts";
import type { BotContext } from "../src/original-game/Engine/bot-contracts.ts";
import type { PlayerState } from "../src/original-game/Gameplay/types.ts";

describe("runtime público dos bots", () => {
  it("normaliza saídas ausentes ou inválidas para uma decisão neutra", () => {
    expect(normalizeBotDecision(undefined)).toEqual({
      direction: null,
      placeBomb: false,
    });
    expect(normalizeBotDecision({ direction: "diagonal", placeBomb: "sim" })).toEqual({
      direction: null,
      placeBomb: false,
    });
  });

  it("preserva somente comandos e metadados válidos da policy", () => {
    expect(normalizeBotDecision({
      direction: "left",
      placeBomb: true,
      detonate: true,
      useSkill: false,
      skillHeld: true,
      skillAction: "hold",
      requestId: 17,
      microActionIndex: 2,
      targetId: 3,
      intent: "bomb-attack",
      implementationDetail: "não atravessa a seam",
    })).toEqual({
      direction: "left",
      placeBomb: true,
      detonate: true,
      useSkill: false,
      skillHeld: true,
      skillAction: "hold",
      requestId: 17,
      microActionIndex: 2,
      targetId: 3,
      intent: "bomb-attack",
    });
  });

  it("emite ataques como pulsos independentes por jogador e reinicia seu ciclo", () => {
    let skillAction: "start" | "release" = "start";
    const runtime = createBotRuntime(() => ({
      direction: "right",
      placeBomb: true,
      detonate: true,
      useSkill: true,
      skillAction,
    }), { edgeTriggerActions: true });
    const player = { id: 2 } as PlayerState;
    const otherPlayer = { id: 3 } as PlayerState;
    const context = {} as BotContext;

    expect(runtime.decide(player, context)).toMatchObject({
      direction: "right",
      placeBomb: true,
      detonate: true,
      useSkill: true,
    });
    const heldCommand = runtime.decide(player, context);
    expect(heldCommand).toMatchObject({
      direction: "right",
      placeBomb: false,
      useSkill: false,
    });
    expect(heldCommand).not.toHaveProperty("detonate");
    skillAction = "release";
    expect(runtime.decide(player, context)).toMatchObject({
      placeBomb: false,
      useSkill: true,
      skillAction: "release",
    });
    expect(runtime.decide(otherPlayer, context)).toMatchObject({
      placeBomb: true,
      detonate: true,
      useSkill: true,
    });

    runtime.reset(2);
    expect(runtime.decide(player, context)).toMatchObject({
      placeBomb: true,
      detonate: true,
      useSkill: true,
    });
  });

  it("preserva o comportamento por tick de uma policy local por padrão", () => {
    const runtime = createBotRuntime(() => ({
      direction: null,
      placeBomb: true,
      detonate: true,
    }));
    const player = { id: 2 } as PlayerState;
    const context = {} as BotContext;

    expect(runtime.decide(player, context)).toMatchObject({ placeBomb: true, detonate: true });
    expect(runtime.decide(player, context)).toMatchObject({ placeBomb: true, detonate: true });
  });
});
