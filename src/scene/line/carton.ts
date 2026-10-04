import * as THREE from 'three';
import { pageLang } from '@/i18n/lang';
import { uiIn } from '@/i18n/ui';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { END, type Vec3 } from '@/config/layout';
import { palette } from '@/config/palette';
import { loadStencil } from '../fonts';
import { shared } from '../shared';
import { PH } from './workpiece';

/**
 * Caja americana de cartón ondulado (cuatro paredes y cuatro solapas arriba y abajo), como la arma,
 * llena, cierra y precinta la embaladora. Todo en el marco de la caja: origen en la esquina
 * delantera izquierda del canto inferior de las paredes, la pared delantera (A) a lo largo de +X con
 * su cara exterior en z = 0, y la caja hacia -Z. Las paredes son A (delante), B (derecha), C (detrás)
 * y D (izquierda); las solapas largas cuelgan de A y C, las cortas de B y D.
 *
 * Cada pared va en su propio marco: X a lo largo de la pared desde su esquina, Z hacia fuera (el
 * cartón ocupa z ∈ [-t, 0]). Las solapas giran sobre su pliegue: las cortas, por el canto interior
 * de la pared; las largas, un grueso más arriba y por fuera, para quedar cerradas encima de las cortas.
 */
const { l: L, w: W, h: H, flap: F, t: T } = END.carton;
export const CARTON = {
  L,
  W,
  H,
  F,
  T,
  /** Cinta de precinto: ancho, grueso y lo que baja por cada testa. */
  tape: { w: 0.048, t: 0.0015, clip: 0.05 },
};
/** Bajo las paredes van las dos capas de solapas del fondo: la caja se apoya 2t por debajo de su origen. */
const CARTON_BASE = 2 * T;
/** Cara de arriba con las solapas largas cerradas (sobre las cortas). */
export const CARTON_TOP = H + 2 * T;
/** Plano de las solapas recién formada la caja: casi paralelas (las paredes de una plancha plegada). */
export const ALPHA_FLAT = Math.asin((2 * T) / W);

