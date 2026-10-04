import type { StationId } from '@/config/stations';

/**
 * Pulsador de hombre muerto: mantener pulsado sobre una máquina la lleva a plena potencia (el
 * anillo de su globo se llena con ella) y al soltar vuelve a su marcha de siempre. Sin React ni
 * three.js: lo leen las máquinas, la capa HTML (el anillo) y el sonido.
 */

/** Espera antes de arrancar (un clic corto sigue abriendo la ficha) y subida y bajada (s). */
export const HOLD_DELAY_MS = 260;
const RISE_S = 1.1;
const FALL_S = 1.5;

export const force = {
  station: null as StationId | null,
  /** Se mantiene pulsado ahora mismo. */
  held: false,
  /** Potencia (0..1), ya suavizada: sube mientras se mantiene y baja al soltar. */
  level: 0,
  /** Segundos a plena marcha forzada (reloj propio: sirve también con la línea en pausa). */
  time: 0,
  /** Avance lineal de la potencia (el que se suaviza). */
  raw: 0,
};

const smooth = (k: number) => k * k * (3 - 2 * k);

/** Potencia forzada de una máquina (0 si no es la que se mantiene). */
export function forceLevel(id: StationId) {
  return force.station === id ? force.level : 0;
}

export function startForce(id: StationId) {
  if (force.station && force.station !== id && force.raw > 0) return false;
  force.station = id;
  force.held = true;
  return true;
}

export function releaseForce() {
  force.held = false;
}

/** Avanza `dt` s. Devuelve si la potencia ha cambiado. */
export function stepForce(dt: number) {
  if (!force.station) return false;
  const before = force.raw;
  force.raw = force.held ? Math.min(1, force.raw + dt / RISE_S) : Math.max(0, force.raw - dt / FALL_S);
  force.level = smooth(force.raw);
  if (force.level > 0) force.time += dt * (0.4 + 0.6 * force.level);
  if (force.raw === 0 && !force.held) {
    force.station = null;
    force.time = 0;
  }
  return force.raw !== before;
}

// Acceso para los scripts de verificación, solo en desarrollo.
if (typeof window !== 'undefined' && (process.env.NODE_ENV !== 'production' || process.env.PERF_HOOKS === '1')) {
  (window as unknown as { __force: typeof force }).__force = force;
}
