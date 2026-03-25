import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  DEFAULT_ALLOWED_HOSTS,
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

/** Quadros mostrados no menu das opções: mesma allowlist que o painel (BOARD_ID / VITE_… no .env → build). */
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
}: {
  id: string;
  message: string | null;
  style?: CSSProperties;
}) {
  if (!message) return null;
  return (
    <p
      id={id}
      role="status"
      aria-live="polite"
      style={{
        marginTop: 12,
        marginBottom: 0,
        padding: 12,
        borderRadius: 8,
        background: "#f8fafc",
        border: "1px solid #e2e8f0",
        fontSize: 14,
        lineHeight: 1.5,
        ...style,
      }}
    >
      {message}
    </p>
  );
}

function StatusBadge({ children, tone }: { children: ReactNode; tone: "neutral" | "ok" | "warn" | "load" }) {
  const bg =
    tone === "ok"
      ? "#dcfce7"
      : tone === "warn"
        ? "#ffedd5"
        : tone === "load"
          ? "#e0f2fe"
          : "#f1f5f9";
  const color =
    tone === "ok"
      ? "#166534"
      : tone === "warn"
        ? "#9a3412"
        : tone === "load"
          ? "#0369a1"
          : "#475569";
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        padding: "4px 8px",
        borderRadius: 999,
        background: bg,
        color,
        flexShrink: 0,
      }}
    >
      {children}
    </span>
  );
}

function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <h2
      style={{
        margin: "20px 0 10px",
        fontSize: 15,
        fontWeight: 700,
        color: "#0f172a",
        borderBottom: "1px solid #e2e8f0",
        paddingBottom: 6,
      }}
    >
      {children}
    </h2>
  );
}

