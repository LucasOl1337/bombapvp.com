import { describe, expect, it } from "vitest";

import { listChampionMembership } from "../../Champions/membership.ts";

describe("approved Champion roster", () => {
  it("contains the shipped four plus the local Zed Living Shadow slice", () => {
    expect(listChampionMembership().map(({ slug }) => slug)).toEqual([
      "ranni",
      "killer-bee",
      "crocodilo-arcano",
      "thresh",
      "zed",
    ]);
  });

  it("keeps Zed out of default public seats while remaining selectable", () => {
    const membership = listChampionMembership();
    const zed = membership.find((entry) => entry.slug === "zed");
    expect(zed).toMatchObject({
      slug: "zed",
      skillId: "zed-living-shadow",
      name: "Zed",
      skillCooldownMs: 7_000,
    });
    expect(zed?.defaultSlot).toBeUndefined();
    expect(membership.filter((entry) => entry.defaultSlot !== undefined).map((e) => e.slug)).toEqual([
      "ranni",
      "killer-bee",
    ]);
  });
});
