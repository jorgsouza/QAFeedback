import { describe, expect, it } from "vitest";
import { parsePendingImagesFromStoredValue, storedPendingImagesToUiState } from "./pending-images-session";

describe("parsePendingImagesFromStoredValue", () => {
  it("returns empty for null", () => {
    expect(parsePendingImagesFromStoredValue(null)).toEqual([]);
  });

  it("reads v1 wrapper", () => {
    const out = parsePendingImagesFromStoredValue({
      v: 1,
      images: [{ id: "1", fileName: "a.png", mimeType: "image/png", base64: "Zg==" }],
    });
    expect(out).toHaveLength(1);
    expect(out[0]!.id).toBe("1");
  });

  it("accepts bare array", () => {
    const out = parsePendingImagesFromStoredValue([
      { id: "x", fileName: "b.png", mimeType: "image/png", base64: "Zg==" },
    ]);
    expect(out).toHaveLength(1);
  });
});

describe("storedPendingImagesToUiState", () => {
  it("rebuilds file from base64", () => {
    const ui = storedPendingImagesToUiState([
      { id: "1", fileName: "t.png", mimeType: "image/png", base64: "Zg==" },
    ]);
    expect(ui).toHaveLength(1);
    expect(ui[0]!.file.size).toBe(1);
    URL.revokeObjectURL(ui[0]!.url);
  });
});
