'use client';

import { useState } from 'react';
import { SITE } from '@/config/site';
import { STATIONS, useStationById } from '@/config/stations';
import { useUi } from '@/i18n/ui';
import { closeMenu, goHome, SECTIONS, toggleMenu, toggleSection, type Section } from '@/lib/runtime';
import { Swap } from './Swap';
import { LangSwitch } from './LangSwitch';
import { useInk } from './useInk';
import { useSnapshot } from './useSnapshot';

/**
 * Lo que se mira, para la miga de la barra: el apartado del panel abierto, el final de la línea o la
 * estación. `order` da el sentido del cambio (la línea de izquierda a derecha y, después, el panel).
 */
function useHere() {
  const { menuOpen, section, active, selected, atExit, intro } = useSnapshot('menuOpen', 'section', 'active', 'selected', 'atExit', 'intro');
  const t = useUi();
  const byId = useStationById();
  if (menuOpen) return { key: section, order: 10 + SECTIONS.indexOf(section), n: null, label: t.sections[section] };
  if (intro && !selected) return { key: 'intro', order: -1, n: null, label: t.common.startOfLine };
  if (atExit && !selected) return { key: 'exit', order: STATIONS.length, n: null, label: t.common.endOfLine };
  const s = byId[selected ?? active];
  return { key: s.id, order: STATIONS.findIndex((x) => x.id === s.id), n: s.number, label: s.title.join(' ') };
}

/**
 * Barra superior: marca | dónde estás | apartados | menú. Los apartados son las pestañas del panel.
 * Un único indicador: sigue al cursor por las pestañas y, al salir, vuelve al apartado abierto
 * (o se recoge si el panel está cerrado).
 */
export function Toolbar() {
  const { menuOpen, section } = useSnapshot('menuOpen', 'section');
  const [hover, setHover] = useState<Section | null>(null);
  const ink = useInk(hover ?? (menuOpen ? section : null));
  const here = useHere();
  const t = useUi();
  // Hacia delante la miga sube; hacia atrás, baja (como la ficha).
  const [last, setLast] = useState(here.order);
  const [dir, setDir] = useState(1);
  if (here.order !== last) {
    setDir(here.order > last ? 1 : -1);
    setLast(here.order);
  }

  return (
    <header className="bar" data-ui>
      <a
        className="bar__brand"
        href="#top"
        onClick={(e) => {
          e.preventDefault();
          closeMenu();
          goHome();
        }}
      >
        <span className="bar__name">{SITE.name}</span>
      </a>

      {/* La ficha y el pie ya lo dicen a los lectores de pantalla: aquí solo se ve. */}
      <p className="crumbs" aria-hidden>
        <span>{t.common.theLine}</span>
        <span className="crumbs__sep">/</span>
        <span className="crumbs__here">
          <Swap k={here.key} dir={dir}>
            {here.n && <em>{here.n}</em>}
            {here.label}
          </Swap>
        </span>
      </p>

      <nav className="tabs" aria-label={t.bar.sections} onPointerLeave={() => setHover(null)}>
        {SECTIONS.map((s) => (
          <button
            key={s}
            type="button"
            className={`tab${menuOpen && section === s ? ' is-active' : ''}${(hover ?? (menuOpen ? section : null)) === s ? ' is-marked' : ''}`}
            aria-expanded={menuOpen && section === s}
            aria-controls="drawer"
            onClick={() => toggleSection(s)}
            onPointerEnter={() => setHover(s)}
            onFocus={() => setHover(s)}
            onBlur={() => setHover(null)}
          >
            <span className="tab__inner" ref={ink.ref(s)}>
              {t.sections[s]}
            </span>
          </button>
        ))}
        {ink.mark}
      </nav>

      <LangSwitch />

      <button
        id="menu-toggle"
        type="button"
        className={`menu-btn${menuOpen ? ' is-open' : ''}`}
        aria-expanded={menuOpen}
        aria-controls="drawer"
        aria-label={menuOpen ? t.bar.closeMenu : t.bar.openMenu}
        onClick={toggleMenu}
      >
        <span className="menu-btn__icon" aria-hidden>
          <i />
          <i />
          <i />
        </span>
        <span className="menu-btn__label" aria-hidden>
          <span>{t.bar.menu}</span>
          <span>{t.bar.close}</span>
        </span>
      </button>
    </header>
  );
}
