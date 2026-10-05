'use client';

import { useCallback, useEffect, useRef, useState, type AnimationEvent, type CSSProperties, type ReactNode } from 'react';
import { cvIn } from '@/config/cv';
import { plate } from '@/config/plates';
import { SITE, useSite } from '@/config/site';
import { isStationId, STATIONS, useStationById, useStations, type StationId } from '@/config/stations';
import { useHref, useLang } from '@/i18n/LangProvider';
import { useUi } from '@/i18n/ui';
import { closeMenu, goToStation, openMenu, SECTIONS, setUiHover, type Section } from '@/lib/runtime';
import { SheetLink } from './SheetLink';
import { useCopyEmail } from './useCopyEmail';
import { useSnapshot } from './useSnapshot';

const DEV = process.env.NODE_ENV !== 'production';
/** Duración del desenrollado (debe cuadrar con overlay.css). */
const UNROLL_MS = 640;
const TOTAL = String(STATIONS.length).padStart(2, '0');

const at = (i: number) => ({ '--i': i }) as CSSProperties;
const pad = (n: number) => String(n).padStart(2, '0');

/** Cierra el panel y lleva la cámara a la máquina con su ficha abierta (cuando el panel ya se recoge). */
function walkTo(id: StationId) {
  setUiHover(null);
  closeMenu();
  window.setTimeout(() => goToStation(id, { select: true }), 160);
}

/** Estructura común de cada apartado: columna de título (con una figura opcional) y columna de contenido. */
function Panel({ section, lead, figure, children }: { section: Section; lead: ReactNode; figure?: ReactNode; children: ReactNode }) {
  const n = SECTIONS.indexOf(section) + 1;
  const t = useUi();
  return (
    <>
      <div className="panel__side">
        {/* Número y título ruedan en su máscara al cambiar de apartado (como la ficha de la línea). */}
        <span className="panel__kicker">
          <span>
            {pad(n)} / {pad(SECTIONS.length)}
          </span>
        </span>
        <h2 className="panel__title">
          <span>{t.sections[section]}</span>
        </h2>
        {figure}
        <div className="panel__lead" data-anim style={at(2)}>
          {lead}
        </div>
      </div>
      <div className="panel__main">{children}</div>
    </>
  );
}

/**
 * Vista previa del índice: la lámina de la máquina bajo el cursor, montada con sus cruces. Las
 * imágenes se piden la primera vez que se abre el panel (no compiten con la carga de la nave).
 */
function Peek({ id, armed }: { id: StationId; armed: boolean }) {
  const s = useStationById()[id];
  const lang = useLang();
  return (
    <figure className="peek" data-anim style={at(2)} aria-hidden>
      <span className="peek__view">
        {armed &&
          STATIONS.map((st) => <img key={st.id} src={plate(st.id, lang).small} alt="" decoding="async" className={st.id === id ? 'is-on' : undefined} />)}
        <i className="mount__cross mount__cross--tl" />
        <i className="mount__cross mount__cross--tr" />
        <i className="mount__cross mount__cross--bl" />
        <i className="mount__cross mount__cross--br" />
      </span>
      <figcaption className="peek__cap">
        <b className="roll">
          <span key={s.id}>
            {s.number} / {TOTAL}
          </span>
        </b>
        <span className="roll">
          <span key={s.id}>
            {s.year} · {s.field}
          </span>
        </span>
      </figcaption>
    </figure>
  );
}

function ProjectsPanel({ armed }: { armed: boolean }) {
  const { active } = useSnapshot('active');
  const t = useUi();
  const stations = useStations();
  const [peek, setPeek] = useState<StationId | null>(null);
  const show = (id: StationId | null) => {
    setPeek(id);
    setUiHover(id);
  };
  return (
    <Panel section="projects" lead={t.drawer.projectsLead} figure={<Peek id={peek ?? active} armed={armed} />}>
      <ol className="plist" onPointerLeave={() => show(null)}>
        {stations.map((s, i) => (
          <li key={s.id} data-anim style={at(i + 1)}>
            <button
              type="button"
              className={`plist__row${active === s.id ? ' is-here' : ''}`}
              onPointerEnter={() => show(s.id)}
              onFocus={() => show(s.id)}
              onBlur={() => show(null)}
              onClick={() => walkTo(s.id)}
            >
              <span className="plist__num">{s.number}</span>
              <span className="plist__body">
                <span className="plist__name">{s.title.join(' ')}</span>
                <span className="plist__sum">{s.summary}</span>
              </span>
              <span className="plist__field">{s.field}</span>
              <span className="plist__year">{s.year}</span>
              <span className="plist__go" aria-hidden>
                →
              </span>
            </button>
          </li>
        ))}
      </ol>
    </Panel>
  );
}

