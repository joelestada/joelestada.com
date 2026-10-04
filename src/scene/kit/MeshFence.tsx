'use client';

import { useMemo } from 'react';
import * as THREE from 'three';
import { palette } from '@/config/palette';
import { DECAL_LAYER } from '../materials';
import { createGridMaterial } from '../effects/GridMaterial';
import { Bar, Block } from './primitives';
import { shared } from '../shared';

const POST = 0.055;
const RAIL = 0.04;
const BOTTOM_RAIL_Y = 0.16;
const MAX_PANEL = 1.25;
/** El poste asoma sobre el larguero: caras superiores coplanarias hacían z-fighting (parpadeo del trazo). */
const POST_CAP = 0.018;
/** Luz de la malla (m) y grosor de hilo (px internos). */
const MESH_CELL = 0.075;
const MESH_LINE = 1.3;
const MESH_OPACITY = 0.62;

let meshMaterial: THREE.ShaderMaterial | null = null;
function getMeshMaterial() {
  meshMaterial ??= shared(
    createGridMaterial({
      line: palette.fenceMesh,
      cell: [MESH_CELL, MESH_CELL],
      lineWidth: MESH_LINE,
      opacity: MESH_OPACITY,
    }),
  );
  return meshMaterial;
}

type Point = [number, number];

/** Reparte un tramo recto en paneles de como mucho MAX_PANEL. */
function subdivide(path: Point[]) {
  const posts: Point[] = [path[0]];
  for (let i = 1; i < path.length; i++) {
    const [ax, az] = path[i - 1];
    const [bx, bz] = path[i];
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / MAX_PANEL));
    for (let k = 1; k <= n; k++) posts.push([ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n]);
  }
  return posts;
}

/**
 * Vallado perimetral: postes, largueros y paneles de malla metálica.
 * La malla va en la capa de calcomanías: se ve a través y no se entinta.
 */
export function MeshFence({ path, height = 2 }: { path: Point[]; height?: number }) {
  const posts = useMemo(() => subdivide(path), [path]);

  const meshGeometry = useMemo(() => {
    const pos: number[] = [];
    const uv: number[] = [];
    const y0 = BOTTOM_RAIL_Y + RAIL / 2;
    const y1 = height - RAIL / 2;
    let run = 0;
    for (let i = 1; i < posts.length; i++) {
      const [ax, az] = posts[i - 1];
      const [bx, bz] = posts[i];
      const len = Math.hypot(bx - ax, bz - az);
      const quad = [
        [ax, y0, az, run, y0],
        [bx, y0, bz, run + len, y0],
        [bx, y1, bz, run + len, y1],
        [ax, y1, az, run, y1],
      ];
      for (const k of [0, 1, 2, 0, 2, 3]) {
        pos.push(quad[k][0], quad[k][1], quad[k][2]);
        uv.push(quad[k][3], quad[k][4]);
      }
      run += len;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    return g;
  }, [posts, height]);

  return (
    <group>
      {posts.map(([x, z], i) => (
        <group key={i}>
          <Block min={[x - POST / 2, 0, z - POST / 2]} max={[x + POST / 2, height + POST_CAP, z + POST / 2]} c={palette.metalLight} />
          <Block min={[x - 0.07, 0, z - 0.07]} max={[x + 0.07, 0.015, z + 0.07]} c={palette.metalMid} />
        </group>
      ))}
      {posts.slice(1).map(([x, z], i) => {
        const [px, pz] = posts[i];
        return (
          <group key={i}>
            <Bar a={[px, height - RAIL / 2, pz]} b={[x, height - RAIL / 2, z]} t={RAIL} c={palette.metalLight} />
            <Bar a={[px, BOTTOM_RAIL_Y, pz]} b={[x, BOTTOM_RAIL_Y, z]} t={RAIL} c={palette.metalLight} />
          </group>
        );
      })}
      <mesh geometry={meshGeometry} material={getMeshMaterial()} layers={DECAL_LAYER} renderOrder={2} />
    </group>
  );
}
