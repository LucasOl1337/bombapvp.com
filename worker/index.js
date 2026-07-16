const LAB_ROUTES = new Map([
  ["/api/lab/health", { method: "GET", target: "/health" }],
  ["/api/lab/models", { method: "GET", target: "/models" }],
  ["/api/lab/decision", { method: "POST", target: "/decision" }],
]);

function json(status, body) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function handleRequest(request, env, fetchImpl = globalThis.fetch) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/lab/")) return env.ASSETS.fetch(request);

  const route = LAB_ROUTES.get(url.pathname);
  if (!route) return json(404, { ok: false, error: "not_found" });
  if (request.method !== route.method) return json(405, { ok: false, error: "method_not_allowed" });
  if (!env.LAB_BROKER_URL || !env.LAB_BROKER_SECRET) {
    return json(503, { ok: false, error: "lab_broker_not_configured" });
  }
  if (route.target === "/decision" && env.LAB_DECISION_RATE_LIMITER) {
    const key = request.headers.get("cf-connecting-ip") || "unknown";
    const { success } = await env.LAB_DECISION_RATE_LIMITER.limit({ key });
    if (!success) return json(429, { ok: false, error: "rate_limited" });
  }

  const target = new URL(route.target, `${String(env.LAB_BROKER_URL).replace(/\/+$/, "")}/`);
  const headers = new Headers({ "x-bomba-lab-secret": env.LAB_BROKER_SECRET });
  const contentType = request.headers.get("Content-Type");
  if (contentType) headers.set("Content-Type", contentType);
  const body = request.method === "POST" ? await request.arrayBuffer() : undefined;
  let response;
  try {
    response = await fetchImpl(new Request(target, {
      method: request.method,
      headers,
      body,
      redirect: "manual",
    }));
  } catch {
    return json(502, { ok: false, error: "lab_broker_unavailable" });
  }
  const responseHeaders = new Headers({
    "Content-Type": response.headers.get("Content-Type") || "application/json",
    "Cache-Control": "no-store",
  });
  return new Response(response.body, { status: response.status, headers: responseHeaders });
}

export default {
  fetch(request, env) {
    return handleRequest(request, env);
  },
};
