import { END, FLOW, STATION_X } from '@/config/layout';
import { lifeMs, updateLife } from '../life/clock';
import { forceLevel } from '../force';

/**
 * La planta en marcha: cinta, trabajos de cada máquina, motor y banco de la celosía. Sin React.
 *
 * Cinta y trabajos van por el reloj de la planta (el de la vida de la nave): en pausa, en reposo,
 * con el panel abierto o con la pestaña oculta se congelan tal cual y siguen luego sin saltos.
 * Solo el motor usa el reloj real, para frenarse con naturalidad al parar.
 *
 * Las piezas avanzan solas y despacio (el scroll no las mueve) y paran cuando llegan a las
 * máquinas. La pantalla, la prensa, el robot y la embaladora trabajan solo con una pieza delante:
 * fuera de eso están quietos. Al final, cada pieza sale embalada por la puerta de la pared final. El motor y el banco de la celosía van por su cuenta, con ciclos continuos. Todo
 * sale del reloj: una máquina que se vuelve a ver, o una pieza que entra en pantalla, se dibuja
 * en el punto exacto de su ciclo.
 */

/** Ritmo de la planta (ver FLOW.tempo): los tiempos de abajo son de planta, no reales. */
export const TEMPO = FLOW.tempo;
/** Reloj de la planta (ms): el de la vida de la nave, quieto en pausa, al ritmo de la planta. */
const plantMs = (realNow: number) => lifeMs(realNow) * TEMPO;

/** Máquinas que trabajan sobre la pieza que tienen delante. */
const WORKS = ['display', 'hydraulic', 'robotic', 'pack'] as const;
type WorkId = (typeof WORKS)[number];

/** Punto de parada frente a cada máquina: todas a la misma distancia de su estación. */
const OFFSET = FLOW.stopX - STATION_X.hydraulic;
export const WORK_X: Record<WorkId, number> = {
  display: STATION_X.display + OFFSET,
  hydraulic: STATION_X.hydraulic + OFFSET,
  robotic: STATION_X.robotic + OFFSET,
  pack: END.packX + OFFSET,
};

/** Lectura en la pantalla de Ottometrix: sube el brillo, barre y mide. */
export const SCAN = { start: 150, up: 550, down: 2900, end: 3500 } as const;
/** Prensa: baja, apoya la masa en la pieza (ahí queda el casquillo), sube. */
export const PRESS = { start: 250, contact: 1600, hold: 1950, end: 3500 } as const;
/**
 * Robot: de reposo a sobre el alimentador, baja en vertical, cierra la pinza, sube, lleva la tapa
 * sobre la pieza, baja, abre, sube y vuelve a reposo.
 */
export const PICK = {
  start: 0,
  abovePick: 850,
  atPick: 1350,
  closed: 1600,
  liftPick: 2050,
  abovePlace: 3000,
  atPlace: 3500,
  open: 3750,
  lifted: 4200,
  home: 5100,
  /** El alimentador sube la siguiente tapa cuando la pinza ya se ha retirado. */
  refill: [2150, 2950] as const,
} as const;
/**
 * Embaladora (tramos [inicio, fin] en ms del trabajo). El cabezal de ventosas coge la pieza del palé
 * y la sube; el empujador mete en el palé la caja abierta que esperaba; el cabezal baja la pieza
 * dentro, la suelta y, con su marco sobre la caja, pliega las solapas cortas y luego las largas:
 * entonces la pieza queda embalada (la precinta luego la precintadora de la salida, al pasar). El
 * cabezal sube y, mientras, detrás, la formadora saca la plancha siguiente del cargador, la abre, le
 * cierra el fondo y el mismo empujador la lleva a la espera.
 */
