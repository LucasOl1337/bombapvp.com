import type { PlayerId, PlayerState } from "../original-game/Gameplay/types";
import type { OnlineGameSnapshot } from "../original-game/NetCode/protocol";

function observePlayer(player: PlayerState) {
  return {
    id: player.id,
    tile: player.tile,
    position: player.position,
    velocity: player.velocity,
    direction: player.direction,
    lastMoveDirection: player.lastMoveDirection,
    alive: player.alive,
    bombsAvailable: Math.max(0, player.maxBombs - player.activeBombs),
    bombCapacity: player.maxBombs,
    flameRange: player.flameRange,
    speedLevel: player.speedLevel,
    remoteLevel: player.remoteLevel,
    shieldCharges: player.shieldCharges,
    bombPassLevel: player.bombPassLevel,
    kickLevel: player.kickLevel,
    shortFuseLevel: player.shortFuseLevel,
    flameGuardMs: player.flameGuardMs,
    spawnProtectionMs: player.spawnProtectionMs,
    skill: {
      id: player.skill.id,
      phase: player.skill.phase,
      channelRemainingMs: player.skill.channelRemainingMs,
      cooldownMs: player.skill.cooldownRemainingMs,
      projectedPosition: player.skill.projectedPosition,
    },
  };
}

/** Stable, serializable observation shared by Lab decision sources. */
export function buildLabObservation(snapshot: OnlineGameSnapshot, playerId: PlayerId) {
  const self = snapshot.players[playerId];
  return {
    playerId,
    frameId: snapshot.frameId,
    serverTimeMs: snapshot.serverTimeMs,
    round: snapshot.roundNumber,
    elapsedMs: snapshot.roundTimeMs,
    score: snapshot.score,
    endlessStats: snapshot.endlessStats,
    self: observePlayer(self),
    enemies: snapshot.activePlayerIds
      .filter((id) => id !== playerId)
      .map((id) => observePlayer(snapshot.players[id])),
    bombs: snapshot.bombs.map((bomb) => ({
      id: bomb.id,
      ownerId: bomb.ownerId,
      tile: bomb.tile,
      fuseMs: Math.round(bomb.fuseMs),
      flameRange: bomb.flameRange,
      ownerCanPass: bomb.ownerCanPass,
    })),
    flames: snapshot.flames.map((flame) => ({
      tile: flame.tile,
      remainingMs: Math.round(flame.remainingMs),
      ownerId: flame.ownerId ?? null,
    })),
    magicBeams: snapshot.magicBeams.map((beam) => ({
      ownerId: beam.ownerId,
      origin: beam.origin,
      direction: beam.direction,
      tiles: beam.tiles.map((tile) => ({ ...tile })),
      remainingMs: Math.round(beam.remainingMs),
    })),
    powerUps: snapshot.powerUps
      .filter((powerUp) => powerUp.revealed && !powerUp.collected)
      .map((powerUp) => ({ type: powerUp.type, tile: powerUp.tile })),
    arena: {
      grid: snapshot.arena.grid,
      solid: snapshot.arena.tiles.solid,
      breakable: snapshot.breakableTiles,
      wrapPortals: snapshot.arena.wrapPortals,
    },
    suddenDeath: {
      active: snapshot.suddenDeathActive,
      closedTiles: snapshot.suddenDeathClosedTiles,
      closingTiles: snapshot.suddenDeathClosingTiles,
    },
  };
}
