'use client';

import { useLayoutEffect, useMemo, useRef, type RefObject } from 'react';
import * as THREE from 'three';
import { LINE } from '@/config/layout';
import { palette } from '@/config/palette';
import { toon } from '../materials';
import { Block, Merge } from '../kit/primitives';

const RAIL_H = 0.13;
const RAIL_T = 0.04;
const LEG = 0.05;
const BRACE = 0.035;
const LOWER_RAIL_Y = 0.24;
const FOOT_R = 0.045;

/** Coloca `count` instancias con una función que escribe su matriz. */
function useInstances(ref: RefObject<THREE.InstancedMesh | null>, count: number, place: (i: number, m: THREE.Matrix4) => void) {
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    for (let i = 0; i < count; i++) {
      place(i, m);
      mesh.setMatrixAt(i, m);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    // Las posiciones solo dependen del número de instancias: `place` se crea en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);
}

/**
 * Cinta de rodillos continua de `startX` a `endX` sobre el eje de la línea:
 * largueros, rodillos, patas con pies, travesaños y tope final.
 * Todo lo repetitivo va en InstancedMesh.
 */
export function Conveyor({ startX = LINE.startX, endX = LINE.endX }: { startX?: number; endX?: number }) {
  const z0 = LINE.axisZ;
  const half = LINE.width / 2;
  const rollerY = LINE.rollerTop - LINE.rollerRadius;
  const rollerLen = LINE.width - RAIL_T - 0.02;
  const railTop = LINE.rollerTop + 0.018;
  const legTop = railTop - RAIL_H;

  const rollers = Math.floor((endX - startX - 0.12) / LINE.rollerPitch) + 1;
  const legBays = Math.max(1, Math.round((endX - startX) / LINE.legSpacing));
  const legXs = useMemo(() => Array.from({ length: legBays + 1 }, (_, i) => startX + 0.12 + ((endX - startX - 0.24) * i) / legBays), [startX, endX, legBays]);

  const rollerRef = useRef<THREE.InstancedMesh>(null);
  const legRef = useRef<THREE.InstancedMesh>(null);
  const footRef = useRef<THREE.InstancedMesh>(null);
  const braceRef = useRef<THREE.InstancedMesh>(null);

  const geos = useMemo(
    () => ({
      roller: new THREE.CylinderGeometry(LINE.rollerRadius, LINE.rollerRadius, rollerLen, 14).rotateX(Math.PI / 2),
      leg: new THREE.BoxGeometry(LEG, legTop - 0.03, LEG).translate(0, (legTop - 0.03) / 2, 0),
      foot: new THREE.CylinderGeometry(FOOT_R * 0.8, FOOT_R, 0.035, 14).translate(0, 0.0175, 0),
      brace: new THREE.BoxGeometry(BRACE, BRACE, LINE.width - 0.1),
    }),
    [rollerLen, legTop],
  );

  useInstances(rollerRef, rollers, (i, m) => m.makeTranslation(startX + 0.06 + i * LINE.rollerPitch, rollerY, z0));
  useInstances(legRef, legXs.length * 2, (i, m) => m.makeTranslation(legXs[i >> 1], 0.03, z0 + (i % 2 === 0 ? -1 : 1) * (half - 0.05)));
  useInstances(footRef, legXs.length * 2, (i, m) => m.makeTranslation(legXs[i >> 1], 0, z0 + (i % 2 === 0 ? -1 : 1) * (half - 0.05)));
  useInstances(braceRef, legXs.length, (i, m) => m.makeTranslation(legXs[i], LOWER_RAIL_Y, z0));

  return (
    <group>
      <instancedMesh ref={rollerRef} args={[geos.roller, toon(palette.metalLight), rollers]} />
      <instancedMesh ref={legRef} args={[geos.leg, toon(palette.metalLight), legXs.length * 2]} />
      <instancedMesh ref={footRef} args={[geos.foot, toon(palette.metalMid), legXs.length * 2]} />
      <instancedMesh ref={braceRef} args={[geos.brace, toon(palette.metalLight), legXs.length]} />
      <Merge>
        {/* Largueros laterales (perfil en C visto como caja). */}
        {[-1, 1].map((s) => (
          <group key={s}>
            <Block min={[startX, legTop, z0 + s * half - RAIL_T / 2]} max={[endX, railTop, z0 + s * half + RAIL_T / 2]} c={palette.metalLight} />
            {/* Larguero inferior entre patas. */}
            <Block
              min={[startX + 0.12, LOWER_RAIL_Y - BRACE / 2, z0 + s * (half - 0.05) - BRACE / 2]}
              max={[endX - 0.12, LOWER_RAIL_Y + BRACE / 2, z0 + s * (half - 0.05) + BRACE / 2]}
              c={palette.metalLight}
            />
          </group>
        ))}
        {/* Testeros y tope final. */}
        <Block min={[startX - RAIL_T, legTop, z0 - half - RAIL_T / 2]} max={[startX, railTop, z0 + half + RAIL_T / 2]} c={palette.metalLight} />
        <Block min={[endX, legTop, z0 - half - RAIL_T / 2]} max={[endX + RAIL_T, railTop + 0.12, z0 + half + RAIL_T / 2]} c={palette.metalMid} />
        <Block min={[endX - 0.05, railTop - 0.02, z0 - 0.26]} max={[endX, railTop + 0.08, z0 - 0.14]} c={palette.stripeBlack} />
        <Block min={[endX - 0.05, railTop - 0.02, z0 + 0.14]} max={[endX, railTop + 0.08, z0 + 0.26]} c={palette.stripeBlack} />
      </Merge>
    </group>
  );
}
