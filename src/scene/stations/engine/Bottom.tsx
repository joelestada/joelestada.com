'use client';

import { palette } from '@/config/palette';
import { arc, roundCorners, type Pt } from '../../kit/geometry';
import { Block, Bolt, Box, Cyl, Gear, Prism, useInkId } from '../../kit/primitives';
import { BLOCK, BORE_R, CRANK_Y, CYL_X, MAIN_X, MOUNT, THROW, THROW_DEG, TIMING } from './dims';

const c = palette;
const DEG = Math.PI / 180;

/** Enfriador de aceite en el lado +Z del cárter, bajo el turbo (el bajante de escape pasa por detrás). */
const OIL = { x0: 1.1, x1: 1.3, pad: 0.018, filtersX: [1.155, 1.245] };
const OIL_BOLTS: [number, number][] = [
  [OIL.x0 + 0.02, 0.4],
  [OIL.x1 - 0.02, 0.4],
  [OIL.x0 + 0.02, 0.52],
  [OIL.x1 - 0.02, 0.52],
];

/** Bloque de fundición: cárter y camisas con un solo ID de tinta, nervios en cada apoyo y tapones de agua. */
export function EngineBlock() {
  const id = useInkId();
  const { x0, x1, bottom, belt, deck, zCase, zJacket } = BLOCK;
  return (
    <group>
      <Block min={[x0, bottom, -zCase]} max={[x1, belt, zCase]} c={c.metalLight} id={id} />
      <Block min={[x0, belt, -zJacket]} max={[x1, deck, zJacket]} c={c.metalLight} id={id} />
      {MAIN_X.map((x) => (
        <Block key={x} min={[x - 0.012, bottom + 0.012, zCase]} max={[x + 0.012, belt - 0.006, zCase + 0.016]} c={c.metalLight} id={id} />
      ))}
      {[0.59, 0.99, 1.39].map((x) => (
        <Cyl key={x} p={[x, 0.7, zJacket + 0.004]} radius={0.03} length={0.008} axis="z" c={c.metalMid} />
      ))}
      {/* Asiento del enfriador de aceite: queda a la vista al soltarlo. */}
      <Block min={[OIL.x0 - 0.01, 0.37, zCase]} max={[OIL.x1 + 0.01, 0.55, zCase + OIL.pad]} c={c.metalLight} id={id} />
      {OIL_BOLTS.map(([x, y]) => (
        <Cyl key={`${x}${y}`} p={[x, y, zCase + OIL.pad]} radius={0.008} length={0.002} axis="z" c={c.stripeBlack} />
      ))}
      {/* Bocas de los cilindros: solo se ven al levantar la culata. */}
      {CYL_X.map((x) => (
        <Cyl key={x} p={[x, deck + 0.0015, 0]} radius={BORE_R} length={0.003} c={c.stripeBlack} />
      ))}
      {/* Varilla de nivel con su asa amarilla. */}
      <Cyl p={[0.36, 0.56, zCase + 0.016]} radius={0.009} length={0.42} c={c.metalMid} />
      <Block min={[0.34, 0.77, zCase + 0.006]} max={[0.38, 0.79, zCase + 0.026]} c={c.signalYellow} />
    </group>
  );
}

/** Pedestales atornillados a los largueros del bastidor: no se mueven en el despiece. */
export function MountPedestals() {
  const { xs, z, railTop, pedestalTop } = MOUNT;
  return (
    <group>
      {xs.flatMap((x) =>
        [-1, 1].map((s) => {
          const zc = s * z;
          return (
            <group key={`${x}${s}`}>
              <Block min={[x - 0.07, railTop, zc - 0.06]} max={[x + 0.07, railTop + 0.014, zc + 0.06]} c={c.metalMid} />
              <Block min={[x - 0.04, railTop + 0.014, zc - 0.04]} max={[x + 0.04, pedestalTop - 0.014, zc + 0.04]} c={c.metalLight} />
              <Block min={[x - 0.055, pedestalTop - 0.014, zc - 0.05]} max={[x + 0.055, pedestalTop, zc + 0.05]} c={c.metalMid} />
              {[-1, 1].map((k) => (
                <Bolt key={k} p={[x + k * 0.054, railTop + 0.014, zc]} r={0.011} h={0.01} />
              ))}
            </group>
          );
        }),
      )}
    </group>
  );
}

