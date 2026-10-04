'use client';

import { useMemo } from 'react';
import { palette } from '@/config/palette';
import { beltLoop, roundCorners, type Pt } from '../../kit/geometry';
import { Bar, Block, Bolt, BoltCircle, Cyl, Gear, Lathe, Prism } from '../../kit/primitives';
import { BELT, BLOCK, CRANK_Y, PULLEYS, SHAFT, TIMING } from './dims';
import { LiftingEye } from './Top';

const c = palette;

/** Perfil de polea (radio, avance) con `n` gargantas en V a partir de `a0`. */
function grooves(r: number, a0: number, n: number, pitch: number, depth: number): Pt[] {
  return Array.from({ length: n }, (_, k) => [[r - depth, a0 + (k + 0.5) * pitch] as Pt, [r, a0 + (k + 1) * pitch] as Pt]).flat();
}

/** Tapa de distribución: encierra los engranajes; lleva el cuerpo de la bomba de agua y el cáncamo delantero. */
const TIMING_OUTLINE = roundCorners(
  [
    [-0.25, BLOCK.bottom],
    [0.25, BLOCK.bottom],
    [0.25, 1.08],
    [0.19, 1.14],
    [-0.19, 1.14],
    [-0.25, 1.08],
  ],
  0.03,
  3,
);

/** Junta perimetral de la cara interior: solo se ve al separar la tapa. */
const TIMING_GASKET = roundCorners(
  [
    [-0.232, BLOCK.bottom + 0.018],
    [0.232, BLOCK.bottom + 0.018],
    [0.232, 1.072],
    [0.182, 1.122],
    [-0.182, 1.122],
    [-0.232, 1.072],
  ],
  0.02,
  3,
);
const TIMING_GASKET_HOLE = roundCorners(
  [
    [-0.214, BLOCK.bottom + 0.036],
    [0.214, BLOCK.bottom + 0.036],
    [0.214, 1.064],
    [0.174, 1.104],
    [-0.174, 1.104],
    [-0.214, 1.064],
  ],
  0.015,
  3,
);

export function TimingCover() {
  return (
    <group>
      <Prism outline={TIMING_OUTLINE} plane="zy" from={TIMING.x0} depth={TIMING.x1 - TIMING.x0} c={c.metalLight} />
      <Prism outline={TIMING_GASKET} holes={[TIMING_GASKET_HOLE]} plane="zy" from={TIMING.x0 - 0.002} depth={0.002} c={c.stripeBlack} />
      {[PULLEYS.pump.y, CRANK_Y].map((y) => (
        <Cyl key={y} p={[TIMING.x0 - 0.001, y, 0]} radius={0.032} length={0.002} axis="x" c={c.stripeBlack} />
      ))}
      <Cyl p={[TIMING.x1 + 0.0075, PULLEYS.pump.y, 0]} radius={0.05} length={0.015} axis="x" c={c.metalMid} />
      <Cyl p={[TIMING.x1 + 0.005, CRANK_Y, 0]} radius={0.06} length={0.01} axis="x" c={c.metalMid} />
      <LiftingEye x={1.665} y={1.14} />
    </group>
  );
}

/** Damper del cigüeñal: polea de cuatro gargantas y anillo de inercia. */
const DAMPER: Pt[] = [
  [0, 0],
  [0.05, 0],
  [0.05, 0.012],
  [PULLEYS.crank.r, 0.012],
  ...grooves(PULLEYS.crank.r, 0.012, 4, 0.011, 0.008),
  [PULLEYS.crank.r, 0.06],
  [0.1, 0.06],
  [0.1, 0.066],
  [0.126, 0.066],
  [0.126, 0.098],
  [0.045, 0.098],
  [0.045, 0.108],
  [0, 0.108],
];

export function Damper() {
  return <Lathe p={[TIMING.x1 + 0.01, CRANK_Y, 0]} profile={DAMPER} axis="x" c={c.metalMid} segments={32} />;
}

const PUMP_PULLEY: Pt[] = [
  [0, 0],
  [0.028, 0],
  [0.028, 0.008],
  [PULLEYS.pump.r, 0.008],
  ...grooves(PULLEYS.pump.r, 0.008, 4, 0.011, 0.007),
  [PULLEYS.pump.r, 0.056],
  [0.024, 0.056],
  [0.024, 0.064],
  [0, 0.064],
];

const ALTERNATOR_PULLEY: Pt[] = [
  [0, 0],
  [PULLEYS.alternator.r, 0],
  ...grooves(PULLEYS.alternator.r, 0.004, 4, 0.011, 0.006),
  [PULLEYS.alternator.r, 0.052],
  [0.014, 0.052],
  [0.014, 0.064],
  [0, 0.064],
];

