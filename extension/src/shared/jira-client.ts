import type { CreateIssuePayload, JiraImageAttachmentPayload } from "./types";
import { buildIssueBody, buildIssueTitle } from "./issue-builder";
import { resolveJiraBoardFieldsForIssueCreate } from "./jira-board-filter-resolve";

export type JiraError = { ok: false; message: string; status?: number };
export type JiraIssueResult = { ok: true; htmlUrl: string; key: string; warning?: string };

/** Extrai o ID do quadro Software de URLs como …/boards/451/backlog */
export function parseJiraSoftwareBoardId(raw: string): number | null {
  const m = raw.match(/\/boards\/(\d+)(?:\/|$|\?|#)/i);
  if (!m?.[1]) return null;
  const n = Number.parseInt(m[1], 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** ID do quadro: valor guardado nas opções tem prioridade sobre extrair do URL. */
export function resolveJiraSoftwareBoardId(siteUrl: string, savedBoardId?: string): number | null {
  const t = savedBoardId?.trim();
  if (t) {
    const n = Number.parseInt(t, 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return parseJiraSoftwareBoardId(siteUrl);
}

/**
 * URL do quadro no browser (trecho /jira/software/…/boards/N), a partir do que o utilizador colou nas opções.
 * Com `selectedIssueKey`, adiciona `?selectedIssue=KEY` para o Jira abrir o cartão no contexto do quadro.
 */
export function jiraBoardWebUrlFromUserInput(raw: string, selectedIssueKey?: string): string | null {
  const base = normalizeJiraSiteUrl(raw);
  if (!base) return null;
  try {
    const u = new URL(raw.trim());
    const path = u.pathname.replace(/\/$/, "");
    const bm = path.match(/^(.+\/boards\/\d+)/i);
    if (!bm?.[1] || !bm[1].toLowerCase().includes("/jira/software/")) return null;
    let out = `${base}${bm[1]}`;
    const key = selectedIssueKey?.trim();
    if (key) out += `?selectedIssue=${encodeURIComponent(key)}`;
    return out;
  } catch {
    return null;
  }
}

export function normalizeJiraSiteUrl(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  /** Aceita colar o link do backlog/board: fica só https://<site>.atlassian.net */
  const pasted = t.match(/^(https):\/\/([a-z0-9-]+\.atlassian\.net)(?:\/|$)/i);
  if (pasted) {
    return `https://${pasted[2]!.toLowerCase()}`;
  }
  try {
    const u = new URL(t.replace(/\/$/, ""));
    if (u.protocol !== "https:") return null;
    if (!u.hostname.endsWith(".atlassian.net")) return null;
    return `${u.origin}`;
  } catch {
    return null;
  }
}

/**
 * Heurística para Jira Cloud: domínio do email → https://<primeiro-label>.atlassian.net
 * (ex. @reclameaqui.com.br → reclameaqui.atlassian.net). Não funciona para Gmail/Hotmail/etc.
 */
export function inferJiraCloudSiteUrlFromEmail(email: string): string | null {
  const m = email.trim().toLowerCase().match(/@([^@\s]+)$/);
  if (!m?.[1]) return null;
  const host = m[1];
  const first = host.split(".")[0];
  if (!first || !/^[a-z0-9-]+$/.test(first)) return null;
  const publicRoots =
    /^(gmail|googlemail|hotmail|outlook|live|yahoo|ymail|icloud|me|protonmail|proton|pm)\./;
  if (publicRoots.test(host)) return null;
  return `https://${first}.atlassian.net`;
}

/** URL normalizada nas opções ou inferida pelo email (Cloud). */
export function resolveJiraCloudBaseUrl(siteUrl: string, email: string): string | null {
  return normalizeJiraSiteUrl(siteUrl) ?? inferJiraCloudSiteUrlFromEmail(email);
}

export type JiraSoftwareBoardDetails = {
  id: number;
  name: string;
  projectKey: string;
};

/** GET /rest/agile/1.0/board/{id} — chave do projeto no backlog deste quadro. */
export async function fetchJiraSoftwareBoard(params: {
  siteUrl: string;
  email: string;
  apiToken: string;
  boardId: number;
}): Promise<{ ok: true; board: JiraSoftwareBoardDetails } | JiraError> {
  const base = resolveJiraCloudBaseUrl(params.siteUrl, params.email);
  if (!base) {
    return {
      ok: false,
      message:
        "URL do Jira em falta: cole https://…atlassian.net em “Site (opcional)” ou use email @empresa… (não Gmail).",
    };
  }
  if (!params.email.trim() || !params.apiToken.trim()) {
    return { ok: false, message: "Email e API token do Jira são obrigatórios." };
  }

  const res = await fetch(`${base}/rest/agile/1.0/board/${params.boardId}`, {
    headers: {
      Accept: "application/json",
      Authorization: basicAuthHeader(params.email, params.apiToken),
    },
  });
  if (!res.ok) {
    return { ok: false, message: await jiraErrorMessage(res), status: res.status };
  }
  try {
    const j = (await res.json()) as {
      id?: number;
      name?: string;
      location?: { projectKey?: string };
    };
    const id = j.id;
    const pk = j.location?.projectKey?.trim();
    const name = typeof j.name === "string" ? j.name : "";
    if (id == null || !pk) {
      return { ok: false, message: "Resposta do quadro sem id ou projectKey." };
    }
    return { ok: true, board: { id, name, projectKey: pk } };
  } catch {
    return { ok: false, message: "Resposta inválida do quadro Jira." };
  }
}

/**
 * Link do quadro quando o ID e a chave do projeto vêm das opções (padrão Cloud team-managed: /c/projects/…).
 */
function jiraBoardWebUrlFromSavedBoard(
  base: string,
  projectKey: string,
  boardIdRaw: string | undefined,
  issueKey: string,
): string | null {
  const bid = boardIdRaw?.trim();
  const pk = projectKey?.trim();
  if (!bid || !pk) return null;
  const n = Number.parseInt(bid, 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  const keyEnc = encodeURIComponent(pk.toUpperCase());
  let url = `${base}/jira/software/c/projects/${keyEnc}/boards/${n}`;
  const ik = issueKey?.trim();
  if (ik) url += `?selectedIssue=${encodeURIComponent(ik)}`;
  return url;
}

/** Link “Abrir no quadro”: guardado nas opções ou URL colado com /boards/N. */
export function jiraResolvedBoardWebUrl(params: {
  siteUrl: string;
  projectKey: string;
  jiraSoftwareBoardId?: string;
  selectedIssueKey: string;
}): string | null {
  const base = normalizeJiraSiteUrl(params.siteUrl);
  if (!base) return null;
  const fromSaved = jiraBoardWebUrlFromSavedBoard(
    base,
    params.projectKey,
    params.jiraSoftwareBoardId,
    params.selectedIssueKey,
  );
  if (fromSaved) return fromSaved;
  return jiraBoardWebUrlFromUserInput(params.siteUrl, params.selectedIssueKey);
}

export type JiraBoardSummary = { id: number; name: string; type: string };

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
/** Converte texto plano em ADF (obrigatório para `description` em POST /rest/api/3/issue). */
export function plainTextToAdf(text: string): { type: "doc"; version: 1; content: unknown[] } {
  const trimmed = text.trim();
  if (!trimmed) {
    return { type: "doc", version: 1, content: [{ type: "paragraph", content: [{ type: "text", text: " " }] }] };
  }
  const chunks = trimmed.split(/\n{2,}/);
  const content = chunks.map((chunk) => adfParagraphFromChunk(chunk.trim()));
  return { type: "doc", version: 1, content };
}

function adfParagraphFromChunk(chunk: string): { type: "paragraph"; content: unknown[] } {
  if (!chunk) {
    return { type: "paragraph", content: [{ type: "text", text: " " }] };
  }
  const lines = chunk.split("\n");
  const inner: unknown[] = [];
  for (let i = 0; i < lines.length; i++) {
    const lineText = lines[i]!.trim() || " ";
    if (i > 0) inner.push({ type: "hardBreak" });
    inner.push({ type: "text", text: lineText });
  }
  return { type: "paragraph", content: inner };
}

export async function testJiraConnection(params: {
  siteUrl: string;
  email: string;
  apiToken: string;
}): Promise<{ ok: true; displayName: string; baseUrl: string } | JiraError> {
  const base = resolveJiraCloudBaseUrl(params.siteUrl, params.email);
  if (!base) {
    return {
      ok: false,
      message:
        "Site Jira em falta: cole https://…atlassian.net ou use email @empresa (inferimos empresa.atlassian.net; não Gmail/Hotmail).",
    };
  }
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
    return { ok: true, displayName: j.displayName ?? "OK", baseUrl: base };
  } catch {
    return { ok: false, message: "Resposta inválida do Jira." };
  }
}

/** Quadros Software (GET /rest/agile/1.0/board). Sem projectKey, lista quadros visíveis na conta. */
export async function listJiraBoards(params: {
  siteUrl: string;
  email: string;
  apiToken: string;
  /** Se vazio, não filtra por projeto (todos os quadros a que o token tem acesso). */
  projectKey: string;
}): Promise<{ ok: true; boards: JiraBoardSummary[] } | JiraError> {
  const base = resolveJiraCloudBaseUrl(params.siteUrl, params.email);
  if (!base) {
    return {
      ok: false,
      message:
        "Site Jira em falta: cole https://…atlassian.net ou use email @empresa (não Gmail/Hotmail).",
    };
  }
  const pk = params.projectKey.trim();
  if (!params.email.trim() || !params.apiToken.trim()) {
    return { ok: false, message: "Email e API token do Jira são obrigatórios." };
  }

  const boards: JiraBoardSummary[] = [];
  let startAt = 0;
  const maxResults = 50;
  for (let guard = 0; guard < 100; guard++) {
    const url = new URL(`${base}/rest/agile/1.0/board`);
    if (pk) url.searchParams.set("projectKeyOrId", pk);
    url.searchParams.set("startAt", String(startAt));
    url.searchParams.set("maxResults", String(maxResults));

    const res = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        Authorization: basicAuthHeader(params.email, params.apiToken),
      },
    });
    if (!res.ok) {
      return { ok: false, message: await jiraErrorMessage(res), status: res.status };
    }

    const j = (await res.json()) as {
      values?: { id?: number; name?: string; type?: string }[];
      isLast?: boolean;
    };
    const page = j.values ?? [];
    for (const v of page) {
      if (v.id != null && typeof v.name === "string" && v.name.length > 0) {
        boards.push({ id: v.id, name: v.name, type: v.type ?? "?" });
      }
    }
    if (j.isLast === true || page.length === 0) break;
    startAt += page.length;
  }

  return { ok: true, boards };
}

function jiraErrorMessageFromText(status: number, t: string): string {
  try {
    const j = JSON.parse(t) as { errorMessages?: string[]; errors?: Record<string, string> };
    const m = j.errorMessages?.[0] ?? Object.values(j.errors ?? {})[0];
    if (m) return `${status}: ${m}`;
  } catch {
    /* ignore */
  }
  return `${status}: ${t.slice(0, 200)}`;
}

async function jiraErrorMessage(res: Response): Promise<string> {
  const t = await res.text();
  return jiraErrorMessageFromText(res.status, t);
}

type AgileMove207 = { entries?: { errors?: string[]; status?: number; issueKey?: string }[] };

function agileMoveSucceeded(status: number, bodyText: string): { ok: true } | { ok: false; message: string } {
  if (status === 204) return { ok: true };
  if (status === 207) {
    try {
      const j = JSON.parse(bodyText) as AgileMove207;
      const failed = j.entries?.some(
        (e) => (e.errors?.length ?? 0) > 0 || (e.status != null && e.status >= 400),
      );
      if (failed) {
        const msg = j.entries
          ?.flatMap((e) => e.errors ?? [])
          .filter(Boolean)
          .join("; ");
        return { ok: false, message: msg || bodyText.slice(0, 280) };
      }
    } catch {
      /* treat as ok */
    }
    return { ok: true };
  }
  if (status >= 200 && status < 300) return { ok: true };
  return { ok: false, message: `${status}: ${bodyText.slice(0, 200)}` };
}

/** Associa a issue ao quadro Software (passa a contar para o filtro do board). Ver JSW REST “Move issues to board”. */
async function moveIssueOntoJiraSoftwareBoard(params: {
  base: string;
  email: string;
  apiToken: string;
  boardId: number;
  /** ID numérico da issue (preferido) ou chave REC-xxx — ver JSW REST */
  issueRef: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const res = await fetch(`${params.base}/rest/agile/1.0/board/${params.boardId}/issue`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: basicAuthHeader(params.email, params.apiToken),
    },
    body: JSON.stringify({ issues: [params.issueRef] }),
  });
  const text = await res.text();
  if (!res.ok && res.status !== 207) {
    return { ok: false, message: jiraErrorMessageFromText(res.status, text) };
  }
  return agileMoveSucceeded(res.status, text);
}

/** Garante backlog do quadro (tira de sprint ativo/futuro em boards Scrum). Ver JSW REST “Move issues to backlog for board”. */
async function moveIssueToJiraBoardBacklog(params: {
  base: string;
  email: string;
  apiToken: string;
  boardId: number;
  issueRef: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const res = await fetch(`${params.base}/rest/agile/1.0/backlog/${params.boardId}/issue`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: basicAuthHeader(params.email, params.apiToken),
    },
    body: JSON.stringify({ issues: [params.issueRef] }),
  });
  const text = await res.text();
  if (!res.ok && res.status !== 207) {
    return { ok: false, message: jiraErrorMessageFromText(res.status, text) };
  }
  return agileMoveSucceeded(res.status, text);
}

/** POST /rest/agile/1.0/backlog/issue — tira a issue de sprints (estado backlog global). */
async function moveIssueToGlobalBacklog(params: {
  base: string;
  email: string;
  apiToken: string;
  issueRef: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const res = await fetch(`${params.base}/rest/agile/1.0/backlog/issue`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: basicAuthHeader(params.email, params.apiToken),
    },
    body: JSON.stringify({ issues: [params.issueRef] }),
  });
  const text = await res.text();
  if (!res.ok && res.status !== 207) {
    return { ok: false, message: jiraErrorMessageFromText(res.status, text) };
  }
  return agileMoveSucceeded(res.status, text);
}

