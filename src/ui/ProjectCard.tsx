'use client';

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { partNames } from '@/config/parts';
import { hasSheet, projectResult } from '@/config/projects';
import { SITE, useSite } from '@/config/site';
import { STATIONS, useStationById, useStations, type StationId } from '@/config/stations';
import { useHref, useLang } from '@/i18n/LangProvider';
import { useUi } from '@/i18n/ui';
import { COMPACT_QUERY } from '@/lib/compact';
import { goHome, goToStation, openMenu, rememberReturn, setSelected, setUiHover, stepLine, toggleExplode } from '@/lib/runtime';
import { cardAnchor } from './cardAnchor';
import { setHotPart, useHotPart } from './ExplodeCallouts';
import { coverAndGo } from './sheet';
import { SheetLink } from './SheetLink';
import { Morph, Swap } from './Swap';
import { useCopyEmail } from './useCopyEmail';
import { useSnapshot } from './useSnapshot';

const TOTAL = String(STATIONS.length).padStart(2, '0');
/** Paradas de la ficha: las estaciones y, tras la última, el final de la línea. */
const EXIT = STATIONS.length;

/** Escalonado del cambio de ficha (ms): primero el globo, luego disciplina y año, luego el título. */
const STAGGER = { badge: 0, field: 40, meta: 80, line: 70, title: 60 };

/** Glifo de la salida (el del pie y el del globo de la puerta). */
const ExitGlyph = () => (
  <svg viewBox="0 0 12 12" aria-hidden>
    <path d="M2 6 H8.5 M6 3.5 L8.5 6 L6 8.5 M10.5 2 V10" />
  </svg>
);

/** Glifo del principio de la línea: el de la salida al revés (sale de la pared). */
const StartGlyph = () => (
  <svg viewBox="0 0 12 12" aria-hidden>
    <path d="M1.5 2 V10 M3.5 6 H10 M7.5 3.5 L10 6 L7.5 8.5" />
  </svg>
);

/**
 * Título: dos líneas fijas, cada una con su rodillo. Cerrada, el área mide siempre dos líneas (la
 * ficha no cambia de alto entre máquinas); abierta, se ajusta a las suyas (--lines) mientras crece el
 * cuerpo. En el móvil va en una sola línea con su rodillo si cabe y, si no, en las dos de siempre (en
 * español los títulos son más largos): nunca se corta.
 */
