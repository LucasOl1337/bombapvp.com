import type { CharacterId } from "../../../Champions/membership";
import type { OnlineGameSnapshot, OnlineInputState } from "../../original-game/NetCode/protocol";
import type { PlayerId } from "../../original-game/Gameplay/types";
import type { AuthoritativeSimulationKernel, KernelInput } from "../runtime/simulation-kernel";

export interface HeadlessGameAppPort {
  startServerAuthoritativeMatch(
    activePlayerIds: PlayerId[],
    characterSelections: Record<PlayerId, number>,
    options: {
      roomMode: "classic";
      botPlayerIds: PlayerId[];
      playerLabels: Record<PlayerId, string>;
      hideNativeHud: boolean;
    },
  ): void;
  replaceServerPlayerInput(playerId: PlayerId, input: OnlineInputState): void;
  clearServerPlayerInput(playerId: PlayerId): void;
  advanceServerSimulation(deltaMs: number): void;
  exportOnlineSnapshot(): OnlineGameSnapshot;
}

export type CharacterSelection = Readonly<{
  characterId: CharacterId;
  rosterIndex: number;
}>;

export interface GameAppCharacterizationKernelOptions {
  readonly game: HeadlessGameAppPort;
  readonly seats: Readonly<Record<1 | 2, CharacterSelection>>;
}

/**
 * Transitional characterization adapter. It proves protocol/engine parity but
 * is not the final deep kernel: GameApp still contains browser presentation.
 */
export class GameAppCharacterizationKernel
implements AuthoritativeSimulationKernel<OnlineGameSnapshot> {
  private readonly game: HeadlessGameAppPort;
  private latest: OnlineGameSnapshot;

  constructor(options: GameAppCharacterizationKernelOptions) {
    this.game = options.game;
    const characterSelections: Record<PlayerId, number> = {
      1: options.seats[1].rosterIndex,
      2: options.seats[2].rosterIndex,
      3: 0,
      4: 0,
    };
    this.game.startServerAuthoritativeMatch([1, 2], characterSelections, {
      roomMode: "classic",
      botPlayerIds: [],
      playerLabels: { 1: "P1", 2: "P2", 3: "", 4: "" },
      hideNativeHud: true,
    });
    this.latest = this.game.exportOnlineSnapshot();
    assertDuelSnapshot(this.latest);
  }

  get ended(): boolean {
    return this.latest.matchWinner !== null && this.latest.mode === "match-result";
  }

  applyInput(seat: PlayerId, input: KernelInput): void {
    this.game.replaceServerPlayerInput(seat, { ...input });
  }

  clearInput(seat: PlayerId): void {
    this.game.clearServerPlayerInput(seat);
  }

  step(fixedDeltaMs: number): void {
    this.game.advanceServerSimulation(fixedDeltaMs);
    this.latest = this.game.exportOnlineSnapshot();
    assertDuelSnapshot(this.latest);
  }

  capture(): OnlineGameSnapshot {
    // GameApp export already clones mutable engine state. Keeping the assertion
    // here catches any accidental bot/four-seat regression at frame boundaries.
    const snapshot = this.game.exportOnlineSnapshot();
    assertDuelSnapshot(snapshot);
    return snapshot;
  }
}

function assertDuelSnapshot(snapshot: OnlineGameSnapshot): void {
  if (
    snapshot.roomMode !== "classic"
    || snapshot.activePlayerIds.length !== 2
    || snapshot.activePlayerIds[0] !== 1
    || snapshot.activePlayerIds[1] !== 2
    || snapshot.botPlayerIds.length !== 0
  ) {
    throw new Error("authoritative_duel_contract_violated");
  }
}
