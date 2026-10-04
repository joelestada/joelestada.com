'use client';

import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { LIFE } from '@/config/layout';
import { palette } from '@/config/palette';
import { markDirty, requestAmbient, wakeIn } from '@/lib/runtime';
import { Block, Cyl, Merge } from '../kit/primitives';
import { regionOnScreen, snapToPixels } from '../kit/regions';
import { flow } from '../line/flow';
import { lifeRunning, lifeTime } from './clock';

const { z: LANE, x0: START, x1: END, stops: STOPS, speed: V, dwellS: DWELL_S } = LIFE.agv;
const RAMP_S = 1.2;
/** Medio largo y medio ancho del carro (m). */
const HALF = { x: 0.56, z: 0.34 };

type Leg = { t0: number; t1: number; from: number; to: number } | { t0: number; t1: number; at: number };

/** Ida y vuelta por el pasillo, parando detrás de cada estación. */
function buildRoute() {
  const legs: Leg[] = [];
  let t = 0;
  let x: number = START;
  const go = (to: number) => {
    const dur = Math.abs(to - x) / V + RAMP_S;
    legs.push({ t0: t, t1: t + dur, from: x, to });
    t += dur;
    x = to;
  };
  const wait = (s: number) => {
    legs.push({ t0: t, t1: t + s, at: x });
    t += s;
  };
  for (const s of STOPS) {
    go(s);
    wait(DWELL_S);
  }
  go(END);
  wait(DWELL_S * 0.5);
  for (const s of [...STOPS].reverse()) {
    go(s);
    wait(DWELL_S);
  }
  go(START);
  wait(DWELL_S * 0.5);
  return { legs, length: t };
}

function travel(u: number, dist: number, dur: number) {
  const v = dist / (dur - RAMP_S);
  const ramp = (w: number) => v * (w / 2 - (RAMP_S / (2 * Math.PI)) * Math.sin((Math.PI * w) / RAMP_S));
  if (u <= 0) return 0;
  if (u >= dur) return dist;
  if (u < RAMP_S) return ramp(u);
  if (u > dur - RAMP_S) return dist - ramp(dur - u);
  return ramp(RAMP_S) + v * (u - RAMP_S);
}

const box = (x: number) => [x - HALF.x - 0.05, 0, LANE - HALF.z - 0.05, x + HALF.x + 0.05, 0.62, LANE + HALF.z + 0.05] as const;

/** Carro autónomo (AGV) que sigue la línea pintada del pasillo del fondo con una caja encima. */
export function Agv() {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const group = useRef<THREE.Group>(null);
  const { legs, length } = useMemo(buildRoute, []);
  const state = useRef({ x: NaN, key: NaN });
  const p = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    const st = state.current;
    const u = ((lifeTime(flow.now) % length) + length) % length;
    const leg = legs.find((l) => u >= l.t0 && u < l.t1) ?? legs[legs.length - 1];
    const moving = 'to' in leg;
    const x = moving ? leg.from + Math.sign(leg.to - leg.from) * travel(u - leg.t0, Math.abs(leg.to - leg.from), leg.t1 - leg.t0) : leg.at;
    const visible = regionOnScreen(box(x), 0) || (Number.isFinite(st.x) && regionOnScreen(box(st.x), 0));
    if (Number.isFinite(st.key) && (!visible || !lifeRunning())) return;
    p.set(x, 0, LANE);
    snapToPixels(p, camera as THREE.OrthographicCamera, gl.getPixelRatio());
    const key = p.x * 1e3 + p.y * 1e6 + p.z;
    if (key !== st.key) {
      st.key = key;
      group.current?.position.copy(p);
      if (Number.isFinite(st.x)) markDirty(...box(st.x));
      markDirty(...box(x));
      st.x = x;
    }
    if (!visible) return;
    if (moving) requestAmbient();
    else wakeIn((leg.t1 - u) * 1000);
  });

  const { x: hx, z: hz } = HALF;
  return (
    <group ref={group} position={[START, 0, LANE]}>
      <Merge>
        {/* Chasis bajo con faldón de goma y cubierta. */}
        <Block min={[-hx, 0.02, -hz]} max={[hx, 0.07, hz]} c={palette.stripeBlack} />
        <Block min={[-hx + 0.02, 0.07, -hz + 0.02]} max={[hx - 0.02, 0.27, hz - 0.02]} c={palette.metalLight} />
        <Block min={[-hx + 0.06, 0.27, -hz + 0.06]} max={[hx - 0.06, 0.29, hz - 0.06]} c={palette.metalMid} />
        {/* Lectores láser en los dos extremos (va y vuelve sin girar). */}
        {[-1, 1].map((s) => (
          <Cyl key={s} p={[s * (hx - 0.1), 0.315, 0]} radius={0.045} length={0.05} c={palette.stripeBlack} />
        ))}
        <Cyl p={[hx - 0.18, 0.3, hz - 0.12]} radius={0.022} length={0.03} c={palette.andonGreen} />
        {/* Caja de piezas. */}
        <Block min={[-0.3, 0.29, -0.22]} max={[0.3, 0.52, 0.22]} c={palette.metalMid} />
        <Block min={[-0.27, 0.52, -0.19]} max={[0.27, 0.525, 0.19]} c={palette.metalDark} />
      </Merge>
    </group>
  );
}
