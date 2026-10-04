import { END } from '@/config/layout';
import { CARTON, CARTON_ON_PALLET, CARTON_TOP } from './carton';

/**
 * Precintadora de la salida (sin React ni three.js): un cabezal de cinta fijo sobre la línea, justo
 * después del pórtico de la embaladora. Las cajas pasan por debajo llevadas por la cinta: el rodillo
 * de aplicar, colgado de un brazo basculante, se topa con la testa delantera, sube por ella, dobla
 * la arista y rueda por encima mientras la cinta se pega; al pasar la arista trasera baja por la
 * testa de atrás y la deja precintada. Todo sale de la posición de la caja: una caja que llega
 * ya embalada (con la embaladora fuera de vista) se precinta igual al pasar.
 */

/** Cota de la cara de arriba de la caja cerrada (mundo). */
const LINE_TOP = 0.85;
export const SEALER = {
  /** X (mundo) del eje del brazo del rodillo. */
  x: END.packX + 1.8,
  /** Cara de arriba de la caja cerrada sobre su palé. */
  top: LINE_TOP + CARTON_ON_PALLET[1] + CARTON_TOP,
  /** Brazo: su eje está aguas arriba y por encima del rodillo; en reposo cuelga hacia delante y abajo. */
  pivotDy: 0.055,
  len: Math.hypot(0.05, 0.105),
  rest: Math.atan2(0.105, 0.05),
  min: 0.06,
  r: 0.025,
};

const { L } = CARTON;
const { clip: CLIP } = CARTON.tape;

/** Centro del rodillo (respecto a la cara de arriba de la caja) con el brazo a un ángulo `beta`. */
export function rollerCenter(beta: number): [number, number] {
  return [SEALER.x + SEALER.len * Math.cos(beta), SEALER.pivotDy - SEALER.len * Math.sin(beta)];
}

/** Distancia del punto (x, y) a una caja centrada en `bx` (cara de arriba en y = 0); negativa si está dentro. */
function boxDistance(bx: number, x: number, y: number) {
  const x0 = bx - L / 2;
  const x1 = bx + L / 2;
  const dx = x < x0 ? x0 - x : x > x1 ? x - x1 : 0;
  const dy = y > 0 ? y : 0;
  if (dx === 0 && dy === 0) return -1;
  return dx === 0 ? dy : dy === 0 ? dx : Math.hypot(dx, dy);
}

/** Cajas que tocan el rodillo: las que están a menos de esto de él. */
export const SEALER_REACH = L / 2 + 0.2;

/** Ángulo del brazo con la caja centrada en `bx` (o colgando en reposo si no hay caja). */
export function sealerRoller(bx: number | null) {
  if (bx === null) return SEALER.rest;
  const free = (b: number) => {
    const [x, y] = rollerCenter(b);
    return boxDistance(bx, x, y) >= SEALER.r;
  };
  if (free(SEALER.rest)) return SEALER.rest;
  let lo = SEALER.min;
  let hi = SEALER.rest;
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) / 2;
    if (free(mid)) lo = mid;
    else hi = mid;
  }
  return lo;
}

export type SealerTape = {
  /** Testa delantera (+x) tapada, tramo de arriba (desde la testa delantera) y testa trasera (desde arriba), en fracciones. */
  lead: boolean;
  top: number;
  trail: number;
  /** Metros de cinta puestos (para girar el rollo). */
  length: number;
};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Cinta puesta en una caja centrada en `bx`, según dónde la ha dejado el rodillo al pasar. */
export function sealerTape(bx: number, out: SealerTape): SealerTape {
  const lead = bx + L / 2;
  const trail = bx - L / 2;
  out.lead = false;
  out.top = 0;
  out.trail = 0;
  const beta = sealerRoller(bx);
  const [cx, cy] = rollerCenter(beta);
  const r = SEALER.r;
  if (lead + r <= cx - r) {
    // Aún no ha llegado al rodillo.
  } else if (trail > cx + r) {
    // Ya ha pasado entera.
    out.lead = true;
    out.top = 1;
    out.trail = 1;
  } else if (cx >= lead) {
    // El rodillo sube por la testa delantera: la cinta se pega en ella.
    out.lead = cy >= 0;
  } else if (cx >= trail) {
    out.lead = true;
    out.top = clamp01((lead - cx) / L);
  } else {
    // El rodillo baja por la testa trasera: la cinta la cubre de arriba abajo.
    out.lead = true;
    out.top = 1;
    out.trail = clamp01(-cy / CLIP);
  }
  out.length = (out.lead ? CLIP : 0) + out.top * L + out.trail * CLIP;
  return out;
}

/** Largo total de cinta por caja (un tramo arriba y la «L» en cada testa). */
export const TAPE_PER_BOX = 2 * CLIP + L;
