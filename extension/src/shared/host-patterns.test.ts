import { describe, expect, it } from "vitest";
import {
  hostnameAllowedByList,
  matchPatternsForAllowedHost,
  urlMatchesAllowedHosts,
} from "./host-patterns";

describe("hostnameAllowedByList", () => {
  it("aceita host exato e subdomínio quando a base tem ponto", () => {
    const allowed = ["reclameaqui.com.br"];
    expect(hostnameAllowedByList("reclameaqui.com.br", allowed)).toBe(true);
    expect(hostnameAllowedByList("www.reclameaqui.com.br", allowed)).toBe(true);
    expect(hostnameAllowedByList("m.reclameaqui.com.br", allowed)).toBe(true);
    expect(hostnameAllowedByList("evil.com", allowed)).toBe(false);
  });

  it("com www na lista, só casa esse host e subdomínios dele", () => {
    const allowed = ["www.reclameaqui.com.br"];
    expect(hostnameAllowedByList("www.reclameaqui.com.br", allowed)).toBe(true);
    expect(hostnameAllowedByList("api.www.reclameaqui.com.br", allowed)).toBe(true);
    expect(hostnameAllowedByList("m.reclameaqui.com.br", allowed)).toBe(false);
  });

  it("localhost e 127.0.0.1 são estritos", () => {
    expect(hostnameAllowedByList("localhost", ["localhost"])).toBe(true);
    expect(hostnameAllowedByList("sub.localhost", ["localhost"])).toBe(false);
    expect(hostnameAllowedByList("127.0.0.1", ["127.0.0.1"])).toBe(true);
  });
});

describe("urlMatchesAllowedHosts", () => {
  it("só http(s)", () => {
    expect(urlMatchesAllowedHosts("https://www.reclameaqui.com.br/x", ["reclameaqui.com.br"])).toBe(true);
    expect(urlMatchesAllowedHosts("http://localhost:3000/", ["localhost"])).toBe(true);
    expect(urlMatchesAllowedHosts("chrome-extension://abc/options.html", ["localhost"])).toBe(false);
    expect(urlMatchesAllowedHosts("about:blank", ["localhost"])).toBe(false);
  });

  it("alinha com padrões de registo (ex.: subdomínio)", () => {
    const host = "reclameaqui.com.br";
    const patterns = matchPatternsForAllowedHost(host);
    expect(patterns.some((p) => p.includes("*.reclameaqui.com.br"))).toBe(true);
    expect(urlMatchesAllowedHosts("https://www.reclameaqui.com.br/", [host])).toBe(true);
  });
});
