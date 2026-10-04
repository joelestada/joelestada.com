'use client';

import type { Vec3 } from '@/config/layout';
import { palette } from '@/config/palette';
import { Block, Bolt, Box, Cyl, Ring, Tube } from '../../kit/primitives';
import { BEND, MOTOR, PATHS, PIPE, PUMP, TANK, VALVES } from './dims';

const c = palette;
const LID = TANK.top + 0.03;
/** Enfriador aceite–aire en el costado izquierdo del depósito; su ventilador mira a la cámara. */
const COOLER = { x0: TANK.x0 - 0.28, x1: TANK.x0 - 0.02, y0: 0.1, y1: 0.7, z0: -2.62, z1: -1.98 };
const FILTER = { x: TANK.x1 - 0.2, z: -2.58, h: 0.3, r: 0.065 };

/** Manómetro o termómetro de esfera en una cara +Z. */
function Dial({ p, r }: { p: Vec3; r: number }) {
  const [x, y, z] = p;
  return (
    <group>
      <Cyl p={[x, y, z + 0.01]} radius={r} length={0.02} axis="z" segments={20} c={c.metalDark} />
      <Cyl p={[x, y, z + 0.021]} radius={r * 0.82} length={0.003} axis="z" segments={20} c={c.floorLit} />
      <Box p={[x + r * 0.2, y + r * 0.2, z + 0.024]} s={[r * 0.7, 0.006, 0.002]} r={[0, 0, Math.PI / 4]} c={c.stripeBlack} />
    </group>
  );
}

/**
 * Depósito: bandeja antigoteo, cuerpo, tapa atornillada, tapa de registro, nivel visual con su
 * termómetro, grifo de vaciado y tapón de llenado amarillo. El rótulo HPU lo pone la estación.
 */
export function Tank() {
  const { x0, x1, z0, z1, top } = TANK;
  return (
    <group>
      <Block min={[COOLER.x0 - 0.06, 0, z0 - 0.08]} max={[x1 + 0.08, 0.04, z1 + 0.08]} c={c.metalDark} />
      <Block min={[x0, 0.04, z0]} max={[x1, top, z1]} c={c.metalLight} />
      <Block min={[x0 - 0.02, top, z0 - 0.02]} max={[x1 + 0.02, LID, z1 + 0.02]} c={c.metalMid} />
      {[x0 + 0.06, (x0 + x1) / 2, x1 - 0.06].flatMap((x) => [z0 + 0.03, z1 - 0.03].map((z) => <Bolt key={`${x}${z}`} p={[x, LID, z]} r={0.012} h={0.008} />))}
      {/* Registro de limpieza en el frente. */}
      <Block min={[x0 + 0.08, 0.2, z1]} max={[x0 + 0.42, 0.56, z1 + 0.008]} c={c.metalLight} />
      {[0.23, 0.53].flatMap((y) => [x0 + 0.11, x0 + 0.25, x0 + 0.39].map((x) => <Bolt key={`${x}${y}`} p={[x, y, z1 + 0.008]} dir="z" r={0.01} h={0.008} />))}
      {/* Nivel visual, termómetro y vaciado. */}
      <Block min={[x1 - 0.2, 0.2, z1]} max={[x1 - 0.13, 0.62, z1 + 0.012]} c={c.metalMid} />
      <Block min={[x1 - 0.188, 0.215, z1 + 0.012]} max={[x1 - 0.142, 0.605, z1 + 0.015]} c={c.screen} />
      <Block min={[x1 - 0.188, 0.215, z1 + 0.012]} max={[x1 - 0.142, 0.47, z1 + 0.016]} c={c.oil} />
      <Dial p={[x1 - 0.3, 0.52, z1]} r={0.04} />
      <Cyl p={[x0 + 0.6, 0.1, z1 + 0.025]} radius={0.02} length={0.05} axis="z" c={c.metalMid} />
      <Block min={[x0 + 0.57, 0.125, z1 + 0.035]} max={[x0 + 0.63, 0.137, z1 + 0.05]} c={c.metalDark} />
      <Cyl p={[x1 - 0.18, LID + 0.02, z1 - 0.22]} radius={0.036} length={0.04} c={c.signalYellow} />
    </group>
  );
}

/**
 * Motor eléctrico: carcasa con aletas longitudinales, patas, caja de bornas y cubreventilador con su
 * rejilla, en el lado que ve la cámara.
 */
