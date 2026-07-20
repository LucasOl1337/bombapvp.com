// @vitest-environment node

import { describe, expect, it } from "vitest";
import { createDefaultArenaDefinition } from "../src/original-game/Arenas/arena.ts";
import { GameApp } from "../src/original-game/Engine/game-app.ts";
import { FIXED_STEP_MS } from "../src/original-game/PersonalConfig/config.ts";
import {
  MAX_DELTA_PAYLOAD_BYTES,
  MAX_KEYFRAME_PAYLOAD_BYTES,
} from "../src/online/protocol/frame-envelope.ts";
import { OnlineSnapshotCodec } from "../src/online/protocol/snapshot-codec.ts";

function emptyFrames() {
  return { up: [], down: [], left: [], right: [] };
}

function assets() {
  const sprites = {
    up: null,
    down: null,
    left: null,
    right: null,
    idle: emptyFrames(),
    walk: emptyFrames(),
    run: emptyFrames(),
    cast: emptyFrames(),
    attack: emptyFrames(),
    death: emptyFrames(),
  };
  return {
    players: { 1: sprites, 2: sprites, 3: sprites, 4: sprites },
    characterRoster: [
      { id: "codec-character", name: "Codec", size: null, selectionIndex: 0 },
    ],
    characterSpriteLoader: async () => sprites,
    arenaTheme: {},
    floor: { base: null, lane: null, spawn: null },
    props: { wall: null, crate: null, bomb: null, flame: null, crateBreakFrames: [] },
    effects: { speedSparkTrail: null },
    ui: { victoryEmblem: null, stalemateEmblem: null },
    hud: {
      panelLocal: null,
      panelRival: null,
      panelCenter: null,
      chipUlt: null,
      iconBomb: null,
      iconFlame: null,
      iconSpeed: null,
    },
    powerUps: {},
  };
}

function game() {
  const match = new GameApp({}, assets(), createDefaultArenaDefinition());
  match.startServerAuthoritativeMatch(
    [1, 2],
    { 1: 0, 2: 0, 3: 0, 4: 0 },
    { roomMode: "classic", botPlayerIds: [] },
  );
  return match;
}

function jsonCanonical(value) {
  return JSON.parse(JSON.stringify(value, (_key, child) => (
    typeof child === "number" && !Number.isInteger(child)
      ? Math.round(child * 1_000) / 1_000
      : child
  )));
}

describe("bounded online snapshot codec", () => {
  it("round-trips keyframes and deltas from the real authoritative engine", () => {
    const match = game();
    const codec = new OnlineSnapshotCodec();
    const baseline = match.exportOnlineSnapshot();
    const keyframe = codec.encodeKeyframe(baseline);
    const decoded = codec.decodeKeyframe(keyframe);

    expect(keyframe.byteLength).toBeLessThanOrEqual(MAX_KEYFRAME_PAYLOAD_BYTES);
    expect(decoded).toEqual({ ok: true, snapshot: jsonCanonical(baseline) });

    match.replaceServerPlayerInput(1, {
      direction: "right",
      bombPressed: true,
      detonatePressed: false,
      skillPressed: false,
      skillHeld: false,
    });
    match.advanceServerSimulation(50);
    const current = match.exportOnlineSnapshot();
    const delta = codec.encodeDelta(baseline, current);
    const applied = codec.applyDelta(baseline, delta);

    expect(delta.byteLength).toBeLessThanOrEqual(MAX_DELTA_PAYLOAD_BYTES);
    expect(applied).toEqual({ ok: true, snapshot: jsonCanonical(current) });
  });

  it("stays inside the wire budgets across ten simulated seconds", () => {
    const match = game();
    const codec = new OnlineSnapshotCodec();
    let baseline = match.exportOnlineSnapshot();
    let maximumKeyframe = 0;
    let maximumDelta = 0;
    let maximumDeltaPayload = new Uint8Array();

    for (let tick = 1; tick <= 600; tick += 1) {
      match.replaceServerPlayerInput(1, {
        direction: tick % 240 < 120 ? "right" : "left",
        bombPressed: tick % 180 === 1,
        detonatePressed: false,
        skillPressed: tick % 300 === 1,
        skillHeld: false,
      });
      match.replaceServerPlayerInput(2, {
        direction: tick % 200 < 100 ? "left" : "right",
        bombPressed: tick % 210 === 1,
        detonatePressed: false,
        skillPressed: false,
        skillHeld: false,
      });
      match.advanceServerSimulation(FIXED_STEP_MS);
      if (tick % 3 !== 0) continue;
      const current = match.exportOnlineSnapshot();
      maximumKeyframe = Math.max(maximumKeyframe, codec.encodeKeyframe(current).byteLength);
      const delta = codec.encodeDelta(baseline, current);
      if (delta.byteLength > maximumDelta) {
        maximumDelta = delta.byteLength;
        maximumDeltaPayload = delta;
      }
      baseline = current;
    }

    if (process.env.ONLINE_CODEC_DIAG === "1") {
      console.log(JSON.stringify({
        maximumKeyframe,
        maximumDelta,
        payload: JSON.parse(new TextDecoder().decode(maximumDeltaPayload)),
      }, null, 2));
    }

    expect({ maximumKeyframe, maximumDelta }).toMatchObject({
      maximumKeyframe: expect.any(Number),
      maximumDelta: expect.any(Number),
    });
    expect(maximumKeyframe).toBeLessThanOrEqual(MAX_KEYFRAME_PAYLOAD_BYTES);
    expect(maximumDelta).toBeLessThanOrEqual(MAX_DELTA_PAYLOAD_BYTES);
  }, 30_000);

  it("rejects malformed keyframes and root-deleting patches", () => {
    const codec = new OnlineSnapshotCodec();
    expect(codec.decodeKeyframe(new TextEncoder().encode("{"))).toEqual({
      ok: false,
      code: "invalid-json",
    });
    expect(codec.applyDelta(game().exportOnlineSnapshot(), new TextEncoder().encode('{"~delete":1}')))
      .toEqual({ ok: false, code: "invalid-patch" });
  });
});
