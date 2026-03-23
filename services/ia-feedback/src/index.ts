import { config as loadEnv } from "dotenv";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { extractClientApiKey, safeEqualString } from "./auth.js";
import { refineWithGemini } from "./gemini.js";
import { rootEnvPath } from "./paths.js";
import { sanitizeWhatHappened, serializeTechnicalContext } from "./sanitize.js";

loadEnv({ path: rootEnvPath() });

const PORT = Number(process.env.PORT) || 8787;
const GEMINI_API_KEY = (process.env.GEMINI_API_KEY ?? "").trim();
const GEMINI_MODEL = (process.env.GEMINI_MODEL ?? "gemini-2.0-flash").trim();
const IA_FEEDBACK_API_KEY = (process.env.IA_FEEDBACK_API_KEY ?? "").trim();

function setCors(res: ServerResponse): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Api-Key");
  res.setHeader("Access-Control-Max-Age", "86400");
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  setCors(res);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function normHeaders(req: IncomingMessage): Record<string, string | string[] | undefined> {
  const h = req.headers as Record<string, string | string[] | undefined>;
  const out: Record<string, string | string[] | undefined> = {};
  for (const [k, v] of Object.entries(h)) {
    out[k.toLowerCase()] = v;
  }
  return out;
}

async function readJsonBody(req: IncomingMessage, maxBytes = 512_000): Promise<unknown> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const b = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += b.length;
    if (total > maxBytes) throw new Error("payload_too_large");
    chunks.push(b);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw.trim()) return null;
  return JSON.parse(raw) as unknown;
}

function healthPayload(): { ok: boolean; geminiConfigured: boolean; clientAuthConfigured: boolean } {
  return {
    ok: Boolean(GEMINI_API_KEY && IA_FEEDBACK_API_KEY),
    geminiConfigured: Boolean(GEMINI_API_KEY),
    clientAuthConfigured: Boolean(IA_FEEDBACK_API_KEY),
  };
}

function handleHealth(res: ServerResponse): void {
  const p = healthPayload();
  const status = p.ok ? 200 : 503;
  sendJson(res, status, { ...p, service: "ia-feedback" });
}

function assertClientKey(req: IncomingMessage): boolean {
  if (!IA_FEEDBACK_API_KEY) return false;
  const key = extractClientApiKey(normHeaders(req));
  if (!key) return false;
  return safeEqualString(key, IA_FEEDBACK_API_KEY);
}

async function handleRefine(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!GEMINI_API_KEY) {
    sendJson(res, 503, { error: "gemini_not_configured" });
    return;
  }
  if (!IA_FEEDBACK_API_KEY) {
    sendJson(res, 503, { error: "client_auth_not_configured" });
    return;
  }
  if (!assertClientKey(req)) {
    sendJson(res, 401, { error: "unauthorized" });
    return;
  }

  let body: unknown;
  try {
    body = await readJsonBody(req);
  } catch {
    sendJson(res, 400, { error: "invalid_json_or_too_large" });
    return;
  }

  if (!body || typeof body !== "object") {
    sendJson(res, 400, { error: "invalid_body" });
    return;
  }

  const o = body as Record<string, unknown>;
  const what = typeof o.whatHappened === "string" ? o.whatHappened.trim() : "";
  if (!what) {
    sendJson(res, 400, { error: "whatHappened_required" });
    return;
  }

  const locale = typeof o.locale === "string" ? o.locale : undefined;
  const technicalContext = o.technicalContext;
  const whatSafe = sanitizeWhatHappened(what);
  const ctxSafe = serializeTechnicalContext(technicalContext);

  try {
    const out = await refineWithGemini({
      geminiApiKey: GEMINI_API_KEY,
      model: GEMINI_MODEL,
      whatHappened: whatSafe,
      technicalContextText: ctxSafe,
      locale,
    });
    sendJson(res, 200, out);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    if (msg === "gemini_invalid_json" || msg === "gemini_invalid_shape" || msg === "gemini_missing_fields") {
      sendJson(res, 502, { error: "upstream_model_parse" });
      return;
    }
    sendJson(res, 502, { error: "upstream_model", detail: msg });
  }
}

const server = createServer((req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  const url = req.url ?? "/";
  const path = url.split("?")[0] ?? "/";

  if (req.method === "GET" && (path === "/health" || path === "/v1/health")) {
    handleHealth(res);
    return;
  }

  if (req.method === "POST" && path === "/v1/refine-issue") {
    void handleRefine(req, res);
    return;
  }

  sendJson(res, 404, { error: "not_found" });
});

server.listen(PORT, "127.0.0.1", () => {
  // eslint-disable-next-line no-console
  console.log(`[ia-feedback] http://127.0.0.1:${PORT}  health=/health refine=POST /v1/refine-issue`);
});
