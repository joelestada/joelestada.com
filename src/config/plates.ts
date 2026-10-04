import type { Lang } from '@/i18n/lang';
import type { StationId } from './stations';

/** Lámina de una estación o del final de la línea (la embaladora y la puerta). */
type PlateId = StationId | 'exit';

/**
 * Láminas de cada máquina: la estación sola, recortada de la propia nave a 4:3 (scripts/plates.mjs).
 * Una por idioma (llevan los rótulos pintados de la nave). La grande para las páginas; la pequeña
 * para el panel de proyectos.
 */
export const plate = (id: PlateId, lang: Lang) => ({
  src: `/plates/${lang}/${id}.webp`,
  small: `/plates/${lang}/${id}-s.webp`,
  srcSet: `/plates/${lang}/${id}-s.webp 720w, /plates/${lang}/${id}.webp 1600w`,
  width: 1600,
  height: 1200,
});
