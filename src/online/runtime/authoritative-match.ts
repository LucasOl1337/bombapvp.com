import type { PlayerId } from "../../original-game/Gameplay/types";
import {
  type AuthoritativeMatch,
  type CommandAcceptance,
  type MatchAdvanceResult,
  type MatchPeer,
  type PeerFrameBaseline,
  type PlayerCommand,
} from "../protocol/contracts";
import {
  encodeServerFrameEnvelope,
  MAX_DELTA_PAYLOAD_BYTES,
  MAX_KEYFRAME_PAYLOAD_BYTES,
} from "../protocol/frame-envelope";
import { FixedStepClock } from "./fixed-step-clock";
import type {
  AuthoritativeSimulationKernel,
  KernelInput,
  MatchStateCodec,
} from "./simulation-kernel";

const DEFAULT_TICK_RATE = 60;
const DEFAULT_FRAME_RATE = 20;
const DEFAULT_KEYFRAME_INTERVAL_FRAMES = 40;
const DEFAULT_FRAME_HISTORY = 64;
const DEFAULT_INPUT_RATE_PER_SECOND = 45;
const DEFAULT_INPUT_BURST = 8;
const DEFAULT_INPUT_STALE_AFTER_MS = 250;
const DEFAULT_MAX_SEQUENCE_AHEAD = 120;
const DEFAULT_MAX_CLIENT_TICK_AHEAD = 180;
const DEFAULT_MAX_SERVER_TICK_AGE = 600;

type PeerRuntimeState = {
  readonly peer: MatchPeer;
  connected: boolean;
  lastAcceptedSeq: number;
  tokens: number;
  tokenTimestampMs: number;
  lastAcceptedAtMs: number | null;
  inputActive: boolean;
};

type StoredFrame<State> = Readonly<{
  frameId: number;
  serverTick: number;
  state: State;
}>;

export interface AuthoritativeMatchRuntimeOptions<State> {
  readonly matchId: string;
  readonly peers: readonly MatchPeer[];
  readonly kernel: AuthoritativeSimulationKernel<State>;
  readonly codec: MatchStateCodec<State>;
  readonly tickRate?: number;
  readonly frameRate?: number;
  readonly keyframeIntervalFrames?: number;
  readonly frameHistory?: number;
  readonly inputRatePerSecond?: number;
  readonly inputBurst?: number;
  readonly inputStaleAfterMs?: number;
  readonly maxSequenceAhead?: number;
  readonly maxClientTickAhead?: number;
  readonly maxServerTickAge?: number;
}

/**
 * Owns one isolated authoritative match. It trusts only the canonical peer
 * registered for a session and never accepts a seat identifier from packets.
 */
export class AuthoritativeMatchRuntime<State> implements AuthoritativeMatch {
  public readonly matchId: string;

  private readonly kernel: AuthoritativeSimulationKernel<State>;
  private readonly codec: MatchStateCodec<State>;
  private readonly clock: FixedStepClock;
  private readonly ticksPerFrame: number;
  private readonly keyframeIntervalFrames: number;
  private readonly frameHistory: number;
  private readonly inputRatePerSecond: number;
  private readonly inputBurst: number;
  private readonly inputStaleAfterMs: number;
  private readonly maxSequenceAhead: number;
  private readonly maxClientTickAhead: number;
  private readonly maxServerTickAge: number;
  private readonly peersBySession = new Map<string, PeerRuntimeState>();
  private readonly frames: StoredFrame<State>[] = [];

  private hostElapsedMs = 0;
  private nextFrameId = 1;

  constructor(options: AuthoritativeMatchRuntimeOptions<State>) {
    if (options.matchId.length === 0) throw new RangeError("matchId must not be empty");
    this.matchId = options.matchId;
    this.kernel = options.kernel;
    this.codec = options.codec;

    const tickRate = options.tickRate ?? DEFAULT_TICK_RATE;
    const frameRate = options.frameRate ?? DEFAULT_FRAME_RATE;
    assertPositiveInteger(frameRate, "frameRate");
    if (!Number.isInteger(tickRate / frameRate)) {
      throw new RangeError("tickRate must be an integer multiple of frameRate");
    }
    this.clock = new FixedStepClock({ tickRate });
    this.ticksPerFrame = tickRate / frameRate;
    this.keyframeIntervalFrames = options.keyframeIntervalFrames
      ?? DEFAULT_KEYFRAME_INTERVAL_FRAMES;
    this.frameHistory = options.frameHistory ?? DEFAULT_FRAME_HISTORY;
    this.inputRatePerSecond = options.inputRatePerSecond ?? DEFAULT_INPUT_RATE_PER_SECOND;
    this.inputBurst = options.inputBurst ?? DEFAULT_INPUT_BURST;
    this.inputStaleAfterMs = options.inputStaleAfterMs ?? DEFAULT_INPUT_STALE_AFTER_MS;
    this.maxSequenceAhead = options.maxSequenceAhead ?? DEFAULT_MAX_SEQUENCE_AHEAD;
    this.maxClientTickAhead = options.maxClientTickAhead ?? DEFAULT_MAX_CLIENT_TICK_AHEAD;
    this.maxServerTickAge = options.maxServerTickAge ?? DEFAULT_MAX_SERVER_TICK_AGE;
    for (const [field, value] of [
      ["keyframeIntervalFrames", this.keyframeIntervalFrames],
      ["frameHistory", this.frameHistory],
      ["inputRatePerSecond", this.inputRatePerSecond],
      ["inputBurst", this.inputBurst],
      ["inputStaleAfterMs", this.inputStaleAfterMs],
      ["maxSequenceAhead", this.maxSequenceAhead],
      ["maxClientTickAhead", this.maxClientTickAhead],
      ["maxServerTickAge", this.maxServerTickAge],
    ] as const) {
      assertPositiveInteger(value, field);
    }
    this.registerPeers(options.peers);
    this.captureFrame();
  }

