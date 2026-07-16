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
