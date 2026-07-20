import { performance } from "node:perf_hooks";
import { createDefaultArenaDefinition } from "../../../src/original-game/Arenas/arena.ts";
import { GameApp } from "../../../src/original-game/Engine/game-app.ts";
import { FIXED_STEP_MS } from "../../../src/original-game/PersonalConfig/config.ts";

const emptyFrames = () => ({ up: [], down: [], left: [], right: [] });
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

const assets = {
  players: { 1: sprites, 2: sprites, 3: sprites, 4: sprites },
  characterRoster: [
    { id: "metrics-character", name: "Metrics", size: null, selectionIndex: 0 },
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

const game = new GameApp(
  {} as HTMLElement,
  assets,
  createDefaultArenaDefinition(),
);

game.startServerAuthoritativeMatch(
  [1, 2, 3, 4],
  { 1: 0, 2: 0, 3: 0, 4: 0 },
  {
    roomMode: "endless",
    botPlayerIds: [1, 2, 3, 4],
  },
);

const snapshotBytes: number[] = [];
const simulationStartedAt = performance.now();
const simulationTicks = 600;

for (let tick = 0; tick < simulationTicks; tick += 1) {
  game.advanceServerSimulation(FIXED_STEP_MS);
  if (tick % 3 !== 0) continue;
  const snapshot = game.exportOnlineSnapshot();
  const message = JSON.stringify({ type: "host-snapshot", snapshot });
  snapshotBytes.push(Buffer.byteLength(message, "utf8"));
}

const simulationElapsedMs = performance.now() - simulationStartedAt;
const sum = snapshotBytes.reduce((total, bytes) => total + bytes, 0);
const averageSnapshotBytes = sum / snapshotBytes.length;
const snapshotsPerSecond = 20;
const bytesPerSecondPerPlayer = averageSnapshotBytes * snapshotsPerSecond;
const bytesPerHourPerPlayer = bytesPerSecondPerPlayer * 60 * 60;
const mib = 1024 * 1024;

const inputMessage = JSON.stringify({
  type: "guest-input",
  inputSeq: 12_345,
  sentAtMs: Date.now(),
  input: {
    direction: "right",
    bombPressed: false,
    detonatePressed: false,
    skillPressed: false,
    skillHeld: false,
  },
});
const inputBytes = Buffer.byteLength(inputMessage, "utf8");

console.log(JSON.stringify({
  note: "Baseline do protocolo JSON full-snapshot preservado em _work; não é orçamento aprovado.",
  samples: snapshotBytes.length,
  snapshotBytes: {
    min: Math.min(...snapshotBytes),
    average: Math.round(averageSnapshotBytes),
    max: Math.max(...snapshotBytes),
  },
  outboundAt20HzPerPlayer: {
    kibPerSecond: Number((bytesPerSecondPerPlayer / 1024).toFixed(2)),
    mibPerHour: Number((bytesPerHourPerPlayer / mib).toFixed(2)),
  },
  inputMessageBytes: inputBytes,
  upstreamAt60HzPerPlayer: {
    kibPerSecond: Number(((inputBytes * 60) / 1024).toFixed(2)),
    mibPerHour: Number(((inputBytes * 60 * 60 * 60) / mib).toFixed(2)),
  },
  nodeSimulationBaseline: {
    fixedTicks: simulationTicks,
    elapsedMs: Number(simulationElapsedMs.toFixed(2)),
    averageCpuMsPerFixedTick: Number((simulationElapsedMs / simulationTicks).toFixed(4)),
  },
}, null, 2));
