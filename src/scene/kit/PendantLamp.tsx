'use client';

import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { LAMP, type Vec3 } from '@/config/layout';
import { palette } from '@/config/palette';
import { STATIONS, type StationId } from '@/config/stations';
import { runtime } from '@/lib/runtime';
import { boot } from '../boot';
import { Cyl } from './primitives';

const SHADE_H = 0.24;
const CABLE = 7;

/**
 * Lámpara industrial de campana esmaltada colgada sobre cada estación. `position` es el
 * centro de la boca. El haz lo pinta el pase de composición; aquí solo se enciende el aro.
 */
export function PendantLamp({ position, station }: { position: Vec3; station: StationId }) {
  const [x, y, z] = position;
  const r = LAMP.mouth;
  const rim = useMemo(() => new THREE.MeshBasicMaterial({ color: palette.metalMid }), []);
  const off = useMemo(() => new THREE.Color(palette.metalMid), []);
  const on = useMemo(() => new THREE.Color(palette.lampLight), []);
  const index = STATIONS.findIndex((s) => s.id === station);

  useFrame(() => {
    const level = Math.max(runtime.fx[station].level, 0.55 * runtime.night * boot.power[index], boot.lamps[index]);
    rim.color.lerpColors(off, on, level);
  });

  return (
    <group>
      <Cyl p={[x, y + CABLE / 2 + SHADE_H + 0.1, z]} radius={0.009} length={CABLE} c={palette.stripeBlack} />
      <Cyl p={[x, y + SHADE_H + 0.05, z]} radius={0.055} length={0.1} c={palette.metalDark} />
      <Cyl p={[x, y + SHADE_H / 2 + 0.012, z]} radius={r} topRatio={0.3} length={SHADE_H} c={palette.green} segments={28} />
      <mesh position={[x, y + 0.012, z]} scale={[r * 2 + 0.012, 0.024, r * 2 + 0.012]} material={rim}>
        <cylinderGeometry args={[0.5, 0.5, 1, 28, 1, true]} />
      </mesh>
    </group>
  );
}
