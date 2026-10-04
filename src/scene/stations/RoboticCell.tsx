'use client';

import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { FLOW, LINE, STATION_X, type Vec3 } from '@/config/layout';
import { palette } from '@/config/palette';
import { PARTS } from '@/config/parts';
import { STATION_BY_ID } from '@/config/stations';
import { PICK, WORK_X, easeInOut, flow, workTime } from '../line/flow';
import { explode, partProgress, registerPart } from '../explode';
import { force, forceLevel } from '../force';
import { markDirty, runtime } from '@/lib/runtime';
import { DECAL_LAYER, toon } from '../materials';
import { AndonTower } from '../kit/AndonTower';
import { ElectricalCabinet } from '../kit/ElectricalCabinet';
import { copyPoint, Explode, snappedOffset } from '../kit/Explode';
import { MeshFence } from '../kit/MeshFence';
import { PendantLamp } from '../kit/PendantLamp';
import { Block, Merge } from '../kit/primitives';
import { Forearm, GripperBody, RobotBase, Turret, UpperArm, Wrist } from './robot/Arm';
import { CableProtector, FEEDER, Feeder, LightCurtains, TeachPendant } from './robot/Cell';
import { animateRegions, type Region } from '../kit/regions';

const STATION = STATION_BY_ID.robotic;
/** Piezas de la vista explosionada. */
const P = PARTS.robotic;

const TOP = LINE.rollerTop;
const GAP = LINE.width / 2 + 0.17;

/** Célula vallada (coordenadas locales de la estación). */
const CELL = { x0: -2.5, x1: 2.3, z0: -3.0, z1: 1.15, h: 2.1 };

/** Robot de 6 ejes: base y longitudes de eslabón (m). */
const ROBOT = {
  base: [-0.55, 0, -1.45] as Vec3,
  upperArm: 1.1,
  forearm: 1.25,
};

/**
 * Cadena del brazo en su plano: altura del hombro, eslabones y distancia de la muñeca al centro
 * de la tapa agarrada. La tapa queda entre las mordazas con su base enrasada en las puntas.
 */
const SHOULDER_Y = 0.86;
const LINK_1 = ROBOT.upperArm;
const LINK_2 = ROBOT.forearm + 0.06;
const JAW_TIP = 0.46;
const GRIP = JAW_TIP - FLOW.cap.h / 2;
/** Mordazas paralelas: grosor, ancho y recorrido de apertura a cada lado (m). */
const JAW = { t: 0.03, w: 0.035, travel: 0.03, root: 0.3 };

const CAP_ON_FEEDER: Vec3 = [FEEDER.x, FEEDER.top + FLOW.cap.h / 2, FEEDER.z];
/** Pasacables de suelo: de la caja de conexiones, bajo la cinta (entre dos patas) hasta la base del robot. */
const CABLE_PATH: [number, number][] = [
  [1.6, 1.24],
  [1.45, 1.24],
  [1.45, -1.3],
  [-0.17, -1.3],
];
/** Reposo: pinza en alto, fuera del paso de las piezas. */
const HOME_POINT: Vec3 = [0.35, 1.9, -0.55];
/** Altura de aproximación sobre cada punto (se baja y se sube en vertical). */
const CLEAR = 0.3;
/** Andon de la célula: verde con la planta en marcha, ámbar en pausa o en reposo. */
const cellSignal = () => (flow.running ? 'green' : 'amber') as 'green' | 'amber';

/** Zona que barre el brazo (con el alimentador dentro). */
const REGIONS: Region[] = [[-1.4, 0.1, -2.2, 1.6, 3.0, 0.55]];

type Pose = { yaw: number; shoulder: number; elbow: number; wrist: number };

/**
 * Cinemática inversa con la herramienta vertical hacia abajo: el eje 1 apunta al objetivo y
 * hombro y codo resuelven el triángulo hasta la muñeca (codo arriba).
 */