export function OptionsApp() {
  const [settings, setSettings] = useState<ExtensionSettings>(emptySettings());
  const [reposText, setReposText] = useState("");
  const [hostsText, setHostsText] = useState(hostsToText(DEFAULT_ALLOWED_HOSTS));
  const [loaded, setLoaded] = useState(false);
  const [feedback, setFeedback] = useState<OptionsSectionFeedback>(emptySectionFeedback);
  const [testing, setTesting] = useState(false);
  const [testingJira, setTestingJira] = useState(false);
  /** Listagem automática de quadros (email + token válidos). */
  const [jiraBoardsLoading, setJiraBoardsLoading] = useState(false);
  const [jiraBoards, setJiraBoards] = useState<{ id: number; name: string; type: string }[]>([]);
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

  /** Após email + token (e site inferível), lista todos os quadros sem precisar de botão. */
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

  /** ID guardado deixou de existir na nova lista (ex.: mudou de conta). */
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
        /** Resposta com boardId ≠ lista completa: só o quadro do projeto. Recarregar lista global sem perder o menu. */
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

  const githubBadge = useMemo(() => {
    if (testing) return { label: "A testar…", tone: "load" as const };
    if (settings.githubToken.trim()) return { label: "Token preenchido", tone: "ok" as const };
    return { label: "Sem token", tone: "neutral" as const };
  }, [testing, settings.githubToken]);

  const jiraBadge = useMemo(() => {
    if (testingJira) return { label: "A aplicar quadro…", tone: "load" as const };
    if (jiraBoardsLoading) return { label: "A carregar quadros…", tone: "load" as const };
    if (!jiraCredsReady) return { label: "Conexão incompleta", tone: "warn" as const };
    if (jiraBoards.length > 0) return { label: `${jiraBoards.length} quadro(s)`, tone: "ok" as const };
    return { label: "Sem quadros no menu", tone: "neutral" as const };
  }, [testingJira, jiraBoardsLoading, jiraCredsReady, jiraBoards.length]);

  if (!loaded) {
    return <p style={{ fontFamily: "system-ui", padding: 16 }}>Carregando…</p>;
  }

  return (
    <div
      style={{
        fontFamily: "system-ui, sans-serif",
        maxWidth: 640,
        margin: "24px auto",
        padding: "0 16px",
        color: "#0f172a",
      }}
    >
      <style>{`
        details.qaf-opt-acc {
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          margin-top: 16px;
          overflow: hidden;
          background: #fff;
        }
        details.qaf-opt-acc > summary {
          cursor: pointer;
          font-weight: 700;
          font-size: 16px;
          padding: 14px 16px;
          list-style: none;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          color: #0f172a;
          background: #f8fafc;
          user-select: none;
        }
        details.qaf-opt-acc[open] > summary {
          border-bottom: 1px solid #e2e8f0;
        }
        details.qaf-opt-acc > summary::-webkit-details-marker {
          display: none;
        }
        .qaf-opt-acc-body {
          padding: 16px;
        }
        .qaf-opt-acc-chev {
          color: #64748b;
          font-size: 14px;
          line-height: 1;
          transition: transform 0.2s ease;
          flex-shrink: 0;
        }
        details.qaf-opt-acc[open] .qaf-opt-acc-chev {
          transform: rotate(90deg);
        }
        details.qaf-opt-help {
          margin-bottom: 16px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          background: #fff;
          overflow: hidden;
        }
        details.qaf-opt-help > summary {
          cursor: pointer;
          font-weight: 600;
          font-size: 14px;
          padding: 10px 12px;
          color: #334155;
          background: #f8fafc;
          list-style: none;
          user-select: none;
        }
        details.qaf-opt-help > summary::-webkit-details-marker {
          display: none;
        }
        details.qaf-opt-help[open] > summary {
          border-bottom: 1px solid #e2e8f0;
        }
        .qaf-opt-help-inner {
          padding: 12px 14px;
          font-size: 14px;
          color: #334155;
          background: #fafafa;
        }
      `}</style>

      <h1 style={{ fontSize: 22 }}>QA Feedback — GitHub e Jira</h1>
      <p style={{ color: "#475569", fontSize: 14, marginBottom: 0 }}>
        Expanda cada secção. GitHub: PAT com permissão <strong>Issues</strong>. Jira:{" "}
        <a href="https://id.atlassian.com/manage-profile/security/api-tokens" target="_blank" rel="noreferrer">
          API token
        </a>{" "}
        e e-mail Atlassian. Ao <strong>Salvar</strong>, o Chrome pode pedir permissão para os domínios listados.
      </p>

      <details className="qaf-opt-acc" open>
        <summary>
          <span style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span>GitHub</span>
            <StatusBadge tone={githubBadge.tone}>{githubBadge.label}</StatusBadge>
          </span>
          <span className="qaf-opt-acc-chev" aria-hidden>
            ▸
          </span>
        </summary>
        <div className="qaf-opt-acc-body">
          <details className="qaf-opt-help">
            <summary>Como criar o token fine-grained (passo a passo)</summary>
            <div className="qaf-opt-help-inner">
              <ol style={{ margin: 0, paddingLeft: 22, lineHeight: 1.6 }}>
                <li style={{ marginBottom: 8 }}>
                  Aceda a{" "}
                  <a
                    href="https://github.com/settings/personal-access-tokens"
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: "#2563eb", fontWeight: 600 }}
                  >
                    github.com/settings/personal-access-tokens
                  </a>
                  . Na secção <strong>Fine-grained personal access tokens</strong>, clique em{" "}
                  <strong>Generate new token</strong> e escolha a opção fine-grained.
                </li>
                <li style={{ marginBottom: 8 }}>
                  Em <strong>Token name</strong>, escreva{" "}
                  <code style={{ background: "#e2e8f0", padding: "1px 6px", borderRadius: 4 }}>QAFeedback</code> (assim
                  fica fácil de reconhecer no GitHub).
                </li>
                <li style={{ marginBottom: 8 }}>
                  Em <strong>Repository access</strong>, inclua os repositórios onde o QA vai abrir issues (por exemplo{" "}
                  <em>Only select repositories</em> e escolha os projetos, ou outra opção adequada à conta).
                </li>
                <li style={{ marginBottom: 8 }}>
                  Em <strong>Permissions</strong> → separador <strong>Repositories</strong> →{" "}
                  <strong>Add permissions</strong> → procure <strong>Issues</strong> e defina{" "}
                  <strong>Read and write</strong>. <strong>Não precisa de outras permissões</strong> para esta extensão.
                </li>
                <li>
                  Clique em <strong>Generate token</strong>, copie o valor e cole no campo <strong>GitHub token</strong>{" "}
                  abaixo (o GitHub só mostra o token completo uma vez).
                </li>
              </ol>
            </div>
          </details>

          <section style={{ marginTop: 20 }}>
            <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }} htmlFor="token">
              GitHub token
            </label>
            <input
              id="token"
              type="password"
              autoComplete="off"
              value={settings.githubToken}
              onChange={(e) => setSettings({ ...settings, githubToken: e.target.value })}
              style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #cbd5e1" }}
            />
            <p style={{ fontSize: 13, color: "#64748b", marginTop: 8, marginBottom: 0 }}>
              <strong>Testar conexão</strong> valida o token e <strong>preenche a lista</strong> com os repositórios que
              a API permite ver (até milhares, em páginas de 100).
            </p>
            <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" onClick={onTest} disabled={testing} style={btnPrimary}>
                {testing ? "Carregando…" : "Testar conexão e listar repos"}
              </button>
              <button type="button" onClick={onClearToken} style={btnGhost}>
                Apagar token
              </button>
            </div>
          </section>

          <section style={{ marginTop: 20 }}>
            <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }} htmlFor="repos">
              Repositórios destino (um por linha)
            </label>
            <textarea
              id="repos"
              value={reposText}
              onChange={(e) => setReposText(e.target.value)}
              rows={8}
              style={{
                width: "100%",
                padding: 8,
                borderRadius: 8,
                border: "1px solid #cbd5e1",
                fontFamily: "monospace",
                fontSize: 13,
              }}
              placeholder={"jorgsouza/meu-repo\norg/outro-repo|Projeto legado\nhttps://github.com/org/repo"}
            />
            <p style={{ fontSize: 13, color: "#64748b", marginTop: 6 }}>
              Formato: <code>owner/repo</code>, URL do GitHub ou <code>owner/repo|Nome no menu</code>. Pode ficar vazio
              se usar só Jira.
            </p>
          </section>

          <SectionMessage id="options-github-feedback" message={feedback.github} />
        </div>
      </details>

      <details className="qaf-opt-acc">
        <summary>
          <span style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span>Jira Cloud (Atlassian)</span>
            <StatusBadge tone={jiraBadge.tone}>{jiraBadge.label}</StatusBadge>
          </span>
          <span className="qaf-opt-acc-chev" aria-hidden>
            ▸
          </span>
        </summary>
        <div className="qaf-opt-acc-body">
          <p style={{ fontSize: 13, color: "#64748b", marginTop: 0, marginBottom: 12, lineHeight: 1.5 }}>
            Com <strong>e-mail @empresa</strong> (ex. <code>@reclameaqui.com.br</code>) inferimos{" "}
            <code>https://reclameaqui.atlassian.net</code>. Gmail/Hotmail não inferem site — use{" "}
            <strong>Avançado</strong>. O <strong>ID do quadro</strong> obtém a chave do projeto e o JQL do filtro na
            API.
          </p>

          <SectionHeading>Conexão</SectionHeading>
          <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }} htmlFor="jira-email">
            E-mail Atlassian
          </label>
          <input
            id="jira-email"
            type="email"
            autoComplete="off"
            value={settings.jiraEmail ?? ""}
            onChange={(e) => setSettings({ ...settings, jiraEmail: e.target.value })}
            style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #cbd5e1" }}
          />

          <details className="qaf-opt-help" style={{ marginTop: 14 }}>
            <summary>Como criar o API token Jira (ajuda passo a passo)</summary>
            <div className="qaf-opt-help-inner">
              <ol style={{ margin: 0, paddingLeft: 22, lineHeight: 1.6 }}>
                <li style={{ marginBottom: 8 }}>
                  Inicie sessão na Atlassian e abra{" "}
                  <a
                    href="https://id.atlassian.com/manage-profile/security/api-tokens"
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: "#2563eb", fontWeight: 600 }}
                  >
                    id.atlassian.com/manage-profile/security/api-tokens
                  </a>
                  .
                </li>
                <li style={{ marginBottom: 8 }}>
                  Clique em <strong>Create API token</strong>, dê um nome reconhecível (ex.{" "}
                  <code style={{ background: "#e2e8f0", padding: "1px 6px", borderRadius: 4 }}>QAFeedback</code>) e
                  confirme.
                </li>
                <li style={{ marginBottom: 8 }}>
                  Copie o token <strong>na hora</strong> (a Atlassian não o mostra outra vez) e cole no campo{" "}
                  <strong>API token Jira</strong> abaixo.
                </li>
                <li>
                  Use o <strong>mesmo e-mail</strong> da conta Atlassian que aparece no Jira (autenticação nas chamadas
                  REST).
                </li>
              </ol>
            </div>
          </details>

          <label style={{ display: "block", fontWeight: 600, marginBottom: 6, marginTop: 16 }} htmlFor="jira-token">
            API token Jira
          </label>
          <input
            id="jira-token"
            type="password"
            autoComplete="off"
            value={settings.jiraApiToken ?? ""}
            onChange={(e) => setSettings({ ...settings, jiraApiToken: e.target.value })}
            style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #cbd5e1" }}
          />

          <details style={{ marginTop: 14, fontSize: 13, color: "#475569" }}>
            <summary style={{ cursor: "pointer", fontWeight: 600, color: "#0f172a" }}>
              Avançado — site manual, chave do projeto, override do filtro
            </summary>
            <p style={{ marginTop: 10, marginBottom: 10, lineHeight: 1.5 }}>
              Só se a inferência do site pelo e-mail falhar (domínio ≠ subdomínio Atlassian), ou se a leitura do JQL não
              preencher um select — aí pode forçar <code>customfield_…</code> e o texto exacto da opção.
            </p>
            <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }} htmlFor="jira-site">
              Site Atlassian (https://…atlassian.net ou URL com /boards/N/…)
            </label>
            <input
              id="jira-site"
              type="url"
              autoComplete="off"
              placeholder="Deixe vazio para inferir pelo e-mail @empresa"
              value={settings.jiraSiteUrl ?? ""}
              onChange={(e) => setSettings({ ...settings, jiraSiteUrl: e.target.value })}
              style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #cbd5e1" }}
            />
            <label style={{ display: "block", fontWeight: 600, marginBottom: 6, marginTop: 12 }} htmlFor="jira-project">
              Chave do projeto (só se não usar ID de quadro ou quiser corrigir)
            </label>
            <input
              id="jira-project"
              type="text"
              autoComplete="off"
              placeholder="Preenchida automaticamente ao testar com ID do quadro"
              value={settings.jiraProjectKey ?? ""}
              onChange={(e) => setSettings({ ...settings, jiraProjectKey: e.target.value })}
              style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #cbd5e1" }}
            />
            <label style={{ display: "block", fontWeight: 600, marginBottom: 6, marginTop: 14 }} htmlFor="jira-board-filter-field">
              Override — ID do campo select
            </label>
            <input
              id="jira-board-filter-field"
              type="text"
              autoComplete="off"
              placeholder="ex. customfield_12071 (Squad) — raro: o filtro costuma bastar"
              value={settings.jiraBoardFilterSelectFieldId ?? ""}
              onChange={(e) => setSettings({ ...settings, jiraBoardFilterSelectFieldId: e.target.value })}
              style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #cbd5e1", fontFamily: "monospace", fontSize: 13 }}
            />
            <label style={{ display: "block", fontWeight: 600, marginBottom: 6, marginTop: 10 }} htmlFor="jira-board-filter-value">
              Override — valor da opção
            </label>
            <input
              id="jira-board-filter-value"
              type="text"
              autoComplete="off"
              placeholder="Texto exacto da opção no Jira"
              value={settings.jiraBoardFilterSelectValue ?? ""}
              onChange={(e) => setSettings({ ...settings, jiraBoardFilterSelectValue: e.target.value })}
              style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #cbd5e1" }}
            />
          </details>

          <SectionHeading>Board padrão</SectionHeading>
          {jiraBoardsLoading ? (
            <p
              role="status"
              aria-live="polite"
              style={{
                margin: "0 0 10px",
                fontSize: 13,
                color: "#0369a1",
                fontWeight: 600,
              }}
            >
              Jira: a contactar a API e atualizar a lista de quadros…
            </p>
          ) : null}
          <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }} htmlFor="jira-board-select">
            Quadro Software — backlog destino
          </label>
          <select
            id="jira-board-select"
            value={settings.jiraSoftwareBoardId ?? ""}
            disabled={!jiraCredsReady || jiraBoardsLoading || testingJira}
            onChange={(e) => void onJiraBoardSelect(e.target.value)}
            style={{
              width: "100%",
              padding: 8,
              borderRadius: 8,
              border: "1px solid #cbd5e1",
              fontSize: 14,
              background: "#fff",
            }}
          >
            <option value="">
              {jiraBoardsLoading
                ? "A carregar quadros…"
                : !jiraCredsReady
                  ? "Preencha e-mail Atlassian e API token"
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
          <p style={{ fontSize: 13, color: "#64748b", marginTop: 6, marginBottom: 0 }}>
            Com <strong>e-mail</strong> e <strong>token</strong> válidos, a lista de quadros carrega automaticamente
            (como os repositórios no GitHub). Ao <strong>escolher um quadro</strong>, confirmamos o site, a{" "}
            <strong>chave do projeto</strong> e o <strong>filtro do quadro</strong> (Squad, etc.) e guardamos — não é
            preciso botão de teste. O motivo da abertura continua na descrição ao criar issues.
          </p>
          {builtInJiraBoardAllowlistIds().length > 0 ? (
            <p style={{ fontSize: 12, color: "#64748b", marginTop: 8, marginBottom: 0, lineHeight: 1.45 }}>
              O menu acima mostra só quadros cujos IDs estão em{" "}
              <code style={{ background: "#f1f5f9", padding: "1px 5px", borderRadius: 4 }}>BOARD_ID</code> ou{" "}
              <code style={{ background: "#f1f5f9", padding: "1px 5px", borderRadius: 4 }}>VITE_JIRA_BOARD_ALLOWLIST</code>{" "}
              no <code>.env</code> (definido em tempo de <code>npm run build</code>). Para alterar a lista, edite o{" "}
              <code>.env</code> na raiz ou em <code>extension/</code> e reconstrua a extensão.
            </p>
          ) : null}
          {(settings.jiraProjectKey ?? "").trim() ? (
            <p
              style={{
                fontSize: 13,
                color: "#334155",
                marginTop: 10,
                marginBottom: 0,
                padding: "8px 10px",
                background: "#f8fafc",
                borderRadius: 8,
                border: "1px solid #e2e8f0",
              }}
            >
              <strong>Chave do projeto (guardada):</strong> {settings.jiraProjectKey}
              {resolveJiraCloudBaseUrl(settings.jiraSiteUrl ?? "", settings.jiraEmail ?? "") ? (
                <>
                  {" "}
                  · <strong>Site:</strong>{" "}
                  {resolveJiraCloudBaseUrl(settings.jiraSiteUrl ?? "", settings.jiraEmail ?? "")}
                </>
              ) : null}
            </p>
          ) : null}
          {(settings.jiraBoardAutoFields?.length ?? 0) > 0 ? (
            <p
              style={{
                fontSize: 13,
                color: "#0f766e",
                marginTop: 10,
                marginBottom: 0,
                padding: "8px 10px",
                background: "#f0fdfa",
                borderRadius: 8,
                border: "1px solid #99f6e4",
              }}
            >
              <strong>Deteção guardada:</strong>{" "}
              {settings.jiraBoardAutoFields!.map((f) => f.fieldId).join(", ")} — aplicado ao criar issues.
            </p>
          ) : null}

          <SectionMessage id="options-jira-feedback" message={feedback.jira} />
        </div>
      </details>

      <section
        style={{
          marginTop: 24,
          padding: 16,
          borderRadius: 10,
          border: "1px solid #e2e8f0",
          background: "#f8fafc",
        }}
      >
        <SectionHeading>Captura avançada</SectionHeading>
        <label
          style={{ display: "flex", gap: 12, alignItems: "flex-start", cursor: "pointer", fontWeight: 600 }}
        >
          <input
            type="checkbox"
            checked={Boolean(settings.fullNetworkDiagnostic)}
            onChange={(e) => setSettings({ ...settings, fullNetworkDiagnostic: e.target.checked })}
            style={{ marginTop: 3, flexShrink: 0 }}
          />
          <span>
            Modo diagnóstico completo (captura HAR para o Jira)
            <span
              style={{
                display: "block",
                fontWeight: 400,
                fontSize: 13,
                color: "#64748b",
                marginTop: 8,
                lineHeight: 1.55,
              }}
            >
              Com o modal de feedback aberto, a extensão regista o tráfego HTTP da aba e pode anexar um ficheiro{" "}
              <code style={{ background: "#e2e8f0", padding: "1px 5px", borderRadius: 4 }}>.har</code> ao criar a issue
              no Jira. Requer a permissão de <strong>depurador</strong> do Chrome; se a captura falhar, feche o{" "}
              <strong>DevTools nesta aba</strong> e tente de novo. Cabeçalhos como Cookie e Authorization são substituídos
              por <code>[REDACTED]</code> no ficheiro exportado.
            </span>
          </span>
        </label>
      </section>

      <section style={{ marginTop: 20 }}>
        <SectionHeading>Domínios</SectionHeading>
        <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }} htmlFor="hosts">
          Domínios permitidos (um por linha)
        </label>
        <textarea
          id="hosts"
          value={hostsText}
          onChange={(e) => setHostsText(e.target.value)}
          rows={6}
          style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #cbd5e1" }}
        />
        <p style={{ fontSize: 13, color: "#64748b", marginTop: 6 }}>
          Padrão: localhost e 127.0.0.1. Ao salvar, o Chrome pode pedir permissão para cada host novo.
        </p>
        <SectionMessage id="options-domains-feedback" message={feedback.domains} />
      </section>

      <div style={{ marginTop: 20 }}>
        <button type="button" onClick={() => void onSave()} style={btnPrimary}>
          Salvar
        </button>
      </div>

      <SectionMessage id="options-global-feedback" message={feedback.global} style={{ marginTop: 16 }} />
    </div>
  );
}

const btnPrimary: CSSProperties = {
  padding: "8px 14px",
  borderRadius: 8,
  border: "none",
  background: "#2563eb",
  color: "#fff",
  fontWeight: 600,
  cursor: "pointer",
};

const btnGhost: CSSProperties = {
  padding: "8px 14px",
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  background: "#fff",
  fontWeight: 600,
  cursor: "pointer",
};
