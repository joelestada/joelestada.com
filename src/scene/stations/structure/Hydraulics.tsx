'use client';

import type { RefObject } from 'react';
import type * as THREE from 'three';
import type { Vec3 } from '@/config/layout';
import { palette } from '@/config/palette';
import { Block, Bolt, Box, Cyl, Dome, Merge, Tube } from '../../kit/primitives';
import { ACT, COLUMN, HOSE, HPU, HSM, RIG_Z } from './dims';

const c = palette;

/** Motor eléctrico del grupo: eje en X sobre la tapa del depósito. */
const MOTOR = { x0: 3.33, x1: 3.63, y: 0.79, z: -2.72, r: 0.13 };
/** Bloque de presión (con su manómetro) delante de la bomba y filtro de retorno. */
const BLOCK = { x0: 3.0, x1: 3.2, y1: 0.78, z0: -2.5, z1: -2.32 };
const RETURN_FILTER = { x: 3.3, z: -2.42, top: 0.83 };
/** Tomas del bloque de servicio, por debajo (tuberías rígidas) y por arriba (latiguillos). */
const HSM_PORTS = { pressure: [2.58, -2.34] as const, ret: [2.68, -2.22] as const };
/** Tuberías rígidas: van bajas, por encima de la tapa, y suben por el costado del pilar. */
const PIPE_Y = { pressure: 0.88, ret: 0.98 };

/** Manómetro de esfera con su aguja, en una cara +Z. */
function Gauge({ p, r }: { p: Vec3; r: number }) {
  const [x, y, z] = p;
  return (
    <group>
      <Cyl p={[x, y, z + 0.01]} radius={r} length={0.02} axis="z" segments={24} c={c.stripeBlack} />
      <Cyl p={[x, y, z + 0.021]} radius={r * 0.82} length={0.003} axis="z" segments={24} c={c.screenInk} />
      <Box p={[x + r * 0.22, y + r * 0.22, z + 0.024]} s={[r * 0.7, 0.005, 0.002]} r={[0, 0, Math.PI / 4]} c={c.stripeBlack} />
    </group>
  );
}

/**
 * Grupo hidráulico: bandeja antigoteo, depósito con nivel visual, grifo de vaciado e interruptor
 * general; tapa atornillada con el grupo motor–bomba (aletas, caja de bornas, campana y bomba),
 * bloque de presión con manómetro, filtro de retorno y tapón de llenado; acumulador al costado.
 * De él salen dos tuberías rígidas (presión y retorno) al bloque de servicio del pilar.
 */
