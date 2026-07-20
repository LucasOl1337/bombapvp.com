import { describe, expect, it } from "vitest";
import { CHAMPION_MEMBERSHIP } from "../Champions/membership.ts";
import {
  DuelMatchQueue,
  placementFromRequestLocation,
  selectPlacement,
  type DuelQueueCandidate,
} from "../src/online/matchmaking/duel-queue.ts";

function candidate(
  connectionId: string,
  overrides: Partial<DuelQueueCandidate> = {},
): DuelQueueCandidate {
  return {
    connectionId,
    clientNonce: `${connectionId.padEnd(16, "0")}`,
    characterId: CHAMPION_MEMBERSHIP.ranni.characterId,
    joinedAtMs: 1_800_000_000_000,
    region: "sam",
    ...overrides,
  };
}

describe("duel 1v1 queue", () => {
  it("keeps one human waiting and pairs FIFO only with a different logical client", () => {
    const queue = new DuelMatchQueue();
    const first = candidate("first");
    const sameBrowser = candidate("second-tab", { clientNonce: first.clientNonce });
    const opponent = candidate("opponent", { region: "enam" });

    expect(queue.enqueue(first)).toEqual({ ok: true, pair: null });
    expect(queue.enqueue(sameBrowser)).toEqual({ ok: true, pair: null });
    expect(queue.size).toBe(2);
    const result = queue.enqueue(opponent);
    expect(result.ok && result.pair).not.toBeNull();
    expect(result.ok && Object.values(result.pair!.seats).map(({ connectionId }) => connectionId).sort())
      .toEqual(["first", "opponent"]);
    expect(queue.snapshot().map(({ connectionId }) => connectionId)).toEqual(["second-tab"]);
  });

  it("rejects duplicate connections and removes a closed waiter", () => {
    const queue = new DuelMatchQueue();
    expect(queue.enqueue(candidate("one")).ok).toBe(true);
    expect(queue.enqueue(candidate("one"))).toEqual({ ok: false, code: "already-queued" });
    expect(queue.remove("one")).toBe(true);
    expect(queue.remove("one")).toBe(false);
    expect(queue.size).toBe(0);
  });

  it("chooses measured placement by worst RTT, then spread, instead of average alone", () => {
    const first = candidate("one", {
      region: "sam",
      latencyMs: { sam: 20, enam: 95, weur: 190 },
    });
    const second = candidate("two", {
      region: "weur",
      latencyMs: { sam: 220, enam: 105, weur: 25 },
    });

    expect(selectPlacement(first, second)).toEqual({ placement: "enam", basis: "probe-minimax" });
  });

  it("marks unmeasured cross-region placement as fallback and maps request geography", () => {
    expect(selectPlacement(candidate("one"), candidate("two", { region: "weur" })))
      .toEqual({ placement: "enam", basis: "fallback-unmeasured" });
    expect(placementFromRequestLocation({ continent: "SA", country: "BR" })).toBe("sam");
    expect(placementFromRequestLocation({ continent: "AS", country: "AE" })).toBe("me");
    expect(placementFromRequestLocation({})).toBe("enam");
  });
});
