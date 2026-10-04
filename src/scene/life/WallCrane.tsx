'use client';

import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { BUILDING, LIFE } from '@/config/layout';
import { palette } from '@/config/palette';
import { markDirty, requestAmbient, wakeIn } from '@/lib/runtime';
import { toon } from '../materials';
import { Bar, Block, Merge } from '../kit/primitives';
import { regionOnScreen, snapToPixels } from '../kit/regions';
import { flow } from '../line/flow';
import { hash, lifeRunning, lifeTime, smooth } from './clock';

const C = LIFE.crane;
const WALL = BUILDING.backWallZ;
/** Carril: viga en I sobre ménsulas, separada del muro. */
const RAIL = { y: C.y, z: WALL + 0.25, h: 0.3, flange: 0.22 };
/** Pluma (hasta dónde llega hacia la nave), carro y gancho (cotas en m). */
const JIB = { y: RAIL.y - 0.55, h: 0.15, tip: WALL + C.reach };
const TROLLEY = { near: WALL + 0.9, far: JIB.tip - 0.35 };
const HOOK = { high: JIB.y - 0.55, low: JIB.y - 1.55 };

/**
 * Programa de la grúa: se traslada a una posición, espera, mueve el carro por la pluma, baja el
 * gancho, lo sube y vuelve a trasladarse. Todo muy lento; cada vuelta cambia de posiciones.
 */
function plan(t: number) {
  const STAY = 16;
  const MOVE = 13;
  const step = STAY + MOVE;
  const n = Math.floor(t / step);
  const u = t - n * step;
  const pos = (k: number) => C.x0 + hash(k + 3) * (C.x1 - C.x0);
  const reach = (k: number) => TROLLEY.near + hash(k + 41) * (TROLLEY.far - TROLLEY.near);
  // Traslado a la nueva posición (con carro y gancho quietos, arriba).
  if (u < MOVE) {
    const k = smooth(u / MOVE);
    return { x: pos(n) + (pos(n + 1) - pos(n)) * k, trolley: reach(n), hook: HOOK.high, moving: true, next: 0 };
  }
  // Parado: el carro se desplaza, el gancho baja y sube.
  const w = u - MOVE;
  const tr = reach(n) + (reach(n + 1) - reach(n)) * smooth(w / 4);
  const hook =
    w < 5
      ? HOOK.high
      : w < 9
        ? HOOK.high + (HOOK.low - HOOK.high) * smooth((w - 5) / 4)
        : w < 11
          ? HOOK.low
          : HOOK.low + (HOOK.high - HOOK.low) * smooth((w - 11) / 4);
  const still = (w > 4 && w < 5) || (w > 9 && w < 11) || w > 15;
  const next = w < 4 ? 0 : w < 5 ? 5 - w : w < 9 ? 0 : w < 11 ? 11 - w : w < 15 ? 0 : STAY - w;
  return { x: pos(n + 1), trolley: tr, hook, moving: !still, next };
}

const box = (x: number) => [x - 0.7, HOOK.low - 0.25, WALL, x + 0.7, RAIL.y + RAIL.h + 0.2, JIB.tip + 0.1] as const;

/** Carril a lo largo del muro del fondo (fijo). */
function Runway() {
  const pil = BUILDING.backWallPilasterXs;
  const f = RAIL.flange / 2;
  return (
    <Merge>
      <Block min={[C.x0 - 1.2, RAIL.y, RAIL.z - f]} max={[C.x1 + 1.2, RAIL.y + 0.03, RAIL.z + f]} c={palette.metalMid} />
      <Block min={[C.x0 - 1.2, RAIL.y + 0.03, RAIL.z - 0.02]} max={[C.x1 + 1.2, RAIL.y + RAIL.h - 0.03, RAIL.z + 0.02]} c={palette.metalMid} />
      <Block min={[C.x0 - 1.2, RAIL.y + RAIL.h - 0.03, RAIL.z - f]} max={[C.x1 + 1.2, RAIL.y + RAIL.h, RAIL.z + f]} c={palette.metalMid} />
      {pil.map((x) => (
        <Block key={x} min={[x - 0.1, RAIL.y - 0.2, WALL]} max={[x + 0.1, RAIL.y + RAIL.h, RAIL.z - f]} c={palette.metalMid} />
      ))}
    </Merge>
  );
}

/**
 * Grúa de pluma que recorre el muro del fondo, muy despacio, entre largas esperas. Rellena la parte
 * alta de la nave con un movimiento grande, pesado y tranquilo.
 */
