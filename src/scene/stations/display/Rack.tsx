'use client';

import type * as THREE from 'three';
import type { Vec3 } from '@/config/layout';
import { palette } from '@/config/palette';
import { DECAL_LAYER } from '../../materials';
import { Block, Box, Cyl, Tube } from '../../kit/primitives';
import { PLATFORM, RACK, U } from './dims';

const c = palette;
const FLOOR = PLATFORM.h;
const TOP = FLOOR + RACK.h;
/** Hueco útil: del zócalo a la tapa (42U). */
const INNER_TOP = TOP - 0.06;
/** Frontales del equipo: ancho entre orejas y profundidad de la cara. */
const FACE = { x0: RACK.x0 + 0.045, x1: RACK.x1 - 0.045, z0: RACK.z1 - 0.02, z1: RACK.z1 - 0.008 };
/** Fondo de los servidores (lo que se ve al sacarlos). */
const SERVER_DEPTH = 0.55;

/**
 * Ocupación del rack de arriba abajo, en unidades: panel de parcheo, pasacables, switch, ciego,
 * nueve servidores de 2U, KVM, ciego, cabina de discos, ciego, dos módulos de baterías, SAI y ciego.
 */
const LAYOUT = [
  ['patch', 1],
  ['cable', 1],
  ['switch', 1],
  ['blank', 1],
  ...Array.from({ length: 9 }, () => ['server', 2] as const),
  ['kvm', 1],
  ['blank', 1],
  ['storage', 4],
  ['blank', 2],
  ['battery', 3],
  ['battery', 3],
  ['ups', 3],
  ['blank', 3],
] as const;
type Kind = (typeof LAYOUT)[number][0];

/** Cota inferior y altura de cada equipo, en el orden de LAYOUT. */
const SLOTS = (() => {
  let top = INNER_TOP;
  return LAYOUT.map(([kind, n]) => {
    const y = top - n * U;
    top = y;
    return { kind: kind as Kind, y, h: n * U };
  });
})();
const slotsOf = (kind: Kind) => SLOTS.filter((s) => s.kind === kind);

/** Cota inferior de cada servidor (de arriba abajo). */
export const SERVER_Y = slotsOf('server').map((s) => s.y);
const SERVER_H = 2 * U;
/** Caja de los pilotos de los servidores (para repintar solo eso). */
export const LED_BOX = { y0: Math.min(...SERVER_Y), y1: Math.max(...SERVER_Y) + SERVER_H };

/** Frontal genérico: chapa entre orejas, con sus asas. */
function Face({ y, h, color, handles = true }: { y: number; h: number; color: string; handles?: boolean }) {
  return (
    <group>
      <Block min={[FACE.x0, y + 0.0015, FACE.z0]} max={[FACE.x1, y + h - 0.0015, FACE.z1]} c={color} />
      {handles &&
        [FACE.x0 + 0.012, FACE.x1 - 0.024].map((x) => (
          <Block key={x} min={[x, y + 0.008, FACE.z1]} max={[x + 0.012, y + h - 0.008, FACE.z1 + 0.012]} c={c.metalMid} />
        ))}
    </group>
  );
}

/**
 * Servidor de 2U: frontal con ocho bahías de disco y rejilla, y el cuerpo detrás (se ve al sacarlo
 * del rack). Los dos pilotos los pone la estación con sus materiales.
 */
export function Server({ y, leds }: { y: number; leds: [THREE.Material, THREE.Material] }) {
  const h = SERVER_H;
  return (
    <group>
      <Block min={[FACE.x0 + 0.02, y + 0.006, FACE.z0 - SERVER_DEPTH]} max={[FACE.x1 - 0.02, y + h - 0.006, FACE.z0]} c={c.metalMid} />
      <Face y={y} h={h} color={c.metalDark} />
      {Array.from({ length: 8 }, (_, i) => {
        const x = FACE.x0 + 0.04 + (i % 4) * 0.068;
        const yy = y + (i < 4 ? 0.047 : 0.01);
        return <Block key={i} min={[x, yy, FACE.z1]} max={[x + 0.06, yy + 0.032, FACE.z1 + 0.003]} c={c.metalMid} />;
      })}
      {[0, 1, 2].map((k) => (
        <Block key={k} min={[FACE.x0 + 0.33, y + 0.022 + k * 0.016, FACE.z1]} max={[FACE.x1 - 0.1, y + 0.03 + k * 0.016, FACE.z1 + 0.002]} c={c.stripeBlack} />
      ))}
      {leds.map((m, k) => (
        <mesh key={k} position={[FACE.x1 - 0.06 - k * 0.036, y + 0.065, FACE.z1 + 0.004]} material={m} layers={DECAL_LAYER}>
          <boxGeometry args={[0.018, 0.018, 0.006]} />
        </mesh>
      ))}
    </group>
  );
}

