import { END, LINE } from '@/config/layout';
import { WORK_X } from '../../line/flow';
import { CARTON, CARTON_ON_PALLET, CARTON_TOP } from '../../line/carton';
import { BH, PH } from '../../line/workpiece';

/**
 * Embaladora del final de la línea, en coordenadas de la embaladora (origen en END.packX, sobre el
 * eje de la cinta). X a lo largo de la línea, Y arriba, Z hacia el espectador. La formadora y su
 * transportador quedan detrás de la línea (-Z); el pórtico, sobre la parada.
 */

/** Parada de la pieza y cotas de la cinta y del palé. */
export const X0 = WORK_X.pack - END.packX;
export const TOP = LINE.rollerTop;
export const PALLET_TOP = TOP + PH;
const { L, W, H } = CARTON;

/** Caja sobre el palé: canto inferior de las paredes, borde de arriba (pliegue de las cortas) y tapa cerrada. */
export const BOX_Y0 = TOP + CARTON_ON_PALLET[1];
const BOX_RIM = BOX_Y0 + H;
export const BOX_TOP = BOX_Y0 + CARTON_TOP;
/** Cotas Z del centro de la caja: en la espera del transportador y sobre el palé. */
export const WAIT_Z = -1.0;

/** Ventosas: de la línea de pliegue del cabezal a la punta (la punta toca la cara de arriba de la pieza). */
export const CUP = 0.12;
/**
 * Cabezal de recoger y cerrar: cota de su origen, que es la línea de pliegue de las solapas cortas.
 * Al dejar la pieza en la caja coincide con el borde de la caja: sus dedos y palas giran sobre los
 * mismos pliegues que las solapas.
 */
export const HEAD = {
  up: 1.92,
  pick: PALLET_TOP + BH + CUP,
  carry: 1.86,
  place: BOX_RIM,
  /** Recorrido de la placa de ventosas al retirarse para dejar plegar. */
  stroke: 0.16,
  /** Las solapas abiertas se abren un poco hacia fuera; el marco las endereza al bajar entre estas cotas. */
  gather: [1.52, 1.32] as const,
};
/** Solapas abiertas: algo abiertas hacia fuera, como quedan al formar la caja. */
export const SPLAY = -0.17;

/**
 * Pórtico: pilares a ±x y ±z de la parada, altura y travesaño del cilindro. Los pilares van lo
 * bastante abiertos para que, desde la cámara, el de delante no tape el rótulo de la caja.
 */
export const PORTAL = { x: 0.78, z: 0.62, post: 0.09, h: 2.6, beam: 0.12 };
/**
 * Consola de mando en el pilar delantero izquierdo: centro, giro (hacia el que mira la línea) y su
 * pantalla en el marco de la consola.
 */
export const HMI = {
  p: [X0 - PORTAL.x - 0.32, 1.22, PORTAL.z + 0.02] as [number, number, number],
  r: [-0.25, 0.3, 0] as [number, number, number],
  screen: { x0: -0.14, x1: 0.08, y0: -0.06, y1: 0.1, z: 0.034 },
};
/**
 * Cadena portacables del cabezal: cuelga detrás de él, del travesaño del cilindro (tramo fijo, en
 * `z`) al aro del cabezal (tramo móvil, 2r por delante), con la curva abajo. `fixed` y `runs` se
 * miden hacia abajo desde la cota `y`; `attach` es la cota del enganche en el marco del cabezal.
 */
export const HEAD_CHAIN = { x: 0.2, y: 2.46, z: -0.45, fixed: 0, runs: 0.82, r: 0.04, h: 0.022, w: 0.045, attach: 0.44 };

/** Empujador: viga sobre el transportador, a lo largo de Z; zapata de 0,18 m delante del brazo. */
export const PUSHER = { beamY: 1.7, z0: -2.62, z1: -0.36, foot: 0.18, lift: 0.56, armX: 0.08, footY: [0.98, 1.08] as const };
/**
 * Cadena portacables del empujador, sobre su viga (a lo largo de Z): fija al fondo de la viga, con el
 * extremo móvil en la cara de atrás del carro. El tramo de arriba va siempre apoyado en el de abajo
 * y la curva, por delante del carro, no llega al tope de la viga.
 */
export const PUSHER_CHAIN = { fixed: -2.56, runs: 2.066, r: 0.045, h: 0.025, w: 0.05, top: PUSHER.beamY + 0.08 };

/**
 * Formadora: plano de la pared delantera (A) de la caja al formarla y de la plancha que espera en el
 * cargador; paso entre planchas y número de las que se ven detrás.
 */
export const ERECTOR = {
  formA: -1.87,
  magA: -2.55,
  pitch: 0.022,
  stack: 9,
  /** Bastidor: pilares en x y z, y altura. */
  x: [-0.32, 1.12] as const,
  z: [-1.78, -2.84] as const,
  h: 1.86,
};
/**
 * Cadena portacables del brazo de la plancha, sobre el larguero izquierdo de la formadora: fija al
 * fondo, con el extremo móvil en la cara de atrás del carro (`at`, respecto a su eje).
 */
export const PICKER_CHAIN = { x: ERECTOR.x[0], fixed: -2.76, runs: 0.83, r: 0.035, h: 0.02, w: 0.045, top: ERECTOR.h, at: -0.07 };
/** Centro de la caja en la formadora y en la espera (para el empujador). */
export const FORM_Z = ERECTOR.formA - W / 2;

/** Transportador de entrada: de la formadora a la cinta, con los rodillos a la cota del palé. */
export const INFEED = { z0: -1.84, z1: -0.47, half: 0.38, pitch: 0.085, r: 0.025 };

/** Largo de la caja (atajo). */
export { L as BOX_L };