function reach([x, y, z]: Vec3, out: Pose): Pose {
  const dx = x - ROBOT.base[0];
  const dz = z - ROBOT.base[2];
  const ex = Math.hypot(dx, dz);
  const ey = y + GRIP - SHOULDER_Y;
  const c = (ex * ex + ey * ey - LINK_1 * LINK_1 - LINK_2 * LINK_2) / (2 * LINK_1 * LINK_2);
  const delta = -Math.acos(Math.min(1, Math.max(-1, c)));
  const link1 = Math.atan2(ey, ex) - Math.atan2(LINK_2 * Math.sin(delta), LINK_1 + LINK_2 * Math.cos(delta));
  out.yaw = Math.atan2(-dz, dx);
  out.shoulder = link1 - Math.PI / 2;
  out.elbow = delta + Math.PI / 2;
  out.wrist = -Math.PI / 2 - out.shoulder - out.elbow;
  return out;
}

const HOME = reach(HOME_POINT, { yaw: 0, shoulder: 0, elbow: 0, wrist: 0 });

function blend(a: Pose, b: Pose, k: number, out: Pose) {
  out.yaw = a.yaw + (b.yaw - a.yaw) * k;
  out.shoulder = a.shoulder + (b.shoulder - a.shoulder) * k;
  out.elbow = a.elbow + (b.elbow - a.elbow) * k;
  out.wrist = a.wrist + (b.wrist - a.wrist) * k;
  return out;
}

const lift = ([x, y, z]: Vec3, h: number): Vec3 => [x, y + h, z];

/**
 * Marcha forzada (mantener pulsado): la pinza traza un ocho en el aire sobre la célula, con la
 * herramienta vertical, como en una prueba de velocidad del programa.
 */
const DEMO = { center: [0.25, 1.3, -0.95] as Vec3, ax: 0.5, ay: 0.1, az: 0.34, hz: 0.42 };
function demoPose(time: number, out: Pose): Pose {
  const a = 2 * Math.PI * DEMO.hz * time;
  const [cx, cy, cz] = DEMO.center;
  return reach([cx + DEMO.ax * Math.sin(a), cy + DEMO.ay * Math.sin(2 * a), cz + DEMO.az * Math.sin(2 * a)], out);
}
const mix = (a: Vec3, b: Vec3, k: number): Vec3 => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

type Scratch = { a: Pose; b: Pose };

/**
 * Pose del gesto en el instante `t`: los traslados se interpolan en ejes (curvas suaves de robot) y
 * las bajadas y subidas en línea recta vertical, resolviendo la cinemática en cada frame.
 * `place` es el centro de la tapa ya colocada sobre la pieza.
 */
function gesturePose(t: number, place: Vec3, out: Pose, s: Scratch): Pose {
  const P = PICK;
  const k = (t0: number, t1: number) => easeInOut((t - t0) / (t1 - t0));
  if (t < P.abovePick) return blend(HOME, reach(lift(CAP_ON_FEEDER, CLEAR), s.b), k(P.start, P.abovePick), out);
  if (t < P.atPick) return reach(mix(lift(CAP_ON_FEEDER, CLEAR), CAP_ON_FEEDER, k(P.abovePick, P.atPick)), out);
  if (t < P.closed) return reach(CAP_ON_FEEDER, out);
  if (t < P.liftPick) return reach(mix(CAP_ON_FEEDER, lift(CAP_ON_FEEDER, CLEAR), k(P.closed, P.liftPick)), out);
  if (t < P.abovePlace) {
    return blend(reach(lift(CAP_ON_FEEDER, CLEAR), s.a), reach(lift(place, CLEAR), s.b), k(P.liftPick, P.abovePlace), out);
  }
  if (t < P.atPlace) return reach(mix(lift(place, CLEAR), place, k(P.abovePlace, P.atPlace)), out);
  if (t < P.open) return reach(place, out);
  if (t < P.lifted) return reach(mix(place, lift(place, CLEAR), k(P.open, P.lifted)), out);
  if (t < P.home) return blend(reach(lift(place, CLEAR), s.a), HOME, k(P.lifted, P.home), out);
  return blend(HOME, HOME, 0, out);
}

