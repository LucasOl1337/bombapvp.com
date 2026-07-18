// @vitest-environment node

import { describe, expect, it } from "vitest";
import { TILE_SIZE } from "../src/original-game/PersonalConfig/config.ts";
import { GameApp } from "../src/original-game/Engine/game-app.ts";
import { getBombDecision } from "../src/original-game/Engine/bot-bomb.ts";
import { getBotPingoDecision } from "../src/original-game/Engine/bot-pingo.ts";
import { simulateProjectedMovement } from "../Champions/ranni/skill.ts";
import { playAdversarialMatch } from "./support/adversarial-bot-league.mjs";

const DIRECTIONS = ["up", "down", "left", "right"];
const MOVE_EPSILON_PX = 1;

function tileFromPosition(position) {
  return {
    x: Math.floor(position.x / TILE_SIZE),
    y: Math.floor(position.y / TILE_SIZE),
  };
}

function sameTile(left, right) {
  return left.x === right.x && left.y === right.y;
}

function blockedDirections(game, player, deltaMs) {
  const projected = player.skill.projectedPosition;
  if (!projected) return [];
  const context = game.createSkillContext();
  return DIRECTIONS.filter((direction) => {
    const simulated = simulateProjectedMovement(
      player,
      projected,
      direction,
      player.skill.projectedLastMoveDirection,
      deltaMs,
      context,
    );
    return Math.hypot(
      simulated.position.x - projected.x,
      simulated.position.y - projected.y,
    ) < MOVE_EPSILON_PX;
  });
}

describe("Ranni cercada por bomba rival na projeção", () => {
  it("mantém alguma saída executável quando a bomba nasce sobre o fantasma", () => {
    const originalUpdate = GameApp.prototype.update;
    const seenBombIds = new Set();
    const trace = {
      channelStartedAtMs: null,
      bodyAtChannelStart: null,
      bombSpawnedOnProjectionAtMs: null,
      bombTile: null,
      projectedPositionAtSpawn: null,
      blockedDirectionsAtSpawn: null,
      sampleCountAfterSpawn: 0,
      unblockedSampleCount: 0,
      firstBlockedAtMs: null,
      lastBlockedAtMs: null,
      channelEndedAtMs: null,
      channelRemainingBeforeEndMs: null,
      endedInCooldown: false,
      displacementPx: null,
      outcomeDurationMs: null,
    };
    let elapsedMs = 0;
    let trappedBombId = null;

    GameApp.prototype.update = function updateWithTrapTrace(deltaMs) {
      const before = this.players?.[2]
        ? {
            phase: this.players[2].skill.phase,
            channelRemainingMs: this.players[2].skill.channelRemainingMs,
          }
        : null;
      originalUpdate.call(this, deltaMs);
      elapsedMs += deltaMs;

      const pingo = this.players?.[2];
      if (!pingo) return;
      if (pingo.skill.phase === "channeling" && trace.channelStartedAtMs === null) {
        trace.channelStartedAtMs = elapsedMs;
        trace.bodyAtChannelStart = { ...pingo.position };
      }

      for (const bomb of this.bombs) {
        if (seenBombIds.has(bomb.id)) continue;
        seenBombIds.add(bomb.id);
        const projection = pingo.skill.projectedPosition;
        if (
          bomb.ownerId === 1
          && pingo.skill.phase === "channeling"
          && projection
          && sameTile(bomb.tile, tileFromPosition(projection))
        ) {
          trappedBombId = bomb.id;
          trace.bombSpawnedOnProjectionAtMs = elapsedMs;
          trace.bombTile = { ...bomb.tile };
          trace.projectedPositionAtSpawn = { ...projection };
        }
      }

      const trappedBombStillExists = trappedBombId !== null
        && this.bombs.some((bomb) => bomb.id === trappedBombId);
      if (trappedBombStillExists && pingo.skill.phase === "channeling") {
        const blocked = blockedDirections(this, pingo, deltaMs);
        if (trace.blockedDirectionsAtSpawn === null) {
          trace.blockedDirectionsAtSpawn = blocked;
        }
        trace.sampleCountAfterSpawn += 1;
        if (blocked.length < DIRECTIONS.length) {
          trace.unblockedSampleCount += 1;
        } else {
          trace.firstBlockedAtMs ??= elapsedMs;
          trace.lastBlockedAtMs = elapsedMs;
        }
      }

      if (before?.phase === "channeling" && pingo.skill.phase === "cooldown") {
        trace.channelEndedAtMs = elapsedMs;
        trace.channelRemainingBeforeEndMs = before.channelRemainingMs;
        trace.endedInCooldown = true;
        trace.displacementPx = Math.hypot(
          pingo.position.x - trace.bodyAtChannelStart.x,
          pingo.position.y - trace.bodyAtChannelStart.y,
        );
      }
    };

    let outcome;
    try {
      outcome = playAdversarialMatch({
        seed: "pingo-v3-dev-c:open-no-drops:10",
        arenaVariant: "open-no-drops",
        characterIndex: 0,
        policies: { Bomb: getBombDecision, Pingo: getBotPingoDecision },
        spawnOrder: ["Bomb", "Pingo"],
      });
    } finally {
      GameApp.prototype.update = originalUpdate;
    }
    trace.outcomeDurationMs = outcome.durationMs;

    expect(trace.bombSpawnedOnProjectionAtMs).not.toBeNull();
    expect(trace.blockedDirectionsAtSpawn.length).toBeLessThan(DIRECTIONS.length);
    expect(trace.sampleCountAfterSpawn).toBeGreaterThan(0);
    expect(trace.endedInCooldown).toBe(true);
    expect(trace.displacementPx).toBeGreaterThan(MOVE_EPSILON_PX);

    // A newly placed rival bomb must not remove every exit.
    expect(trace.unblockedSampleCount).toBeGreaterThan(0);
  }, 10_000);
});
