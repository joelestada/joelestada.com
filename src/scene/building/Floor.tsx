'use client';

import { useMemo } from 'react';
import * as THREE from 'three';
import { BUILDING } from '@/config/layout';
import { palette } from '@/config/palette';
import { DECAL_LAYER, toon } from '../materials';

const FLOOR_MIN_X = -45;
const FLOOR_MAX_X = 70;
const FLOOR_MIN_Z = BUILDING.backWallZ - 5;
const FLOOR_MAX_Z = 45;
/** Juntas de losa: retícula fina de la solera, como en la referencia. */
const JOINT_SPACING_X = 6;
const JOINT_SPACING_Z = 5.2;
const JOINT_OPACITY = 0.2;

export function Floor() {
  const joints = useMemo(() => {
    const pts: number[] = [];
    const y = 0.002;
    for (let x = -30; x <= BUILDING.endWallX; x += JOINT_SPACING_X) {
      pts.push(x + 1.4, y, BUILDING.backWallZ, x + 1.4, y, FLOOR_MAX_Z);
    }
    for (let z = BUILDING.backWallZ + 1.7; z <= FLOOR_MAX_Z; z += JOINT_SPACING_Z) {
      pts.push(BUILDING.startX, y, z, BUILDING.endWallX, y, z);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, []);

  const jointMaterial = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: palette.ink,
        transparent: true,
        opacity: JOINT_OPACITY,
        depthWrite: false,
      }),
    [],
  );

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[(FLOOR_MIN_X + FLOOR_MAX_X) / 2, 0, (FLOOR_MIN_Z + FLOOR_MAX_Z) / 2]} material={toon(palette.floor)}>
        <planeGeometry args={[FLOOR_MAX_X - FLOOR_MIN_X, FLOOR_MAX_Z - FLOOR_MIN_Z]} />
      </mesh>
      <lineSegments geometry={joints} material={jointMaterial} layers={DECAL_LAYER} />
    </group>
  );
}
