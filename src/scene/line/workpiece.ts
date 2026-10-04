import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { FLOW } from '@/config/layout';
import { shared } from '../shared';

/**
 * La pieza que recorre la línea: palé de transporte, pieza mecanizada con sus cuatro taladros, el
 * casquillo que le pone la prensa y la tapa que le pone el robot. Origen: punto de apoyo del palé
 * sobre los rodillos. La dibuja la cinta y, mientras la lleva en el aire, la embaladora.
 */
export const [PW, PH, PD] = FLOW.pallet;
export const [BW, BH, BD] = FLOW.part;
/** El casquillo asoma un poco sobre la pieza; la tapa lo cubre entero. */
export const BUSHING_RISE = 0.014;

type Geometries = {
  pallet: THREE.BufferGeometry;
  part: THREE.BufferGeometry;
  holes: THREE.BufferGeometry;
  bushing: THREE.BufferGeometry;
  cap: THREE.BufferGeometry;
};
let cache: Geometries | null = null;

/** Geometrías compartidas (con el origen en el punto de apoyo del palé). */
export function workpieceGeometries(): Geometries {
  return (cache ??= {
    pallet: shared(new THREE.BoxGeometry(PW, PH, PD).translate(0, PH / 2, 0)),
    part: shared(new THREE.BoxGeometry(BW, BH, BD).translate(0, PH + BH / 2, 0)),
    bushing: shared(
      new THREE.CylinderGeometry(FLOW.bushing.r, FLOW.bushing.r, FLOW.bushing.h, 20).translate(0, PH + BH + BUSHING_RISE - FLOW.bushing.h / 2, 0),
    ),
    cap: shared(new THREE.CylinderGeometry(FLOW.cap.r, FLOW.cap.r, FLOW.cap.h, 28).translate(0, PH + BH + FLOW.cap.h / 2, 0)),
    // Cuatro taladros en las esquinas: sin ellos la pieza se lee como una caja.
    holes: shared(
      mergeGeometries(
        [-1, 1].flatMap((sx) =>
          [-1, 1].map((sz) => new THREE.CylinderGeometry(0.028, 0.028, 0.006, 12).translate(sx * (BW / 2 - 0.07), PH + BH + 0.002, sz * (BD / 2 - 0.07))),
        ),
      )!,
    ),
  });
}
