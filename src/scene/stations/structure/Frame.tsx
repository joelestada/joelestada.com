'use client';

import { palette } from '@/config/palette';
import { roundCorners } from '../../kit/geometry';
import { Anchor, Gusset } from '../../kit/hardware';
import { Block, Bolt, Cyl, Prism, Ring } from '../../kit/primitives';
import { ACT, BEAM, BED, COLUMN, COLUMN_TOP, HOSE, RIG_Z, SLOTS_Z } from './dims';

const c = palette;

/**
 * Bancada de ensayo: losa con cuatro ranuras en T a lo largo de X (carriles separados, con el fondo
 * de la ranura relleno en oscuro casi hasta arriba: se leen hundidas) y cajeados de anclaje al
 * forjado en la cara delantera.
 */
export function Bed() {
  const { x0, x1, z0, z1, h, base, slot } = BED;
  const edges = [z0, ...SLOTS_Z.flatMap((z) => [z - slot / 2, z + slot / 2]), z1];
  const rails: [number, number][] = [];
  for (let i = 0; i < edges.length; i += 2) rails.push([edges[i], edges[i + 1]]);
  return (
    <group>
      <Block min={[x0, 0, z0]} max={[x1, base, z1]} c={c.metalMid} />
      {rails.map(([a, b]) => (
        <Block key={a} min={[x0, base, a]} max={[x1, h, b]} c={c.metalMid} />
      ))}
      {SLOTS_Z.map((z) => (
        <Block key={z} min={[x0, base, z - slot / 2]} max={[x1, h - 0.008, z + slot / 2]} c={c.stripeBlack} />
      ))}
      {[-2.05, -0.68, 0.68, 2.05].map((x) => (
        <Block key={x} min={[x - 0.07, 0.045, z1]} max={[x + 0.07, 0.125, z1 + 0.004]} c={c.metalDark} />
      ))}
      {/* Calzos de nivelación bajo las esquinas. */}
      {[x0 + 0.18, x1 - 0.18].flatMap((x) =>
        [z0 + 0.18, z1 - 0.18].map((z) => <Block key={`${x}${z}`} min={[x - 0.1, 0, z - 0.1]} max={[x + 0.1, 0.012, z + 0.1]} c={c.metalDark} />),
      )}
    </group>
  );
}

/** Pilar HEB del pórtico: placa de anclaje con seis tuercas, alas, alma, cartelas, taladros de reglaje y placa de cabeza. */
export function Column({ x }: { x: number }) {
  const g = c.green;
  const { half, flange, tf, web, base, cap } = COLUMN;
  const y0 = BED.h + base;
  const top = COLUMN_TOP;
  const holes: number[] = [];
  for (let y = 0.82; y < top - 0.15; y += 0.15) holes.push(y);
  return (
    <group>
      <Block min={[x - 0.2, BED.h, RIG_Z - 0.42]} max={[x + 0.2, y0, RIG_Z + 0.42]} c={c.metalDark} />
      {[-0.14, 0, 0.14].flatMap((dx) => [-1, 1].map((s) => <Anchor key={`${dx}${s}`} p={[x + dx, y0, RIG_Z + s * 0.27]} />))}
      <Block min={[x - half, y0, RIG_Z + flange - tf]} max={[x + half, top, RIG_Z + flange]} c={g} />
      <Block min={[x - half, y0, RIG_Z - flange]} max={[x + half, top, RIG_Z - flange + tf]} c={g} />
      <Block min={[x - web, y0, RIG_Z - flange + tf]} max={[x + web, top, RIG_Z + flange - tf]} c={g} />
      {[-0.07, 0.07].flatMap((dx) =>
        [-1, 1].map((s) => <Gusset key={`${dx}${s}`} x={x + dx} y={y0} zFace={RIG_Z + s * flange} zOut={RIG_Z + s * 0.4} h={0.3} />),
      )}
      {/* Taladros de reglaje en el ala delantera (el dintel se puede bajar de 150 en 150 mm). */}
      {holes.flatMap((y) =>
        [-0.08, 0.08].map((dx) => (
          <Cyl key={`${y}${dx}`} p={[x + dx, y, RIG_Z + flange + 0.001]} radius={0.017} length={0.003} axis="z" segments={12} c={c.stripeBlack} />
        )),
      )}
      <Block min={[x - 0.2, top, RIG_Z - 0.24]} max={[x + 0.2, top + cap, RIG_Z + 0.24]} c={c.metalDark} />
    </group>
  );
}

