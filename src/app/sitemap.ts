import type { MetadataRoute } from 'next';
import { SITE } from '@/config/site';
import { STATIONS } from '@/config/stations';
import { LANGS, localePath } from '@/i18n/lang';
import { SITE_URL } from '@/lib/siteUrl';

/**
 * Mapa del sitio para los buscadores: la línea, la hoja de cada proyecto y el CV, en los dos idiomas;
 * cada página dice cuál es su versión en el otro.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const pages: [string, number][] = [['/', 1], ...STATIONS.map((s): [string, number] => [`/projects/${s.id}`, 0.8]), [SITE.cv.href, 0.7]];
  return pages.flatMap(([path, priority]) =>
    LANGS.map((lang) => ({
      url: `${SITE_URL}${localePath(lang, path)}`,
      priority,
      alternates: { languages: Object.fromEntries(LANGS.map((l) => [l, `${SITE_URL}${localePath(l, path)}`])) },
    })),
  );
}
