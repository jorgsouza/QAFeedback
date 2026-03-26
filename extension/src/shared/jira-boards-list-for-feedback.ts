import type { ExtensionSettings } from "./types";
import { listJiraBoards, testJiraConnection } from "./jira-client";
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
 * Lista quadros para o painel de feedback e para validação no CREATE_ISSUE.
 * Sempre pede **todos** os quadros Software visíveis ao token (`projectKey` vazio), igual à página
 * de opções com `JIRA_TEST_AND_LIST_BOARDS` e `jiraSoftwareBoardId` vazio — evita divergência entre
 * o `<select>` do modal e a lista usada em `resolveJiraBoardIdForCreate`.
 * Com allowlist no build: filtra por `BOARD_ID` / `VITE_JIRA_BOARD_ALLOWLIST`.
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

  const lb = await listJiraBoards({ siteUrl, email, apiToken, projectKey: "" });
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
  | { ok: true; boardIdStr: string; usedExplicitSelection: boolean }
  | { ok: false; message: string };

/** Valida o id pedido (ou o default da lista) contra os quadros permitidos para feedback. */
export function coerceJiraBoardIdRequest(raw: unknown): string {
  if (raw == null) return "";
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return String(Math.trunc(raw));
  if (typeof raw === "string") return raw.trim();
  return "";
}

type ListFilteredOk = Extract<ListFilteredJiraBoardsResult, { ok: true }>;

/**
 * Escolhe o ID de quadro para criar a issue: sem fallback silencioso quando o utilizador enviou um ID
 * explícito (modal) e esse ID não está na lista permitida — devolve erro para recarregar e escolher de novo.
 */
export function pickJiraBoardIdForCreate(
  listRes: ListFilteredOk,
  requestedBoardId: string | undefined,
): ResolveJiraBoardForCreateResult {
  const allowedIds = new Set(listRes.boards.map((b) => b.id));
  const req = coerceJiraBoardIdRequest(requestedBoardId);
  const fallback = listRes.defaultBoardId.trim();

  const reqNum = req ? Number.parseInt(req, 10) : NaN;
  const hasExplicitRequest = Boolean(req && Number.isFinite(reqNum) && reqNum > 0);

  if (hasExplicitRequest) {
    if (!allowedIds.has(reqNum)) {
      return {
        ok: false,
        message: `O quadro selecionado no formulário (ID ${reqNum}) não está na lista atual permitida. Feche e volte a abrir o feedback para recarregar os quadros, ou escolha outro. Se usa allowlist no build (BOARD_ID / VITE_JIRA_BOARD_ALLOWLIST), confirme que este ID está incluído.`,
      };
    }
    return { ok: true, boardIdStr: String(reqNum), usedExplicitSelection: true };
  }

  const n = Number.parseInt(fallback, 10);
  if (!Number.isFinite(n) || n <= 0 || !allowedIds.has(n)) {
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

  return { ok: true, boardIdStr: String(n), usedExplicitSelection: false };
}

export async function resolveJiraBoardIdForCreate(
  s: ExtensionSettings,
  requestedBoardId: string | undefined,
): Promise<ResolveJiraBoardForCreateResult> {
  const listRes = await listFilteredJiraBoardsForFeedback(s);
  if (!listRes.ok) return listRes;
  return pickJiraBoardIdForCreate(listRes, requestedBoardId);
}
