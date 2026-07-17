import { timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";

const PROFILES = Object.freeze([
  { id: "claude-fable-5", label: "Claude Fable 5", route: "cc/claude-fable-5" },
  { id: "claude-opus-4-8-high", label: "Claude Opus 4.8 Alto", route: "cc/claude-opus-4-8(max)" },
  { id: "gpt-5-6-sol", label: "GPT 5.6 Sol Normal", route: "cx/gpt-5.6-sol" },
  { id: "gpt-5-6-sol-high", label: "GPT 5.6 Sol High", route: "cx/gpt-5.6-sol-high" },
  { id: "gpt-5-6-sol-xhigh", label: "GPT 5.6 Sol xhigh", route: "cx/gpt-5.6-sol-xhigh" },
  { id: "gpt-5-6-sol-ultra", label: "GPT 5.6 Sol Ultra", route: "cx/gpt-5.6-sol-xhigh" },
  { id: "gpt-5-6-luna", label: "GPT 5.6 Luna Leve", route: "cx/gpt-5.6-luna" },
  { id: "gpt-5-6-luna-xhigh", label: "GPT 5.6 Luna xhigh", route: "cx/gpt-5.6-luna-xhigh" },
  { id: "gpt-5-6-luna-ultra", label: "GPT 5.6 Luna Ultra", route: "cx/gpt-5.6-luna-xhigh" },
  { id: "gpt-5-5-xhigh", label: "GPT 5.5 xhigh", route: "cx/gpt-5.5-xhigh" },
  { id: "grok-4-5", label: "Grok 4.5", route: "gcli/grok-4.5" },
]);
const ALLOWED_ROUTES = new Set(PROFILES.map(({ route }) => route));
const MAX_BODY_BYTES = 64 * 1024;
const SYSTEM_PROMPT = [
  "You control one player in Bomba PvP.",
  "Act immediately. Do not analyze, explain or plan.",
  "Return only a JSON object with direction, placeBomb, detonate and useSkill.",
  "direction must be up, down, left, right or null.",
  "Every request is a fresh complete tactical snapshot and immediately replaces your previous action.",
  "Survive first, avoid bombs and flames, collect useful powerups, then attack.",
].join(" ");

function json(status, body, headers = {}) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
  });
}

function readRequestId(body) {
  return typeof body?.requestId === "string" && body.requestId.length > 0
    ? body.requestId
    : null;
}

function retryAfterDetails(response, payload) {
  const header = response.headers.get("Retry-After");
  if (typeof payload?.retryAfterMs === "number" && Number.isFinite(payload.retryAfterMs)) {
    return { header, ms: Math.max(0, Math.round(payload.retryAfterMs)) };
  }
  if (!header) return { header: null, ms: null };
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return { header, ms: Math.max(0, Math.round(seconds * 1_000)) };
  const dateMs = Date.parse(header);
  return { header, ms: Number.isFinite(dateMs) ? Math.max(0, dateMs - Date.now()) : null };
}

function upstreamErrorCode(payload, fallback) {
  if (typeof payload?.error?.code === "string") return payload.error.code;
  if (typeof payload?.code === "string") return payload.code;
  if (typeof payload?.error === "string") return payload.error;
  return fallback;
}

function decisionError(status, code, requestId, retry = { header: null, ms: null }) {
  return json(status, {
    ok: false,
    error: { code },
    ...(requestId ? { requestId } : {}),
    ...(retry.ms === null ? {} : { retryAfterMs: retry.ms }),
  }, retry.header ? { "Retry-After": retry.header } : {});
}

function equalSecret(actual, expected) {
  if (!actual || !expected) return false;
  const left = Buffer.from(actual);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

async function readBody(request) {
  const text = await request.text();
  if (Buffer.byteLength(text) > MAX_BODY_BYTES) throw new Error("body_too_large");
  return JSON.parse(text);
}

function parseModelContent(content) {
  const text = Array.isArray(content)
    ? content.map((part) => typeof part === "object" && part ? part.text ?? "" : "").join("")
    : String(content ?? "");
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first < 0 || last <= first) throw new Error("invalid_model_json");
  return JSON.parse(text.slice(first, last + 1));
}

function normalizeDecision(value) {
  const directions = new Set(["up", "down", "left", "right", null]);
  const direction = value?.direction ?? null;
  if (!directions.has(direction)) throw new Error("invalid_direction");
  return {
    direction,
    placeBomb: value?.placeBomb === true,
    detonate: value?.detonate === true,
    useSkill: value?.useSkill === true,
  };
}

function normalizeUsage(value) {
  if (!value || typeof value !== "object") return null;
  const inputTokens = Number(value.prompt_tokens);
  const outputTokens = Number(value.completion_tokens);
  const totalTokens = Number(value.total_tokens);
  if (![inputTokens, outputTokens, totalTokens].every(Number.isFinite)) return null;
  return {
    inputTokens: Math.max(0, inputTokens),
    outputTokens: Math.max(0, outputTokens),
    totalTokens: Math.max(0, totalTokens),
  };
}

