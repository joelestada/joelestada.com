'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { LINE, STATION_X, type Vec3 } from '@/config/layout';
import { palette } from '@/config/palette';
import { PARTS } from '@/config/parts';
import { STATION_BY_ID } from '@/config/stations';
import { PRESS, easeInOut, workTime } from '../line/flow';
import { force, forceLevel } from '../force';
import { animateRegions, type Region } from '../kit/regions';
import { DECAL_LAYER, toon } from '../materials';
import { ControlPanel } from '../kit/ControlPanel';
import { Explode } from '../kit/Explode';
import { FloorOutline } from '../kit/FloorOutline';
import { FlowLine, createFlowMaterial } from '../kit/FlowLine';
import { bentPath } from '../kit/geometry';
import { PendantLamp } from '../kit/PendantLamp';
import { Merge } from '../kit/primitives';
import { SceneText } from '../kit/SceneText';
import { AccumulatorRack, Bottle } from './hydraulic/Accumulators';
import { ACC, BEND, DESK, FRAME, GAUGES, HEAD, PATHS, PIPE, PRESS_HEAD, TANK } from './hydraulic/dims';
import { Cooler, Motor, Piping, Pump, ReturnFilter, Tank, ValveBlock } from './hydraulic/PowerPack';
import { Column, Crossbeam, Head, LiftCylinder, Mass, PressTool } from './hydraulic/Press';

const STATION = STATION_BY_ID.hydraulic;
/** Piezas de la vista explosionada. */
const P = PARTS.hydraulic;

/** Avance del aceite por metro de carrera. */
const FLOW_GAIN = 7;
/** Zonas que se mueven: cabezal, vástagos y masa; nivel de los acumuladores y manómetros; tuberías con aceite; barra de energía. */
const REGIONS: Region[] = [
  [-0.35, 0.95, -1.4, 0.75, 3.2, 1.4],
  [-2.85, 0.28, -2.18, -0.35, 1.45, -1.98],
  [-2.3, 0.0, -2.2, 2.1, 1.05, 0.85],
  [2.05, 1.05, 0.95, 2.65, 1.6, 1.55],
];

/** Bajada de la masa por el trabajo de la prensa (0 arriba, 1 apoyada en la pieza). */
function pressDescent(t: number) {
  if (t < 0) return 0;
  if (t < PRESS.contact) return easeInOut((t - PRESS.start) / (PRESS.contact - PRESS.start));
  if (t < PRESS.hold) return 1;
  return 1 - easeInOut((t - PRESS.hold) / (PRESS.end - PRESS.hold));
}

/** El trazo del aceite sigue la tubería con sus curvas (muestreada cada 2 cm). */
function flowPath(path: Vec3[]): Vec3[] {
  const curve = bentPath(path, BEND);
  const n = Math.max(2, Math.ceil(curve.getLength() / 0.02));
  return curve.getSpacedPoints(n).map((p) => [p.x, p.y, p.z]);
}

/**
 * Estación 04: recuperación de energía. Cuando llega una pieza la masa baja hasta que el punzón
 * asienta el casquillo, empujando el aceite de los cilindros a los acumuladores, y vuelve a subir
 * con esa energía.
 */
