'use client';

import { useEffect, useRef } from 'react';
import { plate } from '@/config/plates';
import { SITE, useSite } from '@/config/site';
import { isStationId, STATIONS, useStations } from '@/config/stations';
import { useHref, useLang } from '@/i18n/LangProvider';
import { useUi } from '@/i18n/ui';
import { setFlatStop } from '@/lib/runtime';
import { SheetLink } from './SheetLink';
import { useCopyEmail } from './useCopyEmail';

const TOTAL = String(STATIONS.length).padStart(2, '0');

/** El final de la línea: la lámina de la salida, el email, copiarlo y el CV. */
function Exit() {
  const { email, copied, copy } = useCopyEmail();
  const t = useUi();
  const href = useHref();
  const p = plate('exit', useLang());
  return (
    <div className="lidx__next flat__exit">
      <div className="lidx__next-text">
        <em>{t.common.endOfLine}</em>
        <h2 className="flat__name">{SITE.available ? t.common.available : t.common.exitTitleOff.join(' ')}</h2>
        <a className="flat__mail" href={`mailto:${email}`}>
          {email} <span aria-hidden>↗</span>
        </a>
        <div className="flat__actions">
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
      </div>
      <span className="lidx__plate" aria-hidden>
        <img src={p.small} srcSet={p.srcSet} sizes="(max-width: 760px) 100vw, 46vw" width={p.width} height={p.height} alt="" loading="lazy" decoding="async" />
      </span>
    </div>
  );
}

/**
 * La línea en láminas: lo que ve quien no puede dibujar la nave (sin WebGL, o si el lienzo falla).
 * Las mismas paradas que la nave, de arriba abajo: una lámina por estación, con su vista recortada de la
 * propia nave, que lleva a su hoja; y al final, el contacto. Cada lámina tiene el id de su estación, así
 * que los enlaces compartidos (#display, #contact) y la barra llevan a ella; la barra sigue a la que se lee.
 */
export function FlatLine() {
  const list = useRef<HTMLOListElement>(null);
  const t = useUi();
  const site = useSite();
  const href = useHref();
  const stations = useStations();
  const lang = useLang();

  useEffect(() => {
    const stops = list.current?.querySelectorAll<HTMLElement>('[data-stop]');
    if (!stops) return;
    // La lámina que cruza la mitad de la pantalla es la que se lee.
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const id = (e.target as HTMLElement).dataset.stop;
          setFlatStop(isStationId(id) ? id : null);
        }
      },
      { rootMargin: '-50% 0px -50% 0px' },
    );
    stops.forEach((s) => io.observe(s));
    // Un enlace compartido a una estación: la página ya está aquí, pero la lámina aún no existía al cargar.
    const target = location.hash.slice(1) && document.getElementById(location.hash.slice(1));
    if (target) target.scrollIntoView({ block: 'start' });
    return () => io.disconnect();
  }, []);

  return (
    <section className="flat" aria-label={t.common.theLine}>
      <header className="flat__head">
        <p className="flat__kicker">
          {site.role} · {site.location}
        </p>
        {/* El nombre y el perfil ya los leen los lectores de pantalla en el encabezado de la página. */}
        <p className="flat__title" aria-hidden>
          {SITE.person}
        </p>
        <p className="flat__lead" aria-hidden>
          {site.about}
        </p>
        <p className="flat__note">{t.flat.note}</p>
      </header>

      <ol ref={list} className="flat__list">
        {stations.map((s) => {
          const p = plate(s.id, lang);
          return (
            <li key={s.id} id={s.id} className="flat__stop" data-stop={s.id}>
              <SheetLink href={href(`/projects/${s.id}`)} className="lidx__next" sheet={{ kicker: `${s.number} / ${TOTAL}`, title: s.title.join(' ') }}>
                <span className="lidx__next-text">
                  <em>
                    {s.number} / {TOTAL} · {s.field} · {s.year}
                  </em>
                  <h2 className="flat__name">{s.title.join(' ')}</h2>
                  <span className="flat__desc">{s.description}</span>
                  <i className="lidx__next-go" aria-hidden>
                    →
                  </i>
                </span>
                <span className="lidx__plate" aria-hidden>
                  <img
                    src={p.small}
                    srcSet={p.srcSet}
                    sizes="(max-width: 760px) 100vw, 46vw"
                    width={p.width}
                    height={p.height}
                    alt=""
                    loading="lazy"
                    decoding="async"
                  />
                </span>
              </SheetLink>
            </li>
          );
        })}
        <li id="contact" className="flat__stop" data-stop="exit">
          <Exit />
        </li>
      </ol>

      {/* Cajetín de la hoja, como el pie de las páginas de lectura (la línea ya es la lista de arriba). */}
      <footer className="lidx">
        <p className="lidx__block" aria-hidden>
          <span>{SITE.name}</span>
          <span>{site.motto.join(' ')}</span>
          <span>{SITE.revision}</span>
          <span>{t.flat.sheet}</span>
        </p>
      </footer>
    </section>
  );
}