/** Apertura de la pinza (0 cerrada sobre la tapa, 1 abierta). */
function jawOpening(t: number) {
  const P = PICK;
  if (t < 0 || t < P.atPick) return 1;
  if (t < P.closed) return 1 - easeInOut((t - P.atPick) / (P.closed - P.atPick));
  if (t < P.atPlace) return 0;
  if (t < P.open) return easeInOut((t - P.atPlace) / (P.open - P.atPlace));
  return 1;
}

/**
 * Vista explosionada del brazo: cada eslabón se separa del anterior a lo largo del brazo, en el
 * marco de su articulación (giro, hombro, codo, muñeca y brida); la pinza además se abre del todo.
 */
const LINKS = [
  { joint: 'yaw', part: P.turret, rest: [0, 0, 0] },
  { joint: 'shoulder', part: P.upper, rest: [0, SHOULDER_Y, 0] },
  { joint: 'elbow', part: P.fore, rest: [0, ROBOT.upperArm, 0] },
  { joint: 'wrist', part: P.wrist, rest: [ROBOT.forearm + 0.06, 0, 0] },
  { joint: 'flange', part: P.gripper, rest: [0, 0, 0] },
] as const;
/** Apertura extra de las mordazas en el despiece (m a cada lado). */
const JAW_EXPLODE = 0.05;

type Joints = {
  yaw: THREE.Group | null;
  shoulder: THREE.Group | null;
  elbow: THREE.Group | null;
  wrist: THREE.Group | null;
  flange: THREE.Group | null;
  jawA: THREE.Group | null;
  jawB: THREE.Group | null;
  held: THREE.Mesh | null;
};

