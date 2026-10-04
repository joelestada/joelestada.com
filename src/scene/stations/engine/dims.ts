import type { Vec3 } from '@/config/layout';

/**
 * Motor diésel de 6 cilindros en línea, modelado en su marco local y escalado en la estación.
 * X a lo largo del cigüeñal (origen en la cara de acoplamiento), Y arriba, Z hacia el espectador.
 * El lado +Z (escape y turbo) y la cara -X (volante) son los que ve la cámara.
 */
export const ENGINE_ORIGIN: Vec3 = [-1.3, 0.67, 0];
export const ENGINE_SCALE = 1.2;

export const CRANK_Y = 0.45;
/** Caras de acoplamiento del cardán (marco del motor): adaptador del volante y brida del freno. */
export const SHAFT = { engine: 0.05, dyno: -0.375 };
/** Centros de los cilindros y de los apoyos de bancada. */
export const CYL_X = [0.49, 0.69, 0.89, 1.09, 1.29, 1.49];
export const MAIN_X = [0.39, 0.59, 0.79, 0.99, 1.19, 1.39, 1.59];
export const BORE_R = 0.074;
/** Semicarrera y ángulo de cada muñequilla (orden de encendido 1-5-3-6-2-4). */
export const THROW = 0.07;
export const THROW_DEG = [0, 240, 120, 120, 240, 0];

/** Bloque: cárter abajo (algo más ancho) y camisas arriba, hasta la cara de la culata. */
export const BLOCK = { x0: 0.34, x1: 1.64, bottom: 0.3, belt: 0.56, deck: 0.84, zCase: 0.27, zJacket: 0.25 };
export const HEAD = { x0: 0.36, x1: 1.62, y0: 0.848, y1: 1.0, z: 0.25 };
export const COVER = { x0: 0.42, x1: 1.62, y0: 1.0, top: 1.135 };
/** Árboles de levas (uno por lado) y sus sombreretes. */
export const CAM = { y: 1.07, z: 0.085, x0: 0.43, x1: 1.665, capsX: [0.45, 0.59, 0.79, 0.99, 1.19, 1.39, 1.59] };
/** Tapa de distribución, por delante del bloque; dentro quedan los engranajes. */
export const TIMING = { x0: 1.62, x1: 1.7, gearX: 1.643, gearDepth: 0.02 };

/** Colector de escape: tubo común a lo largo del lado +Z. */
export const LOG = { y: 0.925, z: 0.36, r: 0.046, x0: 0.45, x1: 1.53 };
/** Turbo: eje paralelo al cigüeñal, colgado del centro del colector. */
export const TURBO = { y: 0.72, z: 0.42, turbineX: 0.97, compressorX: 1.09 };
/** Entrada de la turbina (arriba, bajo la salida del colector) y salida del compresor (arriba, por fuera). */
export const TURBINE_INLET_Z = TURBO.z - 0.066;
export const COMPRESSOR_OUTLET_Z = TURBO.z + 0.07;
/** Brida de unión colector–turbina. */
export const TURBO_FLANGE_Y = 0.838;
/** Bajante de escape: baja por el lado +Z hasta una brida justo por encima del bastidor. */
export const DOWNPIPE = { x: 0.83, z: 0.36, y: 0.1 };
/** Tubo de aire de carga: sube del compresor, cruza por encima de la tapa y baja a la admisión. */
export const CHARGE = { x: 1.09, r: 0.034, top: 1.235, intakeZ: -0.32, intakeY: 1.04, outletY: 0.83 };

/** Soportes: pedestales sobre los largueros del bastidor (cara superior en y local 0.042). */
export const MOUNT = { xs: [0.62, 1.56], z: 0.458, railTop: 0.042, pedestalTop: 0.214, isolatorTop: 0.274 };

/** Correa de accesorios, en el plano (z, y) delante de la tapa de distribución, sobre las gargantas. */
export const BELT = { x0: 1.727, width: 0.034, thickness: 0.009 };
export const PULLEYS = {
  crank: { y: CRANK_Y, z: 0, r: 0.118 },
  idler: { y: 0.52, z: 0.2, r: 0.035 },
  alternator: { y: 0.66, z: 0.33, r: 0.036 },
  pump: { y: 0.72, z: 0, r: 0.065 },
};
