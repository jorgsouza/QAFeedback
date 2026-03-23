/**
 * Lê o JQL do filtro guardado do quadro (Jira Software) e mapeia igualdades em campos
 * do create issue via createmeta (select/option com allowedValues).
 */

export type JiraBoardResolvedField = {
  fieldId: string;
  /** Valor em `fields[fieldId]` no POST /issue (objeto ou array para multiselect). */
  set: unknown;
};

export type ResolveJiraBoardFilterResult =
  | {
      ok: true;
      jql: string;
      fields: JiraBoardResolvedField[];
      /** Cláusulas do filtro que não foram mapeadas para campos de criação. */
      unresolved: string[];
    }
  | { ok: false; message: string };

/**
 * Jira Software Cloud devolve `filter.id` como string no GET board/{id}/configuration
 * (ver schema BoardConfigBean). Aceita também number para compatibilidade.
 */
export function coerceJiraBoardFilterId(raw: unknown): number | undefined {
  if (typeof raw === "number" && Number.isFinite(raw)) return Math.trunc(raw);
  if (typeof raw === "string") {
    const s = raw.trim();
    if (!s) return undefined;
    const n = Number.parseInt(s, 10);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

/** Remove ORDER BY para simplificar parsing. */
export function stripJqlOrderBy(jql: string): string {
  return jql.replace(/\s+ORDER\s+BY\b[\s\S]*$/i, "").trim();
}

/** Normaliza rótulos JQL tipo "Squad[dropdown]" → "squad". */
export function normalizeJqlFieldLabel(raw: string): string {
  return raw
    .replace(/\[[^\]]*]/g, "")
    .trim()
    .toLowerCase();
}

/** Extrai igualdades "campo" = "valor" e cf[ID] = "valor". */
export function parseJqlEqualityConstraints(jql: string): { left: string; right: string; kind: "quoted" | "cf" }[] {
  const s = stripJqlOrderBy(jql);
  const out: { left: string; right: string; kind: "quoted" | "cf" }[] = [];
  const reQuoted = /"([^"]+)"\s*=\s*"([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = reQuoted.exec(s)) !== null) {
    out.push({ left: m[1]!.trim(), right: m[2]!.trim(), kind: "quoted" });
  }
  const reCf = /cf\[(\d+)]\s*=\s*"([^"]*)"/gi;
  while ((m = reCf.exec(s)) !== null) {
    out.push({ left: `customfield_${m[1]}`, right: m[2]!.trim(), kind: "cf" });
  }
  return out;
}

/** Remove condições que não precisam de campo extra no create (project já vai em fields). */
export function filterConstraintsForCreateIssue(
  constraints: { left: string; right: string; kind: "quoted" | "cf" }[],
): { left: string; right: string; kind: "quoted" | "cf" }[] {
  return constraints.filter((c) => {
    if (c.kind === "cf") return true;
    const n = normalizeJqlFieldLabel(c.left);
    if (n === "project") return false;
    if (n === "issuetype") return false;
    return true;
  });
}

type CreateMetaFieldEntry = {
  name?: string;
  schema?: { type?: string; custom?: string };
  allowedValues?: { id?: string; value?: string }[];
};

function fieldNameMatchesJqlLabel(fieldName: string, jqlLeftRaw: string, jqlNorm: string): boolean {
  const fn = fieldName.trim().toLowerCase();
  if (fn === jqlNorm) return true;
  if (normalizeJqlFieldLabel(jqlLeftRaw) === jqlNorm && fn.length > 0) {
    return jqlNorm.includes(fn) || fn.includes(jqlNorm);
  }
  return false;
}

function isOptionLikeSchema(entry: CreateMetaFieldEntry): boolean {
  const t = entry.schema?.type;
  const c = entry.schema?.custom ?? "";
  if (t === "option") return true;
  if (t === "array" && c.includes("multiselect")) return true;
  return c.includes("select") || c.includes("radiobuttons");
}

function buildSetPayloadForOption(entry: CreateMetaFieldEntry, valueText: string): unknown | null {
  const av = entry.allowedValues ?? [];
  const exact = av.find((o) => o.value === valueText);
  const byPartial = av.find((o) => (o.value ?? "").toLowerCase() === valueText.toLowerCase());
  const pick = exact ?? byPartial;
  const t = entry.schema?.type;
  const c = entry.schema?.custom ?? "";
  if (t === "array" && c.includes("multiselect")) {
    const one = pick?.id ? { id: pick.id } : pick ? { value: pick.value ?? valueText } : { value: valueText };
    return [one];
  }
  if (pick?.id) return { id: pick.id };
  if (pick) return { value: pick.value ?? valueText };
  return null;
}

/**
 * Mapeia constraints a campos createmeta (issue type + project).
 */
