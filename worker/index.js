const LAB_ROUTES = new Map([
  ["/api/lab/health", { method: "GET", target: "/health" }],
  ["/api/lab/models", { method: "GET", target: "/models" }],
  ["/api/lab/decision", { method: "POST", target: "/decision" }],
]);

function json(status, body) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function requestIdFromBody(body) {
  if (!body) return null;
  try {
    const value = JSON.parse(new TextDecoder().decode(body));
    return typeof value?.requestId === "string" && value.requestId.length > 0
      ? value.requestId
      : null;
  } catch {
    return null;
  }
}

function decisionError(status, code, requestId) {
  return json(status, {
    ok: false,
    error: { code },
    ...(requestId ? { requestId } : {}),
  });
}

export async function handleRequest(request, env, fetchImpl = globalThis.fetch) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/lab/")) return env.ASSETS.fetch(request);

  const route = LAB_ROUTES.get(url.pathname);
  if (!route) return json(404, { ok: false, error: "not_found" });
  if (request.method !== route.method) return json(405, { ok: false, error: "method_not_allowed" });
  const body = request.method === "POST" ? await request.arrayBuffer() : undefined;
  const requestId = route.target === "/decision" ? requestIdFromBody(body) : null;
  if (!env.LAB_BROKER_URL || !env.LAB_BROKER_SECRET) {
    return route.target === "/decision"
      ? decisionError(503, "lab_broker_not_configured", requestId)
      : json(503, { ok: false, error: "lab_broker_not_configured" });
  }
  const target = new URL(route.target, `${String(env.LAB_BROKER_URL).replace(/\/+$/, "")}/`);
  const headers = new Headers({ "x-bomba-lab-secret": env.LAB_BROKER_SECRET });
  const contentType = request.headers.get("Content-Type");
  if (contentType) headers.set("Content-Type", contentType);
  let response;
  try {
    response = await fetchImpl(new Request(target, {
      method: request.method,
      headers,
      body,
      redirect: "manual",
    }));
  } catch {
    return route.target === "/decision"
      ? decisionError(502, "lab_broker_unavailable", requestId)
      : json(502, { ok: false, error: "lab_broker_unavailable" });
  }
  const responseHeaders = new Headers({
    "Content-Type": response.headers.get("Content-Type") || "application/json",
    "Cache-Control": "no-store",
  });
  const retryAfter = response.headers.get("Retry-After");
  if (retryAfter) responseHeaders.set("Retry-After", retryAfter);
  return new Response(response.body, { status: response.status, headers: responseHeaders });
}

export default {
  fetch(request, env) {
    return handleRequest(request, env);
  },
};

/**
 * Durable Object class registered on the Cloudflare Worker.
 * Kept exported so deploys satisfy existing DO bindings even when
 * continuous online matchmaking is not fully enabled in this build.
 */
export class OnlineMatchmakingRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch() {
    return json(503, { ok: false, error: "online_matchmaking_unavailable" });
  }
}