type Box3 = [Vec3, Vec3];
const boxGeometry = ([min, max]: Box3) =>
  new THREE.BoxGeometry(max[0] - min[0], max[1] - min[1], max[2] - min[2]).translate((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2);

/** Piezas de cada pared en su marco y bisagras de sus solapas (posición del pliegue). */
const PIECE = {
  wallLong: [
    [T, 0, -T],
    [L - T, H, 0],
  ] as Box3,
  wallShort: [
    [0, 0, -T],
    [W, H, 0],
  ] as Box3,
  creaseTop: [
    [0, H, 0],
    [L, H + T, T],
  ] as Box3,
  creaseBottom: [
    [0, -T, 0],
    [L, 0, T],
  ] as Box3,
  topMinor: [
    [T, 0, 0],
    [W - T, F, T],
  ] as Box3,
  topMajor: [
    [0, 0, 0],
    [L, F, T],
  ] as Box3,
  bottomMinor: [
    [T, -F, 0],
    [W - T, 0, T],
  ] as Box3,
  bottomMajor: [
    [0, -F, 0],
    [L, 0, T],
  ] as Box3,
};
export const HINGE = {
  topMinor: [0, H, -T] as Vec3,
  topMajor: [0, H + T, 0] as Vec3,
  bottomMinor: [0, 0, -T] as Vec3,
  bottomMajor: [0, -T, 0] as Vec3,
};

/** Esquina y giro de cada pared con la caja abierta un ángulo `alpha` (de plana, 0, a cuadrada, 90°). */
export function panelFrame(i: 0 | 1 | 2 | 3, alpha: number): { p: Vec3; ry: number } {
  const [dx, dz] = [W * Math.cos(alpha), -W * Math.sin(alpha)];
  if (i === 0) return { p: [0, 0, 0], ry: 0 };
  if (i === 1) return { p: [L, 0, 0], ry: alpha };
  if (i === 2) return { p: [L + dx, 0, dz], ry: Math.PI };
  return { p: [dx, 0, dz], ry: alpha + Math.PI };
}

const matrix = (p: Vec3, ry: number) => new THREE.Matrix4().makeRotationY(ry).setPosition(p[0], p[1], p[2]);
const hingeMatrix = (h: Vec3, rx: number) => new THREE.Matrix4().makeRotationX(rx).setPosition(h[0], h[1], h[2]);

type Geometries = {
  /** Piezas sueltas (las anima la embaladora). */
  wallLong: THREE.BufferGeometry;
  wallShort: THREE.BufferGeometry;
  creases: THREE.BufferGeometry;
  topMinor: THREE.BufferGeometry;
  topMajor: THREE.BufferGeometry;
  bottomMinor: THREE.BufferGeometry;
  bottomMajor: THREE.BufferGeometry;
  /** Caja ya cuadrada: paredes y pliegues en una sola pieza. */
  body: THREE.BufferGeometry;
  /** Solapas largas cerradas (la caja ya cerrada, como sale por la cinta). */
  closedMajors: THREE.BufferGeometry;
  /**
   * Cinta, en tres tramos que pone la precintadora al pasar la caja: el de arriba, que crece desde
   * la testa delantera (largo 1, anclado en x = L); la «L» de la testa delantera, entera; y la de la
   * testa trasera, que baja desde arriba (alto 1, anclada en la cara de arriba).
   */
  tapeTop: THREE.BufferGeometry;
  tapeLead: THREE.BufferGeometry;
  tapeTrail: THREE.BufferGeometry;
  /** Rótulo impreso en la pared delantera. */
  print: THREE.BufferGeometry;
};

let cache: Geometries | null = null;

/** Geometrías compartidas de la caja, en su marco. */
export function cartonGeometries(): Geometries {
  if (cache) return cache;
  const { w: tw, t: tt, clip } = CARTON.tape;
  const zc = -W / 2;
  const formed = ([0, 1, 2, 3] as const).map((i) => panelFrame(i, Math.PI / 2));
  const at = (g: THREE.BufferGeometry, m: THREE.Matrix4) => g.clone().applyMatrix4(m);
  const wallLong = boxGeometry(PIECE.wallLong);
  const wallShort = boxGeometry(PIECE.wallShort);
  const creases = mergeGeometries([boxGeometry(PIECE.creaseTop), boxGeometry(PIECE.creaseBottom)])!;
  const topMajor = boxGeometry(PIECE.topMajor);
  const body = mergeGeometries(
    formed.flatMap(({ p, ry }, i) => {
      const m = matrix(p, ry);
      return i % 2 === 0 ? [at(wallLong, m), at(creases, m)] : [at(wallShort, m)];
    }),
  )!;
  const closedMajors = mergeGeometries(
    [0, 2].map((i) => {
      const { p, ry } = formed[i];
      return at(topMajor, matrix(p, ry).multiply(hingeMatrix(HINGE.topMajor, -Math.PI / 2)));
    }),
  )!;
  const strip = (x0: number, x1: number, y0: number, y1: number) =>
    boxGeometry([
      [x0, y0, zc - tw / 2],
      [x1, y1, zc + tw / 2],
    ]);
  cache = {
    wallLong: shared(wallLong),
    wallShort: shared(wallShort),
    creases: shared(creases),
    topMinor: shared(boxGeometry(PIECE.topMinor)),
    topMajor: shared(topMajor),
    bottomMinor: shared(boxGeometry(PIECE.bottomMinor)),
    bottomMajor: shared(boxGeometry(PIECE.bottomMajor)),
    body: shared(body),
    closedMajors: shared(closedMajors),
    tapeTop: shared(strip(-1, 0, CARTON_TOP, CARTON_TOP + tt)),
    tapeLead: shared(strip(L, L + tt, CARTON_TOP - clip, CARTON_TOP + tt)),
    tapeTrail: shared(strip(-tt, 0, -1, 0)),
    print: shared(new THREE.PlaneGeometry(PRINT.w, PRINT.h).translate(L / 2, PRINT.y, 0.0015)),
  };
  return cache;
}

/** Marco de la caja respecto al punto de apoyo del palé (la caja va centrada sobre él). */
export const CARTON_ON_PALLET: Vec3 = [-L / 2, PH + CARTON_BASE, W / 2];

/** Hueco del rótulo en la pared delantera (m) y su resolución (px por m). */
const PRINT = { w: L - 0.06, h: H - 0.07, y: H / 2 + 0.008 };
const PRINT_PX = 820;

/**
 * Con la plancha casi plegada, la pared D (que tiene grueso) asoma por delante de la A junto al
 * pliegue que las une, porque el paralelogramo apenas tiene fondo: el rótulo se adelanta lo justo
 * para no quedar tapado. Abierta unos 15°, ya no hace falta.
 */
export function printLift(alpha: number) {
  const x0 = (L - PRINT.w) / 2;
  return Math.max(0, (T - x0 * Math.sin(alpha)) / Math.cos(alpha));
}
let printTexture: THREE.CanvasTexture | null = null;

/**
 * Impresión en tinta sobre el kraft de la pared delantera: el nombre en stencil con «OPEN TO NEW
 * PROJECTS» debajo, un filete y el símbolo de «este lado arriba». Se dibuja cuando carga la fuente.
 */
function cartonPrintTexture() {
  if (printTexture) return printTexture;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(PRINT.w * PRINT_PX);
  canvas.height = Math.round(PRINT.h * PRINT_PX);
  const texture = shared(new THREE.CanvasTexture(canvas));
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  printTexture = texture;

  const draw = (family: string) => {
    const ctx = canvas.getContext('2d')!;
    const { width: w, height: h } = canvas;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = palette.ink;
    ctx.globalAlpha = 0.86;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const fit = (text: string, size: number, spacing: number, y: number, width: number, cx = w / 2) => {
      ctx.font = `${size}px ${family}`;
      ctx.letterSpacing = `${spacing}px`;
      const k = Math.min(1, width / ctx.measureText(text).width);
      ctx.save();
      ctx.translate(cx, y);
      ctx.scale(k, 1);
      ctx.fillText(text, 0, 0);
      ctx.restore();
    };
    fit('JOEL ESTADA', h * 0.42, h * 0.02, h * 0.64, w * 0.9);
    fit(uiIn(pageLang()).scene.box, h * 0.15, h * 0.04, h * 0.9, w * 0.9);
    // Filete y símbolo de «este lado arriba» (dos flechas sobre una barra), arriba.
    ctx.fillRect(w * 0.05, h * 0.16, w * 0.72, Math.max(2, h * 0.02));
    const ax = w * 0.83;
    const aw = w * 0.12;
    ctx.fillRect(ax, h * 0.3, aw, h * 0.025);
    for (const cx of [ax + aw * 0.28, ax + aw * 0.72]) {
      ctx.fillRect(cx - h * 0.012, h * 0.11, h * 0.024, h * 0.15);
      ctx.beginPath();
      ctx.moveTo(cx - h * 0.045, h * 0.12);
      ctx.lineTo(cx + h * 0.045, h * 0.12);
      ctx.lineTo(cx, h * 0.04);
      ctx.closePath();
      ctx.fill();
    }
    texture.needsUpdate = true;
  };

  loadStencil().then(draw);
  return texture;
}

/** Colores de la caja. */
export const CARTON_COLORS = { kraft: palette.carton, edge: palette.cartonEdge, tape: palette.tape };

let printMaterial: THREE.MeshBasicMaterial | null = null;
/** Material del rótulo (calcomanía con transparencia), compartido por la línea y la embaladora. */
export function cartonPrintMaterial() {
  return (printMaterial ??= shared(new THREE.MeshBasicMaterial({ map: cartonPrintTexture(), transparent: true, depthWrite: false })));
}
