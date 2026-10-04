'use client';

import { useMemo } from 'react';
import * as THREE from 'three';
import type { Vec3 } from '@/config/layout';
import { palette } from '@/config/palette';
import { DECAL_LAYER } from '../materials';
import { ribbonGeometry, screenAxes } from './ribbons';
import { shared } from '../shared';

const ARM = 0.13;
/** ~0,8 px CSS a la escala de la escena. */
const STROKE = 0.0075;
const OPACITY = 0.8;

let cache: { geometry: THREE.BufferGeometry; material: THREE.MeshBasicMaterial } | null = null;

function getShared() {
  if (cache) return cache;
  const { right, up } = screenAxes();
  const r = right.clone().multiplyScalar(ARM);
  const u = up.clone().multiplyScalar(ARM);
  const gap = up.clone().multiplyScalar(STROKE / 2);
  const geometry = ribbonGeometry(
    [
      [r.clone().negate().toArray(), r.toArray()],
      [u.clone().negate().toArray(), gap.clone().negate().toArray()],
      [gap.toArray(), u.toArray()],
    ],
    STROKE,
  );
  const material = new THREE.MeshBasicMaterial({
    color: palette.ink,
    transparent: true,
    opacity: OPACITY,
    depthWrite: false,
  });
  cache = { geometry: shared(geometry), material: shared(material) };
  return cache;
}

/**
 * Cruz de registro "+" de lámina técnica. Anclada en 3D (se desplaza con la nave)
 * pero dibujada en el plano del papel, como las marcas de la referencia.
 */
export function RegistrationMark({ position }: { position: Vec3 }) {
  const { geometry, material } = useMemo(getShared, []);
  return <mesh position={position} geometry={geometry} material={material} layers={DECAL_LAYER} />;
}
