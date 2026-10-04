'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BUILDING, END } from '@/config/layout';
import { palette } from '@/config/palette';
import { pageLang } from '@/i18n/lang';
import { uiIn } from '@/i18n/ui';
import { getSnapshot, markDirty, requestAmbient } from '@/lib/runtime';
import { DECAL_LAYER, flat, toon } from '../materials';
import { Block, Cyl, Merge, nextInkId } from '../kit/primitives';
import { SceneText } from '../kit/SceneText';
import { regionOnScreen, type Region } from '../kit/regions';
import { easeInOut } from '../line/flow';
import { frameClock } from '../frameClock';

const EX = BUILDING.endWallX;
const { z0: Z0, z1: Z1, height: OPEN_H, rest: REST } = END.door;
const WIDTH = Z1 - Z0;
const ZC = (Z0 + Z1) / 2;
const PITCH = 0.1;
const SLATS = Math.ceil(OPEN_H / PITCH);
/** Plano de las lamas (por dentro de la pared, que mira a -X), guías, cajón y motor. */
const SLAT_X = EX - 0.05;
const GUIDE = 0.12;
const BOX = { h: 0.5, d: 0.45 };
/** Subida y bajada completas (s): una puerta rápida de muelle, sin prisas. */
const RISE_S = 1.7;
const FALL_S = 1.3;
/** Luz que entra: más honda cuanto más abierta (m, desde la pared hacia dentro). */
const LIT_DEPTH = 3.0;
/**
 * Rótulo pintado en la pared, a la derecha de la puerta: el mensaje del final en grande, como el
 * «JOEL» de la persiana del principio. Pegado a la cara de la pared (que mira a -X), leído a lo largo de Z.
 */
const SIGN = { x: EX - 0.012, z: Z1 + GUIDE + 0.9, size: 0.7, y: [3.15, 2.27] as const, spacing: 0.04 };

const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);

/** Lama: el mismo perfil que la persiana de la entrada, con la cara hacia el interior (-X). */
function slatGeometry() {
  const h = PITCH;
  const shape = new THREE.Shape();
  shape.moveTo(-0.012, 0);
  shape.lineTo(0.004, 0);
  shape.lineTo(0.018, 0.016);
  shape.lineTo(0.018, h - 0.026);
  shape.lineTo(0.0, h);
  shape.lineTo(-0.012, h);
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: WIDTH + 0.06, bevelEnabled: false });
  // Perfil en (hondo hacia dentro, y) → girado media vuelta: el fondo va hacia -X y el ancho a lo largo de Z.
  g.rotateY(Math.PI);
  g.translate(0, 0, (WIDTH + 0.06) / 2);
  return g;
}

/** Borde inferior de las lamas con la puerta abierta la fracción `k` (0 en reposo, 1 del todo). */
const bottomAt = (k: number) => REST + (OPEN_H - REST) * k;

/** Zona que se repinta al moverse (lamas, barra y luz del suelo). */
const REGION: Region = [EX - LIT_DEPTH - 0.4, 0, Z0 - 0.6, EX + 0.1, OPEN_H + 0.1, Z1 + 1.4];

/** Luz del día en el suelo: fuera, bajo el hueco; dentro, un trapecio que crece al abrir. */
function litGeometry() {
  const y = 0.003;
  const quad = (p: number[][]) => {
    const pos: number[] = [];
    for (const k of [0, 2, 1, 0, 3, 2]) pos.push(p[k][0], y, p[k][1]);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    return g;
  };
  return {
    outside: quad([
      [EX, Z0],
      [EX + 4, Z0],
      [EX + 4, Z1],
      [EX, Z1],
    ]),
    // Local: x hacia dentro desde la pared (0 → -1), se escala con la apertura.
    inside: quad([
      [0, Z1],
      [0, Z0],
      [-1, Z0 - 0.2],
      [-1, Z1 + 1.1],
    ]),
  };
}

/**
 * Puerta de salida en la pared final, en el eje de la cinta: persiana rápida medio abierta por la
 * que salen las cajas. Al llegar al final del recorrido sube del todo (entra la luz de fuera) y la
 * ficha de abajo pasa a ser el contacto; al volver hacia atrás, baja a su altura de siempre.
 */
