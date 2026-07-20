// @vitest-environment node

import { describe, expect, it } from "vitest";
import { CHAMPION_MEMBERSHIP } from "../Champions/membership.ts";
import { createDefaultArenaDefinition } from "../src/original-game/Arenas/arena.ts";
import { GameApp } from "../src/original-game/Engine/game-app.ts";
import { decodeServerFrameEnvelope } from "../src/online/protocol/frame-envelope.ts";
import { OnlineSnapshotCodec } from "../src/online/protocol/snapshot-codec.ts";
import { GameAppCharacterizationKernel } from "../src/online/game/game-app-characterization-kernel.ts";
import { AuthoritativeMatchRuntime } from "../src/online/runtime/authoritative-match.ts";

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
      { id: CHAMPION_MEMBERSHIP.ranni.characterId, name: "Ranni", size: null, selectionIndex: 0 },
      { id: CHAMPION_MEMBERSHIP["killer-bee"].characterId, name: "Killer Bee", size: null, selectionIndex: 1 },
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

const peers = [
  { sessionId: "ranni-session", seat: 1, characterId: CHAMPION_MEMBERSHIP.ranni.characterId },
  { sessionId: "bee-session", seat: 2, characterId: CHAMPION_MEMBERSHIP["killer-bee"].characterId },
];

describe("GameApp authoritative characterization adapter", () => {
  it("drives a two-human match through commands and decodes its bounded frame stream", () => {
    const game = new GameApp({}, assets(), createDefaultArenaDefinition());
    const kernel = new GameAppCharacterizationKernel({
      game,
      seats: {
        1: { characterId: peers[0].characterId, rosterIndex: 0 },
        2: { characterId: peers[1].characterId, rosterIndex: 1 },
      },
    });
    const codec = new OnlineSnapshotCodec();
    const runtime = new AuthoritativeMatchRuntime({
      matchId: "integrated-duel",
      peers,
      kernel,
      codec,
    });

    const firstPacket = runtime.readFrame(peers[0], { lastFrameId: 0, forceKeyframe: true });
    const firstEnvelope = decodeServerFrameEnvelope(firstPacket);
    expect(firstEnvelope.ok).toBe(true);
    if (!firstEnvelope.ok) return;
    const firstState = codec.decodeKeyframe(firstEnvelope.frame.payload);
    expect(firstState.ok).toBe(true);
    if (!firstState.ok) return;
    expect(firstState.snapshot.activePlayerIds).toEqual([1, 2]);
    expect(firstState.snapshot.botPlayerIds).toEqual([]);
    const beforeX = firstState.snapshot.players[2].position.x;

    expect(runtime.accept(peers[1], {
      seq: 1,
      clientTick: 0,
      lastServerTick: 0,
      direction: "left",
      bombPressed: false,
      detonatePressed: false,
      skillPressed: false,
      skillHeld: false,
    })).toEqual({ ok: true, acceptedSeq: 1 });
    runtime.advance(50);

    const deltaPacket = runtime.readFrame(peers[1], {
      lastFrameId: firstEnvelope.frame.frameId,
      forceKeyframe: false,
    });
    const deltaEnvelope = decodeServerFrameEnvelope(deltaPacket);
    expect(deltaEnvelope.ok).toBe(true);
    if (!deltaEnvelope.ok) return;
    expect(deltaEnvelope.frame.ackInputSeq).toBe(1);
    const nextState = codec.applyDelta(firstState.snapshot, deltaEnvelope.frame.payload);
    expect(nextState.ok).toBe(true);
    if (!nextState.ok) return;
    expect(nextState.snapshot.players[2].position.x).toBeLessThan(beforeX);
    expect(nextState.snapshot.botPlayerIds).toEqual([]);
  });

  it("keeps the static arena cache across steady-state frames and invalidates it only for terrain changes", () => {
    const authoritative = new GameApp({}, assets(), createDefaultArenaDefinition());
    const kernel = new GameAppCharacterizationKernel({
      game: authoritative,
      seats: {
        1: { characterId: peers[0].characterId, rosterIndex: 0 },
        2: { characterId: peers[1].characterId, rosterIndex: 1 },
      },
    });
    const replica = new GameApp({}, assets(), createDefaultArenaDefinition());
    const initial = kernel.capture();
    replica.applyOnlineSnapshot(initial);
    replica.arenaStaticDirty = false;

    const steadyState = structuredClone(initial);
    steadyState.frameId += 1;
    steadyState.serverTick += 3;
    steadyState.players[1].position.x += 4;
    replica.applyOnlineFrame(steadyState);

    expect(replica.arenaStaticDirty).toBe(false);
    expect(replica.exportOnlineSnapshot().players[1].position.x)
      .toBe(steadyState.players[1].position.x);

    const removedCrate = steadyState.breakableTiles[0];
    expect(removedCrate).toBeTypeOf("string");
    const terrainChange = structuredClone(steadyState);
    terrainChange.frameId += 1;
    terrainChange.serverTick += 3;
    terrainChange.breakableTiles = terrainChange.breakableTiles.slice(1);
    replica.applyOnlineFrame(terrainChange);

    expect(replica.arenaStaticDirty).toBe(true);
    expect(replica.exportOnlineSnapshot().breakableTiles).not.toContain(removedCrate);
  });
});
