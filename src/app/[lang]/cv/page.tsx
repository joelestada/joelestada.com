import type { Metadata } from 'next';
import { CEFR, cvIn } from '@/config/cv';
import { projectIn } from '@/config/projects';
import { SITE } from '@/config/site';
import { STATIONS, stationsIn } from '@/config/stations';
import { DEFAULT_LANG, isLang, localePath, type Lang } from '@/i18n/lang';
import { alternatesFor } from '@/i18n/meta';
import { uiIn } from '@/i18n/ui';
import { SheetLink } from '@/ui/SheetLink';
import { SheetPage } from '@/ui/SheetPage';
import { SavePdf } from './CvActions';
import './cv.css';

type Props = { params: Promise<{ lang: string }> };

const langOf = async (params: Props['params']) => {
  const { lang } = await params;
  return isLang(lang) ? lang : DEFAULT_LANG;
};

/** El título es también el nombre del archivo al guardar en PDF. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const lang = await langOf(params);
  return {
    title: `${SITE.person} — CV`,
    description: `${uiIn(lang).cv.of(SITE.person)}: ${cvIn(lang).headline}.`,
    alternates: alternatesFor(lang, SITE.cv.href),
  };
}

/** Habilidades de un grupo, de más a menos (su nivel no se pinta; ver config/cv.ts). */
const byLevel = <T extends { level: number }>(items: T[]) => [...items].sort((a, b) => b.level - a.level);

/**
 * CV en una lámina A4: cajetín con nombre y contacto; a la izquierda habilidades (de más a menos),
 * idiomas en la escala europea y competencias; a la derecha perfil, experiencia, formación y
 * certificados; al pie, el cajetín de revisión. En pantalla se ve montada sobre la mesa, con la
 * barra y la línea de las demás hojas; al imprimir (guardar en PDF) queda exactamente un A4.
 */
