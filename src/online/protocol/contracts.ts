import type { CharacterId } from "../../../Champions/membership";
import type { Direction, PlayerId } from "../../original-game/Gameplay/types";

export const ONLINE_PROTOCOL_VERSION = 1 as const;
export const ONLINE_MODE_ID = "duel-1v1-v1" as const;

export type OnlineProtocolVersion = typeof ONLINE_PROTOCOL_VERSION;
export type OnlineModeId = typeof ONLINE_MODE_ID;

/**
 * An authenticated socket owns the seat. The command intentionally contains
 * no player/seat identifier so a client cannot address another competitor.
 */
export interface PlayerCommand {
  seq: number;
  clientTick: number;
  lastServerTick: number;
  direction: Direction | null;
  bombPressed: boolean;
  detonatePressed: boolean;
  skillPressed: boolean;
  skillHeld: boolean;
}

export interface MatchPeer {
  readonly sessionId: string;
  readonly seat: PlayerId;
  readonly characterId: CharacterId;
}

export type CommandRejectionCode =
  | "invalid-command"
  | "match-ended"
  | "peer-not-seated"
  | "peer-disconnected"
  | "sequence-replayed"
  | "sequence-too-far-ahead"
  | "client-tick-too-far-ahead"
  | "server-tick-too-old"
  | "rate-limited";

export type CommandAcceptance =
  | Readonly<{ ok: true; acceptedSeq: number }>
  | Readonly<{ ok: false; code: CommandRejectionCode }>;

export interface MatchAdvanceResult {
  readonly ticksAdvanced: number;
  readonly serverTick: number;
  readonly backlogMs: number;
  readonly overloaded: boolean;
}

export interface PeerFrameBaseline {
  readonly lastFrameId: number;
  readonly forceKeyframe: boolean;
}

export interface AuthoritativeMatch {
  readonly matchId: string;
  readonly serverTick: number;
  readonly ended: boolean;
  accept(peer: MatchPeer, command: PlayerCommand): CommandAcceptance;
  advance(elapsedMs: number): MatchAdvanceResult;
  readFrame(peer: MatchPeer, baseline: PeerFrameBaseline): Uint8Array | null;
  disconnect(peer: MatchPeer): void;
}
