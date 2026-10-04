'use client';

import { useLayoutEffect, useMemo, useRef, type ReactNode } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Vec3 } from '@/config/layout';
import { palette } from '@/config/palette';
import { toon, toonVertexColors } from '../materials';
import { shared } from '../shared';
import { gearOutline, latheGeometry, prismGeometry, torusGeometry, tubeGeometry, type Plane, type Pt } from './geometry';

/**
 * Primitivas de modelado. Cada pieza lleva un ID de tinta: el pase de tinta dibuja
 * una línea fina donde cambia el ID, así cada pieza queda contorneada como en un plano.
 */

let inkIdCounter = 0;
/** IDs 1..250 (0 = sin ID). Se reciclan; una colisión solo borra una línea. */
export function nextInkId() {
  inkIdCounter = (inkIdCounter % 250) + 1;
  return inkIdCounter;
}

const unitBox = shared(new THREE.BoxGeometry(1, 1, 1));
const cylinders = new Map<string, THREE.CylinderGeometry>();

function unitCylinder(segments: number, topRatio: number) {
  const key = `${segments}|${topRatio}`;
  let g = cylinders.get(key);
  if (!g) {
    g = shared(new THREE.CylinderGeometry(0.5 * topRatio, 0.5, 1, segments));
    cylinders.set(key, g);
  }
  return g;
}

type PartProps = {
  /** Color de la paleta. */
  c: string;
  /** ID de tinta compartido (para que dos piezas no se separen con línea). */
  id?: number;
};

/** Caja por centro `p` y tamaño `s`, con rotación opcional `r` (Euler XYZ). */
export function Box({ p, s, r, c, id }: PartProps & { p: Vec3; s: Vec3; r?: Vec3 }) {
  return <mesh position={p} scale={s} rotation={r} geometry={unitBox} material={toon(c)} userData={id ? { inkId: id } : {}} />;
}

/** Caja definida por sus esquinas mínima y máxima. */
export function Block({ min, max, c, id }: PartProps & { min: Vec3; max: Vec3 }) {
  return (
    <Box p={[(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2]} s={[max[0] - min[0], max[1] - min[1], max[2] - min[2]]} c={c} id={id} />
  );
}

const AXIS_ROTATION: Record<'x' | 'y' | 'z', Vec3> = {
  x: [0, 0, Math.PI / 2],
  y: [0, 0, 0],
  z: [Math.PI / 2, 0, 0],
};

/** Cilindro por centro, radio y longitud, orientado según un eje del mundo o una rotación libre. */
export function Cyl({
  p,
  radius,
  length,
  axis = 'y',
  r,
  c,
  id,
  segments = 20,
  topRatio = 1,
}: PartProps & {
  p: Vec3;
  radius: number;
  length: number;
  axis?: 'x' | 'y' | 'z';
  r?: Vec3;
  segments?: number;
  topRatio?: number;
}) {
  return (
    <mesh
      position={p}
      scale={[radius * 2, length, radius * 2]}
      rotation={r ?? AXIS_ROTATION[axis]}
      geometry={unitCylinder(segments, topRatio)}
      material={toon(c)}
      userData={id ? { inkId: id } : {}}
    />
  );
}

const domes = new Map<number, THREE.SphereGeometry>();

/** Media esfera (casquete superior) de radio `radius` con la base en `p`. */
export function Dome({ p, radius, c, id, segments = 20 }: PartProps & { p: Vec3; radius: number; segments?: number }) {
  let g = domes.get(segments);
  if (!g) {
    g = shared(new THREE.SphereGeometry(0.5, segments, Math.max(4, segments / 2), 0, Math.PI * 2, 0, Math.PI / 2));
    domes.set(segments, g);
  }
  return <mesh position={p} scale={[radius * 2, radius * 2, radius * 2]} geometry={g} material={toon(c)} userData={id ? { inkId: id } : {}} />;
}

/** Barra entre dos puntos con sección cuadrada (tubos, riostras, diagonales). */
export function Bar({ a, b, t, c, id }: PartProps & { a: Vec3; b: Vec3; t: number }) {
  const va = new THREE.Vector3(...a);
  const vb = new THREE.Vector3(...b);
  const len = va.distanceTo(vb);
  const mid = va.clone().add(vb).multiplyScalar(0.5);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize());
  return <mesh position={mid} quaternion={q} scale={[t, len, t]} geometry={unitBox} material={toon(c)} userData={id ? { inkId: id } : {}} />;
}

/** ID de tinta estable para un grupo de piezas que deben leerse como una sola (una fundición). */
export function useInkId() {
  return useMemo(() => nextInkId(), []);
}

/** Dirección de un eje con signo. */
type Dir = 'x' | '-x' | 'y' | '-y' | 'z' | '-z';

