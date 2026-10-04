import { STATIONS } from '@/config/stations';
import { BOOT_SEEN_KEY, BOOT_SHORT_CLASS } from '@/lib/bootFlags';

/**
 * Arranque de la nave. Al cargar la portada (también al recargarla) la nave se dibuja en tinta
 * sobre el papel siguiendo la línea, se colorea estación a estación mientras se enciende su foco,
 * sube la persiana, arranca la planta y entra la interfaz. Cualquier gesto lo acelera hasta el
 * final. Si ya se vio en esta sesión, la misma secuencia va más deprisa (arranque corto).
 * Volviendo de un proyecto sin recargar, o con «reducir movimiento», no hay arranque: la
 * nave aparece ya en marcha. Sin React: lo leen la escena (uniformes, focos, persiana, planta) y
 * la capa HTML (clases de <html>).
 */

/** Cronología (s desde que la escena está lista). */
export const BOOT = {
  /** Barrido del trazo de silueta y retraso de las aristas interiores. */
  ink: [0.05, 1.3],
  detail: 0.22,
  /** Barrido del color: cada estación se colorea cuando le llega, y a la vez se enciende su foco. */
  color: [0.95, 2.15],
  /** Encendido del foco (subida) y nivel que alcanza. */
  lampRise: 0.24,
  lampPeak: 0.8,
  /** Persiana de la entrada: de cerrada a su altura de siempre. */
  shutter: [1.8, 3.0],
  /** Arranca la planta (cinta, motor, banco, pilotos). */
  plant: 2.35,
  /** Entra la interfaz. */
  ui: 2.55,
  /** Los focos vuelven a reposo. */
  settle: [2.85, 3.85],
  end: 3.9,
} as const;

/** Anchura de cada frente (m): el trazo aparece casi de golpe; el color, como una aguada. */
export const BAND = { thick: 0.5, thin: 0.8, color: 3.2 } as const;
/** Coordenada de avance: a lo largo de la línea, y lo alto un poco después (las máquinas «crecen»). */
export const RISE = 0.45;
/** Amplitud (m) de la ondulación de los frentes. */
export const WOBBLE = 0.55;
/** Fracción del tramo visible que el trazo se salta al empezar (lo que asoma ahí sale en el primer frame). */
const INK_LEAD = 0.1;
/** Con un gesto, el resto del arranque va así de rápido. */
const SKIP_SPEED = 7;
/** Arranque corto (recarga en la misma sesión): la secuencia entera en ≈1,5 s. */
const REPEAT_SPEED = 2.6;

type BootPhase = 'off' | 'wait' | 'run' | 'done';

export const boot = {
  phase: 'off' as BootPhase,
  /** Tiempo del arranque (s). */
  t: 0,
  speed: 1,
  /** Tramo de la coordenada de avance que se ve (m): lo recorren los frentes. */
  range: [0, 1] as [number, number],
  /** Posición de cada frente (m). */
  front: { thick: -1e4, thin: -1e4, color: -1e4 },
  /** Desregistro extra de la capa de color (0 = en registro): el color «cae» en su sitio. */
  register: 0,
  /** Encendido de cada foco (0..1) e instante en que le llegó el color. */
  lamps: new Float32Array(STATIONS.length),
  lampAt: new Float64Array(STATIONS.length).fill(Infinity),
  /** Tensión de cada foco (0..1): de noche su media luz no se enciende hasta que le llega el color. */
  power: new Float32Array(STATIONS.length).fill(1),
  /** Apertura de la persiana (0 cerrada, 1 a su altura). */
  shutter: 1,
};

const clamp01 = (k: number) => Math.min(1, Math.max(0, k));
const easeInOut = (k: number) => 0.5 - 0.5 * Math.cos(Math.PI * clamp01(k));
const easeOut = (k: number) => 1 - Math.pow(1 - clamp01(k), 3);
const span = (t: number, [a, b]: readonly [number, number]) => (t - a) / (b - a);
/** Barrido: arranca y frena suave, pero sin quedarse parado en los extremos (fuera de pantalla). */
const sweepEase = (k: number) => 0.3 * clamp01(k) + 0.7 * easeInOut(k);

let holds = 0;

/**
 * Una pieza de la escena que aún no está lista (un rótulo cuya fuente carga): el arranque no
 * empieza hasta que la suelte. Devuelve cómo soltarla (se puede llamar varias veces).
 */
export function holdBoot() {
  holds++;
  let held = true;
  return () => {
    if (!held) return;
    held = false;
    holds--;
  };
}

