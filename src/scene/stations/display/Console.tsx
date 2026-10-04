'use client';

import { palette } from '@/config/palette';
import { roundCorners } from '../../kit/geometry';
import { Block, Box, Cyl, Prism, Ring } from '../../kit/primitives';
import { DESK, PLATFORM } from './dims';

const c = palette;
const FLOOR = PLATFORM.h;
const TOP_T = 0.035;
/** Buques de la consola: el operador se sienta entre los dos. */
const PEDESTALS = [
  [DESK.x0, -0.78],
  [0.78, DESK.x1],
];

/**
 * Consola de operador: tablero con el canto delantero redondeado, dos buques con puerta ventilada,
 * faldón y bandeja de cables al fondo; encima, teléfono, informe impreso y taza. Bajo el tablero,
 * el ordenador. El puesto (monitores, teclado) lo pone el operador.
 */
export function Console() {
  const { x0, x1, z0, z1, top } = DESK;
  const edge = roundCorners(
    [
      [z0, top - TOP_T],
      [z1, top - TOP_T],
      [z1, top],
      [z0, top],
    ],
    [0, 0.016, 0.016, 0],
    4,
  );
  return (
    <group>
      <Prism outline={edge} plane="zy" from={x0} depth={x1 - x0} c={c.metalLight} />
      {PEDESTALS.map(([a, b]) => (
        <group key={a}>
          <Block min={[a, FLOOR, z0]} max={[b, top - TOP_T, z1 - 0.04]} c={c.green} />
          <Block min={[a + 0.025, FLOOR + 0.06, z1 - 0.04]} max={[b - 0.025, top - TOP_T - 0.03, z1 - 0.03]} c={c.green} />
          <Box p={[a < 0 ? b - 0.06 : a + 0.06, top - 0.2, z1 - 0.02]} s={[0.018, 0.12, 0.02]} c={c.metalMid} />
          {[0, 1, 2, 3, 4].map((i) => (
            <Block key={i} min={[a + 0.09, FLOOR + 0.12 + i * 0.03, z1 - 0.031]} max={[b - 0.09, FLOOR + 0.132 + i * 0.03, z1 - 0.026]} c={c.metalDark} />
          ))}
        </group>
      ))}
      <Block min={[-0.78, FLOOR + 0.12, z0]} max={[0.78, top - TOP_T, z0 + 0.03]} c={c.green} />
      <Block min={[-0.72, 0.7, z0 + 0.03]} max={[0.72, 0.712, z0 + 0.15]} c={c.metalMid} />
      <Block min={[-0.72, 0.712, z0 + 0.142]} max={[0.72, 0.75, z0 + 0.15]} c={c.metalMid} />
      {/* Ordenador bajo el tablero, junto al buque derecho. */}
      <Block min={[0.52, FLOOR, -2.0]} max={[0.72, FLOOR + 0.44, -1.6]} c={c.stripeBlack} />
      <Block min={[0.54, FLOOR + 0.3, -1.6]} max={[0.7, FLOOR + 0.31, -1.596]} c={c.metalDark} />
      <Box p={[0.62, FLOOR + 0.39, -1.597]} s={[0.012, 0.012, 0.004]} c={c.andonGreen} />
      {/* Teléfono de mesa, informe impreso y taza. */}
      <group position={[-0.86, top, -1.84]} rotation={[0, 0.35, 0]}>
        <Block min={[-0.1, 0, -0.09]} max={[0.1, 0.035, 0.09]} c={c.stripeBlack} />
        <Box p={[-0.065, 0.05, 0]} s={[0.05, 0.03, 0.2]} c={c.stripeBlack} />
        <Block min={[0.0, 0.035, -0.06]} max={[0.08, 0.037, 0.0]} c={c.screen} />
      </group>
      <group position={[0.82, top, -1.7]} rotation={[0, -0.22, 0]}>
        <Block min={[-0.105, 0, -0.148]} max={[0.105, 0.006, 0.148]} c={c.floorLit} />
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Block key={i} min={[-0.08, 0.006, -0.11 + i * 0.035]} max={[i % 2 ? 0.02 : 0.07, 0.007, -0.1 + i * 0.035]} c={c.metalMid} />
        ))}
      </group>
      <Cyl p={[0.58, top + 0.045, -1.62]} radius={0.038} length={0.09} c={c.metalLight} />
      <Ring p={[0.625, top + 0.05, -1.62]} radius={0.022} tube={0.006} axis="z" c={c.metalLight} />
    </group>
  );
}

