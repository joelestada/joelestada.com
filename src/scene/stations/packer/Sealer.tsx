'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { END, FLOW } from '@/config/layout';
import { palette } from '@/config/palette';
import { markDirty } from '@/lib/runtime';
import { itemPacked, itemVisible, itemX } from '../../line/flow';
import { CARTON } from '../../line/carton';
import { Anchor } from '../../kit/hardware';
import { Bar, Block, Box, Cyl, Merge, Prism, Ring } from '../../kit/primitives';
import { SEALER, SEALER_REACH, TAPE_PER_BOX, rollerCenter, sealerRoller, sealerTape, type SealerTape } from '../../line/sealer';
import { toon } from '../../materials';
import { shared } from '../../shared';

const c = palette;
const { w: TW, t: TT } = CARTON.tape;
/** Eje del brazo del rodillo, en el marco de la embaladora, y cara de arriba de la caja cerrada. */
const HX = SEALER.x - END.packX;
const TOP = SEALER.top;
/** Rollo de cinta y rodillo guía (aguas abajo del rodillo de aplicar), cuchilla y rodillo de alisado. */
const ROLL = { x: HX + 0.25, y: TOP + 0.18, r: 0.09, core: 0.042 };
const GUIDE = { x: HX + 0.13, y: TOP + 0.09, r: 0.014 };
/** Rodillos de presión antes y después del cabezal: ruedan sobre las solapas cerradas. */
const PRESS = { xs: [HX - 0.22, HX + 0.6], r: (3 * CARTON.L) / (2 * Math.PI * 9), half: 0.15 };
/**
 * Bastidor: una sola columna detrás de la línea y un brazo en voladizo hasta el centro, de donde
 * cuelga el cabezal por dos guías de reglaje. Por delante no hay nada: la caja se ve pasar entera.
 */
const FRAME = { x: HX + 0.24, z: -0.6, h: 2.0, armZ: 0.06 };
/** Caja del cabezal, estrecha y sobre la junta de las solapas. */
const HOUSING = { x0: HX - 0.3, x1: HX + 0.68, y0: TOP + 0.31, y1: TOP + 0.35, z: 0.075 };
/** El rollo gira 4/3 de vuelta por caja: vuelve a la misma postura (tres radios) en cada una. */
const ROLL_SPIN = (4 * (2 * Math.PI)) / 3 / TAPE_PER_BOX;

const unit = shared(new THREE.BoxGeometry(1, 1, 1));

/** Zona que cambia al pasar una caja (rodillos, brazo, rollo), en el mundo. */
const REGION = [SEALER.x - 0.3, TOP - 0.1, -0.2, SEALER.x + 0.7, TOP + 0.32, 0.2] as const;

/**
 * Precintadora fija a la salida de la embaladora: columna con brazo en voladizo, guías de reglaje con
 * su volante, guía trasera de la caja, rodillos de presión y el cabezal de cinta (rollo, rodillo
 * guía, brazo con el rodillo de aplicar, cuchilla y rodillo de alisado). Las cajas cerradas pasan por
 * debajo y salen precintadas: la cinta la pone la línea, según dónde va cada caja (ver line/sealer).
 */
