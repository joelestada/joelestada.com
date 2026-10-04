import { cvIn } from '@/config/cv';
import { projectIn } from '@/config/projects';
import { SITE, siteIn } from '@/config/site';
import { stationsIn } from '@/config/stations';
import { localePath } from '@/i18n/lang';
import { SITE_URL } from '@/lib/siteUrl';

/**
 * /llms.txt: la web resumida en texto para los asistentes de IA y sus buscadores, que no ejecutan la
 * escena 3D (convención de llmstxt.org). Sale de los mismos textos que la web, en inglés. Solo dice lo
 * que es real: de los proyectos sin hoja escrita (descripción y año aún provisionales) da solo el título.
 */
export const dynamic = 'force-static';

export function GET() {
  const lang = 'en' as const;
  const site = siteIn(lang);
  const cv = cvIn(lang);
  const url = (path: string) => `${SITE_URL}${localePath(lang, path)}`;
  const lines: string[] = [];
  const out = (...l: string[]) => lines.push(...l);

  out(`# ${SITE.person}`, '', `> ${cv.headline}. ${site.intro}`, '');
  out(site.about, '');
  out(
    `The portfolio is an interactive isometric factory drawn like an engineering sheet: every machine on the production line is a project. ` +
      `It is available in English (${url('/')}) and Spanish (${SITE_URL}${localePath('es', '/')}).`,
    '',
  );

  out('## Projects', '');
  for (const s of stationsIn(lang)) {
    const p = projectIn(s.id, lang);
    const title = s.title.join(' ');
    if (!p) {
      out(`- [${title}](${url(`/projects/${s.id}`)}): project sheet in preparation.`);
      continue;
    }
    out(`- [${title}](${url(`/projects/${s.id}`)}): ${p.lead} Role: ${p.role}. Status: ${p.status}.`);
  }
  out('');

  for (const s of stationsIn(lang)) {
    const p = projectIn(s.id, lang);
    if (!p) continue;
    out(`### ${s.title.join(' ')}`, '');
    if (p.tagline) out(`Tagline: ${p.tagline}`, '');
    out(...p.stats.map((st) => `- ${st.value} ${st.label}${st.note ? ` (${st.note})` : ''}`), '');
    for (const sec of p.sections) {
      out(`#### ${sec.title}`, '', ...sec.body.flatMap((b) => [b, '']));
      if (sec.points) out(...sec.points.map((pt) => `- ${pt}`), '');
    }
    if (p.tests) out(`#### ${p.tests.title}`, '', p.tests.intro, '', p.tests.outcome, '');
    out('#### Stack', '', ...p.stack.map((g) => `- ${g.group}: ${g.items.join(', ')}`), '');
    out('#### What I learned', '', ...p.lessons.map((l) => `- ${l}`), '');
  }

  out('## CV', '', `Full CV (one A4 page, printable): ${url(SITE.cv.href)}`, '', cv.profile, '');
  out('### Experience', '');
  for (const e of cv.experience) out(`- ${e.role}, ${e.org} (${e.period}): ${e.points.join(' ')}`);
  out('', '### Education', '', ...cv.education.map((e) => `- ${e.title}, ${e.org} (${e.period})`), '');
  out('### Certificates', '', ...cv.certificates.map((c) => `- ${c.title}, ${c.org}${c.note ? ` (${c.note})` : ''}`), '');
  out('### Skills', '', ...cv.skills.map((g) => `- ${g.group}: ${g.items.map((i) => i.name).join(', ')}`), '');
  out('### Languages', '', ...cv.languages.map((l) => `- ${l.name}: ${l.native ? 'native' : l.level}${l.cert ? ` (${l.cert})` : ''}`), '');

  out('## Contact', '', `- Email: ${SITE.contact.email}`);
  const named: Record<string, string> = { GITHUB: 'GitHub', LINKEDIN: 'LinkedIn' };
  for (const l of SITE.contact.links) if (l.href) out(`- ${named[l.label] ?? l.label}: ${l.href}`);
  out(`- Status: ${site.available ? 'open to new projects' : 'not available'}`, '');

  return new Response(lines.join('\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