  get serverTick(): number {
    return this.clock.serverTick;
  }

  get ended(): boolean {
    return this.kernel.ended;
  }

  accept(peer: MatchPeer, command: PlayerCommand): CommandAcceptance {
    if (this.kernel.ended) return { ok: false, code: "match-ended" };
    const runtimePeer = this.resolvePeer(peer);
    if (!runtimePeer) return { ok: false, code: "peer-not-seated" };
    if (!runtimePeer.connected) return { ok: false, code: "peer-disconnected" };
    if (!isValidCommand(command)) return { ok: false, code: "invalid-command" };
    if (command.seq <= runtimePeer.lastAcceptedSeq) {
      return { ok: false, code: "sequence-replayed" };
    }
    if (command.seq - runtimePeer.lastAcceptedSeq > this.maxSequenceAhead) {
      return { ok: false, code: "sequence-too-far-ahead" };
    }
    if (command.clientTick > this.serverTick + this.maxClientTickAhead) {
      return { ok: false, code: "client-tick-too-far-ahead" };
    }
    if (command.lastServerTick + this.maxServerTickAge < this.serverTick) {
      return { ok: false, code: "server-tick-too-old" };
    }
    this.refillTokens(runtimePeer);
    if (runtimePeer.tokens < 1) return { ok: false, code: "rate-limited" };

    runtimePeer.tokens -= 1;
    runtimePeer.lastAcceptedSeq = command.seq;
    runtimePeer.lastAcceptedAtMs = this.hostElapsedMs;
    runtimePeer.inputActive = true;
    this.kernel.applyInput(runtimePeer.peer.seat, toKernelInput(command));
    return { ok: true, acceptedSeq: command.seq };
  }

  advance(elapsedMs: number): MatchAdvanceResult {
    this.hostElapsedMs += elapsedMs;
    this.neutralizeStaleInputs();
    return this.clock.advance(elapsedMs, (fixedDeltaMs, serverTick) => {
      if (this.kernel.ended) return;
      this.kernel.step(fixedDeltaMs);
      if (this.kernel.ended || serverTick % this.ticksPerFrame === 0) this.captureFrame();
    });
  }

  readFrame(peer: MatchPeer, baseline: PeerFrameBaseline): Uint8Array | null {
    const runtimePeer = this.resolvePeer(peer);
    if (!runtimePeer || !runtimePeer.connected) return null;
    const latest = this.frames.at(-1);
    if (!latest) return null;
    if (!baseline.forceKeyframe && baseline.lastFrameId >= latest.frameId) return null;

    const scheduledKeyframe = latest.frameId % this.keyframeIntervalFrames === 0;
    const baselineFrame = this.frames.find((frame) => frame.frameId === baseline.lastFrameId);
    if (baseline.forceKeyframe || scheduledKeyframe || !baselineFrame) {
      return this.encodeKeyframe(runtimePeer, latest);
    }

    const delta = this.codec.encodeDelta(baselineFrame.state, latest.state);
    if (delta === null || delta.byteLength > MAX_DELTA_PAYLOAD_BYTES) {
      return this.encodeKeyframe(runtimePeer, latest);
    }
    return encodeServerFrameEnvelope({
      kind: "delta",
      serverTick: latest.serverTick,
      frameId: latest.frameId,
      ackInputSeq: runtimePeer.lastAcceptedSeq,
      baselineFrameId: baselineFrame.frameId,
      payload: delta,
    });
  }

  disconnect(peer: MatchPeer): void {
    const runtimePeer = this.resolvePeer(peer);
    if (!runtimePeer || !runtimePeer.connected) return;
    runtimePeer.connected = false;
    this.neutralizeInput(runtimePeer);
  }

