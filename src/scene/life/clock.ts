/**
 * Reloj de la vida de la nave (personas, carro, grúa, pantallas). Avanza en tiempo real mientras
 * la planta corre y se detiene en pausa o en reposo: al volver, todo sigue justo donde estaba.
 */
const life = { paused: true, pausedTotal: 0, pauseStart: 0 };

/** Se llama en cada frame con el estado de la planta. */
export function updateLife(now: number, running: boolean) {
  if (running && life.paused) {
    life.pausedTotal += now - life.pauseStart;
    life.paused = false;
  } else if (!running && !life.paused) {
    life.paused = true;
    life.pauseStart = now;
  }
}

/** Tiempo de vida transcurrido (ms): el reloj de la planta, quieto en pausa. */
export function lifeMs(now: number) {
  return (life.paused ? life.pauseStart : now) - life.pausedTotal;
}

/** Tiempo de vida transcurrido (s). */
export function lifeTime(now: number) {
  return lifeMs(now) / 1000;
}

export function lifeRunning() {
  return !life.paused;
}

/** Aleatorio determinista en [0, 1) a partir de un entero: los horarios se repiten igual en cada visita. */
export function hash(n: number) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export const smooth = (k: number) => {
  const t = Math.min(1, Math.max(0, k));
  return t * t * (3 - 2 * t);
};
