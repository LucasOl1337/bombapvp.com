import type { PlayerId } from "../original-game/Gameplay/types.ts";
import type { OnlineGameSnapshot, OnlineInputState } from "../original-game/NetCode/protocol.ts";
import type { LabClient, LabDecision, LabDecisionResult } from "./client.ts";

type LabGame = Pick<{
  exportOnlineSnapshot(): OnlineGameSnapshot;
  setServerPlayerInput(playerId: PlayerId, input: OnlineInputState): void;
}, "exportOnlineSnapshot" | "setServerPlayerInput">;

export type LabCompetitor = Readonly<{ playerId: PlayerId; model: string }>;
export type LabControllerStatus = Readonly<{
  playerId: PlayerId;
  state: "waiting" | "thinking" | "acting" | "error" | "stopped";
  error?: string;
}>;
export type LabControllerEvent =
  | Readonly<{ type: "status"; status: LabControllerStatus }>
  | Readonly<{ type: "decision"; playerId: PlayerId; result: LabDecisionResult }>;

const NEUTRAL_INPUT: OnlineInputState = Object.freeze({
  direction: null,
  bombPressed: false,
  detonatePressed: false,
  skillPressed: false,
  skillHeld: false,
});

export function buildLabObservation(snapshot: OnlineGameSnapshot, playerId: PlayerId) {
  const self = snapshot.players[playerId];
  return {
    playerId,
    round: snapshot.roundNumber,
    elapsedMs: snapshot.roundTimeMs,
    self: {
      tile: self.tile,
      direction: self.direction,
      alive: self.alive,
      bombsAvailable: Math.max(0, self.maxBombs - self.activeBombs),
      flameRange: self.flameRange,
      shieldCharges: self.shieldCharges,
      skill: { phase: self.skill.phase, cooldownMs: self.skill.cooldownRemainingMs },
    },
    enemies: snapshot.activePlayerIds
      .filter((id) => id !== playerId)
      .map((id) => ({ id, tile: snapshot.players[id].tile, alive: snapshot.players[id].alive })),
    bombs: snapshot.bombs.map((bomb) => ({
      ownerId: bomb.ownerId,
      tile: bomb.tile,
      fuseMs: Math.round(bomb.fuseMs),
      flameRange: bomb.flameRange,
    })),
    flames: snapshot.flames.map((flame) => flame.tile),
    powerUps: snapshot.powerUps
      .filter((powerUp) => powerUp.revealed && !powerUp.collected)
      .map((powerUp) => ({ type: powerUp.type, tile: powerUp.tile })),
    arena: {
      grid: snapshot.arena.grid,
      solid: snapshot.arena.tiles.solid,
      breakable: snapshot.breakableTiles,
    },
  };
}

function toInput(decision: LabDecision): OnlineInputState {
  return {
    direction: decision.direction,
    bombPressed: decision.placeBomb,
    detonatePressed: decision.detonate,
    skillPressed: decision.useSkill,
    skillHeld: false,
  };
}

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const finish = (): void => {
      clearTimeout(timeout);
      signal.removeEventListener("abort", finish);
      resolve();
    };
    const timeout = setTimeout(finish, ms);
    signal.addEventListener("abort", finish, { once: true });
  });
}

export function startLabController(
  game: LabGame,
  client: LabClient,
  competitors: readonly LabCompetitor[],
  onEvent: (event: LabControllerEvent) => void = () => undefined,
): () => void {
  const controller = new AbortController();
  const { signal } = controller;

  for (const competitor of competitors) {
    game.setServerPlayerInput(competitor.playerId, NEUTRAL_INPUT);
  }

  for (const competitor of competitors) {
    void (async () => {
      while (!signal.aborted) {
        const snapshot = game.exportOnlineSnapshot();
        const player = snapshot.players[competitor.playerId];
        if (snapshot.mode !== "match" || snapshot.paused || snapshot.roundOutcome || !player?.active || !player.alive) {
          game.setServerPlayerInput(competitor.playerId, NEUTRAL_INPUT);
          onEvent({ type: "status", status: { playerId: competitor.playerId, state: "waiting" } });
          await delay(300, signal);
          continue;
        }

        try {
          onEvent({ type: "status", status: { playerId: competitor.playerId, state: "thinking" } });
          const result = await client.decide({
            model: competitor.model,
            observation: buildLabObservation(snapshot, competitor.playerId),
          }, signal);
          if (signal.aborted) break;
          game.setServerPlayerInput(competitor.playerId, toInput(result.decision));
          onEvent({ type: "decision", playerId: competitor.playerId, result });
          onEvent({ type: "status", status: { playerId: competitor.playerId, state: "acting" } });
          await delay(result.decision.durationMs, signal);
          game.setServerPlayerInput(competitor.playerId, NEUTRAL_INPUT);
        } catch (error) {
          if (signal.aborted) break;
          game.setServerPlayerInput(competitor.playerId, NEUTRAL_INPUT);
          onEvent({
            type: "status",
            status: {
              playerId: competitor.playerId,
              state: "error",
              error: error instanceof Error ? error.message : "lab_decision_failed",
            },
          });
          await delay(1000, signal);
        }
      }
      game.setServerPlayerInput(competitor.playerId, NEUTRAL_INPUT);
      onEvent({ type: "status", status: { playerId: competitor.playerId, state: "stopped" } });
    })();
  }

  return () => controller.abort();
}
