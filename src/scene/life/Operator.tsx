'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { LINE, STATION_X } from '@/config/layout';
import { palette } from '@/config/palette';
import { markDirty, wakeIn } from '@/lib/runtime';
import { DECAL_LAYER } from '../materials';
import { Block, Cyl, Merge } from '../kit/primitives';
import { regionOnScreen, type Region } from '../kit/regions';
import { flow } from '../line/flow';
import { hash, lifeRunning, lifeTime, smooth } from './clock';
import { armReach, BODY, emptyRig, Person, type Rig } from './Person';

/** Consola de Ottometrix (local de la estación): tablero y silla, ya modelados en la estación. */
const DESK_TOP = 0.9;
const SEAT_TOP = 0.62;
/** Operador sentado de espaldas al espectador, mirando a la pantalla grande. */
const ROOT: [number, number, number] = [0, SEAT_TOP + 0.045, -1.18];
const LEAN = -0.12;
/** Puesto: monitor, teclado, ratón y móvil. */
const MONITOR = { x: -0.14, z: -1.9, w: 0.54, h: 0.32, y: DESK_TOP + 0.13 };
const KEYBOARD = { x: 0.02, z: -1.67, w: 0.42, d: 0.14 };
/** Altura de las manos sobre el teclado. */
const HAND_Y = DESK_TOP + 0.045;

/** Movimiento a 30 fps: sobra para teclear y girar la cabeza, y cuesta la mitad. */
const TICK = 1 / 30;
/** Pantalla del monitor (px) y ritmo de escritura (pulsaciones por segundo tecleando). */
const SCREEN_PX = { w: 256, h: 152 };
const KEYS_PER_S = 7;

/** Zonas que cambian: la persona (cabeza, brazos) y la pantalla del monitor. */
const REGIONS: Region[] = [[-0.5, 0.55, -1.95, 0.5, 1.82, -0.95]];
const SCREEN_REGION: Region = [MONITOR.x - 0.3, MONITOR.y - 0.02, MONITOR.z - 0.05, MONITOR.x + 0.3, MONITOR.y + MONITOR.h + 0.02, MONITOR.z + 0.04];

type Look = 'monitor' | 'keyboard' | 'screen' | 'right' | 'left';
/** Horario de 26 s: [inicio, fin, a dónde mira, teclea]. */
const LOOP_S = 26;
const PLAN: [number, number, Look, boolean][] = [
  [0, 5, 'monitor', true],
  [5, 6.1, 'keyboard', true],
  [6.1, 10.5, 'monitor', true],
  [10.5, 12.6, 'screen', false],
  [12.6, 16.8, 'monitor', true],
  [16.8, 18.2, 'right', false],
  [18.2, 21.8, 'monitor', true],
  [21.8, 22.9, 'keyboard', true],
  [22.9, 24.6, 'monitor', true],
  [24.6, 26, 'left', false],
];
/** Cabeza: [cabeceo (negativo, hacia abajo), giro (positivo, a su izquierda)]. */
const LOOK: Record<Look, [number, number]> = {
  monitor: [-0.36, 0.2],
  keyboard: [-0.72, 0.02],
  screen: [0.28, 0],
  right: [-0.1, -0.6],
  left: [-0.12, 0.55],
};
const BLEND_S = 0.45;
/** Segundos tecleados por vuelta del horario (para saber cuánto código lleva escrito). */
const TYPED_PER_LOOP = PLAN.reduce((s, [a, b, , typing]) => s + (typing ? b - a : 0), 0);

function typedSeconds(t: number) {
  const loops = Math.floor(t / LOOP_S);
  const u = t - loops * LOOP_S;
  let s = loops * TYPED_PER_LOOP;
  for (const [a, b, , typing] of PLAN) if (typing && u > a) s += Math.min(u, b) - a;
  return s;
}

