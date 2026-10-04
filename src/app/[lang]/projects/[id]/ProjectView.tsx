import type { CSSProperties, ReactNode } from 'react';
import type { ProjectContent } from '@/config/projects';
import { SITE } from '@/config/site';
import { STATIONS, type StationDef } from '@/config/stations';
import type { Ui } from '@/i18n/ui';
import { BackToLine } from './ProjectChrome';
import { ProjectIndex, ProjectModules, ProjectTests, ProjectTour } from './ProjectParts';
import './project-view.css';

const TOTAL = String(STATIONS.length).padStart(2, '0');
const mailto = (subject: string) => `mailto:${SITE.contact.email}?subject=${encodeURIComponent(subject)}`;

/** «Clave: texto» → [clave, texto] (los puntos de una sección con su nombre en negrita). */
const splitPoint = (pt: string) => {
  const [k, ...rest] = pt.split(': ');
  return rest.length ? [k, rest.join(': ')] : [null, pt];
};

/**
 * Página de proyecto. De arriba abajo:
 * - portada editorial: titular grande, entradilla y un cajetín con rol, año y estado;
 * - el producto primero: sus pantallas en pestañas, montadas como láminas (la ficha de un valor
 *   delante, con globos numerados que se explican debajo);
 * - cifras clave y el proceso dibujado como la línea de la nave;
 * - el texto a una columna con un índice fijo: problema, motor (factores), validación (IC dentro y
 *   fuera de muestra y la tira de ensayos), producto, lista de materiales y lo aprendido;
 * - el cierre con la llamada a la acción y la vuelta a la máquina en la línea.
 * La barra, el paso a la estación siguiente y la línea los pone la página (son comunes).
 */
