'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Vec3 } from '@/config/layout';
import { palette } from '@/config/palette';
import { markDirty, runtime } from '@/lib/runtime';
import { plantPowered } from '../boot';
import { dimmed, toon } from '../materials';
import { Cyl } from './primitives';
import { shared } from '../shared';

const SEGMENT_H = 0.085;
const SEGMENT_R = 0.052;
const RING_H = 0.012;
const POLE_R = 0.018;

export type AndonState = 'green' | 'amber' | 'red';
/** Sin tensión (durante el arranque, antes de que arranque la planta): las tres apagadas. */
type Shown = AndonState | 'off';
const ORDER: AndonState[] = ['green', 'amber', 'red'];
const COLOR: Record<AndonState, string> = { green: palette.andonGreen, amber: palette.andonAmber, red: palette.andonRed };

let segment: THREE.CylinderGeometry | null = null;

/**
 * Torre de luces andon: mástil + verde, ámbar y rojo, con aros y tapa. `position` es la base.
 * Con `signal`, solo se enciende la luz del estado real (la planta en marcha, en pausa…); sin él,
 * las tres quedan encendidas como antes. Las luces no se fusionan con la estación para poder cambiar.
 */
export function AndonTower({ position, pole = 0.28, signal }: { position: Vec3; pole?: number; signal?: () => AndonState }) {
  const [x, y, z] = position;
  const lights = useRef<(THREE.Mesh | null)[]>([]);
  const state = useRef<Shown | null>(null);
  const world = useMemo(() => new THREE.Vector3(), []);
  segment ??= shared(new THREE.CylinderGeometry(SEGMENT_R, SEGMENT_R, SEGMENT_H, 20));
  const on = useMemo(() => ORDER.map((s) => toon(COLOR[s])), []);
  const off = useMemo(() => ORDER.map((s) => toon(dimmed(COLOR[s]))), []);

  useFrame(() => {
    if (!signal) return;
    const next: Shown = plantPowered() ? signal() : 'off';
    if (next === state.current) return;
    state.current = next;
    lights.current.forEach((m, i) => {
      if (m) m.material = ORDER[i] === next ? on[i] : off[i];
    });
    const base = lights.current[0];
    if (!base) return;
    base.getWorldPosition(world);
    markDirty(world.x - 0.12, world.y - 0.1, world.z - 0.12, world.x + 0.12, world.y + 0.35, world.z + 0.12);
    runtime.invalidate();
  });

  let h = y + pole;
  return (
    <group>
      <Cyl p={[x, y + 0.01, z]} radius={0.055} length={0.02} c={palette.metalMid} />
      <Cyl p={[x, y + pole / 2, z]} radius={POLE_R} length={pole} c={palette.metalLight} />
      {ORDER.map((s, i) => {
        const ring = <Cyl key={`r${s}`} p={[x, h + RING_H / 2, z]} radius={SEGMENT_R * 1.04} length={RING_H} c={palette.metalMid} />;
        const light = signal ? (
          <mesh
            key={s}
            ref={(m) => {
              lights.current[i] = m;
            }}
            position={[x, h + RING_H + SEGMENT_H / 2, z]}
            geometry={segment!}
            material={off[i]}
            userData={{ noMerge: true }}
          />
        ) : (
          <Cyl key={s} p={[x, h + RING_H + SEGMENT_H / 2, z]} radius={SEGMENT_R} length={SEGMENT_H} c={COLOR[s]} />
        );
        h += RING_H + SEGMENT_H;
        return [ring, light];
      })}
      <Cyl p={[x, h + 0.02, z]} radius={SEGMENT_R * 0.9} length={0.04} c={palette.metalMid} topRatio={0.8} />
    </group>
  );
}