/** Orejeta de izado sobre el ala superior: chapa con su grillete amarillo. */
function LiftingLug({ x }: { x: number }) {
  const y = BEAM.y1;
  const outline = roundCorners(
    [
      [x - 0.07, y],
      [x + 0.07, y],
      [x + 0.07, y + 0.08],
      [x - 0.07, y + 0.08],
    ],
    [0, 0, 0.06, 0.06],
    4,
  );
  return (
    <group>
      <Prism outline={outline} plane="xy" from={RIG_Z - 0.012} depth={0.024} c={c.green} />
      <Cyl p={[x, y + 0.055, RIG_Z]} radius={0.016} length={0.05} axis="z" c={c.metalMid} />
      <Ring p={[x, y + 0.1, RIG_Z]} radius={0.036} tube={0.009} axis="x" c={c.signalYellow} />
    </group>
  );
}

/** Abrazadera de los latiguillos sobre el ala superior: pletina con dos tornillos. */
function HoseClip({ x }: { x: number }) {
  const [za, zb] = [Math.max(...HOSE.zs) + 0.04, Math.min(...HOSE.zs) - 0.04];
  return (
    <group>
      <Block min={[x - 0.022, HOSE.y + HOSE.r, zb]} max={[x + 0.022, HOSE.y + HOSE.r + 0.012, za]} c={c.metalMid} />
      {[za - 0.012, zb + 0.012].map((z) => (
        <Block key={z} min={[x - 0.022, BEAM.y1, z - 0.012]} max={[x + 0.022, HOSE.y + HOSE.r, z + 0.012]} c={c.metalMid} />
      ))}
      {[za + 0.012, zb - 0.012].map((z) => (
        <Bolt key={z} p={[x, BEAM.y1, z]} r={0.011} h={0.01} />
      ))}
    </group>
  );
}

/**
 * Dintel en I: alas, alma, placas de testa, rigidizadores (pareja sobre cada pilar y bajo el
 * actuador), espárragos pasantes del actuador con sus tuercas, placa adaptadora, orejetas de izado
 * y abrazaderas de los latiguillos.
 */
export function Crossbeam() {
  const g = c.green;
  const { x0, x1, y0, y1, half, tf, web } = BEAM;
  const stiffeners = [-2.38, -2.12, -1.4, -0.7, -0.2, 0.2, 0.7, 1.4, 2.12, 2.38];
  return (
    <group>
      <Block min={[x0, y0, RIG_Z - half]} max={[x1, y0 + tf, RIG_Z + half]} c={g} />
      <Block min={[x0, y1 - tf, RIG_Z - half]} max={[x1, y1, RIG_Z + half]} c={g} />
      <Block min={[x0, y0 + tf, RIG_Z - web]} max={[x1, y1 - tf, RIG_Z + web]} c={g} />
      {[x0 - 0.02, x1].map((x) => (
        <Block key={x} min={[x, y0, RIG_Z - half]} max={[x + 0.02, y1, RIG_Z + half]} c={g} />
      ))}
      {stiffeners.map((x) => (
        <Block key={x} min={[x - 0.011, y0 + tf, RIG_Z - half + 0.012]} max={[x + 0.011, y1 - tf, RIG_Z + half - 0.012]} c={g} />
      ))}
      {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => <Bolt key={`${sx}${sz}`} p={[sx * 0.15, y1, RIG_Z + sz * 0.16]} r={0.022} h={0.02} />))}
      {[-1.05, 1.05].map((x) => (
        <LiftingLug key={x} x={x} />
      ))}
      {[2.3, 1.6, 0.85].map((x) => (
        <HoseClip key={x} x={x} />
      ))}
      <ActuatorMount />
    </group>
  );
}

/** Placa adaptadora del actuador bajo el dintel (va con el dintel: el actuador se desatornilla de ella). */
function ActuatorMount() {
  return <Cyl p={[0, (ACT.mount.y0 + BEAM.y0) / 2, RIG_Z]} radius={ACT.mount.r} length={BEAM.y0 - ACT.mount.y0} segments={28} c={c.metalDark} />;
}
