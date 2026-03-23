export const IA_REFINE_TIMEOUT_MS = 25_000;
export const IA_HEALTH_TIMEOUT_MS = 5_000;

/** Devolve base sem barra final (permite path prefix, ex. https://host/api). */
export function normalizeIaBaseUrl(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  try {
    const u = new URL(t);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    const path = u.pathname === "/" ? "" : u.pathname.replace(/\/$/, "");
    return `${u.origin}${path}`;
  } catch {
    return null;
  }
}

export function iaOriginPatternFromBaseUrl(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  try {
    const u = new URL(t);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return `${u.origin}/*`;
  } catch {
    return null;
  }
}

export type RefineIssueResponse = { title: string; body: string };

export async function fetchIaHealth(baseUrl: string, signal?: AbortSignal): Promise<boolean> {
  const b = normalizeIaBaseUrl(baseUrl);
  if (!b) return false;
  const r = await fetch(`${b}/health`, { method: "GET", signal });
  return r.ok;
}

export async function fetchIaRefine(params: {
  baseUrl: string;
  apiKey: string;
  whatHappened: string;
  technicalContext: unknown | undefined;
  locale?: string;
  signal?: AbortSignal;
}): Promise<RefineIssueResponse> {
  const b = normalizeIaBaseUrl(params.baseUrl);
  if (!b) throw new Error("ia_bad_base_url");
  const r = await fetch(`${b}/v1/refine-issue`, {
    method: "POST",
    signal: params.signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.apiKey.trim()}`,
    },
    body: JSON.stringify({
      whatHappened: params.whatHappened,
      technicalContext: params.technicalContext ?? undefined,
      locale: params.locale ?? "pt",
    }),
  });
  if (r.status === 401) throw new Error("ia_unauthorized");
  if (!r.ok) throw new Error(`ia_http_${r.status}`);
  const j = (await r.json()) as { title?: unknown; body?: unknown };
  const title = typeof j.title === "string" ? j.title.trim() : "";
  const body = typeof j.body === "string" ? j.body.trim() : "";
  if (!title || !body) throw new Error("ia_bad_response");
  return { title, body };
}
