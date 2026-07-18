import { describe, expect, it } from "vitest";
import {
  CROCODILO_CHARACTER_ID,
  KILLER_BEE_CHARACTER_ID,
  NICO_CHARACTER_ID,
  NIX_EMBER_CHARACTER_ID,
  PENDULA_CHARACTER_ID,
  RANNI_CHARACTER_ID,
} from "../Champions/index.ts";
import { composeCharacterRoster } from "../src/original-game/Engine/assets.ts";

describe("runtime character roster", () => {
  it("consome somente as definições e os assets canônicos de Champions", () => {
    const roster = composeCharacterRoster();
    expect(
      roster.map(({ id, name, selectionIndex, order, defaultSlot }) => ({
        id,
        name,
        selectionIndex,
        order,
        defaultSlot,
      })),
    ).toEqual([
      {
        id: RANNI_CHARACTER_ID,
        name: "Ranni",
        selectionIndex: 0,
        order: 0,
        defaultSlot: 1,
      },
      {
        id: KILLER_BEE_CHARACTER_ID,
        name: "Killer Bee",
        selectionIndex: 1,
        order: 1,
        defaultSlot: 2,
      },
      {
        id: CROCODILO_CHARACTER_ID,
        name: "Crocodilo Arcano",
        selectionIndex: 2,
        order: 2,
        defaultSlot: undefined,
      },
      {
        id: NICO_CHARACTER_ID,
        name: "Nico",
        selectionIndex: 3,
        order: 3,
        defaultSlot: undefined,
      },
      {
        id: NIX_EMBER_CHARACTER_ID,
        name: "Nix Ember",
        selectionIndex: 4,
        order: 4,
        defaultSlot: undefined,
      },
      {
        id: PENDULA_CHARACTER_ID,
        name: "Pendula",
        selectionIndex: 5,
        order: 5,
        defaultSlot: undefined,
      },
    ]);
    expect(roster.map((entry) => entry.size)).toEqual([
      { width: 160, height: 160 },
      { width: 124, height: 124 },
      { width: 156, height: 156 },
      { width: 116, height: 116 },
      { width: 124, height: 124 },
      { width: 124, height: 124 },
    ]);
    for (const entry of roster) {
      expect(entry.assets?.portraitUrl).toContain("/Champions/");
      expect(Object.values(entry.assets?.staticSprites ?? {}).every(Boolean)).toBe(true);
    }
  });
});
