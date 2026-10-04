'use client';

import { plate } from '@/config/plates';
import { SITE, useSite } from '@/config/site';
import { STATIONS, useStations, type StationId } from '@/config/stations';
import { useHref, useLang } from '@/i18n/LangProvider';
import { useUi } from '@/i18n/ui';
import { SheetLink } from './SheetLink';

const TOTAL = String(STATIONS.length).padStart(2, '0');

/** El glifo de un nodo del raíl: el de la portada (círculo; la salida, una flecha a la puerta). */
function Glyph({ exit = false }: { exit?: boolean }) {
  return (
    <span className="node__glyph" aria-hidden>
      {exit ? (
        <svg className="node__shape node__shape--exit" viewBox="0 0 16 16">
          <path d="M2.5 8 H10.5 M8 5.5 L10.5 8 L8 10.5 M13.5 3 V13" />
        </svg>
      ) : (
        <svg className="node__shape" viewBox="0 0 16 16">
          <circle cx="8" cy="8" r="4" />
        </svg>
      )}
    </span>
  );
}

/** El paso a la estación siguiente (o, tras la última, al final de la línea): su lámina y su título. */
function NextStation({ after }: { after: number }) {
  const t = useUi();
  const toHref = useHref();
  const s = useStations()[after + 1];
  const p = plate(s ? s.id : 'exit', useLang());
  const href = toHref(s ? `/projects/${s.id}` : '/#contact');
  const exitTitle = SITE.available ? t.common.available : t.common.exitTitleOff.join(' ');
  return (
    <SheetLink
      href={href}
      className="lidx__next"
      sheet={s ? { kicker: `${s.number} / ${TOTAL}`, title: s.title.join(' ') } : { kicker: t.common.endOfLine, title: t.common.contact }}
    >
      <span className="lidx__next-text">
        <em>{s ? `${t.index.nextStation} · ${s.number} / ${TOTAL}` : t.common.endOfLine}</em>
        <b>{s ? s.title.join(' ') : exitTitle}</b>
        <span>{s ? `${s.field} · ${s.year}` : t.common.emailCv}</span>
        <i className="lidx__next-go" aria-hidden>
          →
        </i>
      </span>
      <span className="lidx__plate" aria-hidden>
        <img src={p.small} srcSet={p.srcSet} sizes="(max-width: 760px) 100vw, 46vw" width={p.width} height={p.height} alt="" loading="lazy" decoding="async" />
      </span>
    </SheetLink>
  );
}

/**
 * Pie de las páginas de lectura: la línea de la portada en pequeño, con la estación de esta hoja
 * marcada y el avance hasta ella; cada nodo lleva a su proyecto y el último al contacto. En las
 * páginas de proyecto, encima, el paso a la estación siguiente. Debajo, el cajetín de la hoja.
 */
export function LineIndex({ current, sheet, next = false }: { current?: StationId; sheet: string; next?: boolean }) {
  const t = useUi();
  const site = useSite();
  const href = useHref();
  const stations = useStations();
  const at = current ? STATIONS.findIndex((s) => s.id === current) : -1;
  return (
    <footer className="lidx">
      {next && at >= 0 && <NextStation after={at} />}
      <nav className="lidx__line" aria-label={t.common.theLine}>
        <p className="lidx__label">
          <span>{t.common.theLine}</span>
          <em>{at >= 0 ? t.index.stationOf(STATIONS[at].number, TOTAL) : t.index.stations(TOTAL)}</em>
        </p>
        <ol className="rail__line">
          {stations.map((s, k) => {
            const text = (
              <>
                <Glyph />
                <span className="node__text">
                  <span className="node__num">{s.number}</span>
                  <span className="node__name">{s.short}</span>
                </span>
              </>
            );
            return (
              <li key={s.id} className="rail__item">
                {s.id === current ? (
                  <span className="node is-active" aria-current="page">
                    {text}
                  </span>
                ) : (
                  <SheetLink
                    href={href(`/projects/${s.id}`)}
                    className="node"
                    sheet={{ kicker: `${s.number} / ${TOTAL}`, title: s.title.join(' ') }}
                    aria-label={`${s.number} ${s.title.join(' ')}`}
                  >
                    {text}
                  </SheetLink>
                )}
                <span className="rail__link" aria-hidden>
                  <span className="rail__fill" style={{ transform: `scaleX(${k < at ? 1 : 0})` }} />
                </span>
              </li>
            );
          })}
          <li className="rail__item">
            <SheetLink
              href={href('/#contact')}
              className="node node--exit"
              sheet={{ kicker: t.common.endOfLine, title: t.common.contact }}
              aria-label={t.common.exitAria}
            >
              <Glyph exit />
              <span className="node__text">
                <span className="node__name">{t.common.contact}</span>
              </span>
            </SheetLink>
          </li>
        </ol>
      </nav>
      {/* Cajetín de la hoja, como el pie de un plano. */}
      <p className="lidx__block" aria-hidden>
        <span>{SITE.name}</span>
        <span>{site.motto.join(' ')}</span>
        <span>{SITE.revision}</span>
        <span>{sheet}</span>
      </p>
    </footer>
  );
}
