import { describe, expect, it } from "vitest";
import { bytesMatchWebmEbmlSignature } from "./webm-file-signature";

describe("bytesMatchWebmEbmlSignature", () => {
  it("matches Matroska/WebM EBML header", () => {
    const b = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x00]);
    expect(bytesMatchWebmEbmlSignature(b)).toBe(true);
  });

  it("rejects wrong magic", () => {
    expect(bytesMatchWebmEbmlSignature(new Uint8Array([0, 1, 2, 3]))).toBe(false);
    expect(bytesMatchWebmEbmlSignature(new Uint8Array([0x1a, 0x45, 0xdf]))).toBe(false);
  });
});
