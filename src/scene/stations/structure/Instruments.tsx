'use client';

import type { ReactNode } from 'react';
import type { Vec3 } from '@/config/layout';
import { palette } from '@/config/palette';
import { AndonTower, type AndonState } from '../../kit/AndonTower';
import { flow } from '../../line/flow';
import { Block, Box, Cyl, Tube } from '../../kit/primitives';
import { BED, LVDT, MONITOR, RACK, SLOTS_Z } from './dims';

const c = palette;

/** Ranura por la que van los cables de los LVDT hasta la caja de conexiones. */
const CABLE_SLOT = SLOTS_Z[2];
/** Caja de conexiones en el carril delantero de la bancada, junto al extremo izquierdo. */
const JUNCTION = { x0: -2.67, x1: -2.53, y1: BED.h + 0.075, z0: -1.9, z1: -1.8 };

/**
 * LVDT sobre base magnética: imán con su palanca, columna, pinza y cuerpo del transductor. El
 * núcleo con su palpador (lo que se mueve) lo pone la estación. Los cables bajan a la ranura y van
 * por ella hasta la caja de conexiones.
 */
export function LvdtStands() {
  const { z, post, body } = LVDT;
  const y = BED.h;
  return (
    <group>
      {LVDT.xs.map((x, i) => {
        const px = x + post;
        const cz = CABLE_SLOT + (i - 1) * 0.009;
        return (
          <group key={x}>
            <Block min={[px - 0.045, y, z - 0.035]} max={[px + 0.045, y + 0.07, z + 0.035]} c={c.stripeBlack} />
            <Block min={[px - 0.045, y + 0.07, z - 0.035]} max={[px + 0.045, y + 0.078, z + 0.035]} c={c.metalMid} />
            <Cyl p={[px + 0.025, y + 0.09, z + 0.018]} radius={0.007} length={0.024} axis="x" c={c.signalYellow} />
            <Cyl p={[px, (y + 0.078 + body.y0 + 0.07) / 2, z]} radius={0.009} length={body.y0 + 0.07 - y - 0.078} c={c.metalLight} />
            <Block min={[px - 0.016, body.y0 + 0.03, z - 0.016]} max={[px + 0.016, body.y0 + 0.07, z + 0.016]} c={c.metalMid} />
            <Cyl p={[(x + px) / 2, body.y0 + 0.05, z]} radius={0.007} length={post} axis="x" c={c.metalMid} />
            <Block min={[x - 0.026, body.y0 + 0.03, z - 0.026]} max={[x + 0.026, body.y0 + 0.07, z + 0.026]} c={c.metalMid} />
            <Cyl p={[x, (body.y0 + body.y1) / 2, z]} radius={body.r} length={body.y1 - body.y0} c={c.metalLight} />
            <Cyl p={[x, body.y1 + 0.004, z]} radius={body.r * 0.7} length={0.008} c={c.metalMid} />
            <Tube
              points={[
                [x, body.y0, z],
                [x, 0.32, z],
                [x, 0.32, cz],
                [x, y - 0.003, cz],
                [JUNCTION.x1 + 0.04, y - 0.003, cz],
                [JUNCTION.x1 + 0.04, y + 0.03, JUNCTION.z0 + 0.02 + i * 0.03],
                [JUNCTION.x1, y + 0.03, JUNCTION.z0 + 0.02 + i * 0.03],
              ]}
              radius={0.005}
              bend={0.05}
              c={c.stripeBlack}
            />
          </group>
        );
      })}
      {/* Caja de conexiones y cable de señal hasta el armario, por el suelo. */}
      <Block min={[JUNCTION.x0, y, JUNCTION.z0]} max={[JUNCTION.x1, JUNCTION.y1, JUNCTION.z1]} c={c.metalLight} />
      <Block
        min={[JUNCTION.x0 + 0.012, JUNCTION.y1, JUNCTION.z0 + 0.012]}
        max={[JUNCTION.x1 - 0.012, JUNCTION.y1 + 0.006, JUNCTION.z1 - 0.012]}
        c={c.metalMid}
      />
      <Tube
        points={[
          [JUNCTION.x0, y + 0.035, -1.85],
          [BED.x0 - 0.05, y + 0.035, -1.85],
          [BED.x0 - 0.05, 0.012, -1.85],
          [RACK.x + RACK.w / 2 + 0.1, 0.012, -1.85],
          [RACK.x + RACK.w / 2 + 0.1, 0.012, RACK.z],
          [RACK.x + RACK.w / 2, 0.012, RACK.z],
        ]}
        radius={0.011}
        bend={0.12}
        c={c.stripeBlack}
      />
    </group>
  );
}

/** Unidad de rack de 19" en la cara delantera del armario: chapa, asas y lo que lleve encima. */
function RackUnit({ y0, y1, color, z, children }: { y0: number; y1: number; color: string; z: number; children?: ReactNode }) {
  const hw = RACK.w / 2 - 0.05;
  return (
    <group>
      <Block min={[RACK.x - hw, y0 + 0.004, z]} max={[RACK.x + hw, y1 - 0.004, z + 0.014]} c={color} />
      {[-1, 1].map((s) => (
        <Block
          key={s}
          min={[RACK.x + s * (hw - 0.02) - 0.008, y0 + 0.02, z + 0.014]}
          max={[RACK.x + s * (hw - 0.02) + 0.008, y1 - 0.02, z + 0.03]}
          c={c.metalMid}
        />
      ))}
      {children}
    </group>
  );
}

