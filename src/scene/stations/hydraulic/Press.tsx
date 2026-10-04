'use client';

import { palette } from '@/config/palette';
import { Anchor, Gusset, GussetX } from '../../kit/hardware';
import { Bar, Block, Bolt, BoltCircle, Cyl, Ring } from '../../kit/primitives';
import { BEAM, CLEVIS, COL_INNER, CYL, FRAME, HEAD, MASS, RAIL, RAIL_FACE, ROD_LEN } from './dims';

const c = palette;
const X = FRAME.x;

/**
 * Columna del pórtico (`s` = lado de la línea, ±1): placa de anclaje con cuatro tuercas, cajón con
 * cartelas, tornapunta por la izquierda y raíl de guía en la cara interior, con sus topes.
 */
export function Column({ s }: { s: 1 | -1 }) {
  const z = s * FRAME.colZ;
  const h = FRAME.col / 2;
  const base = 0.04;
  const inner = s * COL_INNER;
  const railFace = s * RAIL_FACE;
  return (
    <group>
      <Block min={[X - 0.32, 0, z - 0.24]} max={[X + 0.32, base, z + 0.24]} c={c.metalDark} />
      {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => <Anchor key={`${sx}${sz}`} p={[X + sx * 0.24, base, z + sz * 0.16]} r={0.024} />))}
      <Block min={[X - h, base, z - h]} max={[X + h, FRAME.top, z + h]} c={c.green} />
      {[-1, 1].map((sx) => (
        <GussetX key={sx} z={z} y={base} xFace={X + sx * h} xOut={X + sx * 0.3} h={0.3} />
      ))}
      <Gusset x={X} y={base} zFace={z + s * h} zOut={z + s * 0.22} h={0.26} />
      <Bar a={[X - 0.3, base, z]} b={[X - h, 1.05, z]} t={0.06} c={c.green} />
      <Block min={[X - RAIL.w / 2, RAIL.y0, Math.min(inner, railFace)]} max={[X + RAIL.w / 2, RAIL.y1, Math.max(inner, railFace)]} c={c.metalLight} />
      {[RAIL.y0 - 0.03, RAIL.y1].map((y) => (
        <Block
          key={y}
          min={[X - 0.035, y, Math.min(inner, railFace - s * 0.012)]}
          max={[X + 0.035, y + 0.03, Math.max(inner, railFace - s * 0.012)]}
          c={c.metalDark}
        />
      ))}
    </group>
  );
}

/** Amortiguador de fin de carrera bajo el dintel: cuerpo y tope amarillo. */
function Buffer({ z }: { z: number }) {
  return (
    <group>
      <Cyl p={[X, BEAM.y0 - 0.07, z]} radius={0.05} length={0.14} c={c.metalDark} />
      <Cyl p={[X, BEAM.y0 - 0.155, z]} radius={0.056} length={0.03} c={c.signalYellow} />
    </group>
  );
}

/** Dintel de cajón con ala superior, placas de asiento atornilladas, cáncamos y amortiguadores. */
export function Crossbeam() {
  const { y0, y1, half, z } = BEAM;
  return (
    <group>
      <Block min={[X - half, y0, -z]} max={[X + half, y1 - 0.02, z]} c={c.green} />
      <Block min={[X - half - 0.02, y1 - 0.02, -z - 0.02]} max={[X + half + 0.02, y1, z + 0.02]} c={c.green} />
      {[-1, 1].map((s) => (
        <group key={s}>
          <Block min={[X - half - 0.03, y0 - 0.025, s * FRAME.colZ - 0.13]} max={[X + half + 0.03, y0, s * FRAME.colZ + 0.13]} c={c.metalDark} />
          {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => <Bolt key={`${sx}${sz}`} p={[X + sx * 0.1, y1, s * FRAME.colZ + sz * 0.07]} r={0.018} h={0.016} />))}
          <Block min={[X - 0.012, y1, s * 0.62 - 0.05]} max={[X + 0.012, y1 + 0.08, s * 0.62 + 0.05]} c={c.green} />
          <Ring p={[X, y1 + 0.11, s * 0.62]} radius={0.034} tube={0.009} axis="x" c={c.signalYellow} />
          <Buffer z={s * 0.5} />
        </group>
      ))}
    </group>
  );
}

/**
 * Cabezal (marco del cabezal: origen en su centro): viga con nervios, patines de guía que abrazan
 * los raíles, horquillas de los vástagos y orejeta de la masa. Los vástagos bajan con él.
 */
