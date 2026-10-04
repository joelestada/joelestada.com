'use client';

import { useLayoutEffect, useMemo, useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { palette } from '@/config/palette';
import { toon } from '../../materials';
import { shared } from '../../shared';
import { Block, Bolt, Cyl } from '../../kit/primitives';
import { Anchor, Gusset } from '../../kit/hardware';
import { BED, CHORD_BOTTOM, PANEL, RIG_Z, TRUSS, deflection, slope } from './dims';

const c = palette;
const unitBox = shared(new THREE.BoxGeometry(1, 1, 1));

/** Espesor de las cartelas de nudo. */
const GUSSET_T = 0.012;

type Member = { a: number; b: number; t: number };
/** Cartela de un nudo: centro respecto al nudo (dx, dy), tamaño y cota z de su plano. */
type Plate = { node: number; dx: number; dy: number; w: number; h: number; z: number };

/**
 * Nudos (índices) y barras de la celosía, y las cartelas de cada nudo.
 * Nudo = plano (0 delantero / 1 trasero) × cordón (0 inferior / 1 superior) × posición.
 */
function trussTopology() {
  const n = TRUSS.panels + 1;
  const node = (plane: number, chord: number, i: number) => plane * 2 * n + chord * n + i;
  const members: Member[] = [];
  const plates: Plate[] = [];
  for (let plane = 0; plane < 2; plane++) {
    for (let i = 0; i < TRUSS.panels; i++) {
      members.push({ a: node(plane, 0, i), b: node(plane, 0, i + 1), t: TRUSS.chord });
      members.push({ a: node(plane, 1, i), b: node(plane, 1, i + 1), t: TRUSS.chord });
      // Pratt: diagonales que bajan hacia el centro.
      if (i < TRUSS.panels / 2) members.push({ a: node(plane, 1, i), b: node(plane, 0, i + 1), t: TRUSS.web });
      else members.push({ a: node(plane, 0, i), b: node(plane, 1, i + 1), t: TRUSS.web });
    }
    // Montantes; los de los extremos (sobre los apoyos) con la sección del cordón.
    for (let i = 0; i < n; i++) {
      const end = i === 0 || i === n - 1;
      members.push({ a: node(plane, 0, i), b: node(plane, 1, i), t: end ? TRUSS.chord : TRUSS.web });
    }
    // Cartelas por la cara exterior de cada plano, a ras del borde exterior del cordón.
    const z = RIG_Z + (plane === 0 ? 1 : -1) * (TRUSS.half + TRUSS.chord / 2 + GUSSET_T / 2);
    for (let chord = 0; chord < 2; chord++) {
      for (let i = 0; i < n; i++) {
        const end = i === 0 || i === n - 1;
        const h = end ? 0.2 : 0.17;
        plates.push({
          node: node(plane, chord, i),
          dx: i === 0 ? 0.04 : i === n - 1 ? -0.04 : 0,
          dy: (chord === 0 ? 1 : -1) * (h / 2 - TRUSS.chord / 2),
          w: end ? 0.15 : 0.22,
          h,
          z,
        });
      }
    }
  }
  for (let i = 0; i < n; i++) {
    members.push({ a: node(0, 0, i), b: node(1, 0, i), t: TRUSS.tie });
    members.push({ a: node(0, 1, i), b: node(1, 1, i), t: TRUSS.tie });
  }
  // Arriostramiento superior en cruz alterna (lo que más se ve desde arriba).
  for (let i = 0; i < TRUSS.panels; i++) {
    members.push(i % 2 === 0 ? { a: node(0, 1, i), b: node(1, 1, i + 1), t: TRUSS.tie } : { a: node(1, 1, i), b: node(0, 1, i + 1), t: TRUSS.tie });
  }
  const base: THREE.Vector3[] = [];
  for (let plane = 0; plane < 2; plane++)
    for (let chord = 0; chord < 2; chord++)
      for (let i = 0; i < n; i++) {
        base.push(new THREE.Vector3(TRUSS.x0 + i * PANEL, TRUSS.y + chord * TRUSS.h, RIG_Z + (plane === 0 ? TRUSS.half : -TRUSS.half)));
      }
  return { members, plates, base };
}

/**
 * Probeta amarilla: barras y cartelas instanciadas que se recolocan con la flecha. Las barras van
 * de nudo a nudo; las cartelas siguen a su nudo y giran con la directriz.
 */
export function Truss({ delta }: { delta: RefObject<number> }) {
  const bars = useRef<THREE.InstancedMesh>(null);
  const gussets = useRef<THREE.InstancedMesh>(null);
  const { members, plates, base } = useMemo(trussTopology, []);
  const scratch = useMemo(
    () => ({
      nodes: base.map((v) => v.clone()),
      m: new THREE.Matrix4(),
      q: new THREE.Quaternion(),
      s: new THREE.Vector3(),
      p: new THREE.Vector3(),
      dir: new THREE.Vector3(),
      up: new THREE.Vector3(0, 1, 0),
      z: new THREE.Vector3(0, 0, 1),
      last: NaN,
    }),
    [base],
  );

  const apply = (d: number) => {
    const mesh = bars.current;
    const plateMesh = gussets.current;
    if (!mesh || !plateMesh || d === scratch.last) return;
    scratch.last = d;
    base.forEach((v, i) => scratch.nodes[i].set(v.x, v.y + deflection(v.x, d), v.z));
    members.forEach(({ a, b, t }, i) => {
      const pa = scratch.nodes[a];
      const pb = scratch.nodes[b];
      scratch.dir.subVectors(pb, pa);
      const len = scratch.dir.length();
      scratch.q.setFromUnitVectors(scratch.up, scratch.dir.divideScalar(len));
      scratch.p.addVectors(pa, pb).multiplyScalar(0.5);
      scratch.m.compose(scratch.p, scratch.q, scratch.s.set(t, len + t * 0.9, t));
      mesh.setMatrixAt(i, scratch.m);
    });
    plates.forEach(({ node, dx, dy, w, h, z }, i) => {
      const at = scratch.nodes[node];
      const a = slope(base[node].x, d);
      const [cos, sin] = [Math.cos(a), Math.sin(a)];
      scratch.p.set(at.x + dx * cos - dy * sin, at.y + dx * sin + dy * cos, z);
      scratch.q.setFromAxisAngle(scratch.z, a);
      scratch.m.compose(scratch.p, scratch.q, scratch.s.set(w, h, GUSSET_T));
      plateMesh.setMatrixAt(i, scratch.m);
    });
    mesh.instanceMatrix.needsUpdate = true;
    plateMesh.instanceMatrix.needsUpdate = true;
  };

  useLayoutEffect(() => apply(0));
  // Después de la estación (prioridad 0), que calcula la flecha de este mismo frame.
  useFrame(() => apply(delta.current), 0.5);

  const material = toon(c.signalYellow);
  return (
    <group>
      <instancedMesh ref={bars} args={[unitBox, material, members.length]} frustumCulled={false} />
      <instancedMesh ref={gussets} args={[unitBox, material, plates.length]} frustumCulled={false} />
    </group>
  );
}

/**
 * Pedestales de los apoyos: placa anclada a las ranuras (estrecha en X: queda entre la del pilar y
 * el vano), cuerpo cajón con una cartela por cara y placa de cabeza atornillada.
 */
export function Pedestals() {
  const y0 = BED.h + 0.03;
  return (
    <group>
      {[TRUSS.x0, TRUSS.x1].map((x) => (
        <group key={x}>
          <Block min={[x - 0.145, BED.h, RIG_Z - 0.36]} max={[x + 0.145, y0, RIG_Z + 0.36]} c={c.metalDark} />
          {[-0.1, 0.1].flatMap((dx) => [-1, 1].map((s) => <Anchor key={`${dx}${s}`} p={[x + dx, y0, RIG_Z + s * 0.27]} r={0.022} />))}
          <Block min={[x - 0.1, y0, RIG_Z - 0.22]} max={[x + 0.1, 0.74, RIG_Z + 0.22]} c={c.metalLight} />
          {[-1, 1].map((s) => (
            <Gusset key={s} x={x} y={y0} zFace={RIG_Z + s * 0.22} zOut={RIG_Z + s * 0.34} h={0.26} t={0.016} color={c.metalLight} />
          ))}
          <Block min={[x - 0.15, 0.74, RIG_Z - 0.27]} max={[x + 0.15, 0.77, RIG_Z + 0.27]} c={c.metalMid} />
          {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => <Bolt key={`${sx}${sz}`} p={[x + sx * 0.12, 0.77, RIG_Z + sz * 0.24]} r={0.012} h={0.01} />))}
        </group>
      ))}
    </group>
  );
}

