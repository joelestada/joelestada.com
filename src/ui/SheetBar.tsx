'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { SITE } from '@/config/site';
import type { StationId } from '@/config/stations';
import { useHref } from '@/i18n/LangProvider';
import { useUi } from '@/i18n/ui';
import { rememberReturn, SECTIONS, type Section } from '@/lib/runtime';
import { LangSwitch } from './LangSwitch';
import { SheetLink } from './SheetLink';
import { useInk } from './useInk';

/** A partir de aquí (px de scroll), bajar recoge la barra; subir la saca. */
const HIDE_FROM = 140;

/** Adónde lleva cada apartado desde fuera de la línea: la portada con su panel abierto, o el CV. */
const sectionPath = (s: Section) => (s === 'cv' ? SITE.cv.href : `/?panel=${s}`);

type Props = {
  /** Lo que se lee en esta hoja: número (si es una estación), nombre y, para el móvil, su nombre corto. */
  here: { n?: string; label: string; short?: string };
  /** Apartado de la barra que es esta página (el CV). */
  current?: Section;
  /** Estación a la que vuelve la línea, con su ficha abierta; sin ella, al principio. */
  back?: StationId;
  /** Celdas propias de la página, antes de la de volver (guardar en PDF). */
  actions?: ReactNode;
};

/**
 * Barra de las páginas de lectura: la misma que la de la línea (marca | dónde estás | apartados) y, en
 * lugar del menú, la celda que vuelve a la línea. Al bajar leyendo se recoge bajo el marco de la
 * lámina y al subir vuelve; publica su alto visible en `--sbar` para lo que se pega debajo (el índice).
 */
export function SheetBar({ here, current, back, actions }: Props) {
  const ref = useRef<HTMLElement>(null);
  const [hover, setHover] = useState<Section | null>(null);
  const ink = useInk(hover ?? current ?? null);
  const t = useUi();
  const href = useHref();
  const toLine = { kicker: t.common.backTo, title: t.common.theLine };
  const remember = () => back && rememberReturn(back);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = document.documentElement;
    let last = window.scrollY;
    let hidden = false;
    let raf = 0;
    const set = (hide: boolean) => {
      if (hide === hidden) return;
      hidden = hide;
      el.dataset.hidden = hide ? '1' : '0';
      root.style.setProperty('--sbar', hide ? '0px' : 'var(--bar-h)');
    };
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const y = window.scrollY;
        const dy = y - last;
        if (Math.abs(dy) < 6 && y > HIDE_FROM) return;
        // Con el foco dentro (teclado), la barra se queda.
        set(y > HIDE_FROM && dy > 0 && !el.contains(document.activeElement));
        last = y;
      });
    };
    const onFocus = () => set(false);
    set(false);
    root.style.setProperty('--sbar', 'var(--bar-h)');
    window.addEventListener('scroll', onScroll, { passive: true });
    el.addEventListener('focusin', onFocus);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      el.removeEventListener('focusin', onFocus);
      root.style.removeProperty('--sbar');
    };
  }, []);

  return (
    <header ref={ref} className="bar bar--sheet" data-hidden="0">
      <SheetLink href={href('/')} className="bar__brand" sheet={{ kicker: SITE.name, title: t.common.theLine }}>
        <span className="bar__name">{SITE.name}</span>
      </SheetLink>

      <nav className="crumbs" aria-label={t.bar.breadcrumb}>
        <ol>
          <li className="crumbs__root">
            <SheetLink href={href('/')} sheet={toLine} onGo={remember}>
              {t.common.theLine}
            </SheetLink>
          </li>
          <li className="crumbs__sep" aria-hidden>
            /
          </li>
          <li className="crumbs__here" aria-current="page">
            <span>
              {here.n && <em>{here.n}</em>}
              {/* En el móvil, el nombre corto (el del pie de la línea): el largo solo cabía cortado. */}
              <span className="crumbs__label">{here.label}</span>
              {here.short && (
                <span className="crumbs__short" aria-hidden>
                  {here.short}
                </span>
              )}
            </span>
          </li>
        </ol>
      </nav>

      <nav className="tabs" aria-label={t.bar.sections} onPointerLeave={() => setHover(null)}>
        {SECTIONS.map((s) => (
          <SheetLink
            key={s}
            href={href(sectionPath(s))}
            sheet={{ kicker: s === 'cv' ? t.common.sheet : t.common.theLine, title: s === 'cv' ? t.common.cv : t.sections[s] }}
            className={`tab${current === s ? ' is-active' : ''}${(hover ?? current) === s ? ' is-marked' : ''}`}
            aria-current={current === s ? 'page' : undefined}
            onPointerEnter={() => setHover(s)}
            onFocus={() => setHover(s)}
            onBlur={() => setHover(null)}
          >
            <span className="tab__inner" ref={ink.ref(s)}>
              {t.sections[s]}
            </span>
          </SheetLink>
        ))}
        {ink.mark}
      </nav>

      {actions}

      <LangSwitch />

      {/* En el móvil solo queda la flecha: el nombre accesible no puede depender del rótulo visible. */}
      <SheetLink href={href('/')} className="bar__back" sheet={toLine} onGo={remember} aria-label={`${t.common.backTo} ${t.common.theLine.toLowerCase()}`}>
        <svg className="bar__back-icon" viewBox="0 0 16 16" aria-hidden>
          <path d="M13.5 8 H3 M6.5 4.5 L3 8 L6.5 11.5" />
        </svg>
        <span className="bar__back-label">{t.common.theLine}</span>
      </SheetLink>
    </header>
  );
}
