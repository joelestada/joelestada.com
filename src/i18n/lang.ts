/**
 * Idiomas de la web. Cada página vive en /en/… y /es/…; cualquier dirección sin idioma lleva al de la
 * cookie (elegido con el botón ES/EN) o, si no hay, al del navegador. La raíz, en inglés, sirve la
 * portada ahí mismo (proxy.ts).
 */
export const LANGS = ['en', 'es'] as const;
export type Lang = (typeof LANGS)[number];
export const DEFAULT_LANG: Lang = 'en';

/** Cookie con el idioma elegido a mano: manda sobre el del navegador. */
export const LANG_COOKIE = 'lang';

/** Marca de sesión al cambiar de idioma: la portada que se carga no repite el arranque de la nave. */
export const LANG_SWITCH_KEY = 'factory:lang-switch';

export const isLang = (v: unknown): v is Lang => typeof v === 'string' && (LANGS as readonly string[]).includes(v);

export const otherLang = (lang: Lang): Lang => (lang === 'en' ? 'es' : 'en');

/** Dirección de una página en un idioma: `localePath('es', '/cv')` → `/es/cv`; `'/'` → `/es`. */
export function localePath(lang: Lang, path: string) {
  if (path === '/' || path === '') return `/${lang}`;
  if (path.startsWith('/#') || path.startsWith('/?')) return `/${lang}${path.slice(1)}`;
  return `/${lang}${path}`;
}

/** La misma dirección sin el idioma (lo que va detrás de /en o /es). */
export function stripLang(pathname: string) {
  const m = pathname.match(/^\/(en|es)(?=\/|$)/);
  return m ? pathname.slice(m[0].length) || '/' : pathname;
}

/** La portada: la de un idioma (/en, /es), con o sin barra final, o la raíz (la sirve en inglés: proxy.ts). */
export const isHomePath = (pathname: string) => /^\/((en|es)\/?)?$/.test(pathname);

/**
 * Idioma de la página ya cargada, para el código que no es de React (la nave, sus rótulos pintados).
 * Lo pone el servidor en <html lang>; cambiar de idioma recarga la página.
 */
export function pageLang(): Lang {
  if (typeof document === 'undefined') return DEFAULT_LANG;
  const l = document.documentElement.lang;
  return isLang(l) ? l : DEFAULT_LANG;
}