  /** Reattaches only the exact logical session; token rotation belongs to the session host. */
  reconnect(peer: MatchPeer): boolean {
    const runtimePeer = this.resolvePeer(peer);
    if (!runtimePeer) return false;
    runtimePeer.connected = true;
    runtimePeer.tokens = this.inputBurst;
    runtimePeer.tokenTimestampMs = this.hostElapsedMs;
    runtimePeer.lastAcceptedAtMs = null;
    runtimePeer.inputActive = false;
    return true;
  }

  private registerPeers(peers: readonly MatchPeer[]): void {
    if (peers.length !== 2) throw new RangeError("duel-1v1-v1 requires exactly two peers");
    const seats = new Set<PlayerId>();
    for (const peer of peers) {
      if (peer.sessionId.length === 0 || this.peersBySession.has(peer.sessionId)) {
        throw new RangeError("peer session ids must be non-empty and unique");
      }
      if (peer.seat < 1 || peer.seat > 4 || seats.has(peer.seat)) {
        throw new RangeError("peer seats must be unique player ids");
      }
      seats.add(peer.seat);
      this.peersBySession.set(peer.sessionId, {
        peer: Object.freeze({ ...peer }),
        connected: true,
        lastAcceptedSeq: 0,
        tokens: this.inputBurst,
        tokenTimestampMs: 0,
        lastAcceptedAtMs: null,
        inputActive: false,
      });
    }
  }

  private resolvePeer(peer: MatchPeer): PeerRuntimeState | null {
    const canonical = this.peersBySession.get(peer.sessionId);
    if (
      !canonical
      || canonical.peer.seat !== peer.seat
      || canonical.peer.characterId !== peer.characterId
    ) {
      return null;
    }
    return canonical;
  }

  private refillTokens(peer: PeerRuntimeState): void {
    const elapsedMs = Math.max(0, this.hostElapsedMs - peer.tokenTimestampMs);
    peer.tokens = Math.min(
      this.inputBurst,
      peer.tokens + elapsedMs * this.inputRatePerSecond / 1_000,
    );
    peer.tokenTimestampMs = this.hostElapsedMs;
  }

  private neutralizeStaleInputs(): void {
    for (const peer of this.peersBySession.values()) {
      if (
        peer.connected
        && peer.inputActive
        && peer.lastAcceptedAtMs !== null
        && this.hostElapsedMs - peer.lastAcceptedAtMs >= this.inputStaleAfterMs
      ) {
        this.neutralizeInput(peer);
      }
    }
  }

  private neutralizeInput(peer: PeerRuntimeState): void {
    if (!peer.inputActive) return;
    peer.inputActive = false;
    peer.lastAcceptedAtMs = null;
    this.kernel.clearInput(peer.peer.seat);
  }

  private captureFrame(): void {
    this.frames.push({
      frameId: this.nextFrameId,
      serverTick: this.serverTick,
      state: this.kernel.capture(),
    });
    this.nextFrameId += 1;
    while (this.frames.length > this.frameHistory) this.frames.shift();
  }

  private encodeKeyframe(peer: PeerRuntimeState, frame: StoredFrame<State>): Uint8Array {
    const payload = this.codec.encodeKeyframe(frame.state);
    if (payload.byteLength > MAX_KEYFRAME_PAYLOAD_BYTES) {
      throw new RangeError(`keyframe payload exceeds ${MAX_KEYFRAME_PAYLOAD_BYTES} bytes`);
    }
    return encodeServerFrameEnvelope({
      kind: "keyframe",
      serverTick: frame.serverTick,
      frameId: frame.frameId,
      ackInputSeq: peer.lastAcceptedSeq,
      baselineFrameId: 0,
      payload,
    });
  }
}

function toKernelInput(command: PlayerCommand): KernelInput {
  return {
    direction: command.direction,
    bombPressed: command.bombPressed,
    detonatePressed: command.detonatePressed,
    skillPressed: command.skillPressed,
    skillHeld: command.skillHeld,
  };
}

function isValidCommand(command: PlayerCommand): boolean {
  return Number.isInteger(command.seq)
    && command.seq > 0
    && command.seq <= 0xffff_ffff
    && Number.isInteger(command.clientTick)
    && command.clientTick >= 0
    && command.clientTick <= 0xffff_ffff
    && Number.isInteger(command.lastServerTick)
    && command.lastServerTick >= 0
    && command.lastServerTick <= 0xffff_ffff
    && (command.direction === null || ["up", "right", "down", "left"].includes(command.direction))
    && typeof command.bombPressed === "boolean"
    && typeof command.detonatePressed === "boolean"
    && typeof command.skillPressed === "boolean"
    && typeof command.skillHeld === "boolean";
}

function assertPositiveInteger(value: number, field: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new RangeError(`${field} must be a positive integer`);
  }
}
