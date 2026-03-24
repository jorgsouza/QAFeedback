import { createGitHubIssue, testTokenAndListRepos } from "../shared/github-client";
import {
  consumeNetworkHarForTab,
  startNetworkDiagnosticForTab,
  stopNetworkDiagnosticForTab,
} from "./network-debugger-capture";
import { resolveJiraBoardFieldsForIssueCreate } from "../shared/jira-board-filter-resolve";
import {
  createJiraIssue,
  fetchJiraSoftwareBoard,
  jiraResolvedBoardWebUrl,
  listJiraBoards,
  resolveJiraCloudBaseUrl,
  testJiraConnection,
  uploadJiraIssueAttachments,
} from "../shared/jira-client";
import { networkHarJiraDescriptionMarkdown } from "../shared/network-har-jira-help";
import { isJiraMotivoAbertura } from "../shared/jira-motivo";
import { BUILTIN_MATCH_PATTERNS, matchPatternsForAllowedHost } from "../shared/host-patterns";
import { isAllowedRepoTarget, repoTargetsForUi, resolveRepoTargets } from "../shared/repo-targets";
import { loadSettings } from "../shared/storage";
import { normalizeGitHubRepoRef } from "../shared/github-repo-normalize";

const SCRIPT_ID = "qa-feedback-content";

async function filterGrantedPatterns(patterns: string[]): Promise<string[]> {
  const out: string[] = [];
  for (const p of patterns) {
    if (BUILTIN_MATCH_PATTERNS.has(p)) {
      out.push(p);
      continue;
    }
    try {
      if (await chrome.permissions.contains({ origins: [p] })) out.push(p);
    } catch {
      /* ignore */
    }
  }
  return [...new Set(out)];
}

/** Evita corrida: vários listeners chamam refresh ao mesmo tempo e o Chrome acusa ID duplicado. */
let refreshChain: Promise<void> = Promise.resolve();

function scheduleRefreshContentScripts(): void {
  refreshChain = refreshChain
    .then(() => runRefreshContentScripts())
    .catch((err) => console.error("[QA Feedback] refreshContentScripts:", err));
}

async function runRefreshContentScripts(): Promise<void> {
  const settings = await loadSettings();
  const patterns: string[] = [];
  for (const h of settings.allowedHosts) {
    patterns.push(...matchPatternsForAllowedHost(h));
  }
  const matches = await filterGrantedPatterns(patterns);

  try {
    await chrome.scripting.unregisterContentScripts({ ids: [SCRIPT_ID] });
  } catch {
    /* script pode não existir */
  }

  if (matches.length === 0) {
    console.warn(
      "[QA Feedback] Nenhum host com permissão para injetar o botão. Salve as opções e aceite as permissões, ou use localhost/127.0.0.1.",
    );
    return;
  }

  try {
    await chrome.scripting.registerContentScripts([
      {
        id: SCRIPT_ID,
        js: ["content.js"],
        matches,
        runAt: "document_idle",
      },
    ]);
  } catch (err) {
    console.error("[QA Feedback] Falha ao registrar content script:", err);
  }
}

chrome.runtime.onInstalled.addListener(() => {
  scheduleRefreshContentScripts();
});

chrome.runtime.onStartup.addListener(() => {
  scheduleRefreshContentScripts();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.qaFeedbackSettings) {
    scheduleRefreshContentScripts();
  }
});

function isUrlInjectable(url: string | undefined): boolean {
  if (!url) return false;
  const u = url.toLowerCase();
  if (u.startsWith("chrome://")) return false;
  if (u.startsWith("chrome-extension://")) return false;
  if (u.startsWith("edge://")) return false;
  if (u.startsWith("about:")) return false;
  if (u.startsWith("devtools://")) return false;
  if (u.startsWith("https://chrome.google.com/webstore")) return false;
  if (u.startsWith("https://chromewebstore.google.com")) return false;
  return u.startsWith("http://") || u.startsWith("https://");
}

/**
 * Se no Chrome estiver "When you click the extension" / "Ao clicar na extensão",
 * os content scripts não rodam sozinhos. activeTab + clique no ícone injeta o UI.
 * Páginas chrome://, Web Store, etc. não permitem injeção — evitamos a chamada para não gerar erro.
 */
async function injectFeedbackUi(tab: chrome.tabs.Tab): Promise<void> {
  if (tab.id === undefined) return;
  if (!isUrlInjectable(tab.url)) {
    console.info(
      "[QA Feedback] Use o ícone num site http(s). Páginas internas (chrome://extensões, configurações, etc.) não aceitam o botão de feedback.",
    );
    return;
  }
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"],
    });
  } catch (err) {
    console.warn("[QA Feedback] Injeção ao clicar no ícone falhou:", err);
  }
}

