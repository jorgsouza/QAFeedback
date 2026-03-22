import { normalizeGitHubRepoRef } from "./github-repo-normalize";
import type { ExtensionSettings, RepoTarget } from "./types";

export function resolveRepoTargets(settings: ExtensionSettings): RepoTarget[] {
  const seen = new Set<string>();
  const out: RepoTarget[] = [];

  const push = (t: RepoTarget) => {
    const key = `${t.owner}/${t.repo}`.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(t);
  };

  if (Array.isArray(settings.repos)) {
    for (const r of settings.repos) {
      if (!r?.owner || !r?.repo) continue;
      const n = normalizeGitHubRepoRef(r.owner, r.repo);
      if (n.owner && n.repo) push({ owner: n.owner, repo: n.repo, label: r.label });
    }
  }

  if (out.length === 0) {
    const n = normalizeGitHubRepoRef(settings.owner, settings.repo);
    if (n.owner && n.repo) {
      push({ owner: n.owner, repo: n.repo, label: `${n.owner}/${n.repo}` });
    }
  }

  return out;
}

/** Lista segura para o content script (sem token). */
export function repoTargetsForUi(settings: ExtensionSettings): { owner: string; repo: string; label: string }[] {
  return resolveRepoTargets(settings).map((t) => ({
    owner: t.owner,
    repo: t.repo,
    label: (t.label?.trim() || `${t.owner}/${t.repo}`).trim(),
  }));
}

export function parseReposTextarea(text: string): RepoTarget[] {
  const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);
  const out: RepoTarget[] = [];
  for (const line of lines) {
    const t = parseRepoLine(line);
    if (t) out.push(t);
  }
  return dedupeRepoTargets(out);
}

function parseRepoLine(line: string): RepoTarget | null {
  const pipe = line.indexOf("|");
  const data = (pipe >= 0 ? line.slice(0, pipe) : line).trim();
  const labelRaw = pipe >= 0 ? line.slice(pipe + 1).trim() : "";
  if (!data) return null;

  if (data.includes("github.com")) {
    const n = normalizeGitHubRepoRef("", data);
    if (!n.owner || !n.repo) return null;
    return { owner: n.owner, repo: n.repo, label: labelRaw || undefined };
  }

  const parts = data.split("/").filter(Boolean);
  if (parts.length < 2) return null;
  const owner = parts[0];
  const repo = parts.slice(1).join("/");
  const n = normalizeGitHubRepoRef(owner, repo);
  if (!n.owner || !n.repo) return null;
  return { owner: n.owner, repo: n.repo, label: labelRaw || undefined };
}

function dedupeRepoTargets(list: RepoTarget[]): RepoTarget[] {
  const seen = new Set<string>();
  return list.filter((t) => {
    const k = `${t.owner}/${t.repo}`.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function formatReposForTextarea(targets: RepoTarget[]): string {
  return targets
    .map((t) => {
      const slug = `${t.owner}/${t.repo}`;
      const lab = t.label?.trim();
      return lab && lab !== slug ? `${slug}|${lab}` : slug;
    })
    .join("\n");
}

/** Valida se o par pertence à lista configurada. */
export function isAllowedRepoTarget(
  settings: ExtensionSettings,
  owner: string,
  repo: string,
): boolean {
  const n = normalizeGitHubRepoRef(owner, repo);
  if (!n.owner || !n.repo) return false;
  return resolveRepoTargets(settings).some(
    (t) => t.owner.toLowerCase() === n.owner.toLowerCase() && t.repo.toLowerCase() === n.repo.toLowerCase(),
  );
}
