'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { runtime } from '@/lib/runtime';
import { setRefreshPeriod, tickFrame } from './frameClock';

/**
 * Resolución del pipeline de tinta. El lienzo va siempre a la resolución nativa: con un factor no
 * entero el navegador reescala el fotograma y, al desplazarse la cámara, el trazo vuelve a parpadear
 * (medido: 3–6 % de píxeles cambian por frame frente a 0,003 %). Bajar el supermuestreo engorda el
 * trazo, así que tampoco se usa como recurso: la fluidez la asegura el marcapasos.
 */
/** Frames seguidos con los que se juzga el ritmo. */
const WINDOW = 45;
/** Un frame que tarda más de esto × el refresco de la pantalla es un refresco perdido. */
const MISSED = 1.4;

/** Resolución del lienzo y supermuestreo interno (entero, para que el ajuste al píxel siga siendo exacto). */
export function resolutionFor(device: number) {
  const dpr = Math.min(device, 2);
  // El grosor del trazo está calibrado para ~2 px internos por px CSS: en pantallas 1× se supermuestrea.
  const supersample = dpr < 1.5 ? 2 : 1;
  return { dpr, supersample };
}

/**
 * Fija la resolución y hace de marcapasos: en pantallas de 120 Hz, si la GPU no llega a pintar
 * a 120 fps (típico a pantalla completa), pinta uno de cada dos refrescos. Una cadencia fija de
 * 60 fps se percibe fluida; una que alterna 120 y 60 se percibe como tirones.
 */
export function Resolution() {
  const size = useThree((s) => s.size);
  const setDpr = useThree((s) => s.setDpr);
  const get = useThree((s) => s.get);
  const samples = useRef<number[]>([]);
  const last = useRef(0);
  /** Periodo de refresco de la pantalla (ms). */
  const refresh = useRef(1000 / 60);

  const apply = () => {
    const { dpr, supersample } = resolutionFor(window.devicePixelRatio || 1);
    runtime.supersample = supersample;
    setDpr(dpr);
    runtime.invalidate();
  };

  // Se rehace al cambiar el tamaño del lienzo (`apply` solo lee la ventana y el runtime).
  useLayoutEffect(() => {
    runtime.pace = 1;
    apply();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.width, size.height]);

  // Periodo de refresco real: mediana de 40 rAF seguidos, medido aparte de la escena.
  useEffect(() => {
    let raf = 0;
    const t: number[] = [];
    const tick = (now: number) => {
      t.push(now);
      if (t.length < 41) raf = requestAnimationFrame(tick);
      else {
        const d = t
          .slice(1)
          .map((v, i) => v - t[i])
          .sort((a, b) => a - b);
        refresh.current = d[d.length >> 1];
        // Primera estimación para el reloj de los frames (luego la afina con los frames de la escena).
        setRefreshPeriod(refresh.current);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Banco de pruebas (solo desarrollo): ms de GPU por frame, sincronizando cada render con una lectura.
  useEffect(() => {
    if (process.env.NODE_ENV === 'production' && process.env.PERF_HOOKS !== '1') return;
    const w = window as unknown as { __bench?: (dpr: number, ss: number, n?: number) => Promise<number>; __r3f?: typeof get };
    w.__r3f = get;
    w.__bench = async (dpr, ss, n = 40) => {
      const state = get();
      runtime.supersample = ss;
      state.setDpr(dpr);
      await new Promise((r) => setTimeout(r, 300));
      // Se sincroniza leyendo un objetivo propio de 1 px: leer el lienzo visible obligaría
      // al navegador a copiar el fotograma entero y falsearía la medida.
      const renderer = state.gl;
      const probe = new THREE.WebGLRenderTarget(1, 1);
      const px = new Uint8Array(4);
      const sync = () => {
        renderer.setRenderTarget(probe);
        renderer.clear();
        renderer.readRenderTargetPixels(probe, 0, 0, 1, 1, px);
        renderer.setRenderTarget(null);
      };
      sync();
      // Rendimiento sostenido: n frames seguidos y una sola sincronización al final.
      const t0 = performance.now();
      // Se mide el pintado: ningún frame del banco se salta.
      runtime.forceDraw = true;
      for (let i = 0; i < n; i++) get().advance(performance.now());
      runtime.forceDraw = false;
      sync();
      const ms = (performance.now() - t0) / n;
      probe.dispose();
      apply();
      return ms;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- el banco se instala una vez; `apply` no guarda estado
  }, [get]);

  useFrame(() => {
    const now = performance.now();
    // Primer paso de cada frame: el reloj con el que se mueve todo lo demás.
    tickFrame(now);
    const dt = now - last.current;
    last.current = now;
    // Solo cuentan frames encadenados (scroll o animación en marcha), no las pausas.
    if (dt > 100) {
      samples.current.length = 0;
      return;
    }
    const s = samples.current;
    s.push(dt);
    if (s.length < WINDOW) return;
    const sorted = [...s].sort((a, b) => a - b);
    s.length = 0;
    const median = sorted[sorted.length >> 1];
    const highRefresh = refresh.current < 11;
    if (highRefresh && runtime.pace === 1 && median > refresh.current * MISSED) {
      // Pantalla de 120 Hz sin margen para pintar a 120: mejor 60 exactos que una cadencia irregular.
      runtime.pace = 2;
    }
  }, -3);

  return null;
}
