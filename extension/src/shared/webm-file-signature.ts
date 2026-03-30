/** Primeiros bytes de um contentor Matroska/WebM (elemento EBML). */
export function bytesMatchWebmEbmlSignature(b: Uint8Array): boolean {
  return b.length >= 4 && b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3;
}