export function createLabBroker({ fetch: fetchImpl, baseUrl, apiKey, secret }) {
  const normalizedBase = String(baseUrl || "").replace(/\/+$/, "");

  return async function handle(request) {
    const url = new URL(request.url);
    if (url.pathname === "/health" && request.method === "GET") {
      return json(200, { ok: true, source: "9router", configured: Boolean(normalizedBase && apiKey && secret) });
    }
    const isDecisionRequest = url.pathname === "/decision" && request.method === "POST";
    let decisionBody = null;
    let decisionRequestId = null;
    if (isDecisionRequest) {
      try {
        decisionBody = await readBody(request);
        decisionRequestId = readRequestId(decisionBody);
      } catch (error) {
        return decisionError(
          error instanceof Error && error.message === "body_too_large" ? 413 : 400,
          "invalid_request",
          null,
        );
      }
    }
    if (!equalSecret(request.headers.get("x-bomba-lab-secret"), secret)) {
      return isDecisionRequest
        ? decisionError(401, "unauthorized", decisionRequestId)
        : json(401, { ok: false, error: "unauthorized" });
    }
    if (!normalizedBase || !apiKey) {
      return isDecisionRequest
        ? decisionError(503, "9router_not_configured", decisionRequestId)
        : json(503, { ok: false, error: "9router_not_configured" });
    }

    if (url.pathname === "/models" && request.method === "GET") {
      try {
        const upstream = await fetchImpl(`${normalizedBase}/models`, {
          headers: { Authorization: `Bearer ${apiKey}` },
          signal: AbortSignal.timeout(10_000),
        });
        if (!upstream.ok) return json(502, { ok: false, error: "9router_models_unavailable" });
        const payload = await upstream.json();
        if (!Array.isArray(payload?.data)) {
          return json(502, { ok: false, error: "9router_models_unavailable" });
        }
        return json(200, { ok: true, profiles: PROFILES });
      } catch {
        return json(502, { ok: false, error: "9router_models_unavailable" });
      }
    }

    if (isDecisionRequest) {
      const body = decisionBody;
      const requestId = decisionRequestId;
      if (!requestId) return decisionError(400, "request_id_required", null);
      if (!ALLOWED_ROUTES.has(body?.model)) return decisionError(400, "model_not_allowed", requestId);
      if (!body.observation || typeof body.observation !== "object") {
        return decisionError(400, "observation_required", requestId);
      }

      const startedAt = Date.now();
      try {
        const upstream = await fetchImpl(`${normalizedBase}/chat/completions`, {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: body.model,
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: JSON.stringify(body.observation) },
            ],
            ...(String(body.model).startsWith("cx/gpt-5")
              ? { max_completion_tokens: 120 }
              : { max_tokens: 120 }),
            response_format: { type: "json_object" },
            stream: false,
          }),
          signal: AbortSignal.timeout(20_000),
        });
        if (!upstream.ok) {
          let errorPayload = null;
          try {
            errorPayload = await upstream.json();
          } catch {
            // The status and correlation still remain useful for a non-JSON upstream error.
          }
          return decisionError(
            upstream.status,
            upstreamErrorCode(errorPayload, "9router_decision_unavailable"),
            requestId,
            retryAfterDetails(upstream, errorPayload),
          );
        }
        const payload = await upstream.json();
        const decision = normalizeDecision(parseModelContent(payload?.choices?.[0]?.message?.content));
        return json(200, {
          ok: true,
          decision,
          latencyMs: Date.now() - startedAt,
          usage: normalizeUsage(payload?.usage),
          ...(requestId ? { requestId } : {}),
        });
      } catch (error) {
        const timedOut = error instanceof Error
          && (error.name === "TimeoutError" || error.name === "AbortError");
        return decisionError(
          timedOut ? 504 : 502,
          timedOut ? "9router_decision_timeout" : "9router_decision_unavailable",
          requestId,
        );
      }
    }

    return json(404, { ok: false, error: "not_found" });
  };
}

async function readIncoming(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new Error("body_too_large");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export function startLabBroker() {
  const host = process.env.LAB_BROKER_HOST || "127.0.0.1";
  const port = Number(process.env.LAB_BROKER_PORT || 8766);
  const broker = createLabBroker({
    fetch,
    baseUrl: process.env.NINE_ROUTER_BASE_URL || "http://127.0.0.1:20128/v1",
    apiKey: process.env.NINE_ROUTER_API_KEY || process.env.BOMBA_LAB_NINE_ROUTER_KEY || "",
    secret: process.env.LAB_BROKER_SECRET || process.env.BOMBA_LAB_BROKER_SECRET || "",
  });
  const server = createServer(async (incoming, outgoing) => {
    try {
      const body = incoming.method === "GET" || incoming.method === "HEAD" ? undefined : await readIncoming(incoming);
      const request = new Request(`http://${incoming.headers.host || `${host}:${port}`}${incoming.url || "/"}`, {
        method: incoming.method,
        headers: incoming.headers,
        body,
      });
      const response = await broker(request);
      outgoing.writeHead(response.status, Object.fromEntries(response.headers));
      outgoing.end(Buffer.from(await response.arrayBuffer()));
    } catch {
      outgoing.writeHead(400, { "Content-Type": "application/json" });
      outgoing.end(JSON.stringify({ ok: false, error: "invalid_request" }));
    }
  });
  server.listen(port, host, () => console.log(`[lab-broker] listening on http://${host}:${port}`));
  return server;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) startLabBroker();
