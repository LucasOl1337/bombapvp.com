import { describe, expect, it } from "vitest";

import {
  BOT_PROFILE_IDS,
  BOT_PROFILES,
  DEFAULT_CONTINUOUS_BOT_ID,
  DEFAULT_TRAINING_BOT_ID,
  getBotProfile,
  getBotProfileByModel,
} from "../content/bots.ts";
import { CHAMPION_MEMBERSHIP } from "../../Champions/membership.ts";
import { createBotMemory, createBotPrng, driveBot } from "../src/bots/index.ts";
import { createGameMechanics } from "../src/index.ts";
import { createLocalDuel1v1MatchConfig } from "../src/match-config.ts";

describe("canonical bot profiles", () => {
  it("preserves the five stable bot identities", () => {
    expect(BOT_PROFILE_IDS).toEqual(["bomb", "pingo", "v1", "v2", "v3"]);
    expect(BOT_PROFILES.map(({ model, label }) => ({ model, label }))).toEqual([
      { model: "bot-bomb", label: "Bomb" },
      { model: "bot-pingo", label: "Pingo" },
      { model: "bot-v1", label: "V1" },
      { model: "bot-v2", label: "V2" },
      { model: "bot-v3", label: "V3" },
    ]);
  });

  it("keeps training and continuous defaults explicit", () => {
    expect(DEFAULT_TRAINING_BOT_ID).toBe("bomb");
    expect(DEFAULT_CONTINUOUS_BOT_ID).toBe("v1");
  });

  it.each(BOT_PROFILES)("associates $id through stable Champion identity", (profile) => {
    const champion = CHAMPION_MEMBERSHIP[profile.championSlug];
    expect(profile.characterId).toBe(champion.characterId);
    expect(profile.skillId).toBe(champion.skillId);
    expect(getBotProfile(profile.id)).toBe(profile);
    expect(getBotProfileByModel(profile.model)).toBe(profile);
  });

  it.each(BOT_PROFILES)("drives $id deterministically", (profile) => {
    const config = createLocalDuel1v1MatchConfig();
    const game = createGameMechanics(config);
    const snapshot = game.snapshot();
    const seat = config.seats[1]!;
    const first = driveBot(
      snapshot,
      seat.seatId,
      seat.competitorId,
      createBotPrng(config.seed),
      createBotMemory(),
      profile,
    );
    const second = driveBot(
      snapshot,
      seat.seatId,
      seat.competitorId,
      createBotPrng(config.seed),
      createBotMemory(),
      profile,
    );
    expect(first).toEqual(second);
  });
});
