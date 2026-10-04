'use client';

import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { BUILDING } from '@/config/layout';
import { palette } from '@/config/palette';
import { markFull, runtime } from '@/lib/runtime';
import { DECAL_LAYER } from '../materials';

/**
 * Luz de la hora real del visitante. De día entra el sol por unos lucernarios altos del muro del
 * fondo (fuera de plano) y deja manchas suaves en el suelo que cambian de ángulo y de largo con la
 * hora. De noche no hay sol y los focos colgantes quedan a media luz. Se recalcula cada minuto.
 * Para verlo a otra hora: ?hour=21 en la dirección.
 */

/** Ventanas: una por paño entre pilastras del muro del fondo, en lo alto (m). */
const WINDOW = { y0: 7.3, y1: 8.6, inset: 0.7 };
const PANELS = [BUILDING.stepX, ...BUILDING.backWallPilasterXs, BUILDING.endWallX];
/** Sol: salida, puesta, altura máxima (rad) y giro máximo respecto a la perpendicular al muro. */
const SUN = { rise: 7, set: 20, maxElevation: 1.08, sweep: 0.95 };
/** Altura mínima del sol para dibujar manchas (por debajo serían tiras larguísimas). */
const MIN_ELEVATION = 0.3;
const OPACITY = 0.3;
const FLOOR_Y = 0.006;
/** Noche plena de 21:30 a 6:00; transiciones de una hora. */
const NIGHT = { dusk: [20.5, 21.5], dawn: [6, 7] } as const;

function hourNow() {
  if (typeof window !== 'undefined') {
    const q = new URLSearchParams(window.location.search).get('hour');
    if (q !== null && Number.isFinite(Number(q))) return ((Number(q) % 24) + 24) % 24;
  }
  const d = new Date();
  return d.getHours() + d.getMinutes() / 60;
}

function nightLevel(h: number) {
  const ramp = (a: number, b: number, x: number) => Math.min(1, Math.max(0, (x - a) / (b - a)));
  if (h >= NIGHT.dusk[0]) return ramp(NIGHT.dusk[0], NIGHT.dusk[1], h);
  if (h <= NIGHT.dawn[1]) return 1 - ramp(NIGHT.dawn[0], NIGHT.dawn[1], h);
  return 0;
}

/** Triángulos de las manchas de sol a la hora `h` (vacío si el sol está bajo o es de noche). */
function patches(h: number) {
  const u = (h - SUN.rise) / (SUN.set - SUN.rise);
  if (u <= 0 || u >= 1) return { positions: new Float32Array(0), strength: 0 };
  const e = SUN.maxElevation * Math.sin(Math.PI * u);
  if (e < MIN_ELEVATION) return { positions: new Float32Array(0), strength: 0 };
  const az = -SUN.sweep * Math.cos(Math.PI * u);
  // Dirección de la luz (hacia dentro de la nave, +Z) y cuánto avanza por metro que baja.
  const run = Math.cos(e) / Math.sin(e);
  const dx = Math.sin(az) * run;
  const dz = Math.cos(az) * run;
  const z = BUILDING.backWallZ;
  const out: number[] = [];
  for (let i = 0; i < PANELS.length - 1; i++) {
    const xa = PANELS[i] + WINDOW.inset;
    const xb = PANELS[i + 1] - WINDOW.inset;
    if (xb - xa < 1) continue;
    const at = (x: number, y: number) => [x + dx * y, FLOOR_Y, z + dz * y];
    const a = at(xa, WINDOW.y0);
    const b = at(xb, WINDOW.y0);
    const c = at(xb, WINDOW.y1);
    const d = at(xa, WINDOW.y1);
    out.push(...a, ...c, ...b, ...a, ...d, ...c);
  }
  // Con el sol bajo, la mancha se alarga y se difumina.
  const strength = Math.min(1, (e - MIN_ELEVATION) / 0.25);
  return { positions: new Float32Array(out), strength };
}

/** Vértices como mucho: dos triángulos por paño. */
const MAX_VERTICES = (PANELS.length - 1) * 6;

export function Daylight() {
  const invalidate = useThree((s) => s.invalidate);
  const { geometry, material } = useMemo(
    () => ({
      // Un solo búfer para todo el día: cambiar de atributo cada minuto dejaba el anterior en la GPU.
      geometry: new THREE.BufferGeometry().setAttribute(
        'position',
        new THREE.BufferAttribute(new Float32Array(MAX_VERTICES * 3), 3).setUsage(THREE.DynamicDrawUsage),
      ),
      material: new THREE.MeshBasicMaterial({
        color: palette.sunlight,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    }),
    [],
  );

  useEffect(() => {
    let key = '';
    const update = () => {
      const h = hourNow();
      const { positions, strength } = patches(h);
      const night = nightLevel(h);
      // Solo se toca la escena si cambia algo visible (a lo sumo una vez por minuto).
      const next = `${Math.round(h * 60)}|${night.toFixed(3)}`;
      if (next === key) return;
      key = next;
      const attribute = geometry.getAttribute('position') as THREE.BufferAttribute;
      (attribute.array as Float32Array).set(positions);
      attribute.needsUpdate = true;
      geometry.setDrawRange(0, positions.length / 3);
      geometry.computeBoundingSphere();
      material.opacity = OPACITY * strength;
      runtime.night = night;
      // Las manchas cubren media nave: se repinta entera (una vez por minuto como mucho).
      markFull();
      invalidate();
    };
    update();
    const id = setInterval(update, 60_000);
    return () => {
      clearInterval(id);
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material, invalidate]);

  return <mesh geometry={geometry} material={material} layers={DECAL_LAYER} renderOrder={1} frustumCulled={false} />;
}