/** Queda alguna pieza por preparar. */
export function bootHeld() {
  return holds > 0;
}

/** El arranque está en curso (esperando a la escena o en marcha). */
export function bootActive() {
  return boot.phase === 'wait' || boot.phase === 'run';
}

/** La planta puede arrancar: sin arranque, o ya en su momento. */
export function plantPowered() {
  return boot.phase === 'off' || boot.phase === 'done' || (boot.phase === 'run' && boot.t >= BOOT.plant);
}

/**
 * Hay arranque si el script de <head> marcó la página con la clase `boot` (solo al cargar la
 * portada). Se decide al cargar este módulo, antes de montar nada: la planta no llega a arrancar.
 */
if (typeof document !== 'undefined' && document.documentElement.classList.contains('boot')) {
  boot.phase = 'wait';
  boot.shutter = 0;
  boot.register = 1;
  boot.power.fill(0);
  if (document.documentElement.classList.contains(BOOT_SHORT_CLASS)) boot.speed = REPEAT_SPEED;
}

/** Empieza a contar: `range` es el tramo de avance que se ve. Devuelve si hay arranque. */
export function startBoot(range: [number, number]) {
  // Si la escena tardó tanto que la interfaz ya salió sola (tope del script de <head>), sin arranque.
  if (!document.documentElement.classList.contains('boot')) {
    finishBoot();
    return false;
  }
  const w = window as unknown as { __bootFallback?: number };
  if (w.__bootFallback) window.clearTimeout(w.__bootFallback);
  boot.phase = 'run';
  boot.t = 0;
  boot.range = range;
  boot.lampAt.fill(Infinity);
  // Desde aquí, una recarga en esta sesión ya tiene arranque corto (aunque se recargue a medias).
  try {
    sessionStorage.setItem(BOOT_SEEN_KEY, '1');
  } catch {}
  return true;
}

/** Un gesto del visitante: el resto del arranque, deprisa. */
export function hurryBoot() {
  if (bootActive()) boot.speed = SKIP_SPEED;
}

/** Avanza el arranque `dt` s (ya limitado por quien llama). Devuelve si ha terminado ahora. */
export function stepBoot(dt: number) {
  if (boot.phase !== 'run') return false;
  const t = (boot.t += dt * boot.speed);
  const [s0, s1] = boot.range;
  // El trazo empieza algo dentro de la vista: el borde izquierdo suele ser suelo sin líneas.
  const sweep = (k: number, band: number, from = s0) => from - band - WOBBLE + (s1 - from + 2 * band + 2 * WOBBLE) * sweepEase(k);
  const inkFrom = s0 + INK_LEAD * (s1 - s0);
  boot.front.thick = sweep(span(t, BOOT.ink), BAND.thick, inkFrom);
  boot.front.thin = sweep(span(t - BOOT.detail, BOOT.ink), BAND.thin, inkFrom);
  boot.front.color = sweep(span(t, BOOT.color), BAND.color);
  boot.register = 1 - easeOut(span(t, BOOT.color));
  boot.shutter = easeInOut(span(t, BOOT.shutter));

  // Cada foco se enciende cuando el color llega al suelo bajo él y vuelve a reposo al final.
  const settle = 1 - easeInOut(span(t, BOOT.settle));
  STATIONS.forEach((s, i) => {
    const at = s.x + s.lamp[0];
    if (boot.lampAt[i] === Infinity && boot.front.color - BAND.color * 0.5 >= at) boot.lampAt[i] = t;
    const on = boot.lampAt[i] === Infinity ? 0 : easeOut((t - boot.lampAt[i]) / BOOT.lampRise);
    boot.lamps[i] = BOOT.lampPeak * on * settle;
    boot.power[i] = on;
  });

  if (t < BOOT.end) return false;
  finishBoot();
  return true;
}

/** Estado final (también si la escena tardó tanto que la interfaz ya salió sola). */
function finishBoot() {
  boot.phase = 'done';
  boot.speed = 1;
  boot.front.thick = boot.front.thin = boot.front.color = 1e4;
  boot.register = 0;
  boot.lamps.fill(0);
  boot.power.fill(1);
  boot.shutter = 1;
}

// Acceso para los scripts de verificación (Playwright), solo en desarrollo.
if (typeof window !== 'undefined' && (process.env.NODE_ENV !== 'production' || process.env.PERF_HOOKS === '1')) {
  (window as unknown as { __boot: typeof boot }).__boot = boot;
}