export function ExitDoor() {
  const slats = useRef<THREE.InstancedMesh>(null);
  const leaf = useRef<THREE.Group>(null);
  const light = useRef<THREE.Mesh>(null);
  const geometry = useMemo(slatGeometry, []);
  const lit = useMemo(litGeometry, []);
  const boxId = useMemo(nextInkId, []);
  const m = useMemo(() => new THREE.Matrix4(), []);
  const state = useRef({ k: 0, t: 0, shown: NaN });

  useFrame(() => {
    const st = state.current;
    // Apertura con velocidad fija y arranque/frenada suaves (se sigue la curva desde donde esté).
    const goal = getSnapshot().atExit ? 1 : 0;
    if (st.k === goal) st.t = 0;
    else {
      const now = frameClock.now;
      const dt = st.t ? Math.min((now - st.t) / 1000, 1 / 30) : 1 / 60;
      st.t = now;
      st.k = goal > st.k ? Math.min(1, st.k + dt / RISE_S) : Math.max(0, st.k - dt / FALL_S);
    }
    const k = easeInOut(st.k);
    if (k === st.shown) return;
    st.shown = k;
    const bottom = bottomAt(k);
    const mesh = slats.current;
    if (mesh) {
      for (let i = 0; i < SLATS; i++) {
        const y = bottom + i * PITCH;
        // Las que ya han entrado en el cajón no se ven: fuera.
        mesh.setMatrixAt(i, y > OPEN_H + 0.25 ? HIDDEN : m.makeTranslation(SLAT_X, y, ZC));
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
    leaf.current?.position.set(0, bottom - REST, 0);
    if (light.current) light.current.scale.x = LIT_DEPTH * (0.55 + 0.45 * k);
    if (regionOnScreen(REGION, 0)) {
      markDirty(...REGION);
      requestAmbient();
    }
  });

  const top = OPEN_H;
  const br = BOX.h / 2;
  return (
    <group>
      <Merge>
        {/* Guías a los lados del hueco, por dentro. */}
        <Block min={[EX - 0.16, 0, Z0 - GUIDE]} max={[EX, top, Z0 + 0.02]} c={palette.metalLight} />
        <Block min={[EX - 0.16, 0, Z1 - 0.02]} max={[EX, top, Z1 + GUIDE]} c={palette.metalLight} />
        {/* Cajón de enrollamiento con frente redondeado y motor en un extremo. */}
        <Block min={[EX - BOX.d + br, top, Z0 - GUIDE]} max={[EX, top + BOX.h, Z1 + GUIDE]} c={palette.metalLight} id={boxId} />
        <Cyl p={[EX - BOX.d + br, top + br, ZC]} radius={br} length={WIDTH + 2 * GUIDE} axis="z" c={palette.metalLight} id={boxId} segments={28} />
        <Block min={[EX - 0.4, top + 0.05, Z1 + GUIDE]} max={[EX, top + BOX.h - 0.05, Z1 + GUIDE + 0.36]} c={palette.metalMid} />
        <Cyl p={[EX - 0.2, top + BOX.h / 2, Z1 + GUIDE + 0.38]} radius={0.13} length={0.04} axis="z" c={palette.metalLight} />
        {/* Pulsadora junto al hueco, con su tubo. */}
        <Block min={[EX - 0.12, 1.1, Z0 - GUIDE - 0.62]} max={[EX, 1.52, Z0 - GUIDE - 0.3]} c={palette.metalLight} />
        <Block min={[EX - 0.125, 1.36, Z0 - GUIDE - 0.56]} max={[EX - 0.12, 1.46, Z0 - GUIDE - 0.36]} c={palette.screen} />
        <Cyl p={[EX - 0.13, 1.26, Z0 - GUIDE - 0.52]} radius={0.024} length={0.03} axis="x" c={palette.andonGreen} />
        <Cyl p={[EX - 0.04, (1.52 + top + 0.3) / 2, Z0 - GUIDE - 0.46]} radius={0.022} length={top + 0.3 - 1.52} c={palette.metalMid} />
      </Merge>
      <instancedMesh
        ref={(mesh) => {
          slats.current = mesh;
          if (!mesh) return;
          for (let i = 0; i < SLATS; i++) {
            const y = REST + i * PITCH;
            mesh.setMatrixAt(i, y > OPEN_H + 0.25 ? HIDDEN : m.makeTranslation(SLAT_X, y, ZC));
          }
          mesh.instanceMatrix.needsUpdate = true;
        }}
        args={[geometry, toon(palette.metalMid), SLATS]}
        frustumCulled={false}
      />
      {/* Barra inferior con tirador: sube con las lamas. */}
      <group ref={leaf}>
        <Merge>
          <Block min={[EX - 0.1, REST - 0.08, Z0]} max={[EX - 0.02, REST, Z1]} c={palette.metalMid} />
          <Block min={[EX - 0.14, REST - 0.1, ZC - 0.18]} max={[EX - 0.09, REST - 0.065, ZC + 0.18]} c={palette.metalMid} />
        </Merge>
      </group>
      {uiIn(pageLang()).scene.wall.map((line, i) => (
        <SceneText
          key={line}
          fontSize={SIGN.size}
          position={[SIGN.x, SIGN.y[i], SIGN.z]}
          rotation={[0, -Math.PI / 2, 0]}
          anchorX="left"
          anchorY="middle"
          letterSpacing={SIGN.spacing}
          color={palette.ink}
          layers={DECAL_LAYER}
        >
          {line}
        </SceneText>
      ))}
      <mesh geometry={lit.outside} material={flat(palette.floorLit)} layers={DECAL_LAYER} />
      <mesh ref={light} geometry={lit.inside} material={flat(palette.floorLit)} layers={DECAL_LAYER} position={[EX, 0, 0]} scale={[LIT_DEPTH * 0.55, 1, 1]} />
    </group>
  );
}
