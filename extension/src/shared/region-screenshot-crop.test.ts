import { describe, expect, it } from "vitest";
import { mapViewportRectToImagePixels } from "./region-screenshot-crop";

describe("mapViewportRectToImagePixels", () => {
  it("escala 1:1 (viewport = imagem)", () => {
    const r = mapViewportRectToImagePixels(
      { left: 10, top: 20, width: 100, height: 50 },
      800,
      600,
      800,
      600,
    );
    expect(r).toEqual({ sx: 10, sy: 20, sw: 100, sh: 50 });
  });

  it("escala 2x (HiDPI)", () => {
    const r = mapViewportRectToImagePixels(
      { left: 0, top: 0, width: 400, height: 300 },
      400,
      300,
      800,
      600,
    );
    expect(r).toEqual({ sx: 0, sy: 0, sw: 800, sh: 600 });
  });

  it("mantém dentro dos limites da imagem", () => {
    const r = mapViewportRectToImagePixels(
      { left: 790, top: 590, width: 50, height: 50 },
      800,
      600,
      800,
      600,
    );
    expect(r).toEqual({ sx: 790, sy: 590, sw: 10, sh: 10 });
  });
});
