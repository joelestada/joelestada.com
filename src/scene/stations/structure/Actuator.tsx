'use client';

import { palette } from '@/config/palette';
import { roundCorners, type Pt } from '../../kit/geometry';
import { Block, Bolt, Cyl, Dome, Lathe, Prism, useInkId } from '../../kit/primitives';
import { ACT, LOAD_X, RIG_Z, TRAIN } from './dims';

const c = palette;
const Z = RIG_Z;

/** Contorno (x, y) de un rectángulo con dos esquinas redondeadas: arriba (`top`) o abajo. */
function lug(halfW: number, y0: number, y1: number, r: number, top: boolean): Pt[] {
  return roundCorners(
    [
      [-halfW, y0],
      [halfW, y0],
      [halfW, y1],
      [-halfW, y1],
    ],
    top ? [0, 0, r, r] : [r, r, 0, 0],
    5,
  );
}

/**
 * Horquilla: dos orejetas (caras ±Z) redondeadas por el lado del bulón y el bulón en Z con sus
 * cabezas. `y0`–`y1` es la altura de las orejetas; `round` dice qué extremo rodea el bulón.
 */
function Clevis({ y0, y1, pin, round, halfW = 0.07 }: { y0: number; y1: number; pin: number; round: 'top' | 'bottom'; halfW?: number }) {
  const outline = lug(halfW, y0, y1, halfW * 0.8, round === 'top');
  return (
    <group>
      {[-1, 1].map((s) => (
        <Prism key={s} outline={outline} plane="xy" from={Z + (s > 0 ? 0.05 : -0.075)} depth={0.025} c={c.metalMid} />
      ))}
      <Cyl p={[0, pin, Z]} radius={0.02} length={0.19} axis="z" c={c.metalLight} />
      {[-1, 1].map((s) => (
        <Cyl key={s} p={[0, pin, Z + s * 0.083]} radius={0.028} length={0.012} axis="z" segments={6} c={c.metalLight} />
      ))}
    </group>
  );
}

/** Culata cuadrada con las esquinas achaflanadas, de `y0` a `y1`. */
function EndCap({ y0, y1 }: { y0: number; y1: number }) {
  const h = ACT.topCap.half;
  const outline = roundCorners(
    [
      [-h, -h],
      [h, -h],
      [h, h],
      [-h, h],
    ],
    0.03,
    2,
  );
  return <Prism outline={outline} plane="xz" from={y0} depth={y1 - y0} p={[0, 0, Z]} c={c.metalMid} />;
}

/** Rótula superior: carcasa torneada atornillada a la placa adaptadora. Perfil (radio, altura). */
const SWIVEL: Pt[] = [
  [0, 0],
  [0.12, 0],
  [0.12, 0.018],
  [0.17, 0.022],
  [0.17, 0.045],
  [0.15, 0.06],
  [0, 0.06],
];

/**
 * Actuador servohidráulico de doble efecto: rótula y horquilla bajo la placa adaptadora, culatas
 * cuadradas unidas por cuatro tirantes, camisa, prensaestopas y bloque de distribución en el costado
 * con los dos acumuladores (presión y retorno). La servoválvula va aparte (sale en el despiece).
 */
