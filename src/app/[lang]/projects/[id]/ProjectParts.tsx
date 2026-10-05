'use client';

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import type { ProjectFigure, ProjectTest } from '@/config/projects';
import { useUi } from '@/i18n/ui';

const pad = (n: number) => String(n).padStart(2, '0');
const SHOW_EVENT = 'pj:show';
const capital = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Móvil: la pista enseña la captura siguiente asomando y el visor abre la captura entera. */
const NARROW = '(max-width: 760px)';

/**
 * Las pantallas del producto: pestañas agrupadas (la ficha de un valor primero) y, debajo, una
 * pista con todas las capturas que se pasa deslizando (dedo o trackpad), con flechas y contador.
 * Cada captura va montada: una ventana de la app sobre un passe-partout de papel con cruces de
 * registro. Los globos de la pantalla que los tiene se explican debajo, y cualquier captura se puede
 * ampliar (tocándola o con su botón). Teclado en las pestañas: ← → recorren, Inicio y Fin saltan a
 * los extremos.
 *
 * En el móvil las pestañas no caben: arriba van el grupo y el contador; la siguiente captura asoma
 * por la derecha (se ve que se desliza); debajo, anterior y siguiente a los lados de una barra de
 * tramos, uno por pantalla, que también lleva a cada una; y el texto de la captura en curso. Los
 * controles no se mueven al pasar de una a otra: lo que cambia de alto va debajo de ellos.
 */
