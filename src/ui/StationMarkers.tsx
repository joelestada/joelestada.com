'use client';

import { useEffect, useRef } from 'react';
import { BUILDING, END } from '@/config/layout';
import { STATIONS, useStations } from '@/config/stations';
import { useUi } from '@/i18n/ui';
import { getSnapshot, goToExit, goToStation, onFrame, runtime, setUiHover } from '@/lib/runtime';
import { force } from '@/scene/force';
import { cardAnchor } from './cardAnchor';
import { useSnapshot } from './useSnapshot';

/** Globo: alto del vástago y radio del círculo, en px CSS (deben cuadrar con overlay.css). */
const STEM = 22;
const R = 12;
/** Hueco entre la línea de referencia y el borde del globo. */
const GAP = 4;
/** Trazado de la línea de referencia al cambiar de estación (como el de un plano que se dibuja). */
const DRAW = { duration: 700, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' } as const;
/** Tiempo durante el que se recalcula la línea tras un cambio que mueve la ficha sin cambiar su tamaño. */
const FOLLOW_MS = 900;
/** Globo del final de la línea: sobre el cajón de la puerta de salida. Va detrás de los de las estaciones. */
const EXIT_MARKER: [number, number, number] = [BUILDING.endWallX - 0.2, END.door.height + 0.52, 0];
const EXIT = STATIONS.length;
const markerAt = (i: number): [number, number, number] =>
  i === EXIT ? EXIT_MARKER : [STATIONS[i].x + STATIONS[i].marker[0], STATIONS[i].marker[1], STATIONS[i].marker[2]];

/**
 * Globos numerados clavados en cada máquina (como en un plano de conjunto) y la línea
 * de referencia que une el globo de la estación en curso con la ficha de título.
 *
 * Todo lo que sigue a la escena se mueve solo con `transform` sobre capas propias: en cada frame de
 * scroll no se repinta ni se recalcula la maqueta de la página. La línea es un filete girado y
 * escalado (no un SVG a pantalla completa) y la ficha se mide cuando cambia de tamaño (ResizeObserver),
 * no en cada frame.
 */
export function StationMarkers() {
  const { active, focused, selected, menuOpen, atExit, exploded, intro } = useSnapshot(
    'active',
    'focused',
    'selected',
    'menuOpen',
    'atExit',
    'exploded',
    'intro',
  );
  const balloons = useRef<(HTMLElement | null)[]>([]);
  const rings = useRef<(SVGCircleElement | null)[]>([]);
  const leader = useRef<HTMLDivElement>(null);
  const line = useRef<HTMLElement>(null);
  const stroke = useRef<HTMLElement>(null);
  const dot = useRef<HTMLElement>(null);
  const kickRef = useRef<() => void>(() => {});
  // En la presentación la ficha no habla de ninguna máquina: ningún globo es el suyo.
  const target = selected ?? (intro ? null : active);
  const toExit = atExit && selected === null;
  const stations = useStations();
  const t = useUi();

  useEffect(() => {
    const positions: [number, number, boolean][] = Array.from({ length: STATIONS.length + 1 }, () => [0, 0, false]);
    /** Lo último escrito en cada globo: solo se toca el estilo si cambia. */
    const written = Array.from({ length: STATIONS.length + 1 }, () => ({ t: '', visible: false, forced: false, ring: '' }));
    const compact = window.matchMedia('(max-width: 720px)');
    let rect: DOMRect | null = null;
    let lineKey = '';
    let shown = false;

    const update = () => {
      const project = runtime.project;
      if (!project) return;
      const dpr = window.devicePixelRatio || 1;
      const w = window.innerWidth;
      const h = window.innerHeight;
      for (let i = 0; i < positions.length; i++) {
        const el = balloons.current[i];
        const [x, y] = project(...markerAt(i));
        const visible = x > -40 && x < w + 40 && y > 40 && y < h + 40;
        positions[i][0] = x;
        positions[i][1] = y;
        positions[i][2] = visible;
        if (!el) continue;
        const was = written[i];
        // Anillo de potencia: se llena mientras se mantiene pulsada la máquina.
        if (i < STATIONS.length) {
          const forced = force.station === STATIONS[i].id && force.level > 0;
          if (forced !== was.forced) {
            el.classList.toggle('is-forced', forced);
            was.forced = forced;
          }
          const ring = forced ? (1 - force.level).toFixed(3) : '1';
          const circle = rings.current[i];
          if (circle && ring !== was.ring) {
            circle.style.strokeDashoffset = ring;
            was.ring = ring;
          }
        }
        if (visible !== was.visible) {
          el.style.visibility = visible ? 'visible' : 'hidden';
          was.visible = visible;
        }
        if (!visible) continue;
        const t = `translate3d(${Math.round(x * dpr) / dpr}px, ${Math.round(y * dpr) / dpr}px, 0)`;
        if (t !== was.t) {
          el.style.transform = t;
          was.t = t;
        }
      }

      // Línea de referencia: de la esquina superior derecha de la ficha al borde del globo.
      const snap = getSnapshot();
      // Al final de la línea (sin máquina abierta), la ficha es el contacto: la línea va a la puerta.
      const i = snap.atExit && !snap.selected ? EXIT : STATIONS.findIndex((s) => s.id === (snap.selected ?? snap.active));
      const box = leader.current;
      if (!box || !line.current || !dot.current) return;
      const [bx, by, visible] = positions[i];
      const r = rect;
      // En móvil la línea está oculta por CSS; la ficha sin tamaño tampoco la dibuja.
      // Con la máquina despiezada, sus propios globos numeran las piezas: la línea sobra.
      // Solo con la ficha abierta (o el contacto del final): cerrada, el globo relleno ya dice cuál es,
      // y una línea fija cruzando la nave era ruido en cada parada.
      const open = snap.selected !== null || (snap.atExit && !snap.intro);
      const show = !!r && r.width > 0 && visible && !snap.menuOpen && !compact.matches && !snap.exploded && open;
      if (show !== shown) {
        box.style.opacity = show ? '1' : '0';
        shown = show;
      }
      if (!show || !r) return;
      const fx = r.right;
      const fy = r.top;
      const cx = bx;
      const cy = by - STEM - R;
      const dx = cx - fx;
      const dy = cy - fy;
      const len = Math.hypot(dx, dy) || 1;
      const ex = cx - (dx / len) * (R + GAP);
      const ey = cy - (dy / len) * (R + GAP);
      const key = `${fx.toFixed(1)} ${fy.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`;
      if (key === lineKey) return;
      lineKey = key;
      const length = Math.hypot(ex - fx, ey - fy);
      line.current.style.transform = `translate3d(${fx.toFixed(1)}px, ${fy.toFixed(1)}px, 0) rotate(${Math.atan2(ey - fy, ex - fx).toFixed(5)}rad) scaleX(${length.toFixed(1)})`;
      dot.current.style.transform = `translate3d(${fx.toFixed(1)}px, ${fy.toFixed(1)}px, 0)`;
    };

    // La ficha se mide cuando cambia de tamaño (al desplegarse o al cambiar de máquina): en ese
    // momento la maqueta ya está hecha y leerla no fuerza nada. Si solo se mueve (al entrar la
    // interfaz o al cambiar el tamaño de la ventana), se sigue un rato con `kick`.
    let observed: Element | null = null;
    const resize = new ResizeObserver(() => {
      rect = observed?.getBoundingClientRect() ?? null;
      update();
    });
    const observe = () => {
      const el = cardAnchor.el;
      if (!el || el === observed) return;
      if (observed) resize.unobserve(observed);
      resize.observe(el);
      observed = el;
    };
    let until = 0;
    let raf = 0;
    const follow = () => {
      observe();
      rect = cardAnchor.el?.getBoundingClientRect() ?? null;
      update();
      raf = performance.now() < until ? requestAnimationFrame(follow) : 0;
    };
    const kick = () => {
      until = performance.now() + FOLLOW_MS;
      if (!raf) raf = requestAnimationFrame(follow);
    };
    kickRef.current = kick;
    const offFrame = onFrame(update);
    window.addEventListener('resize', kick);
    kick();
    return () => {
      offFrame();
      resize.disconnect();
      window.removeEventListener('resize', kick);
      cancelAnimationFrame(raf);
    };
  }, []);

  // Al cambiar de estación (o abrir/cerrar la ficha) la línea se vuelve a trazar; también cuando
  // entra la interfaz al final del arranque de la nave (entonces la ficha se mueve: se sigue).
  useEffect(() => {
    const draw = () => {
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        stroke.current?.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], DRAW);
      }
    };
    const enter = () => {
      draw();
      kickRef.current();
    };
    draw();
    window.addEventListener('factory:ui-in', enter);
    return () => window.removeEventListener('factory:ui-in', enter);
  }, [target, selected, menuOpen, toExit]);

  return (
    <>
      <div ref={leader} className="leader" aria-hidden>
        <i ref={line} className="leader__line">
          <i ref={stroke} className="leader__stroke" />
        </i>
        <i ref={dot} className="leader__dot" />
      </div>
      <div className="balloons">
        {stations.map((s, i) => (
          <div
            key={s.id}
            ref={(el) => {
              balloons.current[i] = el;
            }}
            className={[
              'balloon',
              !toExit && target === s.id && 'is-target',
              focused === s.id && 'is-on',
              selected === s.id && 'is-selected',
              exploded === s.id && 'is-away',
            ]
              .filter(Boolean)
              .join(' ')}
            style={{ visibility: 'hidden' }}
          >
            <i className="balloon__stem" />
            <i className="balloon__dot" />
            <svg className="balloon__ring" viewBox="-17 -17 34 34" aria-hidden>
              <circle
                ref={(el) => {
                  rings.current[i] = el;
                }}
                r={15.5}
                pathLength={1}
              />
            </svg>
            <button
              type="button"
              className="balloon__circle"
              data-ui
              aria-label={`${s.number} ${s.title.join(' ')}`}
              onPointerEnter={() => setUiHover(s.id)}
              onPointerLeave={() => setUiHover(null)}
              onFocus={() => setUiHover(s.id)}
              onBlur={() => setUiHover(null)}
              onClick={() => goToStation(s.id, { select: true })}
            >
              {Number(s.number)}
            </button>
          </div>
        ))}
        <div
          ref={(el) => {
            balloons.current[EXIT] = el;
          }}
          className={['balloon', 'balloon--exit', toExit && 'is-target'].filter(Boolean).join(' ')}
          style={{ visibility: 'hidden' }}
        >
          <i className="balloon__stem" />
          <i className="balloon__dot" />
          <button type="button" className="balloon__circle" data-ui aria-label={t.common.exitAria} onClick={goToExit}>
            <svg viewBox="0 0 12 12" aria-hidden>
              <path d="M2 6 H8.5 M6 3.5 L8.5 6 L6 8.5 M10.5 2 V10" />
            </svg>
          </button>
        </div>
      </div>
    </>
  );
}
