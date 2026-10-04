'use client';

import type { RefObject } from 'react';
import type * as THREE from 'three';
import { palette } from '@/config/palette';
import { CARTON } from '../../line/carton';
import { Block, Cyl, Merge } from '../../kit/primitives';
import { CUP, HEAD, HEAD_CHAIN } from './dims';

const c = palette;
const { L, W, T } = CARTON;

/** Dedos (solapas cortas) y palas (largas): holgura a la solapa, grueso, largo desde su eje y ancho. */
const FINGER = { gap: 0.002, t: 0.012, len: 0.17, half: 0.12 };
const PADDLE = { gap: 0.002, t: 0.012, len: 0.16, half: 0.27 };
/** Marco: cota del aro de arriba, travesaños de los cojinetes (a ±x) y patas en las esquinas. */
const RING = { y0: 0.4, y1: 0.44, x: 0.4, z: 0.32 };
const END_X = 0.335;
/** Guías del cabezal (suben por los casquillos del travesaño) y punto de enganche del vástago. */
const GUIDE = { len: 1.0, z: 0.2 };
export const ROD_TOP = RING.y1 + 0.07;

export type HeadParts = {
  plate: THREE.Group | null;
  fingers: (THREE.Group | null)[];
  paddles: (THREE.Group | null)[];
};

/**
 * Cabezal de recoger y cerrar (marco del cabezal: origen en la línea de pliegue de las solapas
 * cortas, en el centro de la caja). Un aro con cuatro patas unidas abajo por dos travesaños; en ellos,
 * los ejes de los dedos que pliegan las solapas cortas; delante y detrás, las palas de las largas. Sus
 * ejes coinciden con los pliegues de la caja: giran pegados a las solapas sin cruzarlas. Dentro,
 * la placa de ventosas sube y baja con su cilindro.
 */
