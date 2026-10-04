'use client';

import type { Vec3 } from '@/config/layout';
import { palette } from '@/config/palette';
import { arc, roundCorners, type Pt } from '../../kit/geometry';
import { Anchor } from '../../kit/hardware';
import { Block, BoltCircle, Cyl, Lathe, Prism, Tube } from '../../kit/primitives';

/**
 * Brazo de 6 ejes por eslabones, cada uno en el marco de su articulación (lo monta RoboticCell, que
 * lleva la cinemática). Fundiciones verdes con tapas y motores en gris, como un robot industrial.
 */

const c = palette;
const g = c.green;

/** Contorno de un eslabón: dos círculos (radios `r0` en el origen y `r1` a `len` sobre +Y) unidos por sus tangentes. */
function linkOutline(r0: number, r1: number, len: number, segments = 10): Pt[] {
  return [...arc([0, 0], r0, Math.PI, Math.PI * 2, segments), ...arc([0, len], r1, 0, Math.PI, segments)];
}

/** Rectángulo de esquinas redondeadas (contorno). */
function rounded(x0: number, y0: number, x1: number, y1: number, r: number): Pt[] {
  return roundCorners(
    [
      [x0, y0],
      [x1, y0],
      [x1, y1],
      [x0, y1],
    ],
    r,
    4,
  );
}

/** Abrazadera del mazo de cables. */
function Clip({ p }: { p: Vec3 }) {
  return <Block min={[p[0] - 0.02, p[1] - 0.02, p[2] - 0.045]} max={[p[0] + 0.02, p[1] + 0.02, p[2] + 0.045]} c={c.metalMid} />;
}

/** Perfil de la base fija (radio, altura). */
const BASE_PROFILE: Pt[] = [
  [0, 0.035],
  [0.37, 0.035],
  [0.37, 0.075],
  [0.33, 0.1],
  [0.3, 0.13],
  [0.29, 0.4],
  [0.27, 0.43],
  [0, 0.43],
];

/** Base fija del robot: placa anclada al suelo, carcasa torneada y caja de conectores (llega el cable del armario). */
export function RobotBase() {
  return (
    <group>
      <Block min={[-0.42, 0, -0.42]} max={[0.42, 0.035, 0.42]} c={c.metalDark} />
      {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => <Anchor key={`${sx}${sz}`} p={[sx * 0.35, 0.035, sz * 0.35]} r={0.024} />))}
      <Lathe p={[0, 0, 0]} profile={BASE_PROFILE} segments={32} c={g} />
      <Block min={[0.24, 0.11, 0.08]} max={[0.38, 0.3, 0.3]} c={c.metalMid} />
      {[0.15, 0.23].map((z) => (
        <Cyl key={z} p={[0.39, 0.2, z]} radius={0.026} length={0.03} axis="x" c={c.stripeBlack} />
      ))}
    </group>
  );
}

/** Mejilla de la torreta (perfil lateral, plano XY): sube del cuerpo al cubo del hombro. */
function cheekOutline(shoulderY: number): Pt[] {
  return [[-0.28, 0.56], [0.24, 0.56], [0.24, 0.66], ...arc([0, shoulderY], 0.2, -0.45, Math.PI + 0.55, 14), [-0.28, 0.72]];
}

/**
 * Torreta (eje 1, marco del giro): corona, cuerpo, horquilla de dos mejillas donde va el brazo,
 * motor del eje 1 detrás y reductor con el motor del eje 2 por fuera de la mejilla delantera.
 */
