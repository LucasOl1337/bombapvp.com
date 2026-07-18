import type {
  Direction,
  PixelCoord,
  PlayerState,
  TileCoord,
} from "../../src/original-game/Gameplay/types";
import { TILE_SIZE } from "../../src/original-game/PersonalConfig/config";
import type { SkillContext } from "../../src/original-game/ultimate/shared";
import type { ChampionSkillAdapter } from "../runtime-contracts";
import { LUMEN_SKILL_COOLDOWN_MS, LUMEN_SKILL_ID } from "./definition";

export { LUMEN_CHARACTER_ID, LUMEN_SKILL_COOLDOWN_MS } from "./definition";

export const LUMEN_FLASH_MAX_TILES = 2;
export const LUMEN_BLOCKED_COOLDOWN_MS = 400;

export type LumenSkillContext = Pick<
  SkillContext,
  | "arena"
  | "getTileFromPosition"
  | "normalizeArenaPosition"
  | "canOccupyPosition"
  | "soundManager"
>;

const directionDelta: Record<Direction, TileCoord> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

function tileCenter(tile: TileCoord): PixelCoord {
  return {
    x: tile.x * TILE_SIZE + TILE_SIZE * 0.5,
    y: tile.y * TILE_SIZE + TILE_SIZE * 0.5,
  };
}

/** Walk up to LUMEN_FLASH_MAX_TILES along facing; stop before first blocked tile. */
export function computeFlashStepLanding(
  player: PlayerState,
  direction: Direction,
  context: LumenSkillContext,
): TileCoord {
  const start = context.getTileFromPosition(player.position);
  const delta = directionDelta[direction];
  let last = { ...start };
  for (let step = 1; step <= LUMEN_FLASH_MAX_TILES; step += 1) {
    const next = { x: start.x + delta.x * step, y: start.y + delta.y * step };
    const key = `${next.x},${next.y}`;
    if (context.arena.solid.has(key) || context.arena.breakable.has(key)) {
      break;
    }
    const pos = tileCenter(next);
    if (!context.canOccupyPosition(player, pos)) {
      break;
    }
    last = next;
  }
  return last;
}

export function fireFlashStep(
  player: PlayerState,
  direction: Direction,
  context: LumenSkillContext,
): boolean {
  const start = context.getTileFromPosition(player.position);
  const landing = computeFlashStepLanding(player, direction, context);
  if (landing.x === start.x && landing.y === start.y) {
    return false;
  }
  const pos = context.normalizeArenaPosition(tileCenter(landing));
  player.position = { ...pos };
  player.tile = context.getTileFromPosition(player.position);
  player.direction = direction;
  player.lastMoveDirection = direction;
  player.velocity.x = 0;
  player.velocity.y = 0;
  context.soundManager.playOneShot("matchStart");
  return true;
}

export const LUMEN_SKILL_ADAPTER: ChampionSkillAdapter = {
  skillId: LUMEN_SKILL_ID,
  activate: (player, direction, context) =>
    startLumenFlashStep(player, direction, context),
  update: () => false,
  allowsPlayerOverlap: true,
};
export const CHAMPION_SKILL_ADAPTER = LUMEN_SKILL_ADAPTER;

export function startLumenFlashStep(
  player: PlayerState,
  desiredDirection: Direction | null,
  context: LumenSkillContext,
): void {
  if (player.skill.id !== LUMEN_SKILL_ID) return;
  const aim =
    desiredDirection ?? player.lastMoveDirection ?? player.direction;
  const moved = fireFlashStep(player, aim, context);
  player.skill.phase = "cooldown";
  player.skill.channelRemainingMs = 0;
  player.skill.cooldownRemainingMs = moved
    ? LUMEN_SKILL_COOLDOWN_MS
    : LUMEN_BLOCKED_COOLDOWN_MS;
  player.skill.castElapsedMs = 0;
  player.skill.projectedPosition = null;
  player.skill.projectedLastMoveDirection = null;
  player.velocity.x = 0;
  player.velocity.y = 0;
}
