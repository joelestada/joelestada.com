'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { FLOW, LINE } from '@/config/layout';
import { palette } from '@/config/palette';
import { getSnapshot, markDirty, requestAmbient, setLineOn, subscribe } from '@/lib/runtime';
import { DECAL_LAYER, toon } from '../materials';
import { itemCapped, itemInPacker, itemPacked, itemPressed, itemVisible, itemX, primeFlow, stepFlow } from './flow';
import { updateLife } from '../life/clock';
import { plantPowered } from '../boot';
import { explode } from '../explode';
import { Block, Merge } from '../kit/primitives';
import { regionOnScreen } from '../kit/regions';
import { CARTON, CARTON_COLORS, CARTON_ON_PALLET, CARTON_TOP, cartonGeometries, cartonPrintMaterial } from './carton';
import { BH, BUSHING_RISE, PD, PH, PW, workpieceGeometries } from './workpiece';
import { sealerTape, type SealerTape } from './sealer';
import { frameClock } from '../frameClock';

const TOP = LINE.rollerTop;
/** Alto total de una pieza (con su tapa o ya embalada) y medio largo y medio ancho, para la zona que se repinta. */
const ITEM_TOP = Math.max(PH + BH + BUSHING_RISE + FLOW.cap.h, CARTON_ON_PALLET[1] + CARTON_TOP + CARTON.tape.t) + 0.02;
const HALF_X = Math.max(PW, CARTON.L + 2 * CARTON.tape.t) / 2 + 0.01;
const HALF_Z = Math.max(PD, CARTON.W) / 2 + 0.01;

const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);
/** Marco de la caja respecto al apoyo del palé: se suma a la posición de la pieza. */
const ON_PALLET = new THREE.Matrix4().makeTranslation(...CARTON_ON_PALLET);

/** Tolva de entrada: su boca mira hacia la línea, fuera de vista. */
function Feeder() {
  const f = FLOW.feeder;
  const hw = LINE.width / 2 + 0.12;
  const top = TOP + 0.62;
  return (
    <Merge>
      {/* Tolva: cuerpo, tapa y ranura del sensor de paso. */}
      <Block min={[f.x0, TOP - 0.24, -hw]} max={[f.x1, top, hw]} c={palette.metalLight} />
      <Block min={[f.x0 - 0.03, top, -hw - 0.03]} max={[f.x1 + 0.03, top + 0.05, hw + 0.03]} c={palette.metalMid} />
      <Block min={[f.x0 + 0.18, top + 0.05, -0.2]} max={[f.x0 + 0.5, top + 0.2, 0.2]} c={palette.metalMid} />
      <Block min={[f.x1 - 0.3, TOP + 0.3, hw]} max={[f.x1 - 0.12, TOP + 0.36, hw + 0.012]} c={palette.screen} />
    </Merge>
  );
}

/**
 * Piezas por la cinta: avanzan solas (el scroll no las mueve) y paran frente a las máquinas.
 * Cada pieza se ajusta a la rejilla de píxeles igual que la cámara, así se mueve de píxel en
 * píxel sin que el trazo tiemble y, quieta, es idéntica al resto de la escena al hacer scroll.
 * Solo se piden frames mientras alguna pieza visible se mueve; el resto del tiempo, un
 * temporizador despierta la planta en el siguiente cambio (fin de avance o de parada).
 */
