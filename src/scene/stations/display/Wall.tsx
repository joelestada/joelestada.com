'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { palette } from '@/config/palette';
import { DECAL_LAYER, flat } from '../../materials';
import { shared } from '../../shared';
import { Bar, Block, Box, Cyl } from '../../kit/primitives';
import { SCREEN_PX } from '../screenArt';
import { CONTROLLER, MODULE, PLATFORM, READOUT, SCREEN, STAND } from './dims';

const c = palette;
const FLOOR = PLATFORM.h;

/** Centro de un módulo: columna `col` (0 a la izquierda) y fila `row` (0 abajo). */
function moduleCenter(col: number, row: number): [number, number] {
  return [-SCREEN.w / 2 + (col + 0.5) * MODULE.w, SCREEN.y0 + (row + 0.5) * MODULE.h];
}

/** Punto de la pantalla (m, marco de la estación) a partir de un píxel del dibujo. */
function screenPoint(px: number, py: number): [number, number] {
  return [-SCREEN.w / 2 + (px / SCREEN_PX.w) * SCREEN.w, SCREEN.y0 + SCREEN.h - (py / SCREEN_PX.h) * SCREEN.h];
}

/** Superficie activa de un módulo: su trozo del dibujo (UV) en un plano, con la junta alrededor. */
function moduleGeometry(col: number, row: number) {
  const w = MODULE.w - 2 * SCREEN.seam;
  const h = MODULE.h - 2 * SCREEN.seam;
  const g = new THREE.PlaneGeometry(w, h);
  const [cx, cy] = moduleCenter(col, row);
  const u0 = (cx - w / 2 + SCREEN.w / 2) / SCREEN.w;
  const v0 = (cy - h / 2 - SCREEN.y0) / SCREEN.h;
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * (w / SCREEN.w), v0 + uv.getY(i) * (h / SCREEN.h));
  return g;
}

const geometries = new Map<string, THREE.BufferGeometry>();
function activeArea(col: number, row: number) {
  const key = `${col},${row}`;
  let g = geometries.get(key);
  if (!g) {
    g = shared(moduleGeometry(col, row));
    geometries.set(key, g);
  }
  return g;
}

/**
 * Módulo del videowall: carcasa trasera, marco frontal (la junta oscura entre módulos) y su trozo
 * de imagen, que dibuja el material de la pantalla.
 */
export function Module({ col, row, material }: { col: number; row: number; material: THREE.Material }) {
  const [cx, cy] = moduleCenter(col, row);
  const { z, depth } = SCREEN;
  const hw = MODULE.w / 2;
  const hh = MODULE.h / 2;
  return (
    <group>
      <Block min={[cx - hw + 0.02, cy - hh + 0.02, z - depth]} max={[cx + hw - 0.02, cy + hh - 0.02, z - 0.012]} c={c.metalDark} />
      <Block min={[cx - hw, cy - hh, z - 0.012]} max={[cx + hw, cy + hh, z]} c={c.stripeBlack} />
      <mesh position={[cx, cy, z + 0.004]} geometry={activeArea(col, row)} material={material} layers={DECAL_LAYER} />
    </group>
  );
}

/**
 * Pie del videowall: montantes con sus patas, niveladores y tornapuntas traseros; travesaños con un
 * par de soportes de enganche por módulo; travesaño bajo con la balda del controlador y canaleta
 * de cables por el montante derecho.
 */
export function Stand() {
  const { xs, z0, z1, top, rails, railX, railZ } = STAND;
  return (
    <group>
      {xs.map((x) => (
        <group key={x}>
          <Block min={[x - 0.05, FLOOR + 0.06, z0]} max={[x + 0.05, top, z1]} c={c.metalMid} />
          <Block min={[x - 0.06, FLOOR, -3.3]} max={[x + 0.06, FLOOR + 0.06, -2.24]} c={c.metalMid} />
          {[-3.25, -2.29].map((zz) => (
            <Cyl key={zz} p={[x, FLOOR + 0.006, zz]} radius={0.035} length={0.012} c={c.metalDark} />
          ))}
          <Bar a={[x, FLOOR + 0.06, -3.22]} b={[x, 1.2, z0]} t={0.045} c={c.metalMid} />
          <Block min={[x - 0.06, top, z0 - 0.01]} max={[x + 0.06, top + 0.012, z1 + 0.01]} c={c.metalDark} />
        </group>
      ))}
      {rails.map((y) => (
        <Block key={y} min={[-railX, y - 0.03, railZ[0]]} max={[railX, y + 0.03, railZ[1]]} c={c.metalMid} />
      ))}
      {Array.from({ length: 9 }, (_, i) => {
        const [cx, cy] = moduleCenter(i % 3, Math.floor(i / 3));
        const y = rails.reduce((a, b) => (Math.abs(b - cy) < Math.abs(a - cy) ? b : a));
        return [-0.36, 0.36].map((dx) => (
          <Block key={`${i}${dx}`} min={[cx + dx - 0.04, y - 0.05, railZ[1]]} max={[cx + dx + 0.04, y + 0.05, SCREEN.z - SCREEN.depth]} c={c.metalDark} />
        ));
      })}
      <Block min={[xs[0], CONTROLLER.y0 - 0.08, z0]} max={[xs[1], CONTROLLER.y0 - 0.02, z1]} c={c.metalMid} />
      <Block
        min={[CONTROLLER.x0 - 0.06, CONTROLLER.y0 - 0.02, CONTROLLER.z0 - 0.02]}
        max={[CONTROLLER.x1 + 0.06, CONTROLLER.y0, CONTROLLER.z1]}
        c={c.metalMid}
      />
      <Block min={[xs[1] - 0.105, FLOOR + 0.1, z1 - 0.06]} max={[xs[1] - 0.05, 3.2, z1]} c={c.metalDark} />
    </group>
  );
}

