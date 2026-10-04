import * as THREE from 'three';
import type { Vec3 } from '@/config/layout';
import { shared } from '../shared';
import { creaseNormals } from './creaseNormals';

/**
 * Generadores de geometría para piezas que no salen de cajas y cilindros:
 * sólidos de revolución, prismas de contorno libre, tubos por una curva y engranajes.
 * Todos parten las normales en las aristas vivas (el sombreado toon y la tinta las marcan)
 * y las suavizan en las superficies curvas.
 */

/** Por encima de este pliegue la arista queda viva; por debajo, la superficie se suaviza. */
const CREASE = THREE.MathUtils.degToRad(35);

export type Pt = [number, number];

const cache = new Map<string, THREE.BufferGeometry>();

/**
 * Geometría compartida por clave: las piezas repetidas (pistones, levas, tornillos) no se recalculan
 * y, como las unitarias de las primitivas, se liberan al desmontar la escena (`shared`).
 */
function cached(key: string, build: () => THREE.BufferGeometry) {
  let g = cache.get(key);
  if (!g) {
    g = shared(build());
    cache.set(key, g);
  }
  return g;
}

function creased(g: THREE.BufferGeometry) {
  const out = creaseNormals(g, CREASE);
  if (out !== g) g.dispose();
  return out;
}

const keyOf = (pts: Pt[]) => pts.map(([a, b]) => `${a.toFixed(4)},${b.toFixed(4)}`).join(' ');

/** Sólido de revolución alrededor de +Y. Perfil (radio, cota) recorrido por fuera de abajo arriba. */
export function latheGeometry(profile: Pt[], segments = 32) {
  return cached(`lathe|${segments}|${keyOf(profile)}`, () =>
    creased(
      new THREE.LatheGeometry(
        profile.map(([r, y]) => new THREE.Vector2(r, y)),
        segments,
      ),
    ),
  );
}

/**
 * Plano del contorno de un prisma y eje de extrusión:
 * 'xy' → contorno (x, y) extruido en +Z; 'zy' → (z, y) en +X; 'xz' → (x, z) en +Y.
 */
export type Plane = 'xy' | 'zy' | 'xz';

/** Prisma recto: contorno cerrado (con huecos opcionales) extruido `depth` desde la cota 0 del eje restante. */
export function prismGeometry(outline: Pt[], depth: number, plane: Plane = 'xy', holes: Pt[][] = []) {
  return cached(`prism|${plane}|${depth}|${keyOf(outline)}|${holes.map(keyOf).join('/')}`, () => {
    // Coordenadas de la forma tales que, tras un giro propio (sin espejo), coincidan con los ejes del plano.
    const to2 = ([u, v]: Pt) => (plane === 'zy' ? new THREE.Vector2(-u, v) : plane === 'xz' ? new THREE.Vector2(u, -v) : new THREE.Vector2(u, v));
    const shape = new THREE.Shape(outline.map(to2));
    shape.holes = holes.map((h) => new THREE.Path(h.map(to2)));
    const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
    if (plane === 'zy') g.rotateY(Math.PI / 2);
    if (plane === 'xz') g.rotateX(-Math.PI / 2);
    return creased(g);
  });
}

/** Aro (toro) en el plano XY, alrededor de +Z. */
export function torusGeometry(radius: number, tube: number) {
  return cached(`torus|${radius}|${tube}`, () => new THREE.TorusGeometry(radius, tube, 6, 28));
}

/**
 * Tubo a lo largo de una curva, de radio fijo o variable r(t) con t ∈ [0, 1] en longitud de arco,
 * con tapas planas en los extremos. Sin caché: úsese a través de `tubeGeometry` o con clave propia.
 */
