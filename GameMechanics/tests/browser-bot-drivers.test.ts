import { describe, expect, it, vi } from "vitest";

import { CHAMPION_MEMBERSHIP } from "../../Champions/membership.ts";
import {
  browserBotDriverForPlayer,
  createBrowserBotDrivers,
  driveBrowserBotsForTick,
  type DriveBotImplementation,
} from "../src/browser/bot-drivers.ts";
import {
  createBrowserMatchConfiguration,
  seedForBrowserMatch,
} from "../src/browser/match-mode.ts";
import { createBotLabObservation } from "../src/browser/lab-observation.ts";
import { createGameMechanics } from "../src/game-mechanics.ts";
import { createLocalDuel1v1MatchConfig, createMatchConfig } from "../src/match-config.ts";
import { ROUND_START_MS, TICK_DURATION_MS, type MatchConfig } from "../src/index.ts";

function matchConfigFor(
  configuration: ReturnType<typeof createBrowserMatchConfiguration>,
  matchNumber = 1,
): MatchConfig {
  const base = createLocalDuel1v1MatchConfig({
    seed: seedForBrowserMatch(configuration, matchNumber),
    roundDurationMs: 5_000,
    targetRoundWins: 2,
  });
  return createMatchConfig({
    ...base,
    seats: base.seats.map((seat, index) => ({
      seatId: seat.seatId,
      competitorId: seat.competitorId,
      skillId: CHAMPION_MEMBERSHIP[configuration.players[index]!.championSlug].skillId,
    })),
  });
}

function runLabMatch() {
  const configuration = createBrowserMatchConfiguration({
    mode: "bot-lab",
    champion1: "ranni",
    champion2: "killer-bee",
    bot1: "bomb",
    bot2: "v2",
  });
  const matchConfig = matchConfigFor(configuration);
  const game = createGameMechanics(matchConfig);
  const drivers = createBrowserBotDrivers(configuration, matchConfig);
  game.dispatch({ type: "advance", deltaMs: ROUND_START_MS });

  let completedAt = -1;
  let rejections = 0;
  for (let tick = 0; tick < 5_000; tick += 1) {
    const snapshot = game.snapshot();
    if (snapshot.phase === "match-over") {
      completedAt = tick;
      break;
    }
    for (const report of driveBrowserBotsForTick(snapshot, drivers)) {
      for (const command of report.commands) game.dispatch(command);
    }
    game.dispatch({ type: "advance", deltaMs: TICK_DURATION_MS });
    rejections += game.rejections().length;
  }
  return { configuration, game, drivers, completedAt, rejections };
}

describe("browser bot drivers", () => {
  it("passes each selected profile to driveBot and produces commands for both competitors", () => {
    const configuration = createBrowserMatchConfiguration({
      mode: "bot-lab",
      bot1: "pingo",
      bot2: "v3",
    });
    const matchConfig = matchConfigFor(configuration);
    const game = createGameMechanics(matchConfig);
    const drivers = createBrowserBotDrivers(configuration, matchConfig);
    game.dispatch({ type: "advance", deltaMs: ROUND_START_MS });
    const seen: string[] = [];
    const implementation = vi.fn(((snapshot, seatId, competitorId, prng, memory, profile) => {
      void snapshot;
      void seatId;
      void prng;
      void memory;
      seen.push(`${competitorId}:${profile?.id ?? "missing"}`);
      return [{ type: "place-bomb", competitorId }];
    }) satisfies DriveBotImplementation);

    const reports = driveBrowserBotsForTick(game.snapshot(), drivers, implementation);

    expect(reports.map(({ profileId }) => profileId)).toEqual(["pingo", "v3"]);
    expect(reports.every(({ commands }) => commands.length === 1)).toBe(true);
    expect(seen).toEqual([
      `${matchConfig.seats[0]!.competitorId}:pingo`,
      `${matchConfig.seats[1]!.competitorId}:v3`,
    ]);
  });

  it("stops decisions while paused, resumes, and resets counters with a deterministic restart", () => {
    const configuration = createBrowserMatchConfiguration({
      mode: "bot-lab",
      bot1: "bomb",
      bot2: "pingo",
    });
    const matchConfig = matchConfigFor(configuration);
    const game = createGameMechanics(matchConfig);
    let drivers = createBrowserBotDrivers(configuration, matchConfig);
    game.dispatch({ type: "advance", deltaMs: ROUND_START_MS });

    expect(driveBrowserBotsForTick(game.snapshot(), drivers)).toHaveLength(2);
    game.dispatch({ type: "toggle-pause" });
    expect(game.snapshot().phase).toBe("paused");
    expect(driveBrowserBotsForTick(game.snapshot(), drivers)).toEqual([]);
    game.dispatch({ type: "toggle-pause" });
    expect(driveBrowserBotsForTick(game.snapshot(), drivers)).toHaveLength(2);

    game.dispatch({ type: "restart" });
    drivers = createBrowserBotDrivers(configuration, matchConfig);
    expect(game.snapshot().phase).toBe("round-start");
    expect(browserBotDriverForPlayer(drivers, 0)?.decisions).toBe(0);
    expect(browserBotDriverForPlayer(drivers, 1)?.commands).toBe(0);
  });

  it("drives a selected-profile bot-vs-bot match deterministically through match-over", () => {
    const first = runLabMatch();
    const replay = runLabMatch();
    const final = first.game.snapshot();

    expect(first.completedAt).toBeGreaterThanOrEqual(0);
    expect(first.completedAt).toBeLessThan(5_000);
    expect(final.phase).toBe("match-over");
    expect(final.matchWinner).not.toBeNull();
    expect(first.rejections).toBe(0);
    expect(first.drivers.map(({ profile, decisions }) => [profile.id, decisions])).toEqual([
      ["bomb", expect.any(Number)],
      ["v2", expect.any(Number)],
    ]);
    expect(first.drivers.every(({ decisions, commands }) => decisions > 0 && commands > 0)).toBe(true);
    expect(replay.completedAt).toBe(first.completedAt);
    expect(replay.game.snapshot().matchWinner).toBe(final.matchWinner);
    expect(replay.game.snapshot()).toEqual(final);

    const observation = createBotLabObservation(
      first.configuration,
      final,
      ["Ranni", "Killer Bee"],
      "en",
    );
    expect(observation).toMatchObject({
      phase: "match-over",
      phaseLabel: "Match over",
      roundNumber: final.roundNumber,
    });
    expect(observation?.result).toMatch(/^(Bomb · Ranni|V2 · Killer Bee) wins the match$/);
  }, 15_000);
});
