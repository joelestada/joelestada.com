'use client';

import { useMemo, type RefObject } from 'react';
import * as THREE from 'three';
import { palette } from '@/config/palette';
import { toon } from '../materials';
import { shared } from '../shared';
import { prismGeometry, type Pt } from './geometry';
import { nextInkId } from './primitives';

/**
 * Cadena portacables, en su marco: los dos tramos rectos a lo largo de +X, separados en Y por la
 * curva de 180°, y el ancho en Z. El tramo de abajo (Y = 0) sale del extremo fijo y no se mueve; el
 * de arriba (Y = 2r) va con el extremo móvil; la curva queda entre los dos, hacia +X, y avanza la
 * mitad que el extremo móvil. Para otra orientación, el marco se gira con un grupo.
 */
type ChainSpec = {
  /** X del extremo fijo. */
  fixed: number;
  /** Suma de los dos tramos rectos (la cadena menos la curva): fija dónde queda la curva. */
  runs: number;
  /** Radio de la curva (a la línea media), alto de los eslabones (en Y) y ancho (en Z). */
  r: number;
  h: number;
  w: number;
};

export type ChainParts = { lower: THREE.Mesh | null; upper: THREE.Mesh | null; bend: THREE.Mesh | null; at: number };

export const emptyChain = (): ChainParts => ({ lower: null, upper: null, bend: null, at: NaN });

/** X de la curva con el extremo móvil en `moving`. */
const chainBend = (s: ChainSpec, moving: number) => (s.fixed + moving + s.runs) / 2;

/** Tramo recto: caja unidad de X = 0 a X = 1 (se estira a su largo). */
const run = shared(new THREE.BoxGeometry(1, 1, 1).translate(0.5, 0, 0));

/** Curva: media corona de la cadena alrededor de (0, r), hacia +X, de abajo arriba. */
function bendGeometry(s: ChainSpec) {
  const n = 14;
  const outer: Pt[] = [];
  const inner: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const a = -Math.PI / 2 + (Math.PI * i) / n;
    outer.push([(s.r + s.h / 2) * Math.cos(a), s.r + (s.r + s.h / 2) * Math.sin(a)]);
    inner.push([(s.r - s.h / 2) * Math.cos(a), s.r + (s.r - s.h / 2) * Math.sin(a)]);
  }
  return prismGeometry([...outer, ...inner.reverse()], s.w, 'xy');
}

/** Coloca la cadena con el extremo móvil en `moving` (solo si ha cambiado). */
export function poseChain(c: ChainParts, s: ChainSpec, moving: number) {
  if (moving === c.at) return;
  c.at = moving;
  const b = chainBend(s, moving);
  const stretch = (m: THREE.Mesh | null, from: number) => {
    if (!m) return;
    const len = b - from;
    m.visible = len > 1e-4;
    m.position.x = from;
    m.scale.x = Math.max(len, 1e-4);
  };
  stretch(c.lower, s.fixed);
  stretch(c.upper, moving);
  if (c.bend) c.bend.position.x = b;
}

/**
 * La cadena (sin sus soportes): tramo fijo, tramo móvil y curva, con un solo ID de tinta para que
 * se lea como una pieza continua.
 */
export function DragChain({ spec, parts, c = palette.stripeBlack }: { spec: ChainSpec; parts: RefObject<ChainParts>; c?: string }) {
  const { r, h, w } = spec;
  const ink = useMemo(() => ({ inkId: nextInkId() }), []);
  return (
    <group>
      <mesh
        ref={(m) => {
          parts.current.lower = m;
        }}
        geometry={run}
        material={toon(c)}
        scale={[1, h, w]}
        userData={ink}
      />
      <mesh
        ref={(m) => {
          parts.current.upper = m;
        }}
        geometry={run}
        material={toon(c)}
        position={[0, 2 * r, 0]}
        scale={[1, h, w]}
        userData={ink}
      />
      <mesh
        ref={(m) => {
          parts.current.bend = m;
        }}
        geometry={bendGeometry(spec)}
        material={toon(c)}
        position={[0, 0, -w / 2]}
        userData={ink}
      />
    </group>
  );
}