export function ProjectView({ s, p, t }: { s: StationDef; p: ProjectContent; t: Ui }) {
  const sec = Object.fromEntries(p.sections.map((x) => [x.id, x]));
  const index = [...p.sections.map((x) => ({ id: x.id, title: x.title })), { id: 'stack', title: t.project.bom }, { id: 'lessons', title: t.project.lessons }];
  const tests = p.tests;
  // Las primeras pantallas, las del mismo grupo que la primera, son los módulos de la ficha.
  const modules = p.figures.findIndex((f) => f.group !== p.figures[0].group);

  const Section = ({ id, children }: { id: string; children?: ReactNode }) => {
    const x = sec[id];
    if (!x) return null;
    return (
      <section id={id} className="pj-sec" aria-labelledby={`${id}-h`}>
        <h2 id={`${id}-h`}>{x.title}</h2>
        {x.body.map((b) => (
          <p key={b.slice(0, 32)}>{b}</p>
        ))}
        {children}
      </section>
    );
  };

  const points = (sec.engine?.points ?? []).map(splitPoint);

  return (
    <main className="pj">
      <header className="pj-hero">
        <p className="pj-hero__kicker">
          <b>{s.number}</b>/{TOTAL}
          <span>{s.field}</span>
        </p>
        <h1 className="pj-hero__title">{s.title.join(' ')}</h1>
        {p.tagline && <p className="pj-hero__tagline">{p.tagline}</p>}
        <p className="pj-hero__lead">{p.lead}</p>
        <dl className="pj-hero__block">
          <div className="is-wide">
            <dt>{t.project.role}</dt>
            <dd>{p.role}</dd>
          </div>
          <div>
            <dt>{t.project.year}</dt>
            <dd>{s.year}</dd>
          </div>
          <div>
            <dt>{t.project.status}</dt>
            <dd>{p.status}</dd>
          </div>
        </dl>
      </header>

      <ProjectTour figures={p.figures} />

      <section className="pj-stats" aria-label={t.project.keyFigures}>
        {p.stats.map((st) => (
          <div key={st.label}>
            <b>{st.value}</b>
            <span>{st.label}</span>
            {st.note && <em>{st.note}</em>}
          </div>
        ))}
      </section>

      {/* El proceso como la línea de la nave: un raíl con sus estaciones. */}
      <section className="pj-line" aria-labelledby="pj-line-h">
        <h2 id="pj-line-h" className="pj-label">
          {t.project.howItWorks}
        </h2>
        <ol>
          {p.pipeline.map((st, k) => (
            <li key={st.label}>
              <span className="pj-line__node" aria-hidden>
                {k + 1}
              </span>
              <b>{st.label}</b>
              <span>{st.detail}</span>
            </li>
          ))}
        </ol>
      </section>

      <div className="pj-body">
        <aside className="pj-aside">
          <ProjectIndex items={index} />
          <a className="pj-cta pj-cta--ink" href={mailto(p.cta.subject)}>
            {p.cta.label} <span aria-hidden>↗</span>
          </a>
        </aside>

        <div className="pj-content">
          <Section id="problem" />

          <Section id="engine">
            {points.length > 0 && (
              <>
                <ul className="pj-factors">
                  {points.slice(0, 4).map(([k, v]) => (
                    <li key={v}>
                      <em>¼</em>
                      <b>{k}</b>
                      <span>{v}</span>
                    </li>
                  ))}
                </ul>
                <ul className="pj-rules">
                  {points.slice(4).map(([k, v]) => (
                    <li key={v}>
                      {k && <b>{k}:</b>} {v}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Section>

          <Section id="validation">
            {tests && (
              <div className="pj-valid">
                {tests.compare && (
                  <div
                    className="pj-chart"
                    role="img"
                    aria-label={`${tests.compare.title}: ${tests.compare.rows.map((r) => `${r.text} ${r.label}`).join(', ')}`}
                  >
                    <p className="pj-label">{tests.compare.title}</p>
                    {tests.compare.rows.map((r) => (
                      <div key={r.label} className="pj-meter">
                        <span>{r.label}</span>
                        <i style={{ '--w': r.value / Math.max(...tests.compare!.rows.map((x) => x.value)) } as CSSProperties} />
                        <b>{r.text}</b>
                      </div>
                    ))}
                  </div>
                )}
                <div className="pj-chart">
                  <p className="pj-label">
                    {tests.title} · {t.project.tests(tests.rows.length)}
                  </p>
                  <p className="pj-chart__intro">{tests.intro}</p>
                  <ProjectTests rows={tests.rows} />
                </div>
                <p className="pj-callout">{tests.outcome}</p>
              </div>
            )}
          </Section>

          <Section id="product">
            <ProjectModules figures={p.figures} count={modules < 0 ? p.figures.length : modules} />
          </Section>

          <section id="stack" className="pj-sec" aria-labelledby="stack-h">
            <h2 id="stack-h">{t.project.bom}</h2>
            <table className="pj-bom">
              <tbody>
                {p.stack.map((g) => (
                  <tr key={g.group}>
                    <th scope="row">{g.group}</th>
                    <td>
                      <ul>
                        {g.items.map((it) => (
                          <li key={it}>{it}</li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section id="lessons" className="pj-sec" aria-labelledby="lessons-h">
            <h2 id="lessons-h">{t.project.lessons}</h2>
            {p.lessons.map((l) => (
              <blockquote key={l.slice(0, 32)} className="pj-quote">
                {l}
              </blockquote>
            ))}
          </section>
        </div>
      </div>

      <div className="pj-endwrap">
        <section className="pj-end" aria-label={t.common.contact}>
          {p.tagline && <p className="pj-end__tagline">{p.tagline}</p>}
          {p.cta.note && <p className="pj-end__note">{p.cta.note}</p>}
          <div className="pj-end__actions">
            <a className="pj-cta" href={mailto(p.cta.subject)}>
              {p.cta.label} <span aria-hidden>↗</span>
            </a>
            <BackToLine id={s.id} className="pj-cta pj-cta--line">
              {t.common.seeOnLine} <span aria-hidden>→</span>
            </BackToLine>
          </div>
        </section>
      </div>
    </main>
  );
}