/** Tacos de goma entre pedestal y escuadra: suben a medias cuando el motor se eleva. */
export function MountIsolators() {
  const { xs, z, pedestalTop, isolatorTop } = MOUNT;
  const rubberTop = isolatorTop - 0.012;
  return (
    <group>
      {xs.flatMap((x) =>
        [-1, 1].map((s) => (
          <group key={`${x}${s}`}>
            <Cyl p={[x, (pedestalTop + rubberTop) / 2, s * z]} radius={0.04} length={rubberTop - pedestalTop} c={c.stripeBlack} />
            <Cyl p={[x, rubberTop + 0.006, s * z]} radius={0.046} length={0.012} c={c.metalMid} />
          </group>
        )),
      )}
    </group>
  );
}

/** Escuadras de soporte atornilladas al cárter: viajan con el bloque. */
export function MountBrackets() {
  const { xs, z, isolatorTop } = MOUNT;
  const { zCase } = BLOCK;
  return (
    <group>
      {xs.flatMap((x) =>
        [-1, 1].map((s) => {
          const arm = s > 0 ? [zCase, z + 0.055] : [-z - 0.055, -zCase];
          const plate = s > 0 ? [zCase, zCase + 0.022] : [-zCase - 0.022, -zCase];
          return (
            <group key={`${x}${s}`}>
              <Block min={[x - 0.05, isolatorTop, arm[0]]} max={[x + 0.05, isolatorTop + 0.036, arm[1]]} c={c.metalMid} />
              <Block min={[x - 0.05, isolatorTop + 0.036, plate[0]]} max={[x + 0.05, 0.43, plate[1]]} c={c.metalMid} />
              {[0.35, 0.4].map((y) => (
                <Bolt key={y} p={[x, y, s * (zCase + 0.022)]} dir={s > 0 ? 'z' : '-z'} r={0.011} h={0.01} />
              ))}
            </group>
          );
        }),
      )}
    </group>
  );
}

/** Cárter de aceite: bandeja poco profunda atrás y pozo delante, con brida, nervios y tapón de vaciado. */
const PAN_OUTLINE = roundCorners(
  [
    [0.38, 0.285],
    [1.6, 0.285],
    [1.6, 0.075],
    [1.55, 0.02],
    [1.03, 0.02],
    [0.95, 0.16],
    [0.44, 0.16],
    [0.38, 0.22],
  ],
  [0, 0, 0.02, 0.03, 0.03, 0.03, 0.03, 0.02],
  3,
);

export function OilPan() {
  return (
    <group>
      <Block min={[0.36, 0.285, -0.262]} max={[1.62, BLOCK.bottom, 0.262]} c={c.metalMid} />
      {/* Boca del cárter: solo se ve al bajarlo. */}
      <Block min={[0.4, BLOCK.bottom, -0.236]} max={[1.58, BLOCK.bottom + 0.001, 0.236]} c={c.stripeBlack} />
      <Prism outline={PAN_OUTLINE} plane="xy" from={-0.24} depth={0.48} c={c.metalMid} />
      {[0.07, 0.12].map((y) => (
        <Block key={y} min={[1.08, y, 0.24]} max={[1.5, y + 0.012, 0.252]} c={c.metalMid} />
      ))}
      <Bolt p={[1.3, 0.045, 0.24]} dir="z" r={0.016} h={0.012} c={c.metalLight} />
    </group>
  );
}

