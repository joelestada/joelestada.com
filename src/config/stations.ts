import { useLang } from '@/i18n/LangProvider';
import type { Lang } from '@/i18n/lang';
import { bilingual, type L, type Localized } from '@/i18n/localize';
import { STATION_X, type Vec3 } from './layout';

export type StationId = keyof typeof STATION_X;

/** Una estación tal como se escribe: los textos en los dos idiomas (`{ en, es }`). */
type StationSrc = {
  id: StationId;
  number: string;
  /** Título del proyecto, una entrada por línea. */
  title: L<string[]>;
  /** Nombre corto (pie de recorrido). */
  short: L;
  /** Una línea para el índice del panel. */
  summary: L;
  /** Descripción breve de la ficha que aparece al hacer clic (2–3 frases). */
  description: L;
  /** Disciplinas, separadas por « · ». */
  field: L;
  /** Año del proyecto: también es el que se pinta en el suelo de su tramo. */
  year: string;
  /** Centro de la estación en X (mundo). */
  x: number;
  /** Punto de la máquina donde se clava el globo con su número, local a la estación. */
  marker: Vec3;
  /** Volumen que detecta el cursor, local a la estación. */
  hit: { min: Vec3; max: Vec3 };
  /** Foco colgante: centro de la boca de la campana, local a la estación. */
  lamp: Vec3;
};

/**
 * Estaciones en orden de recorrido. Los textos se editan aquí, en los dos idiomas.
 * Ottometrix ya lleva sus textos reales (docs/contenido/ottometrix.md); en las demás, las
 * descripciones y los años siguen siendo provisionales.
 */
