/**
 * Pantallas táctiles sin cursor (móviles y tabletas): la línea se recorre arrastrando en horizontal.
 * Un portátil táctil con ratón o trackpad sigue con la rueda.
 */
export const TOUCH_QUERY = '(hover: none) and (pointer: coarse)';

/**
 * Clase de <html> en la portada: la página no se desplaza nunca y Lenis mueve una pista fija (con la
 * rueda, el trackpad o el dedo). Desplazar el documento en cada frame hacía que Safari recolocara
 * las capas fijas (el lienzo, los globos) a destiempo: tirones que ninguna medida de frames veía.
 */
export const LOCK_CLASS = 'line-lock';

/** Además, en táctil: el gesto es horizontal y la indicación habla de deslizar. */
export const TOUCH_CLASS = 'line-touch';