export const PACK = {
  // Cabezal: baja, coge la pieza, la sube, la mete en la caja, la suelta y retira las ventosas.
  down: [250, 1050],
  grab: [1050, 1250],
  lift: [1250, 2000],
  lower: [2700, 3400],
  release: [3400, 3600],
  retract: [3600, 3850],
  // Plegado: dedos sobre las solapas cortas, que se retiran, y palas sobre las largas.
  minors: [3850, 4250],
  fingersBack: [4350, 4650],
  majors: [4450, 5000],
  sealed: 5150,
  rise: [5150, 5850],
  paddlesBack: [5200, 5600],
  plateDown: [5300, 5700],
  // Empujador: mete la caja en el palé, se levanta, vuelve detrás de la formadora y trae la siguiente.
  push: [1700, 2700],
  shoeUp: [2700, 2950],
  back: [2950, 4100],
  shoeDown: [4500, 4750],
  feed: [4750, 5850],
  // Formadora: baja la mesa, saca la plancha, la abre, cierra el fondo y suelta la caja.
  bedDown: [2300, 2600],
  pull: [2600, 3200],
  open: [3200, 3900],
  stackFeed: [3300, 3800],
  bottomMinors: [3900, 4100],
  bottomMajors: [4100, 4300],
  bedUp: [4350, 4550],
  pickerUp: [4350, 4600],
  openerUp: [4400, 4650],
  openerBack: [4650, 5100],
  pickerBack: [5000, 5600],
  pickerDown: [5700, 6000],
  openerDown: [5900, 6200],
  end: 6250,
} as const;
const WORK_MS: Record<WorkId, number> = {
  display: SCAN.end,
  hydraulic: PRESS.end,
  robotic: PICK.home,
  pack: PACK.end,
};

/** Cinta: velocidad de crucero (m/s) y rampa de arranque y frenada (ms). */
const CRUISE = 0.7;
const RAMP_MS = 1400;
/** Parada mínima aunque ninguna máquina se vea, y margen tras el trabajo más largo. */
const MIN_DWELL_MS = 1600;
const AFTER_WORK_MS = 350;
/** Primer arranque tras cargar la página. */
const FIRST_MOVE_MS = 900;

/**
 * Motor: ciclo de ensayo casi continuo (ms). Arranca, recorre varios escalones de régimen,
 * se detiene un momento y vuelve a empezar. Régimen 0..1.
 */
const ENGINE_CYCLE_MS = 32000;
const ENGINE_PROFILE: [number, number][] = [
  [0, 0],
  [2500, 0.35],
  [6000, 0.35],
  [8000, 0.75],
  [14000, 0.75],
  [16000, 1],
  [21000, 1],
  [23000, 0.55],
  [27000, 0.55],
  [29000, 0.35],
  [31500, 0],
  [ENGINE_CYCLE_MS, 0],
];
const ENGINE_SPINDOWN_MS = 2600;

/** Longitud del bucle de piezas y posición de la primera, alineada con las paradas y oculta en la tolva. */
const LOOP = FLOW.count * FLOW.pitch;
const X0 = FLOW.stopX - FLOW.step * Math.ceil((FLOW.stopX - (FLOW.feeder.x1 - FLOW.pallet[0] / 2)) / FLOW.step);
/** Más allá, la pieza ya ha salido por la puerta y la tapa la pared. */
const HIDE_X = FLOW.hideX;
/** Tolerancia para considerar que una pieza está en su parada (m). */
const AT = 0.04;

type Mode = 'dwell' | 'move';

export const flow = {
  /** Avance de la cinta (m). */
  phase: 0,
  mode: 'dwell' as Mode,
  /** Inicio del tramo actual (ms), origen y longitud del avance, velocidad y rampa del perfil. */
  t0: 0,
  from: 0,
  dist: 0,
  dur: 0,
  v: CRUISE as number,
  ramp: RAMP_MS as number,
  /** Duración de la parada actual (ms). */
  dwellMs: FIRST_MOVE_MS as number,
  /** Inicio del trabajo de cada máquina (ms), o -1. */
  work: { display: -1, hydraulic: -1, robotic: -1, pack: -1 } as Record<WorkId, number>,
  /**
   * Vuelta de la cinta en la que cada pieza recibió su casquillo y su tapa (-1: aún no). Guardarlo
   * por pieza y por vuelta hace que la marca siga ahí cuando la pieza arranca y que solo se borre
   * cuando la pieza vuelve a entrar por la tolva.
   */
  pressedLap: new Array<number>(FLOW.count).fill(-1),
  cappedLap: new Array<number>(FLOW.count).fill(-1),
  packedLap: new Array<number>(FLOW.count).fill(-1),
  /** La planta corre (no en pausa, reposo ni panel abierto): lo leen las demás animaciones. */
  running: false,
  /** Tiempo real del frame (ms), compartido con las estaciones. */
  now: 0,
  /** Reloj de la planta (ms): no avanza en pausa y va a TEMPO veces el tiempo real. */
  plant: 0,
  engine: { running: false, epoch: 0, stopAt: -1, stopRpm: 0 },
};

