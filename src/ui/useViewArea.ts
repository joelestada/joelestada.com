'use client';

import { useEffect } from 'react';
import { COMPACT_QUERY, SIDE_QUERY } from '@/lib/compact';
import { runtime, type ViewArea } from '@/lib/runtime';
import { cardAnchor } from './cardAnchor';

/**
 * Hueco libre de la pantalla en las pantallas compactas: lo que no tapan la barra, la ficha y el pie.
 * La cámara encuadra ahí la máquina (CameraRig). Se mide con las cajas de maqueta (offset*), que no
 * cuentan las transformaciones: la entrada de la interfaz tras el arranque no mueve el encuadre.
 *
 * También mide lo que tapa por abajo la barra del navegador (la de Safari en el iPhone, que puede ir
 * sobre la página): `--vv-b`, en el que se apoyan el pie y la ficha. Con zoom de pellizco no se toca.
 */
export function useViewArea() {
  useEffect(() => {
    const compact = window.matchMedia(COMPACT_QUERY);
    const side = window.matchMedia(SIDE_QUERY);
    const root = document.documentElement;
    let covered = -1;
    let raf = 0;

    const set = (next: ViewArea | null) => {
      const prev = runtime.view;
      if (next && prev && next.l === prev.l && next.t === prev.t && next.r === prev.r && next.b === prev.b) return;
      if (!next && !prev) return;
      runtime.view = next;
      runtime.invalidate();
    };

    const measure = () => {
      raf = 0;
      const vv = window.visualViewport;
      if (vv && Math.abs(vv.scale - 1) < 0.01) {
        const c = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
        if (c !== covered) {
          covered = c;
          root.style.setProperty('--vv-b', `${c}px`);
        }
      }
      const bar = document.querySelector<HTMLElement>('.bar');
      const rail = document.querySelector<HTMLElement>('.rail');
      const card = cardAnchor.el;
      if (!compact.matches || !bar || !rail || !card) return set(null);
      const t = bar.offsetTop + bar.offsetHeight;
      const l = rail.offsetLeft;
      const r = rail.offsetLeft + rail.offsetWidth;
      // En horizontal la ficha va a la izquierda; en vertical, a lo ancho sobre el pie.
      set(side.matches ? { l: card.offsetLeft + card.offsetWidth, t, r, b: rail.offsetTop } : { l, t, r, b: card.offsetTop });
    };
    const soon = () => {
      if (!raf) raf = requestAnimationFrame(measure);
    };

    // La ficha cambia de alto al desplegarse (en cada frame de su transición): se mide en el momento.
    const resize = new ResizeObserver(measure);
    const watch = () => {
      resize.disconnect();
      for (const el of [cardAnchor.el, document.querySelector('.bar'), document.querySelector('.rail')]) if (el) resize.observe(el);
    };
    watch();
    measure();
    window.addEventListener('resize', soon);
    window.visualViewport?.addEventListener('resize', soon);
    window.visualViewport?.addEventListener('scroll', soon);
    compact.addEventListener('change', soon);
    side.addEventListener('change', soon);
    return () => {
      cancelAnimationFrame(raf);
      resize.disconnect();
      window.removeEventListener('resize', soon);
      window.visualViewport?.removeEventListener('resize', soon);
      window.visualViewport?.removeEventListener('scroll', soon);
      compact.removeEventListener('change', soon);
      side.removeEventListener('change', soon);
      root.style.removeProperty('--vv-b');
      runtime.view = null;
    };
  }, []);
}
