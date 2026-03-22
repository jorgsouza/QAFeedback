import { describe, expect, it } from "vitest";
import { emptySettings } from "./storage";
import {
  formatReposForTextarea,
  isAllowedRepoTarget,
  parseReposTextarea,
  resolveRepoTargets,
} from "./repo-targets";

describe("parseReposTextarea", () => {
  it("parses owner/repo lines", () => {
    const r = parseReposTextarea("a/b\nc/d\n");
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({ owner: "a", repo: "b" });
    expect(r[1]).toMatchObject({ owner: "c", repo: "d" });
  });

  it("parses optional display label after pipe", () => {
    const r = parseReposTextarea("org/repo|Legado");
    expect(r[0]).toMatchObject({ owner: "org", repo: "repo", label: "Legado" });
  });

  it("accepts GitHub URLs", () => {
    const r = parseReposTextarea("https://github.com/foo/bar");
    expect(r).toEqual([expect.objectContaining({ owner: "foo", repo: "bar" })]);
  });
});

describe("formatReposForTextarea", () => {
  it("round-trips slug-only targets", () => {
    const text = formatReposForTextarea([
      { owner: "x", repo: "y" },
      { owner: "a", repo: "b" },
    ]);
    expect(text).toBe("x/y\na/b");
  });

  it("includes label when different from slug", () => {
    const text = formatReposForTextarea([{ owner: "x", repo: "y", label: "Projeto" }]);
    expect(text).toBe("x/y|Projeto");
  });
});

describe("resolveRepoTargets", () => {
  it("uses legacy owner/repo when repos array is empty", () => {
    const s = emptySettings();
    s.owner = "o";
    s.repo = "r";
    expect(resolveRepoTargets(s)).toEqual([expect.objectContaining({ owner: "o", repo: "r" })]);
  });

  it("prefers repos array when present", () => {
    const s = emptySettings();
    s.owner = "legacy";
    s.repo = "legacy";
    s.repos = [{ owner: "a", repo: "b" }];
    expect(resolveRepoTargets(s)).toEqual([expect.objectContaining({ owner: "a", repo: "b" })]);
  });
});

describe("isAllowedRepoTarget", () => {
  it("returns true when owner/repo matches configured list", () => {
    const s = emptySettings();
    s.repos = [{ owner: "MyOrg", repo: "App" }];
    expect(isAllowedRepoTarget(s, "myorg", "app")).toBe(true);
  });

  it("returns false when repo is not in list", () => {
    const s = emptySettings();
    s.repos = [{ owner: "a", repo: "b" }];
    expect(isAllowedRepoTarget(s, "x", "y")).toBe(false);
  });
});
