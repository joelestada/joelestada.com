import { NextResponse, type NextRequest } from 'next/server';
import { DEFAULT_LANG, isLang, LANG_COOKIE, LANGS, type Lang } from '@/i18n/lang';

/**
 * Cada página vive en /en/… y /es/…. Una dirección sin idioma (un enlace antiguo como
 * /projects/display) lleva a la misma en el idioma de la cookie (elegido con el botón ES/EN) o, si
 * no hay, en el preferido del navegador; si no es ninguno de los dos, en inglés.
 *
 * La raíz es la excepción: en inglés (y para los buscadores, que no piden idioma) sirve la portada
 * ahí mismo, sin redirigir. Google lee el icono y el nombre del sitio de la portada del dominio, no
 * de /en: con una redirección, el resultado salía con el globo genérico y la dirección a secas. En
 * español lleva a /es, como siempre.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (LANGS.some((l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`))) return;
  const lang = pickLang(request);
  const url = request.nextUrl.clone();
  url.pathname = `/${lang}${pathname === '/' ? '' : pathname}`;
  if (pathname === '/' && lang === DEFAULT_LANG) return NextResponse.rewrite(url);
  return NextResponse.redirect(url);
}

/** El idioma de la cookie o, sin ella, el primero de Accept-Language que la web tiene (por su peso q). */
function pickLang(request: NextRequest): Lang {
  const chosen = request.cookies.get(LANG_COOKIE)?.value;
  if (isLang(chosen)) return chosen;
  const ranked = (request.headers.get('accept-language') ?? '')
    .split(',')
    .map((part) => {
      const [tag, ...params] = part.trim().toLowerCase().split(';');
      const q = params.find((p) => p.trim().startsWith('q='));
      return { lang: tag.split('-')[0], q: q ? Number(q.trim().slice(2)) || 0 : 1 };
    })
    .filter((x) => x.lang)
    .sort((a, b) => b.q - a.q);
  return ranked.map((x) => x.lang).find(isLang) ?? DEFAULT_LANG;
}

export const config = {
  // Fuera: lo interno de Next, los iconos, el mapa del sitio, robots y cualquier archivo (con extensión).
  matcher: ['/((?!_next/|icon|apple-icon|sitemap\\.xml|robots\\.txt|.*\\.[^/]+$).*)'],
};
