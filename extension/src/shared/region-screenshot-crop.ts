export type ViewportRect = { left: number; top: number; width: number; height: number };

/**
 * Mapeia um retângulo em coordenadas de viewport (CSS px) para pixels da imagem devolvida por
 * `captureVisibleTab` (proporcional ao tamanho intrínseco vs viewport).
 */
export function mapViewportRectToImagePixels(
  rect: ViewportRect,
  viewportW: number,
  viewportH: number,
  imgW: number,
  imgH: number,
): { sx: number; sy: number; sw: number; sh: number } {
  const vw = Math.max(1, viewportW);
  const vh = Math.max(1, viewportH);
  const iw = Math.max(1, imgW);
  const ih = Math.max(1, imgH);
  const scaleX = iw / vw;
  const scaleY = ih / vh;

  let sx = Math.round(rect.left * scaleX);
  let sy = Math.round(rect.top * scaleY);
  let sw = Math.round(rect.width * scaleX);
  let sh = Math.round(rect.height * scaleY);

  sx = Math.max(0, Math.min(sx, iw - 1));
  sy = Math.max(0, Math.min(sy, ih - 1));
  sw = Math.max(1, Math.min(sw, iw - sx));
  sh = Math.max(1, Math.min(sh, ih - sy));

  return { sx, sy, sw, sh };
}

export function loadImageFromDataUrl(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Falha ao carregar a captura."));
    img.src = dataUrl;
  });
}

/**
 * Recorta a captura de tab (data URL PNG) para a região em coordenadas de viewport.
 */
export async function cropDataUrlToPngBlob(
  dataUrl: string,
  rect: ViewportRect,
  viewportW: number,
  viewportH: number,
): Promise<Blob> {
  const img = await loadImageFromDataUrl(dataUrl);
  const { sx, sy, sw, sh } = mapViewportRectToImagePixels(
    rect,
    viewportW,
    viewportH,
    img.naturalWidth,
    img.naturalHeight,
  );
  const canvas = document.createElement("canvas");
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D indisponível.");
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error("Não foi possível gerar PNG."));
      },
      "image/png",
      1,
    );
  });
}