export function Head() {
  const h = HEAD.half;
  const zb = HEAD.z;
  return (
    <group>
      <Block min={[X - HEAD.hx, -h, -zb]} max={[X + HEAD.hx, h, zb]} c={c.metalMid} />
      {[-0.62, -0.25, 0.25, 0.62].map((z) => (
        <Block key={z} min={[X - HEAD.hx - 0.012, -h + 0.015, z - 0.012]} max={[X - HEAD.hx, h - 0.015, z + 0.012]} c={c.metalMid} />
      ))}
      {[-1, 1].map((s) => (
        <group key={s}>
          <Block
            min={[X - 0.11, -0.13, Math.min(s * zb, s * (RAIL_FACE + 0.012))]}
            max={[X + 0.11, 0.13, Math.max(s * zb, s * (RAIL_FACE + 0.012))]}
            c={c.metalDark}
          />
          {[-0.08, 0.08].map((dy) => (
            <Bolt key={dy} p={[X - 0.11, dy, s * (zb + 0.035)]} dir="-x" r={0.012} h={0.01} />
          ))}
          {/* Horquilla y vástago del cilindro de este lado. */}
          <Block min={[X - 0.07, -h - CLEVIS, s * CYL.z - 0.06]} max={[X + 0.07, -h, s * CYL.z + 0.06]} c={c.metalDark} />
          <Cyl p={[X, -h - CLEVIS / 2, s * CYL.z]} radius={0.018} length={0.16} axis="x" c={c.metalLight} />
          <Cyl p={[X, -h - CLEVIS - ROD_LEN / 2, s * CYL.z]} radius={CYL.rod} length={ROD_LEN} c={c.metalLight} />
        </group>
      ))}
      <Block min={[X - 0.06, -h - 0.04, -0.09]} max={[X + 0.06, -h, 0.09]} c={c.metalDark} />
    </group>
  );
}

/** Masa de ensayo (marco del cabezal): eslabón con su bulón, cinco placas (la del medio, amarilla) y tirantes. */
export function Mass() {
  const top = -HEAD.half - MASS.drop;
  const { half, plate, plates } = MASS;
  return (
    <group>
      <Block min={[X - 0.035, top + 0.02, -0.014]} max={[X + 0.035, -HEAD.half - 0.02, 0.014]} c={c.metalDark} />
      <Cyl p={[X, -HEAD.half - 0.03, 0]} radius={0.016} length={0.2} axis="z" c={c.metalLight} />
      <Block min={[X - 0.08, top, -0.08]} max={[X + 0.08, top + 0.02, 0.08]} c={c.metalDark} />
      {Array.from({ length: plates }, (_, k) => (
        <Block
          key={k}
          min={[X - half, top - (k + 1) * plate, -half]}
          max={[X + half, top - k * plate - 0.002, half]}
          c={k === 2 ? c.signalYellow : c.metalDark}
        />
      ))}
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <group key={`${sx}${sz}`}>
            <Bolt p={[X + sx * 0.29, top, sz * 0.29]} r={0.026} h={0.026} />
            <Cyl p={[X + sx * 0.29, top + 0.034, sz * 0.29]} radius={0.012} length={0.016} c={c.metalLight} />
          </group>
        )),
      )}
    </group>
  );
}

/** Portaherramientas y punzón bajo la masa (marco del cabezal): el punzón asienta el casquillo. */
export function PressTool() {
  const y = -HEAD.half - MASS.drop - MASS.plates * MASS.plate;
  const { tool, punch } = MASS;
  return (
    <group>
      <Block min={[X - 0.22, y - tool, -0.22]} max={[X + 0.22, y, 0.22]} c={c.metalMid} />
      <BoltCircle p={[X, y - tool, 0]} dir="-y" R={0.17} n={6} phase={Math.PI / 6} r={0.012} h={0.01} />
      <Cyl p={[X, y - tool - 0.012, 0]} radius={punch.r + 0.018} length={0.024} segments={24} c={c.metalDark} />
      <Cyl p={[X, y - tool - punch.h / 2, 0]} radius={punch.r} length={punch.h} segments={24} c={c.metalLight} />
    </group>
  );
}

/**
 * Cilindro de elevación (`s` = lado, ±1): placa con anclajes, horquilla con bulón, culatas
 * atornilladas, camisa, prensaestopas y toma inferior (la tubería sale de ella).
 */
export function LiftCylinder({ s }: { s: 1 | -1 }) {
  const z = s * CYL.z;
  const { bottom, top, r, cap, capR, port } = CYL;
  return (
    <group>
      <Block min={[X - 0.16, 0, z - 0.14]} max={[X + 0.16, 0.04, z + 0.14]} c={c.metalDark} />
      {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => <Anchor key={`${sx}${sz}`} p={[X + sx * 0.12, 0.04, z + sz * 0.1]} r={0.018} />))}
      {[-1, 1].map((sz) => (
        <Block key={sz} min={[X - 0.07, 0.04, z + sz * 0.065 - 0.015]} max={[X + 0.07, bottom + 0.03, z + sz * 0.065 + 0.015]} c={c.metalDark} />
      ))}
      <Cyl p={[X, 0.12, z]} radius={0.02} length={0.17} axis="z" c={c.metalLight} />
      <Cyl p={[X, bottom + cap / 2, z]} radius={capR} length={cap} segments={24} c={c.metalMid} />
      <BoltCircle p={[X, bottom + cap, z]} dir="y" R={capR - 0.018} n={8} r={0.01} h={0.01} />
      <Cyl p={[X, (bottom + cap + top - cap) / 2, z]} radius={r} length={top - bottom - 2 * cap} segments={24} c={c.metalLight} />
      <Cyl p={[X, top - cap / 2, z]} radius={capR} length={cap} segments={24} c={c.metalMid} />
      <BoltCircle p={[X, top, z]} dir="y" R={capR - 0.018} n={8} r={0.01} h={0.01} />
      <Cyl p={[X, top + 0.015, z]} radius={0.065} length={0.03} c={c.metalDark} />
      <Cyl p={[X + capR + 0.01, port, z]} radius={0.034} length={0.03} axis="x" segments={6} c={c.metalDark} />
    </group>
  );
}
