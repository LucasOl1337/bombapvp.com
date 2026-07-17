import { describe, expect, it } from "vitest";

import {
  CROCODILO_CHARACTER_ID,
  KILLER_BEE_CHARACTER_ID,
  NICO_CHARACTER_ID,
  RANNI_CHARACTER_ID,
} from "../src/characters/catalog.ts";
import { composeCharacterRoster } from "../src/original-game/Engine/assets.ts";

describe("runtime character roster", () => {
  it("mantem identidade e ordem canonicas ao enriquecer um manifesto fisico", () => {
    const roster = composeCharacterRoster({
      generatedAt: "asset-version-1",
      characters: [
        {
          id: "extra-character",
          name: "Extra",
          order: -1,
          defaultSlot: 4,
          size: { width: 999, height: 999 },
        },
        {
          id: NICO_CHARACTER_ID,
          name: "Nome adulterado",
          order: 0,
          defaultSlot: 1,
          size: { width: 116, height: 116 },
          animations: { idle: true },
        },
        {
          id: RANNI_CHARACTER_ID,
          name: "Outra Ranni",
          order: 99,
          defaultSlot: 4,
          size: { width: 160, height: 160 },
        },
      ],
    });

    expect(roster.map(({ id, name, selectionIndex, order, defaultSlot }) => ({
      id,
      name,
      selectionIndex,
      order,
      defaultSlot,
    }))).toEqual([
      { id: RANNI_CHARACTER_ID, name: "Ranni", selectionIndex: 0, order: 0, defaultSlot: 1 },
      { id: KILLER_BEE_CHARACTER_ID, name: "Killer Bee", selectionIndex: 1, order: 1, defaultSlot: 2 },
      { id: CROCODILO_CHARACTER_ID, name: "Crocodilo Arcano", selectionIndex: 2, order: 2, defaultSlot: undefined },
      { id: NICO_CHARACTER_ID, name: "Nico", selectionIndex: 3, order: 3, defaultSlot: undefined },
    ]);
    expect(roster[0]).toMatchObject({
      size: { width: 160, height: 160 },
      assetVersion: "asset-version-1",
    });
    expect(roster[3]).toMatchObject({
      size: { width: 116, height: 116 },
      animations: { idle: true },
      assetVersion: "asset-version-1",
    });
  });
});
