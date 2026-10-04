'use client';

import { useMemo } from 'react';
import * as THREE from 'three';
import { palette } from '@/config/palette';
import { DECAL_LAYER, flat } from '../materials';

const PAINT_Y = 0.004;
const WIDTH = 0.07;
const DASH = 0.34;
const GAP = 0.2;

/** Tramos de un segmento, discontinuos o no, como rectángulos (x0, x1, z0, z1). */
function segment(ax: number, az: number, bx: number, bz: number, dashed: boolean) {
  const out: [number, number, number, number][] = [];
  const along = ax === bx ? 'z' : 'x';
  const from = along === 'x' ? Math.min(ax, bx) : Math.min(az, bz);
  const to = along === 'x' ? Math.max(ax, bx) : Math.max(az, bz);
  const w = WIDTH / 2;
  const push = (a: number, b: number) => out.push(along === 'x' ? [a, b, az - w, az + w] : [ax - w, ax + w, a, b]);
  if (!dashed) push(from - w, to + w);
  else for (let s = from; s < to; s += DASH + GAP) push(s, Math.min(s + DASH, to));
  return out;
}

/** Delimitación de zona pintada en el suelo (amarilla), continua o discontinua. */
export function FloorOutline({ x0, x1, z0, z1, dashed = true }: { x0: number; x1: number; z0: number; z1: number; dashed?: boolean }) {
  const geometry = useMemo(() => {
    const rects = [
      ...segment(x0, z0, x1, z0, dashed),
      ...segment(x0, z1, x1, z1, dashed),
      ...segment(x0, z0, x0, z1, dashed),
      ...segment(x1, z0, x1, z1, dashed),
    ];
    const pos: number[] = [];
    for (const [a, b, c, d] of rects) {
      const quad = [
        [a, c],
        [b, c],
        [b, d],
        [a, d],
      ];
      for (const k of [0, 2, 1, 0, 3, 2]) pos.push(quad[k][0], PAINT_Y, quad[k][1]);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    return g;
  }, [x0, x1, z0, z1, dashed]);
  return <mesh geometry={geometry} material={flat(palette.signalYellow)} layers={DECAL_LAYER} />;
}
