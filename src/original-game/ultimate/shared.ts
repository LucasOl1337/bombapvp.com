import type {
  ArenaState,
  BombState,
  CharacterSkillId,
  Direction,
  FlameStyle,
  PixelCoord,
  PlayerId,
  PlayerState,
  TileCoord,
} from "../Gameplay/types";
import type { CharacterRosterEntry } from "../Engine/assets";
import type { ChampionWorldEffect } from "../../../Champions/world-effects";

/** Engine services exposed to an individual Champion mechanic. */
export interface SkillContext {
  arena: ArenaState;
  bombs: BombState[];
  players: Record<PlayerId, PlayerState>;
  activePlayerIds: PlayerId[];
  addChampionWorldEffect: (effect: ChampionWorldEffect) => void;
  selectedCharacterIndex: Record<PlayerId, number>;
  characterRoster: CharacterRosterEntry[];
  canOccupyPosition: (player: PlayerState, position: PixelCoord) => boolean;
  getTileFromPosition: (position: PixelCoord) => TileCoord;
  normalizeArenaPosition: (position: PixelCoord) => PixelCoord;
  getWrappedDelta: (target: number, current: number, size: number) => number;
  resolveMovementDirection: (
    player: PlayerState,
    direction: Direction,
    deltaMs: number,
    ignoredBombIds?: readonly number[],
  ) => Direction;
  movePlayerSimulated: (
    player: PlayerState,
    direction: Direction,
    deltaMs: number,
    ignoredBombIds?: readonly number[],
  ) => void;
  isPositionOverlappingTile: (position: PixelCoord, tile: TileCoord) => boolean;
  clonePlayerState: (player: PlayerState) => PlayerState;
  tryAbsorbInstantHit: (
    player: PlayerState,
    attackerId?: PlayerId | null,
  ) => void;
  breakCrateAtKey: (key: string) => boolean;
  addFlame: (
    tile: TileCoord,
    durationMs: number,
    style: FlameStyle,
    ownerId: PlayerId | null,
  ) => void;
  soundManager: { playOneShot: (name: string) => void };
}

export function createDefaultPlayerSkillState(
  skillId: CharacterSkillId | null,
) {
  return {
    id: skillId,
    phase: "idle" as const,
    channelRemainingMs: 0,
    cooldownRemainingMs: 0,
    castElapsedMs: 0,
    projectedPosition: null,
    projectedLastMoveDirection: null,
    projectedBombEgressIds: [],
  };
}
