import { describe, expect, it } from "vitest";
import { pathnameToFallbackSlug, resolvePageRouteInfo } from "./page-route-context";

function loc(pathname: string, search = ""): Pick<Location, "pathname" | "search"> {
  return { pathname, search };
}

describe("resolvePageRouteInfo", () => {
  it("uses ra-notifications for minha-conta notificações", () => {
    const r = resolvePageRouteInfo(loc("/minha-conta/notificacoes"));
    expect(r.routeSlug).toBe("ra-notifications");
    expect(r.routeKey).toBe("minha-conta-notificacoes");
    expect(r.pathname).toBe("/minha-conta/notificacoes");
  });

  it("labels /home", () => {
    const r = resolvePageRouteInfo(loc("/home"));
    expect(r.routeKey).toBe("home");
    expect(r.routeSlug).toBe("ra-home");
    expect(r.routeLabel).toBe("Home");
    expect(r.pathname).toBe("/home");
  });

  it("labels root", () => {
    const r = resolvePageRouteInfo(loc("/"));
    expect(r.routeKey).toBe("root");
    expect(r.routeSlug).toBe("ra-root");
    expect(r.routeLabel).toBe("Início");
  });

  it("prefers lista-reclamacoes inside empresa before generic empresa", () => {
    const r = resolvePageRouteInfo(loc("/empresa/acme/lista-reclamacoes/"));
    expect(r.routeKey).toBe("lista-reclamacoes");
    expect(r.routeSlug).toBe("ra-company-complaint-list");
    expect(r.routeLabel).toContain("Lista de reclamações");
  });

  it("labels empresa slug", () => {
    const r = resolvePageRouteInfo(loc("/empresa/acme/sobre"));
    expect(r.routeKey).toBe("empresa");
    expect(r.routeSlug).toBe("ra-company");
    expect(r.routeLabel).toBe("Página da empresa");
  });

  it("labels reclamar flow", () => {
    expect(resolvePageRouteInfo(loc("/reclamar/v2/123")).routeSlug).toBe("ra-complaint-flow");
    expect(resolvePageRouteInfo(loc("/reclamar/")).routeSlug).toBe("ra-complaint-flow");
  });

  it("labels area-da-empresa", () => {
    const r = resolvePageRouteInfo(loc("/area-da-empresa/reclamacoes/todas"));
    expect(r.routeKey).toBe("area-empresa");
    expect(r.routeSlug).toBe("ra-business-area");
  });

  it("uses fallback slug for unknown routes", () => {
    const r = resolvePageRouteInfo(loc("/foo/bar/baz"));
    expect(r.routeKey).toBe("other");
    expect(r.routeSlug).toBe("ra-foo-bar-baz");
    expect(r.routeLabel).toContain("/foo/bar/baz");
  });

  it("preserves search separately", () => {
    const r = resolvePageRouteInfo(loc("/home", "?x=1"));
    expect(r.routeSearch).toBe("?x=1");
    expect(r.routeSlug).toBe("ra-home");
  });

  it("normalizes duplicate slashes", () => {
    const r = resolvePageRouteInfo(loc("//home///"));
    expect(r.pathname).toBe("/home");
    expect(r.routeSlug).toBe("ra-home");
  });
});

describe("pathnameToFallbackSlug", () => {
  it("prefixes ra- and joins segments", () => {
    expect(pathnameToFallbackSlug("/minha-conta/perfil")).toBe("ra-minha-conta-perfil");
  });
});
