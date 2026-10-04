import { partList, type PartSpec } from '@/config/parts';
import type { StationId } from '@/config/stations';

/**
 * Vista explosionada de una máquina (sin React). La ficha la pide (`snapshot.exploded`); aquí se
 * lleva la cronología: cada pieza sale en su momento (por etapas y, dentro de cada etapa, en el
 * orden de la lista) con un arranque rápido que frena al llegar, y al volver recorre lo mismo al
 * revés: empieza despacio y encaja de golpe. Mientras hay una máquina abierta la línea se para.
 * Sin three.js: también lo lee la capa HTML (globos y líneas del despiece).
 */

/** Separación entre etapas, desfase entre piezas de una etapa y lo que tarda cada pieza (s). */
const STAGE_GAP = 0.3;
const STAGGER = 0.07;
const PART_MOVE = 0.95;
/** El montaje va algo más rápido que el despiece. */
const ASSEMBLE_SPEED = 1.45;

type PartEntry = {
  spec: PartSpec;
  /** Momento (s) en que empieza a salir. */
  start: number;
  /** Avance de la pieza (0 montada, 1 en su sitio del despiece), ya suavizado. */
  k: number;
  /** Punto del globo ahora y en su sitio del conjunto (mundo): lo leen las líneas y los globos. */
  now: Point;
  home: Point;
};

export type Point = { x: number; y: number; z: number };

export const explode = {
  /** Máquina abierta o que se está montando de nuevo (null: todas montadas). */
  station: null as StationId | null,
  /** 1 despiezando, 0 montando. */
  goal: 0,
  /** Tiempo de la cronología (s). */
  t: 0,
  /** Duración total del despiece de la máquina en curso. */
  end: 0,
  /** Piezas registradas por estación y número. */
  parts: new Map<string, PartEntry>(),
};

const key = (station: StationId, n: number) => `${station}:${n}`;

/** Momento de salida de cada pieza: etapa y orden dentro de ella (más un retraso propio, para cascadas). */
const starts = new Map<string, number>();
function startOf(station: StationId, spec: PartSpec) {
  const k = key(station, spec.n);
  let s = starts.get(k);
  if (s === undefined) {
    const rank = partList(station)
      .filter((p) => p.stage === spec.stage && p.to)
      .findIndex((p) => p.n === spec.n);
    s = spec.stage * STAGE_GAP + Math.max(0, rank) * STAGGER;
    starts.set(k, s);
  }
  return s;
}

/** Duración total del despiece de una estación. */
export function explodeEnd(station: StationId) {
  return Math.max(...partList(station).map((p) => startOf(station, p) + (p.to ? PART_MOVE : 0)), PART_MOVE);
}

const easeOut = (k: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, k)), 4);

/** Avance suavizado de una pieza (con `delay` propio para las que salen en cascada). */
export function partProgress(station: StationId, spec: PartSpec, delay = 0) {
  if (explode.station !== station) return 0;
  return easeOut((explode.t - startOf(station, spec) - delay) / PART_MOVE);
}

/** Registra una pieza para sus globos y su línea (una por número de pieza). */
export function registerPart(station: StationId, spec: PartSpec) {
  const k = key(station, spec.n);
  let e = explode.parts.get(k);
  if (!e) {
    e = { spec, start: startOf(station, spec), k: 0, now: { x: 0, y: 0, z: 0 }, home: { x: 0, y: 0, z: 0 } };
    explode.parts.set(k, e);
  }
  return e;
}

export function stationParts(station: StationId) {
  return partList(station)
    .map((p) => explode.parts.get(key(station, p.n)))
    .filter((e): e is PartEntry => !!e);
}

/** Avanza la cronología hacia su objetivo `dt` s. Devuelve si algo se ha movido. */
export function stepExplode(dt: number) {
  if (!explode.station) return false;
  const target = explode.goal ? explode.end : 0;
  if (explode.t === target) return false;
  const step = explode.goal ? dt : dt * ASSEMBLE_SPEED;
  explode.t = explode.goal ? Math.min(target, explode.t + step) : Math.max(0, explode.t - step);
  return true;
}

// Acceso para los scripts de verificación, solo en desarrollo.
if (typeof window !== 'undefined' && (process.env.NODE_ENV !== 'production' || process.env.PERF_HOOKS === '1')) {
  (window as unknown as { __explode: typeof explode }).__explode = explode;
}