export function PowerUnit() {
  const { x0, x1, z0, z1, top } = HPU;
  const lid = top + 0.03;
  const m = MOTOR;
  return (
    <group>
      <Block min={[x0 - 0.2, 0, z0 - 0.04]} max={[x1 + 0.04, 0.05, z1 + 0.04]} c={c.metalDark} />
      <Block min={[x0, 0.05, z0]} max={[x1, top, z1]} c={c.metalLight} />
      <Block min={[x0 - 0.02, top, z0 - 0.02]} max={[x1 + 0.02, lid, z1 + 0.02]} c={c.metalMid} />
      {[x0 + 0.05, (x0 + x1) / 2, x1 - 0.05].flatMap((x) => [z0 + 0.03, z1 - 0.03].map((z) => <Bolt key={`${x}${z}`} p={[x, lid, z]} r={0.011} h={0.008} />))}
      {/* Nivel visual (aceite a media altura) y grifo de vaciado. */}
      <Block min={[3.56, 0.2, z1]} max={[3.62, 0.5, z1 + 0.01]} c={c.metalMid} />
      <Block min={[3.572, 0.215, z1 + 0.01]} max={[3.608, 0.485, z1 + 0.013]} c={c.screen} />
      <Block min={[3.572, 0.215, z1 + 0.01]} max={[3.608, 0.36, z1 + 0.014]} c={c.oil} />
      <Cyl p={[3.02, 0.11, z1 + 0.02]} radius={0.018} length={0.04} axis="z" c={c.metalMid} />
      <Block min={[2.99, 0.13, z1 + 0.03]} max={[3.05, 0.142, z1 + 0.045]} c={c.metalDark} />
      {/* Arrancador con el interruptor general (maneta roja sobre placa amarilla). */}
      <Block min={[3.12, 0.2, z1]} max={[3.4, 0.5, z1 + 0.07]} c={c.green} />
      <Block min={[3.2, 0.31, z1 + 0.07]} max={[3.3, 0.41, z1 + 0.074]} c={c.signalYellow} />
      <Cyl p={[3.25, 0.36, z1 + 0.084]} radius={0.032} length={0.02} axis="z" c={c.andonRed} />
      <Block min={[3.236, 0.33, z1 + 0.09]} max={[3.264, 0.39, z1 + 0.105]} c={c.andonRed} />
      {[0, 1].map((k) => (
        <Cyl key={k} p={[3.17 + k * 0.17, 0.45, z1 + 0.076]} radius={0.012} length={0.012} axis="z" c={k ? c.andonGreen : c.metalMid} />
      ))}
      {/* Motor eléctrico con sus patas, aletas, caja de bornas y cubreventilador. */}
      <Block min={[m.x0 + 0.02, lid, m.z - 0.14]} max={[m.x1 - 0.02, lid + 0.03, m.z + 0.14]} c={c.metalMid} />
      <Cyl p={[(m.x0 + m.x1) / 2, m.y, m.z]} radius={m.r} length={m.x1 - m.x0} axis="x" segments={28} c={c.green} />
      {Array.from({ length: 12 }, (_, k) => {
        const a = (k / 12) * Math.PI * 2;
        return (
          <Box
            key={k}
            p={[(m.x0 + m.x1) / 2 + 0.01, m.y + Math.cos(a) * (m.r + 0.008), m.z + Math.sin(a) * (m.r + 0.008)]}
            s={[m.x1 - m.x0 - 0.04, 0.03, 0.012]}
            r={[a, 0, 0]}
            c={c.green}
          />
        );
      })}
      <Block min={[3.42, m.y + m.r - 0.02, m.z - 0.07]} max={[3.55, m.y + m.r + 0.07, m.z + 0.07]} c={c.green} />
      <Cyl p={[m.x1 + 0.04, m.y, m.z]} radius={m.r + 0.006} length={0.08} axis="x" segments={28} c={c.metalMid} />
      {/* Campana y bomba de engranajes, con su aspiración al depósito. */}
      <Cyl p={[3.27, m.y, m.z]} radius={0.1} length={0.12} axis="x" topRatio={0.75} segments={24} c={c.metalMid} />
      <Cyl p={[3.15, m.y, m.z]} radius={0.068} length={0.12} axis="x" segments={20} c={c.metalLight} />
      <Cyl p={[3.15, (lid + m.y - 0.06) / 2, m.z]} radius={0.024} length={m.y - 0.06 - lid} c={c.metalMid} />
      <Cyl p={[3.15, m.y, (m.z + 0.068 + BLOCK.z0) / 2]} radius={0.022} length={BLOCK.z0 - m.z - 0.068} axis="z" c={c.metalMid} />
      {/* Bloque de presión con manómetro y filtro de retorno con su indicador de colmatación. */}
      <Block min={[BLOCK.x0, lid, BLOCK.z0]} max={[BLOCK.x1, BLOCK.y1, BLOCK.z1]} c={c.metalMid} />
      <Gauge p={[3.08, 0.715, BLOCK.z1]} r={0.045} />
      <Cyl p={[RETURN_FILTER.x, (lid + RETURN_FILTER.top - 0.03) / 2, RETURN_FILTER.z]} radius={0.06} length={RETURN_FILTER.top - 0.03 - lid} c={c.metalMid} />
      <Cyl p={[RETURN_FILTER.x, RETURN_FILTER.top - 0.015, RETURN_FILTER.z]} radius={0.066} length={0.03} segments={6} c={c.metalDark} />
      <Cyl p={[RETURN_FILTER.x + 0.03, RETURN_FILTER.top + 0.008, RETURN_FILTER.z + 0.03]} radius={0.012} length={0.016} c={c.andonGreen} />
      <Cyl p={[3.6, lid + 0.02, -2.4]} radius={0.034} length={0.04} c={c.signalYellow} />
      {/* Acumulador de presión al costado del depósito, con sus abrazaderas. */}
      <Cyl p={[x0 - 0.1, 0.36, -2.95]} radius={0.075} length={0.62} c={c.green} />
      <Dome p={[x0 - 0.1, 0.67, -2.95]} radius={0.075} c={c.green} />
      <Cyl p={[x0 - 0.1, 0.758, -2.95]} radius={0.016} length={0.03} c={c.metalMid} />
      {[0.22, 0.52].map((y) => (
        <group key={y}>
          <Cyl p={[x0 - 0.1, y, -2.95]} radius={0.079} length={0.025} c={c.metalMid} />
          <Block min={[x0 - 0.03, y - 0.0125, -2.97]} max={[x0, y + 0.0125, -2.93]} c={c.metalMid} />
        </group>
      ))}
      {/* Tuberías rígidas al bloque de servicio: presión desde el bloque, retorno al filtro. */}
      <Tube
        points={[
          [3.06, BLOCK.y1, HSM_PORTS.pressure[1]],
          [3.06, PIPE_Y.pressure, HSM_PORTS.pressure[1]],
          [HSM_PORTS.pressure[0], PIPE_Y.pressure, HSM_PORTS.pressure[1]],
          [HSM_PORTS.pressure[0], HSM.y0, HSM_PORTS.pressure[1]],
        ]}
        radius={0.016}
        bend={0.07}
        c={c.metalMid}
      />
      <Tube
        points={[
          [RETURN_FILTER.x, RETURN_FILTER.top, RETURN_FILTER.z],
          [RETURN_FILTER.x, PIPE_Y.ret, RETURN_FILTER.z],
          [RETURN_FILTER.x, PIPE_Y.ret, HSM_PORTS.ret[1]],
          [HSM_PORTS.ret[0], PIPE_Y.ret, HSM_PORTS.ret[1]],
          [HSM_PORTS.ret[0], HSM.y0, HSM_PORTS.ret[1]],
        ]}
        radius={0.016}
        bend={0.07}
        c={c.metalMid}
      />
      {/* Abrazadera de las dos tuberías al pilar. */}
      <Block
        min={[COLUMN.xs[1] + COLUMN.half, 1.16, RIG_Z - COLUMN.flange]}
        max={[COLUMN.xs[1] + COLUMN.half + 0.02, 1.22, RIG_Z + COLUMN.flange]}
        c={c.metalDark}
      />
      <Block min={[COLUMN.xs[1] + COLUMN.half + 0.02, 1.17, -2.37]} max={[2.71, 1.21, -2.19]} c={c.metalMid} />
    </group>
  );
}

