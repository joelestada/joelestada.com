/**
 * Pantallas compactas: la interfaz de la portada cambia de disposición (deben cuadrar con los CSS).
 * - Acoplada: móvil y tableta en vertical, y ventanas estrechas. La ficha va a lo ancho, pegada al pie
 *   (en una tableta vertical, la ficha flotante de escritorio tapaba la máquina).
 * - Lateral: móvil en horizontal (poca altura). La ficha va a la izquierda, pegada al pie.
 * En las dos, la cámara encuadra la máquina en el hueco que deja libre la interfaz.
 */
export const DOCK_QUERY = '(max-width: 720px), (orientation: portrait) and (max-width: 1024px)';
export const SIDE_QUERY = '(orientation: landscape) and (max-height: 520px)';
export const COMPACT_QUERY = `${DOCK_QUERY}, ${SIDE_QUERY}`;

/** Lo mismo que SIDE_QUERY, a partir del tamaño de la vista (para la cámara, que ya lo tiene). */
export const isSide = (width: number, height: number) => width > height && height <= 520;
export const isCompact = (width: number, height: number) => width <= 720 || (height >= width && width <= 1024) || isSide(width, height);