const mod = (a: number, n: number) => ((a % n) + n) % n;
/**
 * Trabajo en espera: la pieza llegó al robot mientras se le mantenía a plena potencia. Empieza al
 * soltarlo (la cinta espera): así nunca coloca una tapa con el brazo en otra parte.
 */
const PENDING = -2;
export const easeInOut = (k: number) => 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, k)));

/** X de la pieza `i`. */
export function itemX(i: number, s = flow.phase) {
  return X0 + mod(s + i * FLOW.pitch, LOOP);
}
export function itemVisible(x: number) {
  return x <= HIDE_X;
}
/** Vuelta de la cinta en la que va la pieza `i` (cambia cuando vuelve a salir de la tolva). */
function lap(i: number, s = flow.phase) {
  return Math.floor((s + i * FLOW.pitch) / LOOP);
}
/** Pieza parada en `x` (o -1). */
function itemAt(x: number) {
  for (let i = 0; i < FLOW.count; i++) if (Math.abs(itemX(i) - x) < AT) return i;
  return -1;
}
function mark(laps: number[], x: number) {
  const i = itemAt(x);
  if (i >= 0) laps[i] = lap(i);
}
/**
 * Prensada si ya pasó la prensa (piezas que había al cargar la página) o si la prensa la marcó en
 * esta vuelta; igual con la tapa del robot.
 */
export function itemPressed(i: number) {
  return itemX(i) > WORK_X.hydraulic + AT || flow.pressedLap[i] === lap(i);
}
export function itemCapped(i: number) {
  return itemX(i) > WORK_X.robotic + AT || flow.cappedLap[i] === lap(i);
}
export function itemPacked(i: number) {
  return itemX(i) > WORK_X.pack + AT || flow.packedLap[i] === lap(i);
}
/**
 * La pieza `i` está en la embaladora fuera de su palé (la lleva el cabezal o está ya en la caja
 * abierta): la dibuja la máquina hasta que la caja queda precintada; el palé sigue en la cinta.
 */
export function itemInPacker(i: number) {
  const t = workTime('pack');
  return t >= PACK.grab[0] && t < PACK.sealed && Math.abs(itemX(i) - WORK_X.pack) < AT;
}

/** Distancia (m) que le falta a la cinta para dejar las piezas frente a las máquinas. */
function toStations(s: number) {
  return mod(WORK_X.hydraulic - itemX(0, s), FLOW.pitch);
}

/** Tiempo del trabajo de una máquina (ms, reloj de la planta) o -1 si está quieta. */
export function workTime(id: WorkId, plant = flow.plant) {
  return flow.work[id] < 0 ? -1 : plant - flow.work[id];
}

/**
 * Recorrido de un avance: rampa de velocidad en coseno, crucero y rampa de frenada (la pieza
 * arranca y para sin tirón). Devuelve metros recorridos en `t` ms.
 */
function travel(t: number) {
  const { dist, dur, v, ramp } = flow;
  if (t <= 0) return 0;
  if (t >= dur) return dist;
  const rampRun = (u: number) => (v * (u / 2 - (ramp / (2 * Math.PI)) * Math.sin((Math.PI * u) / ramp))) / 1000;
  if (t < ramp) return rampRun(t);
  if (t > dur - ramp) return dist - rampRun(dur - t);
  return rampRun(ramp) + (v * (t - ramp)) / 1000;
}

