import { describe, expect, it } from "vitest";
import { normalizeAllowedHostLine, normalizeGitHubRepoRef } from "./github-repo-normalize";

describe("normalizeGitHubRepoRef", () => {
  it("parses owner and repo from a plain slug", () => {
    expect(normalizeGitHubRepoRef("acme", "widget")).toEqual({ owner: "acme", repo: "widget" });
  });

  it("extracts owner and repo from a full GitHub URL in the repo field", () => {
    expect(normalizeGitHubRepoRef("", "https://github.com/octocat/Hello-World")).toEqual({
      owner: "octocat",
      repo: "Hello-World",
    });
  });

  it("strips .git and trailing slash from repo names", () => {
    expect(normalizeGitHubRepoRef("o", "r.git/")).toEqual({ owner: "o", repo: "r" });
  });

  it("parses combined slug in repo when owner is empty", () => {
    expect(normalizeGitHubRepoRef("", "myorg/my-repo")).toEqual({ owner: "myorg", repo: "my-repo" });
  });
});

describe("normalizeAllowedHostLine", () => {
  it("returns hostname without protocol or path", () => {
    expect(normalizeAllowedHostLine("https://app.example.com/path")).toBe("app.example.com");
  });

  it("returns empty string for blank input", () => {
    expect(normalizeAllowedHostLine("   ")).toBe("");
  });
});