export function HydraulicRecovery() {
  const idle = useRef(false);
  const carriage = useRef<THREE.Group>(null);
  const levels = useRef<(THREE.Mesh | null)[]>([]);
  const needles = useRef<(THREE.Group | null)[]>([]);
  const bar = useRef<THREE.Mesh>(null);
  const flow = useMemo(() => createFlowMaterial(palette.oil, 0.18, 0.5), []);
  const flows = useMemo(
    () => (Object.entries(PATHS) as [keyof typeof PATHS, Vec3[]][]).filter(([k]) => k !== 'pump').map(([k, p]) => [k, flowPath(p)] as const),
    [],
  );

  useFrame(() => {
    const t = workTime('hydraulic');
    // Mantenida pulsada: la bomba a plena potencia carga los acumuladores y el aceite corre.
    const f = forceLevel('hydraulic');
    if (t < 0 && f === 0 && idle.current) return;
    idle.current = t < 0 && f === 0;
    const y = HEAD.high - (HEAD.high - PRESS_HEAD) * pressDescent(t);
    if (carriage.current) carriage.current.position.y = y;
    // Fracción de bajada (0 arriba, 1 abajo) y carga de los acumuladores que produce.
    const fall = Math.min(1, (HEAD.high - y) / (HEAD.high - HEAD.low));
    const charge = Math.max(0.18 + 0.72 * fall, 0.18 + 0.82 * f);

    levels.current.forEach((m, i) => {
      if (!m) return;
      const h = (1.3 - 0.36) * Math.min(1, charge * (1 - i * 0.04));
      m.scale.y = h;
      m.position.y = 0.36 + h / 2;
    });
    needles.current.forEach((n, i) => {
      if (n) n.rotation.z = ((135 - 250 * (i === 0 ? charge : 0.25 + 0.5 * fall)) * Math.PI) / 180;
    });
    if (bar.current) {
      bar.current.scale.x = 0.34 * charge;
      bar.current.position.x = -0.17 + (0.34 * charge) / 2;
    }
    // El aceite avanza lo que baja la carga (sentido y velocidad salen solos) o, forzada, lo que bombea.
    flow.uniforms.uOffset.value = (HEAD.high - y) * FLOW_GAIN + force.time * 3.2 * (f > 0 ? 1 : 0);
    flow.uniforms.uOpacity.value = Math.min(1, Math.max(fall * 3, f * 1.5));
    animateRegions(REGIONS, STATION_X.hydraulic, t >= 0 || f > 0);
  });

  const headD = DESK.depth * 0.72;
  return (
    <group position={[STATION_X.hydraulic, 0, LINE.axisZ]}>
      <Merge>
        <AccumulatorRack />
        <Piping />
        <ControlPanel position={[DESK.x, 0, DESK.z]} height={DESK.height} depth={DESK.depth} />
      </Merge>
      {/* Vista explosionada: el pórtico se abre, el cabezal sube con la masa y el grupo hidráulico se separa. */}
      <Explode station="hydraulic" part={P.beam}>
        <Crossbeam />
      </Explode>
      {([1, -1] as const).map((s) => (
        <Explode key={`g${s}`} station="hydraulic" part={P.guides} to={[0, 0, s * P.guides.to[2]]} callout={s > 0}>
          <Column s={s} />
        </Explode>
      ))}
      {([1, -1] as const).map((s) => (
        <Explode key={`c${s}`} station="hydraulic" part={P.cylinders} to={[0, 0, s * P.cylinders.to[2]]} callout={s > 0}>
          <LiftCylinder s={s} />
        </Explode>
      ))}
      <Explode station="hydraulic" part={P.carriage} merge={false}>
        <group ref={carriage} position={[0, HEAD.high, 0]} userData={{ mergeBoundary: true }}>
          <Merge>
            <Head />
          </Merge>
          <Explode station="hydraulic" part={P.mass}>
            <Mass />
            <Explode station="hydraulic" part={P.tool}>
              <PressTool />
            </Explode>
          </Explode>
        </group>
      </Explode>
      {/* Botellas de los acumuladores, en cascada, cada una con su nivel de carga. */}
      {ACC.xs.map((x, i) => (
        <Explode key={x} station="hydraulic" part={P.accumulators} delay={i * 0.08} callout={i === 0}>
          <Bottle x={x} />
          <mesh
            ref={(m) => {
              levels.current[i] = m;
            }}
            position={[x, 0.5, ACC.z + ACC.r + 0.016]}
            scale={[0.036, 0.2, 0.004]}
            material={toon(palette.signalYellow)}
            layers={DECAL_LAYER}
          >
            <boxGeometry args={[1, 1, 1]} />
          </mesh>
        </Explode>
      ))}
      <Explode station="hydraulic" part={P.tank}>
        <Tank />
      </Explode>
      <Explode station="hydraulic" part={P.motor}>
        <Motor />
      </Explode>
      <Explode station="hydraulic" part={P.pump}>
        <Pump />
      </Explode>
      <Explode station="hydraulic" part={P.cooler}>
        <Cooler />
      </Explode>
      <Explode station="hydraulic" part={P.filter}>
        <ReturnFilter />
      </Explode>
      <Explode station="hydraulic" part={P.valves}>
        <ValveBlock />
      </Explode>
      {/* Agujas de los manómetros. */}
      {GAUGES.xs.map((x, i) => (
        <group
          key={x}
          ref={(g) => {
            needles.current[i] = g;
          }}
          position={[x, GAUGES.y, GAUGES.z + 0.006]}
        >
          <mesh position={[GAUGES.r * 0.32, 0, 0]} layers={DECAL_LAYER}>
            <boxGeometry args={[GAUGES.r * 0.72, 0.012, 0.002]} />
            <meshBasicMaterial color={palette.andonRed} />
          </mesh>
        </group>
      ))}
      {/* Barra de energía recuperada en la pantalla del pupitre. */}
      <group position={[DESK.x, DESK.height - 0.5, DESK.z + DESK.depth / 2 - headD / 2]} rotation={[-0.32, 0, 0]}>
        <mesh position={[0, 0.52 * 0.66, headD / 2 + 0.022]} scale={[0.34, 0.05, 0.004]} layers={DECAL_LAYER}>
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial color={palette.metalDark} />
        </mesh>
        <mesh ref={bar} position={[0, 0.52 * 0.66, headD / 2 + 0.024]} scale={[0.1, 0.05, 0.004]} layers={DECAL_LAYER}>
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial color={palette.signalYellow} />
        </mesh>
      </group>
      {flows.map(([k, p]) => (
        <FlowLine key={k} path={p} material={flow} width={0.026} pipeRadius={PIPE} />
      ))}
      <SceneText
        fontSize={0.2}
        position={[(TANK.x0 + TANK.x1) / 2 + 0.1, 0.42, TANK.z1 + 0.005]}
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.1}
        color={palette.ink}
        layers={DECAL_LAYER}
      >
        HPU
      </SceneText>
      <FloorOutline x0={FRAME.x - 0.75} x1={FRAME.x + 0.75} z0={-1.5} z1={1.55} dashed={false} />
      <PendantLamp position={STATION.lamp} station="hydraulic" />
    </group>
  );
}
