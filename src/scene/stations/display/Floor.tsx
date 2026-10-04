'use client';

import type { Vec3 } from '@/config/layout';
import { palette } from '@/config/palette';
import { Block, Cyl, Prism, Tube } from '../../kit/primitives';
import { LIFT_TILES, PLATFORM } from './dims';

const c = palette;
const P = PLATFORM;
/** Perfil de aluminio del canto de la tarima. */
const TRIM = 0.02;
const TILE_Y = P.h - P.tileT;

/** Rectángulo de la baldosa (columna `k`, fila `r` desde el canto delantero), recortada al borde. */
function tileRect(k: number, r: number) {
  const x0 = Math.max(P.x0 + TRIM, P.x0 + k * P.tile);
  const x1 = Math.min(P.x1 - TRIM, P.x0 + (k + 1) * P.tile);
  const z1 = Math.min(P.z1 - TRIM, P.z1 - r * P.tile);
  const z0 = Math.max(P.z0 + TRIM, P.z1 - (r + 1) * P.tile);
  return { x0, x1, z0, z1 };
}

const COLS = Math.ceil((P.x1 - P.x0) / P.tile);
const ROWS = Math.ceil((P.z1 - P.z0) / P.tile);
const lifted = (k: number, r: number) => LIFT_TILES.some(([a, b]) => a === k && b === r);

/** Una baldosa (con su junta de 2 mm alrededor) y, si se pide, la rejilla de una baldosa perforada. */
export function Tile({ k, r, vented = false }: { k: number; r: number; vented?: boolean }) {
  const t = tileRect(k, r);
  const g = 0.001;
  return (
    <group>
      <Block min={[t.x0 + g, TILE_Y, t.z0 + g]} max={[t.x1 - g, P.h, t.z1 - g]} c={c.metalLight} />
      {vented &&
        Array.from({ length: 36 }, (_, i) => {
          const x = t.x0 + 0.1 + (i % 6) * 0.08;
          const z = t.z0 + 0.1 + Math.floor(i / 6) * 0.08;
          return <Block key={i} min={[x - 0.018, P.h, z - 0.018]} max={[x + 0.018, P.h + 0.002, z + 0.018]} c={c.metalMid} />;
        })}
    </group>
  );
}

/**
 * Tarima de suelo técnico: perfil de canto, forjado oscuro bajo las baldosas, baldosas de 600 mm
 * (una perforada delante del rack para el aire frío), cinta amarilla en el canto delantero y rampa
 * de acceso a la izquierda. Las baldosas que se levantan en el despiece van aparte.
 */
export function RaisedFloor() {
  const tiles: [number, number][] = [];
  for (let k = 0; k < COLS; k++) for (let r = 0; r < ROWS; r++) if (!lifted(k, r)) tiles.push([k, r]);
  return (
    <group>
      <Block min={[P.x0 + TRIM, 0, P.z0 + TRIM]} max={[P.x1 - TRIM, 0.006, P.z1 - TRIM]} c={c.metalDark} />
      {/* Perfil de canto, a los cuatro lados. */}
      <Block min={[P.x0, 0, P.z1 - TRIM]} max={[P.x1, P.h, P.z1]} c={c.metalMid} />
      <Block min={[P.x0, 0, P.z0]} max={[P.x1, P.h, P.z0 + TRIM]} c={c.metalMid} />
      <Block min={[P.x0, 0, P.z0 + TRIM]} max={[P.x0 + TRIM, P.h, P.z1 - TRIM]} c={c.metalMid} />
      <Block min={[P.x1 - TRIM, 0, P.z0 + TRIM]} max={[P.x1, P.h, P.z1 - TRIM]} c={c.metalMid} />
      {tiles.map(([k, r]) => (
        <Tile key={`${k}-${r}`} k={k} r={r} vented={k === 10 && r === 1} />
      ))}
      <Block min={[P.x0 + TRIM, P.h, P.z1 - 0.07]} max={[P.x1 - TRIM, P.h + 0.003, P.z1 - TRIM]} c={c.signalYellow} />
      {/* Rampa de chapa lagrimada, con su canto amarillo arriba. */}
      <Prism
        outline={[
          [P.x0 - 0.7, 0],
          [P.x0, 0],
          [P.x0, P.h],
        ]}
        plane="xy"
        from={-1.75}
        depth={0.8}
        c={c.metalMid}
      />
      <Block min={[P.x0 - 0.06, P.h - 0.012, -1.75]} max={[P.x0, P.h, -0.95]} c={c.signalYellow} />
    </group>
  );
}

/** Recorrido de la bandeja de cables bajo el suelo: de la consola al rack. */
const TRAY = { x0: 1.18, x1: 3.3, z: -2.3, y0: 0.008, half: 0.11, wall: 0.045 };

/**
 * Lo que dejan ver las baldosas levantadas: pedestales con su cabeza, bandeja de rejilla y los
 * cables que corren por ella (datos y alimentación de la consola y del videowall al rack).
 */
export function UnderFloor() {
  const corners = new Set<string>();
  for (const [k, r] of LIFT_TILES) {
    const t = tileRect(k, r);
    for (const x of [t.x0, t.x1]) for (const z of [t.z0, t.z1]) corners.add(`${x.toFixed(3)},${z.toFixed(3)}`);
  }
  const { x0, x1, z, y0, half, wall } = TRAY;
  const cables: [string, number, number][] = [
    [c.stripeBlack, -0.06, 0.018],
    [c.green, -0.02, 0.014],
    [c.metalLight, 0.02, 0.014],
    [c.stripeBlack, 0.065, 0.02],
  ];
  return (
    <group>
      {[...corners].map((s) => {
        const [x, zz] = s.split(',').map(Number);
        return (
          <group key={s}>
            <Cyl p={[x, TILE_Y / 2, zz]} radius={0.016} length={TILE_Y - 0.01} c={c.metalMid} />
            <Block min={[x - 0.045, TILE_Y - 0.01, zz - 0.045]} max={[x + 0.045, TILE_Y, zz + 0.045]} c={c.metalMid} />
          </group>
        );
      })}
      <Block min={[x0, y0, z - half]} max={[x1, y0 + 0.006, z + half]} c={c.metalMid} />
      {[-1, 1].map((s) => (
        <Block key={s} min={[x0, y0, z + s * half - 0.003]} max={[x1, y0 + wall, z + s * half + 0.003]} c={c.metalMid} />
      ))}
      {Array.from({ length: Math.floor((x1 - x0) / 0.15) }, (_, i) => (
        <Block key={i} min={[x0 + 0.07 + i * 0.15 - 0.004, y0 + 0.006, z - half]} max={[x0 + 0.07 + i * 0.15 + 0.004, y0 + 0.012, z + half]} c={c.metalMid} />
      ))}
      {cables.map(([color, dz, r], i) => {
        const y = y0 + 0.008 + r;
        const pts: Vec3[] = [
          [x0 - 0.05, y, z + dz],
          [x0 + 0.6, y, z + dz * 1.1],
          [x0 + 1.3, y, z + dz * 0.9],
          [x1 + 0.05, y, z + dz],
        ];
        return <Tube key={i} points={pts} radius={r} bend={0.3} c={color} />;
      })}
    </group>
  );
}
