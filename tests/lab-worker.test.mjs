import { describe, expect, it, vi } from "vitest";
import worker, { handleRequest } from "../worker/index.js";

describe("proxy do Laboratorio", () => {
  it("encaminha somente rotas permitidas com o segredo interno", async () => {
    const brokerFetch = vi.fn(async (request) => {
      const path = new URL(request.url).pathname;
      return Response.json({
        path,
        secret: request.headers.get("x-bomba-lab-secret"),
        ...(path === "/decision" ? {
          latencyMs: 321,
          usage: { inputTokens: 120, outputTokens: 8, totalTokens: 128 },
        } : {}),
      });
    });
    const env = {
      ASSETS: { fetch: vi.fn(async () => new Response("asset")) },
      LAB_BROKER_URL: "https://broker.example",
      LAB_BROKER_SECRET: "secret",
    };

    const response = await handleRequest(new Request("https://bombapvp.com/api/lab/models"), env, brokerFetch);
    await expect(response.json()).resolves.toEqual({ path: "/models", secret: "secret" });

    const decision = await handleRequest(new Request("https://bombapvp.com/api/lab/decision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "cx/gpt-5.6-sol", observation: { playerId: 1 } }),
    }), env, brokerFetch);
    await expect(decision.json()).resolves.toEqual({
      path: "/decision",
      secret: "secret",
      latencyMs: 321,
      usage: { inputTokens: 120, outputTokens: 8, totalTokens: 128 },
    });

    const blocked = await handleRequest(new Request("https://bombapvp.com/api/lab/admin"), env, brokerFetch);
    expect(blocked.status).toBe(404);
    expect(brokerFetch).toHaveBeenCalledTimes(2);
  });

  it("nao aplica rate limit intencional as decisoes", async () => {
    const brokerFetch = vi.fn(async () => Response.json({ ok: true }));
    const env = {
      ASSETS: { fetch: vi.fn() },
      LAB_BROKER_URL: "https://broker.example",
      LAB_BROKER_SECRET: "secret",
      LAB_DECISION_RATE_LIMITER: { limit: vi.fn(async () => ({ success: false })) },
    };
    const response = await handleRequest(new Request("https://bombapvp.com/api/lab/decision", {
      method: "POST",
      headers: { "Content-Type": "application/json", "cf-connecting-ip": "203.0.113.1" },
      body: "{}",
    }), env, brokerFetch);

    expect(response.status).toBe(200);
    expect(brokerFetch).toHaveBeenCalledOnce();
    expect(env.LAB_DECISION_RATE_LIMITER.limit).not.toHaveBeenCalled();
  });

  it("preserva o erro publico correlacionado e Retry-After do broker", async () => {
    const brokerFetch = vi.fn(async () => Response.json({
      ok: false,
      error: { code: "model_disabled" },
      requestId: "opaque-worker-429",
      retryAfterMs: 2_000,
    }, {
      status: 429,
      headers: { "Retry-After": "2" },
    }));
    const env = {
      ASSETS: { fetch: vi.fn() },
      LAB_BROKER_URL: "https://broker.example",
      LAB_BROKER_SECRET: "secret",
    };
    const response = await handleRequest(new Request("https://bombapvp.com/api/lab/decision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "cx/gpt-5.6-sol",
        observation: {},
        requestId: "opaque-worker-429",
      }),
    }), env, brokerFetch);

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("2");
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "model_disabled" },
      requestId: "opaque-worker-429",
      retryAfterMs: 2_000,
    });
  });

  it("correlaciona erros locais antes e durante o acesso ao broker", async () => {
    const decisionRequest = (requestId) => new Request("https://bombapvp.com/api/lab/decision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "cx/gpt-5.6-sol", observation: {}, requestId }),
    });
    const unconfigured = await handleRequest(decisionRequest("opaque-worker-503"), {
      ASSETS: { fetch: vi.fn() },
    }, vi.fn());
    expect(unconfigured.status).toBe(503);
    await expect(unconfigured.json()).resolves.toEqual({
      ok: false,
      error: { code: "lab_broker_not_configured" },
      requestId: "opaque-worker-503",
    });

    const unavailable = await handleRequest(decisionRequest("opaque-worker-502"), {
      ASSETS: { fetch: vi.fn() },
      LAB_BROKER_URL: "https://broker.example",
      LAB_BROKER_SECRET: "secret",
    }, vi.fn(async () => { throw new Error("unavailable"); }));
    expect(unavailable.status).toBe(502);
    await expect(unavailable.json()).resolves.toEqual({
      ok: false,
      error: { code: "lab_broker_unavailable" },
      requestId: "opaque-worker-502",
    });
  });

  it("ignora o ExecutionContext injetado pelo runtime", async () => {
    const brokerFetch = vi.fn(async () => Response.json({ ok: true }));
    vi.stubGlobal("fetch", brokerFetch);
    const env = {
      ASSETS: { fetch: vi.fn() },
      LAB_BROKER_URL: "https://broker.example",
      LAB_BROKER_SECRET: "secret",
    };

    const response = await worker.fetch(
      new Request("https://bombapvp.com/api/lab/health"),
      env,
      { waitUntil: vi.fn() },
    );

    expect(response.status).toBe(200);
    expect(brokerFetch).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });
});
