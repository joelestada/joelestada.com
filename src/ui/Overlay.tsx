'use client';

import { useEffect } from 'react';
import { STATIONS } from '@/config/stations';
import {
  closeMenu,
  getSnapshot,
  goHome,
  goToExit,
  goToStation,
  openMenu,
  runtime,
  SECTIONS,
  setLineOn,
  setSelected,
  toggleMenu,
  type Section,
} from '@/lib/runtime';
import { ControlDrawer } from './ControlDrawer';
import { ExplodeCallouts } from './ExplodeCallouts';
import { FlatLine } from './FlatLine';
import { FpsMeter } from './FpsMeter';
import { LineRail } from './LineRail';
import { ProjectCard } from './ProjectCard';
import { hasCover, releaseCover } from './sheet';
import { SheetFrame } from './SheetFrame';
import { StationMarkers } from './StationMarkers';
import { Toolbar } from './Toolbar';
import { useUi } from '@/i18n/ui';
import { useSnapshot } from './useSnapshot';
import { useViewArea } from './useViewArea';

/** Si la escena tarda en pintar su primer frame, la hoja del cambio de página se retira igual. */
const ARRIVAL_TIMEOUT = 3000;

const isSection = (v: string | null): v is Section => SECTIONS.includes(v as Section);

/**
 * Atajos: M abre/cierra el panel, Esc cierra panel o ficha, ← → recorren las estaciones y el final de
 * la línea, P para o arranca la línea. Como la página no se desplaza, también las teclas de página:
 * AvPág/Espacio avanzan una estación, RePág/Mayús+Espacio retroceden, Inicio y Fin van a la persiana
 * y al contacto. (F, el medidor de fps: ver FpsMeter.)
 */
function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      const { menuOpen, selected, active, atExit, lineOn, flat, intro } = getSnapshot();
      if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        toggleMenu();
      } else if (e.key === 'Escape') {
        if (menuOpen) closeMenu();
        else if (selected) setSelected(null);
      } else if (menuOpen) {
        return;
      } else if (flat && !e.key.startsWith('Arrow')) {
        // En la línea en láminas la página se desplaza: las teclas de página y la pausa no son nuestras.
        return;
      } else if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        setLineOn(!lineOn);
      } else if (e.key === 'Home' || e.key === 'End') {
        e.preventDefault();
        if (e.key === 'Home') goHome();
        else goToExit();
      } else {
        // Espacio solo si no hay un control con el foco (en un botón, lo pulsa).
        const onPage = !t || t === document.body || t === document.documentElement;
        const forward = e.key === 'ArrowRight' || e.key === 'PageDown' || (e.key === ' ' && onPage && !e.shiftKey);
        const back = e.key === 'ArrowLeft' || e.key === 'PageUp' || (e.key === ' ' && onPage && e.shiftKey);
        if (!forward && !back) return;
        e.preventDefault();
        // En la presentación (antes de la primera máquina) solo se puede avanzar: a la primera.
        if (intro && !selected) {
          if (forward) goToStation(STATIONS[0].id);
          return;
        }
        const i = STATIONS.findIndex((s) => s.id === (selected ?? active));
        const last = STATIONS.length - 1;
        // Tras la última estación, el final de la línea (el contacto); desde él, de vuelta a la última.
        if (!selected && forward && (atExit || i === last)) {
          goToExit();
          return;
        }
        if (!selected && back && atExit) {
          goToStation(STATIONS[last].id);
          return;
        }
        const next = STATIONS[Math.min(last, Math.max(0, i + (forward ? 1 : -1)))];
        // Las flechas con una ficha abierta abren la siguiente; las teclas de página solo recorren.
        goToStation(next.id, { select: selected !== null && e.key.startsWith('Arrow') });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

/**
 * Llegada a la línea desde otra hoja. La hoja del cambio de página se retira cuando la escena ya ha
 * pintado (antes solo se vería el lienzo vacío). Si se pidió un apartado (la barra de las páginas de
 * lectura lleva a /?panel=about), su panel se desenrolla al descubrirse la línea; en una carga nueva,
 * cuando entra la interfaz tras el arranque. El parámetro sale de la dirección.
 */
function useArrival() {
  useEffect(() => {
    const url = new URL(window.location.href);
    const panel = url.searchParams.get('panel');
    if (panel !== null) {
      url.searchParams.delete('panel');
      history.replaceState(history.state, '', url.pathname + url.search + url.hash);
    }
    const open = isSection(panel) ? () => openMenu(panel) : null;
    let raf = 0;
    let timer = 0;
    let done = false;
    const onUiIn = () => open?.();
    const release = () => {
      if (done) return;
      done = true;
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
      releaseCover();
      open?.();
    };
    if (hasCover()) {
      // El primer frame pintado de esta visita (el contador sigue de visitas anteriores).
      const base = runtime.drawn;
      const wait = () => {
        raf = requestAnimationFrame(runtime.drawn > base ? release : wait);
      };
      raf = requestAnimationFrame(wait);
      timer = window.setTimeout(release, ARRIVAL_TIMEOUT);
    } else if (open) {
      if (document.documentElement.classList.contains('boot')) window.addEventListener('factory:ui-in', onUiIn, { once: true });
      else raf = requestAnimationFrame(open);
    }
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
      window.removeEventListener('factory:ui-in', onUiIn);
    };
  }, []);
}

/**
 * Rótulo del arranque de la nave, en el sitio de la indicación de scroll: dice qué está haciendo la
 * planta mientras carga y arranca. Solo se ve con la clase `boot`; el texto lo escribe la escena.
 */
function BootStatus() {
  const t = useUi();
  return (
    <div className="boot-status" aria-hidden>
      <span className="boot-status__label">{t.boot.loading}</span>
      <i className="boot-status__bar" />
    </div>
  );
}

/**
 * Capa HTML sobre la escena: barra, panel, ficha, globos, marco de lámina y pie.
 * Cada capa lleva su propio z-index: el orden del DOM es el de lectura y el del tabulador (barra antes que globos).
 * Sin nave (ver SceneLoader), la barra y el panel siguen y, en lugar de ficha, globos y pie, la línea en láminas.
 */
export function Overlay() {
  useShortcuts();
  useArrival();
  useViewArea();
  const { flat } = useSnapshot('flat');
  if (flat)
    return (
      <>
        <Toolbar />
        <ControlDrawer />
        <FlatLine />
        <SheetFrame />
      </>
    );
  return (
    <>
      <BootStatus />
      <Toolbar />
      <ControlDrawer />
      <ProjectCard />
      <StationMarkers />
      <ExplodeCallouts />
      <SheetFrame />
      <LineRail />
      <FpsMeter />
    </>
  );
}
