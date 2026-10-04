import type { CSSProperties } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { plate } from '@/config/plates';
import { projectIn } from '@/config/projects';
import { SITE } from '@/config/site';
import { STATIONS, isStationId, stationByIdIn } from '@/config/stations';
import { DEFAULT_LANG, isLang, localePath } from '@/i18n/lang';
import { alternatesFor } from '@/i18n/meta';
import { uiIn } from '@/i18n/ui';
import { SheetPage } from '@/ui/SheetPage';
import { BackToLine } from './ProjectChrome';
import { ProjectView } from './ProjectView';
import '../project.css';

export const dynamicParams = false;

export function generateStaticParams() {
  return STATIONS.map((s) => ({ id: s.id }));
}

type Props = { params: Promise<{ lang: string; id: string }> };

/** Idioma e id de la dirección (un idioma desconocido no llega aquí: lo filtra el layout). */
async function read(params: Props['params']) {
  const { lang: raw, id } = await params;
  return { lang: isLang(raw) ? raw : DEFAULT_LANG, id };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, id } = await read(params);
  if (!isStationId(id)) return {};
  const s = stationByIdIn(lang)[id];
  const t = uiIn(lang);
  const title = `${s.title.join(' ')} — ${SITE.person}`;
  return {
    title,
    description: s.description,
    alternates: alternatesFor(lang, `/projects/${id}`),
    openGraph: {
      type: 'article',
      siteName: SITE.person,
      locale: lang === 'es' ? 'es_ES' : 'en_US',
      title,
      description: s.description,
      url: localePath(lang, `/projects/${id}`),
      images: [{ url: `/og/${lang}/${id}.jpg`, width: 1200, height: 630, alt: t.meta.projectOgAlt(s.title.join(' '), s.number) }],
    },
    twitter: { card: 'summary_large_image' },
  };
}

const TOTAL = String(STATIONS.length).padStart(2, '0');

/**
 * Página de proyecto: la vista completa si el proyecto tiene contenido (config/projects.ts) y, si no,
 * la hoja provisional: cabecera con su cajetín, la lámina de la máquina tal como está en la línea con
 * el sello «en preparación», y las dos salidas útiles (verla funcionando y preguntar por ella).
 */
export default async function ProjectPage({ params }: Props) {
  const { lang, id } = await read(params);
  if (!isStationId(id)) notFound();
  const s = stationByIdIn(lang)[id];
  const t = uiIn(lang);
  const content = projectIn(id, lang);
  const bar = { here: { n: s.number, label: s.title.join(' ') }, back: s.id };
  const line = { current: s.id, sheet: t.common.sheetOf(s.number, TOTAL), next: true };
  if (content) {
    return (
      <SheetPage bar={bar} line={line}>
        <ProjectView s={s} p={content} t={t} />
      </SheetPage>
    );
  }
  const p = plate(s.id, lang);
  const title = s.title.join(' ');
  const ask = `mailto:${SITE.contact.email}?subject=${encodeURIComponent(t.project.askSubject(title))}`;

  return (
    <SheetPage bar={bar} line={line}>
      <main className="proj">
        <header className="proj__head">
          <p className="proj__count">
            <b>{s.number}</b>
            <em>/{TOTAL}</em>
            <span>{s.field}</span>
          </p>
          <h1 className="proj__title">
            {s.title.map((line, i, all) => (
              <span key={line} style={{ '--i': i } as CSSProperties}>
                {line}
                {i < all.length - 1 && ' '}
              </span>
            ))}
          </h1>
          <p className="proj__lead">{s.description}</p>
          <dl className="proj__meta">
            <div>
              <dt>{t.project.year}</dt>
              <dd>{s.year}</dd>
            </div>
            <div>
              <dt>{t.project.station}</dt>
              <dd>
                {s.number} / {TOTAL}
              </dd>
            </div>
            <div>
              <dt>{t.project.sheet}</dt>
              <dd>{t.project.inPreparation}</dd>
            </div>
          </dl>
        </header>

        <section className="proj__plate" aria-label={t.project.machine}>
          <figure className="mount">
            <div className="mount__view">
              <i className="mount__cross mount__cross--tl" aria-hidden />
              <i className="mount__cross mount__cross--tr" aria-hidden />
              <i className="mount__cross mount__cross--bl" aria-hidden />
              <i className="mount__cross mount__cross--br" aria-hidden />
              <img
                src={p.src}
                srcSet={p.srcSet}
                sizes="(max-width: 1100px) 100vw, 64vw"
                width={p.width}
                height={p.height}
                alt={t.project.plateAlt(title, s.number)}
              />
            </div>
            <figcaption className="proj__caption">
              <b>
                {t.project.st} {s.number} · {s.year}
              </b>
              <span>{t.project.running}</span>
            </figcaption>
          </figure>
          <div className="proj__side">
            <p className="stamp" aria-hidden>
              {t.project.stamp}
              <small>{t.project.stampSub}</small>
            </p>
            <p className="proj__note">{t.project.note}</p>
            <div className="proj__actions">
              <BackToLine id={s.id} className="btn btn--ink">
                {t.common.seeOnLine} <span className="btn__arrow btn__arrow--right">→</span>
              </BackToLine>
              <a className="btn" href={ask}>
                {t.project.ask} <span className="btn__arrow">↗</span>
              </a>
            </div>
          </div>
        </section>
      </main>
    </SheetPage>
  );
}
