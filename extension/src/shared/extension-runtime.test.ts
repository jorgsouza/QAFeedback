import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isExtensionContextInvalidatedError,
  tryGetExtensionResourceUrl,
} from "./extension-runtime";

describe("isExtensionContextInvalidatedError", () => {
  it("detects Error with Chrome message", () => {
    expect(isExtensionContextInvalidatedError(new Error("Extension context invalidated."))).toBe(true);
  });

  it("detects string message", () => {
    expect(isExtensionContextInvalidatedError("Extension context invalidated.")).toBe(true);
  });

  it("returns false for unrelated errors", () => {
    expect(isExtensionContextInvalidatedError(new Error("network"))).toBe(false);
  });
});

describe("tryGetExtensionResourceUrl", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns null when getURL throws (e.g. extension context invalidated)", () => {
    vi.stubGlobal("chrome", {
      runtime: {
        getURL: () => {
          throw new Error("Extension context invalidated.");
        },
      },
    } as unknown as typeof chrome);
    expect(tryGetExtensionResourceUrl("qa.png")).toBe(null);
  });

  it("returns mapped URL when chrome.runtime.getURL works", () => {
    vi.stubGlobal("chrome", {
      runtime: {
        getURL: (path: string) => `chrome-extension://fake/${path}`,
      },
    } as unknown as typeof chrome);
    expect(tryGetExtensionResourceUrl("qa.png")).toBe("chrome-extension://fake/qa.png");
  });
});