/** Giro que lleva el +Y local a la dirección indicada. */
const DIR_ROTATION: Record<Dir, Vec3> = {
  y: [0, 0, 0],
  '-y': [Math.PI, 0, 0],
  x: [0, 0, -Math.PI / 2],
  '-x': [0, 0, Math.PI / 2],
  z: [Math.PI / 2, 0, 0],
  '-z': [-Math.PI / 2, 0, 0],
};

const DIR_VECTOR: Record<Dir, Vec3> = {
  x: [1, 0, 0],
  '-x': [-1, 0, 0],
  y: [0, 1, 0],
  '-y': [0, -1, 0],
  z: [0, 0, 1],
  '-z': [0, 0, -1],
};

/** Pieza con una geometría ya construida (compartida: ver `kit/geometry`). */
export function Solid({ geometry, p, r, c, id }: PartProps & { geometry: THREE.BufferGeometry; p?: Vec3; r?: Vec3 }) {
  return <mesh geometry={geometry} position={p} rotation={r} material={toon(c)} userData={id ? { inkId: id } : {}} />;
}

/** Sólido de revolución: perfil (radio, distancia) que arranca en `p` y avanza en la dirección `axis`. */
export function Lathe({ p, profile, axis = 'y', segments = 32, c, id }: PartProps & { p: Vec3; profile: Pt[]; axis?: Dir; segments?: number }) {
  return <Solid geometry={latheGeometry(profile, segments)} p={p} r={DIR_ROTATION[axis]} c={c} id={id} />;
}

/**
 * Prisma: contorno en `plane` ('xy', 'zy' o 'xz') extruido `depth` a lo largo del eje restante
 * a partir de la cota `from`. `p` desplaza el conjunto y `r` lo gira alrededor de ese punto.
 */
export function Prism({
  outline,
  holes,
  plane = 'xy',
  from = 0,
  depth,
  p = [0, 0, 0],
  r,
  c,
  id,
}: PartProps & { outline: Pt[]; holes?: Pt[][]; plane?: Plane; from?: number; depth: number; p?: Vec3; r?: Vec3 }) {
  const at: Vec3 = plane === 'xy' ? [p[0], p[1], p[2] + from] : plane === 'zy' ? [p[0] + from, p[1], p[2]] : [p[0], p[1] + from, p[2]];
  return <Solid geometry={prismGeometry(outline, depth, plane, holes)} p={at} r={r} c={c} id={id} />;
}

/** Engranaje de dientes rectos con su eje en X, centrado en `p` (y, z), de `from` a `from + depth`. */
export function Gear({
  p,
  teeth,
  root,
  tip,
  from,
  depth,
  c,
  id,
}: PartProps & { p: Vec3; teeth: number; root: number; tip: number; from: number; depth: number }) {
  return <Prism outline={gearOutline(teeth, root, tip)} plane="zy" from={from} depth={depth} p={[0, p[1], p[2]]} c={c} id={id} />;
}

/** Tubo que sigue una polilínea con las esquinas curvadas (radio de acuerdo `bend`). */
export function Tube({ points, radius, bend = 0.06, c, id }: PartProps & { points: Vec3[]; radius: number; bend?: number }) {
  return <Solid geometry={tubeGeometry(points, radius, bend)} c={c} id={id} />;
}

/** Aro de radio `radius` y sección `tube`, perpendicular al eje `axis` (abrazaderas, cáncamos). */
export function Ring({ p, radius, tube, axis = 'z', c, id }: PartProps & { p: Vec3; radius: number; tube: number; axis?: 'x' | 'y' | 'z' }) {
  const r: Vec3 = axis === 'x' ? [0, Math.PI / 2, 0] : axis === 'y' ? [-Math.PI / 2, 0, 0] : [0, 0, 0];
  return <Solid geometry={torusGeometry(radius, tube)} p={p} r={r} c={c} id={id} />;
}

/** Tornillo de cabeza hexagonal apoyado en `p`: la cabeza sobresale `h` en la dirección `dir`. */
export function Bolt({ p, dir = 'y', r = 0.014, h = 0.012, c = palette.metalMid, id }: Partial<PartProps> & { p: Vec3; dir?: Dir; r?: number; h?: number }) {
  const v = DIR_VECTOR[dir];
  return (
    <Cyl p={[p[0] + (v[0] * h) / 2, p[1] + (v[1] * h) / 2, p[2] + (v[2] * h) / 2]} radius={r} length={h} r={DIR_ROTATION[dir]} segments={6} c={c} id={id} />
  );
}