/** Controlador del videowall en su balda: rejilla, pilotos y la pantallita de estado. */
export function WallController() {
  const { x0, x1, y0, y1, z0, z1 } = CONTROLLER;
  return (
    <group>
      <Block min={[x0, y0, z0]} max={[x1, y1, z1]} c={c.metalDark} />
      <Block min={[x0 + 0.03, y0 + 0.05, z1]} max={[x0 + 0.17, y1 - 0.05, z1 + 0.004]} c={c.screen} />
      {[0, 1, 2, 3].map((k) => (
        <Box key={k} p={[x0 + 0.24 + k * 0.035, y1 - 0.045, z1 + 0.002]} s={[0.014, 0.014, 0.004]} c={k < 3 ? c.andonGreen : c.metalMid} />
      ))}
      {[0, 1, 2, 3, 4].map((k) => (
        <Block key={k} min={[x0 + 0.24, y0 + 0.03 + k * 0.018, z1]} max={[x1 - 0.04, y0 + 0.038 + k * 0.018, z1 + 0.003]} c={c.stripeBlack} />
      ))}
    </group>
  );
}

/** Cámara de videoconferencia sobre el módulo central de arriba. */
export function Camera() {
  const top = SCREEN.y0 + SCREEN.h;
  const { z } = SCREEN;
  return (
    <group>
      <Block min={[-0.05, top - 0.03, z - 0.06]} max={[0.05, top, z - 0.04]} c={c.metalDark} />
      <Block min={[-0.13, top, z - 0.09]} max={[0.13, top + 0.065, z - 0.02]} c={c.stripeBlack} />
      <Cyl p={[0, top + 0.033, z - 0.012]} radius={0.022} length={0.02} axis="z" c={c.metalMid} />
      <Box p={[0.08, top + 0.033, z - 0.019]} s={[0.01, 0.01, 0.004]} c={c.andonGreen} />
    </group>
  );
}

/**
 * Lectura de la pieza en el módulo central de abajo: los cuatro factores del motor, cada uno un
 * cuarto de la barra (rellenos), y la nota final sobre la escala 0–100 (marca amarilla). Las
 * pistas, las etiquetas y la escala están en el dibujo; aquí solo lo que se mueve.
 */
export type ReadoutState = { fills: number[]; score: number };

const fillGeometry = shared(new THREE.PlaneGeometry(1, 1).translate(0.5, 0, 0));

export function Readout({ state }: { state: ReadoutState }) {
  const fills = useRef<(THREE.Mesh | null)[]>([]);
  const marker = useRef<THREE.Mesh>(null);
  const { bar, scale } = READOUT;
  const seg = (bar.x1 - bar.x0 - 3 * bar.gap) / 4;
  const z = SCREEN.z + 0.006;
  const layout = useMemo(() => {
    const [, y0] = screenPoint(0, bar.y1);
    const [, y1] = screenPoint(0, bar.y0);
    const starts = [0, 1, 2, 3].map((i) => screenPoint(bar.x0 + i * (seg + bar.gap), 0)[0]);
    const segW = (seg / SCREEN_PX.w) * SCREEN.w;
    const [sx0, sy] = screenPoint(bar.x0, scale.y);
    const [sx1] = screenPoint(bar.x1, scale.y);
    return { y: (y0 + y1) / 2, h: y1 - y0, starts, segW, sx0, sx1, sy, mh: (scale.h / SCREEN_PX.h) * SCREEN.h };
  }, [bar, scale, seg]);
  const last = useRef('');

  useFrame(() => {
    const key = `${state.fills.map((f) => f.toFixed(3)).join()}|${state.score.toFixed(3)}`;
    if (key === last.current) return;
    last.current = key;
    state.fills.forEach((f, i) => {
      const m = fills.current[i];
      if (!m) return;
      m.visible = f > 0.002;
      m.scale.x = Math.max(f, 0.002) * layout.segW;
    });
    if (marker.current) {
      marker.current.visible = state.score > 0.002;
      marker.current.position.x = layout.sx0 + state.score * (layout.sx1 - layout.sx0);
    }
  }, 0.5);

  return (
    <group>
      {layout.starts.map((x, i) => (
        <mesh
          key={i}
          ref={(m) => {
            fills.current[i] = m;
          }}
          position={[x, layout.y, z]}
          scale={[0.001, layout.h, 1]}
          geometry={fillGeometry}
          material={flat(c.screenInk)}
          layers={DECAL_LAYER}
          renderOrder={2}
          visible={false}
        />
      ))}
      <mesh ref={marker} position={[layout.sx0, layout.sy, z]} layers={DECAL_LAYER} renderOrder={2} material={flat(c.signalYellow)} visible={false}>
        <planeGeometry args={[0.018, layout.mh]} />
      </mesh>
    </group>
  );
}
