import type { ExtensionSettings } from "./types";
import { fetchJiraSoftwareBoard, listJiraBoards, testJiraConnection } from "./jira-client";
import { builtInJiraBoardAllowlistIds, filterJiraBoardsByAllowlist } from "./jira-board-allowlist";

export type JiraBoardListItem = { id: number; name: string; type: string };

/** Ordem estável para UI (modal de feedback e opções). */
export function sortJiraBoardsByName<T extends { name: string }>(boards: T[]): T[] {
  return [...boards].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

export type ListFilteredJiraBoardsResult =
  | { ok: true; boards: JiraBoardListItem[]; defaultBoardId: string }
  | { ok: false; message: string; status?: number };

/**
 * Lista quadros para o painel de feedback.
 * Com **allowlist** no build: mesmo comportamento que as opções — `listJiraBoards` **sem** filtro de
 * projeto (todos os quadros a que o token tem acesso), depois `BOARD_ID` / `VITE_…`.
 * Sem allowlist: restringe pelo projeto do quadro guardado nas opções (lista mais curta).
 */
export async function listFilteredJiraBoardsForFeedback(
  s: ExtensionSettings,
): Promise<ListFilteredJiraBoardsResult> {
  const siteUrl = (s.jiraSiteUrl ?? "").trim();
  const email = (s.jiraEmail ?? "").trim();
  const apiToken = (s.jiraApiToken ?? "").trim();
  const boardIdStr = (s.jiraSoftwareBoardId ?? "").trim();

  const conn = await testJiraConnection({ siteUrl, email, apiToken });
  if (!conn.ok) {
    return { ok: false, message: conn.message, status: conn.status };
  }

  const allowIds = builtInJiraBoardAllowlistIds();

  let boardListProjectKey = "";
  if (allowIds.length === 0) {
    const bid = Number.parseInt(boardIdStr, 10);
    if (Number.isFinite(bid) && bid > 0) {
      const fb = await fetchJiraSoftwareBoard({ siteUrl, email, apiToken, boardId: bid });
      if (fb.ok) boardListProjectKey = fb.board.projectKey;
    }
  }

  const lb = await listJiraBoards({ siteUrl, email, apiToken, projectKey: boardListProjectKey });
  if (!lb.ok) {
    return { ok: false, message: lb.message, status: lb.status };
  }
  const filtered = sortJiraBoardsByName(
    filterJiraBoardsByAllowlist(lb.boards, allowIds).map((b) => ({
      id: b.id,
      name: b.name,
      type: b.type,
    })),
  );

  const storageId = boardIdStr.trim();
  let defaultBoardId = "";
  if (storageId && filtered.some((b) => String(b.id) === storageId)) defaultBoardId = storageId;
  else if (filtered[0]) defaultBoardId = String(filtered[0].id);

  return { ok: true, boards: filtered, defaultBoardId };
}

export type ResolveJiraBoardForCreateResult =
  | { ok: true; boardIdStr: string }
  | { ok: false; message: string };

/** Valida o id pedido (ou o default da lista) contra os quadros permitidos para feedback. */
export function coerceJiraBoardIdRequest(raw: unknown): string {
  if (raw == null) return "";
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return String(Math.trunc(raw));
  if (typeof raw === "string") return raw.trim();
  return "";
}

export async function resolveJiraBoardIdForCreate(
  s: ExtensionSettings,
  requestedBoardId: string | undefined,
): Promise<ResolveJiraBoardForCreateResult> {
  const listRes = await listFilteredJiraBoardsForFeedback(s);
  if (!listRes.ok) return listRes;

  const allowed = new Set(listRes.boards.map((b) => b.id));
  const req = coerceJiraBoardIdRequest(requestedBoardId);
  const fallback = listRes.defaultBoardId.trim();
  const pickStr = req && allowed.has(Number.parseInt(req, 10)) ? req : fallback;
  const n = Number.parseInt(pickStr, 10);

  if (!Number.isFinite(n) || n <= 0 || !allowed.has(n)) {
    const allowBuilt = builtInJiraBoardAllowlistIds();
    let message: string;
    if (listRes.boards.length === 0) {
      message =
        allowBuilt.length > 0
          ? "Nenhum quadro corresponde à lista permitida (BOARD_ID ou VITE_JIRA_BOARD_ALLOWLIST no .env antes do build). Ajuste os IDs e reconstrua a extensão."
          : "Não há quadros Jira Software disponíveis para este contexto. Confirme o ID do quadro nas opções.";
    } else {
      message = "Quadro Jira inválido ou não permitido. Escolha um quadro na lista do formulário.";
    }
    return { ok: false, message };
  }

  return { ok: true, boardIdStr: String(n) };
}
