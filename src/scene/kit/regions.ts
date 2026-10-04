import type * as THREE from 'three';
import { markDirty, requestAmbient, runtime } from '@/lib/runtime';

/** Caja local de una estación: min x, y, z y max x, y, z (m). */
export type Region = readonly [number, number, number, number, number, number];

/** Margen (px CSS) para dar por visible una caja que asoma por el borde. */
const EDGE = 24;

/** La caja (desplazada `ox` en X) cae, al menos en parte, dentro de la vista. */
export function regionOnScreen(r: Region, ox: number) {
  const project = runtime.project;
  if (!project || typeof window === 'undefined') return false;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (let i = 0; i < 8; i++) {
    const [px, py] = project(ox + (i & 1 ? r[3] : r[0]), i & 2 ? r[4] : r[1], i & 4 ? r[5] : r[2]);
    x0 = Math.min(x0, px);
    y0 = Math.min(y0, py);
    x1 = Math.max(x1, px);
    y1 = Math.max(y1, py);
  }
  return x1 > -EDGE && x0 < window.innerWidth + EDGE && y1 > -EDGE && y0 < window.innerHeight + EDGE;
}

/**
 * Una estación ha movido piezas dentro de estas cajas en este frame: se declaran para el
 * repintado parcial y, si alguna se ve, se pide el frame siguiente para seguir la animación.
 * Devuelve si se ve (una estación fuera de vista no gasta ningún frame).
 */
export function animateRegions(regions: readonly Region[], ox: number, keepGoing = true) {
  let visible = false;
  for (const r of regions) {
    if (!regionOnScreen(r, ox)) continue;
    markDirty(ox + r[0], r[1], r[2], ox + r[3], r[4], r[5]);
    visible = true;
  }
  if (visible && keepGoing) requestAmbient();
  return visible;
}

const basis = { right: null as null | THREE.Vector3, up: null as null | THREE.Vector3, fwd: null as null | THREE.Vector3 };

/**
 * Ajusta un punto del mundo a la rejilla de píxeles de la cámara (como hace la propia cámara):
 * un objeto que se desplaza lo hace de píxel en píxel y su trazo no tiembla. Modifica `p`.
 */
export function snapToPixels(p: THREE.Vector3, camera: THREE.OrthographicCamera, pixelRatio: number) {
  const right = (basis.right ??= p.clone()).setFromMatrixColumn(camera.matrixWorld, 0);
  const up = (basis.up ??= p.clone()).setFromMatrixColumn(camera.matrixWorld, 1);
  const fwd = (basis.fwd ??= p.clone()).setFromMatrixColumn(camera.matrixWorld, 2).negate();
  const px = 1 / (camera.zoom * pixelRatio);
  const r = Math.round(p.dot(right) / px) * px;
  const u = Math.round(p.dot(up) / px) * px;
  const f = p.dot(fwd);
  return p.copy(right).multiplyScalar(r).addScaledVector(up, u).addScaledVector(fwd, f);
}