export function Turret({ shoulderY }: { shoulderY: number }) {
  const cheek = cheekOutline(shoulderY);
  return (
    <group>
      <Cyl p={[0, 0.45, 0]} radius={0.29} length={0.04} segments={32} c={c.metalMid} />
      <Cyl p={[0, 0.53, 0]} radius={0.28} length={0.12} segments={32} c={g} />
      {[
        [0.17, 0.12],
        [-0.29, 0.12],
      ].map(([z, t]) => (
        <Prism key={z} outline={cheek} plane="xy" from={z} depth={t} c={g} />
      ))}
      <Block min={[-0.28, 0.56, -0.17]} max={[-0.1, 0.7, 0.17]} c={g} />
      {/* Motor del eje 1, vertical por detrás. */}
      <Cyl p={[-0.35, 0.72, 0]} radius={0.075} length={0.22} c={c.metalMid} />
      <Cyl p={[-0.35, 0.845, 0]} radius={0.08} length={0.03} c={c.metalDark} />
      <Block min={[-0.45, 0.66, -0.03]} max={[-0.42, 0.72, 0.03]} c={c.stripeBlack} />
      {/* Reductor y motor del eje 2 (delante) y tapa del cubo (detrás). */}
      <Cyl p={[0, shoulderY, 0.315]} radius={0.16} length={0.05} axis="z" segments={28} c={c.metalMid} />
      <BoltCircle p={[0, shoulderY, 0.34]} dir="z" R={0.13} n={8} r={0.012} h={0.01} />
      <Cyl p={[0.03, shoulderY - 0.02, 0.42]} radius={0.085} length={0.16} axis="z" segments={20} c={c.metalMid} />
      <Cyl p={[0.03, shoulderY - 0.02, 0.51]} radius={0.09} length={0.02} axis="z" segments={20} c={c.metalDark} />
      <Cyl p={[0.03, shoulderY + 0.07, 0.46]} radius={0.022} length={0.05} c={c.stripeBlack} />
      <Cyl p={[0, shoulderY, -0.31]} radius={0.15} length={0.04} axis="z" segments={28} c={c.metalMid} />
    </group>
  );
}

/**
 * Brazo (eje 2, marco del hombro): fundición que se estrecha hacia el codo, con su rebaje lateral,
 * tapas de los cubos y el mazo de cables por la espalda con sus abrazaderas.
 */
export function UpperArm({ length }: { length: number }) {
  const body = linkOutline(0.16, 0.13, length);
  const pocket = rounded(-0.09, 0.22, 0.08, length - 0.2, 0.06);
  return (
    <group>
      <Prism outline={body} plane="xy" from={-0.15} depth={0.3} c={g} />
      {[0.15, -0.156].map((z) => (
        <Prism key={z} outline={pocket} plane="xy" from={z} depth={0.006} c={g} />
      ))}
      {[0.15, -0.162].map((z) => (
        <Cyl key={z} p={[0, 0, z + 0.006]} radius={0.11} length={0.012} axis="z" c={c.metalMid} />
      ))}
      <Tube
        points={[
          [-0.19, 0.08, 0.06],
          [-0.2, 0.45, 0.06],
          [-0.17, length - 0.12, 0.06],
        ]}
        radius={0.03}
        bend={0.2}
        c={c.stripeBlack}
      />
      {[0.25, 0.65].map((y) => (
        <Clip key={y} p={[-0.18, y, 0.06]} />
      ))}
    </group>
  );
}

/**
 * Codo y antebrazo (eje 3, marco del codo; el antebrazo va por +X): cubo con el motor del eje 3,
 * carcasa trasera con los motores de la muñeca, tubo del antebrazo (eje 4) y horquilla de la muñeca.
 * `wristX` es el eje 5.
 */
