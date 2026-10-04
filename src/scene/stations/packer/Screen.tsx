'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { END, LINE } from '@/config/layout';
import { palette } from '@/config/palette';
import { markDirty, runtime } from '@/lib/runtime';
import { PACK, flow, workTime } from '../../line/flow';
import { DECAL_LAYER } from '../../materials';
import { HMI } from './dims';

/** Píxeles de la pantalla y alto de cada fila de paso. */
const PX = { w: 72, h: 52, row: 8 };
/** Pasos del ciclo en pantalla: coger la pieza, meterla en la caja, plegar y cerrar. */
const STEPS = [PACK.down[0], PACK.lower[0], PACK.minors[0], PACK.sealed, PACK.end];

/** Paso en curso: 0 en espera; 1..4 durante el ciclo. */
function stepOf(t: number) {
  if (t < 0 || t < STEPS[0]) return 0;
  const i = STEPS.findIndex((s) => t < s);
  return i < 0 ? 0 : i;
}

/** Zona de la consola en el mundo (cubre la pantalla girada). */
const REGION = [
  END.packX + HMI.p[0] - 0.2,
  HMI.p[1] - 0.16,
  LINE.axisZ + HMI.p[2] - 0.16,
  END.packX + HMI.p[0] + 0.2,
  HMI.p[1] + 0.16,
  LINE.axisZ + HMI.p[2] + 0.2,
] as const;

/**
 * Pantalla de la consola de la embaladora: los cuatro pasos del ciclo, con el que está en curso
 * resaltado, la barra de avance del ciclo y el piloto de marcha, como el programa del robot.
 */
export function PackerScreen() {
  const screen = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = PX.w;
    canvas.height = PX.h;
    const ctx = canvas.getContext('2d')!;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    const draw = (step: number, fill: number, running: boolean) => {
      ctx.globalAlpha = 1;
      ctx.fillStyle = palette.screenDeep;
      ctx.fillRect(0, 0, PX.w, PX.h);
      // Cabecera con el piloto de marcha.
      ctx.fillStyle = palette.screenInk;
      ctx.globalAlpha = 0.5;
      ctx.fillRect(4, 3, 22, 3);
      ctx.globalAlpha = 1;
      ctx.fillStyle = running ? palette.andonGreen : palette.andonAmber;
      ctx.fillRect(PX.w - 9, 2, 5, 5);
      for (let r = 0; r < 4; r++) {
        const y = 11 + r * PX.row;
        const on = step === r + 1;
        if (on) {
          ctx.fillStyle = palette.andonGreen;
          ctx.globalAlpha = 0.35;
          ctx.fillRect(2, y - 2, PX.w - 4, PX.row - 1);
        }
        ctx.globalAlpha = on ? 1 : step > r + 1 ? 0.75 : 0.4;
        ctx.fillStyle = palette.screenInk;
        ctx.fillRect(5, y, 5, 3);
        ctx.fillRect(14, y, 18 + ((r * 29) % 17), 3);
      }
      // Avance del ciclo.
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = palette.screenInk;
      ctx.fillRect(4, PX.h - 7, PX.w - 8, 3);
      ctx.globalAlpha = 1;
      ctx.fillStyle = palette.andonGreen;
      ctx.fillRect(4, PX.h - 7, fill, 3);
      texture.needsUpdate = true;
    };
    return { texture, draw };
  }, []);
  const key = useRef('');

  useEffect(() => () => screen.texture.dispose(), [screen]);

  useFrame(() => {
    const t = workTime('pack');
    const step = stepOf(t);
    const fill = t < 0 ? 0 : Math.round(Math.min(1, t / PACK.end) * (PX.w - 8));
    const next = `${step}|${fill}|${flow.running}`;
    if (next === key.current) return;
    key.current = next;
    screen.draw(step, fill, flow.running);
    markDirty(...REGION);
    runtime.invalidate();
  });

  const { x0, x1, y0, y1, z } = HMI.screen;
  return (
    <group position={HMI.p} rotation={HMI.r}>
      <mesh position={[(x0 + x1) / 2, (y0 + y1) / 2, z + 0.0008]} layers={DECAL_LAYER}>
        <planeGeometry args={[x1 - x0, y1 - y0]} />
        <meshBasicMaterial map={screen.texture} toneMapped={false} />
      </mesh>
    </group>
  );
}