/** Verde mientras el ensayo corre; ámbar en pausa (el ensayo se congela con la planta). */
const rackSignal = (): AndonState => (flow.running ? 'green' : 'amber');

/**
 * Armario del controlador (rack de 19" con el frente abierto): controlador servohidráulico con su
 * pantalla, chasis de adquisición con sus módulos, acondicionador, panel de enclavamientos con la
 * seta de emergencia, rejillas y SAI, y el andon encima.
 */
export function ControllerRack() {
  const { x, z, w, h, d } = RACK;
  const front = z + d / 2;
  const inner = front - 0.02;
  const hw = w / 2;
  const u = (k: number) => x - hw + 0.08 + k * 0.04;
  return (
    <group>
      <Block min={[x - hw + 0.02, 0, z - d / 2 + 0.02]} max={[x + hw - 0.02, 0.08, z + d / 2 - 0.02]} c={c.metalMid} />
      <Block min={[x - hw, 0.08, z - d / 2]} max={[x + hw, h, inner]} c={c.green} />
      {/* Marco delantero: montantes y travesaño superior. */}
      {[-1, 1].map((s) => (
        <Block key={s} min={[x + s * hw - (s > 0 ? 0.05 : 0), 0.08, inner]} max={[x + s * hw + (s < 0 ? 0.05 : 0), h, front]} c={c.green} />
      ))}
      <Block min={[x - hw, h - 0.08, inner]} max={[x + hw, h, front]} c={c.green} />
      <RackUnit y0={1.6} y1={1.76} color={c.metalLight} z={inner}>
        <Block min={[x - 0.2, 1.635, inner + 0.014]} max={[x + 0.02, 1.725, inner + 0.018]} c={c.screen} />
        {[0, 1, 2].map((k) => (
          <Cyl key={k} p={[x + 0.07 + k * 0.045, 1.68, inner + 0.02]} radius={0.012} length={0.012} axis="z" c={k === 0 ? c.andonGreen : c.metalMid} />
        ))}
      </RackUnit>
      <RackUnit y0={1.42} y1={1.6} color={c.metalDark} z={inner}>
        {Array.from({ length: 10 }, (_, k) => (
          <group key={k}>
            <Block min={[u(k) - 0.012, 1.44, inner + 0.014]} max={[u(k) + 0.012, 1.58, inner + 0.02]} c={c.metalMid} />
            <Box p={[u(k), 1.565, inner + 0.022]} s={[0.008, 0.008, 0.004]} c={c.andonGreen} />
          </group>
        ))}
      </RackUnit>
      <RackUnit y0={1.3} y1={1.42} color={c.metalLight} z={inner}>
        {[0, 1, 2, 3].map((k) => (
          <Cyl key={k} p={[x - 0.12 + k * 0.08, 1.36, inner + 0.02]} radius={0.016} length={0.012} axis="z" c={c.metalDark} />
        ))}
      </RackUnit>
      <RackUnit y0={0.96} y1={1.3} color={c.green} z={inner}>
        {Array.from({ length: 6 }, (_, k) => (
          <Block key={k} min={[x - 0.17, 1.0 + k * 0.045, inner + 0.014]} max={[x + 0.17, 1.016 + k * 0.045, inner + 0.02]} c={c.metalDark} />
        ))}
      </RackUnit>
      <RackUnit y0={0.66} y1={0.96} color={c.metalLight} z={inner}>
        {/* Seta de emergencia sobre su placa amarilla, llave de modo y pilotos. */}
        <Block min={[x - 0.19, 0.74, inner + 0.014]} max={[x - 0.07, 0.88, inner + 0.018]} c={c.signalYellow} />
        <Cyl p={[x - 0.13, 0.81, inner + 0.03]} radius={0.04} length={0.024} axis="z" c={c.andonRed} />
        <Cyl p={[x + 0.04, 0.81, inner + 0.022]} radius={0.022} length={0.016} axis="z" c={c.metalDark} />
        {[0, 1].map((k) => (
          <Cyl key={k} p={[x + 0.12 + k * 0.05, 0.81, inner + 0.02]} radius={0.012} length={0.012} axis="z" c={k ? c.andonAmber : c.andonGreen} />
        ))}
      </RackUnit>
      <RackUnit y0={0.12} y1={0.66} color={c.metalDark} z={inner}>
        {Array.from({ length: 9 }, (_, k) => (
          <Block key={k} min={[x - 0.17, 0.18 + k * 0.05, inner + 0.014]} max={[x + 0.17, 0.196 + k * 0.05, inner + 0.02]} c={c.metalMid} />
        ))}
      </RackUnit>
      <AndonTower position={[x + 0.16, h, z - 0.1]} pole={0.24} signal={rackSignal} />
    </group>
  );
}

