'use client';

import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { force, stepForce } from './force';
import { frameClock } from './frameClock';

/** Lleva la potencia de la máquina que se mantiene pulsada y pide frames mientras sube o baja. */
export function ForceDriver() {
  const invalidate = useThree((s) => s.invalidate);
  const last = useRef(0);

  useFrame(() => {
    if (!force.station) {
      last.current = 0;
      return;
    }
    const now = frameClock.now;
    const dt = last.current ? Math.min((now - last.current) / 1000, 1 / 30) : 1 / 60;
    last.current = now;
    if (stepForce(dt) || force.level > 0) invalidate();
  }, -1.7);

  return null;
}
