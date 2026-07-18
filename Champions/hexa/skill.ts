import type {
  Direction,
  PlayerState,
  TileCoord,
} from "../../src/original-game/Gameplay/types";
import type { SkillContext } from "../../src/original-game/ultimate/shared";
import type { ChampionSkillAdapter } from "../runtime-contracts";
import { HEXA_SKILL_COOLDOWN_MS, HEXA_SKILL_ID } from "./definition";

export { HEXA_CHARACTER_ID, HEXA_SKILL_COOLDOWN_MS } from "./definition";

export const HEXA_SKILL_CHANNEL_MS = 300;
export const HEXA_HEX_RANGE = 3;
export const HEXA_FUSE_FLOOR_MS = 400;

export type HexaSkillContext = Pick<
  SkillContext,
  "bombs" | "getTileFromPosition" | "soundManager"
>;

function chebyshev(a: TileCoord, b: TileCoord): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

/** Halve fuse of bombs in range (floor HEXA_FUSE_FLOOR_MS). Returns count hexed. */
export function fireFuseHex(
  player: PlayerState,
  context: HexaSkillContext,
): number {
  const origin = context.getTileFromPosition(player.position);
  let hexed = 0;
  for (const bomb of context.bombs) {
    if (chebyshev(origin, bomb.tile) > HEXA_HEX_RANGE) continue;
    const next = Math.max(
      HEXA_FUSE_FLOOR_MS,
      Math.floor(bomb.fuseMs * 0.5),
    );
    if (next < bomb.fuseMs) {
      bomb.fuseMs = next;
      hexed += 1;
    }
  }
  context.soundManager.playOneShot("powerCollect");
  return hexed;
}

export const HEXA_SKILL_ADAPTER: ChampionSkillAdapter = {
  skillId: HEXA_SKILL_ID,
  activate: (player, direction) => startHexaFuseHex(player, direction),
  update: (player, direction, _p, _h, deltaMs, context) =>
    updateHexaFuseHex(player, direction, deltaMs, context),
};
export const CHAMPION_SKILL_ADAPTER = HEXA_SKILL_ADAPTER;

export function startHexaFuseHex(
  player: PlayerState,
  desiredDirection: Direction | null,
): void {
  if (player.skill.id !== HEXA_SKILL_ID) return;
  const aim =
    desiredDirection ?? player.lastMoveDirection ?? player.direction;
  player.direction = aim;
  player.lastMoveDirection = aim;
  player.skill.phase = "channeling";
  player.skill.channelRemainingMs = HEXA_SKILL_CHANNEL_MS;
  player.skill.cooldownRemainingMs = 0;
  player.skill.castElapsedMs = 0;
  player.skill.projectedPosition = null;
  player.skill.projectedLastMoveDirection = aim;
  player.velocity.x = 0;
  player.velocity.y = 0;
}

export function updateHexaFuseHex(
  player: PlayerState,
  desiredDirection: Direction | null,
  deltaMs: number,
  context: HexaSkillContext,
): boolean {
  if (player.skill.id !== HEXA_SKILL_ID) return false;
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
    fireFuseHex(player, context);
    player.skill.phase = "cooldown";
    player.skill.cooldownRemainingMs = HEXA_SKILL_COOLDOWN_MS;
    player.skill.castElapsedMs = 0;
    player.skill.projectedPosition = null;
    player.skill.projectedLastMoveDirection = null;
  }
  return true;
}
