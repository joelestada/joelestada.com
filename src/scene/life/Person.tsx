'use client';

import type { RefObject } from 'react';
import * as THREE from 'three';
import { palette } from '@/config/palette';
import { toon } from '../materials';
import { shared } from '../shared';

/**
 * Figura humana a escala, como las de un plano de arquitectura: formas redondeadas y sin rasgos,
 * con los colores apagados de la lámina. Mira hacia -Z; el origen es el centro de la cadera.
 * Medidas en metros (1,8 m de pie).
 */
export const BODY = {
  hipY: 0.956,
  hipX: 0.1,
  spineY: 0.05,
  shoulder: [0.2, 0.44, 0] as const,
  neckY: 0.53,
  headY: 0.07,
  upperArm: 0.28,
  forearm: 0.27,
  thigh: 0.44,
  shin: 0.44,
} as const;

type PersonColors = { shirt: string; trousers: string; hair?: string };

/** Articulaciones animables. Todas giran sobre sí mismas; los miembros cuelgan hacia -Y. */
export type Rig = {
  root: THREE.Group | null;
  spine: THREE.Group | null;
  neck: THREE.Group | null;
  head: THREE.Group | null;
  shoulderL: THREE.Group | null;
  elbowL: THREE.Group | null;
  shoulderR: THREE.Group | null;
  elbowR: THREE.Group | null;
  hipL: THREE.Group | null;
  kneeL: THREE.Group | null;
  footL: THREE.Group | null;
  hipR: THREE.Group | null;
  kneeR: THREE.Group | null;
  footR: THREE.Group | null;
};

export const emptyRig = (): Rig => ({
  root: null,
  spine: null,
  neck: null,
  head: null,
  shoulderL: null,
  elbowL: null,
  shoulderR: null,
  elbowR: null,
  hipL: null,
  kneeL: null,
  footL: null,
  hipR: null,
  kneeR: null,
  footR: null,
});

let cache: ReturnType<typeof makeGeometries> | null = null;

function makeGeometries() {
  const cap = (r: number, len: number) => new THREE.CapsuleGeometry(r, len, 4, 12);
  return {
    pelvis: new THREE.CapsuleGeometry(0.105, 0.17, 4, 12).rotateZ(Math.PI / 2).scale(1, 1, 0.78),
    torso: new THREE.CylinderGeometry(0.165, 0.14, 0.44, 18).scale(1, 1, 0.64).translate(0, 0.26, 0),
    chest: new THREE.SphereGeometry(0.165, 18, 10).scale(1, 0.42, 0.64).translate(0, 0.48, 0),
    neck: new THREE.CylinderGeometry(0.045, 0.05, 0.1, 12).translate(0, 0.04, 0),
    head: new THREE.SphereGeometry(0.103, 20, 14).translate(0, 0.105, -0.004),
    // Casquete de pelo inclinado hacia la nuca: tapa la parte de atrás y deja la cara despejada.
    hair: new THREE.SphereGeometry(0.109, 20, 12, 0, Math.PI * 2, 0, 1.95).rotateX(0.42).translate(0, 0.112, 0.004),
    upperArm: cap(0.047, 0.22).translate(0, -0.14, 0),
    forearm: cap(0.041, 0.2).translate(0, -0.13, 0),
    hand: new THREE.SphereGeometry(0.043, 12, 8).scale(0.75, 1.15, 0.5).translate(0, -0.285, 0),
    thigh: cap(0.07, 0.34).translate(0, -0.22, 0),
    shin: cap(0.056, 0.36).translate(0, -0.22, 0),
    shoe: cap(0.046, 0.15)
      .rotateX(Math.PI / 2)
      .translate(0, -0.03, -0.055),
  };
}

function geometries() {
  if (!cache) {
    cache = makeGeometries();
    Object.values(cache).forEach(shared);
  }
  return cache;
}

/** Figura con sus articulaciones en `rig`. Colóquese y oriéntese con `position` y `rotationY`. */
export function Person({
  rig,
  colors,
  position,
  rotationY = 0,
}: {
  rig: RefObject<Rig>;
  colors: PersonColors;
  position: readonly [number, number, number];
  rotationY?: number;
}) {
  const g = geometries();
  const set =
    <K extends keyof Rig>(k: K) =>
    (o: Rig[K]) => {
      rig.current[k] = o;
    };
  const skin = toon(palette.skin);
  const shirt = toon(colors.shirt);
  const trousers = toon(colors.trousers);
  const shoes = toon(palette.shoes);
  const hair = toon(colors.hair ?? palette.hair);
  const [sx, sy, sz] = BODY.shoulder;

  const arm = (side: 1 | -1) => (
    <group ref={set(side < 0 ? 'shoulderL' : 'shoulderR')} position={[side * sx, sy, sz]}>
      <mesh geometry={g.upperArm} material={shirt} />
      <group ref={set(side < 0 ? 'elbowL' : 'elbowR')} position={[0, -BODY.upperArm, 0]}>
        <mesh geometry={g.forearm} material={shirt} />
        <mesh geometry={g.hand} material={skin} />
      </group>
    </group>
  );
  const leg = (side: 1 | -1) => (
    <group ref={set(side < 0 ? 'hipL' : 'hipR')} position={[side * BODY.hipX, -0.02, 0]}>
      <mesh geometry={g.thigh} material={trousers} />
      <group ref={set(side < 0 ? 'kneeL' : 'kneeR')} position={[0, -BODY.thigh, 0]}>
        <mesh geometry={g.shin} material={trousers} />
        <group ref={set(side < 0 ? 'footL' : 'footR')} position={[0, -BODY.shin, 0]}>
          <mesh geometry={g.shoe} material={shoes} />
        </group>
      </group>
    </group>
  );

  return (
    <group ref={set('root')} position={position} rotation={[0, rotationY, 0]}>
      <mesh geometry={g.pelvis} material={trousers} />
      <group ref={set('spine')} position={[0, BODY.spineY, 0]}>
        <mesh geometry={g.torso} material={shirt} />
        <mesh geometry={g.chest} material={shirt} />
        <group ref={set('neck')} position={[0, BODY.neckY, 0]}>
          <mesh geometry={g.neck} material={skin} />
          <group ref={set('head')} position={[0, BODY.headY, 0]}>
            <mesh geometry={g.head} material={skin} />
            <mesh geometry={g.hair} material={hair} />
          </group>
        </group>
        {arm(-1)}
        {arm(1)}
      </group>
      {leg(-1)}
      {leg(1)}
    </group>
  );
}

/**
 * Brazo de dos tramos en su plano (hombro → codo → mano), con el ángulo del hombro medido desde
 * la vertical hacia delante (-Z) y la flexión del codo hacia delante. `dy`, `dz`: mano respecto
 * al hombro, en el marco del tronco. Devuelve [hombro, codo] (rad).
 */
export function armReach(dy: number, dz: number): [number, number] {
  const l1 = BODY.upperArm;
  const l2 = BODY.forearm;
  const d = Math.min(Math.hypot(dy, dz), l1 + l2 - 1e-4);
  const phi = Math.atan2(-dz, -dy);
  const cb = (d * d - l1 * l1 - l2 * l2) / (2 * l1 * l2);
  const elbow = Math.acos(Math.min(1, Math.max(-1, cb)));
  const shoulder = phi - Math.atan2(l2 * Math.sin(elbow), l1 + l2 * Math.cos(elbow));
  return [shoulder, elbow];
}
