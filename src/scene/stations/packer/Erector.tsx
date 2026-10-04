'use client';

import { useLayoutEffect, useRef, type RefObject } from 'react';
import type * as THREE from 'three';
import { palette } from '@/config/palette';
import { ALPHA_FLAT, CARTON, CARTON_ON_PALLET } from '../../line/carton';
import { DragChain, poseChain, type ChainParts } from '../../kit/DragChain';
import { Block, Cyl, Merge } from '../../kit/primitives';
import { Carton, emptyCarton, poseCarton } from './Carton';
import { BOX_Y0, ERECTOR, FORM_Z, PICKER_CHAIN as CHAIN, X0 } from './dims';

const c = palette;
const { L, W, H, F, T } = CARTON;

export type ErectorParts = {
  stack: THREE.Group | null;
  pickerCarriage: THREE.Group | null;
  pickerArm: THREE.Group | null;
  openerLift: THREE.Group | null;
  openerSpin: THREE.Group | null;
  bed: THREE.Group | null;
  chain: ChainParts;
};

/** Lleva la cadena del brazo con su carro (ya colocado). */
export function poseErector(e: ErectorParts) {
  if (e.pickerCarriage) poseChain(e.chain, CHAIN, e.pickerCarriage.position.z + CHAIN.at);
}

/** Cota de la cara de arriba del tramo móvil de la cadena (donde la coge la escuadra del carro). */
const CHAIN_LID = CHAIN.top + CHAIN.h + 2 * CHAIN.r;

/** Brazo de la plancha: cota de su barra de ventosas y x de su montante (por la izquierda, fuera de la caja). */
const PICKER = { y: 1.0, postX: -0.265 };
/** Abridor: eje junto a la esquina de la pared que abre, cota del brazo y largo. */
const OPENER = { x: X0 + L / 2 + 0.025, z: ERECTOR.formA + 0.025, y: 1.04, len: 0.42 };

/** La plancha de delante del cargador, ya pintada: la misma caja, plegada y quieta (se funde en una pieza). */
function FlatBlank() {
  const parts = useRef(emptyCarton());
  useLayoutEffect(() => poseCarton(parts.current, ALPHA_FLAT, [0, 0], [0, 0]), []);
  return <Carton parts={parts} />;
}

/**
 * Cargador de planchas: la de delante con sus pliegues y su rótulo y, detrás, las demás (se ven sus
 * cantos) y la plancha de empuje. Avanza un paso al llevarse la de delante.
 * Marco: plano de la pared delantera de la plancha de delante, a un paso de la que se lleva la formadora.
 */
export function Stack({ group }: { group: RefObject<THREE.Group | null> }) {
  const [px] = CARTON_ON_PALLET;
  const back = ERECTOR.magA - (ERECTOR.stack + 0.5) * ERECTOR.pitch;
  return (
    <group ref={group}>
      <group position={[X0 + px, BOX_Y0, ERECTOR.magA - ERECTOR.pitch]}>
        <Merge>
          <FlatBlank />
        </Merge>
      </group>
      <Merge>
        {Array.from({ length: ERECTOR.stack - 1 }, (_, k) => {
          const z = ERECTOR.magA - (k + 2) * ERECTOR.pitch;
          return <Block key={k} min={[X0 + px, BOX_Y0 - F, z - 2 * T]} max={[X0 + px + L + W, BOX_Y0 + H + T + F, z]} c={c.cartonEdge} />;
        })}
        <Block min={[X0 + px + 0.1, BOX_Y0, back - 0.02]} max={[X0 + px + L + W - 0.1, BOX_Y0 + H, back]} c={c.metalMid} />
        <Cyl p={[X0 + px + (L + W) / 2, BOX_Y0 + H / 2, back - 0.12]} radius={0.016} length={0.2} axis="z" c={c.metalLight} />
      </Merge>
    </group>
  );
}

