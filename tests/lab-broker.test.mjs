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
    expect(catalog.profiles).toHaveLength(10);
    expect(catalog.profiles.map((profile) => profile.route)).toContain("cx/gpt-5.6-sol-xhigh");

    const decision = await broker(new Request("http://broker/decision", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "cx/gpt-5.6-sol-high", observation: { playerId: 1 } }),
    }));
    expect(decision.status).toBe(200);
    await expect(decision.json()).resolves.toMatchObject({
      latencyMs: expect.any(Number),
      usage: { inputTokens: 120, outputTokens: 18, totalTokens: 138 },
    });
    expect(upstreamPayloads[0].model).toBe("cx/gpt-5.6-sol-high");
    expect(upstreamPayloads[0].max_completion_tokens).toBe(120);
    expect(upstreamPayloads[0]).not.toHaveProperty("max_tokens");
    expect(JSON.stringify(upstreamPayloads[0])).not.toMatch(/reasoning|thinking|effort/i);

    const claudeDecision = await broker(new Request("http://broker/decision", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "cc/claude-fable-5", observation: { playerId: 2 } }),
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
      body: JSON.stringify({ model: "modelo/inventado", observation: { playerId: 1 } }),
    }));
    expect(response.status).toBe(400);
    expect(upstream).not.toHaveBeenCalled();
  });
});
