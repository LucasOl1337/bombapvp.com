import type { CharacterSkillId } from "./contracts";
import type {
  Direction,
  PixelCoord,
  PlayerState,
} from "../src/original-game/Gameplay/types";
import type { SkillContext } from "../src/original-game/ultimate/shared";

export type ChampionSkillPhase =
  | "idle"
  | "channeling"
  | "releasing"
  | "cooldown";

/** State shared by the Champion runtime and persisted by the generic engine. */
export interface ChampionPlayerSkillState {
  id: CharacterSkillId | null;
  phase: ChampionSkillPhase;
  channelRemainingMs: number;
  cooldownRemainingMs: number;
  castElapsedMs: number;
  projectedPosition: PixelCoord | null;
  projectedLastMoveDirection: Direction | null;
  projectedBombEgressIds?: number[];
}

export interface ChampionSkillAdapter {
  readonly skillId: CharacterSkillId;
  activate(
    player: PlayerState,
    direction: Direction | null,
    context: SkillContext,
  ): void;
  update(
    player: PlayerState,
    direction: Direction | null,
    pressed: boolean,
    held: boolean,
    deltaMs: number,
    context: SkillContext,
  ): boolean;
  immune?: (player: PlayerState) => boolean;
  projectedIgnoredBombIds?: (player: PlayerState) => readonly number[];
  projectTarget?: (
    player: PlayerState,
    direction: Direction,
    context: SkillContext,
  ) => PixelCoord;
  allowsPlayerOverlap?: true;
  bombPlaced?: (player: PlayerState, bombId: number, overlaps: boolean) => void;
  bombRemoved?: (player: PlayerState, bombId: number) => void;
}
