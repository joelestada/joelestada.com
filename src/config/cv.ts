import type { Lang } from '@/i18n/lang';
import { bilingual } from '@/i18n/localize';

/**
 * Contenido del CV (página /cv, una lámina A4 que se guarda en PDF), en los dos idiomas. Lo editable
 * está aquí; el nombre, el email y los enlaces salen de site.ts. Un campo vacío no se pinta.
 *
 * Niveles de las habilidades (autoevaluación de Joel, 2026-09-30): 3 = muy alto, 2 = alto, 1 = medio.
 * No se pintan (una escala hecha por uno mismo resta más de lo que dice); ordenan cada grupo, de más a menos.
 */

export type SkillLevel = 1 | 2 | 3;

/** Escala del Marco Común Europeo, de menos a más. */
export const CEFR = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
export type Cefr = (typeof CEFR)[number];

const CV_SRC = {
  headline: { en: 'Industrial engineering student · Project engineer', es: 'Estudiante de Ingeniería Industrial · Ingeniero de proyectos' },
  location: { en: 'Sagunto, Valencia, Spain', es: 'Sagunto, Valencia, España' },
  profile: {
    en: 'Industrial engineering student working as a generalist project engineer: as much at home on a structural job or the design of a heat engine as on the front end of a SaaS or the statistics of a quant engine. Designed and built Ottometrix end to end, from the data pipeline to the product.',
    es: 'Estudiante de Ingeniería Industrial e ingeniero de proyectos generalista: me muevo igual de bien en una obra de estructuras o en el diseño de un motor térmico que en el frontend de un SaaS o en la estadística de un motor cuantitativo. He diseñado y construido Ottometrix de principio a fin, de los datos al producto.',
  },
  experience: [
    {
      role: { en: 'Founder · quant engine and SaaS', es: 'Fundador · motor cuantitativo y SaaS' },
      org: { en: 'Ottometrix (own project)', es: 'Ottometrix (proyecto propio)' },
      period: { en: '2026 — present', es: '2026 — actualidad' },
      points: [
        {
          en: 'Designed and built a four-factor engine that ranks ~2,400 US stocks every six months, on a point-in-time data pipeline (Python, DuckDB).',
          es: 'Diseñé y construí un motor de cuatro factores que ordena ~2.400 acciones de EE. UU. cada seis meses, sobre un pipeline de datos point-in-time (Python, DuckDB).',
        },
        {
          en: 'Validated it with pre-registered tests and a one-shot holdout; reverted the only change that failed out of sample.',
          es: 'Lo validé con ensayos prerregistrados y un holdout de un solo uso; revertí el único cambio que falló fuera de muestra.',
        },
        {
          en: 'Built the SaaS: screener, stock file and portfolio X-ray (Next.js, TypeScript).',
          es: 'Construí el SaaS: screener, ficha de empresa y radiografía de cartera (Next.js, TypeScript).',
        },
      ],
      /** Ruta sin idioma: la página le pone el suyo. */
      link: { label: { en: 'Project sheet', es: 'Hoja del proyecto' }, href: '/projects/display' },
      /** Cifras del proyecto (las de su página): se muestran como un cajetín bajo la experiencia. */
      figures: 'display' as const,
    },
    {
      role: { en: 'Construction site work', es: 'Trabajo en obra' },
      org: { en: 'Informal summer work', es: 'Trabajo de verano informal' },
      period: { en: '3 summers', es: '3 veranos' },
      points: [
        {
          en: 'Hands-on work on building sites over three summers, as part of the crew.',
          es: 'Trabajo práctico en obra durante tres veranos, como parte de la cuadrilla.',
        },
      ],
    },
  ],
  education: [
    {
      title: { en: 'Degree in Industrial Technologies Engineering', es: 'Grado en Ingeniería en Tecnologías Industriales' },
      org: { en: 'Universitat Jaume I · Castellón', es: 'Universitat Jaume I · Castellón' },
      period: { en: 'In progress', es: 'En curso' },
    },
  ],
  certificates: [
    { title: { en: 'C1 Advanced (CAE)', es: 'C1 Advanced (CAE)' }, org: { en: 'Cambridge English', es: 'Cambridge English' } },
    { title: { en: 'Valencian C1', es: 'C1 de valenciano' }, org: { en: 'Generalitat Valenciana', es: 'Generalitat Valenciana' } },
    {
      title: { en: 'Python for Everybody Specialization', es: 'Python for Everybody Specialization' },
      org: { en: 'University of Michigan · Coursera', es: 'University of Michigan · Coursera' },
      note: { en: '5 courses + capstone project', es: '5 cursos + proyecto final' },
    },
  ],
  skills: [
    {
      group: { en: 'Engineering', es: 'Ingeniería' },
      items: [
        { name: { en: 'Theory of machines', es: 'Teoría de máquinas' }, level: 3 },
        { name: { en: 'Heat engines', es: 'Máquinas térmicas' }, level: 3 },
        { name: { en: 'Structures', es: 'Estructuras' }, level: 3 },
        { name: { en: 'Engineering projects', es: 'Proyectos de ingeniería' }, level: 2, note: { en: 'multidisciplinary', es: 'multidisciplinares' } },
        { name: { en: 'Fluid simulation (CFD)', es: 'Simulación de fluidos (CFD)' }, level: 1 },
      ],
    },
    {
      group: { en: 'CAD', es: 'CAD' },
      items: [
        { name: { en: 'SolidWorks', es: 'SolidWorks' }, level: 3, note: { en: 'assemblies, mechanisms, FEA', es: 'ensamblajes, mecanismos, FEA' } },
        { name: { en: 'AutoCAD', es: 'AutoCAD' }, level: 1 },
      ],
    },
    {
      group: { en: 'Software & data', es: 'Software y datos' },
      items: [
        { name: { en: 'AI-assisted development', es: 'Desarrollo asistido por IA' }, level: 3 },
        { name: { en: 'Front-end design', es: 'Diseño front-end' }, level: 3 },
        { name: { en: 'Data engineering', es: 'Ingeniería de datos' }, level: 3 },
        { name: { en: 'Python', es: 'Python' }, level: 1 },
        { name: { en: 'MATLAB', es: 'MATLAB' }, level: 1 },
      ],
    },
    {
      group: { en: 'Finance', es: 'Finanzas' },
      items: [
        { name: { en: 'Quant engines', es: 'Motores cuantitativos' }, level: 3 },
        { name: { en: 'Finance & stock markets', es: 'Finanzas y mercados bursátiles' }, level: 3 },
      ],
    },
  ] as { group: { en: string; es: string }; items: { name: { en: string; es: string }; level: SkillLevel; note?: { en: string; es: string } }[] }[],
  languages: [
    { name: { en: 'Spanish', es: 'Español' }, code: 'ES', level: 'C2', native: true },
    {
      name: { en: 'Valencian', es: 'Valenciano' },
      code: 'VA',
      level: 'C2',
      native: true,
      cert: { en: 'C1 · Generalitat Valenciana', es: 'C1 · Generalitat Valenciana' },
    },
    { name: { en: 'English', es: 'Inglés' }, code: 'EN', level: 'C1', cert: { en: 'C1 Advanced · Cambridge', es: 'C1 Advanced · Cambridge' } },
  ] as { name: { en: string; es: string }; code: string; level: Cefr; native?: boolean; cert?: { en: string; es: string } }[],
  soft: [
    { en: 'Communication', es: 'Comunicación' },
    { en: 'Leadership', es: 'Liderazgo' },
    { en: 'Order & organisation', es: 'Orden y organización' },
  ],
};

const CV_IN = bilingual(CV_SRC);
export type Cv = (typeof CV_IN)['en'];

/** El CV en un idioma. */
export const cvIn = (lang: Lang): Cv => CV_IN[lang];
