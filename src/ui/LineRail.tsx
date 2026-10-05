'use client';

import { useEffect, useRef, useState, type CSSProperties, type FocusEvent } from 'react';
import { END } from '@/config/layout';
import { useSite } from '@/config/site';
import { STATIONS, useStations } from '@/config/stations';
import { useUi } from '@/i18n/ui';
import { closeMenu, goHome, goToExit, goToStation, onFrame, runtime, setLineOn, setUiHover, stepLine } from '@/lib/runtime';
import { useSnapshot } from './useSnapshot';

/** Paradas del diagrama: las estaciones y, al final, la salida (el contacto). */
const STOPS_X = [...STATIONS.map((s) => s.x), END.packX];
const EXIT = STATIONS.length;
const TOTAL = String(STATIONS.length).padStart(2, '0');
/** Ancho del rótulo de los nodos (px; debe cuadrar con overlay.css) y margen con los bordes del pie. */
const TIP_W = 248;
const TIP_EDGE = 10;

/**
 * Rótulo de los nodos del pie: uno solo, que se desliza de nodo a nodo mientras el cursor recorre el
 * diagrama y aparece en su sitio al entrar. Una línea de referencia lo une a su nodo.
 */
function useTip() {
  const line = useRef<HTMLOListElement>(null);
  const [tip, setTip] = useState({ k: 0, x: 0, notch: 0, on: false, jump: true });
  const show = (k: number, el: HTMLElement) => {
    const ol = line.current;
    if (!ol) return;
    const r = el.querySelector('.node__glyph')?.getBoundingClientRect() ?? el.getBoundingClientRect();
    const box = ol.parentElement!.getBoundingClientRect();
    const center = r.left + r.width / 2 - box.left;
    const x = Math.min(Math.max(center, TIP_W / 2 + TIP_EDGE), box.width - TIP_W / 2 - TIP_EDGE);
    setTip((prev) => ({ k, x, notch: center - x, on: true, jump: !prev.on }));
  };
  const hide = () => setTip((prev) => (prev.on ? { ...prev, on: false } : prev));
  /** Con el teclado: solo se esconde si el foco sale del diagrama. */
  const blur = (e: FocusEvent) => {
    if (!line.current?.contains(e.relatedTarget as Node | null)) hide();
  };
  return { line, tip, show, hide, blur };
}