function AboutPanel() {
  const site = useSite();
  const t = useUi();
  const stations = useStations();
  /** Máquinas de una disciplina, en el orden de la línea. */
  const workOf = (work: readonly string[]) => stations.filter((s) => work.some((id) => isStationId(id) && id === s.id));
  return (
    <Panel
      section="about"
      lead={
        SITE.available && (
          <span className="status">
            <i className="led led--ok led--pulse" /> {site.availability}
          </span>
        )
      }
    >
      <div className="about-grid">
        <div>
          <p className="about" data-anim style={at(1)}>
            {site.about}
          </p>
          {/* Cada disciplina con sus máquinas: el número lleva a ella en la línea. */}
          <ul className="disc">
            {site.disciplines.map((d, i) => (
              <li key={d.label} data-anim style={at(i + 2)}>
                <em>{pad(i + 1)}</em>
                <span className="disc__name">{d.label}</span>
                <span className="disc__work">
                  {workOf(d.work).map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className="chip"
                      aria-label={`${t.common.goTo} ${s.number} ${s.title.join(' ')}`}
                      onPointerEnter={() => setUiHover(s.id)}
                      onPointerLeave={() => setUiHover(null)}
                      onFocus={() => setUiHover(s.id)}
                      onBlur={() => setUiHover(null)}
                      onClick={() => walkTo(s.id)}
                    >
                      {s.number}
                      <span className="chip__name" aria-hidden>
                        {s.short}
                      </span>
                    </button>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </div>
        {/* Ficha técnica: como el cajetín de un plano, etiqueta a la izquierda y dato a la derecha. */}
        <dl className="bg">
          {site.background.map((row, i) => (
            <div key={row.label} data-anim style={at(i + 2)}>
              <dt>{row.label}</dt>
              <dd>
                <b>{row.value}</b>
                <span>{row.note}</span>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </Panel>
  );
}

function ContactPanel() {
  const { links } = SITE.contact;
  const { email, copied, copy } = useCopyEmail();
  const t = useUi();
  const site = useSite();
  const cv = cvIn(useLang());
  const langs = cv.languages.map((l) => `${l.code}${l.native ? '' : ` ${l.level}`}`).join(' · ');

  const shown = links.filter((l) => l.href || DEV);
  return (
    <Panel section="contact" lead={t.drawer.contactLead}>
      <a className="mail" href={`mailto:${email}`} data-anim style={at(1)}>
        {email}
        <span className="mail__arrow" aria-hidden>
          ↗
        </span>
      </a>
      <div className="actions" data-anim style={at(2)}>
        <button type="button" className={`btn btn--ghost${copied ? ' is-done' : ''}`} onClick={copy}>
          <i className="led" aria-hidden />
          <span className="btn__swap">
            <span>{t.common.copyEmail}</span>
            <span aria-hidden>{t.common.copied}</span>
          </span>
        </button>
        <a className="btn btn--ink" href={`mailto:${email}`}>
          {t.common.write} <span className="btn__arrow">↗</span>
        </a>
      </div>
      <span className="sr-only" aria-live="polite">
        {copied ? t.common.copiedAria : ''}
      </span>
      {shown.length > 0 && (
        <ul className="links">
          {shown.map((l, i) => (
            <li key={l.label} data-anim style={at(i + 3)}>
              {l.href ? (
                <a className="links__row" href={l.href} target="_blank" rel="noreferrer">
                  <span>{l.label}</span>
                  <span className="links__arrow" aria-hidden>
                    ↗
                  </span>
                </a>
              ) : (
                <span className="links__row is-pending">
                  <span>{l.label}</span>
                  <span className="links__todo">set href in site.ts</span>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      {/* Lo que conviene saber antes de escribir: dónde, a qué hora, en qué idiomas y si hay hueco. */}
      <dl className="meta contact-meta" data-anim style={at(shown.length + 3)}>
        <div>
          <dt>{t.drawer.basedIn}</dt>
          <dd>
            {site.location} · {t.drawer.timezone}
          </dd>
        </div>
        <div>
          <dt>{t.drawer.languages}</dt>
          <dd>{langs}</dd>
        </div>
        {SITE.available && (
          <div>
            <dt>{t.drawer.availability}</dt>
            <dd>
              <i className="led led--ok" aria-hidden /> {site.availability}
            </dd>
          </div>
        )}
      </dl>
    </Panel>
  );
}

/**
 * Miniatura del CV: la misma lámina en pequeño, con su cabecera y las dos columnas (las habilidades,
 * una raya por cada una). Es la puerta a la página del CV.
 */
function CvMini() {
  const cv = cvIn(useLang());
  const skills = cv.skills.flatMap((g) => g.items).slice(0, 9);
  return (
    <span className="cvmini" aria-hidden>
      <span className="cvmini__head">
        <b>{SITE.person}</b>
        <em>{cv.headline}</em>
      </span>
      <span className="cvmini__cols">
        <span className="cvmini__side">
          {skills.map((it) => (
            <span key={it.name} className="cvmini__skill">
              <i style={{ width: `${Math.min(100, 30 + it.name.length * 3)}%` }} />
            </span>
          ))}
        </span>
        <span className="cvmini__main">
          {[92, 100, 76, 0, 60, 96, 88, 70, 0, 54, 82].map((w, k) => (w ? <i key={k} style={{ width: `${w}%` }} /> : <i key={k} className="is-gap" />))}
        </span>
      </span>
      <span className="cvmini__foot" />
    </span>
  );
}

function CvPanel() {
  const cv = cvIn(useLang());
  const t = useUi();
  const site = useSite();
  const href = useHref();
  const sheet = { kicker: t.common.sheet, title: t.common.cv };
  const langs = cv.languages.map((l) => `${l.code}${l.native ? '' : ` ${l.level}`}`).join(' · ');
  const study = cv.education[0];
  return (
    <Panel section="cv" lead={t.drawer.cvLead}>
      <div className="cv">
        <SheetLink className="cv__sheet" href={href(SITE.cv.href)} sheet={sheet} onGo={closeMenu} aria-label={t.drawer.openCvAria} data-anim style={at(1)}>
          <CvMini />
        </SheetLink>
        <div className="cv__side">
          <dl className="meta" data-anim style={at(2)}>
            <div>
              <dt>{t.drawer.studies}</dt>
              <dd>{study ? t.drawer.studiesValue : '—'}</dd>
            </div>
            <div>
              <dt>{t.drawer.languages}</dt>
              <dd>{langs}</dd>
            </div>
            <div>
              <dt>{t.drawer.format}</dt>
              <dd>
                {site.cv.format} · {SITE.revision}
              </dd>
            </div>
          </dl>
          <div className="actions" data-anim style={at(3)}>
            <SheetLink className="btn btn--ink" href={href(SITE.cv.href)} sheet={sheet} onGo={closeMenu}>
              {t.drawer.openCv} <span className="btn__arrow btn__arrow--right">→</span>
            </SheetLink>
            <SheetLink className="btn btn--ghost" href={`${href(SITE.cv.href)}?print=1`} sheet={sheet} onGo={closeMenu}>
              {t.drawer.savePdf} <span className="btn__arrow btn__arrow--down">↓</span>
            </SheetLink>
          </div>
        </div>
      </div>
    </Panel>
  );
}

/** El apartado que se va: su clave (la misma instancia de cuando estaba), su sentido y por dónde sale. */
type Leaving = { section: Section; key: string; pdir: number; exit: number };

function panelOf(section: Section, armed: boolean) {
  if (section === 'projects') return <ProjectsPanel armed={armed} />;
  if (section === 'about') return <AboutPanel />;
  if (section === 'contact') return <ContactPanel />;
  return <CvPanel />;
}

/**
 * Panel de la barra: una lámina que se desenrolla desde la barra superior y rebota al tocar fondo.
 * Cada apartado ocupa el panel entero (título a la izquierda, contenido a la derecha). Al cambiar de
 * pestaña con el panel abierto, el apartado viejo se apaga y sus piezas se retiran hacia el lado
 * contrario mientras el nuevo entra en cascada desde el lado de la pestaña elegida; el número y el
 * título ruedan, y el alto del panel pasa del de uno al del otro sin saltos. Al pie, los atajos.
 */
export function ControlDrawer() {
  const { menuOpen, section } = useSnapshot('menuOpen', 'section');
  const t = useUi();
  const sheet = useRef<HTMLDivElement>(null);
  // Sentido de entrada del contenido: el de la pestaña elegida respecto a la anterior.
  const [shown, setShown] = useState(section);
  const [dir, setDir] = useState(1);
  const [leaving, setLeaving] = useState<Leaving | null>(null);
  // Cada apertura vuelve a montar el contenido para que entre en cascada con el desenrollado.
  const [opens, setOpens] = useState(0);
  const [wasOpenState, setWasOpenState] = useState(menuOpen);
  if (section !== shown) {
    const d = SECTIONS.indexOf(section) >= SECTIONS.indexOf(shown) ? 1 : -1;
    // Solo con el panel ya abierto hay un apartado que se va (al abrir en otro, se monta sin más).
    if (menuOpen && wasOpenState) setLeaving({ section: shown, key: `${shown}-${opens}`, pdir: dir, exit: d });
    setDir(d);
    setShown(section);
  }
  if (menuOpen !== wasOpenState) {
    setWasOpenState(menuOpen);
    if (menuOpen) {
      setOpens((n) => n + 1);
      setLeaving(null);
    }
  }

  // Alto del panel: el del apartado en curso, medido; al cambiar de apartado, la transición lo lleva.
  const [height, setHeight] = useState<number | null>(null);
  const resize = useRef<ResizeObserver | null>(null);
  const current = useCallback((el: HTMLDivElement | null) => {
    resize.current?.disconnect();
    if (!el) return;
    resize.current ??= new ResizeObserver(([entry]) => setHeight(entry.target.getBoundingClientRect().height));
    resize.current.observe(el);
  }, []);
  useEffect(() => () => resize.current?.disconnect(), []);
  const leave = (e: AnimationEvent) => {
    if (e.target === e.currentTarget) setLeaving(null);
  };

  // Con el panel abierto, lo de detrás (ficha, globos, pie) no se alcanza con el tabulador ni con un
  // lector de pantalla: el foco no se escapa a la fábrica mientras el panel la tapa. La barra sigue.
  useEffect(() => {
    if (!menuOpen) return;
    const behind = Array.from(document.querySelectorAll<HTMLElement>('.pcard, .balloons, .rail'));
    behind.forEach((el) => (el.inert = true));
    return () => behind.forEach((el) => (el.inert = false));
  }, [menuOpen]);

  // Foco al contenedor al abrir (no a un enlace: encendería su máquina) y de vuelta al botón al cerrar.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (menuOpen) {
      const t = window.setTimeout(() => sheet.current?.focus({ preventScroll: true }), UNROLL_MS * 0.7);
      wasOpen.current = true;
      return () => window.clearTimeout(t);
    }
    if (wasOpen.current) document.getElementById('menu-toggle')?.focus({ preventScroll: true });
  }, [menuOpen]);

  return (
    <>
      <div className={`scrim${menuOpen ? ' is-on' : ''}`} data-ui onClick={closeMenu} aria-hidden />
      <div id="drawer" className="drawer" data-state={menuOpen ? 'open' : 'closed'} data-ui role="dialog" aria-label={t.bar.menuAria} inert={!menuOpen}>
        <div ref={sheet} className="drawer__sheet" tabIndex={-1} data-lenis-prevent>
          <nav className="drawer__tabs" aria-label={t.bar.sections}>
            {SECTIONS.map((s) => (
              <button key={s} type="button" className={section === s ? 'is-active' : ''} onClick={() => openMenu(s)}>
                {t.sections[s]}
              </button>
            ))}
          </nav>
          <div className="panels" style={{ height: height ?? undefined }}>
            {/* En lista y con clave: el que se va es la misma instancia (su cascada no se repite). */}
            {[
              ...(leaving
                ? [
                    <div
                      key={leaving.key}
                      className="panel is-leaving"
                      data-dir={leaving.pdir}
                      style={{ '--pdir': leaving.pdir, '--exit': leaving.exit } as CSSProperties}
                      inert
                      aria-hidden
                      onAnimationEnd={leave}
                    >
                      {panelOf(leaving.section, opens > 0)}
                    </div>,
                  ]
                : []),
              <div
                key={`${section}-${opens}`}
                ref={current}
                className={`panel${leaving ? ' is-entering' : ''}`}
                data-dir={dir}
                style={{ '--pdir': dir } as CSSProperties}
              >
                {panelOf(section, opens > 0)}
              </div>,
            ]}
          </div>
          <p className="drawer__keys" aria-hidden>
            <span>
              <kbd>←</kbd>
              <kbd>→</kbd> {t.drawer.keys.stations}
            </span>
            <span>
              <kbd>{t.drawer.keys.space}</kbd> {t.drawer.keys.next}
            </span>
            <span>
              <kbd>{t.drawer.keys.home}</kbd>
              <kbd>{t.drawer.keys.end}</kbd> {t.drawer.keys.startContact}
            </span>
            <span>
              <kbd>P</kbd> {t.drawer.keys.pause}
            </span>
            <span>
              <kbd>M</kbd> {t.drawer.keys.menu}
            </span>
            <span>
              <kbd>Esc</kbd> {t.drawer.keys.close}
            </span>
          </p>
        </div>
        <button type="button" className="drawer__edge" onClick={closeMenu} aria-label={t.bar.closeMenu} tabIndex={menuOpen ? 0 : -1}>
          <i aria-hidden />
        </button>
      </div>
    </>
  );
}
