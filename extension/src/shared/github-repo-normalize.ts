/** Remove sufixos comuns colados junto ao nome do repositório. */
function stripRepoName(name: string): string {
  return name
    .trim()
    .replace(/\.git$/i, "")
    .replace(/\/issues\/?$/i, "")
    .replace(/\/$/, "");
}

/**
 * Converte entradas como URL do GitHub ou `owner/repo` em par válido para a API
 * (`/repos/{owner}/{repo}`).
 */
export function normalizeGitHubRepoRef(
  ownerInput: string,
  repoInput: string,
): { owner: string; repo: string } {
  let owner = ownerInput.trim();
  let repo = repoInput.trim();

  const ghInPath = /github\.com\/([^/]+)\/([^/#?]+)/i;

  const fromRepo = repo.match(ghInPath);
  if (fromRepo) {
    return { owner: fromRepo[1], repo: stripRepoName(fromRepo[2]) };
  }

  const fromOwner = owner.match(ghInPath);
  if (fromOwner) {
    return { owner: fromOwner[1], repo: stripRepoName(fromOwner[2]) };
  }

  repo = stripRepoName(repo);

  if (!repo.includes("github.com") && /^[a-z0-9_.-]+\/[a-z0-9_.-]+$/i.test(repo)) {
    const [o, r] = repo.split("/");
    return { owner: o, repo: stripRepoName(r) };
  }

  return { owner, repo: stripRepoName(repo) };
}

/** Uma linha de domínio: aceita URL completa e devolve só o host. */
export function normalizeAllowedHostLine(line: string): string {
  const s = line.trim();
  if (!s) return "";
  const withoutProto = s.replace(/^https?:\/\//i, "");
  return withoutProto.split("/")[0].split(":")[0].trim();
}
