// @vitest-environment node

import { describe, expect, it } from "vitest";
import { GameApp } from "../src/original-game/Engine/game-app.ts";

const STEP_MS = 1_000 / 60;

function assets() {
  return {
    players: {},
    characterRoster: [
      { id: "03a976fb-7313-4064-a477-5bb9b0760034", name: "Ranni", size: null, selectionIndex: 0 },
    ],
    characterSpriteLoader: async () => null,
    arenaTheme: {},
    floor: { base: null, lane: null, spawn: null },
    props: { wall: null, crate: null, bomb: null, flame: null },
    powerUps: {},
  };
}

function arena(ranniId, ranniY = 2) {
  const planterId = ranniId === 1 ? 2 : 1;
  return {
    id: `ranni-egress-${ranniId}-${ranniY}`,
    name: "Ranni bomb egress",
    status: "active",
    themeId: "default",
    grid: { width: 7, height: 7 },
    tiles: { solid: [], breakable: [] },
    spawns: [
      { playerId: planterId, tile: { x: 3, y: 1 }, direction: "down" },
      { playerId: ranniId, tile: { x: 3, y: ranniY }, direction: "up" },
      { playerId: 3, tile: { x: 1, y: 5 }, direction: "right" },
      { playerId: 4, tile: { x: 5, y: 5 }, direction: "left" },
    ],
    version: "test-v1",
    createdAt: "2026-07-17T00:00:00.000Z",
    updatedAt: "2026-07-17T00:00:00.000Z",
  };
}

function input(direction = null, overrides = {}) {
  return {
    direction,
    bombPressed: false,
    detonatePressed: false,
    skillPressed: false,
    skillHeld: false,
    ...overrides,
  };
}

function game(ranniId, ranniY = 2) {
  const definition = arena(ranniId, ranniY);
  const app = new GameApp({}, assets(), definition);
  app.startServerAuthoritativeMatch(
    [1, 2],
    { 1: 0, 2: 0, 3: 0, 4: 0 },
    { roomMode: "endless", arena: definition },
  );
  app.advanceServerSimulation(1_300);
  return app;
}

function startChannel(app, ranniId, direction = "up") {
  app.replaceServerPlayerInput(ranniId, input(direction, { skillPressed: true }));
  app.advanceServerSimulation(STEP_MS);
  app.replaceServerPlayerInput(ranniId, input(direction));
}

function plant(app, planterId) {
  app.replaceServerPlayerInput(planterId, input(null, { bombPressed: true }));
  app.advanceServerSimulation(STEP_MS);
  app.replaceServerPlayerInput(planterId, input());
}

function verifyEgressForPlayer(ranniId) {
  const planterId = ranniId === 1 ? 2 : 1;
  const app = game(ranniId);
  startChannel(app, ranniId);
  for (let step = 0; step < 4; step += 1) app.advanceServerSimulation(STEP_MS);
  const beforePlant = app.exportOnlineSnapshot().players[ranniId].skill.projectedPosition;

  app.replaceServerPlayerInput(ranniId, input());
  plant(app, planterId);
  const planted = app.exportOnlineSnapshot();
  const bombId = planted.bombs[0].id;

  expect(planted.players[ranniId].skill.projectedBombEgressIds).toEqual([bombId]);
  expect(planted.players[ranniId].skill.projectedPosition.y).toBe(beforePlant.y);

  const aliasedSnapshot = app.exportOnlineSnapshot();
  aliasedSnapshot.players[ranniId].skill.projectedBombEgressIds.push(999);
  expect(app.exportOnlineSnapshot().players[ranniId].skill.projectedBombEgressIds).toEqual([bombId]);

  const ghost = structuredClone(planted.players[ranniId]);
  ghost.position = { ...ghost.skill.projectedPosition };
  const botContext = app.createBotContext();
  const generic = botContext.evaluateMovementOption(ghost, "down", STEP_MS);
  const projected = botContext.evaluateProjectedMovementOption(ghost, "down", STEP_MS);
  expect(botContext.canMovementOptionAdvance(ghost.position, generic)).toBe(false);
  expect(botContext.canMovementOptionAdvance(ghost.position, projected)).toBe(true);

  ghost.skill.phase = "cooldown";
  const forgedCooldown = botContext.evaluateProjectedMovementOption(ghost, "down", STEP_MS);
  expect(botContext.canMovementOptionAdvance(ghost.position, forgedCooldown)).toBe(false);
  ghost.skill.phase = "channeling";
  ghost.skill.id = "killer-bee-wing-dash";
  const forgedOtherSkill = botContext.evaluateProjectedMovementOption(ghost, "down", STEP_MS);
  expect(botContext.canMovementOptionAdvance(ghost.position, forgedOtherSkill)).toBe(false);

  app.replaceServerPlayerInput(ranniId, input("down"));
  for (let step = 0; step < 10; step += 1) app.advanceServerSimulation(STEP_MS);
  const cleared = app.exportOnlineSnapshot();
  expect(cleared.players[ranniId].skill.projectedBombEgressIds).toEqual([]);
  const clearedY = cleared.players[ranniId].skill.projectedPosition.y;

  app.replaceServerPlayerInput(ranniId, input("up"));
  for (let step = 0; step < 10; step += 1) app.advanceServerSimulation(STEP_MS);
  const reversed = app.exportOnlineSnapshot();
  expect(reversed.players[ranniId].skill.projectedPosition.y).toBeLessThan(clearedY);
  expect(reversed.players[ranniId].skill.projectedPosition.y).toBeGreaterThanOrEqual(84);
  expect(reversed.players[ranniId].skill.projectedBombEgressIds).toEqual([]);
}