function Title({ k, lines, dir }: { k: string; lines: string[]; dir: number }) {
  const ref = useRef<HTMLHeadingElement>(null);
  const [wrap, setWrap] = useState(false);
  const text = lines.join(' ');
  const many = lines.length > 1;
  useLayoutEffect(() => {
    const h = ref.current;
    if (!h || !many) return setWrap(false);
    const compact = window.matchMedia(COMPACT_QUERY);
    // Lo que mide el título en una línea, con la letra del propio título (sin añadir nada a la página).
    const fit = () => {
      if (!compact.matches) return setWrap(false);
      const st = getComputedStyle(h);
      const ctx = (measure ??= document.createElement('canvas').getContext('2d'));
      if (!ctx) return;
      ctx.font = `${st.fontWeight} ${st.fontSize} ${st.fontFamily}`;
      const width = ctx.measureText(text).width + (parseFloat(st.letterSpacing) || 0) * text.length;
      setWrap(width > h.clientWidth - parseFloat(st.paddingLeft) - parseFloat(st.paddingRight) + 0.5);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(h);
    compact.addEventListener('change', fit);
    let live = true;
    document.fonts?.ready.then(() => live && fit());
    return () => {
      live = false;
      ro.disconnect();
      compact.removeEventListener('change', fit);
    };
  }, [text, many]);
  return (
    <h2 ref={ref} className={`pcard__title${wrap ? ' is-wrap' : ''}`} style={{ '--lines': lines.length } as CSSProperties}>
      <span className="sr-only">{text}</span>
      <span className="pcard__lines" aria-hidden>
        {[0, 1].map((i) => (
          <span key={i} className="pcard__line">
            <Swap k={`${k}-${i}`} dir={dir} delay={STAGGER.title + i * STAGGER.line}>
              {lines[i] ?? ''}
            </Swap>
          </span>
        ))}
      </span>
      <span className="pcard__oneline" aria-hidden>
        <Swap k={k} dir={dir} delay={STAGGER.title}>
          {text}
        </Swap>
      </span>
    </h2>
  );
}

/** Lienzo para medir textos (el título de la ficha en el móvil). */
let measure: CanvasRenderingContext2D | null = null;

/**
 * Lista de piezas del despiece, como la de un plano de conjunto. En escritorio, en dos columnas: al
 * pasar el cursor por una fila se destaca su globo. En el móvil es una cinta que se desliza: tocar
 * una pieza destaca su globo, y tocar un globo destaca su pieza y la trae a la vista.
 */
function PartList({ id }: { id: StationId }) {
  const t = useUi();
  const lang = useLang();
  const hot = useHotPart();
  const list = useRef<HTMLOListElement>(null);
  const pointer = useRef('mouse');

  useEffect(() => {
    const ol = list.current;
    const li = ol?.querySelector<HTMLElement>(`[data-n="${hot}"]`);
    if (!ol || !li || ol.scrollWidth <= ol.clientWidth || !window.matchMedia(COMPACT_QUERY).matches) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    ol.scrollTo({ left: li.offsetLeft - (ol.clientWidth - li.offsetWidth) / 2, behavior: reduce ? 'auto' : 'smooth' });
  }, [hot]);

  return (
    <ol ref={list} className="pcard__bom" aria-label={t.card.partsList} data-lenis-prevent-touch>
      {partNames(id, lang).map((p) => (
        <li
          key={p.n}
          data-n={p.n}
          className={hot === p.n ? 'is-hot' : undefined}
          onPointerEnter={(e) => e.pointerType === 'mouse' && setHotPart(p.n)}
          onPointerLeave={(e) => e.pointerType === 'mouse' && setHotPart(0)}
        >
          <button
            type="button"
            aria-pressed={hot === p.n}
            onPointerDown={(e) => {
              pointer.current = e.pointerType;
            }}
            // Con el ratón la fila ya está destacada al pasar; con el dedo, tocar enciende y apaga.
            onClick={() => setHotPart(pointer.current === 'mouse' ? p.n : hot === p.n ? 0 : p.n)}
          >
            <b>{String(p.n).padStart(2, '0')}</b>
            <span>{p.name}</span>
          </button>
        </li>
      ))}
    </ol>
  );
}

/** El principio de la línea: quién es, echar a andar la línea y el CV. */
function IntroBody() {
  const site = useSite();
  const t = useUi();
  const href = useHref();
  return (
    <>
      <div className="pcard__text">
        <p className="pcard__desc">{site.intro}</p>
      </div>
      <div className="pcard__buttons">
        <button type="button" className="btn btn--ink" onClick={() => goToStation(STATIONS[0].id, { select: true })}>
          {t.card.startLine} <span className="btn__arrow btn__arrow--right">→</span>
        </button>
        <SheetLink className="btn btn--ghost" href={href(SITE.cv.href)} sheet={{ kicker: t.common.sheet, title: t.common.cv }}>
          CV <span className="btn__arrow btn__arrow--right">→</span>
        </SheetLink>
      </div>
    </>
  );
}

/** El final de la línea: el email a mano, copiarlo y el CV. */
function ExitBody() {
  const { email, copied, copy } = useCopyEmail();
  const t = useUi();
  const href = useHref();
  return (
    <>
      <a className="pcard__mail" href={`mailto:${email}`}>
        {email}
        <span className="pcard__mail-arrow" aria-hidden>
          ↗
        </span>
      </a>
      <div className="pcard__buttons">
        <button type="button" className={`btn btn--ghost${copied ? ' is-done' : ''}`} onClick={copy}>
          <i className="led" aria-hidden />
          <span className="btn__swap">
            <span>{t.common.copyEmail}</span>
            <span aria-hidden>{t.common.copied}</span>
          </span>
        </button>
        <SheetLink className="btn btn--ink" href={href(SITE.cv.href)} sheet={{ kicker: t.common.sheet, title: t.common.cv }}>
          CV <span className="btn__arrow btn__arrow--right">→</span>
        </SheetLink>
      </div>
      <span className="sr-only" aria-live="polite">
        {copied ? t.common.copiedAria : ''}
      </span>
    </>
  );
}

/**
 * Ficha de la máquina (abajo a la izquierda), como el cajetín de un plano: el globo con su número
 * (el mismo que lleva la máquina), disciplina y año, el título y, al pie, una fila de celdas con la
 * acción, el contador y anterior/siguiente. El pie va anclado abajo y sus celdas tienen ancho fijo:
 * las flechas no se mueven nunca. Cerrada mide siempre lo mismo; al desplegarse crece hacia arriba
 * con la descripción (o la lista de piezas en el despiece), la vista explosionada y la entrada al
 * proyecto. Al final de la línea (pasado el robot) es el contacto y llega ya desplegada.
 *
 * Al cambiar de máquina (con el scroll o con las flechas) no hay parpadeo: cada texto rueda en su
 * máscara, el viejo sale y el nuevo entra a la vez, en el sentido del recorrido y escalonados.
 */
export function ProjectCard() {
  const { active, selected, atExit, exploded, intro: atStart } = useSnapshot('active', 'selected', 'atExit', 'exploded', 'intro');
  const t = useUi();
  const site = useSite();
  const stations = useStations();
  const byId = useStationById();
  const toHref = useHref();
  /** Título del final de la línea (en frase: lo pinta la sans de los titulares). */
  const exitTitle = SITE.available ? t.common.exitTitle : t.common.exitTitleOff;
  const stopName = (k: number) => (k < 0 ? t.card.stopStart : k === EXIT ? t.card.stopEnd : `${stations[k].number} ${stations[k].title.join(' ')}`);
  const exit = atExit && selected === null;
  // Al principio de la línea, antes de echar a andar: la ficha presenta a Joel.
  const intro = atStart && selected === null && !exit;
  const id = selected ?? active;
  const s = byId[id];
  const at = intro ? -1 : exit ? EXIT : STATIONS.findIndex((x) => x.id === id);
  const open = selected !== null;
  const expanded = open || exit || intro;
  const key = intro ? 'intro' : exit ? 'exit' : id;
  const stop = intro ? 'intro' : exit ? 'exit' : 'station';
  const href = toHref(`/projects/${id}`);
  const result = projectResult(id, useLang());
  const ref = useRef<HTMLElement>(null);
  const more = useRef<HTMLDivElement>(null);
  const hovering = useRef(false);

  // En una pantalla baja el cuerpo se desplaza dentro de la ficha: si queda algo por debajo, el
  // borde inferior se funde (sin pista, nadie sabía que los botones seguían más abajo); tras bajar, el superior.
  useEffect(() => {
    const el = more.current;
    if (!el) return;
    const mark = () => {
      el.toggleAttribute('data-more', el.scrollHeight - el.clientHeight - el.scrollTop > 2);
      el.toggleAttribute('data-top', el.scrollTop > 2);
    };
    mark();
    const ro = new ResizeObserver(mark);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    el.addEventListener('scroll', mark, { passive: true });
    el.addEventListener('transitionend', mark);
    return () => {
      ro.disconnect();
      el.removeEventListener('scroll', mark);
      el.removeEventListener('transitionend', mark);
    };
  }, []);
  const router = useRouter();

  // Sentido del cambio: hacia delante en la línea, el texto sube; hacia atrás, baja.
  const [lastAt, setLastAt] = useState(at);
  const [dir, setDir] = useState(1);
  if (at !== lastAt) {
    setDir(at > lastAt ? 1 : -1);
    setLastAt(at);
  }

  // Con el cursor sobre la ficha, el foco de la nave sigue a la máquina que muestra (al pasar con las flechas).
  useEffect(() => {
    if (hovering.current) setUiHover(exit || intro ? null : id);
  }, [id, exit, intro]);

  useEffect(() => {
    cardAnchor.el = ref.current;
    return () => {
      cardAnchor.el = null;
    };
  }, []);

  useEffect(() => {
    if (open) router.prefetch(href);
  }, [open, href, router]);

  // Entrar: la ficha crece hasta cubrir la pantalla (la hoja del proyecto) y se navega a él.
  const enter = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    rememberReturn(id);
    // La ficha se desmonta bajo el cursor sin avisar de que sale: su foco no debe quedarse puesto.
    setUiHover(null);
    coverAndGo(() => router.push(href), { kicker: `${s.number} / ${TOTAL}`, title: s.title.join(' ') }, ref.current);
  };

  const action = () => (intro ? openMenu('about') : exit ? goHome() : open ? setSelected(null) : goToStation(id, { select: true }));
  const actionLabel = intro ? t.card.aboutAria : exit ? t.rail.backToStart : open ? t.card.closeDetails : t.card.openDetails;

  // Al pasar de máquina con la ficha abierta solo cambia el texto (se funde y su área se adapta con
  // suavidad); el aviso y los botones son los mismos y no se mueven.
  const stationBody: ReactNode = (
    <>
      {/* En la vista explosionada, la descripción deja sitio a la lista de piezas (como en un plano de conjunto). */}
      <Morph className="pcard__text">
        <Swap mode="fade" k={`${id}-${exploded === id ? 'bom' : 'desc'}`} dir={dir}>
          {exploded === id ? (
            <PartList id={id} />
          ) : (
            <>
              <p className="pcard__desc">{s.description}</p>
              {result && <p className="pcard__result">{result}</p>}
            </>
          )}
        </Swap>
      </Morph>
      {/* El pulsador de hombre muerto: sin este aviso nadie lo encuentra. */}
      <p className="pcard__tip">
        <i aria-hidden />
        {t.card.holdTip}
      </p>
      <div className="pcard__buttons">
        <button type="button" className={`pcard__explode${exploded === id ? ' is-on' : ''}`} onClick={() => toggleExplode(id)} aria-pressed={exploded === id}>
          <svg viewBox="0 0 16 16" aria-hidden>
            <rect className="pcard__explode-core" x="6" y="6" width="4" height="4" />
            <path className="pcard__explode-out" d="M1.5 5 V1.5 H5 M11 1.5 H14.5 V5 M14.5 11 V14.5 H11 M5 14.5 H1.5 V11" />
          </svg>
          <span>{exploded === id ? t.card.assemble : t.card.explode}</span>
        </button>
        <a className="pcard__enter" href={href} onClick={enter}>
          <span>
            {t.card.enter}
            {/* Sin hoja escrita todavía: que nadie entre esperando el caso completo. */}
            {!hasSheet(id) && <small className="pcard__prep">{t.card.inPrep}</small>}
          </span>
          <span className="pcard__arrow" aria-hidden>
            →
          </span>
        </a>
      </div>
    </>
  );

  return (
    <section
      ref={ref}
      className={`pcard${expanded ? ' is-open' : ''}${exit ? ' is-exit' : ''}${intro ? ' is-intro' : ''}${!intro && !exit && exploded === id ? ' is-exploded' : ''}`}
      data-ui
      aria-label={intro ? t.card.introAria : exit ? t.card.contactAria : `${t.card.projectAria} ${s.number}: ${s.title.join(' ')}`}
      onPointerEnter={() => {
        hovering.current = true;
        setUiHover(exit || intro ? null : id);
      }}
      onPointerLeave={() => {
        hovering.current = false;
        setUiHover(null);
      }}
    >
      <div className="pcard__sheet">
        {/*
          En el móvil el pie de celdas no está (anterior y siguiente van en el pie de la línea): la
          cabecera entera es el botón de la acción de la ficha, con su celda a la derecha del título.
        */}
        <div className="pcard__top">
          <header className="pcard__head">
            <span className="pcard__badge" aria-hidden>
              <Swap k={key} dir={dir} delay={STAGGER.badge}>
                {intro ? <StartGlyph /> : exit ? <ExitGlyph /> : Number(s.number)}
              </Swap>
            </span>
            <span className="pcard__field">
              <Swap k={key} dir={dir} delay={STAGGER.field}>
                {intro ? site.roleShort.toUpperCase() : exit ? t.card.endField : s.field}
              </Swap>
            </span>
            <span className="pcard__meta">
              {exit || intro ? (
                SITE.available && <i className="led led--ok led--pulse" aria-hidden />
              ) : (
                <Swap k={key} dir={dir} delay={STAGGER.meta}>
                  {s.year}
                </Swap>
              )}
            </span>
          </header>

          <Title k={key} lines={intro ? [SITE.person] : exit ? exitTitle : s.title} dir={dir} />
          <button
            type="button"
            className={`pcard__toggle${intro || exit ? '' : ' is-wide'}`}
            onClick={action}
            aria-expanded={exit || intro ? undefined : open}
            aria-label={actionLabel}
          >
            <span className="pcard__toggle-cell" aria-hidden>
              {exit ? (
                <svg className="pcard__action-icon pcard__action-icon--start" viewBox="0 0 16 16">
                  <path d="M2.5 3 V13" />
                  <path d="M13.5 8 H5.5 M8.5 5 L5.5 8 L8.5 11" />
                </svg>
              ) : (
                <i className="pcard__plus" />
              )}
            </span>
          </button>
        </div>

        <div ref={more} className="pcard__more" inert={!expanded}>
          <div className="pcard__inner">
            {/* Entre la última máquina y el final de la línea cambia todo el cuerpo: se funde entero. */}
            <Swap mode="fade" k={stop} dir={dir}>
              {intro ? <IntroBody /> : exit ? <ExitBody /> : stationBody}
            </Swap>
          </div>
        </div>
      </div>

      <footer className="pcard__foot">
        <button type="button" className="pcard__action" onClick={action} aria-expanded={exit || intro ? undefined : open} aria-label={actionLabel}>
          <Swap k={stop} dir={dir}>
            {intro ? (
              <>
                <span className="pcard__action-label">{t.card.about}</span>
                <i className="pcard__action-icon pcard__plus" aria-hidden />
              </>
            ) : exit ? (
              <>
                <span className="pcard__action-label">{t.card.backToStart}</span>
                <svg className="pcard__action-icon pcard__action-icon--start" viewBox="0 0 16 16" aria-hidden>
                  <path d="M2.5 3 V13" />
                  <path d="M13.5 8 H5.5 M8.5 5 L5.5 8 L8.5 11" />
                </svg>
              </>
            ) : (
              <>
                {/* DETAILS ↔ CLOSE, como MENU ↔ CLOSE en la barra; la cruz es el más girado. */}
                <span className="pcard__action-label pcard__action-label--swap" aria-hidden>
                  <span>{t.card.details}</span>
                  <span>{t.card.close}</span>
                </span>
                <i className="pcard__action-icon pcard__plus" aria-hidden />
              </>
            )}
          </Swap>
        </button>
        <span className="pcard__count">
          <Swap k={intro ? 'start' : exit ? 'end' : 'n'} dir={dir}>
            {intro ? (
              <b>{t.card.start}</b>
            ) : exit ? (
              <b>{t.card.end}</b>
            ) : (
              <>
                <b>
                  <Swap k={s.number} dir={dir}>
                    {s.number}
                  </Swap>
                </b>
                <em>/ {TOTAL}</em>
              </>
            )}
          </Swap>
        </span>
        <button
          type="button"
          className="pcard__step"
          onClick={() => stepLine(-1)}
          disabled={at < 0}
          aria-label={at >= 0 ? `${t.card.previous}: ${stopName(at - 1)}` : t.card.previous}
        >
          <svg viewBox="0 0 12 12" aria-hidden>
            <path d="M7.5 2.5 L4 6 L7.5 9.5" />
          </svg>
        </button>
        <button
          type="button"
          className="pcard__step"
          onClick={() => stepLine(1)}
          disabled={at === EXIT}
          aria-label={at < EXIT ? `${t.card.next}: ${stopName(at + 1)}` : t.card.next}
        >
          <svg viewBox="0 0 12 12" aria-hidden>
            <path d="M4.5 2.5 L8 6 L4.5 9.5" />
          </svg>
        </button>
      </footer>
    </section>
  );
}