/**
 * Apoyos de la probeta (biapoyada): articulado a la izquierda (bulón entre dos asientos, con sus
 * collarines) y de rodillo a la derecha (rodillo libre entre chapas, con topes de recorrido).
 */
export function Bearings() {
  const top = CHORD_BOTTOM;
  const len = 0.46;
  const [pin, roller] = [TRUSS.x0, TRUSS.x1];
  return (
    <group>
      {/* Articulado. */}
      <Block min={[pin - 0.1, 0.77, RIG_Z - 0.22]} max={[pin + 0.1, 0.815, RIG_Z + 0.22]} c={c.metalDark} />
      <Cyl p={[pin, 0.838, RIG_Z]} radius={0.03} length={len + 0.04} axis="z" c={c.metalLight} />
      {[-1, 1].map((s) => (
        <Cyl key={s} p={[pin, 0.838, RIG_Z + s * (len / 2 + 0.014)]} radius={0.036} length={0.012} axis="z" c={c.metalMid} />
      ))}
      <Block min={[pin - 0.11, 0.86, RIG_Z - 0.22]} max={[pin + 0.11, top, RIG_Z + 0.22]} c={c.metalMid} />
      {/* De rodillo. */}
      <Block min={[roller - 0.13, 0.77, RIG_Z - 0.22]} max={[roller + 0.13, 0.8, RIG_Z + 0.22]} c={c.metalDark} />
      {[-1, 1].map((s) => (
        <Block
          key={s}
          min={[roller + s * 0.13 - (s > 0 ? 0.018 : 0), 0.8, RIG_Z - 0.22]}
          max={[roller + s * 0.13 + (s < 0 ? 0.018 : 0), 0.822, RIG_Z + 0.22]}
          c={c.metalDark}
        />
      ))}
      <Cyl p={[roller, 0.835, RIG_Z]} radius={0.035} length={len} axis="z" c={c.metalLight} />
      <Block min={[roller - 0.11, 0.87, RIG_Z - 0.22]} max={[roller + 0.11, top, RIG_Z + 0.22]} c={c.metalMid} />
    </group>
  );
}
