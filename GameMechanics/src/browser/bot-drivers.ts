import type {
  GameCommand,
  GameSnapshot,
  MatchConfig,
} from "../contracts.ts";
import {
  createBotMemory,
  createBotPrng,
  driveBot,
  resolveBotProfile,
  type BotMemory,
  type BotPrng,
  type BotProfile,
} from "../bots/index.ts";
import type { BrowserMatchConfiguration } from "./match-mode.ts";

export type BrowserBotDriver = {
  readonly playerIndex: 0 | 1;
  readonly profile: BotProfile;
  readonly seatId: MatchConfig["seats"][number]["seatId"];
  readonly competitorId: MatchConfig["seats"][number]["competitorId"];
  readonly prng: BotPrng;
  readonly memory: BotMemory;
  decisions: number;
  commands: number;
};

export type BrowserBotDriveReport = Readonly<{
  playerIndex: 0 | 1;
  profileId: BotProfile["id"];
  commands: readonly GameCommand[];
}>;

export type DriveBotImplementation = typeof driveBot;

export function createBrowserBotDrivers(
  configuration: BrowserMatchConfiguration,
  matchConfig: MatchConfig,
): BrowserBotDriver[] {
  const drivers: BrowserBotDriver[] = [];
  for (const playerIndex of [0, 1] as const) {
    const player = configuration.players[playerIndex];
    if (player.control !== "bot") continue;
    const seat = matchConfig.seats[playerIndex]!;
    const profile = resolveBotProfile(player.profileId);
    drivers.push({
      playerIndex,
      profile,
      seatId: seat.seatId,
      competitorId: seat.competitorId,
      prng: createBotPrng(`${matchConfig.seed}|seat:${seat.seatId}|profile:${profile.id}`),
      memory: createBotMemory(),
      decisions: 0,
      commands: 0,
    });
  }
  return drivers;
}

/**
 * Ask every configured bot for ordinary GameCommands. Dispatch stays with the
 * browser/facade so diagnostics never receive a simulation mutation channel.
 */
export function driveBrowserBotsForTick(
  snapshot: GameSnapshot,
  drivers: readonly BrowserBotDriver[],
  implementation: DriveBotImplementation = driveBot,
): readonly BrowserBotDriveReport[] {
  if (snapshot.phase !== "playing" && snapshot.phase !== "sudden-death") {
    return Object.freeze([]);
  }

  return Object.freeze(drivers.map((driver) => {
    const commands = implementation(
      snapshot,
      driver.seatId,
      driver.competitorId,
      driver.prng,
      driver.memory,
      driver.profile,
    );
    driver.decisions += 1;
    driver.commands += commands.length;
    return Object.freeze({
      playerIndex: driver.playerIndex,
      profileId: driver.profile.id,
      commands,
    });
  }));
}

export function browserBotDriverForPlayer(
  drivers: readonly BrowserBotDriver[],
  playerIndex: 0 | 1,
): BrowserBotDriver | null {
  return drivers.find((driver) => driver.playerIndex === playerIndex) ?? null;
}
