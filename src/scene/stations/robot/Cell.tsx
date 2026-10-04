'use client';

import { FLOW } from '@/config/layout';
import { palette } from '@/config/palette';
import type { Pt } from '../../kit/geometry';
import { Anchor } from '../../kit/hardware';
import { Block, Box, Cyl, Prism, Tube } from '../../kit/primitives';

const c = palette;

/** Alimentador de tapas (local de la estación): columna cargador y plato de recogida arriba. */
export const FEEDER = { x: 0.95, z: -0.95, top: 0.95, half: 0.13 };

/**
 * Cargador de tapas: placa anclada, columna con la ventana por la que se ve la pila de tapas, plato
 * de recogida, cilindro elevador por la izquierda y detector de presencia apuntando a la tapa. La
 * tapa que espera arriba (y sube al reponerse) la pone la estación.
 */
export function Feeder() {
  const { x, z, top, half } = FEEDER;
  const capH = FLOW.cap.h;
  return (
    <group>
      <Block min={[x - 0.22, 0, z - 0.22]} max={[x + 0.22, 0.03, z + 0.22]} c={c.metalMid} />
      {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => <Anchor key={`${sx}${sz}`} p={[x + sx * 0.17, 0.03, z + sz * 0.17]} r={0.016} />))}
      <Block min={[x - half, 0.03, z - half]} max={[x + half, top - 0.03, z + half]} c={c.metalLight} />
      {/* Ventana con la pila de tapas que esperan turno. */}
      <Block min={[x - 0.05, 0.22, z + half]} max={[x + 0.05, top - 0.12, z + half + 0.004]} c={c.stripeBlack} />
      {Array.from({ length: 9 }, (_, k) => {
        const y = 0.24 + k * (capH + 0.014);
        return <Block key={k} min={[x - 0.045, y, z + half + 0.004]} max={[x + 0.045, y + capH, z + half + 0.008]} c={c.signalYellow} />;
      })}
      <Cyl p={[x, top - 0.015, z]} radius={FLOW.cap.r + 0.03} length={0.03} segments={28} c={c.metalMid} />
      {/* Cilindro elevador con su escuadra. */}
      <Block min={[x - half - 0.07, 0.12, z - 0.04]} max={[x - half, 0.16, z + 0.04]} c={c.metalDark} />
      <Cyl p={[x - half - 0.04, 0.42, z]} radius={0.028} length={0.56} c={c.metalLight} />
      <Cyl p={[x - half - 0.04, 0.17, z]} radius={0.033} length={0.04} segments={6} c={c.metalMid} />
      <Cyl p={[x - half - 0.04, 0.68, z]} radius={0.033} length={0.04} segments={6} c={c.metalMid} />
      {/* Detector de presencia sobre su brazo, mirando a la tapa. */}
      <Block min={[x - half - 0.02, top - 0.03, z + half - 0.03]} max={[x - half, top + 0.07, z + half]} c={c.metalDark} />
      <Cyl p={[x - half + 0.02, top + 0.05, z + half - 0.015]} radius={0.012} length={0.06} axis="x" c={c.metalMid} />
      <Box p={[x - half - 0.012, top + 0.05, z + half - 0.015]} s={[0.004, 0.01, 0.01]} c={c.andonGreen} />
    </group>
  );
}

/**
 * Barreras fotoeléctricas con muting en las dos aberturas por las que la línea entra y sale del
 * vallado: un poste a cada lado de la cinta, con la ventana mirando al otro.
 */
