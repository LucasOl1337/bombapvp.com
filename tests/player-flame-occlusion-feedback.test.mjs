// @vitest-environment node

import { describe, expect, it } from "vitest";
import { buildPlayerFlameOcclusionIndicators, GameApp } from "../src/original-game/Engine/game-app.ts";

function player(id, tile, overrides = {}) {
  return {
    id,
    tile,
    active: true,
    alive: true,
    ...overrides,
  };
}

describe("feedback de chama ocluida pelo personagem", () => {
  it("marca acima do sprite a celula de chama ocupada pelo jogador", () => {
    const indicators = buildPlayerFlameOcclusionIndicators(
      [{ tile: { x: 0, y: 3 }, remainingMs: 500, style: "normal", ownerId: 2 }],
      [player(1, { x: 0, y: 3 })],
      [],
      0,
      false,
    );

    expect(indicators).toEqual([
      {
        playerId: 1,
        ownerId: 2,
        x: 3,
        y: 123,
        width: 34,
        height: 34,
        cornerLength: 10,
        style: "normal",
        alpha: 0.85,
      },
    ]);
  });

  it("nao marca o jogador quando a chama esta apenas na celula adjacente", () => {
    const indicators = buildPlayerFlameOcclusionIndicators(
      [{ tile: { x: 0, y: 4 }, remainingMs: 500, style: "normal", ownerId: 2 }],
      [player(1, { x: 0, y: 3 })],
      [],
      0,
      false,
    );

    expect(indicators).toEqual([]);
  });

  it("nao cria indicador sem chama ativa", () => {
    const absent = buildPlayerFlameOcclusionIndicators(
      [],
      [player(1, { x: 0, y: 3 })],
      [],
      0,
      false,
    );
    const expired = buildPlayerFlameOcclusionIndicators(
      [{ tile: { x: 0, y: 3 }, remainingMs: 0, style: "normal", ownerId: 2 }],
      [player(1, { x: 0, y: 3 })],
      [],
      0,
      false,
    );

    expect(absent).toEqual([]);
    expect(expired).toEqual([]);
  });

  it("mantem jogadores, celulas, estilos e owners independentes", () => {
    const indicators = buildPlayerFlameOcclusionIndicators(
      [
        { tile: { x: 1, y: 2 }, remainingMs: 500, style: "normal", ownerId: 2 },
        { tile: { x: 7, y: 5 }, remainingMs: 500, style: "toxic", ownerId: 1 },
      ],
      [
        player(1, { x: 1, y: 2 }),
        player(2, { x: 7, y: 5 }),
      ],
      [],
      0,
      false,
    );

    expect(indicators.map(({ playerId, ownerId, x, y, style }) => ({ playerId, ownerId, x, y, style }))).toEqual([
      { playerId: 1, ownerId: 2, x: 43, y: 83, style: "normal" },
      { playerId: 2, ownerId: 1, x: 283, y: 203, style: "toxic" },
    ]);
  });

  it("preserva o indicador somente durante a animacao de eliminacao recente", () => {
    const flame = [{ tile: { x: 2, y: 2 }, remainingMs: 500, style: "normal", ownerId: 1 }];
    const eliminated = player(2, { x: 2, y: 2 }, { alive: false });

    expect(buildPlayerFlameOcclusionIndicators(
      flame,
      [eliminated],
      [{ playerId: 2, startedAtMs: 0 }],
      0,
      false,
    )).toHaveLength(1);
    expect(buildPlayerFlameOcclusionIndicators(flame, [eliminated], [], 0, false)).toEqual([]);
  });

  it("nao marca uma chama posterior sobre um jogador eliminado ha muito tempo", () => {
    let strokeCount = 0;
    const game = {
      flames: [{ tile: { x: 2, y: 2 }, remainingMs: 500, style: "normal", ownerId: 1 }],
      players: {
        1: player(1, { x: 8, y: 8 }),
        2: player(2, { x: 2, y: 2 }, { alive: false }),
        3: player(3, { x: 7, y: 8 }),
        4: player(4, { x: 6, y: 8 }),
      },
      playerDeathAnimations: {
        1: null,
        2: { startedAtMs: 1_000, direction: "down" },
        3: null,
        4: null,
      },
      animationClockMs: 2_000,
      prefersReducedMotion: false,
      ctx: {
        save() {},
        restore() {},
        beginPath() {},
        moveTo() {},
        lineTo() {},
        stroke() { strokeCount += 1; },
      },
    };

    GameApp.prototype.drawPlayerFlameOcclusionIndicators.call(game);

    expect(strokeCount).toBe(0);
  });

  it("marca pelo ciclo real a eliminacao recente e o jogador vivo", () => {
    let strokeCount = 0;
    const game = {
      flames: [
        { tile: { x: 2, y: 2 }, remainingMs: 500, style: "normal", ownerId: 1 },
        { tile: { x: 3, y: 2 }, remainingMs: 500, style: "normal", ownerId: 2 },
      ],
      players: {
        1: player(1, { x: 3, y: 2 }),
        2: player(2, { x: 2, y: 2 }, { alive: false }),
        3: player(3, { x: 7, y: 8 }),
        4: player(4, { x: 6, y: 8 }),
      },
      playerDeathAnimations: {
        1: null,
        2: { startedAtMs: 1_700, direction: "down" },
        3: null,
        4: null,
      },
      animationClockMs: 2_000,
      prefersReducedMotion: false,
      ctx: {
        save() {},
        restore() {},
        beginPath() {},
        moveTo() {},
        lineTo() {},
        stroke() { strokeCount += 1; },
      },
    };

    GameApp.prototype.drawPlayerFlameOcclusionIndicators.call(game);

    expect(strokeCount).toBe(4);
  });

  it("mantem o destaque estatico quando movimento reduzido esta ativo", () => {
    const flame = [{ tile: { x: 2, y: 2 }, remainingMs: 500, style: "normal", ownerId: 1 }];
    const dissipatingFlame = [{ tile: { x: 2, y: 2 }, remainingMs: 60, style: "normal", ownerId: 1 }];
    const occupant = player(2, { x: 2, y: 2 });
    const reducedAtStart = buildPlayerFlameOcclusionIndicators(flame, [occupant], [], 0, true);
    const reducedLater = buildPlayerFlameOcclusionIndicators(flame, [occupant], [], 600, true);
    const reducedNearExpiry = buildPlayerFlameOcclusionIndicators(dissipatingFlame, [occupant], [], 600, true);
    const animatedLater = buildPlayerFlameOcclusionIndicators(flame, [occupant], [], 600, false);
    const animatedNearExpiry = buildPlayerFlameOcclusionIndicators(dissipatingFlame, [occupant], [], 600, false);

    expect(reducedAtStart[0].alpha).toBe(reducedLater[0].alpha);
    expect(reducedAtStart[0].alpha).toBe(reducedNearExpiry[0].alpha);
    expect(animatedLater[0].alpha).not.toBe(reducedLater[0].alpha);
    expect(animatedNearExpiry[0].alpha).toBeLessThan(animatedLater[0].alpha);
  });

  it("isola o glow e inicia sem sombra o contorno de cada jogador", () => {
    const strokes = [];
    const ctx = {
      shadowBlur: 0,
      shadowColor: "transparent",
      strokeStyle: "transparent",
      lineWidth: 0,
      globalAlpha: 1,
      lineCap: "butt",
      lineJoin: "miter",
      save() {},
      restore() {},
      beginPath() {},
      moveTo() {},
      lineTo() {},
      stroke() {
        strokes.push({
          strokeStyle: this.strokeStyle,
          shadowBlur: this.shadowBlur,
          shadowColor: this.shadowColor,
        });
      },
    };
    const game = {
      flames: [
        { tile: { x: 1, y: 2 }, remainingMs: 500, style: "normal", ownerId: 2 },
        { tile: { x: 7, y: 5 }, remainingMs: 500, style: "toxic", ownerId: 1 },
      ],
      players: {
        1: player(1, { x: 1, y: 2 }),
        2: player(2, { x: 7, y: 5 }),
        3: player(3, { x: 8, y: 8 }),
        4: player(4, { x: 6, y: 8 }),
      },
      playerDeathAnimations: { 1: null, 2: null, 3: null, 4: null },
      animationClockMs: 0,
      prefersReducedMotion: false,
      ctx,
    };

    GameApp.prototype.drawPlayerFlameOcclusionIndicators.call(game);

    expect(strokes).toEqual([
      { strokeStyle: "rgba(8, 8, 16, 0.9)", shadowBlur: 0, shadowColor: "transparent" },
      { strokeStyle: "#fff0a6", shadowBlur: 6, shadowColor: "rgba(255, 76, 28, 0.95)" },
      { strokeStyle: "rgba(8, 8, 16, 0.9)", shadowBlur: 0, shadowColor: "transparent" },
      { strokeStyle: "#baffd3", shadowBlur: 6, shadowColor: "rgba(54, 255, 151, 0.95)" },
    ]);
  });

  it("desenha o indicador depois dos sprites sem elevar todo o blast", () => {
    const order = [];
    const game = {
      arenaStaticDirty: false,
      arenaStaticCache: {},
      arenaStaticMistGradient: {},
      crateBreakAnimations: [],
      arena: { powerUps: [] },
      bombs: [],
      flames: [],
      championWorldEffects: [],
      suddenDeathClosureEffects: [],
      players: { 1: { id: 1 }, 2: { id: 2 }, 3: { id: 3 }, 4: { id: 4 } },
      ctx: {
        save() {},
        translate() {},
        scale() {},
        drawImage() {},
        restore() {},
        fillRect() {},
      },
      getArenaRenderMetrics: () => ({ arenaX: 0, arenaY: 0, scale: 1 }),
      getArenaPixelWidth: () => 440,
      getArenaPixelHeight: () => 360,
      drawDangerOverlay() {},
      drawBombPreviewOverlay() {},
      drawExplosionFeedback: () => order.push("blast-underlay"),
      drawPlayerSkillPreview() {},
      drawPlayer: (entry) => order.push(`player-${entry.id}`),
      drawPlayerFlameOcclusionIndicators: () => order.push("player-flame-indicator"),
    };

    GameApp.prototype.renderArena.call(game);

    expect(order).toEqual([
      "blast-underlay",
      "player-1",
      "player-2",
      "player-3",
      "player-4",
      "player-flame-indicator",
    ]);
  });
});
