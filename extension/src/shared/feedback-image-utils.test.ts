import { describe, expect, it } from "vitest";
import { safeImageFileNameForJira } from "./feedback-image-utils";

describe("safeImageFileNameForJira", () => {
  it("sanitizes special characters", () => {
    expect(safeImageFileNameForJira("captura (1).png")).toBe("captura__1_.png");
  });

  it("defaults when empty", () => {
    expect(safeImageFileNameForJira("")).toBe("screenshot.png");
    expect(safeImageFileNameForJira("   ")).toBe("screenshot.png");
  });
});
