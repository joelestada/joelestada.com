'use client';

import type { RefObject } from 'react';
import type * as THREE from 'three';
import { CARTON_COLORS, HINGE, cartonGeometries, cartonPrintMaterial, panelFrame, printLift } from '../../line/carton';
import { DECAL_LAYER, toon } from '../../materials';

/** Piezas de una caja que se mueven: paredes, bisagras de las solapas y rótulo. */
type CartonParts = {
  panels: (THREE.Group | null)[];
  walls: (THREE.Object3D | null)[];
  body: THREE.Mesh | null;
  top: (THREE.Group | null)[];
  bottom: (THREE.Group | null)[];
  print: THREE.Mesh | null;
  /** Apertura dibujada (para no recolocar las paredes si no cambia). */
  alpha: number;
};

export const emptyCarton = (): CartonParts => ({
  panels: [],
  walls: [],
  body: null,
  top: [],
  bottom: [],
  print: null,
  alpha: NaN,
});

/**
 * Coloca la caja: apertura de las paredes (de plancha plegada a caja cuadrada) y giro de las
 * solapas de arriba y del fondo (positivo hacia dentro). Con la caja cuadrada se ve el cuerpo de una
 * pieza (el mismo que lleva la cinta) en vez de las cuatro paredes sueltas.
 */
export function poseCarton(c: CartonParts, alpha: number, top: [minor: number, major: number], bottom: [minor: number, major: number]) {
  if (alpha !== c.alpha) {
    c.alpha = alpha;
    const formed = alpha >= Math.PI / 2 - 1e-6;
    if (c.body) c.body.visible = formed;
    c.panels.forEach((g, i) => {
      if (!g) return;
      const { p, ry } = panelFrame(i as 0 | 1 | 2 | 3, alpha);
      g.position.set(p[0], p[1], p[2]);
      g.rotation.y = ry;
    });
    c.walls.forEach((w) => w && (w.visible = !formed));
    if (c.print) c.print.position.z = printLift(alpha);
  }
  c.top.forEach((g, i) => g && (g.rotation.x = -(i % 2 === 0 ? top[1] : top[0])));
  c.bottom.forEach((g, i) => g && (g.rotation.x = i % 2 === 0 ? bottom[1] : bottom[0]));
}

/**
 * Caja de cartón animable, en su marco (ver line/carton): cuatro paredes con sus solapas de arriba y
 * del fondo, el cuerpo ya formado y el rótulo.
 */
export function Carton({ parts }: { parts: RefObject<CartonParts> }) {
  const g = cartonGeometries();
  const kraft = toon(CARTON_COLORS.kraft);
  const set =
    <K extends 'panels' | 'walls' | 'top' | 'bottom'>(key: K, i: number) =>
    (o: CartonParts[K][number]) => {
      parts.current[key][i] = o as never;
    };
  return (
    <group>
      <mesh
        ref={(m) => {
          parts.current.body = m;
        }}
        geometry={g.body}
        material={kraft}
      />
      {([0, 1, 2, 3] as const).map((i) => {
        const long = i % 2 === 0;
        const { p, ry } = panelFrame(i, Math.PI / 2);
        return (
          <group key={i} ref={set('panels', i)} position={p} rotation={[0, ry, 0]}>
            <group ref={set('walls', i)} visible={false}>
              <mesh geometry={long ? g.wallLong : g.wallShort} material={kraft} />
              {long && <mesh geometry={g.creases} material={kraft} />}
            </group>
            <group ref={set('top', i)} position={long ? HINGE.topMajor : HINGE.topMinor}>
              <mesh geometry={long ? g.topMajor : g.topMinor} material={kraft} />
            </group>
            <group ref={set('bottom', i)} position={long ? HINGE.bottomMajor : HINGE.bottomMinor}>
              <mesh geometry={long ? g.bottomMajor : g.bottomMinor} material={kraft} />
            </group>
          </group>
        );
      })}
      <mesh
        ref={(m) => {
          parts.current.print = m;
        }}
        geometry={g.print}
        material={cartonPrintMaterial()}
        layers={DECAL_LAYER}
      />
    </group>
  );
}
