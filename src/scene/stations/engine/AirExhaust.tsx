'use client';

import { useMemo } from 'react';
import * as THREE from 'three';
import type { Vec3 } from '@/config/layout';
import { palette } from '@/config/palette';
import { keyedSweep, roundCorners, type Pt } from '../../kit/geometry';
import { Block, Bolt, Cyl, Lathe, Prism, Ring, Solid, Tube, useInkId } from '../../kit/primitives';
import { CHARGE, COMPRESSOR_OUTLET_Z, CYL_X, DOWNPIPE, HEAD, LOG, TURBINE_INLET_Z, TURBO, TURBO_FLANGE_Y } from './dims';

const c = palette;

/** Colector de escape de fundición: seis ramales con brida, tubo común en tres tramos y bajante al turbo. */
export function ExhaustManifold() {
  const id = useInkId();
  const { y, z, r, x0, x1 } = LOG;
  const face = HEAD.z + 0.018;
  return (
    <group>
      {CYL_X.map((x) => (
        <group key={x}>
          <Block min={[x - 0.05, 0.888, HEAD.z]} max={[x + 0.05, 0.962, face]} c={c.metalDark} id={id} />
          {[-1, 1].map((s) => (
            <Bolt key={s} p={[x + s * 0.035, y, face]} dir="z" r={0.0105} h={0.01} c={c.metalLight} />
          ))}
          <Cyl p={[x, y, (face + z) / 2]} radius={0.03} length={z - face} axis="z" c={c.metalDark} id={id} />
        </group>
      ))}
      <Cyl p={[(x0 + x1) / 2, y, z]} radius={r} length={x1 - x0} axis="x" c={c.metalDark} id={id} />
      {[0.79, 1.19].map((x) => (
        <Cyl key={x} p={[x, y, z]} radius={r + 0.006} length={0.03} axis="x" c={c.metalMid} />
      ))}
      <Cyl p={[TURBO.turbineX, (TURBO_FLANGE_Y + 0.012 + y) / 2, TURBINE_INLET_Z]} radius={0.042} length={y - TURBO_FLANGE_Y - 0.012} c={c.metalDark} id={id} />
      <Block
        min={[TURBO.turbineX - 0.055, TURBO_FLANGE_Y, TURBINE_INLET_Z - 0.055]}
        max={[TURBO.turbineX + 0.055, TURBO_FLANGE_Y + 0.012, TURBINE_INLET_Z + 0.055]}
        c={c.metalMid}
      />
      <Cyl p={[TURBO.turbineX, TURBO_FLANGE_Y - 0.001, TURBINE_INLET_Z]} radius={0.03} length={0.002} c={c.stripeBlack} />
    </group>
  );
}

/**
 * Caracol de turbo: espiral en el plano (y, z) alrededor del eje, que crece hasta `R1`
 * y termina en una boca recta hacia arriba (hasta la cota `legTo`).
 * `dir` = 1 gira en sentido +y→+z y acaba en el lado -z; `dir` = -1 al revés.
 */
function volute(x: number, dir: 1 | -1, R0: number, R1: number, r0: number, r1: number, legTo: number) {
  const end = dir > 0 ? Math.PI * 1.5 : Math.PI * 0.5;
  const sweep = Math.PI * 1.78;
  const pts: THREE.Vector3[] = [];
  const n = 40;
  for (let k = 0; k <= n; k++) {
    const f = k / n;
    const phi = end - dir * sweep * (1 - f);
    const R = R0 + (R1 - R0) * f;
    pts.push(new THREE.Vector3(x, TURBO.y + R * Math.cos(phi), TURBO.z + R * Math.sin(phi)));
  }
  const spiral = new THREE.CatmullRomCurve3(pts);
  const last = pts[n];
  const leg = new THREE.LineCurve3(last, new THREE.Vector3(x, legTo, last.z));
  const curve = new THREE.CurvePath<THREE.Vector3>();
  curve.add(spiral);
  curve.add(leg);
  const split = spiral.getLength() / curve.getLength();
  const radius = (t: number) => (t < split ? r0 + ((r1 - r0) * t) / split : r1);
  return { curve, radius };
}

/** Tobera de admisión: trompeta con labio enrollado, perfil (radio, avance). */
const BELL_MOUTH: Pt[] = [
  [0, 0],
  [0.04, 0],
  ...Array.from({ length: 7 }, (_, k) => {
    const a = ((k + 1) / 7) * (Math.PI / 2);
    return [0.08 - 0.04 * Math.cos(a), 0.04 * Math.sin(a)] as Pt;
  }),
  [0.086, 0.046],
  [0.086, 0.052],
  [0, 0.052],
];

/** Bajante de escape: codo desde la salida de la turbina, fuelle y brida sobre el bastidor. */
const DOWNPIPE_PATH: Vec3[] = [
  [TURBO.turbineX - 0.05, TURBO.y, TURBO.z],
  [DOWNPIPE.x, TURBO.y, TURBO.z],
  [DOWNPIPE.x, TURBO.y - 0.17, DOWNPIPE.z],
  [DOWNPIPE.x, DOWNPIPE.y, DOWNPIPE.z],
];

