/**
 * Resolve slug técnico (`ra-*`), rótulo PT e chave a partir do pathname (Reclame AQUI e sites genéricos).
 * Regras ordenadas: mais específico primeiro. Não depende de `routes.go` em runtime.
 */
export type PageRouteInfo = {
  pathname: string;
  routeSearch: string;
  /** Identificador estável em kebab-case para UI e filtros (ex.: ra-notifications). */
  routeSlug: string;
  /** Rótulo em português (útil na descrição Markdown). */
  routeLabel: string;
  routeKey: string;
};

type Rule = { test: (pathname: string) => boolean; key: string; label: string; slug: string };

const RULES: Rule[] = [
  {
    test: (p) => p === "/minha-conta/notificacoes" || p.startsWith("/minha-conta/notificacoes/"),
    key: "minha-conta-notificacoes",
    slug: "ra-notifications",
    label: "Notificações (minha conta)",
  },
  { test: (p) => p === "/home" || p === "/home/", key: "home", slug: "ra-home", label: "Home" },
  { test: (p) => p === "/" || p === "", key: "root", slug: "ra-root", label: "Início" },
  {
    test: (p) => p.includes("/lista-reclamacoes"),
    key: "lista-reclamacoes",
    slug: "ra-company-complaint-list",
    label: "Lista de reclamações (empresa)",
  },
  {
    test: (p) => p === "/empresa" || p.startsWith("/empresa/"),
    key: "empresa",
    slug: "ra-company",
    label: "Página da empresa",
  },
  {
    test: (p) => p === "/reclamar" || p.startsWith("/reclamar/"),
    key: "reclamar",
    slug: "ra-complaint-flow",
    label: "Reclamar",
  },
  {
    test: (p) => p.startsWith("/area-da-empresa"),
    key: "area-empresa",
    slug: "ra-business-area",
    label: "Área da empresa",
  },
  {
    test: (p) => p.startsWith("/cadastro-de-empresa") || p.startsWith("/cadastro-empresa/"),
    key: "cadastro-empresa",
    slug: "ra-business-signup",
    label: "Cadastro empresa",
  },
];

/** Fallback: path em kebab-case com prefixo `ra-` (ex.: /foo/bar → ra-foo-bar). */
export function pathnameToFallbackSlug(pathname: string): string {
  const inner = pathname.replace(/^\/+|\/+$/g, "").replace(/\//g, "-");
  if (!inner) return "ra-root";
  const safe = inner
    .replace(/[^a-zA-Z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  const base = `ra-${safe}`;
  return base.length > 64 ? base.slice(0, 64) : base;
}

function normalizePathname(raw: string): string {
  let p = raw.trim().replace(/\/+/g, "/");
  if (!p.startsWith("/")) p = `/${p}`;
  if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
  return p || "/";
}

export function resolvePageRouteInfo(loc: Pick<Location, "pathname" | "search">): PageRouteInfo {
  const pathname = normalizePathname(loc.pathname || "/");
  const routeSearch = loc.search?.trim() ?? "";

  for (const r of RULES) {
    if (r.test(pathname)) {
      return {
        pathname,
        routeSearch,
        routeSlug: r.slug,
        routeLabel: r.label,
        routeKey: r.key,
      };
    }
  }

  const slug = pathnameToFallbackSlug(pathname);
  const display = pathname.length > 52 ? `${pathname.slice(0, 49)}…` : pathname;
  return {
    pathname,
    routeSearch,
    routeSlug: slug,
    routeLabel: display,
    routeKey: "other",
  };
}