/** Pie de la lámina: diagrama de la línea con el avance real de la cámara, lema, pausa de la línea y vuelta al inicio. */
export function LineRail() {
  const { active, focused, lineOn, atExit, intro, selected } = useSnapshot('active', 'focused', 'lineOn', 'atExit', 'intro', 'selected');
  /** En el móvil, anterior y siguiente flanquean el diagrama (los de la ficha no están). */
  const atStart = intro && selected === null && !atExit;
  const atEnd = atExit && selected === null;
  const fills = useRef<(HTMLSpanElement | null)[]>([]);
  const cue = useRef<HTMLDivElement>(null);
  const { line, tip, show, hide, blur } = useTip();
  const ui = useUi();
  const site = useSite();
  const stations = useStations();
  /** Lo que dice el rótulo de cada parada. */
  const t =
    tip.k === EXIT
      ? { kicker: ui.common.endOfLine, title: ui.common.contact, sub: ui.common.emailCv }
      : { kicker: `${stations[tip.k].number} / ${TOTAL} · ${stations[tip.k].year}`, title: stations[tip.k].title.join(' '), sub: stations[tip.k].field };

  useEffect(() => {
    // Solo se escribe lo que cambia: en un frame de scroll se mueve un tramo, no los seis.
    const written = STOPS_X.map(() => '');
    let gone: boolean | null = null;
    return onFrame(() => {
      const x = runtime.cameraX;
      for (let i = 0; i < STOPS_X.length - 1; i++) {
        const el = fills.current[i];
        if (!el) continue;
        const a = STOPS_X[i];
        const b = STOPS_X[i + 1];
        const f = Math.min(1, Math.max(0, (x - a) / (b - a))).toFixed(4);
        if (f === written[i]) continue;
        el.style.transform = `scaleX(${f})`;
        written[i] = f;
      }
      const g = runtime.progress > 0.012;
      if (g !== gone) {
        cue.current?.classList.toggle('is-gone', g);
        gone = g;
      }
    });
  }, []);

  return (
    <>
      {/* En el móvil la indicación solo acompaña a la presentación (luego taparía la máquina). */}
      <div ref={cue} className={`cue${atStart ? '' : ' is-off'}`} aria-hidden>
        <span className="cue__desk">{ui.rail.cueDesk}</span>
        {/* En táctil la línea se recorre arrastrando: el dedo hacia la izquierda avanza. */}
        <span className="cue__touch">{ui.rail.cueTouch}</span>
        <i />
        {/* Con teclado, las flechas van de estación en estación. */}
        <span className="cue__keys">
          <kbd>←</kbd>
          <kbd>→</kbd>
        </span>
      </div>
      <footer className="rail" data-ui>
        <button type="button" className="rail-btn rail-btn--step rail-btn--prev" onClick={() => stepLine(-1)} disabled={atStart} aria-label={ui.card.previous}>
          <svg viewBox="0 0 16 16" aria-hidden>
            <path d="M10 3.5 L5.5 8 L10 12.5" />
          </svg>
        </button>
        <div className="rail__track">
          <div
            className={`rail__tip${tip.on ? ' is-on' : ''}${tip.jump ? ' is-jump' : ''}`}
            style={{ '--x': `${tip.x}px`, '--notch': `${tip.notch}px` } as CSSProperties}
            aria-hidden
          >
            <em>{t.kicker}</em>
            <b>{t.title}</b>
            <span>{t.sub}</span>
          </div>
          <ol ref={line} className="rail__line" onPointerLeave={hide}>
            {stations.map((s, i) => (
              <li key={s.id} className="rail__item">
                <button
                  type="button"
                  className={`node${active === s.id && !atExit ? ' is-active' : ''}${focused === s.id ? ' is-hot' : ''}`}
                  onPointerEnter={(e) => {
                    setUiHover(s.id);
                    show(i, e.currentTarget);
                  }}
                  onPointerLeave={() => setUiHover(null)}
                  onFocus={(e) => {
                    setUiHover(s.id);
                    show(i, e.currentTarget);
                  }}
                  onBlur={(e) => {
                    setUiHover(null);
                    blur(e);
                  }}
                  // Con una ficha abierta, el nodo abre la de su máquina (como las flechas de la ficha).
                  onClick={() => goToStation(s.id, { select: selected !== null })}
                  aria-label={`${ui.common.goTo} ${s.number} ${s.title.join(' ')}`}
                  aria-current={active === s.id && !atExit ? 'step' : undefined}
                >
                  <span className="node__glyph" aria-hidden>
                    <svg className="node__shape" viewBox="0 0 16 16">
                      <circle cx="8" cy="8" r="4" />
                    </svg>
                  </span>
                  <span className="node__text">
                    <span className="node__num">{s.number}</span>
                    <span className="node__name">{s.short}</span>
                  </span>
                </button>
                <span className="rail__link" aria-hidden>
                  <span
                    className="rail__fill"
                    ref={(el) => {
                      fills.current[i] = el;
                    }}
                  />
                </span>
              </li>
            ))}
            {/* Final de la línea: la puerta de salida, donde está el contacto. */}
            <li className="rail__item">
              <button
                type="button"
                className={`node node--exit${atExit ? ' is-active' : ''}`}
                onClick={goToExit}
                onPointerEnter={(e) => show(EXIT, e.currentTarget)}
                onFocus={(e) => show(EXIT, e.currentTarget)}
                onBlur={blur}
                aria-label={ui.common.goToExitAria}
                aria-current={atExit ? 'step' : undefined}
              >
                <span className="node__glyph" aria-hidden>
                  <svg className="node__shape node__shape--exit" viewBox="0 0 16 16">
                    <path d="M2.5 8 H10.5 M8 5.5 L10.5 8 L8 10.5 M13.5 3 V13" />
                  </svg>
                </span>
                <span className="node__text">
                  <span className="node__name">{ui.rail.contact}</span>
                </span>
              </button>
            </li>
          </ol>
        </div>
        <button type="button" className="rail-btn rail-btn--step rail-btn--next" onClick={() => stepLine(1)} disabled={atEnd} aria-label={ui.card.next}>
          <svg viewBox="0 0 16 16" aria-hidden>
            <path d="M6 3.5 L10.5 8 L6 12.5" />
          </svg>
        </button>
        <div className="rail__motto" aria-hidden>
          {site.motto.map((w) => (
            <span key={w}>{w}</span>
          ))}
          <span>—</span>
        </div>
        <button type="button" className="rail-btn" onClick={() => setLineOn(!lineOn)} aria-label={lineOn ? ui.rail.pause : ui.rail.run} aria-keyshortcuts="P">
          <svg viewBox="0 0 16 16" aria-hidden>
            {lineOn ? <path d="M5.5 3.5 V12.5 M10.5 3.5 V12.5" /> : <path className="rail-btn__fill" d="M5 3.2 L12.5 8 L5 12.8 Z" />}
          </svg>
          <span className="rail-btn__tip">
            {lineOn ? ui.rail.pauseTip : ui.rail.runTip} <kbd>P</kbd>
          </span>
        </button>
        <button
          type="button"
          className="rail-btn rail-btn--home"
          onClick={() => {
            closeMenu();
            goHome();
          }}
          aria-label={ui.rail.backToStart}
          aria-keyshortcuts="Home"
        >
          <svg viewBox="0 0 16 16" aria-hidden>
            <path d="M2.5 3 V13" />
            <path className="rail-btn__arrow" d="M13.5 8 H5.5 M8.5 5 L5.5 8 L8.5 11" />
          </svg>
          <span className="rail-btn__tip">
            {ui.rail.backToStartTip} <kbd>{ui.rail.homeKey}</kbd>
          </span>
        </button>
      </footer>
    </>
  );
}
