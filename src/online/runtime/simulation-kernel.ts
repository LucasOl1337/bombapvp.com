import type { PlayerCommand } from "../protocol/contracts";
import type { PlayerId } from "../../original-game/Gameplay/types";

export type KernelInput = Omit<PlayerCommand, "seq" | "clientTick" | "lastServerTick">;

/**
 * Provider-neutral simulation boundary. Implementations contain game rules;
 * hosting, sockets, sessions and frame cadence remain outside the kernel.
 */
export interface AuthoritativeSimulationKernel<State> {
  readonly ended: boolean;
  applyInput(seat: PlayerId, input: KernelInput): void;
  clearInput(seat: PlayerId): void;
  step(fixedDeltaMs: number): void;
  capture(): State;
}

/** Encodes immutable captures without giving the transport access to game rules. */
export interface MatchStateCodec<State> {
  encodeKeyframe(state: State): Uint8Array;
  encodeDelta(baseline: State, current: State): Uint8Array | null;
}
