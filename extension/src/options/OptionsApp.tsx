import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  Activity,
  Bug,
  GitBranch,
  LayoutGrid,
  Layers,
  Plus,
  Save,
  Video,
  X,
} from "lucide-react";
import {
  DEFAULT_ALLOWED_HOSTS,
  DEFAULT_VIEWPORT_RECORDING_MAX_SEC,
  emptySettings,
  loadSettings,
  saveSettings,
} from "../shared/storage";
import type { ExtensionSettings } from "../shared/types";
import {
  normalizeAllowedHostLine,
  normalizeGitHubRepoRef,
} from "../shared/github-repo-normalize";
import { matchPatternsForAllowedHost } from "../shared/host-patterns";
import {
  formatReposForTextarea,
  parseReposTextarea,
  resolveRepoTargets,
} from "../shared/repo-targets";
import { resolveJiraCloudBaseUrl } from "../shared/jira-client";
import type { ResolveJiraBoardFilterResult } from "../shared/jira-board-filter-resolve";
import { builtInJiraBoardAllowlistIds, filterJiraBoardsByAllowlist } from "../shared/jira-board-allowlist";
import { sortJiraBoardsByName } from "../shared/jira-boards-list-for-feedback";

function boardsForOptionsMenu(raw: { id: number; name: string; type: string }[]) {
  return filterJiraBoardsByAllowlist(raw, builtInJiraBoardAllowlistIds());
}

function hostsToText(hosts: string[]): string {
  return hosts.join("\n");
}

