// @vitest-environment node

import { describe, expect, it } from "vitest";
import { GameApp } from "../src/original-game/Engine/game-app.ts";
import { getBombDecision } from "../src/original-game/Engine/bot-bomb.ts";
import { getBotPingoDecision } from "../src/original-game/Engine/bot-pingo.ts";
import { playAdversarialMatch } from "./support/adversarial-bot-league.mjs";

const DIRECTIONS = ["up", "down", "left", "right"];

describe("bomba rival plantada sobre corpo adjacente", () => {
  it("mantém ao menos uma saída física para o jogador inicialmente sobreposto", () => {
    const originalUpdate = GameApp.prototype.update;
    const seenBombIds = new Set();
    const trace = {
      elapsedMs: 0,
      plantAtMs: null,
      bombId: null,
      bombTile: null,
      victimTile: null,
      victimPosition: null,
      bodyEgressPlayerIdsAtPlant: null,
      initialOverlapArea: null,
      outwardCandidateSampleCount: 0,
      strictOverlapDecreaseCount: 0,
      overlapIncreaseCount: 0,
      overlapAreaSeriesBeforeClear: [],
      bombResolvedAtMs: null,
      victimAliveWhenBombResolved: null,
      victimClearedAtMs: null,
      maxDisplacementPx: 0,
      overlappedAfterClear: false,
      grantReacquiredAfterClear: false,
      sampleCount: 0,
      unblockedSampleCount: 0,
      blockedAtPlant: null,
      lastVictimPosition: null,
      victimDied: false,
    };

    GameApp.prototype.update = function updateWithBodyTrapTrace(deltaMs) {
      originalUpdate.call(this, deltaMs);
      trace.elapsedMs += deltaMs;
      const victim = this.players?.[2];
      if (!victim) return;

      for (const bomb of this.bombs) {
        if (seenBombIds.has(bomb.id)) continue;
        seenBombIds.add(bomb.id);
        if (
          trace.bombId === null
          && bomb.ownerId === 1
          && victim.alive
          && this.isPlayerOverlappingTile(victim, bomb.tile)
          && (victim.tile.x !== bomb.tile.x || victim.tile.y !== bomb.tile.y)
        ) {
          trace.plantAtMs = trace.elapsedMs;
          trace.bombId = bomb.id;
          trace.bombTile = { ...bomb.tile };
          trace.victimTile = { ...victim.tile };
          trace.victimPosition = { ...victim.position };
          trace.bodyEgressPlayerIdsAtPlant = [...(bomb.bodyEgressPlayerIds ?? [])];
          trace.initialOverlapArea = this.getBodyTileOverlapArea(victim.position, bomb.tile);
          trace.overlapAreaSeriesBeforeClear.push(trace.initialOverlapArea);

          const context = this.createBotContext();
          trace.outwardCandidateSampleCount += DIRECTIONS.filter((direction) => {
            const option = context.evaluateMovementOption(victim, direction, deltaMs);
            if (!context.canMovementOptionAdvance(victim.position, option)) return false;
            const candidatePosition = option.combinedFree
              && this.positionChanged(victim.position, option.combinedMove)
              ? option.combinedMove
              : option.laneOnlyFree && this.positionChanged(victim.position, option.laneOnlyMove)
                ? option.laneOnlyMove
                : option.forwardOnlyFree && this.positionChanged(victim.position, option.forwardOnlyMove)
                  ? option.forwardOnlyMove
                  : null;
            return candidatePosition !== null
              && this.getBodyTileOverlapArea(candidatePosition, bomb.tile) < trace.initialOverlapArea;
          }).length;
        }
      }

      const trappedBomb = trace.bombId === null
        ? null
        : this.bombs.find((bomb) => bomb.id === trace.bombId);
      if (trace.bombId !== null && !trappedBomb && trace.bombResolvedAtMs === null) {
        trace.bombResolvedAtMs = trace.elapsedMs;
        trace.victimAliveWhenBombResolved = victim.alive;
      }
      if (trappedBomb && victim.alive) {
        const currentOverlapArea = this.getBodyTileOverlapArea(victim.position, trappedBomb.tile);
        if (trace.victimClearedAtMs === null) {
          const previousOverlapArea = trace.overlapAreaSeriesBeforeClear.at(-1);
          if (previousOverlapArea !== undefined && currentOverlapArea > previousOverlapArea) {
            trace.overlapIncreaseCount += 1;
          }
          if (
            previousOverlapArea !== undefined
            && currentOverlapArea > 0
            && currentOverlapArea < previousOverlapArea
          ) {
            trace.strictOverlapDecreaseCount += 1;
          }
          trace.overlapAreaSeriesBeforeClear.push(currentOverlapArea);
        }
        const displacementPx = Math.hypot(
          victim.position.x - trace.victimPosition.x,
          victim.position.y - trace.victimPosition.y,
        );
        trace.maxDisplacementPx = Math.max(trace.maxDisplacementPx, displacementPx);
        const overlapsTrackedBomb = this.isPlayerOverlappingTile(victim, trappedBomb.tile);
        if (!overlapsTrackedBomb && trace.victimClearedAtMs === null) {
          trace.victimClearedAtMs = trace.elapsedMs;
        } else if (overlapsTrackedBomb && trace.victimClearedAtMs !== null) {
          trace.overlappedAfterClear = true;
        }
        if (
          trace.victimClearedAtMs !== null
          && (trappedBomb.bodyEgressPlayerIds ?? []).includes(victim.id)
        ) {
          trace.grantReacquiredAfterClear = true;
        }
        const context = this.createBotContext();
        const executable = DIRECTIONS.filter((direction) => {
          const option = context.evaluateMovementOption(victim, direction, deltaMs);
          return context.canMovementOptionAdvance(victim.position, option);
        });
        trace.sampleCount += 1;
        if (trace.blockedAtPlant === null) {
          trace.blockedAtPlant = DIRECTIONS.filter((direction) => !executable.includes(direction));
        }
        if (executable.length > 0) trace.unblockedSampleCount += 1;
        trace.lastVictimPosition = { ...victim.position };
      }
      if (trace.bombId !== null && !victim.alive) trace.victimDied = true;
    };

    let outcome;
    try {
      outcome = playAdversarialMatch({
        seed: "bomb-pingo-post-egress-dev-a:open-no-drops:4",
        arenaVariant: "open-no-drops",
        characterIndex: 0,
        policies: { Bomb: getBombDecision, Pingo: getBotPingoDecision },
        spawnOrder: ["Pingo", "Bomb"],
      });
    } finally {
      GameApp.prototype.update = originalUpdate;
    }

    expect(trace.plantAtMs).not.toBeNull();
    expect(trace.sampleCount).toBeGreaterThan(0);
    expect(trace.bodyEgressPlayerIdsAtPlant).toContain(2);
    expect(trace.initialOverlapArea).toBeGreaterThan(0);
    expect(trace.outwardCandidateSampleCount).toBeGreaterThan(0);
    expect(trace.overlapIncreaseCount).toBe(0);
    expect(trace.strictOverlapDecreaseCount).toBeGreaterThan(0);
    expect(trace.overlapAreaSeriesBeforeClear.at(-1)).toBe(0);
    expect(outcome.metrics.Bomb.selfDeaths).toBe(0);
    expect(trace.bombResolvedAtMs).not.toBeNull();
    expect(trace.victimAliveWhenBombResolved).toBe(true);
    expect(trace.victimClearedAtMs).not.toBeNull();
    expect(trace.maxDisplacementPx).toBeGreaterThan(0);
    expect(trace.overlappedAfterClear).toBe(false);
    expect(trace.grantReacquiredAfterClear).toBe(false);
    expect(
      trace.unblockedSampleCount,
      JSON.stringify({
        plantAtMs: trace.plantAtMs,
        bombTile: trace.bombTile,
        victimTile: trace.victimTile,
        victimPosition: trace.victimPosition,
        bodyEgressPlayerIdsAtPlant: trace.bodyEgressPlayerIdsAtPlant,
        bombResolvedAtMs: trace.bombResolvedAtMs,
        victimAliveWhenBombResolved: trace.victimAliveWhenBombResolved,
        victimClearedAtMs: trace.victimClearedAtMs,
        maxDisplacementPx: trace.maxDisplacementPx,
        overlappedAfterClear: trace.overlappedAfterClear,
        grantReacquiredAfterClear: trace.grantReacquiredAfterClear,
        sampleCount: trace.sampleCount,
        unblockedSampleCount: trace.unblockedSampleCount,
        blockedAtPlant: trace.blockedAtPlant,
        lastVictimPosition: trace.lastVictimPosition,
        outcomeDurationMs: outcome.durationMs,
      }),
    ).toBeGreaterThan(0);
  });
});
