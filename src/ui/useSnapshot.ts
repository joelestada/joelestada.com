'use client';

import { useCallback, useRef, useSyncExternalStore } from 'react';
import { getSnapshot, subscribe, type Snapshot } from '@/lib/runtime';

/**
 * Estado discreto compartido con la escena (estación destacada, activa, panel abierto).
 * Con claves, el componente solo se vuelve a pintar cuando cambia alguna de ellas (la barra no se
 * entera de que el cursor pasa de una máquina a otra); sin claves, con cualquier cambio.
 */
export function useSnapshot(): Snapshot;
export function useSnapshot<K extends keyof Snapshot>(...keys: K[]): Pick<Snapshot, K>;
export function useSnapshot<K extends keyof Snapshot>(...keys: K[]) {
  const cache = useRef<Pick<Snapshot, K> | null>(null);
  const deps = keys.join('|');
  const select = useCallback(() => {
    const snap = getSnapshot();
    if (!keys.length) return snap;
    const prev = cache.current;
    if (prev && keys.every((k) => prev[k] === snap[k])) return prev;
    const next = {} as Pick<Snapshot, K>;
    for (const k of keys) next[k] = snap[k];
    cache.current = next;
    return next;
    // Las claves se comparan por su texto: una lista nueva con las mismas claves no cambia nada.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deps]);
  return useSyncExternalStore(subscribe, select, select);
}
