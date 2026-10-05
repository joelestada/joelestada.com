import type { MetadataRoute } from 'next';
import { palette } from '@/config/palette';
import { SITE } from '@/config/site';
import { uiIn } from '@/i18n/ui';

/**
 * Manifiesto de la web: el nombre y el icono con que la presentan el móvil (añadir a la pantalla de
 * inicio) y algunos buscadores. Abre la portada en el idioma del visitante (la raíz, proxy.ts).
 */
export default function manifest(): MetadataRoute.Manifest {
  const t = uiIn('en');
  return {
    name: `${SITE.person} — ${t.meta.disciplines}`,
    short_name: SITE.person,
    description: t.meta.description,
    start_url: '/',
    display: 'standalone',
    background_color: palette.floor,
    theme_color: palette.floor,
    icons: [
      { src: '/icon.svg', type: 'image/svg+xml', sizes: 'any', purpose: 'any' },
      { src: '/apple-icon.png', type: 'image/png', sizes: '180x180', purpose: 'any' },
    ],
  };
}
