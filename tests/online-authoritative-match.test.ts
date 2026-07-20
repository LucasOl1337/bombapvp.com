import { describe, expect, it } from "vitest";
import { CHAMPION_MEMBERSHIP } from "../Champions/membership.ts";
import type { MatchPeer, PlayerCommand } from "../src/online/protocol/contracts.ts";
import { decodeServerFrameEnvelope } from "../src/online/protocol/frame-envelope.ts";
import { AuthoritativeMatchRuntime } from "../src/online/runtime/authoritative-match.ts";
import type {
  AuthoritativeSimulationKernel,
  KernelInput,
  MatchStateCodec,
} from "../src/online/runtime/simulation-kernel.ts";
import type { PlayerId } from "../src/original-game/Gameplay/types.ts";

type FakeState = Readonly<{ tick: number; inputs: Readonly<Record<number, KernelInput | null>> }>;

class FakeKernel implements AuthoritativeSimulationKernel<FakeState> {
  public ended = false;
  public tick = 0;
  public readonly inputs: Record<number, KernelInput | null> = { 1: null, 2: null };
  public readonly cleared: PlayerId[] = [];

  constructor(private readonly endAtTick: number | null = null) {}

  applyInput(seat: PlayerId, input: KernelInput): void {
    this.inputs[seat] = { ...input };
  }

  clearInput(seat: PlayerId): void {
    this.inputs[seat] = null;
    this.cleared.push(seat);
  }

  step(): void {
    this.tick += 1;
    if (this.tick === this.endAtTick) this.ended = true;
  }

  capture(): FakeState {
    return {
      tick: this.tick,
      inputs: Object.freeze({
        1: this.inputs[1] ? { ...this.inputs[1] } : null,
        2: this.inputs[2] ? { ...this.inputs[2] } : null,
      }),
    };
  }
}

const encoder = new TextEncoder();
const codec: MatchStateCodec<FakeState> = {
  encodeKeyframe: (state) => encoder.encode(JSON.stringify(state)),
  encodeDelta: (baseline, current) => encoder.encode(JSON.stringify({
    ticks: current.tick - baseline.tick,
    inputs: current.inputs,
  })),
};

const PEERS = [
  {
    sessionId: "session-a",
    seat: 1,
    characterId: CHAMPION_MEMBERSHIP.ranni.characterId,
  },
  {
    sessionId: "session-b",
    seat: 2,
    characterId: CHAMPION_MEMBERSHIP["killer-bee"].characterId,
  },
] as const satisfies readonly MatchPeer[];

function command(overrides: Partial<PlayerCommand> = {}): PlayerCommand {
  return {
    seq: 1,
    clientTick: 0,
    lastServerTick: 0,
    direction: "left",
    bombPressed: false,
    detonatePressed: false,
    skillPressed: false,
    skillHeld: false,
    ...overrides,
  };
}

function createRuntime(options: Readonly<{
  inputBurst?: number;
  frameHistory?: number;
  inputStaleAfterMs?: number;
  endAtTick?: number;
}> = {}) {
  const kernel = new FakeKernel(options.endAtTick ?? null);
  const runtime = new AuthoritativeMatchRuntime({
    matchId: "match-1",
    peers: PEERS,
    kernel,
    codec,
    ...(options.inputBurst === undefined ? {} : { inputBurst: options.inputBurst }),
    ...(options.frameHistory === undefined ? {} : { frameHistory: options.frameHistory }),
    ...(options.inputStaleAfterMs === undefined ? {} : { inputStaleAfterMs: options.inputStaleAfterMs }),
  });
  return { kernel, runtime };
}