export function Motor() {
  const { x0, x1, y, z, r } = MOTOR;
  const mid = (x0 + x1) / 2;
  return (
    <group>
      <Block min={[x0 + 0.04, LID, z - 0.17]} max={[x1 - 0.04, LID + 0.02, z + 0.17]} c={c.metalDark} />
      <Block min={[x0 + 0.06, LID + 0.02, z - 0.12]} max={[x1 - 0.06, y - r + 0.03, z + 0.12]} c={c.green} />
      <Cyl p={[mid, y, z]} radius={r} length={x1 - x0} axis="x" segments={28} c={c.green} />
      {Array.from({ length: 14 }, (_, k) => {
        const a = (k / 14) * Math.PI * 2;
        return (
          <Box
            key={k}
            p={[mid + 0.02, y + Math.cos(a) * (r + 0.01), z + Math.sin(a) * (r + 0.01)]}
            s={[x1 - x0 - 0.06, 0.04, 0.014]}
            r={[a, 0, 0]}
            c={c.green}
          />
        );
      })}
      <Block min={[mid - 0.07, y + r - 0.02, z - 0.09]} max={[mid + 0.09, y + r + 0.1, z + 0.09]} c={c.green} />
      <Cyl p={[mid + 0.02, y + r + 0.05, z + 0.105]} radius={0.018} length={0.03} axis="z" c={c.metalDark} />
      <Cyl p={[x0 - 0.045, y, z]} radius={r + 0.012} length={0.09} axis="x" segments={28} c={c.metalMid} />
      {[0.06, 0.12, 0.18].map((rr) => (
        <Ring key={rr} p={[x0 - 0.091, y, z]} radius={rr} tube={0.006} axis="x" c={c.metalDark} />
      ))}
      <Cyl p={[x0 - 0.092, y, z]} radius={0.03} length={0.006} axis="x" c={c.metalDark} />
    </group>
  );
}

/** Campana de acoplamiento y bomba de pistones con su aspiración al depósito y su salida. */
export function Pump() {
  const { y, z } = MOTOR;
  return (
    <group>
      <Cyl
        p={[(MOTOR.x1 + PUMP.x0) / 2, y, z]}
        radius={0.14}
        length={PUMP.x0 - MOTOR.x1}
        r={[0, 0, -Math.PI / 2]}
        topRatio={0.72}
        segments={24}
        c={c.metalMid}
      />
      <Cyl p={[(PUMP.x0 + PUMP.x1) / 2, y, z]} radius={PUMP.r} length={PUMP.x1 - PUMP.x0} axis="x" segments={20} c={c.metalDark} />
      <Block min={[PUMP.x0 + 0.02, y - 0.06, z - 0.13]} max={[PUMP.x1 - 0.02, y + 0.06, z + 0.13]} c={c.metalDark} />
      <Cyl p={[PUMP.x1 + 0.03, y, z]} radius={0.05} length={0.06} axis="x" c={c.metalMid} />
      <Cyl p={[PUMP.x, (LID + y - PUMP.r) / 2, z]} radius={0.03} length={y - PUMP.r - LID} c={c.metalMid} />
      <Cyl p={[PUMP.x, y, z + 0.13 + 0.015]} radius={0.04} length={0.03} axis="z" segments={6} c={c.metalMid} />
    </group>
  );
}

/** Enfriador aceite–aire: bastidor, panal, ventilador con su rejilla y latiguillos al depósito. */
export function Cooler() {
  const { x0, x1, y0, y1, z0, z1 } = COOLER;
  const cy = (y0 + y1) / 2;
  const cz = (z0 + z1) / 2;
  return (
    <group>
      <Block min={[x0 + 0.06, y0, z0]} max={[x1, y1, z1]} c={c.metalMid} />
      <Block min={[x0, y0, z0]} max={[x0 + 0.06, y1, z1]} c={c.green} />
      <Cyl p={[x0 - 0.004, cy, cz]} radius={0.24} length={0.008} axis="x" segments={28} c={c.stripeBlack} />
      {[0.08, 0.15, 0.22].map((rr) => (
        <Ring key={rr} p={[x0 - 0.01, cy, cz]} radius={rr} tube={0.006} axis="x" c={c.metalMid} />
      ))}
      <Box p={[x0 - 0.012, cy, cz]} s={[0.006, 0.44, 0.014]} c={c.metalMid} />
      <Box p={[x0 - 0.012, cy, cz]} s={[0.006, 0.014, 0.44]} c={c.metalMid} />
      <Cyl p={[x0 - 0.014, cy, cz]} radius={0.04} length={0.012} axis="x" c={c.metalDark} />
      {[z0 + 0.1, z1 - 0.1].map((z) => (
        <Tube
          key={z}
          points={[
            [x1 - 0.06, y1, z],
            [x1 - 0.06, y1 + 0.12, z],
            [TANK.x0 + 0.12, y1 + 0.12, z],
            [TANK.x0 + 0.12, LID, z],
          ]}
          radius={0.02}
          bend={0.06}
          c={c.stripeBlack}
        />
      ))}
    </group>
  );
}

