'use client';

import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { LINE, STATION_X } from '@/config/layout';
import { palette } from '@/config/palette';
import { PARTS } from '@/config/parts';
import { STATION_BY_ID } from '@/config/stations';
import { markDirty, requestAmbient, wakeIn } from '@/lib/runtime';
import { flow, TEMPO, testLoad, testNextMove } from '../line/flow';
import { partProgress } from '../explode';
import { forceLevel } from '../force';
import { regionOnScreen, snapToPixels, type Region } from '../kit/regions';
import { toon } from '../materials';
import { shared } from '../shared';
import { Explode } from '../kit/Explode';
import { FloorOutline } from '../kit/FloorOutline';
import { PendantLamp } from '../kit/PendantLamp';
import { Merge } from '../kit/primitives';
import { ActuatorBody, LoadCell, LoadRollers, Servovalve, Spreader } from './structure/Actuator';
import { Bed, Column, Crossbeam } from './structure/Frame';
import { Hoses, PowerUnit, ServiceManifold } from './structure/Hydraulics';
import { ControllerRack, LightCurtain, LvdtStands, MonitorCart } from './structure/Instruments';
import { CHART, Plot, SAMPLE_S, type Forced } from './structure/Plot';
import { Bearings, Pedestals, Truss } from './structure/Specimen';
import { CHORD_BOTTOM, COLUMN, DEFLECTION, LOAD_X, LVDT, MONITOR, deflection } from './structure/dims';

const STATION = STATION_BY_ID.structure;
/** Piezas de la vista explosionada. */
const P = PARTS.structure;

/** Núcleo de cada LVDT: varilla del palpador, de dentro del cuerpo al cordón inferior. */
const plungerGeometry = shared(new THREE.CylinderGeometry(0.5, 0.5, 1, 10));
const PLUNGER = { r: 0.007, bottom: LVDT.body.y1 - 0.03 };

/** Zonas que se mueven: celosía, tren de carga, vástago y palpadores; pantalla de la gráfica. */
const TRUSS_REGION: Region = [-2.1, 0.75, -2.55, 2.1, 2.2, -1.95];
const SCREEN_REGION: Region = [MONITOR.x0 - 0.02, MONITOR.y0 - 0.02, MONITOR.z - 0.08, MONITOR.x1 + 0.02, MONITOR.y1 + 0.02, MONITOR.z + 0.03];

/**
 * Estación 02: pórtico de reacción sobre bancada ranurada con una celosía amarilla a flexión en
 * cuatro puntos bajo un actuador servohidráulico, en ensayo cíclico continuo (no depende de las
 * piezas de la cinta): carga, mantiene, descarga y vuelve a empezar. Tres LVDT miden la flecha y el
 * monitor registra la tensión. Todo sale del reloj de la planta: en pausa se congela y al volver
 * sigue en el mismo punto.
 */