chrome.action.onClicked.addListener((tab) => {
  void injectFeedbackUi(tab);
});

type CreateIssueMessage = {
  type: "CREATE_ISSUE";
  payload: import("../shared/types").CreateIssuePayload;
  owner?: string;
  repo?: string;
};

type TestGitHubMessage = {
  type: "TEST_GITHUB";
  token?: string;
};

type TestJiraMessage = { type: "TEST_JIRA" };
/** Campos opcionais substituem o storage (opções ainda não guardadas na página de configuração). */
type JiraTestAndListBoardsMessage = {
  type: "JIRA_TEST_AND_LIST_BOARDS";
  jiraEmail?: string;
  jiraApiToken?: string;
  jiraSiteUrl?: string;
  jiraSoftwareBoardId?: string;
};

type ListRepoTargetsMessage = { type: "LIST_REPO_TARGETS" };
type OpenOptionsMessage = { type: "OPEN_OPTIONS" };
type StartNetworkDiagnosticMessage = { type: "START_NETWORK_DIAGNOSTIC" };
type StopNetworkDiagnosticMessage = { type: "STOP_NETWORK_DIAGNOSTIC" };

type Messages =
  | CreateIssueMessage
  | TestGitHubMessage
  | TestJiraMessage
  | JiraTestAndListBoardsMessage
  | ListRepoTargetsMessage
  | OpenOptionsMessage
  | StartNetworkDiagnosticMessage
  | StopNetworkDiagnosticMessage;

