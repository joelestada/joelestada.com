import type { Lang } from '@/i18n/lang';
import { localize, type L } from '@/i18n/localize';
import type { StationId } from './stations';

/**
 * Contenido de las páginas de proyecto (la ficha breve de cada máquina vive en stations.ts), en los
 * dos idiomas: cada texto es `{ en, es }`. Todo lo que se lee en la página sale de aquí; las cifras
 * de Ottometrix están verificadas contra sus repos (ver docs/contenido/ottometrix.md). Un proyecto
 * sin entrada sigue «en preparación». `projectIn(id, lang)` lo da en un idioma.
 */

export type ProjectFigure = {
  src: string;
  /** Tamaño real del archivo, para reservar su hueco. */
  w: number;
  h: number;
  /** Anchos de las copias reducidas (`<src>-<ancho>.webp`, de scripts/shotsizes.mjs) para el srcset. */
  widths?: number[];
  /** Grupo de pantallas (la ficha de un valor, la app) y nombre corto de esta (pestaña). */
  group: string;
  label: string;
  /** Título de la ventana que la enmarca. */
  title: string;
  alt: string;
  caption: string;
  /**
   * Globos sobre la imagen, en % de su ancho y alto: (x, y) es lo que señalan y (bx, by) dónde va
   * el globo, en una zona vacía; los une una línea de referencia.
   */
  notes?: { x: number; y: number; bx: number; by: number; text: string }[];
};

export type ProjectStat = { value: string; label: string; note?: string };

export type ProjectSection = {
  id: string;
  title: string;
  /** Párrafos. */
  body: string[];
  /** Puntos clave, en una lista. */
  points?: string[];
};

/** Registro de pruebas: una fila por ensayo, con su veredicto. */
export type ProjectTest = {
  n: number;
  name: string;
  change: string;
  result: string;
  verdict: 'rejected' | 'adopted' | 'failed' | 'reverted';
};

/** Una etapa del proceso (datos → resultado), para el diagrama de flujo. */
export type ProjectStage = { label: string; detail: string };

export type ProjectContent = {
  role: string;
  status: string;
  /** Llamada al final de la página: un enlace de correo con asunto y, si hace falta, una frase. */
  cta: { label: string; subject: string; note?: string };
  /** El resultado en una línea, para la ficha de la portada. */
  result?: string;
  lead: string;
  tagline?: string;
  stats: ProjectStat[];
  pipeline: ProjectStage[];
  sections: ProjectSection[];
  tests?: {
    title: string;
    intro: string;
    rows: ProjectTest[];
    outcome: string;
    /** Título del embudo propuestas → pasan en entrenamiento → sobreviven al holdout. */
    funnel: string;
    /** Una métrica comparada (p. ej. dentro y fuera de muestra), en barras. */
    compare?: { title: string; rows: { label: string; value: number; text: string }[] };
  };
  figures: ProjectFigure[];
  stack: { group: string; items: string[] }[];
  lessons: string[];
};

/** El contenido tal como se escribe: cada texto puede ir en los dos idiomas. */
type Src<T> = T extends string ? T | L<T> : T extends readonly (infer E)[] ? Src<E>[] : T extends object ? { [K in keyof T]: Src<T[K]> } : T;

/** Anchos de las copias reducidas de las capturas: los de scripts/shotsizes.mjs. */
const SHOT_WIDTHS = [960, 1400];

const shot = (
  file: string,
  size: [number, number],
  group: L,
  label: L,
  title: L,
  alt: L,
  caption: L,
  notes?: Src<NonNullable<ProjectFigure['notes']>>,
): Src<ProjectFigure> => ({ src: `/projects/ottometrix/${file}.webp`, w: size[0], h: size[1], widths: SHOT_WIDTHS, group, label, title, alt, caption, notes });

