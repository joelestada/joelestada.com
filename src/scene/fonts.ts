/** Stencil para "JOEL", años y rótulos pintados (Saira Stencil One, Google Fonts, OFL). */
export const STENCIL_FONT = '/fonts/SairaStencilOne.woff';

let stencil: Promise<string> | null = null;

/**
 * Carga la fuente stencil una sola vez y devuelve la familia con la que pintarla en un lienzo 2D
 * (si no carga, una de sistema: el rótulo sale igual, con otra letra).
 */
export function loadStencil() {
  stencil ??= new FontFace('SceneStencil', `url(${STENCIL_FONT})`)
    .load()
    .then((face) => {
      document.fonts.add(face);
      return 'SceneStencil';
    })
    .catch(() => 'sans-serif');
  return stencil;
}