/** Pose de la cabeza y fuerza del tecleo en el instante `t` (s), con transiciones suaves. */
function sample(t: number) {
  const u = ((t % LOOP_S) + LOOP_S) % LOOP_S;
  let i = PLAN.findIndex(([a, b]) => u >= a && u < b);
  if (i < 0) i = 0;
  const [a, , look, typing] = PLAN[i];
  const [, , prevLook, prevTyping] = PLAN[(i + PLAN.length - 1) % PLAN.length];
  const k = smooth((u - a) / BLEND_S);
  const [p0, y0] = LOOK[prevLook];
  const [p1, y1] = LOOK[look];
  const typingNow = (prevTyping ? 1 - k : 0) + (typing ? k : 0);
  return { pitch: p0 + (p1 - p0) * k, yaw: y0 + (y1 - y0) * k, typing: typingNow, up: look === 'screen' ? k : prevLook === 'screen' ? 1 - k : 0 };
}

/** Código que va apareciendo en el monitor: líneas con sangría y tres colores de sintaxis. */
function makeProgram() {
  const lines: { indent: number; tokens: { w: number; c: number }[] }[] = [];
  let indent = 0;
  for (let n = 0; n < 64; n++) {
    const r = hash(n + 11);
    if (r < 0.12 && indent > 0) indent--;
    else if (r > 0.82 && indent < 3) indent++;
    const count = 1 + Math.floor(hash(n + 57) * 4);
    const tokens = Array.from({ length: count }, (_, k) => ({
      w: 3 + Math.floor(hash(n * 7 + k) * 9),
      c: hash(n * 13 + k) < 0.55 ? 0 : hash(n * 17 + k) < 0.6 ? 1 : 2,
    }));
    lines.push({ indent, tokens });
  }
  return lines;
}

function useCodeScreen() {
  return useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = SCREEN_PX.w;
    canvas.height = SCREEN_PX.h;
    const ctx = canvas.getContext('2d')!;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    const program = makeProgram();
    const colors = [palette.screenInk, palette.andonGreen, palette.signalYellow];
    const CHAR = 4;
    const ROW = 13;
    const ROWS = Math.floor((SCREEN_PX.h - 14) / ROW);
    /** Dibuja el código con `typed` caracteres escritos. */
    const draw = (typed: number) => {
      ctx.fillStyle = palette.screenDeep;
      ctx.fillRect(0, 0, SCREEN_PX.w, SCREEN_PX.h);
      // Longitud de cada línea en caracteres; se escribe de corrido y se vuelve a empezar al acabar.
      const lengths = program.map((l) => l.tokens.reduce((s, t) => s + t.w + 1, 0));
      const total = lengths.reduce((s, n) => s + n, 0);
      let left = typed % total;
      let line = 0;
      while (line < program.length - 1 && left >= lengths[line]) left -= lengths[line++];
      const first = Math.max(0, line - ROWS + 1);
      for (let r = first; r <= line; r++) {
        const y = 8 + (r - first) * ROW;
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = palette.screenInk;
        ctx.fillRect(6, y + 2, 8, 5);
        ctx.globalAlpha = 0.85;
        let x = 22 + program[r].indent * 12;
        let budget = r < line ? Infinity : left;
        for (const t of program[r].tokens) {
          if (budget <= 0) break;
          const w = Math.min(t.w, budget) * CHAR;
          ctx.fillStyle = colors[t.c];
          ctx.fillRect(x, y + 1, w - 1, 7);
          x += (t.w + 1) * CHAR;
          budget -= t.w + 1;
        }
        if (r === line) {
          // Cursor al final de la línea en curso.
          ctx.globalAlpha = 1;
          ctx.fillStyle = palette.screenInk;
          ctx.fillRect(x - (budget < 0 ? CHAR * -budget : 0), y, 2, 9);
        }
      }
      ctx.globalAlpha = 1;
      texture.needsUpdate = true;
    };
    draw(0);
    return { texture, draw };
  }, []);
}

