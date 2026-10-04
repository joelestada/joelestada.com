'use client';

import { useMemo } from 'react';
import * as THREE from 'three';
import { BUILDING, DOOR, END } from '@/config/layout';
import { palette } from '@/config/palette';
import { DECAL_LAYER } from '../materials';
import { Block, Merge } from '../kit/primitives';
import { RegistrationMark } from '../kit/RegistrationMark';

const T = BUILDING.wallThickness;
const H = BUILDING.wallHeight;
const DZ = BUILDING.doorWallZ;
const BZ = BUILDING.backWallZ;
const SX = BUILDING.stepX;
const EX = BUILDING.endWallX;
const PW = BUILDING.pilasterWidth / 2;
const PD = BUILDING.pilasterDepth;
const PLINTH = BUILDING.plinthHeight;
/** Juntas de panel del muro (m). */
const PANEL_JOINT_YS = [3.3, 6.6];
/** Hueco de la puerta de salida en la pared final. */
const EXIT = END.door;
const CONSTRUCTION_OPACITY = 0.32;

/** Líneas finas de lámina: juntas de panel y replanteo. */
function wallLines() {
  const pts: number[] = [];
  const seg = (a: number[], b: number[]) => pts.push(...a, ...b);
  const dz = DZ + 0.004;
  const bz = BZ + 0.004;
  for (const y of PANEL_JOINT_YS) {
    seg([BUILDING.startX, y, dz], [DOOR.x0 - DOOR.guideWidth - 0.6, y, dz]);
    seg([SX, y, bz], [EX, y, bz]);
    // En la pared final, la junta no cruza el hueco de la puerta ni su cajón.
    if (y < EXIT.height + 0.6) {
      seg([EX - 0.004, y, BZ], [EX - 0.004, y, EXIT.z0 - 0.5]);
      seg([EX - 0.004, y, EXIT.z1 + 0.9], [EX - 0.004, y, BZ + BUILDING.endWallDepth]);
    } else seg([EX - 0.004, y, BZ], [EX - 0.004, y, BZ + BUILDING.endWallDepth]);
  }
  const pil = BUILDING.backWallPilasterXs;
  for (let i = 0; i < pil.length - 1; i++) {
    const mid = (pil[i] + pil[i + 1]) / 2;
    seg([mid, PLINTH, bz], [mid, H, bz]);
  }
  // Replanteo sobre el hueco de la persiana.
  const yTop = DOOR.openingHeight + DOOR.boxHeight + 0.45;
  seg([DOOR.x0 - 2.4, yTop, dz], [DOOR.x1 + 1.9, yTop, dz]);
  seg([DOOR.x0 - 1.25, 0.02, dz], [DOOR.x0 - 1.25, yTop + 0.4, dz]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  return g;
}

export function Walls() {
  const lines = useMemo(wallLines, []);
  const lineMaterial = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: palette.ink,
        transparent: true,
        opacity: CONSTRUCTION_OPACITY,
        depthWrite: false,
      }),
    [],
  );
  const c = palette.floor;

  return (
    <group>
      <Merge>
        {/* Tramo de la persiana, con su hueco. */}
        <Block min={[BUILDING.startX, 0, DZ - T]} max={[DOOR.x0, H, DZ]} c={c} />
        <Block min={[DOOR.x1, 0, DZ - T]} max={[SX, H, DZ]} c={c} />
        <Block min={[DOOR.x0, DOOR.openingHeight, DZ - T]} max={[DOOR.x1, H, DZ]} c={c} />
        <Block min={[BUILDING.startX, 0, DZ]} max={[DOOR.x0 - DOOR.guideWidth, PLINTH, DZ + 0.025]} c={c} />
        <Block min={[DOOR.x1 + DOOR.guideWidth, 0, DZ]} max={[SX, PLINTH, DZ + 0.025]} c={c} />
        {BUILDING.doorWallPilasterXs.map((x) => (
          <Block key={x} min={[x - PW, 0, DZ]} max={[x + PW, H, DZ + PD]} c={c} />
        ))}
        {/* Mochetas a ambos lados de la persiana. */}
        <Block min={[DOOR.x0 - DOOR.guideWidth - 0.42, 0, DZ]} max={[DOOR.x0 - DOOR.guideWidth - 0.06, H, DZ + 0.1]} c={c} />
        <Block min={[DOOR.x1 + DOOR.guideWidth + 0.06, 0, DZ]} max={[DOOR.x1 + DOOR.guideWidth + 0.5, H, DZ + 0.12]} c={c} />
        {/* Esquina del retranqueo. */}
        <Block min={[SX - 0.5, 0, DZ]} max={[SX, H, DZ + 0.12]} c={c} />
        {/* Muro del fondo retranqueado. */}
        <Block min={[SX - T, 0, BZ - T]} max={[EX + T, H, BZ]} c={c} />
        <Block min={[SX, 0, BZ]} max={[EX, PLINTH, BZ + 0.025]} c={c} />
        {BUILDING.backWallPilasterXs.map((x) => (
          <Block key={x} min={[x - PW, 0, BZ]} max={[x + PW, H, BZ + PD]} c={c} />
        ))}
        {/* Pared final de la nave, con el hueco de la puerta de salida en el eje de la cinta. */}
        <Block min={[EX, 0, BZ - T]} max={[EX + T, H, EXIT.z0]} c={c} />
        <Block min={[EX, 0, EXIT.z1]} max={[EX + T, H, BZ + BUILDING.endWallDepth]} c={c} />
        <Block min={[EX, EXIT.height, EXIT.z0]} max={[EX + T, H, EXIT.z1]} c={c} />
        <Block min={[EX - 0.025, 0, BZ]} max={[EX, PLINTH, EXIT.z0 - 0.12]} c={c} />
        <Block min={[EX - 0.025, 0, EXIT.z1 + 0.12]} max={[EX, PLINTH, BZ + BUILDING.endWallDepth]} c={c} />
        <Block min={[EX - PD, 0, BZ + 5 - PW]} max={[EX, H, BZ + 5 + PW]} c={c} />
      </Merge>
      <lineSegments geometry={lines} material={lineMaterial} layers={DECAL_LAYER} />
      {/* Cruces de registro sobre los muros (separadas lo justo para que el brazo no entre en el muro). */}
      <RegistrationMark position={[DOOR.x0 - 3.1, 2.2, DZ + 0.12]} />
      <RegistrationMark position={[DOOR.x1 + 1.3, 4.9, DZ + 0.24]} />
      <RegistrationMark position={[12.9, 3.9, BZ + 0.12]} />
      <RegistrationMark position={[26.2, 5.3, BZ + 0.12]} />
      <RegistrationMark position={[39.6, 4.4, BZ + 0.12]} />
      <RegistrationMark position={[EX - 0.14, 3.2, BZ + 2.6]} />
    </group>
  );
}
