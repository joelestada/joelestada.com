'use client';

import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { STATION_BY_ID } from '@/config/stations';
import { getSnapshot, markDirty } from '@/lib/runtime';
import { EXPLODE_REACH as REACH, explode, explodeEnd, stepExplode } from './explode';
import { frameClock } from './frameClock';
import { regionOnScreen, type Region } from './kit/regions';

/**
 * Conduce la vista explosionada: sigue a la ficha (abre la máquina pedida; si había otra abierta,
 * primero la vuelve a montar), avanza la cronología y pide los frames mientras se mueve algo.
 */
export function ExplodeDriver() {
  const invalidate = useThree((s) => s.invalidate);
  const last = useRef(0);

  useFrame(() => {
    const want = getSnapshot().exploded;
    if (explode.station && explode.station !== want) explode.goal = 0;
    else if (want) {
      if (!explode.station) {
        explode.station = want;
        explode.t = 0;
        explode.end = explodeEnd(want);
      }
      explode.goal = 1;
    } else explode.goal = 0;

    const now = frameClock.now;
    const dt = last.current ? Math.min((now - last.current) / 1000, 1 / 30) : 1 / 60;
    const station = explode.station;
    const moved = stepExplode(dt);
    last.current = moved ? now : 0;
    if (!station) return;
    // Toda la máquina y el espacio de sus piezas separadas se repinta en cada frame mientras está
    // abierta: sus propias animaciones (el motor que se frena…) ya no caben en sus zonas de siempre.
    const { x, hit } = STATION_BY_ID[station];
    const r: Region = [hit.min[0] - REACH.side, hit.min[1], hit.min[2] - REACH.side, hit.max[0] + REACH.side, hit.max[1] + REACH.up, hit.max[2] + REACH.side];
    if (regionOnScreen(r, x)) markDirty(x + r[0], r[1], r[2], x + r[3], r[4], r[5]);
    if (moved) invalidate();
    // Montada del todo: ninguna máquina abierta (la línea vuelve a arrancar o se abre la siguiente).
    if (explode.goal === 0 && explode.t === 0) {
      explode.station = null;
      invalidate();
    }
  }, -1.8);

  return null;
}