export function Sealer() {
  const arm = useRef<THREE.Group>(null);
  const roll = useRef<THREE.Group>(null);
  const presses = useRef<(THREE.Group | null)[]>([]);
  const web = useRef<THREE.Mesh>(null);
  const state = useRef({ key: '' });
  const tape = useMemo<SealerTape>(() => ({ lead: false, top: 0, trail: 0, length: 0 }), []);

  useFrame(() => {
    // La caja que pasa bajo el cabezal (como mucho una: van a cinco metros).
    let bx: number | null = null;
    for (let i = 0; i < FLOW.count; i++) {
      const x = itemX(i);
      if (itemVisible(x) && itemPacked(i) && Math.abs(x - SEALER.x) < SEALER_REACH + 0.5) {
        bx = x;
        break;
      }
    }
    const beta = sealerRoller(bx);
    const length = bx === null ? 0 : sealerTape(bx, tape).length % TAPE_PER_BOX;
    const spins = PRESS.xs.map((px) => {
      if (bx === null) return 0;
      const lead = bx - END.packX + CARTON.L / 2;
      return Math.min(Math.max(lead - px, 0), CARTON.L) / PRESS.r;
    });
    const key = `${beta.toFixed(4)}|${length.toFixed(4)}|${spins.map((s) => s.toFixed(3)).join()}`;
    if (key === state.current.key) return;
    state.current.key = key;
    if (arm.current) arm.current.rotation.z = -beta;
    if (roll.current) roll.current.rotation.z = length * ROLL_SPIN;
    presses.current.forEach((g, i) => g && (g.rotation.z = -spins[i]));
    if (web.current) {
      // Cinta tensa del rodillo guía al lado de atrás (aguas abajo) del rodillo de aplicar.
      const [rx, ry] = rollerCenter(beta);
      const ax = GUIDE.x;
      const ay = GUIDE.y - GUIDE.r;
      const bxw = rx - END.packX + SEALER.r * 0.85;
      const byw = TOP + ry - SEALER.r * 0.5;
      const len = Math.hypot(bxw - ax, byw - ay);
      web.current.position.set((ax + bxw) / 2, (ay + byw) / 2, 0);
      web.current.rotation.z = Math.atan2(byw - ay, bxw - ax);
      web.current.scale.set(len, TT, TW);
    }
    markDirty(...REGION);
  });

  const plate: [number, number][] = [
    [HX - 0.02, TOP + 0.03],
    [HX + 0.42, TOP + 0.014],
    [HX + 0.46, TOP + 0.18],
    [HX + 0.38, TOP + 0.31],
    [HX + 0.06, TOP + 0.31],
    [HX - 0.03, TOP + 0.12],
  ];
  return (
    <group>
      <Merge>
        {/* Bastidor: columna anclada detrás, brazo en voladizo con su tornapunta y guía trasera de la caja. */}
        <Block min={[FRAME.x - 0.12, 0, FRAME.z - 0.12]} max={[FRAME.x + 0.12, 0.025, FRAME.z + 0.12]} c={c.metalDark} />
        {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => <Anchor key={`${sx}${sz}`} p={[FRAME.x + sx * 0.085, 0.025, FRAME.z + sz * 0.085]} r={0.012} />))}
        <Block min={[FRAME.x - 0.045, 0.025, FRAME.z - 0.045]} max={[FRAME.x + 0.045, FRAME.h, FRAME.z + 0.045]} c={c.green} />
        <Block min={[FRAME.x - 0.04, FRAME.h - 0.09, FRAME.z - 0.045]} max={[FRAME.x + 0.04, FRAME.h, FRAME.armZ + 0.05]} c={c.green} />
        <Block min={[FRAME.x - 0.045, FRAME.h - 0.1, FRAME.armZ + 0.05]} max={[FRAME.x + 0.045, FRAME.h + 0.01, FRAME.armZ + 0.062]} c={c.metalDark} />
        <Bar a={[FRAME.x, FRAME.h - 0.55, FRAME.z + 0.045]} b={[FRAME.x, FRAME.h - 0.09, FRAME.z + 0.4]} t={0.04} c={c.green} />
        <Block min={[HX - 0.42, 1.0, -(CARTON.W / 2 + 0.05)]} max={[FRAME.x + 0.2, 1.03, -(CARTON.W / 2 + 0.03)]} c={c.metalLight} />
        <Block min={[FRAME.x - 0.02, 0.99, FRAME.z + 0.045]} max={[FRAME.x + 0.02, 1.04, -(CARTON.W / 2 + 0.05)]} c={c.metalMid} />
        {/* Guías de reglaje de altura, husillo con su volante y caja del cabezal. */}
        {[-1, 1].map((sx) => (
          <Cyl key={sx} p={[FRAME.x + sx * 0.08, (HOUSING.y1 + FRAME.h - 0.09) / 2, 0]} radius={0.014} length={FRAME.h - 0.09 - HOUSING.y1} c={c.metalLight} />
        ))}
        <Cyl p={[FRAME.x, (HOUSING.y1 + FRAME.h) / 2, 0]} radius={0.01} length={FRAME.h - HOUSING.y1} c={c.metalMid} />
        <Ring p={[FRAME.x, FRAME.h + 0.03, 0]} radius={0.065} tube={0.008} axis="y" c={c.stripeBlack} />
        <Cyl p={[FRAME.x + 0.045, FRAME.h + 0.06, 0.035]} radius={0.008} length={0.05} c={c.stripeBlack} />
        <Block min={[HOUSING.x0, HOUSING.y0, -HOUSING.z]} max={[HOUSING.x1, HOUSING.y1, HOUSING.z]} c={c.metalLight} />
        <Block min={[FRAME.x - 0.11, HOUSING.y1, -0.05]} max={[FRAME.x + 0.11, HOUSING.y1 + 0.03, 0.05]} c={c.metalMid} />
        {/* Rodillos de presión: horquillas colgadas de la caja del cabezal. */}
        {PRESS.xs.map((x) => (
          <group key={x}>
            <Block min={[x - 0.03, HOUSING.y0 - 0.02, -PRESS.half - 0.012]} max={[x + 0.03, HOUSING.y0, PRESS.half + 0.012]} c={c.metalMid} />
            {[-1, 1].map((sz) => (
              <Block
                key={sz}
                min={[x - 0.012, TOP + PRESS.r, sz * (PRESS.half + 0.006) - 0.006]}
                max={[x + 0.012, HOUSING.y0 - 0.02, sz * (PRESS.half + 0.006) + 0.006]}
                c={c.metalMid}
              />
            ))}
          </group>
        ))}
        {/* Cabezal de cinta: placa, eje del rollo, rodillo guía, cuchilla con su protector y rodillo de alisado. */}
        <Prism outline={plate} plane="xy" from={-0.06} depth={0.008} c={c.metalLight} />
        <Cyl p={[ROLL.x, ROLL.y, -0.045]} radius={0.012} length={0.03} axis="z" c={c.metalMid} />
        <Cyl p={[GUIDE.x, GUIDE.y, -0.02]} radius={GUIDE.r} length={0.07} axis="z" c={c.metalMid} />
        <Cyl p={[HX, TOP + SEALER.pivotDy, -0.045]} radius={0.012} length={0.03} axis="z" c={c.metalMid} />
        <Block min={[HX + 0.33, TOP + 0.02, -0.05]} max={[HX + 0.36, TOP + 0.07, 0.035]} c={c.signalYellow} />
        <Block min={[HX + 0.34, TOP + 0.008, -0.03]} max={[HX + 0.35, TOP + 0.022, 0.03]} c={c.metalLight} />
        <Cyl p={[HX + 0.41, TOP + 0.03, 0]} radius={0.022} length={0.064} axis="z" c={c.stripeBlack} />
        <Block min={[HX + 0.4, TOP + 0.03, -0.05]} max={[HX + 0.42, TOP + 0.12, -0.04]} c={c.metalMid} />
        {/* Primer tramo de cinta, del rollo al rodillo guía. */}
        <Box
          p={[(ROLL.x - 0.06 + GUIDE.x) / 2, (ROLL.y - 0.07 + GUIDE.y - GUIDE.r) / 2, 0]}
          s={[Math.hypot(ROLL.x - 0.06 - GUIDE.x, ROLL.y - 0.07 - GUIDE.y + GUIDE.r), TT, TW]}
          r={[0, 0, Math.atan2(GUIDE.y - GUIDE.r - ROLL.y + 0.07, GUIDE.x - ROLL.x + 0.06)]}
          c={c.tape}
        />
        {/* Caja eléctrica con su piloto en la columna. */}
        <Block min={[FRAME.x - 0.09, 1.25, FRAME.z + 0.045]} max={[FRAME.x + 0.09, 1.47, FRAME.z + 0.1]} c={c.metalLight} />
        <Box p={[FRAME.x - 0.04, 1.42, FRAME.z + 0.103]} s={[0.018, 0.018, 0.006]} c={c.andonGreen} />
        <Cyl p={[FRAME.x + 0.04, 1.42, FRAME.z + 0.108]} radius={0.014} length={0.016} axis="z" c={c.andonRed} />
      </Merge>
      <group ref={roll} position={[ROLL.x, ROLL.y, 0]}>
        <Merge>
          <Cyl p={[0, 0, 0]} radius={ROLL.r} length={TW} axis="z" segments={32} c={c.tape} />
          <Cyl p={[0, 0, 0]} radius={ROLL.core} length={TW + 0.004} axis="z" segments={24} c={c.carton} />
          <Cyl p={[0, 0, 0]} radius={0.028} length={TW + 0.012} axis="z" segments={18} c={c.metalMid} />
          {[0, 1, 2].map((i) => (
            <Box key={i} p={[0, 0, TW / 2 + 0.007]} s={[0.05, 0.008, 0.004]} r={[0, 0, (i * 2 * Math.PI) / 3]} c={c.metalDark} />
          ))}
        </Merge>
      </group>
      <group ref={arm} position={[HX, TOP + SEALER.pivotDy, 0]}>
        <Merge>
          <Block min={[-0.012, -0.008, -0.055]} max={[SEALER.len, 0.008, -0.044]} c={c.metalMid} />
          <Cyl p={[SEALER.len, 0, 0]} radius={SEALER.r} length={0.066} axis="z" segments={20} c={c.stripeBlack} />
          <Cyl p={[SEALER.len, 0, 0]} radius={0.008} length={0.09} axis="z" c={c.metalLight} />
        </Merge>
      </group>
      {PRESS.xs.map((x, i) => (
        <group
          key={x}
          ref={(g) => {
            presses.current[i] = g;
          }}
          position={[x, TOP + PRESS.r, 0]}
        >
          <Merge>
            <Cyl p={[0, 0, 0]} radius={PRESS.r} length={2 * PRESS.half} axis="z" segments={20} c={c.metalLight} />
            {[0, 1, 2].map((k) => (
              <Box key={k} p={[0, 0, 0]} s={[2 * PRESS.r + 0.002, 0.006, 2 * PRESS.half + 0.008]} r={[0, 0, (k * 2 * Math.PI) / 3]} c={c.metalMid} />
            ))}
          </Merge>
        </group>
      ))}
      <mesh ref={web} geometry={unit} material={toon(c.tape)} />
    </group>
  );
}