/**
 * Silla de oficina, de espaldas al espectador: base de cinco radios con ruedas, pistón con su
 * fuelle, asiento acolchado y respaldo de malla con su marco, algo reclinado.
 */
export function Chair() {
  const x = 0;
  const z = -1.2;
  const seat = { y0: FLOOR + 0.41, y1: FLOOR + 0.48 };
  const seatShape = roundCorners(
    [
      [-0.24, -0.23],
      [0.24, -0.23],
      [0.24, 0.23],
      [-0.24, 0.23],
    ],
    0.06,
    4,
  );
  const back = roundCorners(
    [
      [-0.22, 0],
      [0.22, 0],
      [0.23, 0.48],
      [-0.23, 0.48],
    ],
    [0.05, 0.05, 0.09, 0.09],
    4,
  );
  const mesh = roundCorners(
    [
      [-0.18, 0.04],
      [0.18, 0.04],
      [0.19, 0.44],
      [-0.19, 0.44],
    ],
    [0.03, 0.03, 0.07, 0.07],
    4,
  );
  return (
    <group position={[x, 0, z]}>
      {[0, 1, 2, 3, 4].map((k) => {
        const a = (k / 5) * Math.PI * 2 + 0.3;
        const [cx, cz] = [Math.cos(a), Math.sin(a)];
        return (
          <group key={k}>
            <Box p={[cx * 0.15, FLOOR + 0.065, cz * 0.15]} s={[0.3, 0.03, 0.045]} r={[0, -a, 0]} c={c.metalDark} />
            <Cyl p={[cx * 0.29, FLOOR + 0.026, cz * 0.29]} radius={0.026} length={0.03} axis="x" r={[0, -a + Math.PI / 2, Math.PI / 2]} c={c.stripeBlack} />
          </group>
        );
      })}
      <Cyl p={[0, FLOOR + 0.08, 0]} radius={0.05} length={0.04} c={c.metalDark} />
      <Cyl p={[0, FLOOR + 0.17, 0]} radius={0.034} length={0.15} c={c.stripeBlack} />
      <Cyl p={[0, FLOOR + 0.32, 0]} radius={0.024} length={0.16} c={c.metalMid} />
      <Block min={[-0.12, seat.y0 - 0.03, -0.12]} max={[0.12, seat.y0, 0.12]} c={c.metalDark} />
      <Prism outline={seatShape} plane="xz" from={seat.y0} depth={seat.y1 - seat.y0} c={c.stripeBlack} />
      {/* Respaldo: brazo desde el asiento, marco y malla. */}
      <Block min={[-0.035, seat.y0 - 0.02, 0.2]} max={[0.035, seat.y0 + 0.02, 0.27]} c={c.metalDark} />
      <Block min={[-0.035, seat.y0 - 0.02, 0.24]} max={[0.035, seat.y1 + 0.16, 0.27]} c={c.metalDark} />
      <group position={[0, seat.y1 + 0.06, 0.25]} rotation={[-0.1, 0, 0]}>
        <Prism outline={back} plane="xy" from={0} depth={0.03} c={c.stripeBlack} />
        <Prism outline={mesh} plane="xy" from={0.03} depth={0.004} c={c.metalDark} />
      </group>
    </group>
  );
}