async function getBoardRankCustomFieldId(params: {
  base: string;
  email: string;
  apiToken: string;
  boardId: number;
}): Promise<number | null> {
  const res = await fetch(`${params.base}/rest/agile/1.0/board/${params.boardId}/configuration`, {
    headers: {
      Accept: "application/json",
      Authorization: basicAuthHeader(params.email, params.apiToken),
    },
  });
  if (!res.ok) return null;
  try {
    const j = (await res.json()) as { ranking?: { rankCustomFieldId?: number } };
    const id = j.ranking?.rankCustomFieldId;
    return typeof id === "number" && Number.isFinite(id) ? id : null;
  } catch {
    return null;
  }
}

/** Última issue na primeira página do backlog do quadro (âncora para ranking). */
async function getLastBacklogIssueKey(params: {
  base: string;
  email: string;
  apiToken: string;
  boardId: number;
}): Promise<string | null> {
  const url = new URL(`${params.base}/rest/agile/1.0/board/${params.boardId}/backlog`);
  url.searchParams.set("maxResults", "50");
  url.searchParams.set("startAt", "0");
  const res = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      Authorization: basicAuthHeader(params.email, params.apiToken),
    },
  });
  if (!res.ok) return null;
  try {
    const j = (await res.json()) as { issues?: { key?: string }[] };
    const keys = (j.issues ?? []).map((i) => i.key).filter((k): k is string => Boolean(k));
    return keys.length ? keys[keys.length - 1]! : null;
  } catch {
    return null;
  }
}