export function ProjectTour({ figures }: { figures: ProjectFigure[] }) {
  const t = useUi();
  const [i, setI] = useState(0);
  const [zoom, setZoom] = useState<number | null>(null);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const strip = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const n = figures.length;

  /** Posición de la pista que centra la captura k (en escritorio ocupan la pista entera). */
  const leftOf = (k: number) => {
    const tr = track.current;
    const slide = tr?.children[k] as HTMLElement | undefined;
    if (!tr || !slide) return 0;
    return slide.offsetLeft - (tr.clientWidth - slide.offsetWidth) / 2;
  };

  /** Lleva la pista a la captura k (sin tocar el scroll vertical de la página). */
  const show = (k: number, focus = false) => {
    const next = (k + n) % n;
    // A la de al lado se desliza; más lejos, se salta directamente (no pasan todas por delante).
    const far = Math.abs(next - i) > 1;
    setI(next);
    track.current?.scrollTo({ left: leftOf(next), behavior: reduced() || far ? 'auto' : 'smooth' });
    if (focus) tabs.current[next]?.focus({ preventScroll: true });
  };

  // Al deslizar, la pestaña sigue a la captura que queda encajada (la más cercana al centro).
  useEffect(() => {
    const tr = track.current;
    if (!tr) return;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const mid = tr.scrollLeft + tr.clientWidth / 2;
        let best = 0;
        let dist = Infinity;
        Array.from(tr.children).forEach((c, k) => {
          const el = c as HTMLElement;
          const d = Math.abs(el.offsetLeft + el.offsetWidth / 2 - mid);
          if (d < dist) {
            dist = d;
            best = k;
          }
        });
        setI(best);
      });
    };
    tr.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      tr.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  // La pista toma la altura de la captura actual (no la de la más alta): sin hueco bajo las que no
  // llevan notas. Se vuelve a medir si cambia el ancho (la captura cambia de alto con él). En el
  // móvil las notas van fuera de la pista: su alto es el de la ventana más alta y no se mueve.
  useEffect(() => {
    const tr = track.current;
    const slide = tr?.children[i] as HTMLElement | undefined;
    if (!tr || !slide) return;
    const narrow = window.matchMedia(NARROW);
    const fit = () => {
      tr.style.height = narrow.matches ? '' : `${slide.offsetHeight}px`;
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(slide);
    narrow.addEventListener('change', fit);
    return () => {
      ro.disconnect();
      narrow.removeEventListener('change', fit);
    };
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
  const firstOf = (k: number) => k === 0 || figures[k - 1].group !== figures[k].group;

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
            className={firstOf(k) ? 'is-first' : undefined}
            data-group={x.group}
            onClick={() => show(k)}
          >
            {x.label}
          </button>
        ))}
      </div>

      {/* Móvil: el grupo y la pantalla en curso, con el contador. */}
      <p className="pj-tour__head" aria-live="polite">
        <span>
          {f.group} <b>— {f.label}</b>
        </span>
        <em>
          {pad(i + 1)} / {pad(n)}
        </em>
      </p>

      <div className="pj-mount">
        <i className="pj-cross pj-cross--tl" aria-hidden />
        <i className="pj-cross pj-cross--tr" aria-hidden />
        <i className="pj-cross pj-cross--bl" aria-hidden />
        <i className="pj-cross pj-cross--br" aria-hidden />
        <div ref={track} className="pj-tour__track">
          {figures.map((x, k) => (
            // El panel de la pestaña envuelve a la figura (una figura no puede hacer de panel).
            <div key={x.src} className="pj-slide" id={`pj-screen-${k}`} role="tabpanel" aria-labelledby={`pj-tab-${k}`} inert={k !== i}>
              <figure>
                <Window f={x} eager={k === 0} onZoom={() => setZoom(k)} />
                <figcaption className="pj-mount__caption">{x.caption}</figcaption>
                {x.notes && <Notes f={x} />}
              </figure>
            </div>
          ))}
        </div>
        <div className="pj-tour__nav">
          <button type="button" className="pj-tour__step" onClick={() => show(i - 1)} aria-label={t.project.prevScreen}>
            <span aria-hidden>←</span>
          </button>
          {/* Móvil: un tramo por pantalla, agrupados como las pestañas; el tramo lleva a su pantalla. */}
          <div className="pj-tour__bar">
            {figures.map((x, k) => (
              <button
                key={x.src}
                type="button"
                className={`${firstOf(k) && k > 0 ? 'is-first' : ''}${k === i ? ' is-on' : ''}`}
                aria-label={`${t.project.goToScreen} ${k + 1}: ${x.group} — ${x.label}`}
                aria-current={k === i ? 'true' : undefined}
                onClick={() => show(k)}
              >
                <i aria-hidden />
              </button>
            ))}
          </div>
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

      {/* Móvil: el texto de la captura en curso, fuera de la pista (lo que cambia de alto va abajo). */}
      <div className="pj-tour__info">
        <p key={f.src} className="pj-mount__caption">
          {f.caption}
        </p>
        {f.notes && <Notes key={`${f.src}-notes`} f={f} />}
      </div>

      {zoom !== null && (
        <Zoom
          figures={figures}
          start={zoom}
          onClose={(k) => {
            setZoom(null);
            if (k !== i) show(k);
          }}
        />
      )}
    </div>
  );
}

/** Notas de los globos de una captura. */
function Notes({ f }: { f: ProjectFigure }) {
  return (
    <ol className="pj-notes">
      {f.notes?.map((note, m) => (
        <li key={note.text}>
          <b>{m + 1}</b>
          {note.text}
        </li>
      ))}
    </ol>
  );
}

/** Ventana de la app: barra de título en tinta, botón de ampliar y la captura con sus globos (tocarla también amplía). */
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
      <div className="pj-win__screen" style={{ aspectRatio: `${f.w} / ${f.h}` } as CSSProperties} onClick={onZoom}>
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

/** Desplazamiento mínimo (px) para que un arrastre en el visor sea pasar de captura y no un toque. */
const SWIPE = 48;

/**
 * Visor de capturas a pantalla completa (un <dialog> modal: Esc o el botón cierran). Abre la captura
 * entera en el móvil (a tamaño de lectura en escritorio); tocarla pasa de una vista a la otra, y de
 * cerca se desplaza en las dos direcciones para leer la interfaz sin pellizcar. Anterior y siguiente
 * al pie (y deslizando la captura entera, o con ← →); al cerrar, la pista queda en la última vista.
 */