/** Switch de red de 1U: frontal claro, dos filas de bocas y pilotos. */
export function NetworkSwitch() {
  const { y, h } = slotsOf('switch')[0];
  return (
    <group>
      <Block min={[FACE.x0 + 0.02, y + 0.004, FACE.z0 - 0.3]} max={[FACE.x1 - 0.02, y + h - 0.004, FACE.z0]} c={c.metalMid} />
      <Face y={y} h={h} color={c.metalLight} handles={false} />
      <Block min={[FACE.x0 + 0.04, y + 0.008, FACE.z1]} max={[FACE.x0 + 0.38, y + h - 0.008, FACE.z1 + 0.003]} c={c.stripeBlack} />
      {[0, 1, 2, 3].map((k) => (
        <Box key={k} p={[FACE.x0 + 0.43 + k * 0.022, y + h / 2, FACE.z1 + 0.002]} s={[0.01, 0.01, 0.004]} c={k < 3 ? c.andonGreen : c.metalMid} />
      ))}
    </group>
  );
}

/** SAI de 3U: frontal claro con su pantallita, botones y piloto. */
export function Ups() {
  const { y, h } = slotsOf('ups')[0];
  return (
    <group>
      <Block min={[FACE.x0 + 0.02, y + 0.006, FACE.z0 - 0.45]} max={[FACE.x1 - 0.02, y + h - 0.006, FACE.z0]} c={c.metalMid} />
      <Face y={y} h={h} color={c.metalLight} />
      <Block min={[FACE.x0 + 0.06, y + 0.05, FACE.z1]} max={[FACE.x0 + 0.18, y + 0.105, FACE.z1 + 0.003]} c={c.screen} />
      {[0, 1, 2].map((k) => (
        <Cyl key={k} p={[FACE.x0 + 0.22 + k * 0.03, y + 0.078, FACE.z1 + 0.004]} radius={0.009} length={0.008} axis="z" c={c.metalDark} />
      ))}
      <Box p={[FACE.x0 + 0.33, y + 0.078, FACE.z1 + 0.002]} s={[0.012, 0.012, 0.004]} c={c.andonGreen} />
      {[0, 1, 2, 3].map((k) => (
        <Block key={k} min={[FACE.x0 + 0.38, y + 0.03 + k * 0.018, FACE.z1]} max={[FACE.x1 - 0.05, y + 0.038 + k * 0.018, FACE.z1 + 0.002]} c={c.metalMid} />
      ))}
    </group>
  );
}

/** Latiguillo de red del panel de parcheo al switch: sale, baja por delante y vuelve a entrar. */
function patchCord(x0: number, y0: number, x1: number, y1: number, out: number): Vec3[] {
  return [
    [x0, y0, FACE.z1],
    [x0, y0, FACE.z1 + out],
    [x1, y1, FACE.z1 + out],
    [x1, y1, FACE.z1],
  ];
}

/**
 * Armario rack de 42U (fijo): cuerpo, montantes delanteros, zócalo, tapa con dos ventiladores y
 * todo lo que no sale en el despiece: parcheo con sus latiguillos, pasacables, KVM, cabina de
 * discos, baterías y paneles ciegos.
 */