export function StructuralTest() {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const delta = useRef(0);
  const tick = useRef(0);
  const load = useRef<THREE.Group>(null);
  const plungers = useRef<(THREE.Mesh | null)[]>([]);
  const hoses = useRef<THREE.Group>(null);
  const state = useRef({ load: NaN, tick: NaN });
  /** Muestras en las que la máquina iba forzada (mantenida pulsada): el registro las guarda tal cual. */
  const forced = useMemo<Forced>(() => new Map(), []);
  const offset = useMemo(() => new THREE.Vector3(), []);
  const ox = STATION_X.structure;

  useFrame(() => {
    const st = state.current;
    // Los latiguillos unían el dintel y el actuador, que suben en la vista explosionada: se retiran.
    if (hoses.current) hoses.current.visible = partProgress('structure', P.beam) < 0.02;
    const t = flow.plant / 1000;
    // Mantenida pulsada, la carga sube al máximo desde donde esté; al soltar vuelve al ciclo.
    const f = forceLevel('structure');
    const cycle = testLoad(t);
    const value = cycle + (1 - cycle) * f;
    const k = Math.floor(t / SAMPLE_S);
    if (f > 0) forced.set(k, value);
    const trussSeen = regionOnScreen(TRUSS_REGION, ox);
    const screenSeen = regionOnScreen(SCREEN_REGION, ox);

    if (value !== st.load) {
      st.load = value;
      delta.current = DEFLECTION * value;
      // El tren de carga es rígido: baja con la flecha a saltos de píxel entero y su trazo no tiembla.
      offset.set(0, deflection(LOAD_X, delta.current), 0);
      snapToPixels(offset, camera as THREE.OrthographicCamera, gl.getPixelRatio());
      load.current?.position.copy(offset);
      // Los palpadores siguen al cordón inferior (el muelle los mantiene apoyados).
      plungers.current.forEach((m, i) => {
        if (!m) return;
        const top = CHORD_BOTTOM + deflection(LVDT.xs[i], delta.current);
        m.scale.y = top - PLUNGER.bottom;
        m.position.y = (top + PLUNGER.bottom) / 2;
      });
      if (trussSeen) markDirty(ox + TRUSS_REGION[0], TRUSS_REGION[1], TRUSS_REGION[2], ox + TRUSS_REGION[3], TRUSS_REGION[4], TRUSS_REGION[5]);
    }
    if (k !== st.tick) {
      st.tick = k;
      tick.current = k;
      for (const old of forced.keys()) if (old < k - CHART.samples) forced.delete(old);
      if (screenSeen) markDirty(ox + SCREEN_REGION[0], SCREEN_REGION[1], SCREEN_REGION[2], ox + SCREEN_REGION[3], SCREEN_REGION[4], SCREEN_REGION[5]);
    }

    // Frames: seguidos mientras la celosía se mueve a la vista; si no, uno por muestra de la gráfica
    // (o ninguno hasta que la celosía vuelva a moverse, si la pantalla no se ve). Los plazos son de
    // planta: en tiempo real, TEMPO veces más cortos.
    if (!flow.running) return;
    const still = testNextMove(t);
    if (trussSeen && still === 0) requestAmbient();
    else if (screenSeen) wakeIn((((k + 1) * SAMPLE_S - t) * 1000) / TEMPO);
    else if (trussSeen) wakeIn((still * 1000) / TEMPO);
  });

  return (
    <group position={[STATION_X.structure, 0, LINE.axisZ]}>
      <Merge>
        <LightCurtain />
      </Merge>
      {/* Vista explosionada: la probeta sale hacia delante, el pórtico se abre y lo que cuelga sube. */}
      <Explode station="structure" part={P.bed}>
        <Bed />
      </Explode>
      <Explode station="structure" part={P.pedestals}>
        <Pedestals />
      </Explode>
      <Explode station="structure" part={P.bearings}>
        <Bearings />
      </Explode>
      <Explode station="structure" part={P.columns} to={[-P.columns.to[0], 0, 0]} callout={false}>
        <Column x={COLUMN.xs[0]} />
      </Explode>
      <Explode station="structure" part={P.columns}>
        <Column x={COLUMN.xs[1]} />
      </Explode>
      <Explode station="structure" part={P.beam}>
        <Crossbeam />
      </Explode>
      <Explode station="structure" part={P.actuator}>
        <ActuatorBody />
        <Explode station="structure" part={P.servo}>
          <Servovalve />
        </Explode>
      </Explode>
      <Hoses group={hoses} />
      <Explode station="structure" part={P.specimen} merge={false}>
        <Truss delta={delta} />
      </Explode>
      {/* Tren de carga: baja rígido con la flecha de los puntos de carga. */}
      <group ref={load}>
        <Explode station="structure" part={P.cell}>
          <LoadCell />
        </Explode>
        <Explode station="structure" part={P.spreader}>
          <Spreader />
        </Explode>
        <Explode station="structure" part={P.rollers}>
          <LoadRollers />
        </Explode>
      </group>
      <Explode station="structure" part={P.lvdt} merge={false}>
        <Merge>
          <LvdtStands />
        </Merge>
        {LVDT.xs.map((x, i) => (
          <mesh
            key={x}
            ref={(m) => {
              plungers.current[i] = m;
            }}
            position={[x, PLUNGER.bottom + 0.05, LVDT.z]}
            scale={[PLUNGER.r * 2, 0.1, PLUNGER.r * 2]}
            geometry={plungerGeometry}
            material={toon(palette.metalMid)}
          />
        ))}
      </Explode>
      <Explode station="structure" part={P.hsm}>
        <ServiceManifold />
      </Explode>
      <Explode station="structure" part={P.hpu}>
        <PowerUnit />
      </Explode>
      <Explode station="structure" part={P.controller}>
        <ControllerRack />
        <MonitorCart />
      </Explode>
      <Plot tick={tick} forced={forced} />
      <FloorOutline x0={-3.0} x1={4.0} z0={-3.45} z1={-1.1} />
      <PendantLamp position={STATION.lamp} station="structure" />
    </group>
  );
}