function startMove(now: number) {
  // Siguiente parada frente a las máquinas: un paso de pieza entero (o lo que falte tras cargar).
  let d = toStations(flow.phase);
  if (d < 0.5) d += FLOW.pitch;
  flow.mode = 'move';
  flow.t0 = now;
  flow.from = flow.phase;
  flow.dist = d;
  // Avance corto: sin crucero, solo las dos rampas a menor velocidad.
  const rampDist = (CRUISE * RAMP_MS) / 1000;
  flow.ramp = RAMP_MS;
  flow.v = d >= rampDist ? CRUISE : (d * 1000) / RAMP_MS;
  flow.dur = d >= rampDist ? (d / CRUISE) * 1000 + RAMP_MS : 2 * RAMP_MS;
}

/** Llegada a una parada: trabajan las máquinas que se ven; las demás dejan su marca sin animar. */
function arrive(now: number, onScreen: (x: number) => boolean) {
  flow.mode = 'dwell';
  flow.t0 = now;
  flow.dwellMs = MIN_DWELL_MS;
  const d = toStations(flow.phase);
  if (d > 0.01 && d < FLOW.pitch - 0.01) return;
  for (const id of WORKS) {
    if (onScreen(WORK_X[id])) {
      flow.work[id] = id === 'robotic' && forceLevel('robotic') > 0 ? PENDING : now;
      flow.dwellMs = Math.max(flow.dwellMs, WORK_MS[id] + AFTER_WORK_MS);
    } else if (id === 'hydraulic') mark(flow.pressedLap, WORK_X.hydraulic);
    else if (id === 'robotic') mark(flow.cappedLap, WORK_X.robotic);
    else if (id === 'pack') mark(flow.packedLap, WORK_X.pack);
  }
}

function sample(profile: [number, number][], t: number) {
  let i = 0;
  while (i < profile.length - 2 && t >= profile[i + 1][0]) i++;
  const [t0, a] = profile[i];
  const [t1, b] = profile[i + 1];
  return a + (b - a) * easeInOut((t - t0) / (t1 - t0));
}

/**
 * Banco de la celosía: ensayo cíclico continuo (s). Carga, mantiene un instante, descarga y reposa
 * otro instante, sin parar; la carga máxima sigue un bloque de amplitudes, como un programa real.
 */
const LOAD_CYCLE = { up: 2.6, hold: 0.5, down: 2.6, rest: 0.7 } as const;
const LOAD_PERIOD = LOAD_CYCLE.up + LOAD_CYCLE.hold + LOAD_CYCLE.down + LOAD_CYCLE.rest;
const LOAD_BLOCK = [0.72, 0.86, 1, 0.86];

/** Carga del banco (0..1) en el instante `t` (s de planta). Antes de arrancar la planta, 0. */
export function testLoad(t: number) {
  if (t <= 0) return 0;
  const n = Math.floor(t / LOAD_PERIOD);
  const u = t - n * LOAD_PERIOD;
  const a = LOAD_BLOCK[n % LOAD_BLOCK.length];
  const { up, hold, down } = LOAD_CYCLE;
  if (u < up) return a * easeInOut(u / up);
  if (u < up + hold) return a;
  if (u < up + hold + down) return a * (1 - easeInOut((u - up - hold) / down));
  return 0;
}

/** Segundos (de planta) hasta que la celosía vuelva a moverse: 0 si está cargando o descargando. */
export function testNextMove(t: number) {
  if (t <= 0) return -t;
  const u = mod(t, LOAD_PERIOD);
  const { up, hold, down } = LOAD_CYCLE;
  if (u < up) return 0;
  if (u < up + hold) return up + hold - u;
  if (u < up + hold + down) return 0;
  return LOAD_PERIOD - u;
}

/**
 * Régimen del motor (0..1). En pausa o reposo se frena hasta pararse. Mantenido pulsado, sube a
 * plena potencia desde donde esté (también con la línea parada: lo pide el visitante).
 */
