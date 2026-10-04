'use client';

import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { runtime } from '@/lib/runtime';

/**
 * Último paso de cada frame: si algún sistema quieto espera un cambio (una persona que va a girar
 * la cabeza, un carro parado que va a arrancar), se programa un único temporizador para entonces.
 * Así, mientras nada se mueve en pantalla, no se pide ningún frame.
 */
export function Scheduler() {
  const invalidate = useThree((s) => s.invalidate);
  const timer = useRef<ReturnType<typeof setTimeout> | 0>(0);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  useFrame(() => {
    const ms = runtime.nextWake;
    runtime.nextWake = Infinity;
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = 0;
    }
    if (Number.isFinite(ms)) timer.current = setTimeout(() => invalidate(), Math.max(1, ms));
  }, 2);

  return null;
}
