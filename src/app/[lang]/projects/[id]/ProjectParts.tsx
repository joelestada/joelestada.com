'use client';

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import type { ProjectFigure, ProjectTest } from '@/config/projects';
import { useUi } from '@/i18n/ui';

const pad = (n: number) => String(n).padStart(2, '0');
const SHOW_EVENT = 'pj:show';
const capital = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Las pantallas del producto: pestañas agrupadas (la ficha de un valor primero) y, debajo, una
 * pista con todas las capturas que se pasa deslizando (dedo o trackpad), con flechas y contador.
 * Cada captura va montada: una ventana de la app sobre un passe-partout de papel con cruces de
 * registro. Los globos de la pantalla que los tiene se explican debajo, y cualquier captura se puede
 * ampliar a tamaño real. Teclado en las pestañas: ← → recorren, Inicio y Fin saltan a los extremos.
 */
export function ProjectTour({ figures }: { figures: ProjectFigure[] }) {
  const t = useUi();
  const [i, setI] = useState(0);
  const [zoom, setZoom] = useState<number | null>(null);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const strip = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const n = figures.length;

  /** Lleva la pista a la captura k (sin tocar el scroll vertical de la página). */
  const show = (k: number, focus = false) => {
    const next = (k + n) % n;
    setI(next);
    const t = track.current;
    if (t) t.scrollTo({ left: next * t.clientWidth, behavior: reduced() ? 'auto' : 'smooth' });
    if (focus) tabs.current[next]?.focus({ preventScroll: true });
  };

  // Al deslizar, la pestaña sigue a la captura que queda encajada.
  useEffect(() => {
    const t = track.current;
    if (!t) return;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        setI(Math.round(t.scrollLeft / Math.max(1, t.clientWidth)));
      });
    };
    t.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      t.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  // La pista toma la altura de la captura actual (no la de la más alta): sin hueco bajo las que no
  // llevan notas. Se vuelve a medir si cambia el ancho (la captura cambia de alto con él).
  useEffect(() => {
    const t = track.current;
    const slide = t?.children[i] as HTMLElement | undefined;
    if (!t || !slide) return;
    const fit = () => {
      t.style.height = `${slide.offsetHeight}px`;
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(slide);
    return () => ro.disconnect();
  }, [i]);

  // La pestaña activa se centra en su tira (en móvil no caben todas).
  useEffect(() => {
    const s = strip.current;
    const b = tabs.current[i];
    if (!s || !b || s.scrollWidth <= s.clientWidth) return;
    s.scrollTo({ left: b.offsetLeft - (s.clientWidth - b.offsetWidth) / 2, behavior: reduced() ? 'auto' : 'smooth' });
  }, [i]);

  // La lista de módulos del texto abre su pantalla aquí.
  useEffect(() => {
    const onShow = (e: Event) => {
      const k = (e as CustomEvent<number>).detail;
      if (k >= 0 && k < n) show(k);
    };
    window.addEventListener(SHOW_EVENT, onShow);
    return () => window.removeEventListener(SHOW_EVENT, onShow);
    // `show` solo usa refs y el número de figuras: basta con volver a suscribir si cambia `n`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n]);

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') show(i + 1, true);
    else if (e.key === 'ArrowLeft') show(i - 1, true);
    else if (e.key === 'Home') show(0, true);
    else if (e.key === 'End') show(n - 1, true);
    else return;
    e.preventDefault();
  };
  const f = figures[i];

  return (
    <div className="pj-tour" id="pj-tour">
      <div ref={strip} className="pj-tour__tabs" role="tablist" aria-label={t.project.screens} onKeyDown={onKey}>
        {figures.map((x, k) => (
          <button
            key={x.src}
            ref={(el) => {
              tabs.current[k] = el;
            }}
            type="button"
            role="tab"
            id={`pj-tab-${k}`}
            aria-selected={k === i}
            aria-controls={`pj-screen-${k}`}
            tabIndex={k === i ? 0 : -1}
            className={k === 0 || figures[k - 1].group !== x.group ? 'is-first' : undefined}
            data-group={x.group}
            onClick={() => show(k)}
          >
            {x.label}
          </button>
        ))}
      </div>

      <div className="pj-mount">
        <i className="pj-cross pj-cross--tl" aria-hidden />
        <i className="pj-cross pj-cross--tr" aria-hidden />
        <i className="pj-cross pj-cross--bl" aria-hidden />
        <i className="pj-cross pj-cross--br" aria-hidden />
        <div ref={track} className="pj-tour__track">
          {figures.map((x, k) => (
            <figure key={x.src} className="pj-slide" id={`pj-screen-${k}`} role="tabpanel" aria-labelledby={`pj-tab-${k}`} inert={k !== i}>
              <Window f={x} eager={k === 0} onZoom={() => setZoom(k)} />
              <figcaption className="pj-mount__caption">{x.caption}</figcaption>
              {x.notes && (
                <ol className="pj-notes">
                  {x.notes.map((note, m) => (
                    <li key={note.text}>
                      <b>{m + 1}</b>
                      {note.text}
                    </li>
                  ))}
                </ol>
              )}
            </figure>
          ))}
        </div>
        <div className="pj-tour__nav">
          <button type="button" className="pj-tour__step" onClick={() => show(i - 1)} aria-label={t.project.prevScreen}>
            <span aria-hidden>←</span>
          </button>
          <p className="pj-tour__where" aria-live="polite">
            <b>
              {pad(i + 1)} / {pad(n)}
            </b>
            <span>
              {f.group} — {f.label}
            </span>
          </p>
          <button type="button" className="pj-tour__step" onClick={() => show(i + 1)} aria-label={t.project.nextScreen}>
            <span aria-hidden>→</span>
          </button>
        </div>
      </div>

      {zoom !== null && <Zoom f={figures[zoom]} onClose={() => setZoom(null)} />}
    </div>
  );
}

/** Ventana de la app: barra de título en tinta, botón de ampliar y la captura con sus globos. */
function Window({ f, eager, onZoom }: { f: ProjectFigure; eager: boolean; onZoom: () => void }) {
  const t = useUi();
  return (
    <div className="pj-win">
      <div className="pj-win__bar">
        <span className="pj-win__dots" aria-hidden>
          <i />
          <i />
          <i />
        </span>
        <span className="pj-win__title" aria-hidden>
          Ottometrix — {f.title}
        </span>
        <button type="button" className="pj-win__zoom" onClick={onZoom} aria-label={`${t.project.enlarge}: ${f.title}`}>
          <svg viewBox="0 0 16 16" aria-hidden>
            <path d="M9.5 2.5H13.5V6.5M13.5 2.5L9 7M6.5 13.5H2.5V9.5M2.5 13.5L7 9" />
          </svg>
        </button>
      </div>
      <div className="pj-win__screen" style={{ aspectRatio: `${f.w} / ${f.h}` } as CSSProperties}>
        <img src={f.src} width={f.w} height={f.h} alt={f.alt} loading={eager ? undefined : 'lazy'} decoding="async" />
        {f.notes && (
          <div className="pj-callouts" aria-hidden>
            {/* Líneas de referencia: del punto señalado al borde del globo. */}
            <svg viewBox="0 0 100 100" preserveAspectRatio="none">
              {f.notes.map((note) => (
                <line key={note.text} x1={note.x} y1={note.y} x2={note.bx} y2={note.by} />
              ))}
            </svg>
            {f.notes.map((note, m) => (
              <span key={note.text}>
                <i className="pj-callouts__dot" style={{ left: `${note.x}%`, top: `${note.y}%` }} />
                <b className="pj-balloon" style={{ left: `${note.bx}%`, top: `${note.by}%` }}>
                  {m + 1}
                </b>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Captura a tamaño de lectura, a pantalla completa (un <dialog> modal: Esc o el botón cierran).
 * En el móvil se desplaza en las dos direcciones para leer la interfaz sin pellizcar.
 */
function Zoom({ f, onClose }: { f: ProjectFigure; onClose: () => void }) {
  const t = useUi();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    d.showModal();
    const root = document.documentElement;
    root.classList.add('pj-zooming');
    return () => {
      root.classList.remove('pj-zooming');
      if (d.open) d.close();
    };
  }, []);
  return (
    <dialog ref={ref} className="pj-zoom" aria-label={f.title} onClose={onClose} onCancel={onClose}>
      <div className="pj-zoom__bar">
        <span>Ottometrix — {f.title}</span>
        <button type="button" onClick={onClose} autoFocus>
          {t.common.close} <span aria-hidden>×</span>
        </button>
      </div>
      <div className="pj-zoom__scroll">
        <img src={f.src} width={f.w} height={f.h} alt={f.alt} />
      </div>
    </dialog>
  );
}

/** Tira de ensayos: una celda por prueba; la elegida (por defecto, la última) se explica debajo. */
export function ProjectTests({ rows }: { rows: ProjectTest[] }) {
  const t = useUi();
  const VERDICT = t.project.verdict;
  const [sel, setSel] = useState(rows.length - 1);
  const r = rows[sel];
  return (
    <div className="pj-tests">
      <ol className="pj-strip" aria-label={t.project.testsInOrder}>
        {rows.map((x, k) => (
          <li key={x.n}>
            <button
              type="button"
              className={`is-${x.verdict}`}
              aria-pressed={k === sel}
              aria-label={`${t.project.test} ${x.n}: ${x.change}. ${VERDICT[x.verdict]}`}
              onClick={() => setSel(k)}
              onPointerEnter={() => setSel(k)}
              onFocus={() => setSel(k)}
            >
              {pad(x.n)}
            </button>
          </li>
        ))}
      </ol>
      <div className="pj-test" aria-live="polite">
        <p className="pj-test__head">
          <span>
            {pad(r.n)} · {r.name}
          </span>
          <b className={`is-${r.verdict}`}>{VERDICT[r.verdict]}</b>
        </p>
        <p className="pj-test__change">{r.change}</p>
        <p className="pj-test__result">{r.result}</p>
      </div>
      <p className="pj-legend" aria-hidden>
        <span className="is-rejected">{t.project.legend.rejected}</span>
        <span className="is-adopted">{t.project.legend.adopted}</span>
        <span className="is-reverted">{t.project.legend.reverted}</span>
      </p>
    </div>
  );
}

/**
 * Índice fijo: marca el apartado que se está leyendo, el último cuyo título ya ha pasado del
 * tercio superior de la pantalla (arriba del todo, el primero).
 */
export function ProjectIndex({ items }: { items: { id: string; title: string }[] }) {
  const t = useUi();
  const [current, setCurrent] = useState(items[0]?.id);
  const bar = useRef<HTMLElement>(null);
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const line = window.innerHeight * 0.35;
      let id = items[0]?.id;
      for (const it of items) {
        const el = document.getElementById(it.id);
        if (el && el.getBoundingClientRect().top <= line) id = it.id;
      }
      setCurrent(id);
      // Avance de lectura (solo se ve en móvil, bajo el apartado en curso): directo al estilo.
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (bar.current) bar.current.style.transform = `scaleX(${max > 0 ? Math.min(1, window.scrollY / max).toFixed(4) : 0})`;
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [items]);
  return (
    <nav className="pj-index" aria-label={t.project.onThisPage}>
      <i ref={bar} className="pj-index__bar" aria-hidden />
      <ol>
        {items.map((it, i) => (
          <li key={it.id}>
            <a href={`#${it.id}`} aria-current={current === it.id ? 'location' : undefined}>
              <em>{pad(i + 1)}</em>
              {it.title}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/**
 * Módulos de la ficha, en el orden de sus pestañas: cada uno abre su pantalla en el tour y lleva
 * la vista hasta él.
 */
export function ProjectModules({ figures, count }: { figures: ProjectFigure[]; count: number }) {
  const show = (k: number) => {
    window.dispatchEvent(new CustomEvent(SHOW_EVENT, { detail: k }));
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.getElementById('pj-tour')?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  };
  return (
    <ol className="pj-modules">
      {figures.slice(0, count).map((f, k) => (
        <li key={f.src}>
          <button type="button" onClick={() => show(k)}>
            <em>{pad(k + 1)}</em>
            <b>{f.label}</b>
            <span>{capital(f.caption.split(': ').slice(1).join(': '))}</span>
            <i aria-hidden>↑</i>
          </button>
        </li>
      ))}
    </ol>
  );
}
