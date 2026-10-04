'use client';

import { palette } from '@/config/palette';
import { Block, Box, Cyl, Dome } from '../../kit/primitives';
import { ACC, GAUGES, HEADER, PIPE } from './dims';

const c = palette;
const SKID = { x0: -2.36, x1: -0.3, z0: -2.56, z1: -1.86, h: 0.06 };
/** Viga trasera del bastidor y alturas de las abrazaderas. */
const BACK_Z = ACC.z - ACC.r - 0.05;
const CLAMPS = [0.62, 1.2];

/**
 * Bastidor de la batería (fijo): bancada con bandeja, montantes y vigas traseras con una abrazadera
 * por botella y por altura; bajo cada botella, su pie y la válvula de aislamiento (maneta amarilla)
 * con el racor al colector. A la izquierda, el panel de manómetros (las agujas las mueve la estación).
 */
export function AccumulatorRack() {
  const { z, r } = ACC;
  return (
    <group>
      <Block min={[SKID.x0, 0, SKID.z0]} max={[SKID.x1, SKID.h, SKID.z1]} c={c.metalMid} />
      <Block min={[SKID.x0, SKID.h, SKID.z1 - 0.02]} max={[SKID.x1, SKID.h + 0.025, SKID.z1]} c={c.metalMid} />
      {[SKID.x0 + 0.04, SKID.x1 - 0.04].map((x) => (
        <Block key={x} min={[x - 0.035, SKID.h, BACK_Z - 0.07]} max={[x + 0.035, 1.62, BACK_Z]} c={c.metalMid} />
      ))}
      {CLAMPS.map((y) => (
        <group key={y}>
          <Block min={[SKID.x0 + 0.04, y - 0.035, BACK_Z - 0.07]} max={[SKID.x1 - 0.04, y + 0.035, BACK_Z]} c={c.metalMid} />
          {ACC.xs.map((x) => (
            <group key={x}>
              <Cyl p={[x, y, z]} radius={r + 0.008} length={0.04} segments={24} c={c.metalMid} />
              <Block min={[x - 0.02, y - 0.02, BACK_Z]} max={[x + 0.02, y + 0.02, z - r]} c={c.metalMid} />
            </group>
          ))}
        </group>
      ))}
      {ACC.xs.map((x) => (
        <group key={x}>
          <Block min={[x - 0.07, SKID.h, z - 0.07]} max={[x + 0.07, ACC.y0 - 0.04, z + 0.07]} c={c.metalDark} />
          <Cyl p={[x, ACC.y0 - 0.02, z]} radius={0.06} length={0.04} segments={6} c={c.metalMid} />
          <Cyl p={[x, HEADER.y, (z + 0.06 + HEADER.z) / 2]} radius={PIPE * 0.7} length={HEADER.z - z - 0.06} axis="z" c={c.metalMid} />
          <Block min={[x - 0.035, HEADER.y - 0.035, HEADER.z - 0.14]} max={[x + 0.035, HEADER.y + 0.035, HEADER.z - 0.07]} c={c.metalDark} />
          <Box p={[x + 0.05, HEADER.y + 0.045, HEADER.z - 0.105]} s={[0.11, 0.014, 0.024]} c={c.signalYellow} />
        </group>
      ))}
      {/* Panel de manómetros con su poste y los tubos de toma. */}
      <Block min={[-2.62, 0, z - 0.05]} max={[-2.56, 1.5, z + 0.05]} c={c.metalMid} />
      <Block min={[-2.8, 1.04, z + 0.05]} max={[-2.38, 1.48, z + 0.08]} c={c.metalLight} />
      {GAUGES.xs.map((x) => (
        <group key={x}>
          <Cyl p={[x, GAUGES.y, GAUGES.z - 0.02]} radius={GAUGES.r} length={0.04} axis="z" segments={24} c={c.metalDark} />
          <Cyl p={[x, GAUGES.y, GAUGES.z + 0.001]} radius={GAUGES.r * 0.84} length={0.004} axis="z" segments={24} c={c.floorLit} />
          <Cyl p={[x, GAUGES.y - GAUGES.r - 0.03, GAUGES.z - 0.03]} radius={0.012} length={0.06} c={c.metalMid} />
        </group>
      ))}
      <Block min={[-2.75, 1.09, z + 0.08]} max={[-2.43, 1.12, z + 0.083]} c={c.metalDark} />
    </group>
  );
}

/** Botella de un acumulador de vejiga: cuerpo, casquete, válvula de gas con su tapón amarillo y regleta de nivel. */
export function Bottle({ x }: { x: number }) {
  const { z, r, y0, y1 } = ACC;
  return (
    <group>
      <Cyl p={[x, (y0 + y1) / 2, z]} radius={r} length={y1 - y0} c={c.metalLight} segments={24} />
      <Dome p={[x, y1, z]} radius={r} c={c.metalLight} segments={24} />
      <Cyl p={[x, y1 + r + 0.02, z]} radius={0.03} length={0.06} c={c.metalMid} />
      <Cyl p={[x, y1 + r + 0.06, z]} radius={0.04} length={0.03} c={c.signalYellow} />
      <Block min={[x - 0.03, 0.34, z + r - 0.02]} max={[x + 0.03, 1.36, z + r + 0.012]} c={c.stripeBlack} />
      <Block min={[x - 0.045, 1.36, z + r - 0.02]} max={[x + 0.045, 1.4, z + r + 0.016]} c={c.metalMid} />
    </group>
  );
}
