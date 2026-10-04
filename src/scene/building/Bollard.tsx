'use client';

import type { Vec3 } from '@/config/layout';
import { palette } from '@/config/palette';
import { Cyl } from '../kit/primitives';

const RADIUS = 0.1;
const HEIGHT = 1.1;
/** Banda reflectante: una sola, cerca de la cabeza. */
const BAND = { from: 0.84, height: 0.12 } as const;

/** Bolardo de protección: tubo de acero con una banda amarilla (sin franjas de obra). */
export function Bollard({ position }: { position: Vec3 }) {
  const [x, y, z] = position;
  return (
    <group>
      <Cyl p={[x, y + HEIGHT / 2, z]} radius={RADIUS} length={HEIGHT} c={palette.metalLight} segments={24} />
      <Cyl p={[x, y + HEIGHT * BAND.from + BAND.height / 2, z]} radius={RADIUS * 1.02} length={BAND.height} c={palette.signalYellow} segments={24} />
      <Cyl p={[x, y + HEIGHT + 0.015, z]} radius={RADIUS * 0.96} length={0.03} c={palette.metalMid} />
      <Cyl p={[x, y + 0.01, z]} radius={RADIUS * 1.35} length={0.02} c={palette.metalMid} />
    </group>
  );
}