export function Forearm({ wristX }: { wristX: number }) {
  const rear = rounded(-0.44, -0.15, -0.02, 0.16, 0.07);
  const fork: Pt[] = [[wristX - 0.2, -0.1], [wristX, -0.1], ...arc([wristX, 0], 0.1, -Math.PI / 2, Math.PI / 2, 8), [wristX - 0.2, 0.1]];
  return (
    <group>
      <Cyl p={[0, 0, 0]} radius={0.15} length={0.3} axis="z" segments={28} c={g} />
      {[0.156, -0.156].map((z) => (
        <Cyl key={z} p={[0, 0, z]} radius={0.1} length={0.012} axis="z" c={c.metalMid} />
      ))}
      <Cyl p={[0.02, 0.02, 0.22]} radius={0.075} length={0.13} axis="z" segments={20} c={c.metalMid} />
      <Cyl p={[0.02, 0.02, 0.29]} radius={0.08} length={0.02} axis="z" segments={20} c={c.metalDark} />
      <Prism outline={rear} plane="xy" from={-0.15} depth={0.3} c={g} />
      {/* Motores de los ejes 4, 5 y 6, asomando por detrás. */}
      {[
        [0.065, 0.07],
        [-0.06, 0.07],
        [0.0, -0.07],
      ].map(([y, z]) => (
        <group key={`${y}${z}`}>
          <Cyl p={[-0.5, y, z]} radius={0.055} length={0.12} axis="x" segments={16} c={c.metalMid} />
          <Cyl p={[-0.565, y, z]} radius={0.058} length={0.012} axis="x" segments={16} c={c.metalDark} />
        </group>
      ))}
      <Cyl p={[0.18, 0, 0]} radius={0.13} length={0.26} axis="x" segments={28} c={g} />
      <Cyl p={[0.32, 0, 0]} radius={0.118} length={0.025} axis="x" segments={28} c={c.metalMid} />
      <Cyl p={[(0.33 + wristX - 0.18) / 2, 0, 0]} radius={0.105} length={wristX - 0.18 - 0.33} axis="x" segments={28} c={g} />
      {[
        [0.1, 0.04],
        [-0.14, 0.04],
      ].map(([z, t]) => (
        <Prism key={z} outline={fork} plane="xy" from={z} depth={t} c={g} />
      ))}
      <Tube
        points={[
          [-0.3, 0.19, -0.04],
          [0.2, 0.165, -0.04],
          [wristX - 0.35, 0.135, -0.04],
        ]}
        radius={0.024}
        bend={0.2}
        c={c.stripeBlack}
      />
      {[
        [0.5, 0.151],
        [0.85, 0.139],
      ].map(([x, y]) => (
        <Clip key={x} p={[x, y, -0.04]} />
      ))}
    </group>
  );
}

/** Muñeca (eje 5, marco de la muñeca; la herramienta por +X): cubo entre las horquillas y carcasa del eje 6. */
export function Wrist() {
  return (
    <group>
      <Cyl p={[0, 0, 0]} radius={0.088} length={0.19} axis="z" segments={24} c={g} />
      {[0.096, -0.096].map((z) => (
        <Cyl key={z} p={[0, 0, z]} radius={0.06} length={0.004} axis="z" c={c.metalMid} />
      ))}
      <Cyl p={[0.12, 0, 0]} radius={0.072} length={0.14} axis="x" segments={24} c={g} />
      <Cyl p={[0.19, 0, 0]} radius={0.068} length={0.01} axis="x" segments={24} c={c.metalMid} />
    </group>
  );
}

/**
 * Pinza (eje 6, marco de la brida): brida con sus tornillos, cuerpo neumático con racores, piloto y
 * detector, y guía de las mordazas. Las mordazas y la tapa que lleva van aparte.
 */
export function GripperBody({ root, reachY }: { root: number; reachY: number }) {
  return (
    <group>
      <Cyl p={[0.205, 0, 0]} radius={0.07} length={0.02} axis="x" segments={24} c={c.metalDark} />
      <BoltCircle p={[0.215, 0, 0]} dir="x" R={0.052} n={6} r={0.008} h={0.006} />
      <Block min={[0.215, -0.1, -0.08]} max={[root - 0.015, 0.1, 0.08]} c={c.metalLight} />
      <Block min={[0.225, -0.085, 0.08]} max={[root - 0.025, 0.085, 0.084]} c={c.metalLight} />
      {[-0.035, 0.035].map((y) => (
        <Cyl key={y} p={[0.235, y, 0.095]} radius={0.011} length={0.022} axis="z" segments={6} c={c.metalDark} />
      ))}
      <Cyl p={[0.265, 0.05, 0.088]} radius={0.012} length={0.012} axis="z" c={c.signalYellow} />
      <Cyl p={[root - 0.04, 0.115, 0]} radius={0.011} length={0.07} axis="x" c={c.metalMid} />
      <Block min={[root - 0.015, -reachY, -0.03]} max={[root, reachY, 0.03]} c={c.metalMid} />
    </group>
  );
}
