'use client';

import type { Vec3 } from '@/config/layout';
import { palette } from '@/config/palette';
import type { Pt } from './geometry';
import { Bolt, Cyl, Prism } from './primitives';

const c = palette;

/**
 * Herrajes de bancada comunes a las máquinas: anclajes a suelo o a ranura y cartelas soldadas.
 */

/** Anclaje (a una ranura en T o al suelo): arandela, tuerca hexagonal y punta del espárrago. `p` es la cara de apoyo. */
export function Anchor({ p, r = 0.026 }: { p: Vec3; r?: number }) {
  const [x, y, z] = p;
  return (
    <group>
      <Cyl p={[x, y + 0.003, z]} radius={r * 1.25} length={0.006} c={c.metalMid} />
      <Bolt p={[x, y + 0.006, z]} r={r} h={r} c={c.metalMid} />
      <Cyl p={[x, y + 0.006 + r + 0.008, z]} radius={r * 0.48} length={0.016} c={c.metalLight} />
    </group>
  );
}

/**
 * Cartela triangular soldada a una cara: plano YZ (delgada en X), de la cara `zFace` hacia fuera
 * hasta `zOut`, con la punta achaflanada como en taller.
 */
export function Gusset({
  x,
  y,
  zFace,
  zOut,
  h,
  t = 0.02,
  color = c.green,
}: {
  x: number;
  y: number;
  zFace: number;
  zOut: number;
  h: number;
  t?: number;
  color?: string;
}) {
  const outline: Pt[] = [
    [zFace, y],
    [zOut, y],
    [zOut, y + 0.04],
    [zFace, y + h],
  ];
  return <Prism outline={outline} plane="zy" from={x - t / 2} depth={t} c={color} />;
}

/** La misma cartela en el plano XY (delgada en Z): de la cara `xFace` hacia fuera hasta `xOut`. */
export function GussetX({
  z,
  y,
  xFace,
  xOut,
  h,
  t = 0.02,
  color = c.green,
}: {
  z: number;
  y: number;
  xFace: number;
  xOut: number;
  h: number;
  t?: number;
  color?: string;
}) {
  const outline: Pt[] = [
    [xFace, y],
    [xOut, y],
    [xOut, y + 0.04],
    [xFace, y + h],
  ];
  return <Prism outline={outline} plane="xy" from={z - t / 2} depth={t} c={color} />;
}
