/**
 * Reloj de los frames: todo lo que se mueve en la nave (cámara, cinta, máquinas, puertas, despiece,
 * focos, arranque) avanza con él y no con performance.now().
 *
 * Cada frame se ve en un refresco de la pantalla, así que entre dos frames pasan siempre refrescos
 * enteros. performance.now() no lo refleja: Safari lo da en milisegundos enteros, y el frame empieza más
 * o menos tarde según lo ocupado que esté el hilo principal (medido en WebKit a 60 Hz: intervalos de 15 a
 * 18 ms, y alguno de 23 ms seguido de otro de 10 sin perder ningún refresco). Con ese paso la cámara
 * avanzaba un frame un 10–40 % de más y el siguiente de menos; con la cámara en píxeles enteros, a
 * velocidad lenta o media eso es un píxel de más o de menos que se ve como un tirón aunque el medidor
 * marque 60 fps. Chrome da la marca del refresco y no lo sufría. Aquí el paso es siempre un número entero
 * de refrescos, y la marca sigue al reloj real con una corrección suave para no desfasarse de él.
 */

/** Fracción del desfase con el reloj real que se corrige en cada frame (pequeña: no devuelve el ruido). */
const PHASE_GAIN = 0.05;
/** Una pausa más larga (nada que pintar, pestaña oculta) vuelve a tomar el reloj real. */
const RESYNC_MS = 250;
/** Refrescos habituales (Hz): el periodo medido se queda con uno de ellos si está a menos del 1,5 %. */
const REFRESH_RATES = [30, 48, 50, 60, 72, 75, 90, 100, 120, 144, 165, 180, 240];
/** Intervalos con los que se mide el periodo (medio segundo a 60 Hz). */
const SAMPLES = 24;

export const frameClock = {
  /** Instante del frame en curso (ms, en la escala de performance.now()). */
  now: 0,
  /** Paso desde el frame anterior (ms): un número entero de refrescos, salvo tras una pausa. */
  dt: 1000 / 60,
  /** Periodo de refresco de la pantalla (ms). */
  period: 1000 / 60,
};

/** Reloj real del frame anterior e intervalos reales recientes. */
const real = { last: 0, samples: new Float64Array(SAMPLES), count: 0 };

/** Al empezar cada frame, con el reloj real. */
export function tickFrame(now: number) {
  const c = frameClock;
  const interval = now - real.last;
  real.last = now;
  if (!c.now || interval <= 0 || interval > RESYNC_MS) {
    c.dt = c.now && interval > 0 ? interval : c.period;
    c.now = now;
    return;
  }
  measure(interval);
  const n = Math.max(1, Math.round((now - c.now) / c.period));
  const predicted = c.now + n * c.period;
  let next = predicted + PHASE_GAIN * (now - predicted);
  // Más de medio refresco de desfase: el periodo aún no está medido (o ha cambiado). Se toma el real,
  // sin volver atrás.
  if (Math.abs(now - next) > c.period / 2) next = Math.max(now, c.now);
  c.dt = next - c.now;
  c.now = next;
}

/**
 * Periodo de la pantalla: media de los intervalos del grupo de la mediana (los de un refresco; fuera los
 * frames perdidos), que con unos pocos ya es exacta aunque cada marca venga redondeada al milisegundo.
 */
function measure(interval: number) {
  real.samples[real.count % SAMPLES] = interval;
  real.count++;
  if (real.count % SAMPLES !== 0 && real.count !== 8) return;
  const n = Math.min(real.count, SAMPLES);
  const values = Array.from(real.samples.subarray(0, n)).sort((a, b) => a - b);
  const median = values[n >> 1];
  let sum = 0;
  let k = 0;
  for (const v of values) {
    if (v > median * 0.6 && v < median * 1.4) {
      sum += v;
      k++;
    }
  }
  if (k < n / 2) return;
  setRefreshPeriod(sum / k, 0.015);
}

/** Periodo medido (ms): se queda con el de un refresco habitual si está dentro de la tolerancia. */
export function setRefreshPeriod(measured: number, tolerance = 0.1) {
  if (!(measured > 0)) return;
  let best = measured;
  let error = Infinity;
  for (const hz of REFRESH_RATES) {
    const p = 1000 / hz;
    const e = Math.abs(p - measured) / p;
    if (e < error) {
      error = e;
      best = p;
    }
  }
  frameClock.period = error < tolerance ? best : measured;
}
