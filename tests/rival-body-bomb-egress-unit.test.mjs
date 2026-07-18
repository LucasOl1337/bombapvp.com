// @vitest-environment node

import { describe, expect, it } from "vitest";
import { GameApp } from "../src/original-game/Engine/game-app.ts";
import { finishRanniBlink } from "../Champions/ranni/skill.ts";

const STEP_MS = 1_000 / 60;
const DIRECTIONS = ["up", "down", "left", "right"];

function assets() {
  return {
    players: {},
    characterRoster: [
      { id: "03a976fb-7313-4064-a477-5bb9b0760034", name: "Ranni", size: null, selectionIndex: 0 },
      { id: "6ee8baa5-3277-413b-ae0e-2659b9cc52e9", name: "Killer Bee", size: null, selectionIndex: 1 },
    ],
    characterSpriteLoader: async () => null,
    arenaTheme: {},
    floor: { base: null, lane: null, spawn: null },
    props: { wall: null, crate: null, bomb: null, flame: null },
    powerUps: {},
  };
}

function arena() {
  return {
    id: "rival-body-bomb-egress",
    name: "Rival body bomb egress",
    status: "active",
    themeId: "default",
    grid: { width: 7, height: 7 },
    tiles: { solid: [], breakable: [] },
    spawns: [
      { playerId: 1, tile: { x: 1, y: 1 }, direction: "right" },
      { playerId: 2, tile: { x: 2, y: 1 }, direction: "left" },
      { playerId: 3, tile: { x: 1, y: 5 }, direction: "right" },
      { playerId: 4, tile: { x: 5, y: 5 }, direction: "left" },
    ],
    version: "test-v1",
    createdAt: "2026-07-17T00:00:00.000Z",
    updatedAt: "2026-07-17T00:00:00.000Z",
  };
}

function input(overrides = {}) {
  return {
    direction: null,
    bombPressed: false,
    detonatePressed: false,
    skillPressed: false,
    skillHeld: false,
    ...overrides,
  };
}

