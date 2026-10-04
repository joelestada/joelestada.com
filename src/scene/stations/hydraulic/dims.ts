import { FLOW, LINE, type Vec3 } from '@/config/layout';
import { BUSHING_RISE } from '../../line/workpiece';

/**
 * Prensa con recuperación de energía (estación 04), en coordenadas de la estación. X a lo largo de
 * la línea, Y arriba, Z hacia el espectador. El pórtico cruza la línea en la parada de la pieza.
 */

/**
 * Pórtico: dos columnas de cajón a los lados de la línea, con su raíl de guía en la cara interior,
 * y el dintel de cajón encima. `colZ` es el eje de cada columna (±).
 */
export const FRAME = { x: 0.2, colZ: 1.15, col: 0.18, top: 3.45 };
export const BEAM = { y0: FRAME.top, y1: FRAME.top + 0.22, half: 0.15, z: 1.42 };
export const RAIL = { w: 0.036, d: 0.022, y0: 0.95, y1: 3.4 };
/** Cara interior de la columna y del raíl (lado +Z; el otro lado es simétrico). */
export const COL_INNER = FRAME.colZ - FRAME.col / 2;
export const RAIL_FACE = COL_INNER - RAIL.d;

/**
 * Cabezal móvil: viga entre los raíles con un patín de guía en cada extremo. Cota de su centro arriba
 * en reposo y con la carga descendida (lo que carga los acumuladores).
 */
export const HEAD = { high: 2.85, low: 2.1, half: 0.1, hx: 0.16, z: RAIL_FACE - 0.07 };

/** Masa de ensayo colgada del cabezal: tirante, cinco placas, placa portaherramientas y punzón. */
export const MASS = { half: 0.36, drop: 0.12, plate: 0.084, plates: 5, tool: 0.03, punch: { r: 0.058, h: 0.08 } };
const MASS_H = MASS.drop + MASS.plates * MASS.plate + MASS.tool + MASS.punch.h;
/** Cota del cabezal con el punzón apoyado en el casquillo (que asoma sobre la pieza) de la pieza parada debajo. */
export const PRESS_HEAD = LINE.rollerTop + FLOW.pallet[1] + FLOW.part[1] + BUSHING_RISE + MASS_H + HEAD.half;

/** Cilindros de elevación (de simple efecto): empujan el cabezal desde abajo, a ambos lados de la línea. */
export const CYL = { z: 0.74, r: 0.1, bottom: 0.16, top: 1.5, rod: 0.045, port: 0.2, cap: 0.08, capR: 0.125 };
/** Horquilla del vástago bajo el cabezal. */
export const CLEVIS = 0.06;
/** Largo del vástago: con el cabezal arriba aún le quedan 0,33 m dentro de la camisa; abajo no toca el fondo. */
export const ROD_LEN = HEAD.high - HEAD.half - CLEVIS - CYL.top + 0.33;

/** Batería de acumuladores de vejiga detrás de la línea, con su panel de manómetros a la izquierda. */
export const ACC = { xs: [-1.95, -1.5, -1.05, -0.6], z: -2.2, r: 0.155, y0: 0.24, y1: 1.45 };
export const GAUGES = { xs: [-2.68, -2.5], y: 1.25, r: 0.085, z: ACC.z + 0.12 };
/** Colector de los acumuladores: corre por delante de las botellas, a ras de suelo. */
export const HEADER = { y: 0.2, z: -1.97 };

/**
 * Grupo hidráulico: depósito, motor y bomba en línea sobre la tapa, enfriador en el costado. Va a la
 * derecha de la prensa y no detrás: visto desde la cámara quedaría entre las columnas, tapado por el
 * cabezal (sobre todo en el despiece).
 */
export const TANK = { x0: 3.1, x1: 4.7, z0: -2.8, z1: -1.8, top: 0.75 };
export const MOTOR = { x0: TANK.x0 + 0.3, x1: TANK.x0 + 0.78, y: 0.98, z: -2.3, r: 0.19 };
export const PUMP = { x0: TANK.x0 + 0.94, x1: TANK.x0 + 1.14, r: 0.1, x: TANK.x0 + 1.04 };

/** Bloque de válvulas junto a la línea, sobre su soporte. */
export const VALVES = { x0: 0.35, x1: 0.75, y0: 0.35, y1: 0.72, z0: -1.65, z1: -1.35 };

/** Pupitre de energía delante, a la derecha. */
export const DESK = { x: 2.35, z: 1.25, height: 1.45, depth: 0.4 };

/** Radio de las tuberías rígidas. */
export const PIPE = 0.028;

/** Recorridos de tubería en sentido cilindros → acumuladores (el aceite avanza así al bajar la carga). */
export const PATHS: Record<'front' | 'back' | 'bank' | 'pump', Vec3[]> = {
  front: [
    [FRAME.x + CYL.capR, CYL.port, CYL.z],
    [0.55, CYL.port, CYL.z],
    [0.55, 0.07, CYL.z],
    [0.55, 0.07, -1.5],
    [0.55, VALVES.y0, -1.5],
  ],
  back: [
    [FRAME.x + CYL.capR, CYL.port, -CYL.z],
    [0.55, CYL.port, -CYL.z],
    [0.55, 0.07 + PIPE, -CYL.z],
  ],
  bank: [
    [VALVES.x0, 0.55, -1.5],
    [-0.25, 0.55, -1.5],
    [-0.25, HEADER.y, -1.5],
    [-0.25, HEADER.y, HEADER.z],
    [ACC.xs[0] - 0.25, HEADER.y, HEADER.z],
  ],
  pump: [
    [VALVES.x1, 0.6, -1.5],
    [PUMP.x, 0.6, -1.5],
    [PUMP.x, MOTOR.y, -1.5],
    [PUMP.x, MOTOR.y, MOTOR.z + PUMP.r],
  ],
};
/** Radio de acuerdo de las curvas de tubería. */
export const BEND = 0.07;