export function engineRpm(now = flow.now) {
  const e = flow.engine;
  let rpm = 0;
  if (e.running) rpm = sample(ENGINE_PROFILE, mod((now - e.epoch) * TEMPO, ENGINE_CYCLE_MS));
  else if (e.stopAt >= 0) rpm = e.stopRpm * (1 - easeInOut((now - e.stopAt) / ENGINE_SPINDOWN_MS));
  const f = forceLevel('engine');
  return rpm + (1 - rpm) * f;
}

type Step = {
  /** La cinta avanza en este momento. */
  moving: boolean;
  /** Alguna máquina está trabajando. */
  working: boolean;
  /** Ms reales hasta el próximo cambio de estado (fin de avance, de parada o de trabajo). */
  nextIn: number;
};

/**
 * Avanza la planta. `running`: puede arrancar un avance nuevo y el motor sigue en marcha (no en
 * pausa, reposo ni panel abierto). `onScreen(x)`: la máquina en `x` se ve.
 */
export function stepFlow(realNow: number, running: boolean, onScreen: (x: number) => boolean): Step {
  flow.now = realNow;
  flow.running = running;
  updateLife(realNow, running);
  // A partir de aquí, todo en el reloj de la planta.
  const now = plantMs(realNow);
  flow.plant = now;

  // Motor (reloj real): arranca al volver la marcha y se frena al pararla.
  const e = flow.engine;
  if (running && !e.running) {
    e.running = true;
    e.epoch = realNow;
  } else if (!running && e.running) {
    e.stopRpm = engineRpm(realNow);
    e.running = false;
    e.stopAt = realNow;
  }

  if (flow.mode === 'move') {
    const t = now - flow.t0;
    flow.phase = flow.from + travel(t);
    if (t >= flow.dur) {
      flow.phase = flow.from + flow.dist;
      arrive(now, onScreen);
    }
  }

  // Trabajos: marcan la pieza en su momento y se retiran al acabar.
  let working = false;
  let nextIn = Infinity;
  for (const id of WORKS) {
    if (flow.work[id] === PENDING) {
      if (id === 'robotic' && forceLevel(id) > 0) {
        working = true;
        continue;
      }
      flow.work[id] = now;
    }
    const t = workTime(id, now);
    if (t < 0) continue;
    if (id === 'hydraulic' && t >= PRESS.contact) mark(flow.pressedLap, WORK_X.hydraulic);
    if (id === 'robotic' && t >= PICK.open) mark(flow.cappedLap, WORK_X.robotic);
    if (id === 'pack' && t >= PACK.sealed) mark(flow.packedLap, WORK_X.pack);
    if (t >= WORK_MS[id]) flow.work[id] = -1;
    else {
      working = true;
      nextIn = Math.min(nextIn, WORK_MS[id] - t);
    }
  }

  // Los plazos se cuentan en tiempo de planta; quien despierta la escena espera tiempo real.
  if (flow.mode === 'move') return { moving: true, working, nextIn: Math.min(nextIn, flow.dur - (now - flow.t0)) / TEMPO };
  const left = flow.dwellMs - (now - flow.t0);
  if (!running) return { moving: false, working, nextIn: nextIn / TEMPO };
  if (left > 0 || working) return { moving: false, working, nextIn: Math.min(nextIn, Math.max(left, 0)) / TEMPO };
  startMove(now);
  return { moving: true, working, nextIn: flow.dur / TEMPO };
}

/** Primer avance poco después de cargar (la planta aún no ha empezado a contar). */
export function primeFlow(realNow: number) {
  flow.t0 = plantMs(realNow);
  flow.dwellMs = FIRST_MOVE_MS;
}

// Acceso para los scripts de verificación (Playwright), solo en desarrollo.
if (typeof window !== 'undefined' && (process.env.NODE_ENV !== 'production' || process.env.PERF_HOOKS === '1')) {
  (window as unknown as { __flow: typeof flow }).__flow = flow;
}
