import type { Metadata } from 'next';
import { localePath, type Lang } from './lang';

/**
 * Direcciones de una página en cada idioma, para `alternates`: la canónica (la de este idioma) y las
 * de los dos (hreflang), con la raíz sin idioma como `x-default` (proxy.ts elige al llegar).
 */
export function alternatesFor(lang: Lang, path: string): Metadata['alternates'] {
  return {
    canonical: localePath(lang, path),
    languages: { en: localePath('en', path), es: localePath('es', path), 'x-default': path },
  };
}
