import { PACK, easeInOut } from '../../line/flow';
import { ALPHA_FLAT, CARTON } from '../../line/carton';
import { ERECTOR, FORM_Z, HEAD, PUSHER, SPLAY, WAIT_Z } from './dims';

/**
 * Postura de toda la embaladora en el instante `t` del trabajo (ms; negativo = en reposo). Todo
 * sale de aquí: lo que se dibuja es función del reloj de la planta, como el resto de la nave.
 */
type PackPose = {
  /** Cabezal: cota de su origen, apriete de las ventosas (0..1), retirada de la placa (0..1). */
  headY: number;
  squeeze: number;
  plate: number;
  /** Dedos (solapas cortas) y palas (largas): 0 abiertos, 1 plegados. */
  fingers: number;
  paddles: number;
  /** Pieza fuera del palé: cuánto sube sobre su sitio (null: la dibuja la cinta o ya va embalada). */
  partDy: number | null;
  /** Caja que se embala (la que esperaba): centro en Z, solapas de arriba (rad), visible. */
  box: { z: number; minor: number; major: number; visible: boolean };
  /** Empujador: cara de la zapata (Z) y cuánto está levantada. */
  shoe: { z: number; lift: number };
  /**
   * Caja siguiente: plano de su pared delantera, apertura (rad), solapas de arriba y del fondo.
   * `magazine`: aún es la plancha de delante del cargador.
   */
  next: { zA: number; alpha: number; top: number; bottomMinor: number; bottomMajor: number };
  /** Avance del cargador de planchas (0..1 de un paso). */
  stack: number;
  /** Brazo que saca la plancha (Z de sus ventosas y subida) y abridor (giro y subida). */
  picker: { z: number; lift: number };
  opener: { alpha: number; lift: number };
  /** Mesa de la formadora: 0 arriba (sostiene la caja), 1 abajo (deja colgar el fondo). */
  bed: number;
};

const RIGHT = Math.PI / 2;
const k = (t: number, [a, b]: readonly [number, number]) => easeInOut((t - a) / (b - a));
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
/** Las solapas abiertas se enderezan al bajar el marco del cabezal alrededor de la caja. */
const gather = (y: number) => easeInOut((HEAD.gather[0] - y) / (HEAD.gather[0] - HEAD.gather[1]));

/** Zapata del empujador contra la pared trasera de una caja centrada en `z` (con 4 mm de holgura). */
const behind = (z: number) => z - CARTON.W / 2 - 0.004;

export function emptyPose(): PackPose {
  return {
    headY: HEAD.up,
    squeeze: 0,
    plate: 0,
    fingers: 0,
    paddles: 0,
    partDy: null,
    box: { z: WAIT_Z, minor: SPLAY, major: SPLAY, visible: true },
    shoe: { z: behind(WAIT_Z), lift: 0 },
    next: { zA: ERECTOR.magA, alpha: ALPHA_FLAT, top: 0, bottomMinor: 0, bottomMajor: 0 },
    stack: 0,
    picker: { z: ERECTOR.magA, lift: 0 },
    opener: { alpha: ALPHA_FLAT, lift: 0 },
    bed: 0,
  };
}

export function packPose(t: number, o: PackPose): PackPose {
  const rest = emptyPose();
  if (t < 0) return Object.assign(o, rest);
  const P = PACK;

  // Cabezal.
  let y = HEAD.up;
  if (t >= P.down[0]) y = lerp(HEAD.up, HEAD.pick, k(t, P.down));
  if (t >= P.lift[0]) y = lerp(HEAD.pick, HEAD.carry, k(t, P.lift));
  if (t >= P.lower[0]) y = lerp(HEAD.carry, HEAD.place, k(t, P.lower));
  if (t >= P.rise[0]) y = lerp(HEAD.place, HEAD.up, k(t, P.rise));
  o.headY = y;
  o.squeeze = t < P.release[0] ? k(t, P.grab) : 1 - k(t, P.release);
  o.plate = t < P.plateDown[0] ? k(t, P.retract) : 1 - k(t, P.plateDown);
  o.fingers = t < P.fingersBack[0] ? k(t, P.minors) : 1 - k(t, P.fingersBack);
  o.paddles = t < P.paddlesBack[0] ? k(t, P.majors) : 1 - k(t, P.paddlesBack);

  // La pieza: en el palé hasta que la cogen, colgada de las ventosas, y en la caja tras soltarla.
  if (t < P.grab[0] || t >= P.sealed) o.partDy = null;
  else if (t < P.release[0]) o.partDy = y - HEAD.pick;
  else o.partDy = HEAD.place - HEAD.pick;

  // Caja que se embala: entra al palé, el marco endereza sus solapas, se pliegan y pasa, cerrada, a la cinta.
  const box = o.box;
  box.z = lerp(WAIT_Z, 0, k(t, P.push));
  box.minor = box.major = SPLAY;
  if (t >= P.lower[0]) box.minor = box.major = SPLAY * (1 - gather(y));
  if (t >= P.minors[0]) box.minor = RIGHT * k(t, P.minors);
  if (t >= P.majors[0]) box.major = RIGHT * k(t, P.majors);
  box.visible = t < P.sealed;

  // Empujador: mete la caja, se levanta, vuelve detrás de la formadora, baja y trae la siguiente.
  const shoe = o.shoe;
  if (t < P.back[0]) shoe.z = lerp(behind(WAIT_Z), behind(0), k(t, P.push));
  else if (t < P.feed[0]) shoe.z = lerp(behind(0), behind(FORM_Z), k(t, P.back));
  else shoe.z = lerp(behind(FORM_Z), behind(WAIT_Z), k(t, P.feed));
  shoe.lift = t < P.shoeDown[0] ? PUSHER.lift * k(t, P.shoeUp) : PUSHER.lift * (1 - k(t, P.shoeDown));

  // Caja siguiente: sale del cargador, se abre, cierra el fondo y va a la espera (y sus solapas se abren un poco).
  const n = o.next;
  const formA = ERECTOR.formA;
  const waitA = WAIT_Z + CARTON.W / 2;
  n.zA = t < P.feed[0] ? lerp(ERECTOR.magA, formA, k(t, P.pull)) : lerp(formA, waitA, k(t, P.feed));
  n.alpha = lerp(ALPHA_FLAT, RIGHT, k(t, P.open));
  n.bottomMinor = RIGHT * k(t, P.bottomMinors);
  n.bottomMajor = RIGHT * k(t, P.bottomMajors);
  n.top = SPLAY * k(t, P.feed);
  o.stack = k(t, P.stackFeed);

  // Brazo de la plancha: la lleva, se levanta, vuelve al cargador y baja sobre la siguiente.
  const picker = o.picker;
  picker.z = t < P.pickerBack[0] ? n.zA : lerp(formA, ERECTOR.magA, k(t, P.pickerBack));
  if (t < P.pickerBack[0] && t >= P.feed[0]) picker.z = formA;
  picker.lift = t < P.pickerDown[0] ? k(t, P.pickerUp) : 1 - k(t, P.pickerDown);

  // Abridor: gira con la pared que abre, se levanta, vuelve y baja.
  const op = o.opener;
  op.alpha = t < P.openerBack[0] ? n.alpha : lerp(RIGHT, ALPHA_FLAT, k(t, P.openerBack));
  op.lift = t < P.openerDown[0] ? k(t, P.openerUp) : 1 - k(t, P.openerDown);

  o.bed = t < P.bedUp[0] ? k(t, P.bedDown) : 1 - k(t, P.bedUp);
  return o;
}