function Robot({ joints }: { joints: RefObject<Joints> }) {
  const { upperArm, forearm } = ROBOT;
  const set =
    <K extends keyof Joints>(k: K) =>
    (o: Joints[K]) => {
      joints.current[k] = o;
    };
  const r = FLOW.cap.r;
  const reachY = r + JAW.t + JAW.travel + 0.01;
  return (
    <group position={ROBOT.base}>
      <Merge>
        <RobotBase />
      </Merge>
      <group ref={set('yaw')} rotation={[0, HOME.yaw, 0]}>
        <Merge>
          <Turret shoulderY={SHOULDER_Y} />
        </Merge>
        <group ref={set('shoulder')} position={[0, SHOULDER_Y, 0]} rotation={[0, 0, HOME.shoulder]}>
          <Merge>
            <UpperArm length={upperArm} />
          </Merge>
          <group ref={set('elbow')} position={[0, upperArm, 0]} rotation={[0, 0, HOME.elbow]}>
            <Merge>
              <Forearm wristX={forearm + 0.06} />
            </Merge>
            <group ref={set('wrist')} position={[forearm + 0.06, 0, 0]} rotation={[0, 0, HOME.wrist]}>
              <Merge>
                <Wrist />
              </Merge>
              <group ref={set('flange')} rotation={[HOME.yaw, 0, 0]}>
                <Merge>
                  <GripperBody root={JAW.root} reachY={reachY} />
                </Merge>
                <group ref={set('jawA')}>
                  <Block min={[JAW.root, -(r + JAW.t), -JAW.w]} max={[JAW_TIP, -r, JAW.w]} c={palette.metalDark} />
                </group>
                <group ref={set('jawB')}>
                  <Block min={[JAW.root, r, -JAW.w]} max={[JAW_TIP, r + JAW.t, JAW.w]} c={palette.metalDark} />
                </group>
                {/* Tapa entre las mordazas (solo mientras la lleva). */}
                <mesh ref={set('held')} position={[GRIP, 0, 0]} rotation={[0, 0, Math.PI / 2]} visible={false} material={toon(palette.signalYellow)}>
                  <cylinderGeometry args={[FLOW.cap.r, FLOW.cap.r, FLOW.cap.h, 28]} />
                </mesh>
              </group>
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}

/** Pantalla del armario del robot (local de la estación) y su programa: una fila por paso del gesto. */
const CONTROLLER = { x0: 2.845, x1: 3.115, y0: 0.82, y1: 1.04, z: 1.347 };
const PROGRAM_STEPS = [PICK.abovePick, PICK.atPick, PICK.closed, PICK.liftPick, PICK.abovePlace, PICK.atPlace, PICK.open, PICK.home];
const PROGRAM_PX = { w: 64, h: 52, row: 5.4 };

/** Fila del programa en curso: 0 en espera; 1..8 durante el gesto. */
function programRow(t: number) {
  if (t < 0) return 0;
  const i = PROGRAM_STEPS.findIndex((s) => t < s);
  return i < 0 ? 0 : i + 1;
}

/** Programa del robot en la pantalla de su armario, con la línea en curso resaltada. */
function ControllerScreen() {
  const screen = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = PROGRAM_PX.w;
    canvas.height = PROGRAM_PX.h;
    const ctx = canvas.getContext('2d')!;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    const draw = (row: number) => {
      ctx.fillStyle = palette.screenDeep;
      ctx.fillRect(0, 0, PROGRAM_PX.w, PROGRAM_PX.h);
      for (let r = 0; r < 9; r++) {
        const y = 3 + r * PROGRAM_PX.row;
        if (r === row) {
          ctx.fillStyle = palette.andonGreen;
          ctx.globalAlpha = 0.35;
          ctx.fillRect(2, y - 1, PROGRAM_PX.w - 4, PROGRAM_PX.row);
        }
        ctx.globalAlpha = r === row ? 1 : 0.5;
        ctx.fillStyle = palette.screenInk;
        ctx.fillRect(5, y, 6, 3);
        ctx.fillRect(14, y, 14 + ((r * 37) % 23), 3);
      }
      ctx.globalAlpha = 1;
      texture.needsUpdate = true;
    };
    return { texture, draw };
  }, []);
  const row = useRef(-1);

  useEffect(() => () => screen.texture.dispose(), [screen]);

  useFrame(() => {
    const next = programRow(workTime('robotic'));
    if (next === row.current) return;
    row.current = next;
    screen.draw(next);
    const { x0, x1, y0, y1, z } = CONTROLLER;
    markDirty(STATION_X.robotic + x0, y0, z - 0.02, STATION_X.robotic + x1, y1, z + 0.02);
    runtime.invalidate();
  });

  const { x0, x1, y0, y1, z } = CONTROLLER;
  return (
    <mesh position={[(x0 + x1) / 2, (y0 + y1) / 2, z]} layers={DECAL_LAYER}>
      <planeGeometry args={[x1 - x0, y1 - y0]} />
      <meshBasicMaterial map={screen.texture} toneMapped={false} />
    </mesh>
  );
}

/**
 * Estación 05: célula robotizada vallada, robot de 6 ejes, alimentador de tapas y armarios. Cuando
 * llega una pieza, el robot coge una tapa del alimentador y la coloca en ella; si no, espera en reposo.
 */