export function RackFrame() {
  const { x0, x1, z0, z1 } = RACK;
  const patch = slotsOf('patch')[0];
  const sw = slotsOf('switch')[0];
  const cords: [number, number, string][] = [
    [0.05, 0.06, c.green],
    [0.09, 0.1, c.green],
    [0.13, 0.15, c.metalLight],
    [0.17, 0.19, c.metalLight],
    [0.25, 0.28, c.signalYellow],
    [0.3, 0.33, c.green],
  ];
  return (
    <group>
      <Block min={[x0, FLOOR, z0]} max={[x1, TOP, z1 - 0.04]} c={c.stripeBlack} />
      <Block min={[x0 + 0.02, FLOOR, z1 - 0.04]} max={[x1 - 0.02, FLOOR + 0.08, z1]} c={c.stripeBlack} />
      <Block min={[x0, INNER_TOP, z1 - 0.04]} max={[x1, TOP, z1]} c={c.stripeBlack} />
      {[x0, x1 - 0.02].map((x) => (
        <Block key={x} min={[x, FLOOR, z1 - 0.04]} max={[x + 0.02, TOP, z1]} c={c.stripeBlack} />
      ))}
      {[x0 + 0.02, x1 - 0.045].map((x) => (
        <Block key={x} min={[x, FLOOR + 0.08, z1 - 0.04]} max={[x + 0.025, INNER_TOP, z1 - 0.022]} c={c.metalDark} />
      ))}
      {/* Tapa con dos ventiladores y cerradura en el costado. */}
      {[z0 + 0.25, z1 - 0.3].map((z) => (
        <group key={z}>
          <Cyl p={[(x0 + x1) / 2, TOP + 0.002, z]} radius={0.1} length={0.004} segments={28} c={c.metalDark} />
          <Cyl p={[(x0 + x1) / 2, TOP + 0.004, z]} radius={0.03} length={0.004} segments={16} c={c.metalMid} />
          {[0, 1, 2, 3].map((k) => (
            <Box key={k} p={[(x0 + x1) / 2, TOP + 0.005, z]} s={[0.19, 0.002, 0.008]} r={[0, (k * Math.PI) / 4, 0]} c={c.metalMid} />
          ))}
        </group>
      ))}
      <Block min={[x0 - 0.004, 1.1, z1 - 0.18]} max={[x0, 1.22, z1 - 0.15]} c={c.metalMid} />
      {SLOTS.map(({ kind, y, h }, i) => {
        if (kind === 'blank') return <Face key={i} y={y} h={h} color={c.stripeBlack} handles={false} />;
        if (kind === 'patch')
          return (
            <group key={i}>
              <Face y={y} h={h} color={c.metalDark} handles={false} />
              {[0, 1].map((k) => (
                <Block
                  key={k}
                  min={[FACE.x0 + 0.03 + k * 0.25, y + 0.01, FACE.z1]}
                  max={[FACE.x0 + 0.24 + k * 0.25, y + h - 0.01, FACE.z1 + 0.002]}
                  c={c.stripeBlack}
                />
              ))}
            </group>
          );
        if (kind === 'cable')
          return (
            <group key={i}>
              <Face y={y} h={h} color={c.stripeBlack} handles={false} />
              <Block min={[FACE.x0 + 0.04, y + 0.016, FACE.z1]} max={[FACE.x1 - 0.04, y + h - 0.016, FACE.z1 + 0.002]} c={c.metalDark} />
            </group>
          );
        if (kind === 'kvm')
          return (
            <group key={i}>
              <Face y={y} h={h} color={c.metalDark} handles={false} />
              <Block min={[FACE.x0 + 0.18, y + 0.014, FACE.z1]} max={[FACE.x1 - 0.18, y + 0.026, FACE.z1 + 0.012]} c={c.metalMid} />
            </group>
          );
        if (kind === 'storage')
          return (
            <group key={i}>
              <Face y={y} h={h} color={c.metalDark} />
              {Array.from({ length: 12 }, (_, k) => {
                const x = FACE.x0 + 0.045 + (k % 4) * 0.115;
                const yy = y + 0.012 + Math.floor(k / 4) * 0.055;
                return (
                  <group key={k}>
                    <Block min={[x, yy, FACE.z1]} max={[x + 0.105, yy + 0.048, FACE.z1 + 0.003]} c={c.metalMid} />
                    <Box p={[x + 0.092, yy + 0.024, FACE.z1 + 0.004]} s={[0.008, 0.008, 0.003]} c={c.andonGreen} />
                  </group>
                );
              })}
            </group>
          );
        if (kind === 'battery')
          return (
            <group key={i}>
              <Face y={y} h={h} color={c.metalLight} />
              {[0, 1, 2, 3, 4].map((k) => (
                <Block
                  key={k}
                  min={[FACE.x0 + 0.06, y + 0.025 + k * 0.018, FACE.z1]}
                  max={[FACE.x1 - 0.12, y + 0.032 + k * 0.018, FACE.z1 + 0.002]}
                  c={c.metalMid}
                />
              ))}
              <Box p={[FACE.x1 - 0.07, y + h / 2, FACE.z1 + 0.002]} s={[0.01, 0.01, 0.004]} c={c.andonGreen} />
            </group>
          );
        return null;
      })}
      {cords.map(([a, b, color], i) => (
        <Tube
          key={i}
          points={patchCord(FACE.x0 + a, patch.y + patch.h / 2, FACE.x0 + b, sw.y + sw.h / 2, 0.025 + (i % 3) * 0.006)}
          radius={0.0045}
          bend={0.012}
          c={color}
        />
      ))}
    </group>
  );
}