describe("egress corporal de bomba rival recém-plantada", () => {
  it("permite sair quando o corpo já sobrepunha a célula da bomba", () => {
    const definition = arena();
    const app = new GameApp({}, assets(), definition);
    app.startServerAuthoritativeMatch(
      [1, 2],
      { 1: 0, 2: 1, 3: 0, 4: 0 },
      { roomMode: "endless", arena: definition },
    );
    app.advanceServerSimulation(1_300);
    app.players[1].position = { x: 60, y: 60 };
    app.players[2].position = { x: 81.625, y: 60 };

    app.replaceServerPlayerInput(1, input({ bombPressed: true }));
    app.advanceServerSimulation(STEP_MS);
    app.replaceServerPlayerInput(1, input());

    const snapshot = app.exportOnlineSnapshot();
    const bomb = snapshot.bombs[0];
    const victim = snapshot.players[2];
    expect(bomb.ownerId).toBe(1);
    expect(bomb.tile).toEqual({ x: 1, y: 1 });
    expect(bomb.bodyEgressPlayerIds).toEqual([2]);
    expect(victim.skill.id).toBe("killer-bee-wing-dash");
    expect(victim.tile).toEqual({ x: 2, y: 1 });
    expect(app.isPlayerOverlappingTile(victim, bomb.tile)).toBe(true);

    const context = app.createBotContext();
    const executable = DIRECTIONS.filter((direction) => {
      const option = context.evaluateMovementOption(victim, direction, STEP_MS);
      return context.canMovementOptionAdvance(victim.position, option);
    });
    expect(
      executable.length,
      JSON.stringify({
        victimPosition: victim.position,
        bombTile: bomb.tile,
        executable,
      }),
    ).toBeGreaterThan(0);
  });

  it("concede egress para qualquer sobreposição corporal positiva, inclusive subpixel", () => {
    const definition = arena();
    const app = new GameApp({}, assets(), definition);
    app.startServerAuthoritativeMatch(
      [1, 2],
      { 1: 0, 2: 1, 3: 0, 4: 0 },
      { roomMode: "endless", arena: definition },
    );
    app.advanceServerSimulation(1_300);
    app.players[1].position = { x: 60, y: 60 };
    app.players[2].position = { x: 99.9998, y: 60 };

    const overlapArea = app.getBodyTileOverlapArea(app.players[2].position, { x: 1, y: 1 });
    expect(overlapArea).toBeGreaterThan(0);
    expect(overlapArea).toBeLessThan(0.01);

    app.replaceServerPlayerInput(1, input({ bombPressed: true }));
    app.advanceServerSimulation(STEP_MS);
    app.replaceServerPlayerInput(1, input());

    const snapshot = app.exportOnlineSnapshot();
    expect(snapshot.bombs[0].bodyEgressPlayerIds).toContain(2);
    const context = app.createBotContext();
    const outward = context.evaluateMovementOption(snapshot.players[2], "right", STEP_MS);
    expect(context.canMovementOptionAdvance(snapshot.players[2].position, outward)).toBe(true);
  });

  it("deixa o dash corporal da Killer Bee sair, sem cruzar ou readquirir a bomba", () => {
    const definition = arena();
    const app = new GameApp({}, assets(), definition);
    app.startServerAuthoritativeMatch(
      [1, 2],
      { 1: 0, 2: 1, 3: 0, 4: 0 },
      { roomMode: "endless", arena: definition },
    );
    app.advanceServerSimulation(1_300);
    app.players[1].position = { x: 60, y: 60 };
    app.players[2].position = { x: 81.625, y: 60 };
    app.players[2].direction = "right";
    app.players[2].lastMoveDirection = "right";
    app.replaceServerPlayerInput(1, input({ bombPressed: true }));
    app.advanceServerSimulation(STEP_MS);
    app.replaceServerPlayerInput(1, input());
    app.bombs[0].fuseMs = 60_000;
    const startX = app.players[2].position.x;

    app.replaceServerPlayerInput(2, input({ skillPressed: true }));
    app.advanceServerSimulation(50);
    app.replaceServerPlayerInput(2, input());
    expect(app.players[2].position.x).toBeGreaterThan(startX);

    app.advanceServerSimulation(300);
    let snapshot = app.exportOnlineSnapshot();
    expect(app.isPlayerOverlappingTile(snapshot.players[2], snapshot.bombs[0].tile)).toBe(false);
    expect(snapshot.bombs[0].bodyEgressPlayerIds).not.toContain(2);

    app.players[2].skill.phase = "idle";
    app.players[2].skill.cooldownRemainingMs = 0;
    app.players[2].direction = "left";
    app.players[2].lastMoveDirection = "left";
    app.replaceServerPlayerInput(2, input({ skillPressed: true }));
    app.advanceServerSimulation(300);
    snapshot = app.exportOnlineSnapshot();
    expect(app.isPlayerOverlappingTile(snapshot.players[2], snapshot.bombs[0].tile)).toBe(false);

    const blocked = new GameApp({}, assets(), definition);
    blocked.startServerAuthoritativeMatch(
      [1, 2],
      { 1: 0, 2: 1, 3: 0, 4: 0 },
      { roomMode: "endless", arena: definition },
    );
    blocked.advanceServerSimulation(1_300);
    blocked.players[1].position = { x: 60, y: 60 };
    blocked.players[2].position = { x: 81.625, y: 60 };
    blocked.players[2].direction = "left";
    blocked.players[2].lastMoveDirection = "left";
    blocked.replaceServerPlayerInput(1, input({ bombPressed: true }));
    blocked.advanceServerSimulation(STEP_MS);
    blocked.replaceServerPlayerInput(1, input());
    const blockedStart = { ...blocked.players[2].position };
    blocked.replaceServerPlayerInput(2, input({ skillPressed: true }));
    blocked.advanceServerSimulation(50);
    expect(blocked.players[2].position).toEqual(blockedStart);
  });

  it("revoga o grant no mesmo instante autoritativo da eliminação", () => {
    const definition = arena();
    const app = new GameApp({}, assets(), definition);
    app.startServerAuthoritativeMatch(
      [1, 2, 3],
      { 1: 0, 2: 1, 3: 0, 4: 0 },
      { roomMode: "endless", arena: definition },
    );
    app.advanceServerSimulation(1_300);
    app.players[1].position = { x: 60, y: 60 };
    app.players[2].position = { x: 81.625, y: 60 };
    app.replaceServerPlayerInput(1, input({ bombPressed: true }));
    app.advanceServerSimulation(STEP_MS);
    expect(app.exportOnlineSnapshot().bombs[0].bodyEgressPlayerIds).toContain(2);

    app.eliminateServerPlayer(2);

    const snapshot = app.exportOnlineSnapshot();
    expect(snapshot.players[2].alive).toBe(false);
    expect(snapshot.bombs[0].bodyEgressPlayerIds).not.toContain(2);
  });

  it("permite reduzir a sobreposição, mas não aprofundar na célula rival", () => {
    const definition = arena();
    const app = new GameApp({}, assets(), definition);
    app.startServerAuthoritativeMatch(
      [1, 2],
      { 1: 0, 2: 0, 3: 0, 4: 0 },
      { roomMode: "endless", arena: definition },
    );
    app.advanceServerSimulation(1_300);
    app.players[1].position = { x: 60, y: 60 };
    app.players[2].position = { x: 81.625, y: 60 };
    app.replaceServerPlayerInput(1, input({ bombPressed: true }));
    app.advanceServerSimulation(STEP_MS);

    const victim = app.exportOnlineSnapshot().players[2];
    const context = app.createBotContext();
    const outward = context.evaluateMovementOption(victim, "right", STEP_MS);
    const inward = context.evaluateMovementOption(victim, "left", STEP_MS);
    expect(context.canMovementOptionAdvance(victim.position, outward)).toBe(true);
    expect(context.canMovementOptionAdvance(victim.position, inward)).toBe(false);
  });

  it("bloqueia área igual e travessia pelo centro mesmo com área final menor", () => {
    const definition = arena();
    const app = new GameApp({}, assets(), definition);
    app.startServerAuthoritativeMatch(
      [1, 2],
      { 1: 0, 2: 0, 3: 0, 4: 0 },
      { roomMode: "endless", arena: definition },
    );
    app.advanceServerSimulation(1_300);
    app.players[1].position = { x: 60, y: 60 };
    app.players[2].position = { x: 81.625, y: 60 };
    app.replaceServerPlayerInput(1, input({ bombPressed: true }));
    app.advanceServerSimulation(STEP_MS);

    const victim = app.exportOnlineSnapshot().players[2];
    expect(app.canOccupyPosition(victim, { ...victim.position })).toBe(false);
    const context = app.createBotContext();
    const throughCenter = context.evaluateMovementOption(victim, "left", 500);
    expect(throughCenter.forwardOnlyMove.x).toBeLessThan(60);
    expect(
      context.canMovementOptionAdvance(victim.position, throughCenter),
      JSON.stringify(throughCenter),
    ).toBe(false);
  });

  it("bloqueia crossing subpixel, mas deixa o centro exato escolher uma saída", () => {
    const definition = arena();
    const app = new GameApp({}, assets(), definition);
    app.startServerAuthoritativeMatch(
      [1, 2],
      { 1: 0, 2: 0, 3: 0, 4: 0 },
      { roomMode: "endless", arena: definition },
    );
    app.advanceServerSimulation(1_300);
    app.players[1].position = { x: 60, y: 60 };
    app.players[2].position = { x: 59.9995, y: 60 };
    app.replaceServerPlayerInput(1, input({ bombPressed: true }));
    app.advanceServerSimulation(STEP_MS);
    app.replaceServerPlayerInput(1, input());
    expect(app.exportOnlineSnapshot().bombs[0].bodyEgressPlayerIds).toContain(2);

    const victim = app.players[2];
    expect(app.canOccupyPosition(victim, { x: 65, y: 60 }, [], true)).toBe(false);

    victim.position = { x: 60, y: 60 };
    expect(app.canOccupyPosition(victim, { x: 55, y: 60 }, [], true)).toBe(true);
    expect(app.canOccupyPosition(victim, { x: 65, y: 60 }, [], true)).toBe(true);

    expect(app.doesWrappedSegmentCrossCoordinate(279.9995, 5, 0, 280)).toBe(true);
    expect(app.doesWrappedSegmentCrossCoordinate(0, 5, 0, 280)).toBe(false);
  });

  it("preserva bomb-pass e ignoredBombIds ao atravessar o centro", () => {
    const definition = arena();
    const app = new GameApp({}, assets(), definition);
    app.startServerAuthoritativeMatch(
      [1, 2],
      { 1: 0, 2: 0, 3: 0, 4: 0 },
      { roomMode: "endless", arena: definition },
    );
    app.advanceServerSimulation(1_300);
    app.players[1].position = { x: 60, y: 60 };
    app.players[2].position = { x: 81.625, y: 60 };
    app.replaceServerPlayerInput(1, input({ bombPressed: true }));
    app.advanceServerSimulation(STEP_MS);

    const snapshot = app.exportOnlineSnapshot();
    const victim = snapshot.players[2];
    const bomb = snapshot.bombs[0];
    const acrossCenter = { x: 38, y: 60 };

    expect(app.canOccupyPosition(victim, acrossCenter)).toBe(false);
    victim.bombPassLevel = 1;
    expect(app.canOccupyPosition(victim, acrossCenter)).toBe(true);
    victim.bombPassLevel = 0;
    expect(app.canOccupyPosition(victim, acrossCenter, [bomb.id])).toBe(true);
  });

  it("sai de uma sobreposição de canto sem deadlock", () => {
    const definition = arena();
    const app = new GameApp({}, assets(), definition);
    app.startServerAuthoritativeMatch(
      [1, 2],
      { 1: 0, 2: 0, 3: 0, 4: 0 },
      { roomMode: "endless", arena: definition },
    );
    app.advanceServerSimulation(1_300);
    app.players[1].position = { x: 60, y: 60 };
    app.players[2].position = { x: 82.5, y: 82.5 };
    app.replaceServerPlayerInput(1, input({ bombPressed: true }));
    app.advanceServerSimulation(STEP_MS);

    const victim = app.exportOnlineSnapshot().players[2];
    const context = app.createBotContext();
    const exits = ["right", "down"].map((direction) => (
      context.evaluateMovementOption(victim, direction, STEP_MS)
    ));
    expect(
      exits.some((option) => context.canMovementOptionAdvance(victim.position, option)),
      JSON.stringify({ victim, bomb: app.exportOnlineSnapshot().bombs[0], exits }),
    ).toBe(true);
  });

  it("não concede entrada a quem estava fora no instante do plantio", () => {
    const definition = arena();
    const app = new GameApp({}, assets(), definition);
    app.startServerAuthoritativeMatch(
      [1, 2],
      { 1: 0, 2: 0, 3: 0, 4: 0 },
      { roomMode: "endless", arena: definition },
    );
    app.advanceServerSimulation(1_300);
    app.players[1].position = { x: 60, y: 60 };
    app.players[2].position = { x: 100, y: 60 };

    app.replaceServerPlayerInput(1, input({ bombPressed: true }));
    app.advanceServerSimulation(STEP_MS);
    app.replaceServerPlayerInput(1, input());

    const snapshot = app.exportOnlineSnapshot();
    expect(snapshot.bombs[0].bodyEgressPlayerIds).toEqual([]);
    const victim = snapshot.players[2];
    const context = app.createBotContext();
    const towardBomb = context.evaluateMovementOption(victim, "left", 100);
    expect(context.canMovementOptionAdvance(victim.position, towardBomb)).toBe(false);
  });

  it("remove a permissão ao limpar a célula e não permite reentrada", () => {
    const definition = arena();
    const app = new GameApp({}, assets(), definition);
    app.startServerAuthoritativeMatch(
      [1, 2],
      { 1: 0, 2: 0, 3: 0, 4: 0 },
      { roomMode: "endless", arena: definition },
    );
    app.advanceServerSimulation(1_300);
    app.players[1].position = { x: 60, y: 60 };
    app.players[2].position = { x: 81.625, y: 60 };

    app.replaceServerPlayerInput(1, input({ bombPressed: true }));
    app.advanceServerSimulation(STEP_MS);
    app.replaceServerPlayerInput(1, input());
    expect(app.exportOnlineSnapshot().bombs[0].bodyEgressPlayerIds).toEqual([2]);

    app.replaceServerPlayerInput(2, input({ direction: "right" }));
    for (let step = 0; step < 20; step += 1) app.advanceServerSimulation(STEP_MS);
    const cleared = app.exportOnlineSnapshot();
    expect(app.isPlayerOverlappingTile(cleared.players[2], cleared.bombs[0].tile)).toBe(false);
    expect(cleared.bombs[0].bodyEgressPlayerIds).toEqual([]);

    app.replaceServerPlayerInput(2, input({ direction: "left" }));
    for (let step = 0; step < 30; step += 1) app.advanceServerSimulation(STEP_MS);
    const reversed = app.exportOnlineSnapshot();
    expect(app.isPlayerOverlappingTile(reversed.players[2], reversed.bombs[0].tile)).toBe(false);
    expect(reversed.bombs[0].bodyEgressPlayerIds).toEqual([]);
  });

  it("exporta a coleção sem alias com o estado autoritativo", () => {
    const definition = arena();
    const app = new GameApp({}, assets(), definition);
    app.startServerAuthoritativeMatch(
      [1, 2],
      { 1: 0, 2: 0, 3: 0, 4: 0 },
      { roomMode: "endless", arena: definition },
    );
    app.advanceServerSimulation(1_300);
    app.players[1].position = { x: 60, y: 60 };
    app.players[2].position = { x: 81.625, y: 60 };
    app.replaceServerPlayerInput(1, input({ bombPressed: true }));
    app.advanceServerSimulation(STEP_MS);

    const exported = app.exportOnlineSnapshot();
    expect(exported.bombs[0].bodyEgressPlayerIds).toEqual([2]);
    exported.bombs[0].bodyEgressPlayerIds.push(4);
    expect(app.exportOnlineSnapshot().bombs[0].bodyEgressPlayerIds).toEqual([2]);
  });

  it("aplica snapshot sem manter alias com o objeto recebido", () => {
    const definition = arena();
    const authoritative = new GameApp({}, assets(), definition);
    authoritative.startServerAuthoritativeMatch(
      [1, 2],
      { 1: 0, 2: 0, 3: 0, 4: 0 },
      { roomMode: "endless", arena: definition },
    );
    authoritative.advanceServerSimulation(1_300);
    authoritative.players[1].position = { x: 60, y: 60 };
    authoritative.players[2].position = { x: 81.625, y: 60 };
    authoritative.replaceServerPlayerInput(1, input({ bombPressed: true }));
    authoritative.advanceServerSimulation(STEP_MS);

    const snapshot = authoritative.exportOnlineSnapshot();
    const replica = new GameApp({}, assets(), definition);
    replica.applyOnlineSnapshot(snapshot);
    snapshot.bombs[0].bodyEgressPlayerIds.push(4);

    expect(replica.exportOnlineSnapshot().bombs[0].bodyEgressPlayerIds).toEqual([2]);
  });

  it("aplica frame incremental sem manter alias com o objeto recebido", () => {
    const definition = arena();
    const authoritative = new GameApp({}, assets(), definition);
    authoritative.startServerAuthoritativeMatch(
      [1, 2],
      { 1: 0, 2: 0, 3: 0, 4: 0 },
      { roomMode: "endless", arena: definition },
    );
    authoritative.advanceServerSimulation(1_300);
    authoritative.players[1].position = { x: 60, y: 60 };
    authoritative.players[2].position = { x: 81.625, y: 60 };
    authoritative.replaceServerPlayerInput(1, input({ bombPressed: true }));
    authoritative.advanceServerSimulation(STEP_MS);

    const frame = authoritative.exportOnlineSnapshot();
    const replica = new GameApp({}, assets(), definition);
    replica.applyOnlineFrame(frame);
    frame.bombs[0].bodyEgressPlayerIds.push(4);

    expect(replica.exportOnlineSnapshot().bombs[0].bodyEgressPlayerIds).toEqual([2]);
  });

  it("concede saída simétrica a dois rivais já sobrepostos", () => {
    const definition = arena();
    const app = new GameApp({}, assets(), definition);
    app.startServerAuthoritativeMatch(
      [1, 2, 3],
      { 1: 0, 2: 0, 3: 0, 4: 0 },
      { roomMode: "endless", arena: definition },
    );
    app.advanceServerSimulation(1_300);
    app.players[1].position = { x: 60, y: 60 };
    app.players[2].position = { x: 81.625, y: 60 };
    app.players[3].position = { x: 60, y: 81.625 };
    app.replaceServerPlayerInput(1, input({ bombPressed: true }));
    app.advanceServerSimulation(STEP_MS);

    const snapshot = app.exportOnlineSnapshot();
    expect(snapshot.bombs[0].bodyEgressPlayerIds).toEqual([2, 3]);
    const context = app.createBotContext();
    const exits = [
      context.evaluateMovementOption(snapshot.players[2], "right", STEP_MS),
      context.evaluateMovementOption(snapshot.players[3], "down", STEP_MS),
    ];
    expect(context.canMovementOptionAdvance(snapshot.players[2].position, exits[0])).toBe(true);
    expect(context.canMovementOptionAdvance(snapshot.players[3].position, exits[1])).toBe(true);
  });

  it("não concede permissão quando uma bomba chutada passa a sobrepor o corpo", () => {
    const definition = arena();
    const app = new GameApp({}, assets(), definition);
    app.startServerAuthoritativeMatch(
      [1, 2],
      { 1: 0, 2: 1, 3: 0, 4: 0 },
      { roomMode: "endless", arena: definition },
    );
    app.advanceServerSimulation(1_300);
    app.players[1].position = { x: 60, y: 60 };
    app.players[2].position = { x: 121.625, y: 60 };
    app.replaceServerPlayerInput(1, input({ bombPressed: true }));
    app.advanceServerSimulation(STEP_MS);
    expect(app.exportOnlineSnapshot().bombs[0].bodyEgressPlayerIds).toEqual([]);

    expect(app.tryPushBombAtTile({ x: 1, y: 1 }, "right", 1)).toBe(true);
    app.advanceServerSimulation(STEP_MS);
    const kicked = app.exportOnlineSnapshot();
    expect(kicked.bombs[0].tile).toEqual({ x: 2, y: 1 });
    expect(kicked.players[2].skill.id).toBe("killer-bee-wing-dash");
    expect(app.isPlayerOverlappingTile(kicked.players[2], kicked.bombs[0].tile)).toBe(true);
    expect(kicked.bombs[0].bodyEgressPlayerIds).toEqual([]);
  });

  it("revoga todos os grants no chute mesmo se o rival ainda sobrepõe a nova célula", () => {
    const definition = arena();
    const app = new GameApp({}, assets(), definition);
    app.startServerAuthoritativeMatch(
      [1, 2],
      { 1: 0, 2: 0, 3: 0, 4: 0 },
      { roomMode: "endless", arena: definition },
    );
    app.advanceServerSimulation(1_300);
    app.players[1].position = { x: 60, y: 60 };
    app.players[2].position = { x: 40, y: 60 };
    app.replaceServerPlayerInput(1, input({ bombPressed: true }));
    app.advanceServerSimulation(STEP_MS);
    expect(app.exportOnlineSnapshot().bombs[0].bodyEgressPlayerIds).toEqual([2]);

    expect(app.tryPushBombAtTile({ x: 1, y: 1 }, "left", 1)).toBe(true);
    const kicked = app.exportOnlineSnapshot();
    expect(kicked.bombs[0].tile).toEqual({ x: 0, y: 1 });
    expect(app.isPlayerOverlappingTile(kicked.players[2], kicked.bombs[0].tile)).toBe(true);
    expect(kicked.bombs[0].bodyEgressPlayerIds).toEqual([]);

    const context = app.createBotContext();
    const outward = context.evaluateMovementOption(kicked.players[2], "right", STEP_MS);
    expect(context.canMovementOptionAdvance(kicked.players[2].position, outward)).toBe(false);
  });

  it("poda com input neutro quando a bomba concedida é chutada e não readquire ao voltar", () => {
    const definition = arena();
    const app = new GameApp({}, assets(), definition);
    app.startServerAuthoritativeMatch(
      [1, 2],
      { 1: 0, 2: 0, 3: 0, 4: 0 },
      { roomMode: "endless", arena: definition },
    );
    app.advanceServerSimulation(1_300);
    app.players[1].position = { x: 60, y: 60 };
    app.players[2].position = { x: 81.625, y: 60 };
    app.replaceServerPlayerInput(1, input({ bombPressed: true }));
    app.advanceServerSimulation(STEP_MS);
    app.replaceServerPlayerInput(1, input());
    expect(app.exportOnlineSnapshot().bombs[0].bodyEgressPlayerIds).toEqual([2]);

    expect(app.tryPushBombAtTile({ x: 1, y: 1 }, "left", 1)).toBe(true);
    app.advanceServerSimulation(STEP_MS);
    expect(app.exportOnlineSnapshot().bombs[0].bodyEgressPlayerIds).toEqual([]);

    app.players[1].position = { x: 60, y: 100 };
    expect(app.tryPushBombAtTile({ x: 0, y: 1 }, "right", 1)).toBe(true);
    app.advanceServerSimulation(STEP_MS);
    const returned = app.exportOnlineSnapshot();
    expect(app.isPlayerOverlappingTile(returned.players[2], returned.bombs[0].tile)).toBe(true);
    expect(returned.bombs[0].bodyEgressPlayerIds).toEqual([]);
  });

  it("não herda a permissão após morte, retorno ou reset de rodada", () => {
    const definition = arena();
    const app = new GameApp({}, assets(), definition);
    app.startServerAuthoritativeMatch(
      [1, 2, 3],
      { 1: 0, 2: 0, 3: 0, 4: 0 },
      { roomMode: "endless", arena: definition },
    );
    app.advanceServerSimulation(1_300);
    app.players[1].position = { x: 60, y: 60 };
    app.players[2].position = { x: 81.625, y: 60 };
    app.replaceServerPlayerInput(1, input({ bombPressed: true }));
    app.advanceServerSimulation(STEP_MS);
    expect(app.exportOnlineSnapshot().bombs[0].bodyEgressPlayerIds).toContain(2);

    app.players[2].alive = false;
    app.advanceServerSimulation(STEP_MS);
    expect(app.exportOnlineSnapshot().bombs[0].bodyEgressPlayerIds).not.toContain(2);

    app.players[2].alive = true;
    app.players[2].position = { x: 81.625, y: 60 };
    app.advanceServerSimulation(STEP_MS);
    expect(app.exportOnlineSnapshot().bombs[0].bodyEgressPlayerIds).not.toContain(2);

    app.resetRound(false);
    expect(app.exportOnlineSnapshot().bombs).toEqual([]);
    app.players[1].position = { x: 60, y: 60 };
    app.players[2].position = { x: 100, y: 60 };
    app.replaceServerPlayerInput(1, input({ bombPressed: true }));
    app.advanceServerSimulation(STEP_MS);
    const replanted = app.exportOnlineSnapshot().bombs[0];
    expect(replanted.id).toBe(1);
    expect(replanted.bodyEgressPlayerIds).toEqual([]);
  });

  it("preserva ownerCanPass e não deixa o dono reentrar após sair", () => {
    const definition = arena();
    const app = new GameApp({}, assets(), definition);
    app.startServerAuthoritativeMatch(
      [1, 2],
      { 1: 0, 2: 0, 3: 0, 4: 0 },
      { roomMode: "endless", arena: definition },
    );
    app.advanceServerSimulation(1_300);
    app.players[1].position = { x: 60, y: 60 };
    app.replaceServerPlayerInput(1, input({ bombPressed: true }));
    app.advanceServerSimulation(STEP_MS);
    app.replaceServerPlayerInput(1, input({ direction: "right" }));
    for (let step = 0; step < 20; step += 1) app.advanceServerSimulation(STEP_MS);

    const cleared = app.exportOnlineSnapshot();
    expect(cleared.bombs[0].ownerCanPass).toBe(false);
    expect(cleared.bombs[0].bodyEgressPlayerIds).not.toContain(1);

    app.replaceServerPlayerInput(1, input({ direction: "left" }));
    for (let step = 0; step < 30; step += 1) app.advanceServerSimulation(STEP_MS);
    const reversed = app.exportOnlineSnapshot();
    expect(app.isPlayerOverlappingTile(reversed.players[1], reversed.bombs[0].tile)).toBe(false);
    expect(reversed.bombs[0].ownerCanPass).toBe(false);
  });

  it("não readquire a permissão ao retornar pela borda com wrap", () => {
    const definition = arena();
    const app = new GameApp({}, assets(), definition);
    app.startServerAuthoritativeMatch(
      [1, 2],
      { 1: 0, 2: 0, 3: 0, 4: 0 },
      { roomMode: "endless", arena: definition },
    );
    app.advanceServerSimulation(1_300);
    app.players[1].position = { x: 20, y: 60 };
    app.players[2].position = { x: 41.625, y: 60 };
    app.replaceServerPlayerInput(1, input({ bombPressed: true }));
    app.advanceServerSimulation(STEP_MS);
    app.replaceServerPlayerInput(1, input());
    app.bombs[0].fuseMs = 60_000;
    expect(app.exportOnlineSnapshot().bombs[0].bodyEgressPlayerIds).toContain(2);

    app.replaceServerPlayerInput(2, input({ direction: "right" }));
    for (let step = 0; step < 400; step += 1) app.advanceServerSimulation(STEP_MS);
    const wrapped = app.exportOnlineSnapshot();
    expect(wrapped.bombs[0].bodyEgressPlayerIds).not.toContain(2);
    expect(app.isPlayerOverlappingTile(wrapped.players[2], wrapped.bombs[0].tile)).toBe(false);
    expect(wrapped.players[2].position.x).toBeGreaterThan(240);
  });

  it("não empresta a permissão corporal à projeção nem ao finish da Ranni", () => {
    const definition = arena();
    const app = new GameApp({}, assets(), definition);
    app.startServerAuthoritativeMatch(
      [1, 2],
      { 1: 0, 2: 0, 3: 0, 4: 0 },
      { roomMode: "endless", arena: definition },
    );
    app.advanceServerSimulation(1_300);
    app.players[1].position = { x: 60, y: 60 };
    app.players[2].position = { x: 81.625, y: 60 };
    app.replaceServerPlayerInput(1, input({ bombPressed: true }));
    app.advanceServerSimulation(STEP_MS);

    const projected = app.exportOnlineSnapshot().players[2];
    projected.skill.phase = "channeling";
    projected.skill.projectedBombEgressIds = [];
    const context = app.createBotContext();
    const bodyExit = context.evaluateMovementOption(projected, "right", STEP_MS);
    const ghostExit = context.evaluateProjectedMovementOption(projected, "right", STEP_MS);

    expect(context.canMovementOptionAdvance(projected.position, bodyExit)).toBe(true);
    expect(context.canMovementOptionAdvance(projected.position, ghostExit)).toBe(false);

    app.players[2].position = { x: 100, y: 60 };
    app.players[2].skill.phase = "channeling";
    app.players[2].skill.projectedPosition = { x: 60, y: 60 };
    app.players[2].skill.projectedBombEgressIds = [];
    finishRanniBlink(app.players[2], app.createSkillContext());
    expect(app.players[2].position).toEqual({ x: 100, y: 60 });
  });
});