function sweepGeometry(
  curve: THREE.Curve<THREE.Vector3>,
  radius: number | ((t: number) => number),
  { step = 0.025, radial = 12 }: { step?: number; radial?: number } = {},
) {
  const n = Math.max(2, Math.ceil(curve.getLength() / step));
  const frames = curve.computeFrenetFrames(n, false);
  const r = typeof radius === 'number' ? () => radius : radius;
  const pos: number[] = [];
  const index: number[] = [];
  const p = new THREE.Vector3();
  const ring = radial + 1;

  for (let i = 0; i <= n; i++) {
    const t = i / n;
    curve.getPointAt(t, p);
    const nrm = frames.normals[i];
    const bin = frames.binormals[i];
    const ri = r(t);
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const cos = Math.cos(a);
      const sin = Math.sin(a);
      pos.push(p.x + ri * (cos * nrm.x + sin * bin.x), p.y + ri * (cos * nrm.y + sin * bin.y), p.z + ri * (cos * nrm.z + sin * bin.z));
    }
  }
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * ring + j;
      const b = a + ring;
      index.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  // Tapas: la inicial mira hacia atrás de la curva, la final hacia delante.
  for (const [i, start] of [
    [0, true],
    [n, false],
  ] as const) {
    const center = pos.length / 3;
    curve.getPointAt(i / n, p);
    pos.push(p.x, p.y, p.z);
    for (let j = 0; j < radial; j++) {
      const a = i * ring + j;
      if (start) index.push(center, a + 1, a);
      else index.push(center, a, a + 1);
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(index);
  return creased(g);
}

/** Tubo que sigue una polilínea con las esquinas curvadas (radio de acuerdo `bend`), compartido por forma. */
export function tubeGeometry(points: Vec3[], radius: number, bend: number) {
  return cached(`tube|${radius}|${bend}|${points.map((q) => q.join(',')).join(' ')}`, () => sweepGeometry(bentPath(points, bend), radius));
}

/** Barrido con clave propia (caracoles, fuelles): se construye una sola vez. */
export function keyedSweep(key: string, build: () => { curve: THREE.Curve<THREE.Vector3>; radius: number | ((t: number) => number) }) {
  return cached(`sweep|${key}`, () => {
    const { curve, radius } = build();
    return sweepGeometry(curve, radius);
  });
}

/** Polilínea 3D con las esquinas sustituidas por curvas de acuerdo (tuberías dobladas). */
export function bentPath(points: Vec3[], bend: number) {
  const path = new THREE.CurvePath<THREE.Vector3>();
  const v = points.map((q) => new THREE.Vector3(...q));
  let start = v[0];
  for (let i = 1; i < v.length - 1; i++) {
    const [a, b, c] = [v[i - 1], v[i], v[i + 1]];
    const d = Math.min(bend, a.distanceTo(b) / 2, b.distanceTo(c) / 2);
    const p1 = b.clone().add(a.clone().sub(b).setLength(d));
    const p2 = b.clone().add(c.clone().sub(b).setLength(d));
    if (start.distanceTo(p1) > 1e-6) path.add(new THREE.LineCurve3(start, p1));
    path.add(new THREE.QuadraticBezierCurve3(p1, b.clone(), p2));
    start = p2;
  }
  path.add(new THREE.LineCurve3(start, v[v.length - 1]));
  return path;
}

/**
 * Redondea las esquinas de un polígono cerrado con arcos de radio `radius`
 * (un valor o uno por vértice; 0 deja la esquina viva).
 */
export function roundCorners(points: Pt[], radius: number | number[], segments = 4): Pt[] {
  const out: Pt[] = [];
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const r = typeof radius === 'number' ? radius : radius[i];
    const [px, py] = points[i];
    if (!r) {
      out.push([px, py]);
      continue;
    }
    const [ax, ay] = points[(i + n - 1) % n];
    const [cx, cy] = points[(i + 1) % n];
    const ul = Math.hypot(ax - px, ay - py);
    const wl = Math.hypot(cx - px, cy - py);
    const [ux, uy] = [(ax - px) / ul, (ay - py) / ul];
    const [wx, wy] = [(cx - px) / wl, (cy - py) / wl];
    const half = Math.acos(THREE.MathUtils.clamp(ux * wx + uy * wy, -1, 1)) / 2;
    const tangent = Math.min(r / Math.tan(half), ul / 2, wl / 2);
    const rr = tangent * Math.tan(half);
    const bx = ux + wx;
    const by = uy + wy;
    const bl = Math.hypot(bx, by);
    const [ox, oy] = [px + (bx / bl) * (rr / Math.sin(half)), py + (by / bl) * (rr / Math.sin(half))];
    const a0 = Math.atan2(py + uy * tangent - oy, px + ux * tangent - ox);
    let a1 = Math.atan2(py + wy * tangent - oy, px + wx * tangent - ox);
    // Recorre el arco corto.
    if (a1 - a0 > Math.PI) a1 -= Math.PI * 2;
    if (a0 - a1 > Math.PI) a1 += Math.PI * 2;
    for (let k = 0; k <= segments; k++) {
      const a = a0 + ((a1 - a0) * k) / segments;
      out.push([ox + rr * Math.cos(a), oy + rr * Math.sin(a)]);
    }
  }
  return out;
}

/** Arco de circunferencia (centro, radio, ángulos en rad) como lista de puntos. */
export function arc([cx, cy]: Pt, r: number, a0: number, a1: number, segments: number): Pt[] {
  return Array.from({ length: segments + 1 }, (_, k) => {
    const a = a0 + ((a1 - a0) * k) / segments;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as Pt;
  });
}

/** Contorno de engranaje centrado en el origen: dientes trapeciales entre el radio de fondo y el de cabeza. */
export function gearOutline(teeth: number, root: number, tip: number): Pt[] {
  const pts: Pt[] = [];
  const pitch = (Math.PI * 2) / teeth;
  for (let k = 0; k < teeth; k++) {
    const a = k * pitch;
    for (const [f, r] of [
      [-0.25, root],
      [-0.12, tip],
      [0.12, tip],
      [0.25, root],
    ]) {
      pts.push([r * Math.cos(a + f * pitch), r * Math.sin(a + f * pitch)]);
    }
  }
  return pts;
}

/**
 * Lazo de correa alrededor de poleas recorridas en sentido antihorario, desplazado `offset`
 * hacia fuera de cada polea: tangentes exteriores entre poleas y arcos sobre ellas.
 */
export function beltLoop(pulleys: { c: Pt; r: number }[], offset: number, arcStep = 0.12): Pt[] {
  const n = pulleys.length;
  // Normal exterior (a la derecha del sentido de marcha) de la tangente de cada polea a la siguiente.
  const normals = pulleys.map(({ c, r }, i) => {
    const next = pulleys[(i + 1) % n];
    const dx = next.c[0] - c[0];
    const dy = next.c[1] - c[1];
    const l = Math.hypot(dx, dy);
    const cos = (r - next.r) / l;
    const sin = Math.sqrt(1 - cos * cos);
    const [ux, uy] = [dx / l, dy / l];
    return [cos * ux + sin * uy, cos * uy - sin * ux] as Pt;
  });
  const pts: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const { c, r } = pulleys[i];
    const rin = normals[(i + n - 1) % n];
    const rout = normals[i];
    const a0 = Math.atan2(rin[1], rin[0]);
    let a1 = Math.atan2(rout[1], rout[0]);
    while (a1 < a0) a1 += Math.PI * 2;
    const segments = Math.max(2, Math.ceil((a1 - a0) / arcStep));
    pts.push(...arc(c, r + offset, a0, a1, segments));
  }
  return pts;
}
