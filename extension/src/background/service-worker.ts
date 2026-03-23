import { createGitHubIssue, testTokenAndListRepos } from "../shared/github-client";
import { BUILTIN_MATCH_PATTERNS, matchPatternsForAllowedHost } from "../shared/host-patterns";
import {
  fetchIaRefine,
  fetchIaHealth,
  IA_HEALTH_TIMEOUT_MS,
  IA_REFINE_TIMEOUT_MS,
  normalizeIaBaseUrl,
} from "../shared/ia-service";
import { isAllowedRepoTarget, repoTargetsForUi, resolveRepoTargets } from "../shared/repo-targets";
import { loadSettings } from "../shared/storage";
import { normalizeGitHubRepoRef } from "../shared/github-repo-normalize";
import { buildFallbackIssueTitle, truncateIssueTitle } from "../shared/title-fallback";

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
  /** Se preenchido, substitui o título gerado pela IA (corpo ainda pode vir da IA). */
  overrideIssueTitle?: string;
};

type TestGitHubMessage = {
  type: "TEST_GITHUB";
  token?: string;
};

type ListRepoTargetsMessage = { type: "LIST_REPO_TARGETS" };
type OpenOptionsMessage = { type: "OPEN_OPTIONS" };
type IaHealthMessage = { type: "IA_HEALTH" };

type Messages =
  | CreateIssueMessage
  | TestGitHubMessage
  | ListRepoTargetsMessage
  | OpenOptionsMessage
  | IaHealthMessage;

async function refinePayloadWithIa(
  settings: import("../shared/types").ExtensionSettings,
  payload: import("../shared/types").CreateIssuePayload,
  overrideIssueTitle: string | undefined,
): Promise<{ payload: import("../shared/types").CreateIssuePayload; iaAuthFailed: boolean }> {
  const baseUrl = (settings.iaServiceBaseUrl ?? "").trim();
  const apiKey = (settings.iaServiceApiKey ?? "").trim();
  const manual = overrideIssueTitle?.trim() ?? "";
  const next: import("../shared/types").CreateIssuePayload = { ...payload };
  delete next.bodyMarkdown;

  const normalizedBase = normalizeIaBaseUrl(baseUrl);
  if (!normalizedBase || !apiKey) {
    next.title = truncateIssueTitle(manual || buildFallbackIssueTitle(next.whatHappened));
    return { payload: next, iaAuthFailed: false };
  }

  const controller = new AbortController();
  const to = setTimeout(() => controller.abort(), IA_REFINE_TIMEOUT_MS);
  let iaAuthFailed = false;
  try {
    const ctx = next.includeTechnicalContext ? next.technicalContext : undefined;
    const r = await fetchIaRefine({
      baseUrl: normalizedBase,
      apiKey,
      whatHappened: next.whatHappened,
      technicalContext: ctx,
      locale: "pt",
      signal: controller.signal,
    });
    clearTimeout(to);
    next.title = truncateIssueTitle(manual || r.title);
    next.bodyMarkdown = r.body;
  } catch (e) {
    clearTimeout(to);
    const msg = e instanceof Error ? e.message : "";
    if (msg === "ia_unauthorized") iaAuthFailed = true;
    next.title = truncateIssueTitle(manual || buildFallbackIssueTitle(next.whatHappened));
    delete next.bodyMarkdown;
  }
  return { payload: next, iaAuthFailed };
}

chrome.runtime.onMessage.addListener(
  (message: Messages, _sender, sendResponse: (r: unknown) => void) => {
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

    if (message.type === "IA_HEALTH") {
      void (async () => {
        try {
          const s = await loadSettings();
          const baseUrl = (s.iaServiceBaseUrl ?? "").trim();
          const apiKey = (s.iaServiceApiKey ?? "").trim();
          if (!normalizeIaBaseUrl(baseUrl) || !apiKey) {
            sendResponse({ ok: false, configured: false });
            return;
          }
          const controller = new AbortController();
          const t = setTimeout(() => controller.abort(), IA_HEALTH_TIMEOUT_MS);
          try {
            const ok = await fetchIaHealth(baseUrl, controller.signal);
            clearTimeout(t);
            sendResponse({ ok, configured: true });
          } catch {
            clearTimeout(t);
            sendResponse({ ok: false, configured: true });
          }
        } catch (err) {
          console.error("[QA Feedback] IA_HEALTH:", err);
          sendResponse({ ok: false, configured: false });
        }
      })();
      return true;
    }

    if (message.type === "LIST_REPO_TARGETS") {
      void (async () => {
        try {
          const s = await loadSettings();
          sendResponse({ repos: repoTargetsForUi(s) });
        } catch (err) {
          console.error("[QA Feedback] LIST_REPO_TARGETS:", err);
          sendResponse({ repos: [], loadFailed: true });
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

    if (message.type === "CREATE_ISSUE") {
      void (async () => {
        const s = await loadSettings();
        if (!s.githubToken.trim()) {
          sendResponse({ ok: false, message: "Configure o token GitHub nas opções da extensão." });
          return;
        }

        const targets = resolveRepoTargets(s);
        if (targets.length === 0) {
          sendResponse({ ok: false, message: "Configure ao menos um repositório nas opções." });
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

        const refined = await refinePayloadWithIa(s, message.payload, message.overrideIssueTitle);
        const r = await createGitHubIssue({
          token: s.githubToken,
          owner: n.owner,
          repo: n.repo,
          payload: refined.payload,
        });
        if (r.ok && refined.iaAuthFailed) {
          sendResponse({ ...r, iaAuthFailed: true });
          return;
        }
        sendResponse(r);
      })();
      return true;
    }

    return undefined;
  },
);

scheduleRefreshContentScripts();