/** Filtro de retorno sobre la tapa: vaso, cabeza hexagonal e indicador de colmatación. */
export function ReturnFilter() {
  const { x, z, h, r } = FILTER;
  return (
    <group>
      <Cyl p={[x, LID + h / 2, z]} radius={r} length={h} segments={20} c={c.metalMid} />
      <Cyl p={[x, LID + h + 0.02, z]} radius={r + 0.012} length={0.04} segments={6} c={c.metalDark} />
      <Cyl p={[x + 0.04, LID + h + 0.05, z + 0.03]} radius={0.014} length={0.02} c={c.andonGreen} />
    </group>
  );
}

/**
 * Bloque de válvulas sobre su soporte: placa base, bloque, tres cartuchos arriba, dos
 * electroválvulas con su bobina y conector en la cara delantera, limitadora con su pomo y manetas
 * (la de descarga en rojo).
 */
export function ValveBlock() {
  const { x0, x1, y0, y1, z0, z1 } = VALVES;
  const cx = (x0 + x1) / 2;
  return (
    <group>
      <Block min={[cx - 0.18, 0, z0 - 0.02]} max={[cx + 0.18, 0.03, z1 + 0.02]} c={c.metalDark} />
      {[x0 + 0.05, x1 - 0.05].map((x) => (
        <Block key={x} min={[x - 0.03, 0.03, (z0 + z1) / 2 - 0.08]} max={[x + 0.03, y0, (z0 + z1) / 2 + 0.08]} c={c.metalMid} />
      ))}
      <Block min={[x0, y0, z0]} max={[x1, y1, z1]} c={c.metalMid} />
      {[x0 + 0.08, cx, x1 - 0.08].map((x) => (
        <group key={x}>
          <Cyl p={[x, y1 + 0.02, (z0 + z1) / 2]} radius={0.034} length={0.04} segments={6} c={c.metalDark} />
          <Cyl p={[x, y1 + 0.055, (z0 + z1) / 2]} radius={0.022} length={0.03} c={c.metalLight} />
        </group>
      ))}
      {[x0 + 0.1, x1 - 0.1].map((x) => (
        <group key={x}>
          <Block min={[x - 0.045, y0 + 0.06, z1]} max={[x + 0.045, y0 + 0.2, z1 + 0.03]} c={c.metalDark} />
          <Cyl p={[x, y0 + 0.13, z1 + 0.065]} radius={0.034} length={0.07} axis="z" c={c.stripeBlack} />
          <Block min={[x - 0.025, y0 + 0.2, z1 + 0.04]} max={[x + 0.025, y0 + 0.25, z1 + 0.09]} c={c.stripeBlack} />
          <Box p={[x + 0.016, y0 + 0.23, z1 + 0.091]} s={[0.008, 0.008, 0.003]} c={c.andonGreen} />
        </group>
      ))}
      <Cyl p={[cx, y1 - 0.09, z1 + 0.04]} radius={0.026} length={0.08} axis="z" c={c.metalLight} />
      <Cyl p={[cx, y1 - 0.09, z1 + 0.09]} radius={0.034} length={0.02} axis="z" segments={10} c={c.metalDark} />
      {[x0 + 0.08, cx, x1 - 0.08].map((x, i) => (
        <group key={`h${x}`}>
          <Cyl p={[x, y1 + 0.1, (z0 + z1) / 2 + 0.06]} radius={0.012} length={0.06} axis="z" c={c.metalDark} />
          <Box p={[x, y1 + 0.1, (z0 + z1) / 2 + 0.14]} s={[0.022, 0.018, 0.12]} c={i === 1 ? c.andonRed : c.signalYellow} />
        </group>
      ))}
    </group>
  );
}

/** Tramo de tubería rígida con curvas, y una brida en cada extremo. */
function Pipe({ path }: { path: Vec3[] }) {
  const ends = [path[0], path[path.length - 1]];
  const dirs = [
    [path[1], path[0]],
    [path[path.length - 2], path[path.length - 1]],
  ];
  return (
    <group>
      <Tube points={path} radius={PIPE} bend={BEND} c={c.metalMid} />
      {ends.map((p, i) => {
        const [a, b] = dirs[i];
        const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
        const axis = Math.abs(d[0]) > Math.abs(d[1]) ? (Math.abs(d[0]) > Math.abs(d[2]) ? 'x' : 'z') : Math.abs(d[1]) > Math.abs(d[2]) ? 'y' : 'z';
        const len = Math.hypot(...d) || 1;
        const q: Vec3 = [p[0] - (d[0] / len) * 0.012, p[1] - (d[1] / len) * 0.012, p[2] - (d[2] / len) * 0.012];
        return <Cyl key={i} p={q} radius={PIPE + 0.016} length={0.024} axis={axis} segments={8} c={c.metalDark} />;
      })}
    </group>
  );
}

/** Todas las tuberías rígidas del circuito. */
export function Piping() {
  return (
    <group>
      {Object.values(PATHS).map((p, i) => (
        <Pipe key={i} path={p} />
      ))}
    </group>
  );
}