export function LightCurtains({ xs, z }: { xs: number[]; z: number }) {
  return (
    <group>
      {xs.flatMap((x) =>
        [-1, 1].map((s) => {
          const zz = s * z;
          const lens = s > 0 ? [zz - 0.03, zz - 0.026] : [zz + 0.026, zz + 0.03];
          return (
            <group key={`${x}${s}`}>
              <Block min={[x - 0.05, 0, zz - 0.05]} max={[x + 0.05, 0.02, zz + 0.05]} c={c.metalDark} />
              <Block min={[x - 0.026, 0.02, zz - 0.026]} max={[x + 0.026, 1.42, zz + 0.026]} c={c.signalYellow} />
              <Block min={[x - 0.03, 1.42, zz - 0.03]} max={[x + 0.03, 1.46, zz + 0.03]} c={c.stripeBlack} />
              <Block min={[x - 0.015, 0.25, lens[0]]} max={[x + 0.015, 1.34, lens[1]]} c={c.stripeBlack} />
              <Box p={[x - 0.027, 1.38, zz]} s={[0.004, 0.012, 0.012]} c={c.andonGreen} />
            </group>
          );
        }),
      )}
    </group>
  );
}

/**
 * Consola de programación colgada en el costado del armario del robot (`x` es esa cara): soporte,
 * consola con su pantalla y la seta, y el cable en espiral que baja al armario.
 */
export function TeachPendant({ x, y, z }: { x: number; y: number; z: number }) {
  const px = x - 0.03;
  return (
    <group>
      <Block min={[x - 0.03, y + 0.1, z - 0.08]} max={[x, y + 0.14, z + 0.08]} c={c.metalMid} />
      <Block min={[px - 0.03, y - 0.18, z - 0.13]} max={[px, y + 0.12, z + 0.13]} c={c.stripeBlack} />
      <Block min={[px - 0.034, y - 0.1, z - 0.09]} max={[px - 0.03, y + 0.08, z + 0.09]} c={c.screen} />
      <Cyl p={[px - 0.04, y + 0.06, z + 0.11]} radius={0.018} length={0.02} axis="x" c={c.andonRed} />
      <Block min={[px - 0.034, y - 0.16, z - 0.08]} max={[px - 0.03, y - 0.12, z + 0.06]} c={c.metalDark} />
      <Tube
        points={[
          [px - 0.015, y - 0.18, z],
          [px - 0.03, y - 0.5, z + 0.04],
          [px - 0.02, y - 0.72, z + 0.1],
          [x, y - 0.8, z + 0.12],
        ]}
        radius={0.012}
        bend={0.15}
        c={c.stripeBlack}
      />
    </group>
  );
}

/** Sección del protector de cables (ancho en el eje transversal, alto): base negra y tapa amarilla. */
const PROTECTOR: Pt[] = [
  [-0.09, 0],
  [0.09, 0],
  [0.05, 0.032],
  [-0.05, 0.032],
];
const LID: Pt[] = [
  [-0.04, 0.03],
  [0.04, 0.03],
  [0.034, 0.036],
  [-0.034, 0.036],
];

/**
 * Pasacables de suelo del armario al robot: cruza bajo la cinta entre dos patas y gira hasta la
 * base. Tramos rectos de `a` a `b`, a lo largo de X o de Z.
 */
export function CableProtector({ path }: { path: [number, number][] }) {
  return (
    <group>
      {path.slice(1).map(([bx, bz], i) => {
        const [ax, az] = path[i];
        const alongX = Math.abs(bx - ax) > Math.abs(bz - az);
        const flip = (pts: Pt[]): Pt[] => pts.map(([u, v]) => [u + (alongX ? az : ax), v]);
        const from = alongX ? Math.min(ax, bx) : Math.min(az, bz);
        const depth = Math.abs(alongX ? bx - ax : bz - az);
        return (
          <group key={i}>
            <Prism outline={flip(PROTECTOR)} plane={alongX ? 'zy' : 'xy'} from={from} depth={depth} c={c.stripeBlack} />
            <Prism outline={flip(LID)} plane={alongX ? 'zy' : 'xy'} from={from} depth={depth} c={c.signalYellow} />
          </group>
        );
      })}
      {path.slice(1, -1).map(([x, z]) => (
        <Block key={`${x}${z}`} min={[x - 0.09, 0, z - 0.09]} max={[x + 0.09, 0.032, z + 0.09]} c={c.stripeBlack} />
      ))}
    </group>
  );
}