/** Turbocompresor: caracol de turbina y de compresor, cuerpo central, tobera, retorno de aceite y bajante. */
export function Turbo() {
  const turbineId = useInkId();
  const compressorId = useInkId();
  const { y, z, turbineX: xt, compressorX: xc } = TURBO;
  const turbine = useMemo(() => keyedSweep('turbine', () => volute(xt, 1, 0.05, 0.066, 0.016, 0.034, TURBO_FLANGE_Y)), [xt]);
  const compressor = useMemo(() => keyedSweep('compressor', () => volute(xc, -1, 0.052, 0.07, 0.016, 0.036, CHARGE.outletY)), [xc]);
  return (
    <group>
      {/* Turbina (fundición) con su salida axial hacia el volante. */}
      <Solid geometry={turbine} c={c.metalDark} id={turbineId} />
      <Cyl p={[xt, y, z]} radius={0.042} length={0.06} axis="x" c={c.metalDark} id={turbineId} />
      <Block min={[xt - 0.05, TURBO_FLANGE_Y - 0.012, TURBINE_INLET_Z - 0.05]} max={[xt + 0.05, TURBO_FLANGE_Y, TURBINE_INLET_Z + 0.05]} c={c.metalMid} />
      <Ring p={[xt - 0.045, y, z]} radius={0.037} tube={0.006} axis="x" c={c.metalLight} />
      <Tube points={DOWNPIPE_PATH} radius={0.034} bend={0.06} c={c.metalDark} />
      {[0.44, 0.4, 0.36, 0.32, 0.28].map((h) => (
        <Ring key={h} p={[DOWNPIPE.x, h, DOWNPIPE.z]} radius={0.037} tube={0.006} axis="y" c={c.metalMid} />
      ))}
      <Cyl p={[DOWNPIPE.x, DOWNPIPE.y + 0.006, DOWNPIPE.z]} radius={0.05} length={0.012} c={c.metalMid} />
      {/* Cuerpo central con abrazaderas en V. */}
      <Cyl p={[(xt + xc) / 2, y, z]} radius={0.03} length={xc - xt - 0.05} axis="x" c={c.metalLight} />
      <Ring p={[xt + 0.03, y, z]} radius={0.043} tube={0.006} axis="x" c={c.metalLight} />
      <Ring p={[xc - 0.03, y, z]} radius={0.047} tube={0.006} axis="x" c={c.metalLight} />
      {/* Compresor (aluminio) y tobera de admisión. */}
      <Solid geometry={compressor} c={c.metalLight} id={compressorId} />
      <Cyl p={[xc, y, z]} radius={0.046} length={0.06} axis="x" c={c.metalLight} id={compressorId} />
      <Cyl p={[xc + 0.05, y, z]} radius={0.04} length={0.04} axis="x" c={c.metalLight} />
      <Lathe p={[xc + 0.07, y, z]} profile={BELL_MOUTH} axis="x" c={c.metalLight} />
      {/* Retorno de aceite al cárter. */}
      <Tube
        points={[
          [(xt + xc) / 2, y - 0.03, z],
          [(xt + xc) / 2, 0.6, z],
          [(xt + xc) / 2, 0.54, 0.3],
          [(xt + xc) / 2, 0.52, 0.272],
        ]}
        radius={0.011}
        bend={0.05}
        c={c.metalMid}
      />
    </group>
  );
}

/** Manguito de goma con dos abrazaderas en un tramo vertical del tubo de carga. */
function Hose({ p }: { p: Vec3 }) {
  return (
    <group>
      <Cyl p={p} radius={CHARGE.r + 0.006} length={0.07} c={c.stripeBlack} />
      {[-0.024, 0.024].map((d) => (
        <Ring key={d} p={[p[0], p[1] + d, p[2]]} radius={CHARGE.r + 0.008} tube={0.004} axis="y" c={c.metalMid} />
      ))}
    </group>
  );
}

/** Tubo de aire de carga: sube del compresor, cruza en arco por encima de la tapa y baja a la admisión. */
export function ChargePipe() {
  const { x, r, top, intakeZ, intakeY, outletY } = CHARGE;
  const z0 = COMPRESSOR_OUTLET_Z;
  const points = useMemo<Vec3[]>(
    () => [
      [x, outletY, z0],
      [x, top, z0],
      [x, top, intakeZ],
      [x, intakeY, intakeZ],
    ],
    [x, outletY, z0, top, intakeZ, intakeY],
  );
  return (
    <group>
      <Tube points={points} radius={r} bend={0.13} c={c.metalLight} />
      <Hose p={[x, outletY + 0.035, z0]} />
      <Hose p={[x, intakeY + 0.045, intakeZ]} />
    </group>
  );
}

/** Colector de admisión en el lado -Z, con la boca de entrada del aire de carga. */
const PLENUM: Pt[] = roundCorners(
  [
    [-0.372, 0.87],
    [-0.262, 0.87],
    [-0.262, 1.0],
    [-0.372, 1.0],
  ],
  0.025,
  3,
);

export function IntakeManifold() {
  return (
    <group>
      <Prism outline={PLENUM} plane="zy" from={0.47} depth={1.04} c={c.metalLight} />
      {CYL_X.map((x) => (
        <Block key={x} min={[x - 0.036, 0.895, -0.262]} max={[x + 0.036, 0.955, -HEAD.z]} c={c.metalLight} />
      ))}
      <Cyl p={[CHARGE.x, 1.02, CHARGE.intakeZ]} radius={0.042} length={0.04} c={c.metalLight} />
    </group>
  );
}