describe("egress de bomba plantada sobre a projeção da Ranni", () => {
  it("permite sair, serializa o ID e proíbe reentrada para qualquer lado", () => {
    verifyEgressForPlayer(1);
    verifyEgressForPlayer(2);
  });

  it("não concede entrada em uma bomba que já existia antes do channel", () => {
    const app = game(2, 3);
    plant(app, 1);
    startChannel(app, 2);
    for (let step = 0; step < 30; step += 1) app.advanceServerSimulation(STEP_MS);

    const snapshot = app.exportOnlineSnapshot();
    expect(snapshot.players[2].skill.projectedBombEgressIds).toEqual([]);
    expect(snapshot.players[2].skill.projectedPosition.y).toBeGreaterThanOrEqual(84);
  });

  it("não readquire o ID após dar a volta pelo wrap", () => {
    const app = game(2);
    app.players[2].speedLevel = 4;
    startChannel(app, 2);
    for (let step = 0; step < 4; step += 1) app.advanceServerSimulation(STEP_MS);
    app.replaceServerPlayerInput(2, input());
    plant(app, 1);
    app.replaceServerPlayerInput(2, input("down"));
    for (let step = 0; step < 72; step += 1) app.advanceServerSimulation(STEP_MS);

    const snapshot = app.exportOnlineSnapshot();
    expect(snapshot.players[2].skill.phase).toBe("channeling");
    expect(snapshot.players[2].skill.projectedBombEgressIds).toEqual([]);
    expect(snapshot.players[2].skill.projectedPosition.y).toBeLessThanOrEqual(20.1);
  });

  it("mantém corpo e finish na colisão normal, sem usar o entitlement", () => {
    const app = game(2);
    startChannel(app, 2);
    for (let step = 0; step < 4; step += 1) app.advanceServerSimulation(STEP_MS);
    app.replaceServerPlayerInput(2, input());
    plant(app, 1);
    const beforeFinish = app.exportOnlineSnapshot();

    app.replaceServerPlayerInput(2, input(null, { skillPressed: true }));
    app.advanceServerSimulation(STEP_MS);
    const finished = app.exportOnlineSnapshot();

    expect(finished.players[2].position).toEqual(beforeFinish.players[2].position);
    expect(finished.players[2].skill.phase).toBe("cooldown");
    expect(finished.players[2].skill.projectedBombEgressIds).toEqual([]);
  });

  it("não concede entitlement quando uma bomba é chutada sobre o ghost", () => {
    const app = game(2, 3);
    plant(app, 1);
    startChannel(app, 2);
    for (let step = 0; step < 10; step += 1) app.advanceServerSimulation(STEP_MS);

    expect(app.tryPushBombAtTile({ x: 3, y: 1 }, "down", 1)).toBe(true);
    const snapshot = app.exportOnlineSnapshot();
    expect(snapshot.bombs[0].tile).toEqual({ x: 3, y: 2 });
    expect(snapshot.players[2].skill.projectedBombEgressIds).toEqual([]);
  });

  it("revoga o ID se a bomba autorizada é chutada enquanto o ghost está parado", () => {
    const app = game(2);
    startChannel(app, 2);
    for (let step = 0; step < 4; step += 1) app.advanceServerSimulation(STEP_MS);
    app.replaceServerPlayerInput(2, input());
    plant(app, 1);
    expect(app.exportOnlineSnapshot().players[2].skill.projectedBombEgressIds).toHaveLength(1);

    expect(app.tryPushBombAtTile({ x: 3, y: 1 }, "left", 1)).toBe(true);
    app.advanceServerSimulation(STEP_MS);
    const pruned = app.exportOnlineSnapshot();
    expect(pruned.players[2].skill.projectedBombEgressIds).toEqual([]);

    const ghost = structuredClone(pruned.players[2]);
    ghost.position = { ...ghost.skill.projectedPosition };
    ghost.position.y = 99;
    const botContext = app.createBotContext();
    const generic = botContext.evaluateMovementOption(ghost, "left", 100);
    const projected = botContext.evaluateProjectedMovementOption(ghost, "left", 100);
    expect(generic.forwardOnlyFree).toBe(false);
    expect(projected).toEqual(generic);
  });

  it("preserva a geometria cartesiana antiga somente para o corpo", () => {
    const app = game(2);
    const edgePlayer = { position: { x: 220, y: 16 } };
    expect(app.isPlayerOverlappingTile(edgePlayer, { x: 0, y: 0 })).toBe(false);
  });
});
