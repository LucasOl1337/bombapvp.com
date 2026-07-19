import { describe, expect, it } from "vitest";
import { resolveLaunchRequest } from "../src/matches/launch-request.ts";
import {
  launchRequestFromSearchParams,
  launchRequestToSearchParams,
} from "../src/matches/url-search-params.ts";

describe("launch request", () => {
  it("serializa treino com personagem e bot na URL documentada", () => {
    const result = resolveLaunchRequest({
      mode: "training",
      character: "5474c45c-2987-43e0-af2c-a6500c836881",
      bot: "pingo",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);

    expect(launchRequestToSearchParams(result.request).toString()).toBe(
      "mode=training&character=5474c45c-2987-43e0-af2c-a6500c836881&bot=pingo",
    );
  });

  it("faz round-trip de uma URL offline sem derivar o literal esperado", () => {
    const literal = "mode=continuous&character=03a976fb-7313-4064-a477-5bb9b0760034&bot=v3";
    const result = launchRequestFromSearchParams(new URLSearchParams(literal));

    expect(result).toEqual({
      ok: true,
      request: {
        mode: "continuous",
        character: "03a976fb-7313-4064-a477-5bb9b0760034",
        bot: "v3",
        botSelection: "explicit",
      },
    });
    if (!result.ok) throw new Error(result.error);
    expect(launchRequestToSearchParams(result.request).toString()).toBe(literal);
  });

  it("aplica os defaults documentados quando bot está ausente ou inválido", () => {
    expect(launchRequestFromSearchParams(new URLSearchParams(
      "mode=training&character=character-one&bot=invalid",
    ))).toEqual({
      ok: true,
      request: { mode: "training", character: "character-one", bot: "bomb", botSelection: "default" },
    });
    expect(launchRequestFromSearchParams(new URLSearchParams(
      "mode=continuous&character=character-two",
    ))).toEqual({
      ok: true,
      request: { mode: "continuous", character: "character-two", bot: "v1", botSelection: "default" },
    });
  });

  it("preserva a selecao nativa quando um request default faz round-trip", () => {
    const parsed = launchRequestFromSearchParams(new URLSearchParams(
      "mode=continuous&character=character-two",
    ));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) throw new Error(parsed.error);

    const serialized = launchRequestToSearchParams(parsed.request);
    expect(serialized.toString()).toBe("mode=continuous&character=character-two");
    expect(launchRequestFromSearchParams(serialized)).toEqual(parsed);
  });

  it("mantém o fallback histórico de modo e personagem ausentes", () => {
    expect(launchRequestFromSearchParams(new URLSearchParams("mode=INVALID"))).toEqual({
      ok: true,
      request: { mode: "training", character: null, bot: "bomb", botSelection: "default" },
    });
  });

  it("trata character vazio ou só espaços como ausente e não serializa o parâmetro", () => {
    expect(launchRequestFromSearchParams(new URLSearchParams(
      "mode=training&character=",
    ))).toEqual({
      ok: true,
      request: { mode: "training", character: null, bot: "bomb", botSelection: "default" },
    });
    expect(launchRequestFromSearchParams(new URLSearchParams(
      "mode=continuous&character=%20%20&bot=v2",
    ))).toEqual({
      ok: true,
      request: { mode: "continuous", character: null, bot: "v2", botSelection: "explicit" },
    });

    const resolved = resolveLaunchRequest({
      mode: "training",
      character: "   ",
      bot: "pingo",
    });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) throw new Error(resolved.error);
    expect(resolved.request.character).toBeNull();
    expect(launchRequestToSearchParams(resolved.request).toString()).toBe(
      "mode=training&bot=pingo",
    );
  });

  it("normaliza uma sala lab e serializa modelos e labels por slot", () => {
    const result = resolveLaunchRequest({
      mode: "lab",
      models: [" bot-v1 ", "cx/gpt-5.6-luna", " cc/claude-fable-5 "],
      labels: ["label externo ignorado", "  GPT\u0000 5.6 Luna Leve  ", "Claude Fable 5"],
    });

    expect(result).toEqual({
      ok: true,
      request: {
        mode: "lab",
        competitors: [
          { model: "bot-v1" },
          { model: "cx/gpt-5.6-luna", label: "GPT 5.6 Luna Leve" },
          { model: "cc/claude-fable-5", label: "Claude Fable 5" },
        ],
      },
    });
    if (!result.ok) throw new Error(result.error);
    expect(launchRequestToSearchParams(result.request).toString()).toBe(
      "mode=lab&model1=bot-v1&model2=cx%2Fgpt-5.6-luna&label2=GPT+5.6+Luna+Leve&model3=cc%2Fclaude-fable-5&label3=Claude+Fable+5",
    );
  });

  it("faz round-trip literal de quatro slots lab contíguos", () => {
    const literal = "mode=lab&model1=bot-bomb&model2=cx%2Fgpt-5.6-sol&label2=GPT+5.6+Sol&model3=bot-v3&model4=cc%2Fclaude-fable-5&label4=Claude+Fable+5";
    const result = launchRequestFromSearchParams(new URLSearchParams(literal));

    expect(result).toEqual({
      ok: true,
      request: {
        mode: "lab",
        competitors: [
          { model: "bot-bomb" },
          { model: "cx/gpt-5.6-sol", label: "GPT 5.6 Sol" },
          { model: "bot-v3" },
          { model: "cc/claude-fable-5", label: "Claude Fable 5" },
        ],
      },
    });
    if (!result.ok) throw new Error(result.error);
    expect(launchRequestToSearchParams(result.request).toString()).toBe(literal);
  });

  it("preserva os erros legados de slots lab ausentes e não contíguos", () => {
    expect(launchRequestFromSearchParams(
      new URLSearchParams("model1=bot-v1"),
      "lab",
    )).toEqual({ ok: false, error: "lab_competitors_missing" });

    expect(launchRequestFromSearchParams(
      new URLSearchParams("model1=bot-v1&model2=bot-v2&model4=bot-v3"),
      "lab",
    )).toEqual({ ok: false, error: "lab_competitor_gap" });
  });

  it("ignora slots além do quarto sem mascarar uma lacuna entre competidores", () => {
    expect(launchRequestFromSearchParams(
      new URLSearchParams("mode=lab&model1=bot-v1&model2=bot-v2&model5=bot-v3"),
    )).toEqual({
      ok: true,
      request: {
        mode: "lab",
        competitors: [{ model: "bot-v1" }, { model: "bot-v2" }],
      },
    });

    expect(launchRequestFromSearchParams(
      new URLSearchParams("mode=lab&model1=bot-v1&model3=bot-v2&model5=bot-v3"),
    )).toEqual({ ok: false, error: "lab_competitors_missing" });
  });

  it("rejeita construções lab fora de dois a quatro modelos preenchidos", () => {
    expect(resolveLaunchRequest({ mode: "lab", models: ["bot-v1"] })).toEqual({
      ok: false,
      error: "lab_competitors_invalid",
    });
    expect(resolveLaunchRequest({
      mode: "lab",
      models: ["bot-v1", "bot-v2", "bot-v3", "bot-bomb", "bot-pingo"],
    })).toEqual({ ok: false, error: "lab_competitors_invalid" });
    expect(resolveLaunchRequest({ mode: "lab", models: ["bot-v1", "  "] })).toEqual({
      ok: false,
      error: "lab_competitors_invalid",
    });
  });
});