function Zoom({ figures, start, onClose }: { figures: ProjectFigure[]; start: number; onClose: (k: number) => void }) {
  const t = useUi();
  const ref = useRef<HTMLDialogElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const n = figures.length;
  const [k, setK] = useState(start);
  const [read, setRead] = useState(() => !window.matchMedia(NARROW).matches);
  const at = useRef(k);
  at.current = k;
  const down = useRef<{ x: number; y: number } | null>(null);
  const aim = useRef<{ fx: number; fy: number } | null>(null);
  const f = figures[k];

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

  // De lejos a cerca: el punto tocado queda en el centro de la vista.
  useLayoutEffect(() => {
    const el = stage.current;
    const p = aim.current;
    aim.current = null;
    if (!el || !read || !p) return;
    el.scrollLeft = p.fx * el.scrollWidth - el.clientWidth / 2;
    el.scrollTop = p.fy * el.scrollHeight - el.clientHeight / 2;
  }, [read]);

  // Otra captura: se vuelve a ver como al abrir (entera en el móvil), desde arriba.
  const go = (d: number) => {
    setK((x) => (x + d + n) % n);
    setRead(!window.matchMedia(NARROW).matches);
    stage.current?.scrollTo(0, 0);
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') go(1);
    else if (e.key === 'ArrowLeft') go(-1);
    else return;
    e.preventDefault();
  };

  return (
    <dialog
      ref={ref}
      className={`pj-zoom${read ? ' is-read' : ''}`}
      aria-label={f.title}
      // Solo un cierre de verdad (Esc o el botón): el «close» que deja en cola un desmontaje y vuelta a
      // montar (modo estricto) llega con el diálogo ya abierto otra vez.
      onClose={() => {
        if (!ref.current?.open) onClose(at.current);
      }}
      onKeyDown={onKey}
    >
      <div className="pj-zoom__bar">
        <span>Ottometrix — {f.title}</span>
        <b>
          {pad(k + 1)} / {pad(n)}
        </b>
        <button type="button" onClick={() => onClose(at.current)} autoFocus>
          {t.common.close} <span aria-hidden>×</span>
        </button>
      </div>
      <div
        ref={stage}
        className="pj-zoom__scroll"
        onPointerDown={(e) => {
          down.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerUp={(e) => {
          const s = down.current;
          down.current = null;
          // Con la captura entera, arrastrar de lado pasa a la siguiente o a la anterior.
          if (!s || read || e.pointerType === 'mouse') return;
          const dx = e.clientX - s.x;
          if (Math.abs(dx) > SWIPE && Math.abs(dx) > Math.abs(e.clientY - s.y) * 1.5) {
            down.current = { x: NaN, y: NaN };
            go(dx < 0 ? 1 : -1);
          }
        }}
        onClick={(e) => {
          if (down.current && Number.isNaN(down.current.x)) {
            down.current = null;
            return;
          }
          const img = (e.currentTarget as HTMLElement).querySelector('img');
          if (!img) return;
          const r = img.getBoundingClientRect();
          aim.current = { fx: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), fy: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
          setRead((v) => !v);
        }}
      >
        <img key={f.src} src={f.src} width={f.w} height={f.h} alt={f.alt} />
        <span className="pj-zoom__hint" aria-hidden>
          {read ? t.project.zoomOut : t.project.zoomIn}
        </span>
      </div>
      <div className="pj-zoom__foot">
        <button type="button" onClick={() => go(-1)} aria-label={t.project.prevScreen}>
          <span aria-hidden>←</span>
        </button>
        <p>{f.caption}</p>
        <button type="button" onClick={() => go(1)} aria-label={t.project.nextScreen}>
          <span aria-hidden>→</span>
        </button>
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
