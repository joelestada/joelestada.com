'use client';

import { useLayoutEffect, useMemo, useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { palette } from '@/config/palette';
import { testLoad } from '../../line/flow';
import { DECAL_LAYER } from '../../materials';
import { MONITOR, PLOT } from './dims';

/** Ventana de la gráfica (s) y muestras: avanza a saltos de un píxel, como un registrador en modo continuo. */
export const CHART = { window: 12.8, samples: 128 };
export const SAMPLE_S = CHART.window / CHART.samples;

/** Trazo plano (en el plano de la pantalla, z fija) a lo largo de una polilínea: un quad por tramo. */
function writeTrace(position: THREE.BufferAttribute, xs: Float32Array, ys: Float32Array, z: number, width: number) {
  const a = position.array as Float32Array;
  const h = width / 2;
  let o = 0;
  for (let i = 1; i < xs.length; i++) {
    const dx = xs[i] - xs[i - 1];
    const dy = ys[i] - ys[i - 1];
    const len = Math.hypot(dx, dy) || 1;
    const sx = (-dy / len) * h;
    const sy = (dx / len) * h;
    const v = [xs[i - 1] - sx, ys[i - 1] - sy, xs[i] - sx, ys[i] - sy, xs[i] + sx, ys[i] + sy, xs[i - 1] + sx, ys[i - 1] + sy];
    for (const k of [0, 2, 1, 0, 3, 2]) {
      a[o++] = v[k * 2];
      a[o++] = v[k * 2 + 1];
      a[o++] = z;
    }
  }
  position.needsUpdate = true;
}

function staticTrace(segments: [number, number, number, number][], z: number, width: number) {
  const g = new THREE.BufferGeometry();
  const attr = new THREE.BufferAttribute(new Float32Array(segments.length * 18), 3);
  g.setAttribute('position', attr);
  const tmp = new THREE.BufferAttribute(new Float32Array(18), 3);
  segments.forEach(([x0, y0, x1, y1], i) => {
    writeTrace(tmp, new Float32Array([x0, x1]), new Float32Array([y0, y1]), z, width);
    (attr.array as Float32Array).set(tmp.array as Float32Array, i * 18);
  });
  return g;
}

/** Carga registrada en una muestra: la del ciclo o, si se forzó la máquina entonces, la que tuvo. */
export type Forced = Map<number, number>;
const recorded = (forced: Forced, k: number) => forced.get(k) ?? testLoad(k * SAMPLE_S);

/**
 * Registro de la tensión de flexión frente al tiempo, en continuo: la curva sube al cargar, baja a
 * cero al descargar y la ventana avanza sin parar. El punto amarillo es la muestra actual.
 */
export function Plot({ tick, forced }: { tick: RefObject<number>; forced: Forced }) {
  const z = MONITOR.z + 0.008;
  const n = CHART.samples;
  const { trace, grid, axes, xs, ys } = useMemo(() => {
    const trace = new THREE.BufferGeometry();
    trace.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 18), 3));
    const xs = new Float32Array(n + 1).map((_, i) => PLOT.x0 + (i / n) * (PLOT.x1 - PLOT.x0));
    const ys = new Float32Array(n + 1).fill(PLOT.zero);
    const rows = [0.25, 0.5, 0.75].map((k) => PLOT.zero + k * (PLOT.y1 - PLOT.zero));
    return {
      trace,
      grid: staticTrace(
        rows.map((y) => [PLOT.x0, y, PLOT.x1, y] as [number, number, number, number]),
        z - 0.002,
        0.004,
      ),
      axes: staticTrace(
        [
          [PLOT.x0, PLOT.y1, PLOT.x0, PLOT.y0],
          [PLOT.x0, PLOT.y0, PLOT.x1, PLOT.y0],
        ],
        z - 0.001,
        0.006,
      ),
      xs,
      ys,
    };
  }, [n, z]);
  const materials = useMemo(
    () => ({
      trace: new THREE.MeshBasicMaterial({ color: palette.signalYellow, side: THREE.DoubleSide }),
      axis: new THREE.MeshBasicMaterial({ color: palette.metalMid, side: THREE.DoubleSide }),
      grid: new THREE.MeshBasicMaterial({
        color: new THREE.Color(palette.screen).lerp(new THREE.Color(palette.metalMid), 0.28),
        side: THREE.DoubleSide,
      }),
    }),
    [],
  );
  const pen = useRef<THREE.Mesh>(null);
  const shown = useRef(NaN);

  const draw = (k: number) => {
    if (k === shown.current) return;
    shown.current = k;
    for (let i = 0; i <= n; i++) ys[i] = PLOT.zero + recorded(forced, k - n + i) * (PLOT.y1 - PLOT.zero) * 0.92;
    writeTrace(trace.getAttribute('position') as THREE.BufferAttribute, xs, ys, z, 0.011);
    pen.current?.position.set(xs[n], ys[n], z + 0.001);
  };
  useLayoutEffect(() => draw(tick.current));
  useFrame(() => draw(tick.current), 0.5);

  return (
    <group>
      <mesh geometry={grid} material={materials.grid} layers={DECAL_LAYER} />
      <mesh geometry={axes} material={materials.axis} layers={DECAL_LAYER} renderOrder={1} />
      <mesh geometry={trace} material={materials.trace} layers={DECAL_LAYER} renderOrder={2} frustumCulled={false} />
      <mesh ref={pen} material={materials.trace} layers={DECAL_LAYER} renderOrder={2}>
        <planeGeometry args={[0.022, 0.022]} />
      </mesh>
    </group>
  );
}