function textToHosts(text: string): string[] {
  return text
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function originPatternsForHosts(hosts: string[]): string[] {
  const patterns: string[] = [];
  for (const h of hosts) {
    patterns.push(...matchPatternsForAllowedHost(h));
  }
  return [...new Set(patterns)];
}

type OptionsSectionFeedback = {
  global: string | null;
  github: string | null;
  jira: string | null;
  domains: string | null;
};

const emptySectionFeedback = (): OptionsSectionFeedback => ({
  global: null,
  github: null,
  jira: null,
  domains: null,
});

function SectionMessage({
  id,
  message,
  style,
  className = "",
}: {
  id: string;
  message: string | null;
  style?: CSSProperties;
  className?: string;
}) {
  if (!message) return null;
  return (
    <p
      id={id}
      role="status"
      aria-live="polite"
      className={`${className?.trim() ? className : "mt-3"} rounded-[var(--radius-lg)] border border-[var(--color-slate-200)] bg-[var(--color-slate-50)] p-3 text-sm leading-relaxed text-[var(--foreground)]`}
      style={style}
    >
      {message}
    </p>
  );
}

function DsSectionTitle({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <h2
      id={id}
      className="mb-4 font-[var(--font-sans-2)] text-xs font-bold uppercase tracking-wider text-[var(--color-slate-600)]"
    >
      {children}
    </h2>
  );
}

function ConnectionPill({ connected, label }: { connected: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-[var(--color-slate-100)] px-3 py-1 text-[0.65rem] font-bold uppercase tracking-wide text-[var(--color-slate-700)]">
      <span
        className={`h-2 w-2 shrink-0 rounded-full ${connected ? "bg-[var(--color-green-500)]" : "bg-[var(--color-red-500)]"}`}
        aria-hidden
      />
      {label}
    </span>
  );
}

const inputClass =
  "flex h-10 w-full rounded-[var(--radius-xl)] border border-[var(--color-slate-300)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] placeholder:text-[var(--color-slate-500)] shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary-500)]/30";

const btnPrimaryClass =
  "inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-[var(--radius-xl)] bg-[var(--primary-700)] px-4 text-sm font-medium text-[var(--color-slate-50)] transition-colors hover:bg-[var(--primary-800)] disabled:cursor-not-allowed disabled:opacity-60";

const btnSecondaryClass =
  "inline-flex h-10 w-full items-center justify-center rounded-[var(--radius-xl)] border border-[var(--color-slate-300)] bg-[var(--background)] px-3 text-xs font-semibold uppercase tracking-wide text-[var(--foreground)] transition-colors hover:bg-[var(--color-slate-50)] disabled:opacity-60";

const cardClass =
  "rounded-[var(--radius-3xl)] border border-[var(--color-slate-200)] bg-[var(--background)] p-5 shadow-[var(--shadow-base)]";

export function OptionsApp() {
  const [settings, setSettings] = useState<ExtensionSettings>(emptySettings());
  const [reposText, setReposText] = useState("");
  const [hostsText, setHostsText] = useState(hostsToText(DEFAULT_ALLOWED_HOSTS));
  const [loaded, setLoaded] = useState(false);
  const [feedback, setFeedback] = useState<OptionsSectionFeedback>(emptySectionFeedback);
  const [testing, setTesting] = useState(false);
  const [testingJira, setTestingJira] = useState(false);
  const [jiraBoardsLoading, setJiraBoardsLoading] = useState(false);
  const [jiraBoards, setJiraBoards] = useState<{ id: number; name: string; type: string }[]>([]);
  const [domainDraft, setDomainDraft] = useState("");
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const jiraListRequestId = useRef(0);

  useEffect(() => {
    void (async () => {
      const s = await loadSettings();
      setSettings(s);
      setReposText(formatReposForTextarea(resolveRepoTargets(s)));
      setHostsText(hostsToText(s.allowedHosts));
      setLoaded(true);
    })();
  }, []);

  const onSave = useCallback(async () => {
    setFeedback(emptySectionFeedback());
    const repos = parseReposTextarea(reposText);
    const jiraBaseGuess = resolveJiraCloudBaseUrl(settings.jiraSiteUrl ?? "", settings.jiraEmail ?? "");
    const jiraOk =
      Boolean(jiraBaseGuess) &&
      Boolean(settings.jiraEmail?.trim()) &&
      Boolean(settings.jiraApiToken?.trim()) &&
      Boolean((settings.jiraSoftwareBoardId ?? "").trim() || (settings.jiraProjectKey ?? "").trim());

    if (repos.length === 0 && !jiraOk) {
      setFeedback({
        ...emptySectionFeedback(),
        global:
          "Adicione ao menos um repositório GitHub ou configure Jira (email, API token e ID do quadro — ou site em Avançado).",
      });
      return;
    }

    const hosts = [
      ...new Set(
        textToHosts(hostsText)
          .map(normalizeAllowedHostLine)
          .filter(Boolean),
      ),
    ];
    if (hosts.length === 0) {
      setFeedback({
        ...emptySectionFeedback(),
        domains: "Adicione ao menos um domínio/host permitido.",
      });
      return;
    }

    let owner = "";
    let repo = "";
    if (repos.length > 0) {
      const first = repos[0];
      const n = normalizeGitHubRepoRef(first.owner, first.repo);
      owner = n.owner;
      repo = n.repo;
    }

    const origins = originPatternsForHosts(hosts);
    try {
      const granted = await chrome.permissions.request({ origins });
      if (!granted) {
        setFeedback((f) => ({
          ...f,
          global:
            f.global ??
            "Permissão de host não concedida: a extensão pode não aparecer em alguns domínios até você aprovar.",
        }));
      }
    } catch {
      setFeedback((f) => ({
        ...f,
        global: f.global ?? "Não foi possível solicitar permissões para os hosts informados.",
      }));
    }

    const jiraBase = resolveJiraCloudBaseUrl(settings.jiraSiteUrl ?? "", settings.jiraEmail ?? "");
    if (jiraBase) {
      try {
        const jiraOrigin = `${new URL(jiraBase).origin}/*`;
        const jg = await chrome.permissions.request({ origins: [jiraOrigin] });
        if (!jg) {
          setFeedback((f) => ({
            ...f,
            global: f.global ?? "Permissão para o site Jira não concedida: chamadas à API podem falhar.",
          }));
        }
      } catch {
        setFeedback((f) => ({
          ...f,
          global: f.global ?? "Não foi possível solicitar permissão para o Jira.",
        }));
      }
    }

    const next: ExtensionSettings = {
      ...settings,
      owner,
      repo,
      repos,
      allowedHosts: hosts,
    };
    setSettings(next);
    setHostsText(hostsToText(hosts));
    setReposText(formatReposForTextarea(repos));
    await saveSettings(next);
    setFeedback((f) => ({ ...f, global: f.global ?? "Configurações salvas." }));
  }, [hostsText, reposText, settings]);

  const onTest = useCallback(async () => {
    setTesting(true);
    setFeedback(emptySectionFeedback());
    try {
      if (!settings.githubToken.trim()) {
        setFeedback((f) => ({
          ...f,
          github: "Informe o GitHub token antes de testar.",
        }));
        setTesting(false);
        return;
      }
      const res = (await chrome.runtime.sendMessage({
        type: "TEST_GITHUB",
        token: settings.githubToken,
      })) as
        | { ok: true; repos: { fullName: string }[] }
        | { ok: false; message?: string };

      if (res.ok && "repos" in res && Array.isArray(res.repos)) {
        const lines = res.repos.map((r) => r.fullName).join("\n");
        setReposText(lines);
        const n = res.repos.length;
        setFeedback((f) => ({
          ...f,
          github:
            n > 0
              ? `GitHub: conexão OK. ${n} repositório(s) na lista — revise, edite se quiser e clique em Salvar.`
              : "GitHub: token válido, mas a API não devolveu repositórios (confira escopos do PAT ou repositórios do token fine-grained).",
        }));
      } else if (!res.ok) {
        setFeedback((f) => ({
          ...f,
          github: res.message ?? "GitHub: falha ao testar conexão.",
        }));
      }
    } catch {
      setFeedback((f) => ({
        ...f,
        github: "GitHub: erro ao comunicar com o service worker.",
      }));
    } finally {
      setTesting(false);
    }
  }, [settings.githubToken]);

  const sendJiraTestAndListBoards = useCallback(async (boardIdForApi: string) => {
    const s = settingsRef.current;
    return (await chrome.runtime.sendMessage({
      type: "JIRA_TEST_AND_LIST_BOARDS",
      jiraEmail: s.jiraEmail,
      jiraApiToken: s.jiraApiToken,
      jiraSiteUrl: s.jiraSiteUrl ?? "",
      jiraSoftwareBoardId: boardIdForApi,
    })) as
      | {
          ok: true;
          displayName: string;
          resolvedSiteUrl?: string;
          resolvedProjectKey?: string;
          boardResolveWarning?: string;
          boards: { id: number; name: string; type: string }[];
          boardFilterPreview?: ResolveJiraBoardFilterResult;
        }
      | { ok: false; message?: string; status?: number };
  }, []);

  const buildJiraOkStatusLines = useCallback(
    (
      res: {
        displayName: string;
        resolvedSiteUrl?: string;
        resolvedProjectKey?: string;
        boardResolveWarning?: string;
        boards: { id: number; name: string; type: string }[];
        boardFilterPreview?: ResolveJiraBoardFilterResult;
      },
      opts: {
        boardIdChosen?: string;
        boardsListedInUi?: number;
        jiraIssueTypeName?: string;
      } = {},
    ) => {
      const lines: string[] = [];
      lines.push(`Jira: ligação OK (${res.displayName}).`);
      if (res.resolvedSiteUrl) lines.push(`Site: ${res.resolvedSiteUrl}`);
      if (res.resolvedProjectKey) {
        lines.push(`Chave do projeto (da API, a partir do quadro): ${res.resolvedProjectKey}.`);
      }
      if (res.boards.length === 0) {
        lines.push("Nenhum quadro na lista — confira o token ou o acesso à API Jira Software.");
      } else if (!opts.boardIdChosen) {
        const n = opts.boardsListedInUi ?? res.boards.length;
        lines.push(`${n} quadro(s) no menu.`);
      }

      const preview = res.boardFilterPreview;
      if (preview) {
        if (preview.ok) {
          if (preview.fields.length > 0) {
            lines.push(
              `Filtro do quadro: ${preview.fields.length} campo(s) guardados (${preview.fields.map((f) => f.fieldId).join(", ")}).`,
            );
          } else {
            lines.push("Filtro do quadro: só projeto (sem selects extra).");
          }
          if (preview.unresolved.length > 0) {
            lines.push(`Não mapeado no createmeta: ${preview.unresolved.join("; ")} — override em Avançado se precisar.`);
          }
          const reqT = opts.jiraIssueTypeName?.trim();
          if (reqT && preview.effectiveIssueTypeName.trim().toLowerCase() !== reqT.toLowerCase()) {
            lines.push(
              `Tipo na criação neste quadro: ${preview.effectiveIssueTypeName} (nas opções: ${reqT}).`,
            );
          }
        } else {
          lines.push(`Filtro do quadro: ${preview.message}`);
        }
      } else if ((opts.boardIdChosen ?? "").trim()) {
        lines.push("Filtro do quadro: não analisado (confirme o ID do quadro).");
      }

      if (res.boardResolveWarning) lines.push(`Aviso: ${res.boardResolveWarning}`);
      return lines.join(" ");
    },
    [],
  );

  const jiraEmailTrim = (settings.jiraEmail ?? "").trim();
  const jiraTokenTrim = (settings.jiraApiToken ?? "").trim();
  const jiraSiteTrim = (settings.jiraSiteUrl ?? "").trim();
  const jiraCredsReady = Boolean(
    jiraEmailTrim &&
      jiraTokenTrim &&
      resolveJiraCloudBaseUrl(jiraSiteTrim, jiraEmailTrim),
  );

  useEffect(() => {
    if (!jiraCredsReady) {
      setJiraBoards([]);
      setJiraBoardsLoading(false);
      return;
    }
    const reqId = ++jiraListRequestId.current;
    const t = window.setTimeout(() => {
      void (async () => {
        setJiraBoardsLoading(true);
        setFeedback((f) => ({ ...f, jira: null }));
        try {
          const res = await sendJiraTestAndListBoards("");
          if (reqId !== jiraListRequestId.current) return;
          if (!res.ok) {
            setFeedback((f) => ({
              ...f,
              jira: res.message ?? "Jira: falha ao listar quadros.",
            }));
            setJiraBoards([]);
            return;
          }
          const rawBoards = res.boards;
          const filtered = sortJiraBoardsByName(boardsForOptionsMenu(rawBoards));
          setJiraBoards(filtered);
          setSettings((prev) => {
            const next = { ...prev };
            if (res.resolvedSiteUrl) next.jiraSiteUrl = res.resolvedSiteUrl;
            void saveSettings(next);
            return next;
          });
          const allowN = builtInJiraBoardAllowlistIds().length;
          if (filtered.length > 0) {
            setFeedback((f) => ({
              ...f,
              jira:
                allowN > 0
                  ? `Jira: ligação OK (${res.displayName}). Menu com ${filtered.length} quadro(s) permitidos por BOARD_ID no build (${rawBoards.length} no total na API) — escolha o backlog destino.`
                  : `Jira: ligação OK (${res.displayName}). ${filtered.length} quadro(s) listados — escolha o backlog destino no menu.`,
            }));
          } else if (rawBoards.length > 0 && allowN > 0) {
            setFeedback((f) => ({
              ...f,
              jira: `Jira: ligação OK (${res.displayName}), mas nenhum quadro coincide com os IDs em BOARD_ID / VITE_JIRA_BOARD_ALLOWLIST (${rawBoards.length} na API). Ajuste o .env e execute npm run build.`,
            }));
          } else {
            setFeedback((f) => ({
              ...f,
              jira: `Jira: ligação OK (${res.displayName}), mas a API não devolveu quadros (confira o token e o Jira Software).`,
            }));
          }
        } catch {
          if (reqId !== jiraListRequestId.current) return;
          setFeedback((f) => ({
            ...f,
            jira: "Jira: erro ao comunicar com o service worker.",
          }));
          setJiraBoards([]);
        } finally {
          if (reqId === jiraListRequestId.current) setJiraBoardsLoading(false);
        }
      })();
    }, 550);
    return () => {
      window.clearTimeout(t);
    };
  }, [jiraCredsReady, jiraEmailTrim, jiraTokenTrim, jiraSiteTrim, sendJiraTestAndListBoards]);

  useEffect(() => {
    if (jiraBoardsLoading || jiraBoards.length === 0) return;
    const id = (settings.jiraSoftwareBoardId ?? "").trim();
    if (!id) return;
    if (!jiraBoards.some((b) => String(b.id) === id)) {
      setSettings((p) => {
        const next = { ...p, jiraSoftwareBoardId: "" };
        void saveSettings(next);
        return next;
      });
    }
  }, [jiraBoards, jiraBoardsLoading, settings.jiraSoftwareBoardId]);

  const onJiraBoardSelect = useCallback(
    async (boardId: string) => {
      setSettings((p) => ({ ...p, jiraSoftwareBoardId: boardId }));
      if (!boardId.trim()) {
        setFeedback(emptySectionFeedback());
        return;
      }
      setTestingJira(true);
      setFeedback(emptySectionFeedback());
      try {
        const res = await sendJiraTestAndListBoards(boardId);
        if (!res.ok) {
          setFeedback((f) => ({
            ...f,
            jira: res.message ?? "Jira: falha ao aplicar o quadro escolhido.",
          }));
          return;
        }
        const fullRes = await sendJiraTestAndListBoards("");
        if (fullRes.ok) {
          const listed = sortJiraBoardsByName(boardsForOptionsMenu(fullRes.boards));
          setJiraBoards(listed);
          if (fullRes.boards.length > 0 && listed.length === 0 && builtInJiraBoardAllowlistIds().length > 0) {
            setFeedback((f) => ({
              ...f,
              jira: `${buildJiraOkStatusLines(res, {
                boardIdChosen: boardId,
                jiraIssueTypeName: settingsRef.current.jiraIssueTypeName,
              })} · Atenção: nenhum ID do BOARD_ID no build aparece na API (${fullRes.boards.length} quadros).`,
            }));
          } else {
            setFeedback((f) => ({
              ...f,
              jira: buildJiraOkStatusLines(res, {
                boardIdChosen: boardId,
                boardsListedInUi: listed.length,
                jiraIssueTypeName: settingsRef.current.jiraIssueTypeName,
              }),
            }));
          }
        } else {
          setFeedback((f) => ({
            ...f,
            jira: `${buildJiraOkStatusLines(res, {
              boardIdChosen: boardId,
              jiraIssueTypeName: settingsRef.current.jiraIssueTypeName,
            })} · Não foi possível recarregar a lista completa de quadros: ${fullRes.message ?? "erro"}. Recarregue esta página de opções.`,
          }));
        }
        const preview = res.boardFilterPreview;
        setSettings((prev) => {
          const next = { ...prev, jiraSoftwareBoardId: boardId };
          if (res.resolvedSiteUrl) next.jiraSiteUrl = res.resolvedSiteUrl;
          if (res.resolvedProjectKey) next.jiraProjectKey = res.resolvedProjectKey;
          if (preview?.ok) {
            next.jiraBoardAutoFields = preview.fields.map((f) => ({ fieldId: f.fieldId, set: f.set }));
          }
          void saveSettings(next);
          return next;
        });
      } catch {
        setFeedback((f) => ({
          ...f,
          jira: "Jira: erro ao comunicar com o service worker.",
        }));
      } finally {
        setTestingJira(false);
      }
    },
    [sendJiraTestAndListBoards, buildJiraOkStatusLines],
  );

  const onClearToken = useCallback(async () => {
    const next = { ...settings, githubToken: "" };
    setSettings(next);
    await saveSettings(next);
    setFeedback((f) => ({
      ...f,
      github: "GitHub: token removido.",
    }));
  }, [settings]);

  const hostList = useMemo(
    () =>
      [
        ...new Set(
          textToHosts(hostsText)
            .map(normalizeAllowedHostLine)
            .filter(Boolean),
        ),
      ],
    [hostsText],
  );

  const removeHost = useCallback((h: string) => {
    const next = textToHosts(hostsText).filter((x) => normalizeAllowedHostLine(x) !== h);
    setHostsText(hostsToText(next));
  }, [hostsText]);

  const addDomain = useCallback(() => {
    const n = normalizeAllowedHostLine(domainDraft.trim());
    if (!n) return;
    const set = new Set(
      textToHosts(hostsText)
        .map((x) => normalizeAllowedHostLine(x))
        .filter(Boolean),
    );
    if (set.has(n)) {
      setDomainDraft("");
      return;
    }
    setHostsText(hostsToText([...textToHosts(hostsText), n]));
    setDomainDraft("");
  }, [domainDraft, hostsText]);

  const githubConnected = Boolean(settings.githubToken.trim());
  const jiraConnected = Boolean(jiraCredsReady && (settings.jiraSoftwareBoardId ?? "").trim());

  if (!loaded) {
    return (
      <p className="p-6 font-[var(--font-base)] text-sm text-[var(--color-slate-600)]">Carregando…</p>
    );
  }

  return (
    <div className="min-h-screen pb-8 font-[var(--font-base)]">
      <header className="border-b border-[var(--color-slate-200)] bg-[var(--background)] px-4 py-5 shadow-sm sm:px-8">
        <p className="mx-auto max-w-6xl text-sm leading-relaxed text-[var(--color-slate-600)]">
          QA Feedback — GitHub e Jira. PAT com permissão <strong className="font-semibold text-[var(--foreground)]">Issues</strong>
          . Jira:{" "}
          <a
            className="font-semibold text-[var(--primary-700)] hover:underline"
            href="https://id.atlassian.com/manage-profile/security/api-tokens"
            target="_blank"
            rel="noreferrer"
          >
            API token
          </a>{" "}
          e e-mail Atlassian. Ao guardar, o Chrome pode pedir permissão para os domínios.
        </p>
      </header>

      <div className="mx-auto max-w-6xl space-y-10 px-4 py-8 sm:px-8">
        <section aria-labelledby="qaf-integrations">
            <DsSectionTitle id="qaf-integrations">Integrações</DsSectionTitle>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className={cardClass}>
                <div className="mb-4 flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-xl)] bg-[var(--color-slate-100)]">
                      <GitBranch className="h-5 w-5 text-[var(--foreground)]" aria-hidden />
                    </span>
                    <span className="font-[var(--font-sans-2)] text-lg font-semibold text-[var(--foreground)]">
                      GitHub
                    </span>
                  </div>
                  <ConnectionPill connected={githubConnected} label={githubConnected ? "Conectado" : "Desconectado"} />
                </div>

                <details className="mb-4 rounded-[var(--radius-lg)] border border-[var(--color-slate-200)] bg-[var(--color-slate-50)]">
                  <summary className="cursor-pointer select-none px-3 py-2 text-sm font-semibold text-[var(--color-slate-700)]">
                    Como criar o token fine-grained (passo a passo)
                  </summary>
                  <ol className="list-decimal space-y-2 border-t border-[var(--color-slate-200)] px-5 py-3 text-sm text-[var(--color-slate-600)]">
                    <li>
                      Acesse{" "}
                      <a
                        className="font-semibold text-[var(--primary-700)] hover:underline"
                        href="https://github.com/settings/personal-access-tokens"
                        target="_blank"
                        rel="noreferrer"
                      >
                        github.com/settings/personal-access-tokens
                      </a>
                      . Em <strong>Fine-grained personal access tokens</strong>, gere um token novo.
                    </li>
                    <li>
                      Em <strong>Permissions</strong> → <strong>Issues</strong>: <strong>Read and write</strong>.
                    </li>
                    <li>Cole o valor abaixo (o GitHub só mostra o token completo uma vez).</li>
                  </ol>
                </details>

                <label className="mb-1 block text-sm font-semibold text-[var(--foreground)]" htmlFor="token">
                  Token GitHub
                </label>
                <input
                  id="token"
                  type="password"
                  autoComplete="off"
                  value={settings.githubToken}
                  onChange={(e) => setSettings({ ...settings, githubToken: e.target.value })}
                  className={inputClass}
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" className={btnSecondaryClass} onClick={onTest} disabled={testing}>
                    {testing ? "Carregando…" : "Testar conexão e listar repos"}
                  </button>
                  <button type="button" className={btnSecondaryClass} onClick={() => void onClearToken()}>
                    Apagar token
                  </button>
                </div>

                <label className="mb-1 mt-4 block text-sm font-semibold text-[var(--foreground)]" htmlFor="repos">
                  Repositórios destino (um por linha)
                </label>
                <textarea
                  id="repos"
                  value={reposText}
                  onChange={(e) => setReposText(e.target.value)}
                  rows={6}
                  className={`${inputClass} min-h-[8rem] resize-y font-mono text-xs`}
                  placeholder={"jorgsouza/meu-repo\norg/outro-repo|Projeto legado\nhttps://github.com/org/repo"}
                />
                <p className="mt-2 text-xs text-[var(--color-slate-500)]">
                  Formato: <code className="rounded bg-[var(--color-slate-100)] px-1">owner/repo</code>, URL ou{" "}
                  <code className="rounded bg-[var(--color-slate-100)] px-1">owner/repo|Nome</code>. Vazio se usar só Jira.
                </p>
                <SectionMessage id="options-github-feedback" message={feedback.github} />
              </div>

              <div className={cardClass}>
                <div className="mb-4 flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-xl)] bg-[var(--color-slate-100)]">
                      <Layers className="h-5 w-5 text-[var(--color-blue-600)]" aria-hidden />
                    </span>
                    <span className="font-[var(--font-sans-2)] text-lg font-semibold text-[var(--foreground)]">Jira</span>
                  </div>
                  <ConnectionPill connected={jiraConnected} label={jiraConnected ? "Conectado" : "Desconectado"} />
                </div>

                <p className="mb-3 text-sm text-[var(--color-slate-600)]">
                  Com e-mail <strong>@empresa</strong> inferimos o site Atlassian. Gmail não inferem — use{" "}
                  <strong>Avançado</strong>.
                </p>

                <label className="mb-1 block text-sm font-semibold text-[var(--foreground)]" htmlFor="jira-email">
                  E-mail Atlassian
                </label>
                <input
                  id="jira-email"
                  type="email"
                  autoComplete="off"
                  value={settings.jiraEmail ?? ""}
                  onChange={(e) => setSettings({ ...settings, jiraEmail: e.target.value })}
                  className={inputClass}
                />

                <a
                  className="mt-3 flex h-10 w-full items-center justify-center rounded-[var(--radius-xl)] border border-dashed border-[var(--color-slate-300)] bg-[var(--color-slate-50)] text-xs font-bold uppercase tracking-wide text-[var(--primary-700)] hover:bg-[var(--color-slate-100)]"
                  href="https://id.atlassian.com/manage-profile/security/api-tokens"
                  target="_blank"
                  rel="noreferrer"
                >
                  Criar API token Jira (guia na Atlassian)
                </a>

                <label className="mb-1 mt-3 block text-sm font-semibold text-[var(--foreground)]" htmlFor="jira-token">
                  API token Jira
                </label>
                <input
                  id="jira-token"
                  type="password"
                  autoComplete="off"
                  value={settings.jiraApiToken ?? ""}
                  onChange={(e) => setSettings({ ...settings, jiraApiToken: e.target.value })}
                  className={inputClass}
                />

                <details className="mt-3 rounded-[var(--radius-lg)] border border-[var(--color-slate-200)]">
                  <summary className="cursor-pointer select-none px-3 py-2 text-sm font-semibold text-[var(--color-slate-700)]">
                    Avançado — site, projeto, override do filtro
                  </summary>
                  <div className="space-y-3 border-t border-[var(--color-slate-200)] p-3">
                    <label className="block text-xs font-semibold" htmlFor="jira-site">
                      Site Atlassian
                    </label>
                    <input
                      id="jira-site"
                      type="url"
                      autoComplete="off"
                      placeholder="Vazio = inferir pelo e-mail"
                      value={settings.jiraSiteUrl ?? ""}
                      onChange={(e) => setSettings({ ...settings, jiraSiteUrl: e.target.value })}
                      className={inputClass}
                    />
                    <label className="block text-xs font-semibold" htmlFor="jira-project">
                      Chave do projeto
                    </label>
                    <input
                      id="jira-project"
                      type="text"
                      autoComplete="off"
                      value={settings.jiraProjectKey ?? ""}
                      onChange={(e) => setSettings({ ...settings, jiraProjectKey: e.target.value })}
                      className={inputClass}
                    />
                    <label className="block text-xs font-semibold" htmlFor="jira-board-filter-field">
                      Override campo select
                    </label>
                    <input
                      id="jira-board-filter-field"
                      type="text"
                      autoComplete="off"
                      value={settings.jiraBoardFilterSelectFieldId ?? ""}
                      onChange={(e) => setSettings({ ...settings, jiraBoardFilterSelectFieldId: e.target.value })}
                      className={`${inputClass} font-mono text-xs`}
                    />
                    <label className="block text-xs font-semibold" htmlFor="jira-board-filter-value">
                      Valor da opção
                    </label>
                    <input
                      id="jira-board-filter-value"
                      type="text"
                      autoComplete="off"
                      value={settings.jiraBoardFilterSelectValue ?? ""}
                      onChange={(e) => setSettings({ ...settings, jiraBoardFilterSelectValue: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                </details>

                {jiraBoardsLoading ? (
                  <p className="mt-3 text-sm font-semibold text-[var(--color-blue-600)]" role="status">
                    Consultando a API e atualizando quadros…
                  </p>
                ) : null}

                <label className="mb-1 mt-3 block text-sm font-semibold text-[var(--foreground)]" htmlFor="jira-board-select">
                  Quadro Software — backlog destino
                </label>
                <select
                  id="jira-board-select"
                  value={settings.jiraSoftwareBoardId ?? ""}
                  disabled={!jiraCredsReady || jiraBoardsLoading || testingJira}
                  onChange={(e) => void onJiraBoardSelect(e.target.value)}
                  className={inputClass}
                >
                  <option value="">
                    {jiraBoardsLoading
                      ? "Carregando quadros…"
                      : !jiraCredsReady
                        ? "Preencha e-mail e API token"
                        : jiraBoards.length === 0
                          ? "Nenhum quadro encontrado"
                          : "Escolha um quadro…"}
                  </option>
                  {jiraBoards.map((b) => (
                    <option key={b.id} value={String(b.id)}>
                      {b.name} ({b.type}) — ID {b.id}
                    </option>
                  ))}
                </select>

                {builtInJiraBoardAllowlistIds().length > 0 ? (
                  <p className="mt-2 text-xs text-[var(--color-slate-500)]">
                    Menu filtrado por <code className="rounded bg-[var(--color-slate-100)] px-1">BOARD_ID</code> no build.
                  </p>
                ) : null}
                {(settings.jiraProjectKey ?? "").trim() ? (
                  <p className="mt-2 rounded-[var(--radius-lg)] border border-[var(--color-slate-200)] bg-[var(--color-slate-50)] p-2 text-xs text-[var(--color-slate-700)]">
                    <strong>Projeto:</strong> {settings.jiraProjectKey}
                    {resolveJiraCloudBaseUrl(settings.jiraSiteUrl ?? "", settings.jiraEmail ?? "") ? (
                      <>
                        {" "}
                        · <strong>Site:</strong> {resolveJiraCloudBaseUrl(settings.jiraSiteUrl ?? "", settings.jiraEmail ?? "")}
                      </>
                    ) : null}
                  </p>
                ) : null}
                {(settings.jiraBoardAutoFields?.length ?? 0) > 0 ? (
                  <p className="mt-2 rounded-[var(--radius-lg)] border border-[var(--primary-200)] bg-[var(--primary-50)] p-2 text-xs text-[var(--primary-800)]">
                    <strong>Detecção:</strong> {settings.jiraBoardAutoFields!.map((f) => f.fieldId).join(", ")}
                  </p>
                ) : null}
                <SectionMessage id="options-jira-feedback" message={feedback.jira} />
              </div>
            </div>
          </section>

        <section aria-labelledby="qaf-capture-mode">
            <DsSectionTitle id="qaf-capture-mode">Modo de captura</DsSectionTitle>
            <div className="grid gap-4 md:grid-cols-1">
              <div
                className={`${cardClass} text-left ring-2 ring-[var(--primary-500)] ring-offset-2`}
                role="status"
                aria-label="Debug interno sempre ativo"
              >
                <div className="mb-2 flex items-center justify-between">
                  <Bug className="h-6 w-6 text-[var(--primary-700)]" aria-hidden />
                  <span className="text-xs font-semibold text-[var(--primary-700)]">Sempre ativo</span>
                </div>
                <h3 className="font-[var(--font-sans-2)] text-base font-bold text-[var(--foreground)]">Debug interno</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--color-slate-600)]">
                  Logs técnicos mais completos na issue. Recomendado em homologação. Achados sensíveis seguem na seção dedicada.
                </p>
              </div>
            </div>
          </section>

        <section aria-labelledby="qaf-advanced-capture">
            <DsSectionTitle id="qaf-advanced-capture">Captura avançada</DsSectionTitle>
            <p className="mb-4 text-sm text-[var(--color-slate-600)]">
              HAR e gravação viewport ficam ligados por defeito. Ajuste só o tempo máximo da gravação em vídeo (30–90 s).
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <div
                className={`${cardClass} text-left ring-2 ring-[var(--primary-500)] ring-offset-2`}
                role="status"
                aria-label="HAR diagnostics sempre ativo"
              >
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <Activity className="h-6 w-6 text-[var(--primary-700)]" aria-hidden />
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <span className="text-xs font-semibold text-[var(--primary-700)]">Sempre ativo</span>
                    <span className="rounded-full bg-[var(--color-orange-100)] px-2 py-0.5 text-[0.65rem] font-bold uppercase text-[var(--color-orange-700)]">
                      Requer permissões
                    </span>
                  </div>
                </div>
                <h3 className="font-[var(--font-sans-2)] text-base font-bold text-[var(--foreground)]">
                  HAR diagnostics (captura completa)
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--color-slate-600)]">
                  Grava o tráfego HTTP da aba do feedback para anexar <code className="rounded bg-[var(--color-slate-100)] px-1">.har</code>{" "}
                  no Jira. O aviso de depuração do Chrome pode aparecer em todas as janelas enquanto ativo — só essa aba entra no
                  arquivo. Cookie e Authorization saem como <code className="rounded bg-[var(--color-slate-100)] px-1">[REDACTED]</code>.
                </p>
              </div>

              <div
                className={`${cardClass} text-left ring-2 ring-[var(--primary-500)] ring-offset-2`}
                role="status"
                aria-label="Gravação viewport sempre ativa"
              >
                <div className="mb-2 flex items-center justify-between">
                  <Video className="h-6 w-6 text-[var(--primary-700)]" aria-hidden />
                  <span className="text-xs font-semibold text-[var(--primary-700)]">Sempre ativo</span>
                </div>
                <h3 className="font-[var(--font-sans-2)] text-base font-bold text-[var(--foreground)]">
                  Gravação viewport (WebM)
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--color-slate-600)]">
                  Gravar o conteúdo do separador em vídeo curto (WebM) para anexar no Jira, por ação no formulário. Não grava o
                  ecrã inteiro do sistema. Requer permissão <code className="rounded bg-[var(--color-slate-100)] px-1">tabCapture</code>.
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-[var(--color-slate-200)] pt-4">
                  <label htmlFor="qaf-vrec-max" className="text-xs font-semibold text-[var(--color-slate-600)]">
                    Auto-stop (segundos)
                  </label>
                  <input
                    id="qaf-vrec-max"
                    type="number"
                    min={30}
                    max={90}
                    step={1}
                    value={settings.viewportRecordingMaxSec ?? DEFAULT_VIEWPORT_RECORDING_MAX_SEC}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      const v = Number.isFinite(n)
                        ? Math.max(30, Math.min(90, Math.round(n)))
                        : DEFAULT_VIEWPORT_RECORDING_MAX_SEC;
                      setSettings({ ...settings, viewportRecordingMaxSec: v });
                    }}
                    className={`${inputClass} w-24`}
                  />
                  <span className="text-xs text-[var(--color-slate-500)]">
                    Entre 30 e 90 (padrão {DEFAULT_VIEWPORT_RECORDING_MAX_SEC}).
                  </span>
                </div>
              </div>
            </div>
          </section>

        <section aria-labelledby="qaf-domains">
            <DsSectionTitle id="qaf-domains">Domínios permitidos</DsSectionTitle>
            <div className={cardClass}>
              <div className="mb-4 flex flex-wrap gap-2">
                {hostList.length === 0 ? (
                  <span className="text-sm text-[var(--color-slate-500)]">Nenhum domínio — adicione abaixo.</span>
                ) : (
                  hostList.map((h) => (
                    <span
                      key={h}
                      className="inline-flex items-center gap-1 rounded-full border border-[var(--color-slate-300)] bg-[var(--color-slate-100)] px-3 py-1 text-sm font-medium text-[var(--color-slate-800)]"
                    >
                      {h}
                      <button
                        type="button"
                        className="rounded p-0.5 text-[var(--color-slate-500)] hover:bg-[var(--color-slate-200)] hover:text-[var(--foreground)]"
                        onClick={() => removeHost(h)}
                        aria-label={`Remover ${h}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  ))
                )}
              </div>
              <div className="relative flex gap-2">
                <input
                  type="text"
                  value={domainDraft}
                  onChange={(e) => setDomainDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addDomain();
                    }
                  }}
                  placeholder="Adicionar domínio…"
                  className={`${inputClass} pr-12`}
                  aria-label="Novo domínio"
                />
                <button
                  type="button"
                  className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-[var(--radius-lg)] bg-[var(--primary-700)] text-white hover:bg-[var(--primary-800)]"
                  onClick={addDomain}
                  aria-label="Adicionar domínio"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-3 text-xs text-[var(--color-slate-500)]">
                Alterações aqui são aplicadas ao guardar. Você também pode editar a lista completa:{" "}
                <button
                  type="button"
                  className="font-semibold text-[var(--primary-700)] underline"
                  onClick={() => {
                    const ta = document.getElementById("hosts-raw");
                    if (ta) (ta as HTMLTextAreaElement).focus();
                  }}
                >
                  ver texto bruto
                </button>
                .
              </p>
              <textarea
                id="hosts-raw"
                value={hostsText}
                onChange={(e) => setHostsText(e.target.value)}
                rows={4}
                className={`${inputClass} mt-2 min-h-[5rem] font-mono text-xs`}
                aria-label="Lista de domínios (texto bruto)"
              />
              <SectionMessage id="options-domains-feedback" message={feedback.domains} />
            </div>
          </section>

        <SectionMessage id="options-global-feedback" message={feedback.global} className="mt-6" />

        <div className="mt-10 flex flex-col gap-3 border-t border-[var(--color-slate-200)] pt-8 sm:flex-row sm:justify-end">
          <button
            type="button"
            className={`${btnPrimaryClass} w-full sm:w-auto sm:min-w-[12.5rem]`}
            onClick={() => void onSave()}
          >
            <Save className="h-4 w-4 shrink-0" aria-hidden />
            Salvar
          </button>
        </div>
      </div>

      <footer className="border-t border-[var(--color-slate-200)] bg-[var(--background)] py-6 text-center text-xs text-[var(--color-slate-400)]">
        <span className="inline-flex items-center gap-2">
          <LayoutGrid className="h-3.5 w-3.5" aria-hidden />
          QA Feedback · configurações
        </span>
      </footer>
    </div>
  );
}