/** Monitores laterales: abiertos en arco hacia el operador, unidos al central por sus bordes. */
const ARC = 0.42;
const SIDES = [-1, 1].map((s) => {
  const hinge = MONITOR.x + s * (MONITOR.w / 2 + 0.012);
  return {
    s,
    x: hinge + s * (MONITOR.w / 2) * Math.cos(ARC),
    z: MONITOR.z + (MONITOR.w / 2) * Math.sin(ARC),
    rot: -s * ARC,
  };
});
/** Brazo de los monitores: columna sujeta al canto trasero del tablero y travesaño detrás de ellos. */
const ARM = { z: MONITOR.z - 0.075, y: MONITOR.y + MONITOR.h / 2, x0: MONITOR.x - 0.62, x1: MONITOR.x + 0.62 };

/** Pantallas de los monitores laterales (fijas): curva de rentabilidad frente a su índice y ranking. */
function useSideScreens() {
  const textures = useMemo(() => {
    const make = (draw: (ctx: CanvasRenderingContext2D) => void) => {
      const canvas = document.createElement('canvas');
      canvas.width = SCREEN_PX.w;
      canvas.height = SCREEN_PX.h;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = palette.screenDeep;
      ctx.fillRect(0, 0, SCREEN_PX.w, SCREEN_PX.h);
      // Barra de título de la ventana.
      ctx.fillStyle = palette.screen;
      ctx.fillRect(0, 0, SCREEN_PX.w, 14);
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = palette.screenInk;
      ctx.fillRect(8, 5, 46, 4);
      ctx.globalAlpha = 1;
      draw(ctx);
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.minFilter = THREE.LinearFilter;
      texture.generateMipmaps = false;
      return texture;
    };
    const { w, h } = SCREEN_PX;
    const chart = make((ctx) => {
      const [x0, x1, y0, y1] = [18, w - 10, 28, h - 14];
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = palette.screenInk;
      for (let k = 0; k <= 4; k++) ctx.fillRect(x0, y0 + ((y1 - y0) * k) / 4, x1 - x0, 1);
      ctx.globalAlpha = 1;
      // Dos curvas acumuladas: la de la cartera (clara) y la del índice (gris), paso a paso.
      for (const [color, drift, seed, width] of [
        [palette.metalMid, 0.18, 3, 1.5],
        [palette.screenInk, 0.34, 9, 2],
      ] as const) {
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.beginPath();
        let v = 0;
        for (let i = 0; i <= 60; i++) {
          v += drift + (hash(seed * 100 + i) - 0.5) * 1.6;
          const x = x0 + ((x1 - x0) * i) / 60;
          const y = y1 - 10 - v * 2.6;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.fillStyle = palette.screenInk;
      ctx.globalAlpha = 0.5;
      ctx.fillRect(x0, 20, 30, 3);
      ctx.fillStyle = palette.metalMid;
      ctx.fillRect(x0 + 38, 20, 30, 3);
      ctx.globalAlpha = 1;
    });
    const ranking = make((ctx) => {
      // Tabla: fila de cabecera y diez valores ordenados por nota, con su barra; el primero en amarillo.
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = palette.screenInk;
      ctx.fillRect(10, 22, 40, 4);
      ctx.fillRect(120, 22, 40, 4);
      ctx.globalAlpha = 1;
      for (let i = 0; i < 10; i++) {
        const y = 34 + i * 11.2;
        const score = 0.95 - i * 0.055 - hash(i + 40) * 0.03;
        ctx.globalAlpha = 0.75;
        ctx.fillStyle = palette.screenInk;
        ctx.fillRect(10, y, 14 + Math.floor(hash(i + 7) * 3) * 6, 5);
        ctx.globalAlpha = 0.3;
        ctx.fillRect(56, y, 34 + hash(i + 21) * 20, 5);
        ctx.globalAlpha = 1;
        ctx.fillStyle = i === 0 ? palette.signalYellow : palette.andonGreen;
        ctx.fillRect(120, y, (w - 132) * score, 5);
      }
    });
    return [chart, ranking];
  }, []);
  useEffect(() => () => textures.forEach((t) => t.dispose()), [textures]);
  return textures;
}

/** Un monitor: carcasa, soporte VESA al brazo y su imagen. Marco local: centro abajo en el origen, mira a +Z. */
function Monitor({ screen }: { screen: THREE.Texture }) {
  const m = MONITOR;
  return (
    <group>
      <Merge>
        <Block min={[-m.w / 2, m.y, 0]} max={[m.w / 2, m.y + m.h, 0.03]} c={palette.stripeBlack} />
        <Block min={[-m.w / 2 + 0.06, m.y + 0.05, -0.012]} max={[m.w / 2 - 0.06, m.y + m.h - 0.05, 0]} c={palette.metalDark} />
        <Block min={[-0.05, ARM.y - 0.05, -0.065]} max={[0.05, ARM.y + 0.05, -0.012]} c={palette.metalMid} />
      </Merge>
      <mesh position={[0, m.y + m.h / 2, 0.032]} layers={DECAL_LAYER}>
        <planeGeometry args={[m.w - 0.03, m.h - 0.03]} />
        <meshBasicMaterial map={screen} toneMapped={false} />
      </mesh>
    </group>
  );
}

/**
 * Puesto del operador: brazo de monitores con tres pantallas en arco (el código que escribe en la
 * del centro, rentabilidad y ranking a los lados), teclado, ratón y móvil.
 */
function Workstation({ screen }: { screen: THREE.Texture }) {
  const m = MONITOR;
  const k = KEYBOARD;
  const t = DESK_TOP;
  const sides = useSideScreens();
  return (
    <group>
      <Merge>
        {/* Brazo: mordaza al canto trasero, columna y travesaño con las rótulas de los laterales. */}
        <Block min={[m.x - 0.05, t - 0.06, ARM.z - 0.05]} max={[m.x + 0.05, t + 0.02, ARM.z + 0.035]} c={palette.metalDark} />
        <Cyl p={[m.x, (t + ARM.y + 0.1) / 2, ARM.z]} radius={0.018} length={ARM.y + 0.1 - t} c={palette.metalMid} />
        <Cyl p={[(ARM.x0 + ARM.x1) / 2, ARM.y, ARM.z]} radius={0.013} length={ARM.x1 - ARM.x0} axis="x" c={palette.metalMid} />
        {SIDES.map(({ s }) => (
          <Cyl key={s} p={[m.x + s * (m.w / 2 + 0.012), ARM.y, ARM.z]} radius={0.02} length={0.05} c={palette.metalDark} />
        ))}
        {/* Teclado, ratón y móvil. */}
        <Block min={[k.x - k.w / 2, t, k.z - k.d / 2]} max={[k.x + k.w / 2, t + 0.022, k.z + k.d / 2]} c={palette.stripeBlack} />
        <Block min={[0.27, t, -1.71]} max={[0.33, t + 0.024, -1.61]} c={palette.stripeBlack} />
        <Block min={[-0.51, t, -1.78]} max={[-0.435, t + 0.01, -1.63]} c={palette.metalDark} />
      </Merge>
      <group position={[m.x, 0, m.z]}>
        <Monitor screen={screen} />
      </group>
      {SIDES.map(({ s, x, z, rot }, i) => (
        <group key={s} position={[x, 0, z]} rotation={[0, rot, 0]}>
          <Monitor screen={sides[i]} />
        </group>
      ))}
    </group>
  );
}

/**
 * Operador sentado en la consola de Ottometrix: teclea (el código aparece en su monitor) y, de vez
 * en cuando, mira el teclado, la pantalla grande o a los lados. Todo con movimientos pequeños.
 */
export function Operator() {
  const rig = useRef<Rig>(emptyRig());
  const screen = useCodeScreen();
  const state = useRef({ tick: -1, typed: -1 });
  const ox = STATION_X.display;

  useEffect(() => () => screen.texture.dispose(), [screen]);

  // Brazos: hombros → manos sobre el teclado, en el marco del tronco inclinado.
  const reach = useMemo(() => {
    const spineY = ROOT[1] + BODY.spineY;
    const toSpine = (y: number, z: number): [number, number] => {
      const dy = y - spineY;
      const dz = z - ROOT[2];
      const c = Math.cos(-LEAN);
      const s = Math.sin(-LEAN);
      return [dy * c - dz * s, dy * s + dz * c];
    };
    const [hy, hz] = toSpine(HAND_Y, KEYBOARD.z + 0.01);
    return armReach(hy - BODY.shoulder[1], hz - BODY.shoulder[2]);
  }, []);

  useFrame(() => {
    const r = rig.current;
    const st = state.current;
    const visible = regionOnScreen(REGIONS[0], ox);
    // Primer frame: pose de trabajo aunque no se vea.
    if (st.tick >= 0 && (!visible || !lifeRunning())) return;
    const t = lifeTime(flow.now);
    const tick = Math.floor(t / TICK);
    if (tick === st.tick) {
      wakeIn((tick + 1) * TICK * 1000 - t * 1000);
      return;
    }
    st.tick = tick;
    const tq = tick * TICK;
    const { pitch, yaw, typing, up } = sample(tq);

    if (r.spine) r.spine.rotation.x = LEAN + 0.06 * up;
    if (r.neck) r.neck.rotation.set(pitch * 0.35, yaw * 0.4, 0);
    if (r.head) r.head.rotation.set(pitch * 0.65, yaw * 0.6, 0);
    // Tecleo: las manos se levantan y bajan un poco, cada una a su ritmo.
    const [sh, el] = reach;
    const beat = (f: number, p: number) => Math.sin(tq * f + p) * (0.6 + 0.4 * Math.sin(tq * 1.7 + p));
    const kl = 0.045 * typing * beat(33, 0.3);
    const kr = 0.045 * typing * beat(29, 1.9);
    if (r.shoulderL) r.shoulderL.rotation.set(sh + kl * 0.3, 0, 0.2);
    if (r.shoulderR) r.shoulderR.rotation.set(sh + kr * 0.3, 0, -0.2);
    if (r.elbowL) r.elbowL.rotation.set(el + kl, 0, 0);
    if (r.elbowR) r.elbowR.rotation.set(el + kr, 0, 0);

    const [x0, y0, z0, x1, y1, z1] = REGIONS[0];
    markDirty(ox + x0, y0, z0, ox + x1, y1, z1);
    // El código avanza con cada pulsación.
    const typed = Math.floor(typedSeconds(tq) * KEYS_PER_S);
    if (typed !== st.typed) {
      st.typed = typed;
      screen.draw(typed);
      const [a, b, c, d, e, f] = SCREEN_REGION;
      markDirty(ox + a, b, c, ox + d, e, f);
    }
    if (visible) wakeIn(TICK * 1000);
  });

  // Piernas fijas: sentado, muslos al frente bajo el tablero y pies en la tarima.
  useEffect(() => {
    const r = rig.current;
    for (const side of [-1, 1]) {
      const hip = side < 0 ? r.hipL : r.hipR;
      const knee = side < 0 ? r.kneeL : r.kneeR;
      const foot = side < 0 ? r.footL : r.footR;
      hip?.rotation.set(Math.PI / 2 - 0.1, side * -0.06, 0);
      knee?.rotation.set(-(Math.PI / 2 - 0.1) + 0.3 - 0.02, 0, 0);
      foot?.rotation.set(-0.28, 0, 0);
    }
  }, []);

  return (
    <group position={[ox, 0, LINE.axisZ]}>
      <Workstation screen={screen.texture} />
      <Person rig={rig} position={ROOT} colors={{ shirt: palette.shirt, trousers: palette.trousers }} />
    </group>
  );
}
