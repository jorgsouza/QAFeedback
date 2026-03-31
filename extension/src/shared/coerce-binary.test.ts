import { describe, expect, it } from "vitest";
import { coerceToUint8Array } from "./coerce-binary";

describe("coerceToUint8Array", () => {
  it("copies Uint8Array", () => {
    const u = new Uint8Array([1, 2, 3]);
    const c = coerceToUint8Array(u);
    expect(c && Array.from(c)).toEqual([1, 2, 3]);
  });

  it("reads TypedArray-shaped plain object (clone storage)", () => {
    const buf = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3]).buffer;
    const shaped = { buffer: buf, byteOffset: 0, byteLength: 4 };
    const c = coerceToUint8Array(shaped);
    expect(c && Array.from(c)).toEqual([0x1a, 0x45, 0xdf, 0xa3]);
  });
});
