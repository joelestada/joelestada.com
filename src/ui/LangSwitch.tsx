'use client';

import type { MouseEvent } from 'react';
import { usePathname } from 'next/navigation';
import { LANG_COOKIE, LANG_SWITCH_KEY, LANGS, localePath, otherLang, stripLang } from '@/i18n/lang';
import { useLang } from '@/i18n/LangProvider';
import { useUi } from '@/i18n/ui';

/**
 * Celda de idioma de la barra: EN · ES, con el de la página marcado. Lleva a la misma página en el
 * otro idioma (y al mismo sitio de la línea: el fragmento #estación va con ella), recuerda la
 * elección en una cookie (manda sobre el idioma del navegador al entrar por la raíz) y recarga
 * entera: la nave pinta sus rótulos al montarse. Al recargar la portada no se repite el arranque.
 */
export function LangSwitch() {
  const lang = useLang();
  const t = useUi();
  const to = otherLang(lang);
  const href = localePath(to, stripLang(usePathname() ?? '/'));
  const go = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    document.cookie = `${LANG_COOKIE}=${to}; path=/; max-age=31536000; samesite=lax`;
    try {
      sessionStorage.setItem(LANG_SWITCH_KEY, '1');
    } catch {}
    window.location.assign(localePath(to, stripLang(window.location.pathname)) + window.location.hash);
  };
  return (
    <a className="lang-btn" href={href} hrefLang={to} onClick={go} aria-label={t.bar.langAria}>
      {LANGS.map((l, i) => (
        <span key={l} className={l === lang ? 'is-on' : undefined} aria-hidden>
          {i > 0 && <i>·</i>}
          {l.toUpperCase()}
        </span>
      ))}
    </a>
  );
}
