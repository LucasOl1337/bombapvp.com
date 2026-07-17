import { describe, expect, it, vi } from "vitest";
import { createLabBroker } from "../lab-broker/server.mjs";

describe("broker minimo do Laboratorio", () => {
  it("expoe somente a whitelist e envia uma rota pronta sem esforco", async () => {
    const upstreamPayloads = [];
    const upstream = vi.fn(async (url, init = {}) => {
      if (String(url).endsWith("/models")) {
        return Response.json({ data: [
          { id: "cx/gpt-5.6-sol" },
          { id: "cx/gpt-5.6-sol-high" },
          { id: "cx/gpt-5.6-sol-xhigh" },
          { id: "fora/da-whitelist" },
        ] });
      }
      upstreamPayloads.push(JSON.parse(String(init.body)));
      return Response.json({
        choices: [{ message: { content: JSON.stringify({
          direction: "up", placeBomb: false, detonate: false, useSkill: false,
        }) } }],
        usage: { prompt_tokens: 120, completion_tokens: 18, total_tokens: 138 },
      });
    });
    const broker = createLabBroker({
      fetch: upstream,
      baseUrl: "http://9router.test/v1",
      apiKey: "not-a-real-key",
      secret: "internal-secret",
    });
    const headers = { "x-bomba-lab-secret": "internal-secret" };

    const models = await broker(new Request("http://broker/models", { headers }));
    const catalog = await models.json();
    expect(catalog.profiles.map((profile) => profile.route)).not.toContain("fora/da-whitelist");
    expect(catalog.profiles).toHaveLength(11);
    expect(catalog.profiles.map((profile) => profile.route)).toContain("cx/gpt-5.6-sol-xhigh");
    expect(catalog.profiles).toContainEqual({
      id: "gpt-5-6-luna",
      label: "GPT 5.6 Luna Leve",
      route: "cx/gpt-5.6-luna",
    });

    const decision = await broker(new Request("http://broker/decision", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "cx/gpt-5.6-sol-high",
        observation: { playerId: 1 },
        requestId: "opaque-success-1",
      }),
    }));
    expect(decision.status).toBe(200);
    await expect(decision.json()).resolves.toMatchObject({
      requestId: "opaque-success-1",
      latencyMs: expect.any(Number),
      usage: { inputTokens: 120, outputTokens: 18, totalTokens: 138 },
    });
    expect(upstreamPayloads[0].model).toBe("cx/gpt-5.6-sol-high");
    expect(upstreamPayloads[0].max_completion_tokens).toBe(120);
    expect(upstreamPayloads[0]).not.toHaveProperty("max_tokens");
    expect(upstreamPayloads[0].messages[0].content).toContain(
      "Act immediately. Do not analyze, explain or plan.",
    );
    expect(JSON.stringify(upstreamPayloads[0])).not.toMatch(/reasoning|thinking|effort/i);

    const claudeDecision = await broker(new Request("http://broker/decision", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "cc/claude-fable-5",
        observation: { playerId: 2 },
        requestId: "opaque-claude-1",
      }),
    }));
    expect(claudeDecision.status).toBe(200);
    expect(upstreamPayloads[1]).toMatchObject({ model: "cc/claude-fable-5", max_tokens: 120 });
    expect(upstreamPayloads[1]).not.toHaveProperty("max_completion_tokens");
  });

  it("rejeita modelo fora da whitelist antes do upstream", async () => {
    const upstream = vi.fn();
    const broker = createLabBroker({ fetch: upstream, baseUrl: "http://9router.test/v1", apiKey: "key", secret: "secret" });
    const response = await broker(new Request("http://broker/decision", {
      method: "POST",
      headers: { "x-bomba-lab-secret": "secret", "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "modelo/inventado",
        observation: { playerId: 1 },
        requestId: "opaque-invalid-model",
      }),
    }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "model_not_allowed" },
      requestId: "opaque-invalid-model",
    });
    expect(upstream).not.toHaveBeenCalled();
  });

  it("preserva a correlacao nos erros de autenticacao e configuracao", async () => {
    const decisionRequest = (requestId, secret) => new Request("http://broker/decision", {
      method: "POST",
      headers: { "x-bomba-lab-secret": secret, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "cx/gpt-5.6-sol",
        observation: { playerId: 1 },
        requestId,
      }),
    });
    const unauthorizedBroker = createLabBroker({
      fetch: vi.fn(),
      baseUrl: "http://9router.test/v1",
      apiKey: "key",
      secret: "correct-secret",
    });
    const unauthorized = await unauthorizedBroker(decisionRequest("opaque-401", "wrong-secret"));
    expect(unauthorized.status).toBe(401);
    await expect(unauthorized.json()).resolves.toEqual({
      ok: false,
      error: { code: "unauthorized" },
      requestId: "opaque-401",
    });

    const unconfiguredBroker = createLabBroker({
      fetch: vi.fn(),
      baseUrl: "",
      apiKey: "",
      secret: "correct-secret",
    });
    const unconfigured = await unconfiguredBroker(decisionRequest("opaque-503", "correct-secret"));
    expect(unconfigured.status).toBe(503);
    await expect(unconfigured.json()).resolves.toEqual({
      ok: false,
      error: { code: "9router_not_configured" },
      requestId: "opaque-503",
    });
  });

  it("preserva status, codigo, correlacao e Retry-After do upstream", async () => {
    const upstream = vi.fn(async () => Response.json({
      error: { code: "model_disabled" },
    }, {
      status: 429,
      headers: { "Retry-After": "2" },
    }));
    const broker = createLabBroker({
      fetch: upstream,
      baseUrl: "http://9router.test/v1",
      apiKey: "key",
      secret: "secret",
    });
    const response = await broker(new Request("http://broker/decision", {
      method: "POST",
      headers: { "x-bomba-lab-secret": "secret", "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "cx/gpt-5.6-sol",
        observation: { playerId: 1 },
        requestId: "opaque-rate-limit",
      }),
    }));

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("2");
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: { code: "model_disabled" },
      requestId: "opaque-rate-limit",
      retryAfterMs: 2_000,
    });
  });

  it.each([
    {
      label: "falha generica",
      errorName: "Error",
      expectedStatus: 502,
      expectedCode: "9router_decision_unavailable",
      requestId: "opaque-502",
    },
    {
      label: "timeout",
      errorName: "TimeoutError",
      expectedStatus: 504,
      expectedCode: "9router_decision_timeout",
      requestId: "opaque-504",
    },
  ])("correlaciona $label do transporte como $expectedStatus", async ({
    errorName,
    expectedStatus,
    expectedCode,
    requestId,
  }) => {
    const transportError = new Error(errorName);
    transportError.name = errorName;
    const broker = createLabBroker({
      fetch: vi.fn(async () => { throw transportError; }),
      baseUrl: "http://9router.test/v1",
      apiKey: "key",
      secret: "secret",
    });
    const response = await broker(new Request("http://broker/decision", {
      method: "POST",
      headers: { "x-bomba-lab-secret": "secret", "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "cx/gpt-5.6-sol",
        observation: { playerId: 1 },
        requestId,
      }),
    }));

    expect(response.status).toBe(expectedStatus);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: { code: expectedCode },
      requestId,
    });
  });
});