describe("provider-neutral authoritative match", () => {
  it("binds commands to the canonical session seat and rejects forged peers", () => {
    const { kernel, runtime } = createRuntime();

    expect(runtime.accept(PEERS[0], command())).toEqual({ ok: true, acceptedSeq: 1 });
    expect(kernel.inputs[1]).toMatchObject({ direction: "left" });
    expect(kernel.inputs[2]).toBeNull();

    expect(runtime.accept({ ...PEERS[0], seat: 2 }, command({ seq: 2 })))
      .toEqual({ ok: false, code: "peer-not-seated" });
    expect(runtime.accept({ ...PEERS[0], characterId: PEERS[1].characterId }, command({ seq: 2 })))
      .toEqual({ ok: false, code: "peer-not-seated" });
  });

  it("rejects replay, implausible jumps, stale views and malformed commands", () => {
    const { runtime } = createRuntime();
    expect(runtime.accept(PEERS[0], command())).toEqual({ ok: true, acceptedSeq: 1 });
    expect(runtime.accept(PEERS[0], command())).toEqual({ ok: false, code: "sequence-replayed" });
    expect(runtime.accept(PEERS[0], command({ seq: 122 })))
      .toEqual({ ok: false, code: "sequence-too-far-ahead" });
    expect(runtime.accept(PEERS[1], command({ clientTick: 181 })))
      .toEqual({ ok: false, code: "client-tick-too-far-ahead" });
    expect(runtime.accept(PEERS[1], command({ seq: 0 })))
      .toEqual({ ok: false, code: "invalid-command" });

    for (let index = 0; index < 101; index += 1) runtime.advance(100);
    expect(runtime.accept(PEERS[1], command({ clientTick: runtime.serverTick, lastServerTick: 0 })))
      .toEqual({ ok: false, code: "server-tick-too-old" });
  });

  it("enforces a bounded token bucket before touching the kernel", () => {
    const { kernel, runtime } = createRuntime({ inputBurst: 2 });

    expect(runtime.accept(PEERS[0], command({ seq: 1 })).ok).toBe(true);
    expect(runtime.accept(PEERS[0], command({ seq: 2 })).ok).toBe(true);
    expect(runtime.accept(PEERS[0], command({ seq: 3 })))
      .toEqual({ ok: false, code: "rate-limited" });
    expect(kernel.inputs[1]).toMatchObject({ direction: "left" });

    runtime.advance(1_000);
    expect(runtime.accept(PEERS[0], command({ seq: 3, clientTick: 60, lastServerTick: 60 })).ok)
      .toBe(true);
  });

  it("steps at 60 Hz, captures at 20 Hz and sends delta against an acknowledged baseline", () => {
    const { kernel, runtime } = createRuntime();
    const initialPacket = runtime.readFrame(PEERS[0], { lastFrameId: 0, forceKeyframe: false });
    expect(initialPacket).not.toBeNull();
    const initial = decodeServerFrameEnvelope(initialPacket!);
    expect(initial.ok && initial.frame.kind).toBe("keyframe");
    expect(initial.ok && initial.frame.frameId).toBe(1);

    const result = runtime.advance(50);
    expect(result.ticksAdvanced).toBe(3);
    expect(kernel.tick).toBe(3);

    const deltaPacket = runtime.readFrame(PEERS[0], { lastFrameId: 1, forceKeyframe: false });
    const delta = decodeServerFrameEnvelope(deltaPacket!);
    expect(delta.ok && delta.frame).toMatchObject({
      kind: "delta",
      serverTick: 3,
      frameId: 2,
      baselineFrameId: 1,
      ackInputSeq: 0,
    });
    expect(runtime.readFrame(PEERS[0], { lastFrameId: 2, forceKeyframe: false })).toBeNull();
  });

  it("falls back to a keyframe when the requested baseline left the ring", () => {
    const { runtime } = createRuntime({ frameHistory: 2 });
    runtime.advance(150);

    const packet = runtime.readFrame(PEERS[0], { lastFrameId: 1, forceKeyframe: false });
    const decoded = decodeServerFrameEnvelope(packet!);
    expect(decoded.ok && decoded.frame.kind).toBe("keyframe");
    expect(decoded.ok && decoded.frame.baselineFrameId).toBe(0);
  });

  it("captures the terminal state immediately when the match ends between 20 Hz frame ticks", () => {
    const { runtime } = createRuntime({ endAtTick: 1 });
    const initialPacket = runtime.readFrame(PEERS[0], { lastFrameId: 0, forceKeyframe: false });
    const initial = decodeServerFrameEnvelope(initialPacket!);
    expect(initial.ok && initial.frame.frameId).toBe(1);

    runtime.advance(17);

    const terminalPacket = runtime.readFrame(PEERS[0], { lastFrameId: 1, forceKeyframe: false });
    const terminal = decodeServerFrameEnvelope(terminalPacket!);
    expect(terminal.ok && terminal.frame).toMatchObject({ serverTick: 1, frameId: 2 });
    if (!terminal.ok) return;
    expect(JSON.parse(new TextDecoder().decode(terminal.frame.payload))).toMatchObject({ ticks: 1 });

    runtime.advance(50);
    expect(runtime.readFrame(PEERS[0], { lastFrameId: 2, forceKeyframe: false })).toBeNull();
  });

  it("neutralizes a held input when the 30 Hz command heartbeat goes stale", () => {
    const { kernel, runtime } = createRuntime({ inputStaleAfterMs: 250 });
    expect(runtime.accept(PEERS[0], command({ direction: "right", skillHeld: true })).ok).toBe(true);

    runtime.advance(249);
    expect(kernel.inputs[1]).toMatchObject({ direction: "right", skillHeld: true });
    runtime.advance(1);
    expect(kernel.inputs[1]).toBeNull();
    expect(kernel.cleared).toEqual([1]);

    expect(runtime.accept(PEERS[0], command({ seq: 2, direction: "left", skillHeld: false })).ok)
      .toBe(true);
    expect(kernel.inputs[1]).toMatchObject({ direction: "left", skillHeld: false });
  });

  it("neutralizes input on disconnect and requires explicit logical reconnection", () => {
    const { kernel, runtime } = createRuntime();
    expect(runtime.accept(PEERS[1], command()).ok).toBe(true);

    runtime.disconnect(PEERS[1]);
    expect(kernel.cleared).toEqual([2]);
    expect(runtime.accept(PEERS[1], command({ seq: 2 })))
      .toEqual({ ok: false, code: "peer-disconnected" });
    expect(runtime.reconnect(PEERS[1])).toBe(true);
    expect(runtime.accept(PEERS[1], command({ seq: 2 })).ok).toBe(true);
  });
});