/** Enfriador de aceite atornillado al cárter y dos filtros colgados de su soporte. */
export function OilModule() {
  const z0 = BLOCK.zCase + OIL.pad;
  const { x0, x1 } = OIL;
  return (
    <group>
      <Block min={[x0, 0.38, z0]} max={[x1, 0.54, z0 + 0.032]} c={c.metalLight} />
      {OIL_BOLTS.map(([x, y]) => (
        <Bolt key={`${x}${y}`} p={[x, y, z0 + 0.032]} dir="z" r={0.01} h={0.01} />
      ))}
      <Block min={[x0 + 0.01, 0.33, z0]} max={[x1 - 0.01, 0.38, 0.4]} c={c.metalMid} />
      {OIL.filtersX.map((x) => (
        <group key={x}>
          <Cyl p={[x, 0.265, 0.345]} radius={0.04} length={0.13} c={c.green} />
          <Cyl p={[x, 0.206, 0.345]} radius={0.0405} length={0.012} c={c.metalMid} />
        </group>
      ))}
    </group>
  );
}

/** Contrapeso: medio disco opuesto a la muñequilla, en el plano (z, y) del eje. */
const COUNTERWEIGHT: Pt[] = [[0.1, 0.012], ...arc([0, 0], 0.1, 0, -Math.PI, 14), [-0.1, 0.012]];

/** Cigüeñal: siete apoyos, seis muñequillas a 120° con sus brazos y contrapesos, y el piñón de distribución. */
export function Crankshaft() {
  const id = useInkId();
  return (
    <group>
      <Cyl p={[0.32, CRANK_Y, 0]} radius={0.075} length={0.04} axis="x" c={c.metalMid} id={id} />
      {MAIN_X.map((x, i) => {
        // El primer apoyo se alarga hasta la brida trasera.
        const x0 = i === 0 ? 0.34 : x - 0.025;
        return <Cyl key={x} p={[(x0 + x + 0.025) / 2, CRANK_Y, 0]} radius={0.042} length={x + 0.025 - x0} axis="x" c={c.metalLight} id={id} />;
      })}
      {CYL_X.map((x, i) => {
        const a = THROW_DEG[i] * DEG;
        return (
          <group key={x}>
            <Cyl p={[x, CRANK_Y + THROW * Math.cos(a), THROW * Math.sin(a)]} radius={0.038} length={0.09} axis="x" c={c.metalLight} id={id} />
            {[-1, 1].map((s) => (
              <group key={s}>
                <Box p={[x + s * 0.06, CRANK_Y + 0.0075 * Math.cos(a), 0.0075 * Math.sin(a)]} s={[0.03, 0.215, 0.1]} r={[a, 0, 0]} c={c.metalMid} id={id} />
                <Prism outline={COUNTERWEIGHT} plane="zy" from={x + s * 0.06 - 0.015} depth={0.03} p={[0, CRANK_Y, 0]} r={[a, 0, 0]} c={c.metalMid} id={id} />
              </group>
            ))}
          </group>
        );
      })}
      <Cyl p={[1.64, CRANK_Y, 0]} radius={0.03} length={0.06} axis="x" c={c.metalLight} id={id} />
      <Gear p={[0, CRANK_Y, 0]} teeth={20} root={0.05} tip={0.058} from={TIMING.gearX} depth={TIMING.gearDepth} c={c.metalMid} />
    </group>
  );
}

const PISTON_TOP = 0.82;

/** Pistón con segmentos, bulón y biela con la tapa de cabeza marcada. */
export function PistonRod({ x }: { x: number }) {
  const t = PISTON_TOP;
  const pin = t - 0.075;
  return (
    <group>
      <Cyl p={[x, t - 0.05, 0]} radius={0.071} length={0.1} c={c.metalLight} />
      {[0.013, 0.027, 0.041].map((d) => (
        <Cyl key={d} p={[x, t - d, 0]} radius={0.0716} length={0.005} c={c.stripeBlack} />
      ))}
      <Cyl p={[x, t + 0.0015, 0]} radius={0.04} length={0.003} c={c.metalMid} />
      <Cyl p={[x, pin, 0]} radius={0.019} length={0.15} axis="z" c={c.metalMid} />
      <Block min={[x - 0.012, 0.5, -0.022]} max={[x + 0.012, pin, 0.022]} c={c.metalMid} />
      <Cyl p={[x, 0.5, 0]} radius={0.048} length={0.032} axis="x" c={c.metalMid} />
      <Block min={[x - 0.018, 0.4975, -0.05]} max={[x + 0.018, 0.5015, 0.05]} c={c.stripeBlack} />
    </group>
  );
}
