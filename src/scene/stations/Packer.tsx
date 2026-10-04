'use client';

import { useMemo, useRef, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { END, LINE } from '@/config/layout';
import { palette } from '@/config/palette';
import { flow, workTime } from '../line/flow';
import { toon } from '../materials';
import { AndonTower } from '../kit/AndonTower';
import { CARTON, CARTON_ON_PALLET } from '../line/carton';
import { FloorOutline } from '../kit/FloorOutline';
import { DragChain, emptyChain, poseChain } from '../kit/DragChain';
import { Merge } from '../kit/primitives';
import { animateRegions, snapToPixels, type Region } from '../kit/regions';
import { SEALER } from '../line/sealer';
import { workpieceGeometries } from '../line/workpiece';
import { Carton, emptyCarton, poseCarton } from './packer/Carton';
import { ERECTOR, HEAD_CHAIN, PALLET_TOP, PORTAL, TOP, X0 } from './packer/dims';
import { ErectorFrame, Infeed, Portal, PusherBeam } from './packer/Frame';
import { ErectorMoving, Stack, poseErector, type ErectorParts } from './packer/Erector';
import { Head, ROD_TOP, poseHead, type HeadParts } from './packer/Head';
import { Pusher, posePusher, type PusherParts } from './packer/Pusher';
import { Sealer } from './packer/Sealer';
import { PackerScreen } from './packer/Screen';
import { emptyPose, packPose } from './packer/timeline';

/** Andon: verde con la planta en marcha, ámbar en pausa o en reposo. */
const packSignal = () => (flow.running ? 'green' : 'amber') as 'green' | 'amber';
const RIGHT = Math.PI / 2;
/** Subida del brazo de la plancha y del abridor al apartarse. */
const PICKER_LIFT = 0.5;
const OPENER_LIFT = 0.45;
/** Cota de la mesa de formado: arriba sostiene la caja, abajo deja colgar el fondo. */
const BED_Y = [PALLET_TOP - 0.001, 0.6] as const;

/**
 * Marco de la cadena del cabezal: sus tramos bajan (−Y) desde la cota del travesaño, el móvil 2r por
 * delante del fijo (+Z) y el ancho a lo largo de la línea.
 */
const HEAD_CHAIN_FRAME = new THREE.Quaternion().setFromRotationMatrix(
  new THREE.Matrix4().makeBasis(new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(-1, 0, 0)),
);

/** Zonas que se mueven: el pórtico con el cabezal y la caja; detrás, transportador y formadora. */
const REGIONS: Region[] = [
  [X0 - 0.5, 0.85, -0.42, X0 + 0.5, PORTAL.h + 0.9, 0.4],
  [X0 - 0.56, 0.55, -2.86, X0 + 0.96, 2.45, -0.2],
];

/** La pieza mientras la lleva el cabezal o está en la caja abierta (la misma que dibuja la cinta). */
function HeldPart({ group }: { group: RefObject<THREE.Group | null> }) {
  const g = workpieceGeometries();
  return (
    <group ref={group} visible={false}>
      <Merge>
        <mesh geometry={g.part} material={toon(palette.workpiece)} />
        <mesh geometry={g.holes} material={toon(palette.metalDark)} />
        <mesh geometry={g.bushing} material={toon(palette.metalDark)} />
        <mesh geometry={g.cap} material={toon(palette.signalYellow)} />
      </Merge>
    </group>
  );
}

/**
 * Embaladora del final de la línea. Con cada pieza: el cabezal de ventosas la saca del palé, el
 * empujador mete en el palé la caja abierta que esperaba, el cabezal la baja dentro y, con su marco
 * sobre la caja, pliega las solapas cortas y luego las largas. La caja sale cerrada por la cinta y la
 * precintadora de la salida la precinta al pasar. Detrás, la formadora saca la plancha siguiente del
 * cargador, la abre, le cierra el fondo y el empujador la deja esperando. Como las demás máquinas,
 * solo trabaja con una pieza delante.
 */
export function Packer() {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const pose = useMemo(emptyPose, []);
  const head = useRef<THREE.Group>(null);
  const headParts = useRef<HeadParts>({ plate: null, fingers: [], paddles: [] });
  const rod = useRef<THREE.Mesh>(null);
  const headChain = useRef(emptyChain());
  const part = useRef<THREE.Group>(null);
  const box = useRef<THREE.Group>(null);
  const boxParts = useRef(emptyCarton());
  const next = useRef<THREE.Group>(null);
  const nextParts = useRef(emptyCarton());
  const pusher = useRef<PusherParts>({ carriage: null, arm: null, chain: emptyChain() });
  const stack = useRef<THREE.Group>(null);
  const erector = useRef<ErectorParts>({
    stack: null,
    pickerCarriage: null,
    pickerArm: null,
    openerLift: null,
    openerSpin: null,
    bed: null,
    chain: emptyChain(),
  });
  const idle = useRef(false);
  const v = useMemo(() => new THREE.Vector3(), []);

  /** Coloca `o` en el punto local (x, y, z) ajustado a la rejilla de píxeles del mundo, como las piezas. */
  const place = (o: THREE.Object3D | null, x: number, y: number, z: number) => {
    if (!o) return;
    v.set(END.packX + x, y, LINE.axisZ + z);
    snapToPixels(v, camera as THREE.OrthographicCamera, gl.getPixelRatio());
    o.position.set(v.x - END.packX, v.y, v.z - LINE.axisZ);
  };

  useFrame(() => {
    const t = workTime('pack');
    if (t < 0 && idle.current) return;
    idle.current = t < 0;
    const p = packPose(t, pose);

    // Cabezal, vástago del cilindro y la pieza que lleva.
    place(head.current, X0, p.headY, 0);
    poseHead(headParts.current, p.plate, p.fingers, p.paddles);
    if (rod.current && head.current) {
      const bottom = head.current.position.y + ROD_TOP;
      rod.current.scale.y = PORTAL.h - bottom;
      rod.current.position.y = (PORTAL.h + bottom) / 2;
      poseChain(headChain.current, HEAD_CHAIN, HEAD_CHAIN.y - (head.current.position.y + HEAD_CHAIN.attach));
    }
    if (part.current) {
      part.current.visible = p.partDy !== null;
      if (p.partDy !== null) place(part.current, X0, TOP + p.partDy, 0);
    }

    // Caja que se embala, con sus solapas (cerrada, pasa a la cinta).
    if (box.current) {
      box.current.visible = p.box.visible;
      place(box.current, X0, TOP, p.box.z);
    }
    poseCarton(boxParts.current, RIGHT, [p.box.minor, p.box.major], [RIGHT, RIGHT]);

    // Empujador.
    place(pusher.current.carriage, X0, 0, p.shoe.z);
    place(pusher.current.arm, X0, p.shoe.lift, p.shoe.z);
    posePusher(pusher.current);

    // Formadora: plancha siguiente, cargador, brazo, abridor y mesa.
    const n = p.next;
    place(next.current, X0, TOP, n.zA - CARTON.W / 2);
    poseCarton(nextParts.current, n.alpha, [n.top, n.top], [n.bottomMinor, n.bottomMajor]);
    place(stack.current, 0, 0, p.stack * ERECTOR.pitch);
    const e = erector.current;
    place(e.pickerCarriage, 0, 0, p.picker.z);
    place(e.pickerArm, 0, p.picker.lift * PICKER_LIFT, p.picker.z);
    poseErector(e);
    place(e.openerLift, 0, p.opener.lift * OPENER_LIFT, 0);
    if (e.openerSpin) e.openerSpin.rotation.y = p.opener.alpha;
    place(e.bed, 0, BED_Y[0] + (BED_Y[1] - BED_Y[0]) * p.bed, 0);

    animateRegions(REGIONS, END.packX, t >= 0);
  });

  return (
    <group position={[END.packX, 0, LINE.axisZ]}>
      <Merge>
        <Portal />
        <PusherBeam />
        <Infeed />
        <ErectorFrame />
        <AndonTower position={[X0 + PORTAL.x, PORTAL.h, PORTAL.z]} pole={0.16} signal={packSignal} />
      </Merge>
      {/* Cabezal y vástago de su cilindro (que se estira y encoge). */}
      <group ref={head} userData={{ mergeBoundary: true }}>
        <Head parts={headParts} />
      </group>
      <mesh ref={rod} position={[X0, 2, 0]} material={toon(palette.metalLight)}>
        <cylinderGeometry args={[0.028, 0.028, 1, 16]} />
      </mesh>
      <group position={[X0 + HEAD_CHAIN.x, HEAD_CHAIN.y, HEAD_CHAIN.z]} quaternion={HEAD_CHAIN_FRAME}>
        <DragChain spec={HEAD_CHAIN} parts={headChain} />
      </group>
      <HeldPart group={part} />
      {/* Caja que se embala (marco: el apoyo del palé) y caja siguiente, en la formadora. */}
      <group ref={box}>
        <group position={CARTON_ON_PALLET}>
          <Carton parts={boxParts} />
        </group>
      </group>
      <group ref={next}>
        <group position={CARTON_ON_PALLET}>
          <Carton parts={nextParts} />
        </group>
      </group>
      <Stack group={stack} />
      <Sealer />
      <PackerScreen />
      <Pusher parts={pusher} />
      <ErectorMoving parts={erector} />
      {/* Zona de la máquina: embaladora, formadora y precintadora. */}
      <FloorOutline x0={X0 - 1.15} x1={SEALER.x - END.packX + 0.8} z0={-2.95} z1={0.95} />
    </group>
  );
}
