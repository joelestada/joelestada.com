'use client';

import { useRef, type ReactNode, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { LINE, STATION_X, type Vec3 } from '@/config/layout';
import { palette } from '@/config/palette';
import { PARTS } from '@/config/parts';
import { STATION_BY_ID } from '@/config/stations';
import { engineRpm, flow } from '../line/flow';
import { requestAmbient } from '@/lib/runtime';
import { animateRegions, regionOnScreen, type Region } from '../kit/regions';
import { DECAL_LAYER } from '../materials';
import { AndonTower } from '../kit/AndonTower';
import { ControlPanel } from '../kit/ControlPanel';
import { ElectricalCabinet } from '../kit/ElectricalCabinet';
import { Explode } from '../kit/Explode';
import { MeshFence } from '../kit/MeshFence';
import { PendantLamp } from '../kit/PendantLamp';
import { Block, Box, Cyl, Merge, Tube } from '../kit/primitives';
import { ChargePipe, ExhaustManifold, IntakeManifold, Turbo } from './engine/AirExhaust';
import { Crankshaft, EngineBlock, MountBrackets, MountIsolators, MountPedestals, OilModule, OilPan, PistonRod } from './engine/Bottom';
import { AccessoryDrive, Adapter, Cardan, Damper, Flywheel, FlywheelHousing, Starter, TimingCover } from './engine/Ends';
import { Camshafts, CylinderHead, HeadGasket, ValveCover } from './engine/Top';
import { CRANK_Y, CYL_X, DOWNPIPE, ENGINE_ORIGIN, ENGINE_SCALE } from './engine/dims';

const STATION = STATION_BY_ID.engine;
/** Piezas de la vista explosionada. */
const P = PARTS.engine;

/** Eje del cigüeñal / freno dinamométrico, en coordenadas de estación. */
const SHAFT_Y = ENGINE_ORIGIN[1] + CRANK_Y * ENGINE_SCALE;
const FRAME_XS = [-1.4, 0.9];
const FRAME_Z = 0.55;
const RAIL_Y = 0.67;
/** Ventilador del freno, en la cara frontal (+Z). */
const FAN = { x: -1.95, y: 0.42, z: 0.735, r: 0.2 };
/** Pupitre de mando: mismos parámetros que el ControlPanel de la estación. */
const DESK = { x: 1.36, z: 0.64, height: 1.52, depth: 0.4 };
/** El damper sale por delante con los accesorios, pero menos (va entre ellos y la tapa de distribución). */
const DAMPER_TO: Vec3 = [1.0, 0, 0];
/** Los pistones salen en ola, uno tras otro (s). */
const PISTON_WAVE = 0.05;
/** El turbo espera a que la culata levante el colector de escape: así sube hacia fuera sin tocarlo (s). */
const TURBO_DELAY = 0.3;

/**
 * Giro a régimen máximo (rad/s) y vibración del bloque (m). El giro se queda por debajo de media
 * separación entre tornillos del volante por frame a 60 fps: así no parece girar hacia atrás.
 */
const SPIN = 19;
const SHAKE = 0.0035;
/** Andon del banco: verde con el motor girando, ámbar en su parada breve de cada ciclo o en pausa. */
const engineSignal = () => (engineRpm() > 0.02 ? 'green' : 'amber') as 'green' | 'amber';

/** Zonas que se mueven: motor, línea de ejes, freno y ventilador; barras de régimen del pupitre. */
const REGIONS: Region[] = [
  [-2.4, 0.3, -0.65, 0.9, 2.25, 0.98],
  [1.02, 0.95, 0.36, 1.7, 1.65, 0.95],
];
/** Base de las barras de régimen en la cabeza del pupitre. */
const RPM_BASE = 0.52 * 0.47 + 0.02;

/** Brida del bajante de escape sobre el bastidor (estación): de ahí baja el latiguillo a la extracción. */
const EXHAUST_DROP: Vec3 = [ENGINE_ORIGIN[0] + DOWNPIPE.x * ENGINE_SCALE, ENGINE_ORIGIN[1] + DOWNPIPE.y * ENGINE_SCALE, DOWNPIPE.z * ENGINE_SCALE];
/** Toma de extracción de gases en el suelo, detrás del motor. */
const EXTRACTION = { x: EXHAUST_DROP[0], z: -1.15, top: 0.37 };

/**
 * Motor diésel de 6 cilindros en línea (marco local del motor). En la vista explosionada se
 * desmonta como en un despiece de taller, de fuera hacia dentro: tubo de carga y tapa hacia
 * arriba, turbo y colector hacia fuera, distribución hacia delante, volante hacia el freno,
 * cárter hacia abajo; luego levas, culata (con su colector), junta y cigüeñal, y por último los
 * pistones en ola. El volante y el cardán giran aparte.
 */
function EngineBody() {
  return (
    <>
      <Merge>
        <EngineBlock />
        <MountBrackets />
      </Merge>
      <Explode station="engine" part={P.charge}>
        <ChargePipe />
      </Explode>
      <Explode station="engine" part={P.cover}>
        <ValveCover />
      </Explode>
      <Explode station="engine" part={P.sump}>
        <OilPan />
      </Explode>
      <Explode station="engine" part={P.turbo} delay={TURBO_DELAY}>
        <Turbo />
      </Explode>
      <Explode station="engine" part={P.accessories}>
        <AccessoryDrive />
      </Explode>
      <Explode station="engine" part={P.accessories} to={DAMPER_TO} callout={false}>
        <Damper />
      </Explode>
      <Explode station="engine" part={P.timing}>
        <TimingCover />
      </Explode>
      <Explode station="engine" part={P.housing}>
        <FlywheelHousing />
      </Explode>
      <Explode station="engine" part={P.starter}>
        <Starter />
      </Explode>
      <Explode station="engine" part={P.oil}>
        <OilModule />
      </Explode>
      <Explode station="engine" part={P.cams}>
        <Camshafts />
      </Explode>
      {/* La culata sube con la admisión y con el colector de escape, que antes se ha separado de ella. */}
      <Explode station="engine" part={P.head}>
        <CylinderHead />
        <IntakeManifold />
        <Explode station="engine" part={P.manifold}>
          <ExhaustManifold />
        </Explode>
      </Explode>
      <Explode station="engine" part={P.gasket}>
        <HeadGasket />
      </Explode>
      <Explode station="engine" part={P.crank}>
        <Crankshaft />
      </Explode>
      {CYL_X.map((x, i) => (
        <Explode key={x} station="engine" part={P.pistons} delay={i * PISTON_WAVE} callout={i === 0}>
          <PistonRod x={x} />
        </Explode>
      ))}
    </>
  );
}

/**
 * Pieza que gira con el cigüeñal: el grupo gira alrededor del eje y su contenido, modelado en el
 * marco del motor, se fusiona en una sola malla.
 */
function Rotating({ spin, children }: { spin: RefObject<THREE.Group | null>; children: ReactNode }) {
  return (
    <group ref={spin} position={[0, CRANK_Y, 0]}>
      <group position={[0, -CRANK_Y, 0]}>
        <Merge>{children}</Merge>
      </group>
    </group>
  );
}

/** Soportes elásticos del motor: se quedan en el bastidor cuando el motor sale (marco del motor). */
function EngineMounts() {
  return (
    <group position={ENGINE_ORIGIN} scale={ENGINE_SCALE}>
      <MountPedestals />
      <MountIsolators />
    </group>
  );
}

function Frame() {
  const c = palette.metalLight;
  return (
    <group>
      {[-1, 1].map((s) => (
        <group key={s}>
          <Block min={[FRAME_XS[0], RAIL_Y - 0.05, s * FRAME_Z - 0.045]} max={[FRAME_XS[1], RAIL_Y + 0.05, s * FRAME_Z + 0.045]} c={c} />
          <Block min={[FRAME_XS[0], 0.17, s * FRAME_Z - 0.035]} max={[FRAME_XS[1], 0.24, s * FRAME_Z + 0.035]} c={c} />
          {FRAME_XS.map((x) => (
            <group key={x}>
              <Block min={[x - 0.04, 0.02, s * FRAME_Z - 0.04]} max={[x + 0.04, RAIL_Y - 0.05, s * FRAME_Z + 0.04]} c={c} />
              <Block min={[x - 0.07, 0, s * FRAME_Z - 0.07]} max={[x + 0.07, 0.02, s * FRAME_Z + 0.07]} c={palette.metalMid} />
            </group>
          ))}
        </group>
      ))}
      {FRAME_XS.map((x) => (
        <Block key={x} min={[x - 0.035, RAIL_Y - 0.04, -FRAME_Z]} max={[x + 0.035, RAIL_Y + 0.04, FRAME_Z]} c={c} />
      ))}
    </group>
  );
}

function Dyno() {
  const c = palette;
  return (
    <group>
      <Block min={[-2.45, 0.04, -0.7]} max={[-1.45, 0.8, 0.7]} c={c.green} />
      <Block min={[-2.48, 0, -0.73]} max={[-1.42, 0.05, 0.73]} c={c.metalMid} />
      {/* Registro atornillado en la cara izquierda y rejilla del ventilador en la frontal. */}
      <Block min={[-2.462, 0.14, -0.58]} max={[-2.45, 0.7, 0.58]} c={c.green} />
      <Cyl p={[FAN.x, FAN.y, 0.706]} radius={FAN.r + 0.04} length={0.012} axis="z" c={c.metalMid} segments={28} />
      <Cyl p={[FAN.x, FAN.y, 0.713]} radius={FAN.r} length={0.004} axis="z" c={c.stripeBlack} segments={28} />
      {/* Chumacera y carcasa del freno. */}
      <Block min={[-2.18, 0.8, -0.22]} max={[-1.72, SHAFT_Y - 0.1, 0.22]} c={c.metalLight} />
      <Cyl p={[-1.95, SHAFT_Y, 0]} radius={0.17} length={0.4} axis="x" c={c.metalMid} />
      <Cyl p={[-2.17, SHAFT_Y, 0]} radius={0.1} length={0.05} axis="x" c={c.metalLight} />
      {/* Célula de carga del brazo de par. */}
      <Block min={[-1.99, 0.8, 0.22]} max={[-1.91, SHAFT_Y, 0.3]} c={c.metalMid} />
      <Cyl p={[-1.95, 0.9, 0.26]} radius={0.04} length={0.08} c={c.stripeBlack} />
    </group>
  );
}

/**
 * Extracción de gases: el latiguillo recoge el bajante del turbo sobre el bastidor, pasa por debajo
 * del motor y baja a la toma de suelo de detrás.
 */
function ExhaustExtraction() {
  const [x, y, z] = EXHAUST_DROP;
  const { z: zb, top } = EXTRACTION;
  return (
    <group>
      <Cyl p={[x, y - 0.012, z]} radius={0.05} length={0.014} c={palette.metalMid} />
      <Tube
        points={[
          [x, y - 0.02, z],
          [x, 0.47, z],
          [x, 0.47, zb],
          [x, top, zb],
        ]}
        radius={0.04}
        bend={0.12}
        c={palette.metalDark}
      />
      <Block min={[x - 0.22, 0, zb - 0.13]} max={[x + 0.22, 0.34, zb + 0.13]} c={palette.metalMid} />
      <Block min={[x - 0.17, 0.34, zb - 0.08]} max={[x + 0.17, top, zb + 0.08]} c={palette.metalDark} />
    </group>
  );
}

/** Aspas del ventilador del freno. */
function FanBlades() {
  return (
    <group>
      {[0, 1, 2, 3, 4].map((i) => (
        <group key={i} rotation={[0, 0, (i / 5) * Math.PI * 2]}>
          <Box p={[0, FAN.r * 0.5, 0]} s={[0.07, FAN.r * 0.9, 0.006]} r={[0, 0.5, 0]} c={palette.metalLight} />
        </group>
      ))}
      <Cyl p={[0, 0, 0.01]} radius={0.045} length={0.03} axis="z" c={palette.metalMid} />
    </group>
  );
}

/** Barras de régimen en la pantalla del pupitre. */
function RpmBars({ bars }: { bars: RefObject<(THREE.Mesh | null)[]> }) {
  const bodyTop = DESK.height - 0.5;
  const headD = DESK.depth * 0.72;
  return (
    <group position={[DESK.x, bodyTop, DESK.z + DESK.depth / 2 - headD / 2]} rotation={[-0.32, 0, 0]}>
      {[0, 1, 2, 3, 4].map((i) => (
        <mesh
          key={i}
          ref={(m) => {
            bars.current[i] = m;
          }}
          position={[-0.14 + i * 0.07, RPM_BASE, headD / 2 + 0.022]}
          scale={[0.045, 0.001, 0.004]}
          layers={DECAL_LAYER}
          visible={false}
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial color={palette.signalYellow} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * Estación 01: motor en banco dinamométrico, vallado, armarios y pupitre. El motor va casi siempre
 * en marcha con su propio ciclo de ensayo (arranque, escalones de régimen, parada breve).
 */
export function EngineTestBench() {
  const engine = useRef<THREE.Group>(null);
  const driveline = useRef<THREE.Group>(null);
  const flywheel = useRef<THREE.Group>(null);
  const fan = useRef<THREE.Group>(null);
  const bars = useRef<(THREE.Mesh | null)[]>([]);
  const spin = useRef({ angle: 0, last: 0, rpm: -1 });

  useFrame(() => {
    const now = flow.now;
    const s = spin.current;
    const dt = s.last ? Math.min(now - s.last, 50) / 1000 : 0;
    s.last = now;
    const rpm = engineRpm(now);
    // Parado y ya dibujado parado: nada que pintar. Si la planta corre, se espera el arranque.
    if (rpm === 0 && s.rpm === 0) {
      if (flow.engine.running && regionOnScreen(REGIONS[0], STATION_X.engine)) requestAmbient();
      return;
    }
    s.rpm = rpm;
    s.angle += rpm * SPIN * dt;
    const t = now / 1000;
    if (driveline.current) driveline.current.rotation.x = s.angle;
    if (flywheel.current) flywheel.current.rotation.x = s.angle;
    if (fan.current) fan.current.rotation.z = -s.angle * 0.6;
    if (engine.current) {
      engine.current.position.y = ENGINE_ORIGIN[1] + rpm * SHAKE * Math.sin(t * 71);
      engine.current.rotation.x = rpm * 0.003 * Math.sin(t * 53 + 1.3);
    }
    bars.current.forEach((m, i) => {
      if (!m) return;
      const h = 0.02 + rpm * (0.06 + 0.012 * Math.sin(t * (3.1 + i * 0.7) + i * 1.9)) * (0.6 + i * 0.12);
      m.scale.y = h;
      m.position.y = RPM_BASE + h / 2;
      m.visible = rpm > 0.01;
    });
    animateRegions(REGIONS, STATION_X.engine, rpm > 0 || flow.engine.running);
  });

  return (
    <group position={[STATION_X.engine, 0, LINE.axisZ]}>
      <Merge>
        <Frame />
        <EngineMounts />
        <ExhaustExtraction />
        {/* Armario verde con la torre andon y cuadro auxiliar con transformador. */}
        <ElectricalCabinet position={[1.36, 0, -0.82]} size={[0.6, 2.05, 0.8]} color={palette.green} grille={false} />
        <Box p={[1.36, 1.72, -0.41]} s={[0.22, 0.14, 0.01]} c={palette.metalLight} />
        <AndonTower position={[1.36, 2.05, -0.82]} pole={0.3} signal={engineSignal} />
        <ElectricalCabinet position={[1.89, 0, -0.92]} size={[0.46, 1.7, 0.6]} color={palette.green} />
        <Block min={[1.73, 1.7, -1.12]} max={[2.05, 1.92, -0.76]} c={palette.stripeBlack} />
        {/* Armario eléctrico blanco con rejilla y pupitre de mando. */}
        <ElectricalCabinet position={[2.54, 0, -1.0]} size={[0.8, 1.95, 0.72]} />
        <ControlPanel position={[DESK.x, 0, DESK.z]} height={DESK.height} depth={DESK.depth} />
      </Merge>
      <Explode station="engine" part={P.guard}>
        <MeshFence
          path={[
            [1.02, -1.32],
            [-2.95, -1.32],
            [-2.95, 1.18],
          ]}
          height={2}
        />
      </Explode>
      {/* Freno dinamométrico con su ventilador (que gira aparte). */}
      <Explode station="engine" part={P.dyno}>
        <Dyno />
        <group ref={fan} position={[FAN.x, FAN.y, FAN.z]} userData={{ mergeBoundary: true }}>
          <FanBlades />
        </group>
      </Explode>
      {/* El motor sale entero del bastidor y, ya arriba, se despieza. */}
      <Explode station="engine" part={P.block} merge={false}>
        <group ref={engine} position={ENGINE_ORIGIN} scale={ENGINE_SCALE} userData={{ mergeBoundary: true }}>
          <EngineBody />
          <Explode station="engine" part={P.shaft} merge={false}>
            <Rotating spin={driveline}>
              <Cardan />
              <Adapter />
            </Rotating>
          </Explode>
          <Explode station="engine" part={P.flywheel} merge={false}>
            <Rotating spin={flywheel}>
              <Flywheel />
            </Rotating>
          </Explode>
        </group>
      </Explode>
      <RpmBars bars={bars} />
      <PendantLamp position={STATION.lamp} station="engine" />
    </group>
  );
}
