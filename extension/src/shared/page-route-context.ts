/**
 * Resolve um rótulo amigável e chave estável a partir do pathname (Reclame AQUI e sites genéricos).
 * Regras ordenadas: mais específico primeiro. Não depende de `routes.go` em runtime.
 */
export type PageRouteInfo = {
  pathname: string;
  routeSearch: string;
  routeLabel: string;
  routeKey: string;
};

type Rule = { test: (pathname: string) => boolean; key: string; label: string };

const RULES: Rule[] = [
  { test: (p) => p === "/home" || p === "/home/", key: "home", label: "Home" },
  { test: (p) => p === "/" || p === "", key: "root", label: "Início" },
  {
    test: (p) => p.includes("/lista-reclamacoes"),
    key: "lista-reclamacoes",
    label: "Lista de reclamações (empresa)",
  },
  {
    test: (p) => p === "/empresa" || p.startsWith("/empresa/"),
    key: "empresa",
    label: "Página da empresa",
  },
  {
    test: (p) => p === "/reclamar" || p.startsWith("/reclamar/"),
    key: "reclamar",
    label: "Reclamar",
  },
  { test: (p) => p.startsWith("/area-da-empresa"), key: "area-empresa", label: "Área da empresa" },
  {
    test: (p) => p.startsWith("/cadastro-de-empresa") || p.startsWith("/cadastro-empresa/"),
    key: "cadastro-empresa",
    label: "Cadastro empresa",
  },
];

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
      return { pathname, routeSearch, routeLabel: r.label, routeKey: r.key };
    }
  }

  const display = pathname.length > 52 ? `${pathname.slice(0, 49)}…` : pathname;
  return {
    pathname,
    routeSearch,
    routeLabel: display,
    routeKey: "other",
  };
}
