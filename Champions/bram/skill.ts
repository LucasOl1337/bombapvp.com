import type {
  Direction,
  PlayerState,
  TileCoord,
} from "../../src/original-game/Gameplay/types";
import { tileKey } from "../../src/original-game/Arenas/arena";
import type { SkillContext } from "../../src/original-game/ultimate/shared";
import type { ChampionSkillAdapter } from "../runtime-contracts";
import { BRAM_SKILL_COOLDOWN_MS, BRAM_SKILL_ID } from "./definition";

export { BRAM_CHARACTER_ID, BRAM_SKILL_COOLDOWN_MS } from "./definition";

export const BRAM_SKILL_CHANNEL_MS = 350;
export const BRAM_CRACK_RANGE = 2;

export type BramSkillContext = Pick<
  SkillContext,
  "arena" | "getTileFromPosition" | "breakCrateAtKey" | "soundManager"
>;

function chebyshev(a: TileCoord, b: TileCoord): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

/** List breakable crate tiles within Chebyshev range of origin. */
export function listSeismicCrackTargets(
  origin: TileCoord,
  context: BramSkillContext,
): TileCoord[] {
  const tiles: TileCoord[] = [];
  for (const key of context.arena.breakable) {
    const [xs, ys] = key.split(",");
    const tile = { x: Number(xs), y: Number(ys) };
    if (!Number.isFinite(tile.x) || !Number.isFinite(tile.y)) continue;
    if (chebyshev(origin, tile) <= BRAM_CRACK_RANGE) {
      tiles.push(tile);
    }
  }
  return tiles;
}

export function fireSeismicCrack(
  player: PlayerState,
  context: BramSkillContext,
): number {
  const origin = context.getTileFromPosition(player.position);
  const targets = listSeismicCrackTargets(origin, context);
  let broken = 0;
  for (const tile of targets) {
    if (context.breakCrateAtKey(tileKey(tile.x, tile.y))) {
      broken += 1;
    }
  }
  context.soundManager.playOneShot("crateBreak");
  return broken;
}

export const BRAM_SKILL_ADAPTER: ChampionSkillAdapter = {
  skillId: BRAM_SKILL_ID,
  activate: (player, direction) => startBramSeismicCrack(player, direction),
  update: (player, direction, _p, _h, deltaMs, context) =>
    updateBramSeismicCrack(player, direction, deltaMs, context),
};
export const CHAMPION_SKILL_ADAPTER = BRAM_SKILL_ADAPTER;

export function startBramSeismicCrack(
  player: PlayerState,
  desiredDirection: Direction | null,
): void {
  if (player.skill.id !== BRAM_SKILL_ID) return;
  const aim =
    desiredDirection ?? player.lastMoveDirection ?? player.direction;
  player.direction = aim;
  player.lastMoveDirection = aim;
  player.skill.phase = "channeling";
  player.skill.channelRemainingMs = BRAM_SKILL_CHANNEL_MS;
  player.skill.cooldownRemainingMs = 0;
  player.skill.castElapsedMs = 0;
  player.skill.projectedPosition = null;
  player.skill.projectedLastMoveDirection = aim;
  player.velocity.x = 0;
  player.velocity.y = 0;
}

export function updateBramSeismicCrack(
  player: PlayerState,
  desiredDirection: Direction | null,
  deltaMs: number,
  context: BramSkillContext,
): boolean {
  if (player.skill.id !== BRAM_SKILL_ID) return false;
  if (!Number.isFinite(deltaMs) || deltaMs <= 0) return true;
  player.velocity.x = 0;
  player.velocity.y = 0;
  if (desiredDirection) {
    player.direction = desiredDirection;
    player.skill.projectedLastMoveDirection = desiredDirection;
  }
  player.skill.channelRemainingMs = Math.max(
    0,
    player.skill.channelRemainingMs - deltaMs,
  );
  player.skill.castElapsedMs += deltaMs;
  if (player.skill.channelRemainingMs <= 0) {
    fireSeismicCrack(player, context);
    player.skill.phase = "cooldown";
    player.skill.cooldownRemainingMs = BRAM_SKILL_COOLDOWN_MS;
    player.skill.castElapsedMs = 0;
    player.skill.projectedPosition = null;
    player.skill.projectedLastMoveDirection = null;
  }
  return true;
}