/**
 * Carro del monitor de adquisición: bastidor con ruedas, columna, bandeja con teclado y botonera de
 * mano (amarilla, con su seta), soporte VESA y monitor con carcasa trasera.
 */
export function MonitorCart() {
  const { x0, x1, y0, y1, z } = MONITOR;
  const cx = (x0 + x1) / 2;
  const back = z - 0.07;
  const colZ: [number, number] = [back - 0.12, back - 0.07];
  const caster = (p: Vec3) => (
    <group key={p.join()}>
      <Block min={[p[0] - 0.018, 0.04, p[2] - 0.018]} max={[p[0] + 0.018, 0.07, p[2] + 0.018]} c={c.metalMid} />
      <Cyl p={[p[0], 0.026, p[2]]} radius={0.026} length={0.022} axis="x" c={c.stripeBlack} />
    </group>
  );
  return (
    <group>
      {[-1, 1].map((s) => (
        <Block key={s} min={[cx + s * 0.27 - 0.025, 0.07, colZ[0] - 0.24]} max={[cx + s * 0.27 + 0.025, 0.11, colZ[1] + 0.26]} c={c.metalMid} />
      ))}
      <Block min={[cx - 0.27, 0.07, colZ[0] - 0.02]} max={[cx + 0.27, 0.11, colZ[1] + 0.02]} c={c.metalMid} />
      {[-1, 1].flatMap((s) => [colZ[0] - 0.21, colZ[1] + 0.23].map((zz) => caster([cx + s * 0.27, 0, zz])))}
      <Block min={[cx - 0.04, 0.11, colZ[0]]} max={[cx + 0.04, y0 + 0.24, colZ[1]]} c={c.metalLight} />
      {/* Bandeja con teclado, ratón y botonera de mano. */}
      <Block min={[cx - 0.27, 0.9, colZ[1]]} max={[cx + 0.27, 0.92, z + 0.28]} c={c.metalLight} />
      <Block min={[cx - 0.27, 0.92, z + 0.26]} max={[cx + 0.27, 0.94, z + 0.28]} c={c.metalLight} />
      <Block min={[cx - 0.22, 0.92, z + 0.03]} max={[cx + 0.08, 0.935, z + 0.17]} c={c.stripeBlack} />
      <Box p={[cx + 0.12, 0.928, z + 0.11]} s={[0.035, 0.016, 0.055]} c={c.stripeBlack} />
      <Block min={[cx + 0.15, 0.92, z + 0.02]} max={[cx + 0.24, 0.965, z + 0.2]} c={c.signalYellow} />
      <Cyl p={[cx + 0.195, 0.975, z + 0.06]} radius={0.024} length={0.02} c={c.andonRed} />
      {/* Soporte VESA y monitor. */}
      <Block min={[cx - 0.09, y0 + 0.16, colZ[1]]} max={[cx + 0.09, y0 + 0.34, back - 0.04]} c={c.metalMid} />
      <Block min={[x0 + 0.12, y0 + 0.08, back - 0.04]} max={[x1 - 0.12, y1 - 0.08, back]} c={c.metalDark} />
      <Block min={[x0, y0, back]} max={[x1, y1, z]} c={c.stripeBlack} />
      <Block min={[x0 + 0.035, y0 + 0.035, z]} max={[x1 - 0.035, y1 - 0.035, z + 0.004]} c={c.screen} />
      <Box p={[x1 - 0.06, y0 + 0.018, z + 0.002]} s={[0.012, 0.006, 0.004]} c={c.andonGreen} />
    </group>
  );
}

/**
 * Barrera fotoeléctrica en las esquinas delanteras de la bancada: emisor y receptor enfrentados
 * (la ventana oscura mira al otro poste), con su escuadra de fijación y el piloto de estado.
 */
export function LightCurtain() {
  const z = BED.z1 - 0.04;
  return (
    <group>
      {[
        [BED.x0 + 0.08, 1],
        [BED.x1 - 0.08, -1],
      ].map(([x, s]) => (
        <group key={x}>
          <Block min={[x - 0.05, BED.h, z - 0.05]} max={[x + 0.05, BED.h + 0.02, z + 0.05]} c={c.metalDark} />
          <Block min={[x - 0.03, BED.h + 0.02, z - 0.03]} max={[x + 0.03, 1.74, z + 0.03]} c={c.signalYellow} />
          <Block
            min={[x + s * 0.03 - (s < 0 ? 0.004 : 0), BED.h + 0.12, z - 0.018]}
            max={[x + s * 0.03 + (s > 0 ? 0.004 : 0), 1.66, z + 0.018]}
            c={c.stripeBlack}
          />
          <Block min={[x - 0.034, 1.74, z - 0.034]} max={[x + 0.034, 1.79, z + 0.034]} c={c.stripeBlack} />
          <Block min={[x - 0.034, BED.h + 0.02, z - 0.034]} max={[x + 0.034, BED.h + 0.06, z + 0.034]} c={c.stripeBlack} />
          <Box p={[x, 1.71, z + 0.031]} s={[0.014, 0.014, 0.004]} c={c.andonGreen} />
        </group>
      ))}
    </group>
  );
}