/** Corona de `n` tornillos de radio `R` alrededor de `p`, en la cara normal a `dir`. */
export function BoltCircle({
  p,
  dir,
  R,
  n,
  phase = 0,
  r,
  h,
  c,
}: {
  p: Vec3;
  dir: Dir;
  R: number;
  n: number;
  phase?: number;
  r?: number;
  h?: number;
  c?: string;
}) {
  const axis = dir.replace('-', '');
  return (
    <>
      {Array.from({ length: n }, (_, k) => {
        const a = phase + (k / n) * Math.PI * 2;
        const [u, v] = [R * Math.cos(a), R * Math.sin(a)];
        const q: Vec3 = axis === 'x' ? [p[0], p[1] + u, p[2] + v] : axis === 'y' ? [p[0] + u, p[1], p[2] + v] : [p[0] + u, p[1] + v, p[2]];
        return <Bolt key={k} p={q} dir={dir} r={r} h={h} c={c} />;
      })}
    </>
  );
}

/** Cubo de las piezas de un solo color: van juntas, con su color en los vértices. */
const COLORED = 'colored';

/**
 * Copia de una geometría de origen para la fusión: sin índices y solo con posición, normal y uv (uv a
 * cero si no tiene), en el orden de la original. Las indexadas se desindexan una sola vez: las unitarias
 * (cajas, cilindros) las comparten miles de piezas y desindexarlas en cada una era buena parte del
 * montaje. Cada pieza recibe arrays propios, que luego se transforman como antes.
 */
const deindexed = new WeakMap<THREE.BufferGeometry, THREE.BufferGeometry>();
function mergeSource(src: THREE.BufferGeometry) {
  let base = src;
  if (src.index) {
    base = deindexed.get(src) ?? src.toNonIndexed();
    deindexed.set(src, base);
  }
  const g = new THREE.BufferGeometry();
  for (const name of Object.keys(base.attributes)) {
    if (name === 'position' || name === 'normal' || name === 'uv') g.setAttribute(name, (base.attributes[name] as THREE.BufferAttribute).clone());
  }
  if (!g.attributes.uv) {
    g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  }
  return g;
}

/**
 * Fusiona todas las piezas toon estáticas de su subárbol en una sola malla, guardando el ID de
 * tinta de cada pieza y su color como atributos de vértice (las que llevan textura, una malla por
 * textura). Un conjunto entero se dibuja en una llamada por pase, en vez de una por color: es lo que
 * más cuesta de cada frame en la CPU.
 */
export function Merge({ children }: { children: ReactNode }) {
  const ref = useRef<THREE.Group>(null);

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    root.updateWorldMatrix(true, true);
    const inverseRoot = root.matrixWorld.clone().invert();
    const buckets = new Map<THREE.Material | typeof COLORED, THREE.BufferGeometry[]>();
    const hidden: THREE.Object3D[] = [];
    const rel = new THREE.Matrix4();

    // Las piezas animadas cuelgan de un grupo con `mergeBoundary`: no se entra en ellas.
    const visit = (o: THREE.Object3D) => {
      if (o !== root && o.userData.mergeBoundary) return;
      o.children.forEach(visit);
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || (mesh as THREE.InstancedMesh).isInstancedMesh) return;
      if (mesh.userData.merged || mesh.userData.noMerge || !mesh.visible) return;
      if (!mesh.layers.isEnabled(0)) return;
      const material = mesh.material as THREE.MeshToonMaterial;
      if (!material.isMeshToonMaterial) return;

      const g = mergeSource(mesh.geometry);
      rel.multiplyMatrices(inverseRoot, mesh.matrixWorld);
      g.applyMatrix4(rel);
      const inkId = (mesh.userData.inkId as number | undefined) ?? nextInkId();
      const count = g.attributes.position.count;
      g.setAttribute('aInkId', new THREE.Float32BufferAttribute(new Float32Array(count).fill(inkId), 1));
      // Color lineal del material (el que usaría el shader), repetido en cada vértice.
      const key = material.map ? material : COLORED;
      if (key === COLORED) {
        const { r, g: gr, b } = material.color;
        const colors = new Float32Array(count * 3);
        for (let i = 0; i < count * 3; i += 3) {
          colors[i] = r;
          colors[i + 1] = gr;
          colors[i + 2] = b;
        }
        g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      }

      const list = buckets.get(key) ?? [];
      list.push(g);
      buckets.set(key, list);
      mesh.visible = false;
      hidden.push(mesh);
    };
    visit(root);

    const merged: THREE.Mesh[] = [];
    buckets.forEach((geos, key) => {
      const geometry = mergeGeometries(geos, false);
      geos.forEach((g) => g.dispose());
      if (!geometry) return;
      geometry.computeBoundingSphere();
      const m = new THREE.Mesh(geometry, key === COLORED ? toonVertexColors() : key);
      m.userData.merged = true;
      root.add(m);
      merged.push(m);
    });

    return () => {
      merged.forEach((m) => {
        root.remove(m);
        m.geometry.dispose();
      });
      hidden.forEach((o) => (o.visible = true));
    };
  }, []);

  return <group ref={ref}>{children}</group>;
}
