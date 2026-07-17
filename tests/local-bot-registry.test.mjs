import { describe, expect, it } from "vitest";
import { getBotDecision } from "../src/original-game/Engine/bot-ai.ts";
import { getBombDecision } from "../src/original-game/Engine/bot-bomb.ts";
import { getBotPingoDecision } from "../src/original-game/Engine/bot-pingo.ts";
import { getBotV2Decision } from "../src/original-game/Engine/bot-v2.ts";
import { getBotV3Decision } from "../src/original-game/Engine/bot-v3.ts";
import {
  DEFAULT_CONTINUOUS_BOT_ID,
  DEFAULT_TRAINING_BOT_ID,
  getLocalBotMetadataById,
  getLocalBotMetadataByModel,
  LOCAL_BOT_CATALOG,
} from "../src/original-game/Engine/bot-catalog.ts";
import {
  createOfflineBotMatchSetup,
  createLocalBotAssignments,
  getLocalBotById,
  getLocalBotByModel,
  LOCAL_BOTS,
} from "../src/original-game/Engine/bot-registry.ts";

describe("registry pública dos bots locais", () => {
  it("expõe catálogo leve e defaults sem depender das policies runtime", () => {
    expect(LOCAL_BOT_CATALOG).toEqual([
      { id: "bomb", model: "bot-bomb", label: "Bomb" },
      { id: "pingo", model: "bot-pingo", label: "Pingo" },
      { id: "v1", model: "bot-v1", label: "V1" },
      { id: "v2", model: "bot-v2", label: "V2" },
      { id: "v3", model: "bot-v3", label: "V3" },
    ]);
    expect(DEFAULT_TRAINING_BOT_ID).toBe("bomb");
    expect(DEFAULT_CONTINUOUS_BOT_ID).toBe("v1");
    expect(getLocalBotMetadataById(" pingo ")?.model).toBe("bot-pingo");
    expect(getLocalBotMetadataByModel(" bot-v2 ")?.id).toBe("v2");
    expect(getLocalBotMetadataById("unknown")).toBeNull();
  });

  it("resolve metadata, policy e personagem dos cinco bots em uma única fonte", () => {
    expect(LOCAL_BOTS.map(({ id, model, label }) => ({ id, model, label }))).toEqual([
      { id: "bomb", model: "bot-bomb", label: "Bomb" },
      { id: "pingo", model: "bot-pingo", label: "Pingo" },
      { id: "v1", model: "bot-v1", label: "V1" },
      { id: "v2", model: "bot-v2", label: "V2" },
      { id: "v3", model: "bot-v3", label: "V3" },
    ]);
    expect(getLocalBotById("bomb")?.policy).toBe(getBombDecision);
    expect(getLocalBotById("pingo")?.policy).toBe(getBotPingoDecision);
    expect(getLocalBotByModel("bot-v1")?.policy).toBe(getBotDecision);
    expect(getLocalBotByModel("bot-v2")?.policy).toBe(getBotV2Decision);
    expect(getLocalBotByModel("bot-v3")?.policy).toBe(getBotV3Decision);
    expect(getLocalBotById("unknown")).toBeNull();
    expect(getLocalBotByModel("cx/gpt-5.6-sol")).toBeNull();
    const assignments = createLocalBotAssignments([
      { playerId: 1, bot: getLocalBotById("v1") },
      { playerId: 2, bot: getLocalBotById("v1") },
      { playerId: 3, bot: getLocalBotById("v2") },
      { playerId: 4, bot: getLocalBotById("bomb") },
    ]);
    expect(assignments.characterSelections).toEqual({ 1: 0, 2: 1, 3: 1, 4: 0 });
    expect(assignments.playerLabels).toEqual({ 1: "V1", 2: "V1", 3: "V2", 4: "Bomb" });
    expect(assignments.botDecisionPolicies).toEqual({
      1: getBotDecision,
      2: getBotDecision,
      3: getBotV2Decision,
      4: getBombDecision,
    });
  });

  it("parses bot=<id> e prepara training ou continuous sem alterar seus defaults", () => {
    const training = createOfflineBotMatchSetup("training", new URLSearchParams("bot=v2"));
    expect(training.bot.id).toBe("v2");
    expect(training.botFill).toBe(1);
    expect(training.roomMode).toBe("classic");
    expect(training.options.botDecisionPolicies).toEqual({ 2: getBotV2Decision });
    expect(training.options.botCharacterSelections).toEqual({ 2: 1 });
    expect(training.options.playerLabels).toEqual({ 2: "V2" });
    const continuous = createOfflineBotMatchSetup("continuous", new URLSearchParams("bot=pingo"));
    expect(continuous.bot.id).toBe("pingo");
    expect(continuous.botFill).toBe(3);
    expect(continuous.roomMode).toBe("endless");
    expect(continuous.options.botDecisionPolicies).toEqual({
      2: getBotPingoDecision,
      3: getBotPingoDecision,
      4: getBotPingoDecision,
    });
    expect(continuous.options.botCharacterSelections).toEqual({ 2: 0, 3: 0, 4: 0 });
    expect(continuous.options.playerLabels).toEqual({ 2: "Pingo", 3: "Pingo", 4: "Pingo" });
    const defaultTraining = createOfflineBotMatchSetup("training", new URLSearchParams("bot=invalid"));
    expect(defaultTraining.bot.id).toBe("bomb");
    expect(defaultTraining.options.playerLabels).toEqual({ 2: "BOMB" });
    const defaultContinuous = createOfflineBotMatchSetup("continuous", new URLSearchParams());
    expect(defaultContinuous.bot.id).toBe("v1");
    expect(defaultContinuous.options.botDecisionPolicies).toEqual({});
    expect(defaultContinuous.options.botCharacterSelections).toEqual({});
    expect(defaultContinuous.options.playerLabels).toEqual({});
  });

  it("torna os cinco ids utilizáveis em training e nos três adversários de continuous", () => {
    const expectedPolicies = {
      bomb: getBombDecision,
      pingo: getBotPingoDecision,
      v1: getBotDecision,
      v2: getBotV2Decision,
      v3: getBotV3Decision,
    };
    for (const id of ["bomb", "pingo", "v1", "v2", "v3"]) {
      const training = createOfflineBotMatchSetup("training", new URLSearchParams({ bot: id }));
      const continuous = createOfflineBotMatchSetup("continuous", new URLSearchParams({ bot: id }));
      expect(training.bot.id).toBe(id);
      expect(training.options.botDecisionPolicies).toEqual({ 2: expectedPolicies[id] });
      expect(continuous.bot.id).toBe(id);
      expect(continuous.options.botDecisionPolicies).toEqual({
        2: expectedPolicies[id],
        3: expectedPolicies[id],
        4: expectedPolicies[id],
      });
    }
  });
});