/** Capturas de la ficha: sin la barra lateral, a doble resolución. */
const STOCK: [number, number] = [2480, 1664];
const STOCK_GROUP = { en: 'Stock file · INTC', es: 'Ficha de empresa · INTC' };
const APP_GROUP = { en: 'The app', es: 'La app' };

const PROJECTS_SRC: Partial<Record<StationId, Src<ProjectContent>>> = {
  display: {
    role: { en: 'Sole founder — engine, data, validation and product', es: 'Fundador en solitario: motor, datos, validación y producto' },
    // El punto va pegado a lo anterior (espacio duro): en una columna estrecha no abre la segunda línea.
    status: { en: 'In development\u00a0· private', es: 'En desarrollo\u00a0· privado' },
    result: { en: 'IC +0.062 in sample · +0.007 out', es: 'IC +0,062 en muestra · +0,007 fuera' },
    cta: {
      label: { en: 'REQUEST A DEMO', es: 'PEDIR UNA DEMO' },
      subject: { en: 'Ottometrix demo', es: 'Demo de Ottometrix' },
      note: {
        en: 'Ottometrix is private while in development. I am happy to walk you through the current SaaS.',
        es: 'Ottometrix es privado mientras está en desarrollo. Te enseño encantado el SaaS tal como está.',
      },
    },
    lead: {
      en: 'A quantitative engine that ranks US stocks by how attractive they look twelve months ahead, and the SaaS built on top of it. I designed and built it end to end: the data pipeline, the statistical validation and the interface.',
      es: 'Un motor cuantitativo que ordena las acciones de EE. UU. según lo atractivas que parecen a doce meses vista, y el SaaS construido sobre él. Lo diseñé y construí de principio a fin: el pipeline de datos, la validación estadística y la interfaz.',
    },
    tagline: { en: 'We analyze. You decide.', es: 'Analizamos. Tú decides.' },
    stats: [
      {
        value: { en: '~2,400', es: '~2.400' },
        label: { en: 'US stocks ranked', es: 'acciones de EE. UU.' },
        note: { en: 'per cohort, every six months', es: 'por cohorte, cada seis meses' },
      },
      { value: '4', label: { en: 'factors, ¼ each', es: 'factores, ¼ cada uno' }, note: { en: 'weights fixed in advance', es: 'pesos fijados de antemano' } },
      {
        value: '13',
        label: { en: 'tests pre-registered', es: 'ensayos prerregistrados' },
        note: { en: 'and logged for multiple testing', es: 'y anotados para el contraste múltiple' },
      },
      {
        value: { en: '+0.062', es: '+0,062' },
        label: { en: 'IC in sample', es: 'IC dentro de muestra' },
        note: { en: '+0.007 out of sample', es: '+0,007 fuera de muestra' },
      },
    ],
    pipeline: [
      {
        label: { en: 'Data', es: 'Datos' },
        detail: { en: '13,330 tickers from EODHD, delisted companies included', es: '13.330 tickers de EODHD, incluidas las empresas que dejaron de cotizar' },
      },
      {
        label: { en: 'Universe', es: 'Universo' },
        detail: {
          en: 'Price ≥ $5, market cap ≥ $200M, no financials; all inputs or out',
          es: 'Precio ≥ 5 $, capitalización ≥ 200 M$, sin financieras; con todos los datos o fuera',
        },
      },
      {
        label: { en: 'Factors', es: 'Factores' },
        detail: { en: 'Value, quality, momentum and asset growth, point-in-time', es: 'Valor, calidad, momentum y crecimiento de activos, point-in-time' },
      },
      { label: { en: 'Score', es: 'Score' }, detail: { en: 'Percentiles 0–100, equal weights', es: 'Percentiles 0–100, pesos iguales' } },
      {
        label: { en: 'Seal', es: 'Sellado' },
        detail: { en: 'Ranking frozen with a SHA-256 hash and a date', es: 'Ranking congelado con un hash SHA-256 y una fecha' },
      },
      {
        label: { en: 'Product', es: 'Producto' },
        detail: { en: 'Screener, stock file, portfolio X-ray', es: 'Screener, ficha de empresa, radiografía de cartera' },
      },
    ],
    sections: [
      {
        id: 'problem',
        title: { en: 'The problem', es: 'El problema' },
        body: [
          {
            en: 'Retail investors are sold stock-picking tools full of indicators and promises. More metrics do not mean more accuracy: most published factors disappear once you remove micro-caps, look-ahead data or survivorship bias.',
            es: 'Al inversor particular le venden herramientas para elegir acciones llenas de indicadores y promesas. Más métricas no significan más acierto: la mayoría de los factores publicados desaparecen en cuanto quitas las microcapitalizaciones, los datos que miran al futuro o el sesgo de supervivencia.',
          },
          {
            en: 'I wanted an engine that uses the minimum number of factors that still hold out of sample — and that is honest about what it cannot prove.',
            es: 'Quería un motor con el mínimo de factores que sigan funcionando fuera de muestra, y honesto sobre lo que no puede demostrar.',
          },
        ],
      },
      {
        id: 'engine',
        title: { en: 'The engine', es: 'El motor' },
        body: [
          {
            en: 'Every six months the engine ranks the investable US market on four academic factors, each turned into a 0–100 percentile and weighted a quarter. The weights were fixed before looking at the data and have never been optimised.',
            es: 'Cada seis meses el motor ordena el mercado invertible de EE. UU. con cuatro factores académicos, cada uno convertido en un percentil de 0 a 100 y con un peso de un cuarto. Los pesos se fijaron antes de mirar los datos y nunca se han optimizado.',
          },
        ],
        points: [
          { en: 'Value: EBIT / enterprise value', es: 'Valor: EBIT / valor de empresa' },
          { en: 'Quality: gross profitability (Novy-Marx 2013)', es: 'Calidad: rentabilidad bruta (Novy-Marx 2013)' },
          { en: 'Momentum: 12-1 month return', es: 'Momentum: rentabilidad a 12-1 meses' },
          { en: 'Asset growth: year-on-year change in total assets, inverted', es: 'Crecimiento de activos: variación interanual del activo total, invertida' },
          {
            en: 'Strict point-in-time: a filing counts from its date + 1 business day; nothing is imputed',
            es: 'Point-in-time estricto: un informe cuenta desde su fecha + 1 día hábil; no se imputa nada',
          },
          {
            en: 'No survivorship bias: delisted companies stay in, with delisting returns (Shumway 1997)',
            es: 'Sin sesgo de supervivencia: las empresas que dejan de cotizar siguen dentro, con su rentabilidad de salida (Shumway 1997)',
          },
        ],
      },
      {
        id: 'validation',
        title: { en: 'Validation', es: 'Validación' },
        body: [
          {
            en: 'Every experiment is pre-registered with its hypothesis and pass threshold before it runs, and every run is logged so the Sharpe ratio can be deflated for multiple testing. Thirteen training cohorts (2018–2024) decide; a three-cohort holdout can be looked at only once.',
            es: 'Cada experimento se prerregistra con su hipótesis y su umbral de aprobado antes de ejecutarse, y cada ejecución queda anotada para poder deflactar el ratio de Sharpe por contraste múltiple. Deciden trece cohortes de entrenamiento (2018–2024); un holdout de tres cohortes solo se puede mirar una vez.',
          },
          {
            en: 'Twelve improvements were proposed. None survived. The one that passed in sample failed on the untouched holdout in all three cohorts, and was reverted.',
            es: 'Se propusieron doce mejoras. Ninguna sobrevivió. La única que pasó dentro de muestra falló en el holdout intacto en las tres cohortes, y se revirtió.',
          },
        ],
      },
      {
        id: 'product',
        title: { en: 'The product', es: 'El producto' },
        body: [
          {
            en: 'The SaaS turns the ranking into something an investor can use without a statistics degree: a screener over the whole universe, a file for every stock that shows what happened after each past score, and a portfolio X-ray that reads your holdings against the engine.',
            es: 'El SaaS convierte el ranking en algo que un inversor puede usar sin un título de estadística: un screener sobre todo el universo, una ficha por empresa que enseña qué pasó tras cada score anterior y una radiografía de cartera que lee tus posiciones con los ojos del motor.',
          },
          {
            en: 'Pricing is designed (free, €15 and €30 a month, and institutional) and the marketing site embeds the real app instead of mock-ups.',
            es: 'Los precios están diseñados (gratis, 15 € y 30 € al mes, e institucional) y la web comercial muestra la app real en lugar de maquetas.',
          },
        ],
      },
    ],
    tests: {
      title: { en: 'Test record', es: 'Registro de ensayos' },
      intro: {
        en: 'Each change to the engine was tested against the baseline on the training cohorts, with a pass rule fixed in advance.',
        es: 'Cada cambio en el motor se contrastó con la versión base en las cohortes de entrenamiento, con una regla de aprobado fijada de antemano.',
      },
      rows: [
        {
          n: 1,
          name: 'H2',
          change: { en: 'Quality without sector neutralisation', es: 'Calidad sin neutralizar por sector' },
          result: { en: 'Positive in 6 of 13 cohorts', es: 'Positivo en 6 de 13 cohortes' },
          verdict: 'rejected',
        },
        {
          n: 2,
          name: 'H3',
          change: { en: 'Cash-based operating profitability', es: 'Rentabilidad operativa basada en caja' },
          result: { en: 'Interval crosses zero', es: 'El intervalo cruza el cero' },
          verdict: 'rejected',
        },
        {
          n: 3,
          name: 'H5.2',
          change: { en: 'Value-trap penalty', es: 'Penalización por trampa de valor' },
          result: { en: 'Positive in 4 of 13 cohorts', es: 'Positivo en 4 de 13 cohortes' },
          verdict: 'rejected',
        },
        {
          n: 4,
          name: 'H6.2',
          change: { en: 'Residual momentum', es: 'Momentum residual' },
          result: { en: 'Fails the 70 % rule by one cohort', es: 'No cumple la regla del 70 % por una cohorte' },
          verdict: 'rejected',
        },
        {
          n: 5,
          name: 'H7',
          change: { en: 'Quality gate, then re-rank by value', es: 'Filtro de calidad, luego orden por valor' },
          result: { en: 'No uplift', es: 'Sin mejora' },
          verdict: 'rejected',
        },
        {
          n: 6,
          name: 'H8',
          change: { en: 'Shareholder yield as a fifth factor', es: 'Rentabilidad para el accionista como quinto factor' },
          result: { en: 'p = 0.11, interval crosses zero', es: 'p = 0,11, el intervalo cruza el cero' },
          verdict: 'rejected',
        },
        {
          n: 7,
          name: 'H8.2',
          change: { en: 'Shareholder-yield tilt', es: 'Sesgo hacia la rentabilidad para el accionista' },
          result: { en: 'Identical to H8 in ranks', es: 'Idéntico a H8 en el orden' },
          verdict: 'rejected',
        },
        {
          n: 8,
          name: 'H8.3',
          change: { en: 'Shareholder-yield gate', es: 'Filtro de rentabilidad para el accionista' },
          result: { en: 'Degenerate: same ranking', es: 'Degenerado: el mismo ranking' },
          verdict: 'rejected',
        },
        {
          n: 9,
          name: 'H8.4',
          change: { en: 'Yield gate, then re-rank by value', es: 'Filtro de rentabilidad, luego orden por valor' },
          result: { en: 'No uplift', es: 'Sin mejora' },
          verdict: 'rejected',
        },
        {
          n: 10,
          name: 'H4.2',
          change: { en: 'Weights tilted to the horizon', es: 'Pesos inclinados hacia el horizonte' },
          result: { en: 'p = 0.50', es: 'p = 0,50' },
          verdict: 'rejected',
        },
        {
          n: 11,
          name: 'H4.2b',
          change: { en: 'Conservative horizon weights', es: 'Pesos de horizonte conservadores' },
          result: { en: 'p = 0.37', es: 'p = 0,37' },
          verdict: 'rejected',
        },
        {
          n: 12,
          name: 'H1.3',
          change: { en: 'Net share issuance as a fifth factor', es: 'Emisión neta de acciones como quinto factor' },
          result: { en: 'Passes in sample: IC +0.062 → +0.088', es: 'Pasa dentro de muestra: IC +0,062 → +0,088' },
          verdict: 'adopted',
        },
        {
          n: 13,
          name: 'H1.3 holdout',
          change: { en: 'The same change, on the untouched holdout', es: 'El mismo cambio, en el holdout intacto' },
          result: { en: 'Worse in 3 of 3 cohorts', es: 'Peor en 3 de 3 cohortes' },
          verdict: 'reverted',
        },
      ],
      outcome: {
        en: 'The engine runs on the original four factors. It does not claim proven alpha, and the product says so.',
        es: 'El motor funciona con los cuatro factores originales. No presume de un alfa demostrado, y el producto lo dice.',
      },
      funnel: { en: 'Twelve ideas, one holdout', es: 'Doce ideas, un holdout' },
      compare: {
        title: { en: 'Information coefficient of the engine', es: 'Coeficiente de información del motor' },
        rows: [
          { label: { en: 'In sample · 13 cohorts', es: 'Dentro de muestra · 13 cohortes' }, value: 0.062, text: { en: '+0.062', es: '+0,062' } },
          { label: { en: 'Out of sample · 3 cohorts', es: 'Fuera de muestra · 3 cohortes' }, value: 0.007, text: { en: '+0.007', es: '+0,007' } },
        ],
      },
    },
    figures: [
      shot(
        'stock-summary',
        STOCK,
        STOCK_GROUP,
        { en: 'Summary', es: 'Resumen' },
        { en: 'INTC — Summary', es: 'INTC — Resumen' },
        {
          en: 'Stock file for Intel: score of 85, key ranges, price chart and the anatomy of the score by factor',
          es: 'Ficha de Intel: score de 85, rangos clave, gráfico de precio y la anatomía del score por factor',
        },
        {
          en: 'Summary: the score, the numbers that frame it and how each factor adds up.',
          es: 'Resumen: el score, las cifras que lo encuadran y lo que suma cada factor.',
        },
        [
          { x: 8.6, y: 12.5, bx: 3.6, by: 5.5, text: { en: 'Composite score of the stock, 0–100', es: 'Score compuesto de la acción, 0–100' } },
          { x: 44.5, y: 23.9, bx: 51, by: 19.6, text: { en: 'Seven modules, one question each', es: 'Siete módulos, una pregunta cada uno' } },
          { x: 33.5, y: 65, bx: 27, by: 57, text: { en: 'Price over the last year, with its ranges', es: 'Precio del último año, con sus rangos' } },
          {
            x: 88.2,
            y: 49.5,
            bx: 91.5,
            by: 45.8,
            text: { en: 'Anatomy of the score: each factor’s percentile × 25 %', es: 'Anatomía del score: percentil de cada factor × 25 %' },
          },
        ],
      ),
      shot(
        'stock-score',
        STOCK,
        STOCK_GROUP,
        { en: 'Score', es: 'Score' },
        { en: 'INTC — Score', es: 'INTC — Score' },
        {
          en: 'Score tab: every sealed score of the stock over five years and its return in the following twelve months, next to the trajectory of each factor',
          es: 'Pestaña Score: cada score sellado de la acción en cinco años y su rentabilidad en los doce meses siguientes, junto a la trayectoria de cada factor',
        },
        {
          en: 'Score: every past sealed score, and what the stock did in the twelve months after it.',
          es: 'Score: cada score sellado del pasado, y lo que hizo la acción en los doce meses siguientes.',
        },
      ),
      shot(
        'stock-fundamentals',
        STOCK,
        STOCK_GROUP,
        { en: 'Fundamentals', es: 'Fundamentales' },
        { en: 'INTC — Fundamentals', es: 'INTC — Fundamentales' },
        {
          en: 'Fundamentals tab: ten years of revenue, profit and cash flow, margins and returns against the sector',
          es: 'Pestaña Fundamentales: diez años de ingresos, beneficio y flujo de caja, márgenes y rentabilidades frente al sector',
        },
        {
          en: 'Fundamentals: ten years of growth, margins and returns, against the sector.',
          es: 'Fundamentales: diez años de crecimiento, márgenes y rentabilidades, frente al sector.',
        },
      ),
      shot(
        'stock-expectations',
        STOCK,
        STOCK_GROUP,
        { en: 'Expectations', es: 'Expectativas' },
        { en: 'INTC — Expectations', es: 'INTC — Expectativas' },
        {
          en: 'Expectations tab: the earnings growth the market expects and how the estimate has moved',
          es: 'Pestaña Expectativas: el crecimiento de beneficios que espera el mercado y cómo se ha movido la estimación',
        },
        {
          en: 'Expectations: the bar the market has set, and how far it has moved.',
          es: 'Expectativas: el listón que ha puesto el mercado, y cuánto se ha movido.',
        },
      ),
      shot(
        'stock-risk',
        STOCK,
        STOCK_GROUP,
        { en: 'Risk', es: 'Riesgo' },
        { en: 'INTC — Risk', es: 'INTC — Riesgo' },
        {
          en: 'Risk tab: risk level from five signals and the drawdown profile',
          es: 'Pestaña Riesgo: nivel de riesgo a partir de cinco señales y el perfil de caídas',
        },
        {
          en: 'Risk: what you would have had to sit through — drawdown, time under water, balance sheet.',
          es: 'Riesgo: lo que habrías tenido que aguantar (caídas, tiempo bajo el agua, balance).',
        },
      ),
      shot(
        'stock-news',
        STOCK,
        STOCK_GROUP,
        { en: 'News', es: 'Noticias' },
        { en: 'INTC — News', es: 'INTC — Noticias' },
        {
          en: 'News tab: balance of material news and a timeline of news on top of the price',
          es: 'Pestaña Noticias: balance de las noticias relevantes y una cronología de noticias sobre el precio',
        },
        {
          en: 'News: tone and timeline of material news over the price. They never move the score.',
          es: 'Noticias: tono y cronología de las noticias relevantes sobre el precio. Nunca mueven el score.',
        },
      ),
      shot(
        'stock-report',
        STOCK,
        STOCK_GROUP,
        { en: 'Report', es: 'Informe' },
        { en: 'INTC — Report', es: 'INTC — Informe' },
        {
          en: 'Report tab: a one-page report with the conclusion and the score, ready to export as PDF',
          es: 'Pestaña Informe: un informe de una página con la conclusión y el score, listo para exportar a PDF',
        },
        {
          en: 'Report: a one-page synthesis of the six modules, exportable to PDF.',
          es: 'Informe: una síntesis de una página de los seis módulos, exportable a PDF.',
        },
      ),
      shot(
        'portfolio-simulator',
        [2000, 1133],
        APP_GROUP,
        { en: 'Portfolio', es: 'Cartera' },
        { en: 'Portfolio — Simulator', es: 'Cartera — Simulador' },
        {
          en: 'Portfolio simulator: a matrix of positions by factor with editable weights and the simulated score',
          es: 'Simulador de cartera: una matriz de posiciones por factor con pesos editables y el score simulado',
        },
        {
          en: 'Portfolio: positions × factors, with editable weights and the score they add up to.',
          es: 'Cartera: posiciones × factores, con pesos editables y el score que suman.',
        },
      ),
      shot(
        'screener',
        [2940, 1664],
        APP_GROUP,
        { en: 'Screener', es: 'Screener' },
        { en: 'Screener', es: 'Screener' },
        {
          en: 'Ottometrix screener: a ranked table of US stocks with score rings, sector and factor profile, and filters on the left',
          es: 'Screener de Ottometrix: una tabla ordenada de acciones de EE. UU. con anillos de score, sector y perfil de factores, y filtros a la izquierda',
        },
        {
          en: 'Screener: the ranked universe, filterable by sector, size, score and factor.',
          es: 'Screener: el universo ordenado, filtrable por sector, tamaño, score y factor.',
        },
      ),
      shot(
        'home',
        [2000, 1133],
        APP_GROUP,
        { en: 'Home', es: 'Inicio' },
        { en: 'Home', es: 'Inicio' },
        {
          en: 'Ottometrix home: a greeting, a search box, an engine notice and a histogram of the universe with the user’s holdings placed on it',
          es: 'Inicio de Ottometrix: un saludo, un buscador, un aviso del motor y un histograma del universo con las posiciones del usuario encima',
        },
        {
          en: 'Home: what changed since the last seal, and where your holdings sit in the universe.',
          es: 'Inicio: qué ha cambiado desde el último sellado, y dónde quedan tus posiciones en el universo.',
        },
      ),
    ],
    stack: [
      { group: { en: 'Engine', es: 'Motor' }, items: ['Python 3.12', 'pandas', 'NumPy', 'DuckDB', 'EODHD API', 'pytest', 'ruff · black · mypy'] },
      { group: { en: 'Product', es: 'Producto' }, items: ['Next.js 15', 'React 19', 'TypeScript', 'Tailwind 4', 'TanStack Query', 'Zod', 'Vitest'] },
      {
        group: { en: 'Method', es: 'Método' },
        items: [
          { en: 'Pre-registered hypotheses', es: 'Hipótesis prerregistradas' },
          { en: 'Decision log (55 entries)', es: 'Registro de decisiones (55 entradas)' },
          { en: 'AI-assisted development with written rules', es: 'Desarrollo asistido por IA con reglas escritas' },
        ],
      },
    ],
    lessons: [
      {
        en: 'A previous attempt ran 463 iterations and overfit. Ottometrix exists because of that lesson: fewer factors, fixed weights, a holdout you only get to use once.',
        es: 'Un intento anterior pasó por 463 iteraciones y acabó sobreajustado. Ottometrix existe por esa lección: menos factores, pesos fijos y un holdout que solo se usa una vez.',
      },
      {
        en: 'Data engineering is most of the work: point-in-time filings, delistings, share counts, sector labels.',
        es: 'La ingeniería de datos es casi todo el trabajo: informes point-in-time, salidas de cotización, número de acciones, etiquetas de sector.',
      },
      {
        en: 'Saying “this does not work” with evidence is a result, not a failure.',
        es: 'Decir «esto no funciona» con pruebas es un resultado, no un fracaso.',
      },
    ],
  },
};

/** Si el proyecto tiene ya su hoja escrita (si no, la ficha lo marca «en preparación»). */
export const hasSheet = (id: StationId) => id in PROJECTS_SRC;

/** El resultado en una línea de un proyecto, para su ficha en la portada. */
export function projectResult(id: StationId, lang: Lang): string | undefined {
  const r = PROJECTS_SRC[id]?.result;
  return r === undefined ? undefined : (localize(r, lang) as string);
}

/** El contenido de un proyecto en un idioma (o nada, si aún no tiene hoja). */
export function projectIn(id: StationId, lang: Lang): ProjectContent | undefined {
  const src = PROJECTS_SRC[id];
  return src ? (localize(src, lang) as ProjectContent) : undefined;
}