export function ActuatorBody() {
  const tubeId = useInkId();
  const { topCap, tube, bottomCap, gland, manifold: m, tie } = ACT;
  const tubeH = topCap.y0 - tube.y0;
  return (
    <group>
      <Lathe p={[0, ACT.swivel.y0, Z]} profile={SWIVEL} segments={28} c={c.metalMid} />
      <Clevis y0={ACT.clevis.y0 + 0.02} y1={ACT.swivel.y0} pin={ACT.clevis.pin} round="bottom" />
      {/* Lengüeta de la culata superior, entre las orejetas. */}
      <Prism outline={lug(0.05, topCap.y1, 2.985, 0.045, true)} plane="xy" from={Z - 0.048} depth={0.096} c={c.metalMid} />
      <EndCap y0={topCap.y0} y1={topCap.y1} />
      <Cyl p={[0, tube.y0 + tubeH / 2, Z]} radius={tube.r} length={tubeH} segments={32} c={c.metalLight} id={tubeId} />
      {/* Aros de las juntas de la camisa en cada culata. */}
      {[tube.y0 + 0.012, topCap.y0 - 0.012].map((y) => (
        <Cyl key={y} p={[0, y, Z]} radius={tube.r + 0.006} length={0.024} segments={32} c={c.metalLight} />
      ))}
      <EndCap y0={bottomCap.y0} y1={bottomCap.y1} />
      <Cyl p={[0, (gland.y0 + bottomCap.y0) / 2, Z]} radius={gland.r} length={bottomCap.y0 - gland.y0} segments={24} c={c.metalDark} />
      <Cyl p={[0, gland.y0 - 0.004, Z]} radius={gland.r - 0.012} length={0.008} segments={24} c={c.stripeBlack} />
      {/* Tirantes con sus tuercas sobre la culata superior. */}
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <group key={`${sx}${sz}`}>
            <Cyl p={[sx * tie, tube.y0 + tubeH / 2, Z + sz * tie]} radius={0.013} length={tubeH} c={c.metalMid} />
            <Bolt p={[sx * tie, topCap.y1, Z + sz * tie]} r={0.021} h={0.02} />
            <Cyl p={[sx * tie, topCap.y1 + 0.026, Z + sz * tie]} radius={0.01} length={0.012} c={c.metalLight} />
          </group>
        )),
      )}
      {/* Bloque de distribución con sus tornillos y las tomas de presión y retorno. */}
      <Block min={[m.x0, m.y0, Z - m.z]} max={[m.x1, m.y1, Z + m.z]} c={c.metalMid} />
      {[-1, 1].flatMap((sz) =>
        [m.y0 + 0.025, m.y1 - 0.025].map((y) => <Bolt key={`${sz}${y}`} p={[m.x0, y, Z + sz * (m.z - 0.022)]} dir="-x" r={0.011} h={0.01} />),
      )}
      {ACT.portZs.map((dz) => (
        <Cyl key={dz} p={[ACT.portX, m.y1 + 0.016, Z + dz]} radius={0.026} length={0.032} segments={6} c={c.metalLight} />
      ))}
      {/* Acumuladores: botella con su abrazadera, válvula de carga y racor al bloque. */}
      {[-1, 1].map((s) => {
        const { x, z: dz } = ACT.accumulator;
        const z = Z + s * dz;
        return (
          <group key={s}>
            <Cyl p={[x, 2.47, z]} radius={0.05} length={0.22} c={c.green} />
            <Dome p={[x, 2.58, z]} radius={0.05} c={c.green} />
            <Cyl p={[x, 2.645, z]} radius={0.012} length={0.03} c={c.metalMid} />
            <Cyl p={[x, 2.5, z]} radius={0.054} length={0.022} c={c.metalMid} />
            <Cyl p={[x, 2.36, z]} radius={0.03} length={0.02} c={c.metalMid} />
            <Cyl p={[x, 2.4, Z + s * (m.z + (dz - m.z) / 2)]} radius={0.016} length={dz - m.z} axis="z" c={c.metalMid} />
          </group>
        );
      })}
    </group>
  );
}

/** Servoválvula de dos etapas en la cara del bloque: cuerpo, motor de par y conector con su cable. */
export function Servovalve() {
  const x = ACT.manifold.x0;
  return (
    <group>
      <Block min={[x - 0.055, 2.43, Z - 0.08]} max={[x, 2.56, Z + 0.08]} c={c.metalDark} />
      {[-1, 1].flatMap((sz) =>
        [2.445, 2.545].map((y) => <Bolt key={`${sz}${y}`} p={[x - 0.055, y, Z + sz * 0.066]} dir="-x" r={0.009} h={0.008} c={c.metalLight} />),
      )}
      <Cyl p={[x - 0.08, 2.495, Z - 0.02]} radius={0.046} length={0.05} axis="x" segments={24} c={c.metalMid} />
      <Cyl p={[x - 0.108, 2.495, Z - 0.02]} radius={0.034} length={0.006} axis="x" segments={24} c={c.metalLight} />
      <Cyl p={[x - 0.03, 2.495, Z + 0.098]} radius={0.02} length={0.036} axis="z" segments={12} c={c.stripeBlack} />
      <Cyl p={[x - 0.03, 2.495, Z + 0.125]} radius={0.011} length={0.02} axis="z" c={c.stripeBlack} />
    </group>
  );
}

/**
 * Vástago, tuerca de bloqueo, célula de carga (con su banda y conector) y lengüeta de la rótula
 * inferior: bajan con el tren de carga, y el vástago asoma más del prensaestopas cuanto más carga.
 */