async function rankAgileIssues(params: {
  base: string;
  email: string;
  apiToken: string;
  issueKeys: string[];
  rankAfterIssue: string;
  rankCustomFieldId?: number;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const body: Record<string, unknown> = {
    issues: params.issueKeys,
    rankAfterIssue: params.rankAfterIssue,
  };
  if (params.rankCustomFieldId != null) {
    body.rankCustomFieldId = params.rankCustomFieldId;
  }
  const res = await fetch(`${params.base}/rest/agile/1.0/issue/rank`, {
    method: "PUT",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: basicAuthHeader(params.email, params.apiToken),
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok && res.status !== 207) {
    return { ok: false, message: jiraErrorMessageFromText(res.status, text) };
  }
  return agileMoveSucceeded(res.status, text);
}

/**
 * Resposta 400 típica em quadros Scrum: não se pode usar POST /board/{id}/issue;
 * usa-se backlog global + backlog do quadro e, se preciso, PUT /issue/rank.
 */
export function isJiraSprintBoardMoveError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    (m.includes("sprint") && m.includes("use sprint")) ||
    (m.includes("use sprint") && m.includes("sprintid"))
  );
}

/**
 * Associa a issue ao quadro: Kanban / Scrum sem o bloqueio de sprints usa board+backlog;
 * quadros Scrum com sprints falham no primeiro passo — aplica-se sequência alternativa.
 */