/**
 * Partes móviles de la formadora: el brazo que saca la plancha y la sujeta por la pared delantera,
 * el abridor que gira con la pared lateral hasta cuadrar la caja y la mesa que baja para que cuelgue
 * el fondo y sube a sostener la caja formada.
 * Marcos: brazo, plano de la pared delantera (más su subida); abridor, su eje; mesa, su cota.
 */
export function ErectorMoving({ parts }: { parts: RefObject<ErectorParts> }) {
  const set = (key: Exclude<keyof ErectorParts, 'chain'>) => (g: THREE.Group | null) => {
    parts.current[key] = g;
  };
  return (
    <group>
      {/* Cadena portacables del brazo, sobre el larguero. */}
      <group position={[CHAIN.x, CHAIN.top + CHAIN.h / 2, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <DragChain spec={CHAIN} parts={{ current: parts.current.chain }} />
      </group>
      <group ref={set('pickerCarriage')}>
        <Merge>
          <Block min={[-0.3, ERECTOR.h - 0.15, -0.07]} max={[-0.23, ERECTOR.h - 0.085, 0.07]} c={c.metalMid} />
          {/* Escuadra del extremo móvil de la cadena: sube por dentro del larguero y la coge por arriba. */}
          <Block min={[-0.243, ERECTOR.h - 0.12, CHAIN.at - 0.04]} max={[-0.233, CHAIN_LID + 0.008, CHAIN.at + 0.004]} c={c.metalMid} />
          <Block min={[CHAIN.x - CHAIN.w / 2 - 0.006, CHAIN_LID, CHAIN.at - 0.04]} max={[-0.233, CHAIN_LID + 0.008, CHAIN.at + 0.004]} c={c.metalMid} />
        </Merge>
      </group>
      <group ref={set('pickerArm')}>
        <Merge>
          <Block min={[PICKER.postX - 0.015, PICKER.y, 0.025]} max={[PICKER.postX + 0.015, ERECTOR.h - 0.15, 0.055]} c={c.metalLight} />
          <Block min={[PICKER.postX - 0.015, PICKER.y, 0.03]} max={[0.45, PICKER.y + 0.04, 0.05]} c={c.metalMid} />
          {[0.02, 0.36].map((x) => (
            <group key={x}>
              <Cyl p={[x, PICKER.y + 0.02, 0.019]} radius={0.017} length={0.022} axis="z" segments={12} c={c.stripeBlack} />
              <Cyl p={[x, PICKER.y + 0.02, 0.004]} radius={0.024} length={0.008} axis="z" segments={14} c={c.stripeBlack} />
            </group>
          ))}
        </Merge>
      </group>
      <group ref={set('openerLift')}>
        <Cyl p={[OPENER.x, (OPENER.y + ERECTOR.h - 0.36) / 2, OPENER.z]} radius={0.014} length={ERECTOR.h - 0.36 - OPENER.y} c={c.metalLight} />
        <group ref={set('openerSpin')} position={[OPENER.x, OPENER.y, OPENER.z]}>
          <Merge>
            <Block min={[-0.02, 0, -0.012]} max={[OPENER.len, 0.035, 0.012]} c={c.metalMid} />
            <Cyl p={[0, 0.02, 0]} radius={0.03} length={0.06} c={c.metalMid} />
            {[0.13, 0.33].map((x) => (
              <group key={x}>
                <Cyl p={[x, 0.018, -0.006]} radius={0.016} length={0.012} axis="z" segments={12} c={c.stripeBlack} />
                <Cyl p={[x, 0.018, -0.019]} radius={0.022} length={0.012} axis="z" segments={14} c={c.stripeBlack} />
              </group>
            ))}
          </Merge>
        </group>
      </group>
      <group ref={set('bed')}>
        <Merge>
          <Block min={[X0 - 0.32, -0.012, FORM_Z - 0.25]} max={[X0 + 0.32, 0, FORM_Z + 0.25]} c={c.metalMid} />
          {[-0.2, 0.2].map((dx) => (
            <Cyl key={dx} p={[X0 + dx, -0.212, FORM_Z]} radius={0.018} length={0.4} c={c.metalLight} />
          ))}
        </Merge>
      </group>
    </group>
  );
}
