import { describe, expect, it } from "vitest";
import { resolvePageRouteInfo } from "./page-route-context";

function loc(pathname: string, search = ""): Pick<Location, "pathname" | "search"> {
  return { pathname, search };
}

describe("resolvePageRouteInfo", () => {
  it("labels /home", () => {
    const r = resolvePageRouteInfo(loc("/home"));
    expect(r.routeKey).toBe("home");
    expect(r.routeLabel).toBe("Home");
    expect(r.pathname).toBe("/home");
  });

  it("labels root", () => {
    const r = resolvePageRouteInfo(loc("/"));
    expect(r.routeKey).toBe("root");
    expect(r.routeLabel).toBe("Início");
  });

  it("prefers lista-reclamacoes inside empresa before generic empresa", () => {
    const r = resolvePageRouteInfo(loc("/empresa/acme/lista-reclamacoes/"));
    expect(r.routeKey).toBe("lista-reclamacoes");
    expect(r.routeLabel).toContain("Lista de reclamações");
  });

  it("labels empresa slug", () => {
    const r = resolvePageRouteInfo(loc("/empresa/acme/sobre"));
    expect(r.routeKey).toBe("empresa");
    expect(r.routeLabel).toBe("Página da empresa");
  });

  it("labels reclamar flow", () => {
    expect(resolvePageRouteInfo(loc("/reclamar/v2/123")).routeKey).toBe("reclamar");
    expect(resolvePageRouteInfo(loc("/reclamar/")).routeKey).toBe("reclamar");
  });

  it("labels area-da-empresa", () => {
    const r = resolvePageRouteInfo(loc("/area-da-empresa/reclamacoes/todas"));
    expect(r.routeKey).toBe("area-empresa");
  });

  it("uses pathname as label for unknown routes", () => {
    const r = resolvePageRouteInfo(loc("/foo/bar/baz"));
    expect(r.routeKey).toBe("other");
    expect(r.routeLabel).toContain("/foo/bar/baz");
  });

  it("preserves search separately", () => {
    const r = resolvePageRouteInfo(loc("/home", "?x=1"));
    expect(r.routeSearch).toBe("?x=1");
    expect(r.routeKey).toBe("home");
  });

  it("normalizes duplicate slashes", () => {
    const r = resolvePageRouteInfo(loc("//home///"));
    expect(r.pathname).toBe("/home");
    expect(r.routeKey).toBe("home");
  });
});
