import { describe, expect, it } from "vitest";
import { CHAMPION_MEMBERSHIP } from "../Champions/index.ts";
import { composeCharacterRoster } from "../src/original-game/Engine/assets.ts";

const RANNI_CHARACTER_ID = CHAMPION_MEMBERSHIP.ranni.characterId;
const KILLER_BEE_CHARACTER_ID = CHAMPION_MEMBERSHIP["killer-bee"].characterId;
const CROCODILO_CHARACTER_ID =
  CHAMPION_MEMBERSHIP["crocodilo-arcano"].characterId;
const NICO_CHARACTER_ID = CHAMPION_MEMBERSHIP.nico.characterId;
const NIX_EMBER_CHARACTER_ID = CHAMPION_MEMBERSHIP["nix-ember"].characterId;
const PENDULA_CHARACTER_ID = CHAMPION_MEMBERSHIP.pendula.characterId;
const MIRELLE_CHARACTER_ID = CHAMPION_MEMBERSHIP.mirelle.characterId;
const LEE_SIN_CHARACTER_ID = CHAMPION_MEMBERSHIP["lee-sin"].characterId;
const THRESH_CHARACTER_ID = CHAMPION_MEMBERSHIP["thresh"].characterId;
const KATARINA_CHARACTER_ID = CHAMPION_MEMBERSHIP["katarina"].characterId;
const MADARA_CHARACTER_ID = CHAMPION_MEMBERSHIP["madara"].characterId;

describe("runtime character roster", () => {
  it("consome somente as definições e os assets canônicos de Champions", () => {
    const roster = composeCharacterRoster();
    expect(roster).toHaveLength(11);
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
      {
        id: MIRELLE_CHARACTER_ID,
        name: "Mirelle",
        selectionIndex: 6,
        order: 6,
        defaultSlot: undefined,
      },
      {
        id: LEE_SIN_CHARACTER_ID,
        name: "Lee Sin",
        selectionIndex: 7,
        order: 7,
        defaultSlot: undefined,
      },
      {
        id: THRESH_CHARACTER_ID,
        name: "Thresh",
        selectionIndex: 8,
        order: 8,
        defaultSlot: undefined,
      },
      {
        id: KATARINA_CHARACTER_ID,
        name: "Katarina",
        selectionIndex: 9,
        order: 9,
        defaultSlot: undefined,
      },
      {
        id: MADARA_CHARACTER_ID,
        name: "Madara",
        selectionIndex: 10,
        order: 10,
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
      { width: 124, height: 124 },
      { width: 160, height: 160 },
      { width: 160, height: 160 },
      { width: 160, height: 160 },
      { width: 160, height: 160 },
    ]);
    for (const entry of roster) {
      expect(entry.assets?.portraitUrl).toContain("/Champions/");
      expect(Object.values(entry.assets?.staticSprites ?? {}).every(Boolean)).toBe(true);
    }
  });
});
