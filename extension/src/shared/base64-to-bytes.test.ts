import { describe, expect, it } from "vitest";
import {
  base64ToUint8Array,
  normalizeAttachmentBase64,
  uint8ArrayToBase64Latin1,
} from "./base64-to-bytes";

describe("base64ToUint8Array", () => {
  it("decodes Hello", () => {
    const out = base64ToUint8Array("SGVsbG8=");
    expect(Array.from(out)).toEqual([72, 101, 108, 108, 111]);
  });

  it("matches Node Buffer for 8k pseudo-random bytes", () => {
    const rnd = new Uint8Array(8000);
    for (let i = 0; i < rnd.length; i++) rnd[i] = (i * 17 + 3) % 256;
    const b64 = Buffer.from(rnd).toString("base64");
    const out = base64ToUint8Array(b64);
    expect(out.length).toBe(rnd.length);
    expect(Buffer.from(out).equals(Buffer.from(rnd))).toBe(true);
  });

  it("accepts data URL prefix", () => {
    const out = base64ToUint8Array("data:video/webm;base64,SGVsbG8=");
    expect(Array.from(out)).toEqual([72, 101, 108, 108, 111]);
  });
});

describe("uint8ArrayToBase64Latin1", () => {
  it("round-trips 50k bytes", () => {
    const rnd = new Uint8Array(50_000);
    for (let i = 0; i < rnd.length; i++) rnd[i] = (i * 13 + 1) % 256;
    const b64 = uint8ArrayToBase64Latin1(rnd);
    const back = base64ToUint8Array(b64);
    expect(back.length).toBe(rnd.length);
    expect(Buffer.from(back).equals(Buffer.from(rnd))).toBe(true);
  });
});

describe("normalizeAttachmentBase64", () => {
  it("strips data URL and normalizes base64url", () => {
    const n = normalizeAttachmentBase64("data:application/octet-stream;base64,SGVsbG8");
    expect(n.endsWith("=")).toBe(true);
    expect(n).not.toContain("data:");
  });
});