export function LineFlow() {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  const geos = workpieceGeometries();

  const pallets = useRef<THREE.InstancedMesh>(null);
  const parts = useRef<THREE.InstancedMesh>(null);
  const holes = useRef<THREE.InstancedMesh>(null);
  const bushings = useRef<THREE.InstancedMesh>(null);
  const caps = useRef<THREE.InstancedMesh>(null);
  const cartons = useRef<THREE.InstancedMesh>(null);
  const cartonFlaps = useRef<THREE.InstancedMesh>(null);
  const tapeTops = useRef<THREE.InstancedMesh>(null);
  const tapeLeads = useRef<THREE.InstancedMesh>(null);
  const tapeTrails = useRef<THREE.InstancedMesh>(null);
  const cartonPrints = useRef<THREE.InstancedMesh>(null);
  const carton = cartonGeometries();
  const printMaterial = cartonPrintMaterial();

  const state = useRef({
    lastInput: 0,
    standby: false,
    wake: 0 as ReturnType<typeof setTimeout> | 0,
    /** Por pieza: píxel (R, U), estado (visible, prensada, tapada) y X pintada. */
    keys: new Float64Array(FLOW.count * 3).fill(NaN),
    xs: new Float64Array(FLOW.count).fill(NaN),
    px: NaN,
  });

  // Entradas del usuario (reposo), pestaña oculta y cambios de estado (pausa, panel).
  useEffect(() => {
    const st = state.current;
    const now = performance.now();
    st.lastInput = now;
    primeFlow(now);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) setLineOn(false);

    const onInput = () => {
      st.lastInput = performance.now();
      if (st.standby) invalidate();
    };
    // Pestaña oculta: la planta se congela ya (puede que no llegue ningún frame más hasta volver).
    const onVisibility = () => {
      if (document.hidden) updateLife(performance.now(), false);
      else invalidate();
    };
    const opts = { passive: true } as const;
    const inputs = ['pointermove', 'pointerdown', 'wheel', 'keydown', 'touchstart', 'scroll'] as const;
    inputs.forEach((t) => window.addEventListener(t, onInput, opts));
    document.addEventListener('visibilitychange', onVisibility);
    const unsubscribe = subscribe(() => invalidate());
    invalidate();
    return () => {
      inputs.forEach((t) => window.removeEventListener(t, onInput));
      document.removeEventListener('visibilitychange', onVisibility);
      unsubscribe();
      if (st.wake) clearTimeout(st.wake);
    };
  }, [invalidate]);

  const basis = useMemo(() => ({ right: new THREE.Vector3(), up: new THREE.Vector3(), fwd: new THREE.Vector3() }), []);
  const tmp = useMemo(
    () => ({
      m: new THREE.Matrix4(),
      c: new THREE.Matrix4(),
      t: new THREE.Matrix4(),
      p: new THREE.Vector3(),
      tape: { lead: false, top: 0, trail: 0, length: 0 } as SealerTape,
    }),
    [],
  );
  /** Frente a una máquina: su parada en la cinta, con margen para el cuerpo de la máquina. */
  const machineOnScreen = (x: number) => regionOnScreen([-1.5, 0, -3, 1.5, 3, 1.5], x);

  useFrame(() => {
    const st = state.current;
    // Reloj de los frames: la cinta y las máquinas avanzan lo mismo en cada refresco.
    const now = frameClock.now;
    const snap = getSnapshot();
    st.standby = now - st.lastInput > FLOW.standbyMs;
    // Con una máquina en vista explosionada la línea se para (no se desmonta una máquina en marcha).
    const running = snap.lineOn && !snap.menuOpen && !st.standby && !document.hidden && plantPowered() && !explode.station;
    const step = stepFlow(now, running, machineOnScreen);

    // Colocación ajustada a la rejilla de píxeles del mundo (la misma que usa la cámara).
    const cam = camera as THREE.OrthographicCamera;
    const px = 1 / (cam.zoom * gl.getPixelRatio());
    basis.right.setFromMatrixColumn(cam.matrixWorld, 0);
    basis.up.setFromMatrixColumn(cam.matrixWorld, 1);
    basis.fwd.setFromMatrixColumn(cam.matrixWorld, 2).negate();
    // Con otro zoom cambia la rejilla: se recoloca todo.
    if (px !== st.px) {
      st.px = px;
      st.keys.fill(NaN);
    }

    let movedOnScreen = false;
    let anyOnScreen = false;
    for (let i = 0; i < FLOW.count; i++) {
      const x = itemX(i);
      const visible = itemVisible(x);
      const box = [x - HALF_X, TOP - 0.01, -HALF_Z, x + HALF_X, TOP + ITEM_TOP, HALF_Z] as const;
      const seen = visible && regionOnScreen(box, 0);
      anyOnScreen ||= seen;
      tmp.p.set(x, TOP, LINE.axisZ);
      const R = Math.round(tmp.p.dot(basis.right) / px);
      const U = Math.round(tmp.p.dot(basis.up) / px);
      const flags = visible ? 1 + (itemPressed(i) ? 2 : 0) + (itemCapped(i) ? 4 : 0) + (itemPacked(i) ? 8 : 0) + (itemInPacker(i) ? 16 : 0) : 0;
      const k = i * 3;
      if (st.keys[k] === R && st.keys[k + 1] === U && st.keys[k + 2] === flags) continue;
      const was = st.xs[i];
      st.keys[k] = R;
      st.keys[k + 1] = U;
      st.keys[k + 2] = flags;
      st.xs[i] = x;
      // Zona a repintar: de donde estaba a donde está (un salto de vuelta a la tolva va por separado).
      if (seen || (Number.isFinite(was) && Math.abs(was - x) < 1)) {
        const a = Number.isFinite(was) && Math.abs(was - x) < 1 ? Math.min(was, x) : x;
        const b = Number.isFinite(was) && Math.abs(was - x) < 1 ? Math.max(was, x) : x;
        markDirty(a - HALF_X, TOP - 0.01, -HALF_Z, b + HALF_X, TOP + ITEM_TOP, HALF_Z);
        movedOnScreen = true;
      }

      const depth = tmp.p.dot(basis.fwd);
      tmp.p
        .copy(basis.right)
        .multiplyScalar(R * px)
        .addScaledVector(basis.up, U * px)
        .addScaledVector(basis.fwd, depth);
      tmp.m.makeTranslation(tmp.p.x, tmp.p.y, tmp.p.z);
      // El palé siempre va; la pieza, salvo en la embaladora (la lleva la máquina) o ya embalada (va
      // dentro de la caja, sobre el palé).
      const bare = visible && !(flags & 8) && !(flags & 16);
      pallets.current?.setMatrixAt(i, visible ? tmp.m : HIDDEN);
      parts.current?.setMatrixAt(i, bare ? tmp.m : HIDDEN);
      holes.current?.setMatrixAt(i, bare ? tmp.m : HIDDEN);
      bushings.current?.setMatrixAt(i, bare && flags & 2 ? tmp.m : HIDDEN);
      caps.current?.setMatrixAt(i, bare && flags & 4 ? tmp.m : HIDDEN);
      tmp.c.multiplyMatrices(tmp.m, ON_PALLET);
      for (const m of [cartons.current, cartonFlaps.current, cartonPrints.current]) m?.setMatrixAt(i, flags & 8 ? tmp.c : HIDDEN);
      // Cinta: la que le ha puesto la precintadora al pasar por debajo (según dónde va la caja).
      const tape = flags & 8 ? sealerTape(x, tmp.tape) : null;
      if (tape && tape.top > 0) {
        tmp.t.makeScale(tape.top * CARTON.L, 1, 1).setPosition(CARTON.L, 0, 0);
        tapeTops.current?.setMatrixAt(i, tmp.t.premultiply(tmp.c));
      } else tapeTops.current?.setMatrixAt(i, HIDDEN);
      tapeLeads.current?.setMatrixAt(i, tape?.lead ? tmp.c : HIDDEN);
      if (tape && tape.trail > 0) {
        tmp.t.makeScale(1, tape.trail * (CARTON.tape.clip + CARTON.tape.t), 1).setPosition(0, CARTON_TOP + CARTON.tape.t, 0);
        tapeTrails.current?.setMatrixAt(i, tmp.t.premultiply(tmp.c));
      } else tapeTrails.current?.setMatrixAt(i, HIDDEN);
    }
    // Las matrices se suben aunque la pieza esté fuera de vista (barato) para que entre bien colocada.
    for (const m of [
      pallets.current,
      parts.current,
      holes.current,
      bushings.current,
      caps.current,
      cartons.current,
      cartonFlaps.current,
      cartonPrints.current,
      tapeTops.current,
      tapeLeads.current,
      tapeTrails.current,
    ]) {
      if (m) m.instanceMatrix.needsUpdate = true;
    }

    // Frames: seguidos mientras se mueve alguna pieza a la vista; si no, despertar en el próximo cambio.
    if (st.wake) {
      clearTimeout(st.wake);
      st.wake = 0;
    }
    if ((step.moving && anyOnScreen) || movedOnScreen) requestAmbient();
    else if (Number.isFinite(step.nextIn)) st.wake = setTimeout(() => invalidate(), Math.max(0, step.nextIn) + 4);
  }, -1);

  return (
    <group>
      <Feeder />
      <instancedMesh ref={pallets} args={[geos.pallet, toon(palette.metalMid), FLOW.count]} frustumCulled={false} />
      <instancedMesh ref={parts} args={[geos.part, toon(palette.workpiece), FLOW.count]} frustumCulled={false} />
      <instancedMesh ref={holes} args={[geos.holes, toon(palette.metalDark), FLOW.count]} frustumCulled={false} />
      <instancedMesh ref={bushings} args={[geos.bushing, toon(palette.metalDark), FLOW.count]} frustumCulled={false} />
      <instancedMesh ref={caps} args={[geos.cap, toon(palette.signalYellow), FLOW.count]} frustumCulled={false} />
      <instancedMesh ref={cartons} args={[carton.body, toon(CARTON_COLORS.kraft), FLOW.count]} frustumCulled={false} />
      <instancedMesh ref={cartonFlaps} args={[carton.closedMajors, toon(CARTON_COLORS.kraft), FLOW.count]} frustumCulled={false} />
      <instancedMesh ref={tapeTops} args={[carton.tapeTop, toon(CARTON_COLORS.tape), FLOW.count]} frustumCulled={false} />
      <instancedMesh ref={tapeLeads} args={[carton.tapeLead, toon(CARTON_COLORS.tape), FLOW.count]} frustumCulled={false} />
      <instancedMesh ref={tapeTrails} args={[carton.tapeTrail, toon(CARTON_COLORS.tape), FLOW.count]} frustumCulled={false} />
      <instancedMesh ref={cartonPrints} args={[carton.print, printMaterial, FLOW.count]} frustumCulled={false} layers={DECAL_LAYER} />
    </group>
  );
}
