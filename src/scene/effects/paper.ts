import * as THREE from 'three';
import { shared } from '../shared';

/** Lado de la tesela de papel en px CSS (se repite sin costuras). */
export const PAPER_SIZE = 1024;

function hash(x: number, y: number) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

/**
 * Ruido de valor periódico con `cells` celdas por tesela, precalculado para la tesela entera: los
 * valores de la retícula y, por columna (o fila), su celda, la siguiente y su peso suavizado. La mezcla
 * de cada píxel es la misma operación que antes, sin los cuatro hashes por píxel: el papel sale
 * idéntico (comprobado byte a byte) y se genera varias veces más rápido, antes del primer frame.
 */
function valueNoise(cells: number) {
  const n = PAPER_SIZE;
  const s = cells / n;
  const lattice = new Float64Array(cells * cells);
  for (let y = 0; y < cells; y++) for (let x = 0; x < cells; x++) lattice[y * cells + x] = hash(x, y);
  const cell = new Int32Array(n);
  const next = new Int32Array(n);
  const weight = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const f = i * s;
    const c = Math.floor(f);
    const t = f - c;
    cell[i] = ((c % cells) + cells) % cells;
    next[i] = (((c + 1) % cells) + cells) % cells;
    weight[i] = t * t * (3 - 2 * t);
  }
  return { cells, lattice, cell, next, weight };
}

type Noise = ReturnType<typeof valueNoise>;

/** Una fila del ruido `v` a la altura `y`, en `out`. */
function noiseRow(v: Noise, y: number, out: Float64Array) {
  const { cells, lattice, cell, next, weight } = v;
  const row = cell[y] * cells;
  const rowNext = next[y] * cells;
  const uy = weight[y];
  for (let x = 0; x < out.length; x++) {
    const a = lattice[row + cell[x]];
    const b = lattice[row + next[x]];
    const c = lattice[rowNext + cell[x]];
    const d = lattice[rowNext + next[x]];
    const ux = weight[x];
    out[x] = a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
  }
}

let texture: THREE.DataTexture | null = null;

/**
 * Tesela de papel precalculada (una vez): R grano por px, G moteado de baja frecuencia,
 * B variación de carga de tinta. Antes se calculaba por píxel en cada frame (≈13 hashes).
 */
export function paperTexture() {
  if (texture) return texture;
  const n = PAPER_SIZE;
  const data = new Uint8Array(n * n * 4);
  const coarse = valueNoise(43);
  const medium = valueNoise(128);
  const fine = valueNoise(512);
  const rows = [new Float64Array(n), new Float64Array(n), new Float64Array(n)];
  for (let y = 0; y < n; y++) {
    noiseRow(coarse, y, rows[0]);
    noiseRow(medium, y, rows[1]);
    noiseRow(fine, y, rows[2]);
    for (let x = 0; x < n; x++) {
      const k = (y * n + x) * 4;
      const mottle = rows[0][x] + 0.5 * rows[1][x] - 0.75;
      data[k] = Math.round(hash(x + 7919, y + 104729) * 255);
      data[k + 1] = Math.round(((mottle + 0.75) / 1.5) * 255);
      data[k + 2] = Math.round(rows[2][x] * 255);
      data[k + 3] = 255;
    }
  }
  texture = shared(new THREE.DataTexture(data, n, n, THREE.RGBAFormat, THREE.UnsignedByteType));
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}