export function LoadCell() {
  const { cell, nut } = TRAIN;
  const rodBottom = nut.y1;
  return (
    <group>
      <Cyl p={[0, (rodBottom + ACT.rod.top) / 2, Z]} radius={ACT.rod.r} length={ACT.rod.top - rodBottom} segments={24} c={c.metalLight} />
      <Cyl p={[0, cell.y1 + (nut.y1 - cell.y1) / 2, Z]} radius={0.07} length={nut.y1 - cell.y1} segments={6} c={c.metalMid} />
      <Cyl p={[0, (cell.y0 + cell.y1) / 2, Z]} radius={cell.r} length={cell.y1 - cell.y0} segments={32} c={c.metalLight} />
      <Cyl p={[0, (cell.y0 + cell.y1) / 2, Z]} radius={cell.r + 0.002} length={0.018} segments={32} c={c.metalDark} />
      <Cyl p={[0, (cell.y0 + cell.y1) / 2, Z + cell.r + 0.018]} radius={0.017} length={0.036} axis="z" segments={12} c={c.stripeBlack} />
      <Prism outline={lug(0.05, TRAIN.clevis.pin - 0.045, cell.y0, 0.045, false)} plane="xy" from={Z - 0.048} depth={0.096} c={c.metalMid} />
    </group>
  );
}

/**
 * Viga de reparto (HEB) con rigidizadores en el centro y en los puntos de carga, placa superior,
 * horquilla de la rótula inferior y asientos de los rodillos.
 */
export function Spreader() {
  const { spreader: s, topPlate, clevis, seat } = TRAIN;
  const g = c.metalMid;
  return (
    <group>
      <Block min={[-s.half, s.y0, Z - s.flange]} max={[s.half, s.y0 + s.tf, Z + s.flange]} c={g} />
      <Block min={[-s.half, s.y1 - s.tf, Z - s.flange]} max={[s.half, s.y1, Z + s.flange]} c={g} />
      <Block min={[-s.half, s.y0 + s.tf, Z - s.web / 2]} max={[s.half, s.y1 - s.tf, Z + s.web / 2]} c={g} />
      {[-s.half, s.half - 0.014].map((x) => (
        <Block key={x} min={[x, s.y0, Z - s.flange]} max={[x + 0.014, s.y1, Z + s.flange]} c={g} />
      ))}
      {[-LOAD_X, -0.06, 0.06, LOAD_X].map((x) => (
        <Block key={x} min={[x - 0.008, s.y0 + s.tf, Z - s.flange + 0.006]} max={[x + 0.008, s.y1 - s.tf, Z + s.flange - 0.006]} c={g} />
      ))}
      <Block min={[-0.12, s.y1, Z - 0.12]} max={[0.12, topPlate, Z + 0.12]} c={c.metalDark} />
      {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => <Bolt key={`${sx}${sz}`} p={[sx * 0.095, topPlate, Z + sz * 0.095]} r={0.012} h={0.01} />))}
      <Clevis y0={topPlate} y1={clevis.y1} pin={clevis.pin} round="top" halfW={0.065} />
      {[-LOAD_X, LOAD_X].map((x) => (
        <Block key={x} min={[x - 0.06, seat.y0, Z - 0.19]} max={[x + 0.06, seat.y1, Z + 0.19]} c={c.metalDark} />
      ))}
    </group>
  );
}

/** Rodillos de carga sobre sus chapas de reparto, en los nudos 2 y 4 del cordón superior. */
export function LoadRollers() {
  const { plate, roller } = TRAIN;
  return (
    <group>
      {[-LOAD_X, LOAD_X].map((x) => (
        <group key={x}>
          <Block min={[x - 0.07, plate.y0, Z - 0.2]} max={[x + 0.07, plate.y1, Z + 0.2]} c={c.metalDark} />
          <Cyl p={[x, plate.y1 + roller.r, Z]} radius={roller.r} length={0.42} axis="z" segments={20} c={c.metalLight} />
          {[-1, 1].map((s) => (
            <Cyl key={s} p={[x, plate.y1 + roller.r, Z + s * 0.214]} radius={0.016} length={0.008} axis="z" c={c.metalMid} />
          ))}
        </group>
      ))}
    </group>
  );
}
