'use client';

import { useMemo, useRef, type ReactNode } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { Vec3 } from '@/config/layout';
import type { PartSpec } from '@/config/parts';
import type { StationId } from '@/config/stations';
import { explode, partProgress, registerPart, type Point } from '../explode';
import { Merge } from './primitives';
import { snapToPixels } from './regions';

const scratch = { w: new THREE.Vector3(), m: new THREE.Matrix3(), inv: new THREE.Matrix3() };

/** Copia un punto de three.js al registro del despiece (que no depende de three.js). */
export function copyPoint(out: Point, v: THREE.Vector3) {
  out.x = v.x;
  out.y = v.y;
  out.z = v.z;
}

/**
 * Desplazamiento `(x, y, z)` en el marco de `parent`, ajustado a la rejilla de píxeles en el mundo
 * (una pieza que se mueve rígida no hace temblar su trazo). Escribe en `out` (marco del padre).
 */
export function snappedOffset(out: THREE.Vector3, parent: THREE.Object3D, x: number, y: number, z: number, camera: THREE.Camera, pixelRatio: number) {
  parent.updateWorldMatrix(true, false);
  scratch.m.setFromMatrix4(parent.matrixWorld);
  scratch.inv.copy(scratch.m).invert();
  scratch.w.set(x, y, z).applyMatrix3(scratch.m);
  snapToPixels(scratch.w, camera as THREE.OrthographicCamera, pixelRatio);
  return out.copy(scratch.w.applyMatrix3(scratch.inv));
}

/**
 * Conjunto que se separa en la vista explosionada: se desplaza `to` (en el marco de su padre)
 * según su avance, a saltos de píxel entero (se mueve rígido y su trazo no tiembla). Fusiona sus
 * piezas como `Merge` y lleva los puntos de su globo y de su línea de despiece.
 * - `delay`: retraso propio (s), para piezas que salen en cascada (botellas, servidores).
 * - `callout={false}`: gemelo de otro conjunto con el mismo número de pieza (pilares, guías…).
 * - `merge={false}`: el contenido ya se dibuja a su manera (instancias, piezas animadas).
 */
export function Explode({
  station,
  part,
  to = part.to,
  delay = 0,
  callout = true,
  merge = true,
  children,
}: {
  station: StationId;
  part: PartSpec;
  to?: Vec3;
  delay?: number;
  callout?: boolean;
  merge?: boolean;
  children?: ReactNode;
}) {
  const ref = useRef<THREE.Group>(null);
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const entry = useMemo(() => (callout ? registerPart(station, part) : null), [station, part, callout]);
  const point = useMemo(() => new THREE.Vector3(), []);
  const shown = useRef(-1);

  useFrame(() => {
    const g = ref.current;
    const parent = g?.parent;
    if (!g || !parent) return;
    const k = to ? partProgress(station, part, delay) : 0;
    if (k !== shown.current) {
      shown.current = k;
      if (!to || k === 0) g.position.set(0, 0, 0);
      else snappedOffset(g.position, parent, to[0] * k, to[1] * k, to[2] * k, camera, gl.getPixelRatio());
    }
    // Globo y línea: el punto de la pieza en su sitio del conjunto y donde está ahora.
    if (entry && explode.station === station) {
      parent.updateWorldMatrix(true, false);
      entry.k = k;
      copyPoint(entry.home, parent.localToWorld(point.set(...part.at)));
      copyPoint(entry.now, parent.localToWorld(point.set(...part.at).add(g.position)));
    }
  });

  return (
    <group ref={ref} userData={{ mergeBoundary: true }}>
      {merge ? <Merge>{children}</Merge> : children}
    </group>
  );
}
