import type * as THREE from 'three';
import { BUILDING, CAMERA, DOOR, END } from '@/config/layout';
import { STATIONS, type StationId } from '@/config/stations';

/**
 * Encuadre de las pantallas compactas (móvil). En escritorio la nave se ve entera y la ficha flota
 * sobre ella; en el móvil la interfaz ocupa una parte grande de la pantalla, así que la cámara pone
 * la máquina en el hueco que queda libre: de la barra a la ficha desplegada, o a la derecha de la
 * ficha en horizontal.
 *
 * El encuadre es fijo en cada parada: no se mueve al desplegar la ficha ni al despiezar. Para eso la
 * caja de cada máquina ya cuenta con su despiece y con su globo, y el hueco con la ficha desplegada.
 * Entre dos paradas la caja pasa de una a otra con el recorrido: la cámara solo depende de dónde
 * está (y de la presentación, que deja ver la persiana), no de lo que se toca.
 */

type Box = readonly [number, number, number, number, number, number];
/** Caja en el plano de la cámara (m), relativa al punto al que mira la cámara en su parada. */
export type Span = { r0: number; r1: number; u0: number; u1: number };

type Stop = { x: number; base: Span; intro?: Span };

/**
 * Lo que el despiece saca fuera del volumen de la máquina, en el plano de la cámara (m a la izquierda
 * y hacia arriba), medido con los globos de sus piezas. Solo el motor: en las demás máquinas el
 * despiece y el globo de la estación caben dentro de su volumen.
 */
const EXPLODE_ROOM: Partial<Record<StationId, { left: number; up: number }>> = { engine: { left: 1.7, up: 1.4 } };

/**
 * Presentación: el rótulo JOEL / PORTFOLIO pintado en las lamas de la persiana y, delante, la mitad
 * del banco del motor que da a ella (lo demás entra al echar a andar la línea). Las dos cosas enteras
 * no caben a lo ancho de un móvil.
 */
const SHUTTER: Box = [DOOR.x0, DOOR.slatBottom, BUILDING.doorWallZ, DOOR.x1, DOOR.openingHeight, BUILDING.doorWallZ];
const BENCH_HALF = 0.5;
/** Final de la línea: la embaladora, la precintadora y la puerta de salida por la que se van las cajas. */
const EXIT_BOX: Box = [END.packX - 1.6, 0, -2.0, BUILDING.endWallX, END.door.height + 0.7, END.door.z1 + 0.2];

const mix = (a: Span, b: Span, k: number): Span => ({
  r0: a.r0 + (b.r0 - a.r0) * k,
  r1: a.r1 + (b.r1 - a.r1) * k,
  u0: a.u0 + (b.u0 - a.u0) * k,
  u1: a.u1 + (b.u1 - a.u1) * k,
});

const union = (a: Span, b: Span): Span => ({ r0: Math.min(a.r0, b.r0), r1: Math.max(a.r1, b.r1), u0: Math.min(a.u0, b.u0), u1: Math.max(a.u1, b.u1) });

const smooth = (k: number) => {
  const t = Math.min(1, Math.max(0, k));
  return t * t * (3 - 2 * t);
};

/**
 * Encuadres de las paradas para una orientación de cámara (sus ejes en pantalla). Devuelve la caja
 * que debe verse con la cámara en `x`, con la presentación (`intro`, 0..1) ya mezclada.
 */
export function createFraming(right: THREE.Vector3, up: THREE.Vector3) {
  const span = (b: Box, x: number): Span => {
    // El punto al que mira la cámara en esa parada, en el plano de la cámara.
    const tr = x * right.x + CAMERA.targetY * right.y + CAMERA.targetZ * right.z;
    const tu = x * up.x + CAMERA.targetY * up.y + CAMERA.targetZ * up.z;
    const s: Span = { r0: Infinity, r1: -Infinity, u0: Infinity, u1: -Infinity };
    for (let i = 0; i < 8; i++) {
      const px = i & 1 ? b[3] : b[0];
      const py = i & 2 ? b[4] : b[1];
      const pz = i & 4 ? b[5] : b[2];
      const r = px * right.x + py * right.y + pz * right.z - tr;
      const u = px * up.x + py * up.y + pz * up.z - tu;
      s.r0 = Math.min(s.r0, r);
      s.r1 = Math.max(s.r1, r);
      s.u0 = Math.min(s.u0, u);
      s.u1 = Math.max(s.u1, u);
    }
    return s;
  };

  const stops: Stop[] = STATIONS.map((st) => {
    // El motor no tiene parada propia: la cámara empieza a su lado, en el inicio del recorrido.
    const x = Math.min(CAMERA.endX, Math.max(CAMERA.startX, st.x));
    const { min, max } = st.hit;
    const base = span([st.x + min[0], min[1], min[2], st.x + max[0], max[1], max[2]], x);
    const room = EXPLODE_ROOM[st.id];
    if (room) {
      base.r0 -= room.left;
      base.u1 += room.up;
    }
    return { x, base };
  });
  const engine = STATIONS[0];
  const bench: Box = [engine.x + engine.hit.min[0], 0, engine.hit.min[2], engine.x + BENCH_HALF, engine.hit.max[1], engine.hit.max[2]];
  stops[0].intro = union(span(bench, stops[0].x), span(SHUTTER, stops[0].x));
  stops.push({ x: END.packX, base: span(EXIT_BOX, END.packX) });

  const at = (stop: Stop, intro: number) => (stop.intro && intro > 0 ? mix(stop.base, stop.intro, intro) : stop.base);

  return (x: number, intro: number): Span => {
    let i = 0;
    while (i < stops.length - 2 && x > stops[i + 1].x) i++;
    const a = stops[i];
    const b = stops[i + 1];
    // Cerca de cada parada el encuadre es el suyo; el cambio se hace en el tramo central.
    const k = smooth((x - a.x) / (b.x - a.x) / 0.7 - 0.15 / 0.7);
    return mix(at(a, intro), at(b, intro), k);
  };
}
