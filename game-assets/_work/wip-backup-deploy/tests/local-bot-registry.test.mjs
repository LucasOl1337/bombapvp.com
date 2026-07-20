import { describe, expect, it } from "vitest";
import { getBotDecision } from "../src/original-game/Engine/bot-ai.ts";
import { getBombDecision } from "../src/original-game/Engine/bot-bomb.ts";
import { getBotPingoDecision } from "../src/original-game/Engine/bot-pingo.ts";
import { getBotV2Decision } from "../src/original-game/Engine/bot-v2.ts";
import { getBotV3Decision } from "../src/original-game/Engine/bot-v3.ts";
import { resolveLaunchRequest } from "../src/matches/launch-request.ts";
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

function offlineRequest(mode, bot) {
  const result = resolveLaunchRequest({ mode, character: null, bot });
  if (!result.ok || result.request.mode === "lab") throw new Error("offline_launch_request_expected");
  return result.request;
}

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

  it("prepara o runtime a partir do launch request sem conhecer URLSearchParams", () => {
    const training = createOfflineBotMatchSetup(offlineRequest("training", "v2"));
    expect(training.bot.id).toBe("v2");
    expect(training.botFill).toBe(1);
    expect(training.roomMode).toBe("classic");
    expect(training.options.botDecisionPolicies).toEqual({ 2: getBotV2Decision });
    expect(training.options.botCharacterSelections).toEqual({ 2: 1 });
    expect(training.options.playerLabels).toEqual({ 2: "V2" });

    // Continuous always mixes Bomb + Pingo Completers with world name tags,
    // regardless of the requested bot id (no bot picker on online PvP).
    const continuous = createOfflineBotMatchSetup(offlineRequest("continuous", "pingo"));
    expect(continuous.bot.id).toBe("bomb");
    expect(continuous.botFill).toBe(3);
    expect(continuous.roomMode).toBe("endless");
    expect(continuous.options.botDecisionPolicies).toEqual({
      2: getBombDecision,
      3: getBotPingoDecision,
      4: getBombDecision,
    });
    expect(continuous.options.botCharacterSelections).toEqual({ 2: 0, 3: 0, 4: 0 });
    expect(continuous.options.playerLabels).toEqual({ 2: "Bomb", 3: "Pingo", 4: "Bomb" });
    expect(continuous.options.showWorldPlayerLabels).toBe(true);

    const defaultTraining = createOfflineBotMatchSetup(offlineRequest("training", "invalid"));
    expect(defaultTraining.bot.id).toBe("bomb");
    expect(defaultTraining.options.playerLabels).toEqual({ 2: "BOMB" });

    const defaultContinuous = createOfflineBotMatchSetup(offlineRequest("continuous", undefined));
    expect(defaultContinuous.bot.id).toBe("bomb");
    expect(defaultContinuous.options.botDecisionPolicies).toEqual({
      2: getBombDecision,
      3: getBotPingoDecision,
      4: getBombDecision,
    });
    expect(defaultContinuous.options.playerLabels).toEqual({ 2: "Bomb", 3: "Pingo", 4: "Bomb" });
    expect(defaultContinuous.options.showWorldPlayerLabels).toBe(true);
  });

  it("torna os cinco ids utilizáveis no treino; continuous ignora o bot e fixa Bomb+Pingo", () => {
    const expectedPolicies = {
      bomb: getBombDecision,
      pingo: getBotPingoDecision,
      v1: getBotDecision,
      v2: getBotV2Decision,
      v3: getBotV3Decision,
    };

    for (const id of ["bomb", "pingo", "v1", "v2", "v3"]) {
      const training = createOfflineBotMatchSetup(offlineRequest("training", id));
      const continuous = createOfflineBotMatchSetup(offlineRequest("continuous", id));
      expect(training.bot.id).toBe(id);
      expect(training.options.botDecisionPolicies).toEqual({ 2: expectedPolicies[id] });
      expect(continuous.options.botDecisionPolicies).toEqual({
        2: getBombDecision,
        3: getBotPingoDecision,
        4: getBombDecision,
      });
      expect(continuous.options.playerLabels).toEqual({ 2: "Bomb", 3: "Pingo", 4: "Bomb" });
    }
  });
});
