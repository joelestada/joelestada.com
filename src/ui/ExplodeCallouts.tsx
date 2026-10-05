'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { partList } from '@/config/parts';
import type { StationId } from '@/config/stations';
import { onFrame, runtime } from '@/lib/runtime';
import { explode, stationParts } from '@/scene/explode';
import { useSnapshot } from './useSnapshot';

/** Radio del globo de pieza y distancia a la que sale de su pieza (px CSS). */
const R = 10;
const REACH = 30;
/** Separación mínima entre globos (px): se apartan unos de otros si se pisan. */
const GAP = 2 * R + 5;

let layer: SVGSVGElement | null = null;
/** Pieza destacada: la del globo tocado o la de la lista de piezas de la ficha (0, ninguna). */
let hot = 0;
const hotListeners = new Set<() => void>();
const subscribeHot = (l: () => void) => {
  hotListeners.add(l);
  return () => void hotListeners.delete(l);
};

/** Destaca el globo de una pieza (y su fila en la lista de piezas de la ficha); 0 para ninguno. */
export function setHotPart(n: number) {
  if (n === hot) return;
  hot = n;
  layer?.querySelectorAll<SVGGElement>('.xp').forEach((g) => g.classList.toggle('is-hot', Number(g.dataset.n) === n));
  hotListeners.forEach((l) => l());
}

/** La pieza destacada, para la lista de piezas de la ficha. */
export function useHotPart() {
  return useSyncExternalStore(
    subscribeHot,
    () => hot,
    () => 0,
  );
}

const clamp01 = (k: number) => Math.min(1, Math.max(0, k));

/**
 * Despiece como en un plano de conjunto: cada pieza separada lleva su línea de montaje (trazo y
 * punto, desde donde encaja hasta donde está) y su globo con el número de la lista de piezas.
 * Las líneas aparecen con el movimiento; los globos, cuando la pieza llega a su sitio.
 */
export function ExplodeCallouts() {
  const { exploded } = useSnapshot('exploded');
  // La máquina que se dibuja: la abierta o, mientras se vuelve a montar, la última que lo estuvo.
  const [shown, setShown] = useState<StationId | null>(null);
  if (exploded && exploded !== shown) setShown(exploded);
  const svg = useRef<SVGSVGElement>(null);

  useEffect(() => {
    layer = svg.current;
    return () => {
      layer = null;
    };
  }, []);

  // Otra máquina, otra lista: ninguna pieza destacada.
  useEffect(() => {
    setHotPart(0);
  }, [shown]);

  useEffect(() => {
    const root = svg.current;
    if (!root || !shown) return;
    const groups = Array.from(root.querySelectorAll<SVGGElement>('.xp'));
    const update = () => {
      const project = runtime.project;
      const active = explode.station === shown && project;
      root.style.visibility = active ? 'visible' : 'hidden';
      if (!active) return;
      const list = stationParts(shown);
      const entries = new Map(list.map((e) => [e.spec.n, e]));
      // Los globos salen hacia fuera del conjunto (desde su centro en pantalla): no se amontonan.
      let cx = 0;
      let cy = 0;
      for (const e of list) {
        const [x, y] = project(e.now.x, e.now.y, e.now.z);
        cx += x / list.length;
        cy += y / list.length;
      }
      // Los globos de las piezas fijas salen al final del despiece.
      const settled = clamp01((explode.t - explode.end + 0.5) / 0.4);
      // Colocación: cada globo hacia fuera de su pieza; luego se apartan los que se pisan.
      const spots = groups.map((g) => {
        const e = entries.get(Number(g.dataset.n));
        if (!e) return null;
        const [px, py] = project(e.now.x, e.now.y, e.now.z);
        let [tx, ty] = e.spec.tag ?? [px - cx, py - cy];
        const len = Math.hypot(tx, ty) || 1;
        if (!e.spec.tag) [tx, ty] = len < 1 ? [-REACH * 0.7, -REACH * 0.7] : [(tx / len) * REACH, (ty / len) * REACH];
        return { e, px, py, bx: px + tx, by: py + ty };
      });
      for (let it = 0; it < 8; it++) {
        for (let i = 0; i < spots.length; i++) {
          for (let j = i + 1; j < spots.length; j++) {
            const a = spots[i];
            const b = spots[j];
            if (!a || !b) continue;
            let dx = b.bx - a.bx;
            let dy = b.by - a.by;
            let d = Math.hypot(dx, dy);
            if (d >= GAP) continue;
            if (d < 0.01) [dx, dy, d] = [1, 0, 1];
            const push = (GAP - d) / 2;
            a.bx -= (dx / d) * push;
            a.by -= (dy / d) * push;
            b.bx += (dx / d) * push;
            b.by += (dy / d) * push;
          }
        }
      }
      groups.forEach((g, i) => {
        const spot = spots[i];
        if (!spot) return;
        const { e, px, py, bx, by } = spot;
        const [hx, hy] = project(e.home.x, e.home.y, e.home.z);
        const moves = !!e.spec.to;
        const path = g.children[0] as SVGLineElement;
        const far = Math.hypot(px - hx, py - hy) > 3;
        path.setAttribute('x1', hx.toFixed(1));
        path.setAttribute('y1', hy.toFixed(1));
        path.setAttribute('x2', px.toFixed(1));
        path.setAttribute('y2', py.toFixed(1));
        path.style.opacity = moves && far ? String(clamp01(e.k * 1.8)) : '0';
        // Globo unido a su pieza por una línea corta con un punto.
        const tx = bx - px;
        const ty = by - py;
        const len = Math.hypot(tx, ty) || 1;
        const leader = g.children[1] as SVGLineElement;
        leader.setAttribute('x1', px.toFixed(1));
        leader.setAttribute('y1', py.toFixed(1));
        leader.setAttribute('x2', (bx - (tx / len) * R).toFixed(1));
        leader.setAttribute('y2', (by - (ty / len) * R).toFixed(1));
        const dot = g.children[2] as SVGCircleElement;
        dot.setAttribute('cx', px.toFixed(1));
        dot.setAttribute('cy', py.toFixed(1));
        (g.children[3] as SVGGElement).setAttribute('transform', `translate(${bx.toFixed(1)} ${by.toFixed(1)})`);
        const show = moves ? clamp01((e.k - 0.72) / 0.28) : settled;
        for (const k of [1, 2, 3]) (g.children[k] as SVGElement).style.opacity = String(show);
        // El globo se puede tocar cuando ya está en su sitio.
        (g.children[3] as SVGElement).style.pointerEvents = show > 0.5 ? 'auto' : 'none';
      });
    };
    update();
    return onFrame(update);
  }, [shown]);

  return (
    // Tocar un globo destaca su pieza en la lista de la ficha (y otra vez, lo apaga). Es interfaz: un
    // toque aquí no recoge la ficha (data-ui). La lista de la ficha es la versión accesible.
    <svg ref={svg} className="xplode" aria-hidden data-ui style={{ visibility: 'hidden' }}>
      {shown &&
        partList(shown).map((p) => (
          <g key={`${shown}-${p.n}`} className="xp" data-n={p.n}>
            <line className="xp__path" />
            <line className="xp__leader" />
            <circle className="xp__dot" r={2} />
            <g className="xp__tag" onClick={() => setHotPart(hot === p.n ? 0 : p.n)}>
              <circle className="xp__hit" r={R + 9} />
              <circle r={R} />
              <text dy="0.36em">{p.n}</text>
            </g>
          </g>
        ))}
    </svg>
  );
}
