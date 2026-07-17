import type { PlayerId } from "../../Gameplay/types";
import { listCharacterRosterEntries } from "../../../characters/catalog";

export interface CharacterRosterManifestEntry {
  readonly id: string;
  readonly name: string;
  readonly defaultSlot?: PlayerId;
  readonly order?: number;
}

export const CHARACTER_ROSTER_MANIFEST: readonly CharacterRosterManifestEntry[] = Object.freeze(
  listCharacterRosterEntries().map((entry) => Object.freeze({ ...entry })),
);
