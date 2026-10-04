'use client';

import type { RefObject } from 'react';
import type * as THREE from 'three';
import { palette } from '@/config/palette';
import { DragChain, poseChain, type ChainParts } from '../../kit/DragChain';
import { Block, Cyl, Merge } from '../../kit/primitives';
import { PUSHER, PUSHER_CHAIN as CHAIN, X0 } from './dims';

const c = palette;
/** Brazo de la zapata: largo (de la zapata hacia arriba) y su posición respecto al carro. */
const ARM = { len: 0.78, x: PUSHER.armX, t: 0.03 };
/** Cara de arriba de la viga y extremo móvil de la cadena, en el marco del carro. */
const BEAM_TOP = CHAIN.top;
const CHAIN_AT = -PUSHER.foot - 0.09;

export type PusherParts = { carriage: THREE.Group | null; arm: THREE.Group | null; chain: ChainParts };

/** Lleva la cadena con el carro (ya colocado). */
export function posePusher(p: PusherParts) {
  if (p.carriage) poseChain(p.chain, CHAIN, p.carriage.position.z + CHAIN_AT);
}

/**
 * Empujador: un carro que corre bajo su viga y, al costado, un cilindro que sube y baja el brazo
 * con la zapata (con su almohadilla de goma). Mete en el palé la caja que espera y, de vuelta, se
 * levanta para pasar por encima de las cajas y baja detrás de la que acaba de formarse.
 * Marcos: carro, x de la parada y cara de la zapata; brazo, el mismo, más su subida.
 */
export function Pusher({ parts }: { parts: RefObject<PusherParts> }) {
  const [y0, y1] = PUSHER.footY;
  const f = PUSHER.foot;
  return (
    <group>
      {/* Cadena portacables sobre la viga (su soporte fijo va con la viga). */}
      <group position={[X0, BEAM_TOP + CHAIN.h / 2, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <DragChain spec={CHAIN} parts={{ current: parts.current.chain }} />
      </group>
      <group
        ref={(g) => {
          parts.current.carriage = g;
        }}
      >
        <Merge>
          <Block min={[-0.06, PUSHER.beamY - 0.07, -f - 0.09]} max={[ARM.x + 0.04, PUSHER.beamY - 0.012, -f + 0.07]} c={c.metalMid} />
          {/* Escuadra del extremo móvil de la cadena: sube por el costado de la viga y la coge por arriba. */}
          <Block
            min={[0.054, PUSHER.beamY - 0.05, CHAIN_AT - 0.045]}
            max={[0.064, BEAM_TOP + CHAIN.h + 2 * CHAIN.r + 0.008, CHAIN_AT + 0.004]}
            c={c.metalMid}
          />
          <Block
            min={[-0.032, BEAM_TOP + CHAIN.h + 2 * CHAIN.r, CHAIN_AT - 0.045]}
            max={[0.064, BEAM_TOP + CHAIN.h + 2 * CHAIN.r + 0.008, CHAIN_AT + 0.004]}
            c={c.metalMid}
          />
          <Cyl p={[ARM.x + 0.045, PUSHER.beamY + 0.04, -f + 0.03]} radius={0.022} length={0.2} c={c.metalLight} />
          <Block min={[ARM.x - 0.02, PUSHER.beamY - 0.12, -f - 0.03]} max={[ARM.x + 0.02, PUSHER.beamY - 0.07, -f + 0.03]} c={c.metalDark} />
        </Merge>
      </group>
      <group
        ref={(g) => {
          parts.current.arm = g;
        }}
      >
        <Merge>
          <Block min={[ARM.x - ARM.t / 2, y1, -f - ARM.t / 2]} max={[ARM.x + ARM.t / 2, y1 + ARM.len, -f + ARM.t / 2]} c={c.metalLight} />
          <Block min={[-0.22, y0, -f]} max={[0.22, y1, -0.012]} c={c.metalMid} />
          <Block min={[-0.2, y0 + 0.012, -0.012]} max={[0.2, y1 - 0.012, 0]} c={c.stripeBlack} />
          <Block min={[ARM.x - 0.035, y1, -f]} max={[ARM.x + 0.035, y1 + 0.05, -f + 0.05]} c={c.metalMid} />
        </Merge>
      </group>
    </group>
  );
}
