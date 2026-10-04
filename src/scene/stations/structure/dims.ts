/**
 * Banco de ensayo a flexión (estación 02), en coordenadas de la estación.
 * X a lo largo de la línea, Y arriba, Z hacia el espectador. El pórtico y la probeta van en el
 * plano RIG_Z; la cámara ve las caras +Z (delante), -X (izquierda) y las de arriba.
 */

/** Plano medio del pórtico y de la probeta. */
export const RIG_Z = -2.25;

/**
 * Bancada de ensayo: losa de acero con ranuras en T a lo largo de X. Base continua hasta `base` y
 * encima cinco carriles separados por las ranuras (por eso se leen hundidas, con su fondo oscuro).
 */
export const BED = { x0: -2.7, x1: 2.7, z0: -3.15, z1: -1.35, h: 0.2, base: 0.12, slot: 0.036 };
/** Ranuras en T: los anclajes del pórtico, de los apoyos y los imanes de los LVDT caen en ellas. */
export const SLOTS_Z = [RIG_Z - 0.72, RIG_Z - 0.27, RIG_Z + 0.27, RIG_Z + 0.72];

/** Pilares HEB del pórtico: alas (caras ±Z), alma en el plano YZ; placa de anclaje y de cabeza. */
export const COLUMN = { xs: [-2.25, 2.25], half: 0.15, flange: 0.18, tf: 0.03, web: 0.012, base: 0.04, cap: 0.03 };
/** Dintel en I a lo largo de X, apoyado en las cabezas de los pilares. */
export const BEAM = { x0: -2.55, x1: 2.55, y0: 3.12, y1: 3.55, half: 0.25, tf: 0.04, web: 0.02 };
export const COLUMN_TOP = BEAM.y0 - COLUMN.cap;

/** Probeta: celosía Pratt en cajón, apoyada en sus extremos. */
export const TRUSS = { x0: -1.9, x1: 1.9, y: 0.95, h: 0.62, half: 0.16, panels: 6, chord: 0.075, web: 0.045, tie: 0.035 };
const TRUSS_TOP = TRUSS.y + TRUSS.h;
/** Cara inferior del cordón inferior y superior del cordón superior. */
export const CHORD_BOTTOM = TRUSS.y - TRUSS.chord / 2;
const CHORD_TOP = TRUSS_TOP + TRUSS.chord / 2;
/** Flecha máxima en el centro (exagerada para leerse). */
export const DEFLECTION = 0.075;
/** Longitud de un recuadro de la celosía: la carga entra a los tercios, en los nudos 2 y 4. */
export const PANEL = (TRUSS.x1 - TRUSS.x0) / TRUSS.panels;
export const LOAD_X = PANEL;

/** Flecha (negativa hacia abajo) en x para una flecha central `delta`. */
export function deflection(x: number, delta: number) {
  const half = (TRUSS.x1 - TRUSS.x0) / 2;
  const u = x / half;
  return -delta * Math.max(0, 1 - u * u);
}

/** Giro de la directriz (rad) en x para una flecha central `delta`. */
export function slope(x: number, delta: number) {
  const half = (TRUSS.x1 - TRUSS.x0) / 2;
  return Math.atan((2 * delta * x) / (half * half));
}

/**
 * Actuador servohidráulico colgado del centro del dintel, de arriba abajo: placa adaptadora,
 * rótula de horquilla, culata superior, camisa con tirantes, culata inferior y prensaestopas.
 */
export const ACT = {
  mount: { y0: 3.07, r: 0.24 },
  swivel: { y0: 3.01, r: 0.17 },
  clevis: { y0: 2.87, pin: 2.93 },
  topCap: { y0: 2.75, y1: 2.87, half: 0.17 },
  tube: { y0: 2.29, r: 0.14 },
  bottomCap: { y0: 2.17, y1: 2.29 },
  gland: { y0: 2.14, r: 0.075 },
  rod: { r: 0.045, top: 2.27 },
  /** Tirantes en las esquinas de las culatas. */
  tie: 0.135,
  /**
   * Bloque de distribución en el costado izquierdo de la camisa (el que ve la cámara), con la
   * servoválvula en su cara y los acumuladores delante y detrás.
   */
  manifold: { x0: -0.25, x1: -0.13, y0: 2.36, y1: 2.62, z: 0.11 },
  accumulator: { x: -0.19, z: 0.2 },
  /** Tomas de presión y retorno en la cara superior del bloque (z relativa al plano del pórtico). */
  portX: -0.2,
  portZs: [0.055, -0.055],
};

/**
 * Tren de carga, de abajo arriba: chapas de reparto sobre el cordón superior, rodillos, asientos,
 * viga de reparto (HEB), placa y horquilla, rótula de la célula, célula de carga y tuerca del vástago.
 */
export const TRAIN = {
  plate: { y0: CHORD_TOP, y1: CHORD_TOP + 0.012 },
  roller: { r: 0.035 },
  seat: { y0: 1.69, y1: 1.72 },
  spreader: { y0: 1.72, y1: 1.86, half: 0.82, flange: 0.1, tf: 0.016, web: 0.012 },
  topPlate: 1.88,
  clevis: { y1: 1.99, pin: 1.94 },
  cell: { y0: 1.975, y1: 2.045, r: 0.11 },
  nut: { y1: 2.08 },
};

/** LVDT bajo el cordón inferior (plano delantero): en el centro de vano y bajo los puntos de carga. */
export const LVDT = { xs: [-LOAD_X, 0, LOAD_X], z: RIG_Z + TRUSS.half, post: 0.08, body: { y0: 0.6, y1: 0.8, r: 0.018 } };

/** Monitor del sistema de adquisición (cara +Z), en su carro. */
export const MONITOR = { x0: -3.84, x1: -2.9, y0: 1.12, y1: 1.72, z: -1.74 };
/** Registro tensión–tiempo en la pantalla: el cero queda un poco por encima del eje, para que se lea. */
export const PLOT = { x0: -3.74, x1: -2.99, y0: 1.2, zero: 1.215, y1: 1.62 };
/** Armario del controlador y la adquisición (rack de 19"). */
export const RACK = { x: -3.45, z: -2.75, w: 0.62, h: 1.85, d: 0.55 };

/** Grupo hidráulico a la derecha del pórtico y bloque de servicio atornillado al pilar derecho. */
export const HPU = { x0: 2.9, x1: 3.75, z0: -3.1, z1: -2.25, top: 0.62 };
export const HSM = { x0: 2.44, x1: 2.72, y0: 1.42, y1: 1.7, z0: -2.37, z1: -2.13 };
/**
 * Latiguillos: suben junto al extremo del dintel, lo recorren por encima, bajan por delante a la
 * izquierda del actuador y entran por arriba en su bloque. `xs`: bajada de cada uno; `zs`: su
 * carril sobre el ala superior.
 */
export const HOSE = { r: 0.022, x: 2.64, y: 3.585, xs: [-0.34, -0.41], zs: [-2.18, -2.3], drop: -1.95, under: 3.0 };
