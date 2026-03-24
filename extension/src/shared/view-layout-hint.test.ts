import { describe, expect, it } from "vitest";
import { buildViewModeHint } from "./view-layout-hint";

describe("buildViewModeHint", () => {
  it("sinaliza possível emulação quando viewport é estreito e o ecrã é grande", () => {
    const h = buildViewModeHint({
      innerWidth: 390,
      innerHeight: 844,
      screenWidth: 1920,
      screenHeight: 1080,
      maxTouchPoints: 0,
      pointerCoarse: false,
    });
    expect(h).toContain("emulação");
    expect(h).toContain("DevTools");
  });

  it("viewport e ecrã pequenos → móvel real provável", () => {
    const h = buildViewModeHint({
      innerWidth: 390,
      innerHeight: 844,
      screenWidth: 390,
      screenHeight: 844,
      maxTouchPoints: 5,
      pointerCoarse: true,
    });
    expect(h).toContain("telefone");
  });

  it("viewport largo sem touch → desktop típico", () => {
    const h = buildViewModeHint({
      innerWidth: 1280,
      innerHeight: 720,
      screenWidth: 1920,
      screenHeight: 1080,
      maxTouchPoints: 0,
      pointerCoarse: false,
    });
    expect(h).toContain("desktop");
  });
});
