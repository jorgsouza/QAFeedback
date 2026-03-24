/**
 * O Chrome não expõe à página se o DevTools está em "modo dispositivo".
 * Esta heurística ajuda o dev a cruzar viewport vs ecrã físico e touch.
 */
export function buildViewModeHint(params: {
  innerWidth: number;
  innerHeight: number;
  screenWidth: number;
  screenHeight: number;
  maxTouchPoints: number;
  pointerCoarse: boolean;
}): string {
  const { innerWidth: iw, innerHeight: ih, screenWidth: sw, screenHeight: sh, maxTouchPoints, pointerCoarse } =
    params;

  const narrowViewport = iw <= 600;
  const largePhysicalScreen = sw >= 900 || sh >= 900;

  if (narrowViewport && largePhysicalScreen) {
    return "Viewport estreito com ecrã físico grande — **comum com emulação móvel no DevTools** ou janela do browser estreita em monitor desktop (indício, não prova).";
  }
  if (narrowViewport) {
    return "Viewport pequeno e ecrã também pequeno — típico de **telefone/tablet** ou ecrã pequeno.";
  }
  if (pointerCoarse || maxTouchPoints > 0) {
    return "Viewport largo com **toque** reportado — pode ser desktop com ecrã tátil, tablet ou emulação com touch.";
  }
  return "Viewport largo, sem indícios fortes de móvel — típico de **desktop** (tablet em landscape também é possível).";
}
