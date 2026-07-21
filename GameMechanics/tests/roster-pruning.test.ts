import { describe, expect, it } from "vitest";

import { listChampionMembership } from "../../Champions/membership.ts";

describe("approved Champion roster", () => {
  it("contains only the four characters approved by the owner", () => {
    expect(listChampionMembership().map(({ slug }) => slug)).toEqual([
      "ranni",
      "killer-bee",
      "crocodilo-arcano",
      "thresh",
    ]);
  });
});