/**
 * Bloque de servicio (HSM) atornillado al pilar derecho: escuadra sobre las alas, bloque con la
 * electroválvula de presión alta/baja, su conector y un manómetro, y los racores de las tuberías.
 */
export function ServiceManifold() {
  const { x0, x1, y0, y1, z0, z1 } = HSM;
  const colX = COLUMN.xs[1] + COLUMN.half;
  return (
    <group>
      <Block min={[colX, y0 - 0.04, RIG_Z - COLUMN.flange]} max={[x0, y1 + 0.04, RIG_Z + COLUMN.flange]} c={c.metalDark} />
      <Block min={[x0, y0, z0]} max={[x1, y1, z1]} c={c.metalMid} />
      <Block min={[x0 + 0.04, y0 + 0.07, z1]} max={[x0 + 0.16, y0 + 0.2, z1 + 0.05]} c={c.metalDark} />
      <Block min={[x0 + 0.07, y0 + 0.2, z1 + 0.01]} max={[x0 + 0.13, y0 + 0.24, z1 + 0.04]} c={c.stripeBlack} />
      <Gauge p={[x1 - 0.05, y1 - 0.06, z1]} r={0.032} />
      {[HSM_PORTS.pressure, HSM_PORTS.ret].map(([x, z]) => (
        <Cyl key={x} p={[x, y0 - 0.015, z]} radius={0.024} length={0.03} segments={6} c={c.metalLight} />
      ))}
      {HOSE.zs.map((z) => (
        <Cyl key={z} p={[HOSE.x, y1 + 0.016, z]} radius={0.028} length={0.032} segments={6} c={c.metalLight} />
      ))}
    </group>
  );
}

/**
 * Recorrido de un latiguillo: del bloque del actuador sale hacia la izquierda, pasa bajo el dintel
 * hacia delante, sube por su cara, lo recorre por encima y baja junto a su extremo al bloque de servicio.
 */
function hosePath(i: number): Vec3[] {
  const x = HOSE.xs[i];
  const z = HOSE.zs[i];
  const port = RIG_Z + ACT.portZs[i];
  return [
    [ACT.portX, ACT.manifold.y1 + 0.032, port],
    [ACT.portX, 2.72, port],
    [x, 2.86, port],
    [x, HOSE.under, port],
    [x, HOSE.under, HOSE.drop],
    [x, HOSE.y, HOSE.drop],
    [x, HOSE.y, z],
    [HOSE.x, HOSE.y, z],
    [HOSE.x, HSM.y1 + 0.032, z],
  ];
}

/**
 * Latiguillos de presión y retorno con su abrazadera en el pilar. En la vista explosionada se
 * retiran (unían el actuador y el dintel, que suben).
 */
export function Hoses({ group }: { group: RefObject<THREE.Group | null> }) {
  const colX = COLUMN.xs[1] + COLUMN.half;
  const [za, zb] = [Math.max(...HOSE.zs) + 0.04, Math.min(...HOSE.zs) - 0.04];
  return (
    <group ref={group} userData={{ mergeBoundary: true }}>
      <Merge>
        {[0, 1].map((i) => (
          <Tube key={i} points={hosePath(i)} radius={HOSE.r} bend={0.1} c={c.stripeBlack} />
        ))}
        <Block min={[colX, 2.57, RIG_Z - COLUMN.flange]} max={[colX + 0.02, 2.63, RIG_Z + COLUMN.flange]} c={c.metalDark} />
        <Block min={[colX + 0.02, 2.585, RIG_Z - 0.02]} max={[HOSE.x - 0.03, 2.615, RIG_Z + 0.02]} c={c.metalDark} />
        <Block min={[HOSE.x - 0.03, 2.57, zb]} max={[HOSE.x + 0.03, 2.63, za]} c={c.metalMid} />
      </Merge>
    </group>
  );
}
