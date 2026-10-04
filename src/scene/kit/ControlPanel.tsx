'use client';

import type { Vec3 } from '@/config/layout';
import { palette } from '@/config/palette';
import { Block, Box, Cyl } from './primitives';
import type { Facing } from './ElectricalCabinet';

const HEAD_TILT = -0.32;

/**
 * Pupitre de mando: pedestal, cabeza inclinada con pantalla y botonera
 * (seta de paro, marcha, rearme). `position` es el centro de la base.
 */
export function ControlPanel({
  position,
  height = 1.5,
  width = 0.55,
  depth = 0.4,
  facing = '+z',
}: {
  position: Vec3;
  height?: number;
  width?: number;
  depth?: number;
  facing?: Facing;
}) {
  const rotation: Vec3 = facing === '+z' ? [0, 0, 0] : [0, -Math.PI / 2, 0];
  const bodyTop = height - 0.5;
  const headH = 0.52;
  const headD = depth * 0.72;

  return (
    <group position={position} rotation={rotation}>
      <Block min={[-width / 2 + 0.03, 0, -depth / 2 + 0.03]} max={[width / 2 - 0.03, 0.07, depth / 2 - 0.03]} c={palette.metalMid} />
      <Block min={[-width / 2, 0.07, -depth / 2]} max={[width / 2, bodyTop, depth / 2]} c={palette.metalLight} />
      <Block min={[-width / 2 + 0.05, 0.14, depth / 2]} max={[width / 2 - 0.05, bodyTop - 0.08, depth / 2 + 0.012]} c={palette.metalLight} />
      <Box p={[width / 2 - 0.1, bodyTop * 0.55, depth / 2 + 0.022]} s={[0.025, 0.12, 0.02]} c={palette.metalMid} />
      {/* Cabeza inclinada hacia el operario. */}
      <group position={[0, bodyTop, depth / 2 - headD / 2]} rotation={[HEAD_TILT, 0, 0]}>
        <Block min={[-width / 2, 0, -headD / 2]} max={[width / 2, headH, headD / 2]} c={palette.metalLight} />
        {/* Pantalla con marco. */}
        <Block min={[-width / 2 + 0.06, headH * 0.42, headD / 2]} max={[width / 2 - 0.06, headH - 0.05, headD / 2 + 0.012]} c={palette.metalMid} />
        <Block min={[-width / 2 + 0.09, headH * 0.47, headD / 2 + 0.012]} max={[width / 2 - 0.09, headH - 0.08, headD / 2 + 0.018]} c={palette.screen} />
        {/* Botonera. */}
        <Cyl p={[-width / 2 + 0.11, headH * 0.2, headD / 2 + 0.02]} radius={0.04} length={0.04} axis="z" c={palette.andonRed} />
        <Cyl p={[-0.02, headH * 0.2, headD / 2 + 0.015]} radius={0.026} length={0.03} axis="z" c={palette.andonGreen} />
        <Cyl p={[0.07, headH * 0.2, headD / 2 + 0.015]} radius={0.026} length={0.03} axis="z" c={palette.andonAmber} />
        <Cyl p={[0.16, headH * 0.2, headD / 2 + 0.015]} radius={0.026} length={0.03} axis="z" c={palette.metalMid} />
      </group>
    </group>
  );
}