export function Head({ parts }: { parts: RefObject<HeadParts> }) {
  const set = (key: 'fingers' | 'paddles', i: number) => (g: THREE.Group | null) => {
    parts.current[key][i] = g;
  };
  return (
    <group>
      <Merge>
        {/* Aro, yugo, enganche del vástago y guías. */}
        {[-1, 1].map((s) => (
          <group key={s}>
            <Block min={[-RING.x, RING.y0, s * RING.z - 0.02]} max={[RING.x, RING.y1, s * RING.z + 0.02]} c={c.metalMid} />
            <Block min={[s * RING.x - 0.02, RING.y0, -RING.z + 0.02]} max={[s * RING.x + 0.02, RING.y1, RING.z - 0.02]} c={c.metalMid} />
          </group>
        ))}
        <Block min={[-0.12, RING.y1, -0.26]} max={[0.12, RING.y1 + 0.03, 0.26]} c={c.metalMid} />
        <Block min={[-0.035, RING.y0, -RING.z]} max={[0.035, RING.y1, RING.z]} c={c.metalMid} />
        <Cyl p={[0, RING.y1 + 0.05, 0]} radius={0.045} length={0.04} c={c.metalMid} />
        {[-1, 1].map((s) => (
          <Cyl key={s} p={[0, RING.y1 + 0.03 + GUIDE.len / 2, s * GUIDE.z]} radius={0.02} length={GUIDE.len} c={c.metalLight} />
        ))}
        {/* Patas en las esquinas. */}
        {[-1, 1].flatMap((sx) =>
          [-1, 1].map((sz) => (
            <Block
              key={`${sx}${sz}`}
              min={[sx * 0.37 - 0.015, -0.02, sz * 0.29 - 0.015]}
              max={[sx * 0.37 + 0.015, RING.y0, sz * 0.29 + 0.015]}
              c={c.metalMid}
            />
          )),
        )}
        {/* Travesaños con los cojinetes de dedos y palas y sus actuadores giratorios. */}
        {[-1, 1].map((sx) => (
          <group key={sx}>
            <Block min={[sx * END_X - 0.008, 0.04, -0.29]} max={[sx * END_X + 0.008, 0.08, 0.29]} c={c.metalMid} />
            {[-1, 1].map((sz) => (
              <group key={sz}>
                <Block
                  min={[sx * END_X - 0.012, -0.02, sz * (FINGER.half + 0.02) - 0.012]}
                  max={[sx * END_X + 0.012, 0.06, sz * (FINGER.half + 0.02) + 0.012]}
                  c={c.metalMid}
                />
                <Cyl p={[sx * (END_X - 0.0095), 0, sz * (FINGER.half + 0.02)]} radius={0.008} length={0.019} axis="x" c={c.metalLight} />
                <Block min={[sx * END_X - 0.012, -0.01, sz * (W / 2) - 0.012]} max={[sx * END_X + 0.012, 0.06, sz * (W / 2) + 0.012]} c={c.metalMid} />
                <Cyl p={[sx * (END_X - 0.0125), T, sz * (W / 2)]} radius={0.008} length={0.025} axis="x" c={c.metalLight} />
              </group>
            ))}
            <Cyl p={[sx * (END_X + 0.03), 0.06, 0]} radius={0.028} length={0.05} axis="x" c={c.metalLight} />
            <Cyl p={[sx * (END_X + 0.065), 0.06, 0]} radius={0.02} length={0.03} axis="x" c={c.stripeBlack} />
          </group>
        ))}
        {/* Cilindro de la placa de ventosas, colgado del aro. */}
        <Cyl p={[0, (RING.y0 + 0.22) / 2, 0]} radius={0.04} length={RING.y0 - 0.22} c={c.metalLight} />
        {[-0.12, 0.12].map((z) => (
          <Cyl key={z} p={[0, RING.y0 - 0.03, z]} radius={0.022} length={0.06} c={c.metalMid} />
        ))}
        {/* Enganche de la cadena portacables, detrás del aro. */}
        <Block
          min={[HEAD_CHAIN.x - HEAD_CHAIN.w / 2 - 0.006, RING.y1, -RING.z - 0.02 - 0.05]}
          max={[HEAD_CHAIN.x + HEAD_CHAIN.w / 2 + 0.006, RING.y1 + 0.01, -RING.z - 0.02]}
          c={c.metalMid}
        />
      </Merge>
      {/* Placa de ventosas: baja a coger y sube para dejar plegar. */}
      <group
        ref={(g) => {
          parts.current.plate = g;
        }}
        userData={{ mergeBoundary: true }}
      >
        <Merge>
          <Block min={[-0.2, -0.04, -0.17]} max={[0.2, -0.015, 0.17]} c={c.metalMid} />
          <Cyl p={[0, -0.015 + 0.13, 0]} radius={0.016} length={0.26} c={c.metalLight} />
          {[-0.12, 0.12].map((z) => (
            <Cyl key={z} p={[0, -0.015 + 0.15, z]} radius={0.01} length={0.3} c={c.metalLight} />
          ))}
          {[-1, 1].flatMap((sx) =>
            [-1, 1].map((sz) => (
              <group key={`${sx}${sz}`}>
                <Cyl p={[sx * 0.1, -0.07, sz * 0.13]} radius={0.02} length={0.06} segments={12} c={c.stripeBlack} />
                <Cyl p={[sx * 0.1, -CUP + 0.01, sz * 0.13]} radius={0.028} length={0.02} topRatio={0.7} segments={14} c={c.stripeBlack} />
                <Cyl p={[sx * 0.1, -0.02, sz * 0.13]} radius={0.012} length={0.012} c={c.metalLight} />
              </group>
            )),
          )}
        </Merge>
      </group>
      {/* Dedos: pivotan sobre el pliegue de las solapas cortas (a ±x), por fuera de ellas. */}
      {[-1, 1].map((sx, i) => (
        <group key={sx} ref={set('fingers', i)} position={[sx * (L / 2 - T), 0, 0]}>
          <Merge>
            <Block
              min={[sx > 0 ? T + FINGER.gap : -T - FINGER.gap - FINGER.t, 0, -FINGER.half]}
              max={[sx > 0 ? T + FINGER.gap + FINGER.t : -T - FINGER.gap, FINGER.len, FINGER.half]}
              c={c.metalLight}
            />
            <Block
              min={[sx > 0 ? T + FINGER.gap + FINGER.t : -T - FINGER.gap - FINGER.t - 0.01, 0.02, -0.03]}
              max={[sx > 0 ? T + FINGER.gap + FINGER.t + 0.01 : -T - FINGER.gap - FINGER.t, FINGER.len - 0.02, 0.03]}
              c={c.metalMid}
            />
          </Merge>
        </group>
      ))}
      {/* Palas: pivotan sobre el pliegue de las solapas largas (a ±z), por fuera de ellas. */}
      {[-1, 1].map((sz, i) => (
        <group key={sz} ref={set('paddles', i)} position={[0, T, sz * (W / 2)]}>
          <Merge>
            <Block
              min={[-PADDLE.half, 0, sz > 0 ? T + PADDLE.gap : -T - PADDLE.gap - PADDLE.t]}
              max={[PADDLE.half, PADDLE.len, sz > 0 ? T + PADDLE.gap + PADDLE.t : -T - PADDLE.gap]}
              c={c.metalLight}
            />
            <Block
              min={[-PADDLE.half, PADDLE.len - 0.03, sz > 0 ? T + PADDLE.gap + PADDLE.t : -T - PADDLE.gap - PADDLE.t - 0.012]}
              max={[PADDLE.half, PADDLE.len, sz > 0 ? T + PADDLE.gap + PADDLE.t + 0.012 : -T - PADDLE.gap - PADDLE.t]}
              c={c.metalMid}
            />
          </Merge>
        </group>
      ))}
    </group>
  );
}

/** Coloca las piezas móviles del cabezal: placa de ventosas, dedos y palas (0 abiertos, 1 plegados). */
export function poseHead(h: HeadParts, plate: number, fingers: number, paddles: number) {
  if (h.plate) h.plate.position.y = plate * HEAD.stroke;
  h.fingers.forEach((g, i) => g && (g.rotation.z = (i === 0 ? -1 : 1) * fingers * (Math.PI / 2)));
  h.paddles.forEach((g, i) => g && (g.rotation.x = (i === 0 ? 1 : -1) * paddles * (Math.PI / 2)));
}
