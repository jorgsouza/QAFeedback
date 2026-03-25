import { describe, expect, it } from "vitest";
import { titleFromDescription } from "./title-from-description";

describe("titleFromDescription", () => {
  it("returns empty for blank", () => {
    expect(titleFromDescription("")).toBe("");
    expect(titleFromDescription("   ")).toBe("");
  });

  it("uses up to four words", () => {
    expect(titleFromDescription("um dois três quatro cinco")).toBe("um dois três quatro");
    expect(titleFromDescription("alpha beta")).toBe("alpha beta");
  });

  it("normalizes whitespace", () => {
    expect(titleFromDescription("  hello   world  foo  ")).toBe("hello world foo");
  });

  it("keeps punctuation attached to words", () => {
    expect(titleFromDescription("Erro! Ao carregar página.")).toBe("Erro! Ao carregar página.");
  });
});