/** Accesorios: poleas de bomba y alternador, tensor y correa poly-V, más el cuerpo del alternador. */
export function AccessoryDrive() {
  const { pump, alternator: alt, idler, crank } = PULLEYS;
  const x0 = TIMING.x1 + 0.015;
  const belt = useMemo(() => {
    const loop = [crank, idler, alt, pump].map(({ y, z, r }) => ({ c: [z, y] as Pt, r }));
    return { outline: beltLoop(loop, BELT.thickness), hole: beltLoop(loop, 0) };
  }, [crank, idler, alt, pump]);
  return (
    <group>
      <Lathe p={[x0, pump.y, pump.z]} profile={PUMP_PULLEY} axis="x" c={c.metalLight} />
      {/* Alternador: carcasa con aros de refrigeración, tapa trasera, polea y escuadra. */}
      <Cyl p={[1.65, alt.y, alt.z]} radius={0.068} length={0.14} axis="x" c={c.metalLight} />
      {[1.6, 1.7].map((x) => (
        <Cyl key={x} p={[x, alt.y, alt.z]} radius={0.0705} length={0.01} axis="x" c={c.metalMid} />
      ))}
      <Cyl p={[1.572, alt.y, alt.z]} radius={0.056} length={0.016} axis="x" c={c.metalMid} />
      <Lathe p={[x0, alt.y, alt.z]} profile={ALTERNATOR_PULLEY} axis="x" c={c.metalMid} />
      <Block min={[1.6, alt.y - 0.09, BLOCK.zJacket]} max={[1.7, alt.y - 0.066, alt.z]} c={c.metalMid} />
      {/* Tensor: brazo con pivote y rodillo. */}
      <Cyl p={[x0 + 0.025, idler.y, idler.z]} radius={idler.r} length={0.05} axis="x" c={c.metalLight} />
      <Bolt p={[x0 + 0.05, idler.y, idler.z]} dir="x" r={0.013} h={0.01} />
      <Bar a={[x0 - 0.004, idler.y, idler.z]} b={[x0 - 0.004, 0.6, 0.11]} t={0.024} c={c.metalMid} />
      <Cyl p={[x0 - 0.004, 0.6, 0.11]} radius={0.02} length={0.024} axis="x" c={c.metalMid} />
      <Prism outline={belt.outline} holes={[belt.hole]} plane="zy" from={BELT.x0} depth={BELT.width} c={c.stripeBlack} />
    </group>
  );
}

/** Campana del volante (hueca) con su corona de tornillos en la brida trasera. */
const HOUSING: Pt[] = [
  [0.215, 0],
  [0.285, 0],
  [0.285, 0.025],
  [0.245, 0.19],
  [0.262, 0.19],
  [0.262, 0.23],
  [0.215, 0.23],
  [0.215, 0.002],
];

export function FlywheelHousing() {
  const back = BLOCK.x0 - 0.23;
  return (
    <group>
      <Lathe p={[BLOCK.x0, CRANK_Y, 0]} profile={HOUSING} axis="-x" c={c.metalLight} segments={40} />
      <BoltCircle p={[back, CRANK_Y, 0]} dir="-x" R={0.239} n={12} phase={Math.PI / 12} r={0.011} h={0.011} />
    </group>
  );
}

const FLYWHEEL: Pt[] = [
  [0, 0],
  [0.198, 0],
  [0.198, 0.07],
  [0.07, 0.07],
  [0.07, 0.085],
  [0, 0.085],
];

/** Volante con corona dentada de arranque y tornillos al cigüeñal. */
export function Flywheel() {
  return (
    <group>
      <Lathe p={[0.2, CRANK_Y, 0]} profile={FLYWHEEL} axis="-x" c={c.metalMid} segments={40} />
      <Gear p={[0, CRANK_Y, 0]} teeth={64} root={0.198} tip={0.209} from={0.15} depth={0.025} c={c.metalMid} />
      <BoltCircle p={[0.115, CRANK_Y, 0]} dir="-x" R={0.045} n={6} r={0.011} h={0.01} c={c.metalLight} />
    </group>
  );
}

/**
 * Junta universal centrada en `x` sobre el eje del cigüeñal. `s` = 1 si su brida queda hacia +X
 * (lado motor), -1 si hacia -X (lado freno). La horquilla de la brida sujeta la cruceta por Z; la del eje, por Y.
 */