async function associateIssueWithBoardBacklog(params: {
  base: string;
  email: string;
  apiToken: string;
  boardId: number;
  issueRef: string;
  issueKey: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const onto = await moveIssueOntoJiraSoftwareBoard({
    base: params.base,
    email: params.email,
    apiToken: params.apiToken,
    boardId: params.boardId,
    issueRef: params.issueRef,
  });

  if (onto.ok) {
    return moveIssueToJiraBoardBacklog({
      base: params.base,
      email: params.email,
      apiToken: params.apiToken,
      boardId: params.boardId,
      issueRef: params.issueRef,
    });
  }

  if (!isJiraSprintBoardMoveError(onto.message)) {
    return onto;
  }

  const globalBl = await moveIssueToGlobalBacklog({
    base: params.base,
    email: params.email,
    apiToken: params.apiToken,
    issueRef: params.issueRef,
  });
  if (!globalBl.ok) {
    return {
      ok: false,
      message: `${onto.message} | Backlog global: ${globalBl.message}`,
    };
  }

  const boardBl = await moveIssueToJiraBoardBacklog({
    base: params.base,
    email: params.email,
    apiToken: params.apiToken,
    boardId: params.boardId,
    issueRef: params.issueRef,
  });
  if (boardBl.ok) return { ok: true };

  const rankId = await getBoardRankCustomFieldId({
    base: params.base,
    email: params.email,
    apiToken: params.apiToken,
    boardId: params.boardId,
  });
  const anchor = await getLastBacklogIssueKey({
    base: params.base,
    email: params.email,
    apiToken: params.apiToken,
    boardId: params.boardId,
  });
  if (anchor != null && anchor !== params.issueKey) {
    const rk = await rankAgileIssues({
      base: params.base,
      email: params.email,
      apiToken: params.apiToken,
      issueKeys: [params.issueKey],
      rankAfterIssue: anchor,
      rankCustomFieldId: rankId ?? undefined,
    });
    if (rk.ok) return { ok: true };
    return {
      ok: false,
      message: `${boardBl.message} | Ranking: ${rk.message}`,
    };
  }

  return {
    ok: false,
    message: `${boardBl.message} (sem âncora no backlog do quadro para ordenar)`,
  };
}

function base64ToUint8Array(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** POST /rest/api/3/issue/{key}/attachments (multipart, campo `file`). */
export async function uploadJiraIssueAttachments(params: {
  baseUrl: string;
  email: string;
  apiToken: string;
  issueKey: string;
  attachments: JiraImageAttachmentPayload[];
}): Promise<{ ok: true } | JiraError> {
  const { baseUrl, email, apiToken, issueKey, attachments } = params;
  if (attachments.length === 0) return { ok: true };

  const fd = new FormData();
  for (const a of attachments) {
    let bytes: Uint8Array;
    try {
      bytes = base64ToUint8Array(a.base64);
    } catch {
      return { ok: false, message: "Anexo: dados base64 inválidos." };
    }
    const mime = a.mimeType?.trim() || "application/octet-stream";
    const blob = new Blob([bytes], { type: mime });
    const name = a.fileName?.trim() || "image.png";
    fd.append("file", blob, name);
  }

  const url = `${baseUrl}/rest/api/3/issue/${encodeURIComponent(issueKey)}/attachments`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(email, apiToken),
      Accept: "application/json",
      "X-Atlassian-Token": "no-check",
    },
    body: fd,
  });

  if (!res.ok) {
    return { ok: false, message: await jiraErrorMessage(res), status: res.status };
  }
  return { ok: true };
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
  /** ID do quadro nas opções — prioridade sobre /boards/N no URL do site */
  jiraSoftwareBoardId?: string;
  /** Fallback se a resolução do JQL na API falhar (último teste ou vazio). */
  jiraBoardAutoFields?: { fieldId: string; set: unknown }[];
  jiraBoardFilterSelectFieldId?: string;
  jiraBoardFilterSelectValue?: string;
}): Promise<JiraIssueResult | JiraError> {
  const base = resolveJiraCloudBaseUrl(params.siteUrl, params.email);
  if (!base) {
    return {
      ok: false,
      message:
        "Site Jira em falta: nas opções use email @empresa ou cole https://…atlassian.net.",
    };
  }

  let projectKey = params.projectKey.trim().toUpperCase();
  if (!projectKey) {
    const bid = resolveJiraSoftwareBoardId(params.siteUrl, params.jiraSoftwareBoardId);
    if (bid != null) {
      const br = await fetchJiraSoftwareBoard({
        siteUrl: params.siteUrl,
        email: params.email,
        apiToken: params.apiToken,
        boardId: bid,
      });
      if (br.ok) projectKey = br.board.projectKey.toUpperCase();
    }
  }
  if (!projectKey) {
    return {
      ok: false,
      message:
        "Chave do projeto em falta: preencha o ID do quadro e teste a ligação (a chave vem da API) ou use Avançado.",
    };
  }

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

  const bfId = params.jiraBoardFilterSelectFieldId?.trim();
  const bfVal = params.jiraBoardFilterSelectValue?.trim();

  const boardIdPre = resolveJiraSoftwareBoardId(params.siteUrl, params.jiraSoftwareBoardId);
  let boardFilterSatisfied = false;

  if (boardIdPre != null) {
    const resolved = await resolveJiraBoardFieldsForIssueCreate({
      baseUrl: base,
      email: params.email,
      apiToken: params.apiToken,
      boardId: boardIdPre,
      projectKey,
      issueTypeName: params.issueTypeName.trim() || "Bug",
    });

    if (resolved.ok) {
      boardFilterSatisfied = resolved.unresolved.length === 0;
      for (const f of resolved.fields) {
        fields[f.fieldId] = f.set;
      }
    } else {
      for (const f of params.jiraBoardAutoFields ?? []) {
        fields[f.fieldId] = f.set;
      }
      boardFilterSatisfied = (params.jiraBoardAutoFields?.length ?? 0) > 0;
    }
    if (bfId && bfVal) {
      fields[bfId] = { value: bfVal };
      boardFilterSatisfied = true;
    }
  } else if (bfId && bfVal) {
    fields[bfId] = { value: bfVal };
  }

  const createUrl = new URL(`${base}/rest/api/3/issue`);
  createUrl.searchParams.set("updateHistory", "true");

  const res = await fetch(createUrl.toString(), {
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
    const issueRef = j.id?.trim() || j.key;
    const htmlUrl = `${base}/browse/${encodeURIComponent(j.key)}`;
    const boardId = resolveJiraSoftwareBoardId(params.siteUrl, params.jiraSoftwareBoardId);
    if (boardId == null) {
      return { ok: true, htmlUrl, key: j.key };
    }

    if (boardFilterSatisfied) {
      return { ok: true, htmlUrl, key: j.key };
    }

    const assoc = await associateIssueWithBoardBacklog({
      base,
      email: params.email,
      apiToken: params.apiToken,
      boardId,
      issueRef,
      issueKey: j.key,
    });
    if (!assoc.ok) {
      return {
        ok: true,
        htmlUrl,
        key: j.key,
        warning: `Issue criada, mas não foi associada ao quadro ${boardId}: ${assoc.message}`,
      };
    }

    return { ok: true, htmlUrl, key: j.key };
  } catch {
    return { ok: false, message: "Não foi possível interpretar a resposta do Jira." };
  }
}