export function matchConstraintsToCreateMeta(
  constraints: { left: string; right: string; kind: "quoted" | "cf" }[],
  issueFields: Record<string, CreateMetaFieldEntry>,
): { fields: JiraBoardResolvedField[]; unresolved: string[] } {
  const fields: JiraBoardResolvedField[] = [];
  const unresolved: string[] = [];
  const usedFieldIds = new Set<string>();

  for (const c of constraints) {
    if (c.kind === "cf") {
      const entry = issueFields[c.left];
      if (entry && isOptionLikeSchema(entry)) {
        const set = buildSetPayloadForOption(entry, c.right);
        if (set) {
          fields.push({ fieldId: c.left, set });
          usedFieldIds.add(c.left);
          continue;
        }
      }
      unresolved.push(`${c.left} = "${c.right}"`);
      continue;
    }

    const jqlNorm = normalizeJqlFieldLabel(c.left);
    let matched: JiraBoardResolvedField | null = null;

    for (const [fieldId, meta] of Object.entries(issueFields)) {
      if (usedFieldIds.has(fieldId)) continue;
      if (!meta?.name || !isOptionLikeSchema(meta)) continue;
      if (!fieldNameMatchesJqlLabel(meta.name, c.left, jqlNorm)) continue;
      const set = buildSetPayloadForOption(meta, c.right);
      if (set) {
        matched = { fieldId, set };
        break;
      }
    }

    if (matched) {
      fields.push(matched);
      usedFieldIds.add(matched.fieldId);
    } else {
      unresolved.push(`"${c.left}" = "${c.right}"`);
    }
  }

  return { fields, unresolved };
}

async function jiraErrorMessage(res: Response): Promise<string> {
  const t = await res.text();
  try {
    const j = JSON.parse(t) as { errorMessages?: string[] };
    const m = j.errorMessages?.[0];
    if (m) return `${res.status}: ${m}`;
  } catch {
    /* ignore */
  }
  return `${res.status}: ${t.slice(0, 200)}`;
}

function utf8ToBase64(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin);
}

function basicAuth(email: string, apiToken: string): string {
  return `Basic ${utf8ToBase64(`${email.trim()}:${apiToken.trim()}`)}`;
}

export async function resolveJiraBoardFieldsForIssueCreate(params: {
  baseUrl: string;
  email: string;
  apiToken: string;
  boardId: number;
  projectKey: string;
  issueTypeName: string;
}): Promise<ResolveJiraBoardFilterResult> {
  const { baseUrl, email, apiToken, boardId, projectKey, issueTypeName } = params;
  const headers = { Accept: "application/json", Authorization: basicAuth(email, apiToken) };

  const cfgRes = await fetch(`${baseUrl}/rest/agile/1.0/board/${boardId}/configuration`, { headers });
  if (!cfgRes.ok) {
    return { ok: false, message: await jiraErrorMessage(cfgRes) };
  }
  let filterId: number | undefined;
  try {
    const cfg = (await cfgRes.json()) as { filter?: { id?: unknown } };
    filterId = coerceJiraBoardFilterId(cfg.filter?.id);
  } catch {
    return { ok: false, message: "Resposta inválida da configuração do quadro." };
  }
  if (filterId == null) {
    return {
      ok: false,
      message:
        "Quadro sem filtro guardado: a API não devolveu filter.id (quadros team-managed ou respostas antigas podem não expor o id).",
    };
  }

  const filRes = await fetch(`${baseUrl}/rest/api/3/filter/${filterId}`, { headers });
  if (!filRes.ok) {
    return { ok: false, message: await jiraErrorMessage(filRes) };
  }
  let jql: string;
  try {
    const fil = (await filRes.json()) as { jql?: string };
    jql = (fil.jql ?? "").trim();
  } catch {
    return { ok: false, message: "Resposta inválida do filtro JQL." };
  }
  if (!jql) {
    return { ok: false, message: "Filtro do quadro sem JQL." };
  }

  const rawConstraints = parseJqlEqualityConstraints(jql);
  const constraints = filterConstraintsForCreateIssue(rawConstraints);
  if (constraints.length === 0) {
    return { ok: true, jql, fields: [], unresolved: [] };
  }

  const pk = encodeURIComponent(projectKey.trim());
  const it = encodeURIComponent(issueTypeName.trim() || "Bug");
  const metaUrl = `${baseUrl}/rest/api/3/issue/createmeta?projectKeys=${pk}&issuetypeNames=${it}&expand=projects.issuetypes.fields`;
  const metaRes = await fetch(metaUrl, { headers });
  if (!metaRes.ok) {
    return { ok: false, message: await jiraErrorMessage(metaRes) };
  }

  let issueFields: Record<string, CreateMetaFieldEntry>;
  try {
    const meta = (await metaRes.json()) as {
      projects?: { issuetypes?: { fields?: Record<string, CreateMetaFieldEntry> }[] }[];
    };
    const itypes = meta.projects?.[0]?.issuetypes;
    const first = itypes?.[0];
    issueFields = first?.fields ?? {};
  } catch {
    return { ok: false, message: "Resposta inválida do createmeta." };
  }

  const { fields, unresolved } = matchConstraintsToCreateMeta(constraints, issueFields);
  return { ok: true, jql, fields, unresolved };
}