chrome.runtime.onMessage.addListener(
  (message: Messages, sender, sendResponse: (r: unknown) => void) => {
    if (message.type === "OPEN_OPTIONS") {
      try {
        chrome.runtime.openOptionsPage(() => {
          const err = chrome.runtime.lastError;
          if (err) {
            console.error("[QA Feedback] openOptionsPage:", err.message);
            sendResponse({ ok: false });
          } else {
            sendResponse({ ok: true });
          }
        });
      } catch (err) {
        console.error("[QA Feedback] openOptionsPage:", err);
        sendResponse({ ok: false });
      }
      return true;
    }

    if (message.type === "LIST_REPO_TARGETS") {
      void (async () => {
        try {
          const s = await loadSettings();
          sendResponse({
            repos: repoTargetsForUi(s),
            githubTokenConfigured: Boolean(s.githubToken?.trim()),
            jiraTokenConfigured: Boolean(s.jiraApiToken?.trim()),
            fullNetworkDiagnostic: Boolean(s.fullNetworkDiagnostic),
          });
        } catch (err) {
          console.error("[QA Feedback] LIST_REPO_TARGETS:", err);
          sendResponse({
            repos: [],
            githubTokenConfigured: false,
            jiraTokenConfigured: false,
            fullNetworkDiagnostic: false,
            loadFailed: true,
          });
        }
      })();
      return true;
    }

    if (message.type === "TEST_GITHUB") {
      void (async () => {
        const s = await loadSettings();
        const token = (message.token ?? s.githubToken).trim();
        const r = await testTokenAndListRepos(token);
        sendResponse(r);
      })();
      return true;
    }

    if (message.type === "TEST_JIRA") {
      void (async () => {
        const s = await loadSettings();
        const r = await testJiraConnection({
          siteUrl: s.jiraSiteUrl ?? "",
          email: s.jiraEmail ?? "",
          apiToken: s.jiraApiToken ?? "",
        });
        sendResponse(r);
      })();
      return true;
    }

    if (message.type === "JIRA_TEST_AND_LIST_BOARDS") {
      void (async () => {
        const s = await loadSettings();
        const m = message as JiraTestAndListBoardsMessage;
        const siteUrl = (m.jiraSiteUrl ?? s.jiraSiteUrl ?? "").trim();
        const email = (m.jiraEmail ?? s.jiraEmail ?? "").trim();
        const apiToken = (m.jiraApiToken ?? s.jiraApiToken ?? "").trim();
        const boardIdStr = (m.jiraSoftwareBoardId ?? s.jiraSoftwareBoardId ?? "").trim();

        const conn = await testJiraConnection({
          siteUrl,
          email,
          apiToken,
        });
        if (!conn.ok) {
          sendResponse(conn);
          return;
        }

        /** Sem quadro escolhido: lista todos os quadros acessíveis (como na UI de opções). */
        let boardListProjectKey = "";
        const bid = Number.parseInt(boardIdStr, 10);
        let boardResolveWarning: string | undefined;
        let resolvedProjectKey: string | undefined;
        let projectKeyForFilter = "";

        if (Number.isFinite(bid) && bid > 0) {
          const fb = await fetchJiraSoftwareBoard({
            siteUrl,
            email,
            apiToken,
            boardId: bid,
          });
          if (fb.ok) {
            boardListProjectKey = fb.board.projectKey;
            projectKeyForFilter = fb.board.projectKey;
            resolvedProjectKey = fb.board.projectKey;
          } else {
            boardResolveWarning = `Quadro ${bid}: ${fb.message}`;
          }
        }

        const lb = await listJiraBoards({
          siteUrl,
          email,
          apiToken,
          projectKey: boardListProjectKey,
        });
        if (!lb.ok) {
          sendResponse({ ok: false, message: lb.message, status: lb.status });
          return;
        }

        let boardFilterPreview:
          | Awaited<ReturnType<typeof resolveJiraBoardFieldsForIssueCreate>>
          | undefined;
        if (Number.isFinite(bid) && bid > 0 && projectKeyForFilter) {
          boardFilterPreview = await resolveJiraBoardFieldsForIssueCreate({
            baseUrl: conn.baseUrl,
            email,
            apiToken,
            boardId: bid,
            projectKey: projectKeyForFilter,
            issueTypeName: (s.jiraIssueTypeName ?? "Bug").trim() || "Bug",
          });
        }

        sendResponse({
          ok: true,
          displayName: conn.displayName,
          resolvedSiteUrl: conn.baseUrl,
          resolvedProjectKey,
          boardResolveWarning,
          boards: lb.boards,
          boardFilterPreview,
        });
      })();
      return true;
    }

    if (message.type === "START_NETWORK_DIAGNOSTIC") {
      void (async () => {
        try {
          const s = await loadSettings();
          if (!s.fullNetworkDiagnostic) {
            sendResponse({ ok: true, active: false });
            return;
          }
          const tabId = sender.tab?.id;
          if (tabId == null) {
            sendResponse({ ok: false, message: "Aba desconhecida.", active: false });
            return;
          }
          const r = await startNetworkDiagnosticForTab(tabId);
          sendResponse({ ok: r.ok, message: r.message, active: r.active });
        } catch (err) {
          console.error("[QA Feedback] START_NETWORK_DIAGNOSTIC:", err);
          sendResponse({
            ok: false,
            message: err instanceof Error ? err.message : "Falha ao iniciar captura.",
            active: false,
          });
        }
      })();
      return true;
    }

    if (message.type === "STOP_NETWORK_DIAGNOSTIC") {
      void (async () => {
        try {
          const tabId = sender.tab?.id;
          if (tabId != null) await stopNetworkDiagnosticForTab(tabId);
          sendResponse({ ok: true });
        } catch (err) {
          console.error("[QA Feedback] STOP_NETWORK_DIAGNOSTIC:", err);
          sendResponse({ ok: false });
        }
      })();
      return true;
    }

    if (message.type === "CREATE_ISSUE") {
      void (async () => {
        const s = await loadSettings();
        const p = message.payload;
        const tabId = sender.tab?.id;
        const wantGh = Boolean(p.sendToGitHub);
        const wantJi = Boolean(p.sendToJira);

        if (!wantGh && !wantJi) {
          sendResponse({ ok: false, message: "Selecione GitHub e/ou Jira como destino." });
          return;
        }

        const warnings: string[] = [];
        let githubUrl: string | undefined;
        let jiraUrl: string | undefined;
        let jiraIssueBrowseUrl: string | undefined;

        if (wantGh) {
          if (!s.githubToken.trim()) {
            sendResponse({ ok: false, message: "Configure o token GitHub nas opções ou desmarque GitHub." });
            return;
          }
          const targets = resolveRepoTargets(s);
          if (targets.length === 0) {
            sendResponse({
              ok: false,
              message: "Configure ao menos um repositório nas opções ou desmarque GitHub.",
            });
            return;
          }

          let owner = message.owner?.trim();
          let repo = message.repo?.trim();

          if (owner && repo) {
            if (!isAllowedRepoTarget(s, owner, repo)) {
              sendResponse({ ok: false, message: "Repositório selecionado não está na lista permitida." });
              return;
            }
          } else {
            owner = targets[0].owner;
            repo = targets[0].repo;
          }

          const n = normalizeGitHubRepoRef(owner, repo);
          if (!n.owner || !n.repo) {
            sendResponse({ ok: false, message: "Owner/repositório inválido." });
            return;
          }

          const r = await createGitHubIssue({
            token: s.githubToken,
            owner: n.owner,
            repo: n.repo,
            payload: p,
          });
          if (r.ok) githubUrl = r.htmlUrl;
          else warnings.push(`GitHub: ${r.message}`);
        }

        if (wantJi) {
          const jiraBase = resolveJiraCloudBaseUrl(s.jiraSiteUrl ?? "", s.jiraEmail ?? "");
          if (!jiraBase || !s.jiraEmail?.trim() || !s.jiraApiToken?.trim()) {
            if (wantGh && githubUrl) {
              sendResponse({
                ok: true,
                githubUrl,
                warnings: [
                  "Jira: configure email @empresa + API token (e ID do quadro) nas opções ou desmarque Jira.",
                ],
              });
              return;
            }
            sendResponse({
              ok: false,
              message:
                "Configure Jira nas opções (email @empresa + API token + ID do quadro, ou site em Avançado) ou desmarque Jira.",
            });
            return;
          }

          if (!isJiraMotivoAbertura(p.jiraMotivoAbertura)) {
            sendResponse({
              ok: false,
              message: "Selecione o motivo da abertura (Jira).",
            });
            return;
          }

          let appendHarHelp: string | undefined;
          const jiraAttachments = [...(p.jiraImageAttachments ?? [])];
          if (s.fullNetworkDiagnostic && tabId != null) {
            try {
              const har = await consumeNetworkHarForTab(tabId);
              if (har) {
                jiraAttachments.push({
                  fileName: har.fileName,
                  mimeType: "application/json",
                  base64: har.base64,
                });
                appendHarHelp = networkHarJiraDescriptionMarkdown(har.fileName);
              }
            } catch (e) {
              warnings.push(
                `HAR rede: ${e instanceof Error ? e.message : "falha ao gerar anexo"}.`,
              );
            }
          }

          const jr = await createJiraIssue({
            siteUrl: s.jiraSiteUrl ?? "",
            email: s.jiraEmail ?? "",
            apiToken: s.jiraApiToken ?? "",
            projectKey: s.jiraProjectKey ?? "",
            issueTypeName: s.jiraIssueTypeName ?? "Bug",
            payload: p,
            motivoAbertura: p.jiraMotivoAbertura,
            motivoCustomFieldId: s.jiraMotivoCustomFieldId,
            jiraSoftwareBoardId: s.jiraSoftwareBoardId,
            jiraBoardAutoFields: s.jiraBoardAutoFields,
            jiraBoardFilterSelectFieldId: s.jiraBoardFilterSelectFieldId,
            jiraBoardFilterSelectValue: s.jiraBoardFilterSelectValue,
            appendDescriptionMarkdown: appendHarHelp,
          });
          if (jr.ok) {
            if (jiraAttachments.length > 0) {
              const up = await uploadJiraIssueAttachments({
                baseUrl: jiraBase,
                email: s.jiraEmail ?? "",
                apiToken: s.jiraApiToken ?? "",
                issueKey: jr.key,
                attachments: jiraAttachments,
              });
              if (!up.ok) warnings.push(`Jira anexos: ${up.message}`);
            }

            const browse = jr.htmlUrl;
            const issueProjectKey =
              (s.jiraProjectKey ?? "").trim() ||
              (jr.key.match(/^([A-Z][A-Z0-9_]*)-\d+$/i)?.[1]?.toUpperCase() ?? "");
            const boardLink = jiraResolvedBoardWebUrl({
              siteUrl: jiraBase,
              projectKey: issueProjectKey,
              jiraSoftwareBoardId: s.jiraSoftwareBoardId,
              selectedIssueKey: jr.key,
            });
            jiraUrl = boardLink ?? browse;
            jiraIssueBrowseUrl = boardLink ? browse : undefined;
            if (jr.warning) warnings.push(jr.warning);
          } else {
            warnings.push(`Jira: ${jr.message}`);
          }
        }

        if (!githubUrl && !jiraUrl) {
          sendResponse({
            ok: false,
            message: warnings.join(" ") || "Não foi possível criar em nenhum destino.",
          });
          return;
        }

        sendResponse({
          ok: true,
          githubUrl,
          jiraUrl,
          jiraIssueBrowseUrl,
          warnings: warnings.length ? warnings : undefined,
        });
      })();
      return true;
    }

    return undefined;
  },
);

scheduleRefreshContentScripts();
