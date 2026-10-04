'use client';

import { useMemo } from 'react';
import * as THREE from 'three';
import { BUILDING, DOOR, MARKINGS } from '@/config/layout';
import { palette } from '@/config/palette';
import { STATIONS } from '@/config/stations';
import { DECAL_LAYER, flat } from '../materials';
import { RegistrationMark } from '../kit/RegistrationMark';
import { SceneText } from '../kit/SceneText';

const PAINT_Y = 0.004;
/** Las cruces se dibujan en el plano del papel: se elevan para que el brazo inferior no se hunda en el suelo. */
const MARK_LIFT = 0.13;

type Rect = { x0: number; x1: number; z0: number; z1: number };

function rectsToGeometry(rects: Rect[]) {
  const pos: number[] = [];
  for (const { x0, x1, z0, z1 } of rects) {
    const quad = [
      [x0, z0],
      [x1, z0],
      [x1, z1],
      [x0, z1],
    ];
    for (const k of [0, 2, 1, 0, 3, 2]) pos.push(quad[k][0], PAINT_Y, quad[k][1]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return g;
}

/** Tramo discontinuo de pasillo a lo largo de X. */
function dashes(z: number, from: number, to: number): Rect[] {
  const w = MARKINGS.lineWidth / 2;
  const out: Rect[] = [];
  for (let x = from; x < to; x += MARKINGS.dash + MARKINGS.gap) {
    out.push({ x0: x, x1: Math.min(x + MARKINGS.dash, to), z0: z - w, z1: z + w });
  }
  return out;
}

function paintRects(): Rect[] {
  const rects: Rect[] = [];
  const w = MARKINGS.lineWidth / 2;
  const cw = MARKINGS.crossbarWidth / 2;
  const nz = MARKINGS.aisleNearZ;

  // Pasillo delantero: continuo antes del primer tramo y en la mitad final de cada año, discontinuo en el resto.
  const years = MARKINGS.yearStartsX;
  rects.push({ x0: MARKINGS.aisleStartX, x1: years[0], z0: nz - w, z1: nz + w });
  for (let i = 0; i < years.length; i++) {
    const a = years[i];
    const b = years[i + 1] ?? MARKINGS.aisleEndX;
    const mid = a + (b - a) * 0.55;
    rects.push(...dashes(nz, a + 0.25, mid));
    rects.push({ x0: mid, x1: b, z0: nz - w, z1: nz + w });
  }

  // Travesaños al inicio de cada año, del pasillo hacia la cinta.
  for (const a of years) {
    rects.push({ x0: a - cw, x1: a + cw, z0: nz - MARKINGS.crossbarLength, z1: nz + w });
  }

  // Pasillo trasero, continuo, a partir de la puerta.
  const fz = MARKINGS.aisleFarZ;
  rects.push({ x0: DOOR.x1 + 2.6, x1: MARKINGS.aisleEndX, z0: fz - w, z1: fz + w });
  rects.push({ x0: BUILDING.startX, x1: DOOR.x0 - 1.8, z0: fz - w, z1: fz + w });
  return rects;
}

/** Pintura amarilla de suelo, gastada: pasillos, travesaños y años en stencil. */
export function FloorMarkings() {
  const paint = useMemo(() => rectsToGeometry(paintRects()), []);
  return (
    <group>
      <mesh geometry={paint} material={flat(palette.floorPaint)} layers={DECAL_LAYER} />
      {MARKINGS.yearStartsX.map((x0, i) => (
        <SceneText
          key={x0}
          fontSize={MARKINGS.yearSize}
          position={[x0 + MARKINGS.yearOffsetX, PAINT_Y, MARKINGS.yearZ]}
          rotation={[-Math.PI / 2, 0, 0]}
          anchorX="left"
          anchorY="middle"
          letterSpacing={0.04}
          color={palette.floorPaint}
          layers={DECAL_LAYER}
        >
          {STATIONS[i]?.year}
        </SceneText>
      ))}
      {/* Cruces de registro en el suelo. */}
      {[
        [-5.2, 5.4],
        [4.2, -1.8],
        [8.1, 5.6],
        [14.8, -2.6],
        [18.9, 5.2],
        [24.6, -2.3],
        [28.9, 5.8],
        [34.9, -2.8],
        [37.4, 3.4],
        [44.6, -2.6],
        [47.1, 4.6],
      ].map(([x, z]) => (
        <RegistrationMark key={`${x}|${z}`} position={[x, MARK_LIFT, z]} />
      ))}
    </group>
  );
}