export default async function CvPage({ params }: Props) {
  const lang = await langOf(params);
  const t = uiIn(lang);
  const CV = cvIn(lang);
  const links = SITE.contact.links.filter((l) => l.href);
  return (
    <SheetPage bar={{ here: { label: 'CV' }, current: 'cv', actions: <SavePdf /> }} line={{ sheet: t.cv.lineSheet }}>
      <main className="cvp">
        <article className="cv-sheet" aria-label={t.cv.of(SITE.person)}>
          <header className="cv-head">
            <div className="cv-head__main">
              <h1>{SITE.person}</h1>
              <p className="cv-head__line">{CV.headline}</p>
            </div>
            <dl className="cv-head__contact">
              <div>
                <dt>{t.cv.email}</dt>
                <dd>
                  <a href={`mailto:${SITE.contact.email}`}>{SITE.contact.email}</a>
                </dd>
              </div>
              <div>
                <dt>{t.cv.basedIn}</dt>
                <dd>{CV.location}</dd>
              </div>
              {SITE.url && (
                <div>
                  <dt>{t.cv.portfolio}</dt>
                  <dd>
                    <a href={SITE.url}>{SITE.url.replace(/^https?:\/\//, '')}</a>
                  </dd>
                </div>
              )}
              {links.map((l) => (
                <div key={l.label}>
                  <dt>{l.label}</dt>
                  <dd>
                    <a href={l.href}>{l.href.replace(/^https?:\/\/(www\.)?/, '')}</a>
                  </dd>
                </div>
              ))}
              {SITE.available && (
                <div>
                  <dt>{t.cv.status}</dt>
                  <dd className="cv-status">
                    <i aria-hidden /> {t.common.available}
                  </dd>
                </div>
              )}
            </dl>
          </header>

          <div className="cv-body">
            <aside className="cv-side">
              <section aria-labelledby="cv-skills">
                <h2 id="cv-skills" className="cv-h">
                  {t.cv.skills}
                </h2>
                {CV.skills.map((g) => (
                  <div key={g.group} className="cv-skills">
                    <h3>{g.group}</h3>
                    <ul>
                      {byLevel(g.items).map((it) => (
                        <li key={it.name}>
                          <span>
                            {it.name}
                            {it.note && <em>{it.note}</em>}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </section>

              <section aria-labelledby="cv-langs">
                <h2 id="cv-langs" className="cv-h">
                  {t.cv.languages}
                </h2>
                <ul className="cv-langs">
                  {CV.languages.map((l) => (
                    <li key={l.name}>
                      <p>
                        <b>{l.name}</b>
                        <span>{l.native ? t.cv.native : l.level}</span>
                      </p>
                      <span className="cv-cefr" aria-hidden>
                        {CEFR.map((c) => (
                          <i key={c} className={CEFR.indexOf(c) <= CEFR.indexOf(l.level) ? 'is-on' : undefined}>
                            {c}
                          </i>
                        ))}
                      </span>
                      {l.cert && <em>{l.cert}</em>}
                    </li>
                  ))}
                </ul>
              </section>

              <section aria-labelledby="cv-soft">
                <h2 id="cv-soft" className="cv-h">
                  {t.cv.strengths}
                </h2>
                <ul className="cv-soft">
                  {CV.soft.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </section>
            </aside>

            <div className="cv-main">
              <section aria-labelledby="cv-profile">
                <h2 id="cv-profile" className="cv-h">
                  {t.cv.profile}
                </h2>
                <p className="cv-profile">{CV.profile}</p>
              </section>

              <section aria-labelledby="cv-exp">
                <h2 id="cv-exp" className="cv-h">
                  {t.cv.experience}
                </h2>
                {CV.experience.map((x) => (
                  <div key={x.role} className="cv-item">
                    <p className="cv-item__head">
                      <b>{x.role}</b>
                      {x.period && <span>{x.period}</span>}
                    </p>
                    <p className="cv-item__org">{x.org}</p>
                    <ul>
                      {x.points.map((pt) => (
                        <li key={pt.slice(0, 24)}>{pt}</li>
                      ))}
                    </ul>
                    {'figures' in x && x.figures && projectIn(x.figures, lang) && (
                      <dl className="cv-figures">
                        {projectIn(x.figures, lang)!.stats.map((st) => (
                          <div key={st.label}>
                            <dt>{st.label}</dt>
                            <dd>{st.value}</dd>
                          </div>
                        ))}
                      </dl>
                    )}
                    {'link' in x && x.link && (
                      <SheetLink className="cv-item__link" href={localePath(lang, x.link.href)} sheet={sheetOf(x.link.href, lang)}>
                        {x.link.label} →
                      </SheetLink>
                    )}
                  </div>
                ))}
              </section>

              <section aria-labelledby="cv-edu">
                <h2 id="cv-edu" className="cv-h">
                  {t.cv.education}
                </h2>
                {CV.education.map((e) => (
                  <div key={e.title} className="cv-item">
                    <p className="cv-item__head">
                      <b>{e.title}</b>
                      {e.period && <span>{e.period}</span>}
                    </p>
                    <p className="cv-item__org">{e.org}</p>
                  </div>
                ))}
              </section>

              <section aria-labelledby="cv-certs">
                <h2 id="cv-certs" className="cv-h">
                  {t.cv.certificates}
                </h2>
                <ul className="cv-certs">
                  {CV.certificates.map((c) => (
                    <li key={c.title}>
                      <b>{c.title}</b>
                      <span>
                        {c.org}
                        {c.note && ` · ${c.note}`}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          </div>

          {/* Cajetín de revisión, como el de un plano. */}
          <footer className="cv-foot" aria-hidden>
            <span>{t.cv.footTitle}</span>
            <span>{SITE.name}</span>
            <span>{SITE.revision}</span>
            <span>{t.cv.footSheet}</span>
          </footer>
        </article>
      </main>
    </SheetPage>
  );
}

/** Rótulo de la hoja a la que lleva un enlace del CV (la página de un proyecto). */
function sheetOf(href: string, lang: Lang) {
  const s = stationsIn(lang).find((st) => href === `/projects/${st.id}`);
  return s ? { kicker: `${s.number} / ${String(STATIONS.length).padStart(2, '0')}`, title: s.title.join(' ') } : { title: uiIn(lang).common.theLine };
}