export function RoboticCell() {
  const { x0, x1, z0, z1, h } = CELL;
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const joints = useRef<Joints>({
    yaw: null,
    shoulder: null,
    elbow: null,
    wrist: null,
    flange: null,
    jawA: null,
    jawB: null,
    held: null,
  });
  const feederCap = useRef<THREE.Mesh>(null);
  const idle = useRef(false);
  const work = useMemo(
    () => ({
      pose: { ...HOME } as Pose,
      demo: { ...HOME } as Pose,
      scratch: { a: { ...HOME }, b: { ...HOME } } as Scratch,
      place: [0, 0, 0] as Vec3,
      v: new THREE.Vector3(),
      right: new THREE.Vector3(),
      up: new THREE.Vector3(),
      fwd: new THREE.Vector3(),
    }),
    [],
  );

  /**
   * Centro de la tapa colocada, local de la estación. Sale de la pieza tal y como se dibuja
   * (ajustada al píxel), así la tapa pasa de la pinza a la pieza sin moverse ni un píxel.
   */
  const placePoint = () => {
    const cam = camera as THREE.OrthographicCamera;
    const px = 1 / (cam.zoom * gl.getPixelRatio());
    const w = work;
    w.right.setFromMatrixColumn(cam.matrixWorld, 0);
    w.up.setFromMatrixColumn(cam.matrixWorld, 1);
    w.fwd.setFromMatrixColumn(cam.matrixWorld, 2).negate();
    w.v.set(WORK_X.robotic, TOP, LINE.axisZ);
    const R = Math.round(w.v.dot(w.right) / px);
    const U = Math.round(w.v.dot(w.up) / px);
    const depth = w.v.dot(w.fwd);
    w.v
      .copy(w.right)
      .multiplyScalar(R * px)
      .addScaledVector(w.up, U * px)
      .addScaledVector(w.fwd, depth);
    w.place[0] = w.v.x - STATION_X.robotic;
    w.place[1] = w.v.y + FLOW.pallet[1] + FLOW.part[1] + FLOW.cap.h / 2;
    w.place[2] = w.v.z - LINE.axisZ;
    return w.place;
  };

  // Despiece del brazo (la línea está parada: el brazo se queda en su postura y se separa por eslabones).
  const links = useMemo(() => LINKS.map((l) => ({ ...l, entry: registerPart('robotic', l.part), k: -1 })), []);
  const tmp = useMemo(() => ({ off: new THREE.Vector3(), point: new THREE.Vector3(), now: new THREE.Vector3() }), []);
  useFrame(() => {
    const j = joints.current;
    let moved = false;
    for (const l of links) {
      const g = j[l.joint];
      if (!g?.parent) continue;
      const k = partProgress('robotic', l.part);
      if (k !== l.k) {
        l.k = k;
        moved = true;
        const [tx, ty, tz] = l.part.to;
        snappedOffset(tmp.off, g.parent, tx * k, ty * k, tz * k, camera, gl.getPixelRatio());
        g.position.set(l.rest[0], l.rest[1], l.rest[2]).add(tmp.off);
      }
      if (explode.station === 'robotic') {
        // Globo: un punto del eslabón; línea: ese mismo punto con el eslabón en su sitio.
        g.updateWorldMatrix(true, false);
        l.entry.k = k;
        g.localToWorld(tmp.now.set(...l.part.at));
        copyPoint(l.entry.now, tmp.now);
        tmp.off.set(g.position.x - l.rest[0], g.position.y - l.rest[1], g.position.z - l.rest[2]);
        g.parent.localToWorld(tmp.off);
        g.parent.localToWorld(tmp.point.set(0, 0, 0));
        copyPoint(l.entry.home, tmp.now.sub(tmp.off).add(tmp.point));
      }
    }
    // Con la pinza abriéndose más en el despiece, se actualizan las mordazas aunque el brazo esté en reposo.
    if (moved) idle.current = false;
  });

  useFrame(() => {
    const t = workTime('robotic');
    const f = forceLevel('robotic');
    if (t < 0 && f === 0 && idle.current) return;
    idle.current = t < 0 && f === 0;
    const j = joints.current;
    let pose = t < 0 ? blend(HOME, HOME, 0, work.pose) : gesturePose(t, placePoint(), work.pose, work.scratch);
    if (f > 0) pose = blend({ ...pose }, demoPose(force.time, work.demo), f, work.pose);
    if (j.yaw) j.yaw.rotation.y = pose.yaw;
    if (j.shoulder) j.shoulder.rotation.z = pose.shoulder;
    if (j.elbow) j.elbow.rotation.z = pose.elbow;
    if (j.wrist) j.wrist.rotation.z = pose.wrist;
    // Eje 6 compensa el giro del 1: las mordazas no cambian de orientación respecto a la nave.
    if (j.flange) j.flange.rotation.x = pose.yaw;
    const open = jawOpening(t) * JAW.travel + JAW_EXPLODE * partProgress('robotic', P.gripper);
    if (j.jawA) j.jawA.position.y = -open;
    if (j.jawB) j.jawB.position.y = open;
    // La tapa está en la pinza desde que la cierra hasta que la abre sobre la pieza.
    if (j.held) j.held.visible = t >= PICK.closed && t < PICK.open;
    // El alimentador repone la tapa subiéndola desde dentro cuando la pinza ya se ha ido.
    const cap = feederCap.current;
    if (cap) {
      const [r0, r1] = PICK.refill;
      const k = t < PICK.closed ? 1 : t < r0 ? 0 : easeInOut((t - r0) / (r1 - r0));
      cap.visible = k > 0;
      cap.position.y = CAP_ON_FEEDER[1] - FLOW.cap.h * (1 - k);
    }
    animateRegions(REGIONS, STATION_X.robotic, t >= 0 || f > 0);
  });

  return (
    <group position={[STATION_X.robotic, 0, LINE.axisZ]}>
      {/* Vista explosionada: el vallado se retira, el alimentador sube y el brazo se separa por eslabones. */}
      <Explode station="robotic" part={P.rear}>
        <MeshFence
          path={[
            [x0, -GAP],
            [x0, z0],
            [x1, z0],
            [x1, -GAP],
          ]}
          height={h}
        />
      </Explode>
      <Explode station="robotic" part={P.front} callout={false}>
        <MeshFence
          path={[
            [x0, GAP],
            [x0, z1],
          ]}
          height={h}
        />
      </Explode>
      <Explode station="robotic" part={P.front}>
        <MeshFence
          path={[
            [0.05, z1],
            [x1, z1],
            [x1, GAP],
          ]}
          height={h}
        />
      </Explode>
      {/* Alimentador de tapas: cargador con su pila y la tapa que espera arriba. */}
      <Explode station="robotic" part={P.feeder}>
        <Feeder />
        <mesh ref={feederCap} position={CAP_ON_FEEDER} material={toon(palette.signalYellow)}>
          <cylinderGeometry args={[FLOW.cap.r, FLOW.cap.r, FLOW.cap.h, 28]} />
        </mesh>
      </Explode>
      <Explode station="robotic" part={P.base} />
      <Merge>
        {/* Armarios: controlador del robot, caja de conexiones y fila de cuadros al fondo. */}
        <ElectricalCabinet position={[3.1, 0, 1.0]} size={[0.8, 1.2, 0.65]} />
        <Block min={[2.84, CONTROLLER.y0 - 0.005, 1.335]} max={[3.12, CONTROLLER.y1 + 0.005, 1.345]} c={palette.screen} />
        <TeachPendant x={2.7} y={0.86} z={0.96} />
        <ElectricalCabinet position={[1.6, 0, 1.47]} size={[0.46, 0.75, 0.34]} color={palette.metalMid} grille={false} />
        <CableProtector path={CABLE_PATH} />
        <LightCurtains xs={[x0 + 0.1, x1 - 0.1]} z={GAP - 0.06} />
        <ElectricalCabinet position={[1.2, 0, -2.52]} size={[1.5, 1.85, 0.6]} doors={2} />
        <AndonTower position={[x0, h, z1]} pole={0.12} signal={cellSignal} />
        <AndonTower position={[1.75, 1.85, -2.52]} pole={0.3} signal={cellSignal} />
      </Merge>
      <group userData={{ mergeBoundary: true }}>
        <Robot joints={joints} />
      </group>
      <ControllerScreen />
      <PendantLamp position={STATION.lamp} station="robotic" />
    </group>
  );
}
