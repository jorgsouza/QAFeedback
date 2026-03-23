import { afterEach, describe, expect, it, vi } from "vitest";
import {
  detectDictationPlatform,
  getDictationActionPhrase,
  getDictationMicTooltip,
  getDictationPostFocusHint,
  getNativeDictationHintLines,
} from "./native-dictation-hint";

describe("detectDictationPlatform", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("detects Windows", () => {
    vi.stubGlobal("navigator", {
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      platform: "Win32",
    });
    expect(detectDictationPlatform()).toBe("windows");
  });

  it("detects macOS", () => {
    vi.stubGlobal("navigator", {
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
      platform: "MacIntel",
    });
    expect(detectDictationPlatform()).toBe("mac");
  });
});

describe("getNativeDictationHintLines", () => {
  it("includes Win+H for windows", () => {
    const lines = getNativeDictationHintLines("windows");
    expect(lines.some((l) => l.includes("Win + H"))).toBe(true);
  });
});

describe("getDictationPostFocusHint", () => {
  it("prefixes action phrase for windows", () => {
    expect(getDictationPostFocusHint("windows")).toBe(
      "Campo ativo — prima Win + H para abrir o ditado do Windows e falar.",
    );
  });
});

describe("getDictationMicTooltip", () => {
  it("combines field label and action for title on mac", () => {
    const t = getDictationMicTooltip("title", "mac");
    expect(t).toContain("o título");
    expect(t).toContain("macOS");
  });

  it("mentions description field for what target", () => {
    expect(getDictationMicTooltip("what", "linux")).toContain("O que aconteceu");
  });
});

describe("getDictationActionPhrase", () => {
  it("matches tail of post-focus hint", () => {
    expect(getDictationPostFocusHint("windows")).toBe(
      `Campo ativo — ${getDictationActionPhrase("windows")}`,
    );
  });
});
