import { describe, expect, it } from "vitest";

import {
  botProfileForPlayer,
  createBrowserMatchConfiguration,
  parseBrowserLaunchState,
  seedForBrowserMatch,
  serializeBrowserMatchConfiguration,
} from "../src/browser/match-mode.ts";

describe("browser match mode boundary", () => {
  it("keeps the existing local duel as the default landing mode", () => {
    const launch = parseBrowserLaunchState("?p1=katarina&p2=thresh");

    expect(launch.configuration).toEqual({
      mode: "local-duel",
      players: [
        { control: "human", championSlug: "katarina" },
        { control: "human", championSlug: "thresh" },
      ],
    });
    expect(launch.skipSelection).toBe(false);
  });

  it.each(["bomb", "pingo", "v1", "v2", "v3"])(
    "turns the documented bot=%s link into typed training and applies that profile",
    (profileId) => {
      const launch = parseBrowserLaunchState(`?p1=nico&p2=madara&bot=${profileId}`);

      expect(launch.configuration.mode).toBe("bot-training");
      expect(launch.configuration.players[0]).toEqual({
        control: "human",
        championSlug: "nico",
      });
      expect(launch.configuration.players[1]).toEqual({
        control: "bot",
        championSlug: "madara",
        profileId,
      });
      expect(botProfileForPlayer(launch.configuration, 1)?.id).toBe(profileId);
    },
  );

  it("keeps bot=1, control2=bot, p2=bot and skipSelect compatibility", () => {
    for (const search of ["?bot=1", "?control2=bot", "?p2=bot&skipSelect=1"]) {
      const launch = parseBrowserLaunchState(search);
      expect(launch.configuration.mode).toBe("bot-training");
      expect(launch.configuration.players[1]).toMatchObject({
        control: "bot",
        profileId: "bomb",
      });
    }
    expect(parseBrowserLaunchState("?p2=bot&skipSelect=1").skipSelection).toBe(true);
  });

  it("routes the AI laboratory explicitly with independently selected profiles", () => {
    const launch = parseBrowserLaunchState(
      "?mode=lab&p1=ranni&p2=killer-bee&bot1=pingo&bot2=v3",
    );

    expect(launch.configuration).toEqual({
      mode: "bot-lab",
      players: [
        { control: "bot", championSlug: "ranni", profileId: "pingo" },
        { control: "bot", championSlug: "killer-bee", profileId: "v3" },
      ],
    });
    expect(botProfileForPlayer(launch.configuration, 0)?.label).toBe("Pingo");
    expect(botProfileForPlayer(launch.configuration, 1)?.label).toBe("V3");
  });

  it("round-trips typed mode configuration while preserving unrelated diagnostics", () => {
    const configuration = createBrowserMatchConfiguration({
      mode: "bot-lab",
      champion1: "nico",
      champion2: "mirelle",
      bot1: "v1",
      bot2: "v2",
    });
    const serialized = serializeBrowserMatchConfiguration(configuration, "?dev=1&bot=1");
    const reparsed = parseBrowserLaunchState(`?${serialized.toString()}`);

    expect(serialized.get("dev")).toBe("1");
    expect(serialized.get("bot")).toBeNull();
    expect(serialized.get("mode")).toBe("lab");
    expect(reparsed.configuration).toEqual(configuration);
  });

  it("uses stable deterministic seeds for restart and advances them only for a new lab match", () => {
    const lab = createBrowserMatchConfiguration({
      mode: "bot-lab",
      bot1: "bomb",
      bot2: "v2",
    });
    const local = createBrowserMatchConfiguration({ mode: "local-duel" });

    expect(seedForBrowserMatch(lab, 1)).toBe(seedForBrowserMatch(lab, 1));
    expect(seedForBrowserMatch(lab, 2)).not.toBe(seedForBrowserMatch(lab, 1));
    expect(seedForBrowserMatch(local, 2)).toBe(seedForBrowserMatch(local, 1));
  });
});