export function WallCrane() {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const crane = useRef<THREE.Group>(null);
  const trolley = useRef<THREE.Group>(null);
  const cable = useRef<THREE.Mesh>(null);
  const hook = useRef<THREE.Group>(null);
  const state = useRef({ x: NaN, key: '' });
  const v = useMemo(() => ({ root: new THREE.Vector3(), part: new THREE.Vector3() }), []);

  useFrame(() => {
    const st = state.current;
    const s = plan(lifeTime(flow.now));
    const visible = regionOnScreen(box(s.x), 0) || (Number.isFinite(st.x) && regionOnScreen(box(st.x), 0));
    if (st.key && (!visible || !lifeRunning())) return;
    const cam = camera as THREE.OrthographicCamera;
    const pr = gl.getPixelRatio();
    // Cada pieza móvil se ajusta a la rejilla de píxeles por separado.
    snapToPixels(v.root.set(s.x, 0, 0), cam, pr);
    snapToPixels(v.part.set(s.x, 0, s.trolley), cam, pr).sub(v.root);
    const tz = v.part.z;
    const ty = v.part.y;
    snapToPixels(v.part.set(s.x, s.hook, s.trolley), cam, pr).sub(v.root);
    const key = `${v.root.x.toFixed(5)}|${v.root.y.toFixed(5)}|${tz.toFixed(5)}|${v.part.y.toFixed(5)}`;
    if (key !== st.key) {
      st.key = key;
      crane.current?.position.copy(v.root);
      trolley.current?.position.set(v.part.x, ty, tz);
      hook.current?.position.set(v.part.x, v.part.y, v.part.z);
      if (cable.current) {
        const top = JIB.y - 0.2;
        const bottom = v.part.y + 0.14;
        cable.current.scale.y = top - bottom;
        cable.current.position.y = (top + bottom) / 2;
      }
      if (Number.isFinite(st.x)) markDirty(...box(st.x));
      markDirty(...box(s.x));
      st.x = s.x;
    }
    if (!visible) return;
    if (s.moving) requestAmbient();
    else wakeIn(s.next * 1000);
  });

  return (
    <group>
      <Runway />
      <group ref={crane}>
        <Merge>
          {/* Carro de traslación sobre el carril y columna de la que sale la pluma. */}
          <Block min={[-0.36, RAIL.y + RAIL.h, RAIL.z - 0.16]} max={[0.36, RAIL.y + RAIL.h + 0.14, RAIL.z + 0.16]} c={palette.metalLight} />
          <Block
            min={[-0.24, JIB.y - 0.08, RAIL.z + RAIL.flange / 2]}
            max={[0.24, RAIL.y + RAIL.h + 0.14, RAIL.z + RAIL.flange / 2 + 0.08]}
            c={palette.metalLight}
          />
          {/* Pluma en cajón y tirante. */}
          <Block min={[-0.08, JIB.y, RAIL.z + 0.19]} max={[0.08, JIB.y + JIB.h, JIB.tip]} c={palette.metalLight} />
          <Block min={[-0.11, JIB.y - 0.02, RAIL.z + 0.19]} max={[0.11, JIB.y, JIB.tip]} c={palette.metalMid} />
          <Bar a={[0, RAIL.y + RAIL.h + 0.1, RAIL.z + 0.2]} b={[0, JIB.y + JIB.h, JIB.tip - 0.3]} t={0.04} c={palette.metalMid} />
          <Block min={[-0.1, JIB.y - 0.02, JIB.tip - 0.06]} max={[0.1, JIB.y + JIB.h + 0.04, JIB.tip]} c={palette.metalDark} />
        </Merge>
        <group ref={trolley}>
          <Merge>
            <Block min={[-0.13, JIB.y - 0.1, -0.12]} max={[0.13, JIB.y - 0.02, 0.12]} c={palette.metalMid} />
            <Block min={[-0.1, JIB.y - 0.3, -0.13]} max={[0.1, JIB.y - 0.1, 0.13]} c={palette.metalDark} />
          </Merge>
          <mesh ref={cable} material={toon(palette.stripeBlack)}>
            <cylinderGeometry args={[0.008, 0.008, 1, 6]} />
          </mesh>
        </group>
        <group ref={hook}>
          <Merge>
            <Block min={[-0.08, 0.02, -0.05]} max={[0.08, 0.16, 0.05]} c={palette.metalDark} />
            <Block min={[-0.012, -0.06, -0.012]} max={[0.012, 0.02, 0.012]} c={palette.metalMid} />
            <Block min={[-0.012, -0.075, -0.05]} max={[0.012, -0.055, 0.012]} c={palette.metalMid} />
          </Merge>
        </group>
      </group>
    </group>
  );
}
