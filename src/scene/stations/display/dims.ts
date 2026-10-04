/**
 * Puesto de Ottometrix (estación 03), en coordenadas de la estación. X a lo largo de la línea,
 * Y arriba, Z hacia el espectador. Todo va sobre una tarima de suelo técnico.
 */

/** Suelo técnico: baldosas de 600 mm sobre pedestales, alineadas con el canto delantero y el izquierdo. */
export const PLATFORM = { x0: -2.9, x1: 4.1, z0: -3.35, z1: -0.8, h: 0.14, tile: 0.6, tileT: 0.035 };

/**
 * Videowall de 3 × 3 módulos 16:9 (pantallas de 66"): cara frontal en z, borde inferior en y0.
 * El dibujo de la pantalla es uno solo, repartido entre los nueve módulos.
 */
export const SCREEN = { w: 4.4, h: 2.475, y0: 1.42, z: -2.55, cols: 3, rows: 3, depth: 0.07, seam: 0.004 };
export const MODULE = { w: SCREEN.w / SCREEN.cols, h: SCREEN.h / SCREEN.rows };

/**
 * Pie del videowall: dos montantes con sus patas y tornapuntas traseros, tres travesaños donde se
 * enganchan los módulos y una balda para el controlador, debajo de la pantalla.
 */
export const STAND = { xs: [-1.1, 1.1], z0: -2.92, z1: -2.84, top: 3.66, rails: [1.62, 2.66, 3.6], railX: 1.9, railZ: [-2.84, -2.78] as const };
export const CONTROLLER = { x0: -0.32, x1: 0.32, y0: 0.74, y1: 0.92, z0: -3.02, z1: -2.78 };

/** Consola del operador: tablero con canto redondeado sobre dos buques; faldón al fondo. */
export const DESK = { x0: -1.25, x1: 1.25, z0: -2.05, z1: -1.5, top: 0.9 };

/** Rack de 42U sobre la tarima; frente abierto hacia +Z. */
export const RACK = { x0: 3.22, x1: 3.86, z0: -3.1, z1: -2.24, h: 2.05 };
/** Altura de una unidad de rack (m). */
export const U = 0.0445;

/** Baldosas que se levantan en el despiece (columna, fila desde el canto delantero): dejan ver la bandeja de cables. */
export const LIFT_TILES: [number, number][] = [
  [7, 2],
  [8, 2],
  [9, 2],
];

/**
 * Lectura de la pieza en el módulo central de abajo (píxeles del dibujo de la pantalla): pistas de
 * los cuatro factores, una por cuarto de barra, y escala 0–100 de la nota.
 */
export const READOUT = {
  bar: { x0: 580, x1: 1020, y0: 684, y1: 700, gap: 12 },
  scale: { y: 760, h: 26 },
  labels: ['VALUE', 'QUALITY', 'MOMENTUM', 'ASSET GR.'],
};
