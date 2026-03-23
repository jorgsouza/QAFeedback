import type { CreateIssuePayload } from "./types";
import { buildIssueBody, buildIssueTitle } from "./issue-builder";

export type JiraError = { ok: false; message: string; status?: number };
export type JiraIssueResult = { ok: true; htmlUrl: string; key: string };

export function normalizeJiraSiteUrl(raw: string): string | null {
  const t = raw.trim().replace(/\/$/, "");
  if (!t) return null;
  try {
    const u = new URL(t);
    if (u.protocol !== "https:") return null;
    if (!u.hostname.endsWith(".atlassian.net")) return null;
    return `${u.origin}`;
  } catch {
    return null;
  }
}

function utf8ToBase64(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin);
}

function basicAuthHeader(email: string, apiToken: string): string {
  const raw = `${email.trim()}:${apiToken.trim()}`;
  return `Basic ${utf8ToBase64(raw)}`;
}

/** Descrição em ADF mínimo (parágrafos por linha em branco). */
export function plainTextToAdf(text: string): { type: "doc"; version: 1; content: unknown[] } {
  const chunks = text.trim() ? text.split(/\n{2,}/) : [""];
  const content = chunks.map((chunk) => ({
    type: "paragraph",
    content: [{ type: "text", text: chunk.replace(/\n/g, " ").trim() || " " }],
  }));
  return { type: "doc", version: 1, content };
}

export async function testJiraConnection(params: {
  siteUrl: string;
  email: string;
  apiToken: string;
}): Promise<{ ok: true; displayName: string } | JiraError> {
  const base = normalizeJiraSiteUrl(params.siteUrl);
  if (!base) return { ok: false, message: "URL do Jira inválida (use https://*.atlassian.net)." };
  if (!params.email.trim() || !params.apiToken.trim()) {
    return { ok: false, message: "Email e API token do Jira são obrigatórios." };
  }

  const res = await fetch(`${base}/rest/api/3/myself`, {
    headers: {
      Accept: "application/json",
      Authorization: basicAuthHeader(params.email, params.apiToken),
    },
  });
  if (!res.ok) {
    return {
      ok: false,
      message: await jiraErrorMessage(res),
      status: res.status,
    };
  }
  try {
    const j = (await res.json()) as { displayName?: string };
    return { ok: true, displayName: j.displayName ?? "OK" };
  } catch {
    return { ok: false, message: "Resposta inválida do Jira." };
  }
}

async function jiraErrorMessage(res: Response): Promise<string> {
  const t = await res.text();
  try {
    const j = JSON.parse(t) as { errorMessages?: string[]; errors?: Record<string, string> };
    const m = j.errorMessages?.[0] ?? Object.values(j.errors ?? {})[0];
    if (m) return `${res.status}: ${m}`;
  } catch {
    /* ignore */
  }
  return `${res.status}: ${t.slice(0, 200)}`;
}

export async function createJiraIssue(params: {
  siteUrl: string;
  email: string;
  apiToken: string;
  projectKey: string;
  issueTypeName: string;
  payload: CreateIssuePayload;
  motivoAbertura: string;
  /** ex. customfield_12345 — se vazio, motivo só entra na descrição */
  motivoCustomFieldId?: string;
}): Promise<JiraIssueResult | JiraError> {
  const base = normalizeJiraSiteUrl(params.siteUrl);
  if (!base) return { ok: false, message: "URL do Jira inválida." };
  const projectKey = params.projectKey.trim().toUpperCase();
  if (!projectKey) return { ok: false, message: "Chave do projeto Jira em falta." };

  const summary = buildIssueTitle(params.payload);
  if (!summary.trim()) return { ok: false, message: "Título em falta." };
  if (!params.payload.whatHappened?.trim()) return { ok: false, message: '"O que aconteceu" é obrigatório.' };

  let bodyText = buildIssueBody(params.payload);
  const motivoLine = `**Motivo da abertura do Bug/Sub-Bug:** ${params.motivoAbertura}`;
  if (!params.motivoCustomFieldId?.trim()) {
    bodyText = `${motivoLine}\n\n${bodyText}`;
  }

  const fields: Record<string, unknown> = {
    project: { key: projectKey },
    summary: summary.slice(0, 255),
    description: plainTextToAdf(bodyText),
    issuetype: { name: params.issueTypeName.trim() || "Bug" },
  };

  const cf = params.motivoCustomFieldId?.trim();
  if (cf) {
    fields[cf] = { value: params.motivoAbertura };
  }

  const res = await fetch(`${base}/rest/api/3/issue`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: basicAuthHeader(params.email, params.apiToken),
    },
    body: JSON.stringify({ fields }),
  });

  if (!res.ok) {
    return { ok: false, message: await jiraErrorMessage(res), status: res.status };
  }

  try {
    const j = (await res.json()) as { key?: string; id?: string };
    if (!j.key) return { ok: false, message: "Jira não devolveu a chave da issue." };
    const htmlUrl = `${base}/browse/${encodeURIComponent(j.key)}`;
    return { ok: true, htmlUrl, key: j.key };
  } catch {
    return { ok: false, message: "Não foi possível interpretar a resposta do Jira." };
  }
}
