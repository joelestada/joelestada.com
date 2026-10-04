import { useLang } from '@/i18n/LangProvider';
import type { Lang } from '@/i18n/lang';
import { bilingual } from '@/i18n/localize';

/**
 * Textos y enlaces de la interfaz. Todo lo editable del portfolio fuera de la escena está aquí.
 * Cada texto va en los dos idiomas, `{ en, es }`; `siteIn(lang)` (o `useSite()` en el cliente) lo
 * da ya resuelto. Un enlace con `href` vacío se muestra como pendiente en desarrollo y se oculta en
 * producción.
 */
const SITE_SRC = {
  name: 'JOEL ESTADA',
  /** El nombre en minúscula de frase: encabezado de la portada y títulos al compartir. */
  person: 'Joel Estada',
  /**
   * Dirección pública del portfolio (p. ej. 'https://joelestada.com'), sin barra final. Hace
   * absolutos los enlaces de la vista previa al compartir, el mapa del sitio y robots.txt. Vacía: en
   * Vercel se usa su dominio de producción (lib/siteUrl.ts).
   */
  url: 'https://joelestada.com' as string,
  /** Quién y dónde: la presentación al principio de la línea (la ficha antes de la primera máquina). */
  role: { en: 'Industrial engineering student', es: 'Estudiante de Ingeniería Industrial' },
  /** El mismo rol en la cabecera de la ficha, donde cabe una línea corta. */
  roleShort: { en: 'Industrial engineering student', es: 'Estudiante de Ing. Industrial' },
  location: { en: 'Valencia, Spain', es: 'Valencia, España' },
  /** Dos o tres líneas bajo el nombre en esa presentación. */
  intro: {
    en: 'Based in Valencia, Spain. I work across engineering, data and software — every machine on this line is a project.',
    es: 'Vivo en Valencia. Trabajo entre la ingeniería, los datos y el software: cada máquina de esta línea es un proyecto.',
  },
  /** Disciplinas y sus máquinas (ids de estación): en About, cada disciplina lleva a las suyas. */
  disciplines: [
    { label: { en: 'Engineering', es: 'Ingeniería' }, work: ['engine', 'structure', 'hydraulic', 'robotic'] },
    { label: { en: 'Data', es: 'Datos' }, work: ['display'] },
    { label: { en: 'Software', es: 'Software' }, work: ['display'] },
  ],
  motto: { en: ['BUILDING', 'USEFUL', 'THINGS'], es: ['CONSTRUIR', 'COSAS', 'ÚTILES'] },
  about: {
    en: 'Industrial engineering student at Universitat Jaume I, working as a generalist project engineer: as much at home on a structural job or the design of a heat engine as on the front end of a SaaS or the statistics of a quant engine. I built Ottometrix end to end and spent three summers working on building sites.',
    es: 'Estudiante de Ingeniería Industrial en la Universitat Jaume I. Trabajo como ingeniero de proyectos generalista: me muevo igual de bien en una obra de estructuras o en el diseño de un motor térmico que en el frontend de un SaaS o en la estadística de un motor cuantitativo. He construido Ottometrix de principio a fin y he pasado tres veranos trabajando en obra.',
  },
  /** Ficha del apartado About: formación, herramientas y experiencia, una fila por línea. */
  background: [
    {
      label: { en: 'STUDIES', es: 'ESTUDIOS' },
      value: { en: 'Industrial Technologies Engineering', es: 'Ingeniería en Tecnologías Industriales' },
      note: { en: 'Universitat Jaume I, Castellón · student', es: 'Universitat Jaume I, Castellón · en curso' },
    },
    {
      label: { en: 'CAD / FEA', es: 'CAD / FEA' },
      value: { en: 'SolidWorks', es: 'SolidWorks' },
      note: { en: 'Assemblies, mechanisms and stress simulation', es: 'Ensamblajes, mecanismos y simulación de tensiones' },
    },
    {
      label: { en: 'PYTHON', es: 'PYTHON' },
      value: { en: 'Python for Everybody', es: 'Python for Everybody' },
      note: { en: 'University of Michigan · 5 courses + capstone', es: 'University of Michigan · 5 cursos + proyecto final' },
    },
    { label: { en: 'MATLAB', es: 'MATLAB' }, value: { en: 'MATLAB', es: 'MATLAB' }, note: { en: 'Fundamentals', es: 'Fundamentos' } },
    {
      label: { en: 'DATA', es: 'DATOS' },
      value: { en: 'Data engineering', es: 'Ingeniería de datos' },
      note: { en: 'Finance and quant engines — shown in Ottometrix', es: 'Finanzas y motores cuantitativos, a la vista en Ottometrix' },
    },
    {
      label: { en: 'AI', es: 'IA' },
      value: { en: 'AI-assisted development', es: 'Desarrollo asistido por IA' },
      note: { en: 'Claude Code, Cursor', es: 'Claude Code, Cursor' },
    },
    { label: { en: 'WORK', es: 'TRABAJO' }, value: { en: 'Construction sites', es: 'Obra' }, note: { en: 'Summer jobs', es: 'Trabajos de verano' } },
  ],
  available: true,
  availability: { en: 'OPEN TO NEW PROJECTS', es: 'DISPONIBLE PARA NUEVOS PROYECTOS' },
  contact: {
    email: 'joelestada05@gmail.com',
    links: [
      { label: 'LINKEDIN', href: '' },
      { label: 'GITHUB', href: 'https://github.com/joelestada' },
    ],
  },
  cv: {
    /** El CV es una página (una lámina A4 que se guarda en PDF); su contenido, en config/cv.ts. */
    href: '/cv',
    format: { en: 'A4 · ONE PAGE', es: 'A4 · UNA PÁGINA' },
  },
  /** Revisión mostrada en el cajetín del panel. */
  revision: 'REV. 2026.09',
};

const SITE_IN = bilingual(SITE_SRC);
export type Site = (typeof SITE_IN)['en'];

/** Los textos de la web en un idioma. */
export const siteIn = (lang: Lang): Site => SITE_IN[lang];

/** Lo mismo en un componente de cliente, con el idioma de la página. */
export const useSite = () => SITE_IN[useLang()];

/** Lo que no cambia con el idioma (nombre, email, enlaces, dirección): sin hook ni idioma. */
export const SITE = SITE_IN.en as Pick<Site, 'name' | 'person' | 'url' | 'available' | 'contact' | 'revision'> & { cv: { href: string } };