function UJoint({ x, s }: { x: number; s: 1 | -1 }) {
  const y = CRANK_Y;
  const l = c.metalLight;
  const m = c.metalMid;
  const sorted = (a: number, b: number) => (a < b ? [a, b] : [b, a]);
  // Las orejas de cada horquilla pasan un poco más allá del centro de la cruceta.
  const [fa, fb] = sorted(x - s * 0.017, x + s * 0.046);
  const [ia, ib] = sorted(x - s * 0.046, x + s * 0.017);
  return (
    <group>
      <Cyl p={[x + s * 0.075, y, 0]} radius={0.083} length={0.025} axis="x" c={m} />
      <Cyl p={[x + s * 0.054, y, 0]} radius={0.052} length={0.017} axis="x" c={l} />
      {[-1, 1].map((k) => (
        <group key={k}>
          <Block min={[fa, y - 0.018, k * 0.044 - 0.009]} max={[fb, y + 0.018, k * 0.044 + 0.009]} c={l} />
          <Cyl p={[x, y, k * 0.048]} radius={0.017} length={0.018} axis="z" c={l} />
          <Block min={[ia, y + k * 0.044 - 0.009, -0.018]} max={[ib, y + k * 0.044 + 0.009, 0.018]} c={l} />
          <Cyl p={[x, y + k * 0.048, 0]} radius={0.017} length={0.018} c={l} />
        </group>
      ))}
      <Cyl p={[x, y, 0]} radius={0.009} length={0.083} axis="z" c={m} />
      <Cyl p={[x, y, 0]} radius={0.009} length={0.083} c={m} />
      <Block min={[x - 0.012, y - 0.012, -0.012]} max={[x + 0.012, y + 0.012, 0.012]} c={m} />
      <Cyl p={[x - s * 0.054, y, 0]} radius={0.043} length={0.017} axis="x" c={l} />
    </group>
  );
}

/**
 * Cardán entre la brida del volante y la del freno: dos juntas universales y eje con manguito
 * deslizante. Gira con el motor; la franja amarilla de equilibrado delata el giro.
 */
export function Cardan() {
  const e = SHAFT.engine - 0.0875;
  const d = SHAFT.dyno + 0.0875;
  const [x0, x1] = [d + 0.062, e - 0.062];
  const sleeve = x1 - 0.058;
  return (
    <group>
      <UJoint x={e} s={1} />
      <UJoint x={d} s={-1} />
      <BoltCircle p={[SHAFT.engine - 0.025, CRANK_Y, 0]} dir="-x" R={0.069} n={6} r={0.009} h={0.008} c={c.metalLight} />
      <Cyl p={[(sleeve + x1) / 2, CRANK_Y, 0]} radius={0.0375} length={x1 - sleeve} axis="x" c={c.metalLight} />
      <Cyl p={[(x0 + sleeve) / 2, CRANK_Y, 0]} radius={0.028} length={sleeve - x0} axis="x" c={c.metalLight} />
      <Block min={[x0 + 0.02, CRANK_Y + 0.026, -0.008]} max={[sleeve - 0.01, CRANK_Y + 0.032, 0.008]} c={c.signalYellow} />
    </group>
  );
}

/** Adaptador de acoplamiento entre el volante y el cardán del banco. */
export function Adapter() {
  return (
    <group>
      <Cyl p={[0.0825, CRANK_Y, 0]} radius={0.09} length={0.065} axis="x" c={c.metalMid} />
      <Cyl p={[0.0425, CRANK_Y, 0]} radius={0.03} length={0.015} axis="x" c={c.metalLight} />
      <BoltCircle p={[0.05, CRANK_Y, 0]} dir="-x" R={0.066} n={6} r={0.011} h={0.01} c={c.metalLight} />
    </group>
  );
}

/** Motor de arranque junto a la campana, con su solenoide encima. */
export function Starter() {
  const y = 0.26;
  const z = 0.31;
  return (
    <group>
      <Cyl p={[0.44, y, z]} radius={0.05} length={0.18} axis="x" c={c.metalMid} />
      <Cyl p={[0.345, y, z]} radius={0.036} length={0.03} axis="x" c={c.metalLight} />
      <Cyl p={[0.537, y, z]} radius={0.04} length={0.014} axis="x" c={c.metalLight} />
      <Cyl p={[0.46, y + 0.075, z]} radius={0.026} length={0.12} axis="x" c={c.metalLight} />
      <Bolt p={[0.505, y + 0.075, z + 0.026]} dir="z" r={0.01} h={0.01} />
    </group>
  );
}
