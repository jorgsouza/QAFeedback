import type {
  SensitiveFindingSeverityV1,
  SensitiveFindingSourceV1,
  SensitiveFindingV1,
  TechnicalContextPayload,
} from "./types";
import { truncate } from "./sanitizer";

const JWT_LIKE =
  /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/;
const BEARER = /\bBearer\s+([A-Za-z0-9._~+/=-]{8,})\b/i;
const SK_LIVE = /\bsk-(live|test)-[A-Za-z0-9]{10,}\b/i;
const GOOGLE_API = /\bAIza[0-9A-Za-z_-]{10,}\b/;
const SLACK_OR_SIMILAR = /\bxox[baprs]-[0-9A-Za-z-]{10,}\b/;
const GENERIC_LONG_SECRET = /\b(?:api[_-]?key|access[_-]?token|auth[_-]?token)\s*[:=]\s*['"]?([A-Za-z0-9._+/=-]{16,})\b/i;
const SET_COOKIE = /set-cookie\s*:/i;
const SESSION_COOKIE_PAIR =
  /\b(JSESSIONID|SESSIONID|PHPSESSID|connect\.sid|ASP\.NET_SessionId)\s*=\s*[^;\s]{3,}/i;
const EMAIL = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/;
const CPF = /\b\d{3}[.\s]?\d{3}[.\s]?\d{3}[-.\s]?\d{2}\b/;
const HTTP_URL = /\bhttp:\/\/[^\s"'<>)\]]+/i;
const SQL_ERROR = /syntax error|sql syntax|sqlite(_)?error|ORA-\d+|postgresql|mysql.*error|mssql/i;
const JSON_PARSE = /unexpected token.*json|JSON\.parse|is not valid json/i;
const INJECTION_WEAK = /Script error\.|refused to execute|eval\(|innerHTML/i;

function severityRank(s: SensitiveFindingSeverityV1): number {
  switch (s) {
    case "high":
      return 4;
    case "medium":
      return 3;
    case "low":
      return 2;
    default:
      return 1;
  }
}

export function fingerprintForSnippet(raw: string): string {
  const s = raw.replace(/\s+/g, " ").trim().slice(0, 160);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return `fp:${(h >>> 0).toString(16)}`;
}

/** Mascara segredos longos; texto curto só trunca. */
export function maskSensitivePreview(raw: string, max = 48): string {
  const t = raw.replace(/\s+/g, " ").trim();
  if (t.length <= 16) return truncate(t, max);
  return `${truncate(t.slice(0, 10), 12)}…${t.length > 20 ? truncate(t.slice(-4), 6) : ""}`;
}

type FindingDraft = Omit<SensitiveFindingV1, "evidenceFingerprint" | "samplePreview"> & {
  rawSnippet: string;
};

export function detectSensitiveFindings(ctx: TechnicalContextPayload): SensitiveFindingV1[] {
  const drafts: FindingDraft[] = [];
  const pageHttps = ctx.page.url.trim().toLowerCase().startsWith("https:");

  const push = (d: FindingDraft) => drafts.push(d);

  const scanText = (
    text: string,
    source: SensitiveFindingSourceV1,
    location: string,
  ): void => {
    const t = text;
    if (!t || t.length < 4) return;

    let m: RegExpMatchArray | null;
    if (JWT_LIKE.test(t)) {
      m = t.match(JWT_LIKE);
      if (m) {
        push({
          kind: "secret_or_token",
          severity: "high",
          source,
          location,
          summary: "Possível JWT ou token com formato semelhante em texto capturado.",
          rawSnippet: m[0],
          actionSuggested: "Confirmar se o valor é exposto a utilizadores e se deve ser revogado ou reduzido no cliente.",
        });
      }
    }
    m = t.match(BEARER);
    if (m?.[1]) {
      push({
        kind: "secret_or_token",
        severity: "high",
        source,
        location,
        summary: "Possível valor após “Bearer” (token de autorização).",
        rawSnippet: m[0],
        actionSuggested: "Evitar ecoar tokens em logs/console; rever headers e armazenamento no cliente.",
      });
    }
    if (SK_LIVE.test(t) || GOOGLE_API.test(t) || SLACK_OR_SIMILAR.test(t)) {
      m = t.match(SK_LIVE) || t.match(GOOGLE_API) || t.match(SLACK_OR_SIMILAR);
      if (m) {
        push({
          kind: "secret_or_token",
          severity: "high",
          source,
          location,
          summary: "Possível chave ou token com prefixo típico (API/sk).",
          rawSnippet: m[0],
        });
      }
    }
    m = t.match(GENERIC_LONG_SECRET);
    if (m?.[1]) {
      push({
        kind: "secret_or_token",
        severity: "medium",
        source,
        location,
        summary: "Possível segredo ou token em par chave=valor no texto.",
        rawSnippet: m[0].slice(0, 80),
      });
    }
    if (SET_COOKIE.test(t)) {
      push({
        kind: "session_cookie",
        severity: "medium",
        source,
        location,
        summary: "Menção a Set-Cookie no texto capturado (pode indicar cookie visível em resposta/log).",
        rawSnippet: truncate(t, 100),
        actionSuggested: "Rever flags Secure/HttpOnly/SameSite em HTTPS.",
      });
    } else if (SESSION_COOKIE_PAIR.test(t)) {
      m = t.match(SESSION_COOKIE_PAIR);
      if (m) {
        push({
          kind: "session_cookie",
          severity: "low",
          source,
          location,
          summary: "Possível par nome=valor de cookie de sessão no texto.",
          rawSnippet: truncate(m[0], 80),
        });
      }
    }
    m = t.match(EMAIL);
    if (m) {
      push({
        kind: "pii",
        severity: "low",
        source,
        location,
        summary: "Possível endereço de e-mail (PII) no texto capturado.",
        rawSnippet: m[0],
        actionSuggested: "Confirmar se o contexto exige mascarar ou minimizar dados pessoais.",
      });
    }
    m = t.match(CPF);
    if (m) {
      push({
        kind: "pii",
        severity: "medium",
        source,
        location,
        summary: "Possível identificador no formato de CPF (PII) — validar manualmente.",
        rawSnippet: m[0],
      });
    }
    if (pageHttps && HTTP_URL.test(t) && !t.includes("https://")) {
      m = t.match(HTTP_URL);
      if (m && !m[0].includes("localhost") && !m[0].includes("127.0.0.1")) {
        push({
          kind: "mixed_content",
          severity: "low",
          source,
          location,
          summary: "Em página HTTPS, aparece URL http:// no texto — possível conteúdo misto (best-effort).",
          rawSnippet: truncate(m[0], 80),
        });
      }
    }
    if (SQL_ERROR.test(t) || JSON_PARSE.test(t)) {
      push({
        kind: "injection_hint",
        severity: "info",
        source,
        location,
        summary:
          "Indício fraco: mensagem pode estar ligada a SQL/JSON (rever manualmente; não implica injeção confirmada).",
        rawSnippet: truncate(t, 100),
        confidence: "low",
      });
    } else if (INJECTION_WEAK.test(t) && t.length < 500) {
      push({
        kind: "injection_hint",
        severity: "info",
        source,
        location,
        summary: "Indício fraco no texto (padrão genérico); revisar manualmente.",
        rawSnippet: truncate(t, 120),
        confidence: "low",
      });
    }
  };

  for (const e of ctx.console) {
    scanText(e.message, "console", `console (${e.level})`);
  }
  for (const err of ctx.runtimeErrors ?? []) {
    scanText(err.message, "runtime", "runtime · mensagem");
    if (err.stack) scanText(err.stack.slice(0, 2000), "runtime", "runtime · stack (trecho)");
  }
  for (const row of ctx.networkRequestSummaries ?? []) {
    const loc = `${row.method} ${row.url}`;
    scanText(`${row.url} ${row.statusText ?? ""}`, "network", loc);
    if (row.requestId) scanText(row.requestId, "network", `${loc} · requestId`);
    if (row.correlationId) scanText(row.correlationId, "network", `${loc} · correlationId`);
  }
  for (const f of ctx.failedRequests) {
    scanText(`${f.url} ${f.message}`, "network", `${f.method} ${f.url}`);
  }
  if (ctx.element?.safeAttributes) {
    scanText(ctx.element.safeAttributes, "dom", "elemento · atributos seguros");
  }
  const hint = ctx.targetDomHint;
  if (hint) {
    const bits = [hint.ariaLabel, hint.textHint, hint.selectorHint].filter(Boolean) as string[];
    for (const b of bits) scanText(b, "dom", "alvo · hint DOM");
  }

  const seen = new Set<string>();
  const out: SensitiveFindingV1[] = [];
  for (const d of drafts) {
    const evidenceFingerprint = fingerprintForSnippet(d.rawSnippet);
    const key = `${d.kind}:${d.source}:${evidenceFingerprint}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const { rawSnippet, ...rest } = d;
    out.push({
      ...rest,
      evidenceFingerprint,
      samplePreview: maskSensitivePreview(rawSnippet),
    });
  }
  out.sort((a, b) => severityRank(b.severity) - severityRank(a.severity));
  return out;
}
