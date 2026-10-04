'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { isHomePath } from '@/i18n/lang';
import { releaseCover } from './sheet';

/**
 * Retira la hoja del cambio de página en cuanto la página nueva está pintada. Va en el layout (no se
 * desmonta entre proyectos) y sigue a la ruta. La portada la retira ella misma cuando la escena ha
 * pintado su primer frame (ver Overlay): antes solo se vería el lienzo vacío.
 */
export function CoverRelease() {
  const path = usePathname();
  useEffect(() => {
    if (isHomePath(path)) return;
    const raf = requestAnimationFrame(releaseCover);
    return () => cancelAnimationFrame(raf);
  }, [path]);
  return null;
}