const STATIONS_SRC: StationSrc[] = [
  {
    id: 'engine',
    number: '01',
    title: { en: ['Engine', 'test bench'], es: ['Banco de', 'ensayo de motor'] },
    short: { en: 'ENGINE', es: 'MOTOR' },
    summary: { en: 'Combustion engine on a dynamometer test bench.', es: 'Motor de combustión en un banco de ensayo con dinamómetro.' },
    description: {
      en: 'Instrumented test bench for a combustion engine coupled to a dynamometer: load control, data acquisition and performance mapping.',
      es: 'Banco de ensayo instrumentado para un motor de combustión acoplado a un dinamómetro: control de carga, adquisición de datos y mapa de prestaciones.',
    },
    field: { en: 'MECHANICAL · TESTING', es: 'MECÁNICA · ENSAYOS' },
    year: '2021',
    x: STATION_X.engine,
    marker: [-0.35, 2.2, 0],
    hit: { min: [-3.0, 0, -1.4], max: [3.0, 2.6, 1.25] },
    lamp: [-0.5, 5.7, -0.1],
  },
  {
    id: 'structure',
    number: '02',
    title: { en: ['Structural', 'load testing'], es: ['Ensayo', 'de estructuras'] },
    short: { en: 'STRUCTURE', es: 'ESTRUCTURA' },
    summary: {
      en: 'Steel truss in four-point bending under a servo-hydraulic actuator.',
      es: 'Celosía de acero a flexión en cuatro puntos bajo un actuador servohidráulico.',
    },
    description: {
      en: 'Experimental load test of a steel truss in four-point bending: servo-hydraulic actuation, displacement sensing and load–deflection analysis.',
      es: 'Ensayo experimental de una celosía de acero a flexión en cuatro puntos: actuación servohidráulica, medida de desplazamientos y análisis carga–flecha.',
    },
    field: { en: 'STRUCTURAL · EXPERIMENTAL', es: 'ESTRUCTURAS · EXPERIMENTAL' },
    year: '2022',
    x: STATION_X.structure,
    marker: [0, 3.6, -2.25],
    hit: { min: [-3.9, 0, -3.5], max: [3.9, 3.9, 1.0] },
    lamp: [0, 6.0, -2.0],
  },
  {
    id: 'display',
    number: '03',
    title: { en: ['Ottometrix'], es: ['Ottometrix'] },
    short: { en: 'OTTOMETRIX', es: 'OTTOMETRIX' },
    summary: {
      en: 'Quant engine and SaaS that ranks US stocks on four factors.',
      es: 'Motor cuantitativo y SaaS que ordena acciones de EE. UU. con cuatro factores.',
    },
    description: {
      en: 'Quantitative engine that ranks about 2,400 US stocks every six months on four academic factors, and the SaaS built on top of it. Designed and built end to end: data pipeline, statistical validation and interface.',
      es: 'Motor cuantitativo que ordena unas 2.400 acciones de EE. UU. cada seis meses con cuatro factores académicos, y el SaaS construido sobre él. Diseñado y construido de principio a fin: datos, validación estadística e interfaz.',
    },
    field: { en: 'QUANT · DATA · SOFTWARE', es: 'QUANT · DATOS · SOFTWARE' },
    year: '2026',
    x: STATION_X.display,
    marker: [0, 3.98, -2.6],
    hit: { min: [-3.65, 0, -3.4], max: [4.15, 4.3, 0.6] },
    lamp: [0, 6.2, -1.2],
  },
  {
    id: 'hydraulic',
    number: '04',
    title: { en: ['Hydraulic', 'energy recovery'], es: ['Recuperación', 'hidráulica de energía'] },
    short: { en: 'HYDRAULICS', es: 'HIDRÁULICA' },
    summary: {
      en: 'Hydraulic circuit that stores the energy of a descending load and reuses it.',
      es: 'Circuito hidráulico que almacena la energía de una carga que baja y la reutiliza.',
    },
    description: {
      en: 'Hydraulic circuit that captures the energy of a descending load in accumulators and returns it to lift the next cycle, cutting pump demand.',
      es: 'Circuito hidráulico que recoge en acumuladores la energía de una carga que baja y la devuelve para subir el ciclo siguiente: la bomba tiene que aportar menos.',
    },
    field: { en: 'HYDRAULICS · ENERGY', es: 'HIDRÁULICA · ENERGÍA' },
    year: '2024',
    x: STATION_X.hydraulic,
    marker: [0.2, 3.67, 0],
    hit: { min: [-2.9, 0, -3.0], max: [4.9, 3.7, 1.7] },
    lamp: [0.1, 5.9, -0.8],
  },
  {
    id: 'robotic',
    number: '05',
    title: { en: ['Robotic', 'arm'], es: ['Brazo', 'robótico'] },
    short: { en: 'ROBOTICS', es: 'ROBÓTICA' },
    summary: { en: 'Six-axis robotic arm running an automated assembly cycle.', es: 'Brazo robótico de seis ejes en un ciclo de montaje automático.' },
    description: {
      en: 'Six-axis robotic arm programmed for an automated assembly cycle inside a guarded cell: trajectories, gripper control and safety interlocks.',
      es: 'Brazo robótico de seis ejes programado para un ciclo de montaje automático dentro de una célula vallada: trayectorias, control de la pinza y enclavamientos de seguridad.',
    },
    field: { en: 'ROBOTICS · AUTOMATION', es: 'ROBÓTICA · AUTOMATIZACIÓN' },
    year: '2025',
    x: STATION_X.robotic,
    marker: [-0.55, 2.45, -1.45],
    hit: { min: [-2.6, 0, -3.1], max: [3.6, 2.7, 1.6] },
    lamp: [-0.3, 5.6, -1.0],
  },
];

/** Una estación con sus textos ya en un idioma. */
export type StationDef = Localized<StationSrc>;

const IN = bilingual(STATIONS_SRC);
const BY_ID_IN = {
  en: Object.fromEntries(IN.en.map((s) => [s.id, s])) as Record<StationId, StationDef>,
  es: Object.fromEntries(IN.es.map((s) => [s.id, s])) as Record<StationId, StationDef>,
};

/**
 * Las estaciones, en orden. Lo que no depende del idioma (id, número, año, posiciones) se lee de aquí;
 * los textos, de `stationsIn(lang)` o `useStations()`.
 */
export const STATIONS: readonly Omit<StationDef, 'title' | 'short' | 'summary' | 'description' | 'field'>[] = IN.en;
export const STATION_BY_ID = BY_ID_IN.en as Record<StationId, Omit<StationDef, 'title' | 'short' | 'summary' | 'description' | 'field'>>;

/** Las estaciones con sus textos en un idioma (y por id). */
export const stationsIn = (lang: Lang) => IN[lang];
export const stationByIdIn = (lang: Lang) => BY_ID_IN[lang];

/** Lo mismo en un componente de cliente, con el idioma de la página. */
export const useStations = () => IN[useLang()];
export const useStationById = () => BY_ID_IN[useLang()];

export const isStationId = (v: unknown): v is StationId => typeof v === 'string' && v in STATION_BY_ID;
