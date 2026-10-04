import * as THREE from 'three';
import { cameraDirection, type Vec3 } from '@/config/layout';

/** Ejes de pantalla en coordenadas de mundo (la cámara no rota nunca). */
export function screenAxes() {
  const m = new THREE.Matrix4().lookAt(new THREE.Vector3(...cameraDirection()), new THREE.Vector3(), new THREE.Vector3(0, 1, 0));
  const right = new THREE.Vector3().setFromMatrixColumn(m, 0);
  const up = new THREE.Vector3().setFromMatrixColumn(m, 1);
  const back = new THREE.Vector3().setFromMatrixColumn(m, 2);
  return { right, up, back };
}

/**
 * Trazos finos de grosor constante en pantalla: cada segmento es un quad
 * orientado hacia la cámara. Sustituye a las líneas GL (1 px de dispositivo).
 */
export function ribbonGeometry(segments: [Vec3, Vec3][], width: number) {
  const { back } = screenAxes();
  const pos: number[] = [];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const side = new THREE.Vector3();
  for (const [p, q] of segments) {
    a.set(...p);
    b.set(...q);
    side
      .subVectors(b, a)
      .cross(back)
      .normalize()
      .multiplyScalar(width / 2);
    const v = [a.clone().sub(side), b.clone().sub(side), b.clone().add(side), a.clone().add(side)];
    for (const k of [0, 2, 1, 0, 3, 2]) pos.push(v[k].x, v[k].y, v[k].z);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return g;
}

/**
 * Trazo continuo a lo largo de una polilínea, orientado a cámara y adelantado `lift` hacia ella
 * (para dibujarse sobre la cara visible de un tubo). Lleva `aDist`: metros recorridos desde el inicio.
 */
export function pathRibbon(points: Vec3[], width: number, lift = 0) {
  const { back } = screenAxes();
  const pos: number[] = [];
  const dist: number[] = [];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const side = new THREE.Vector3();
  const raise = back.clone().multiplyScalar(lift);
  let run = 0;
  for (let i = 1; i < points.length; i++) {
    a.set(...points[i - 1]).add(raise);
    b.set(...points[i]).add(raise);
    const len = a.distanceTo(b);
    side
      .subVectors(b, a)
      .cross(back)
      .normalize()
      .multiplyScalar(width / 2);
    const v = [a.clone().sub(side), b.clone().sub(side), b.clone().add(side), a.clone().add(side)];
    const d = [run, run + len, run + len, run];
    for (const k of [0, 2, 1, 0, 3, 2]) {
      pos.push(v[k].x, v[k].y, v[k].z);
      dist.push(d[k]);
    }
    run += len;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aDist', new THREE.Float32BufferAttribute(dist, 1));
  return g;
}
