import * as THREE from 'three';
import { palette } from '@/config/palette';
import { shared } from './shared';

/**
 * Capa de "calcomanías": pintura de suelo, rótulos, malla, láser, líneas finas.
 * Se pintan en el pase de color pero no entran en el pase de normales/ID,
 * así que el trazo de tinta no las contornea.
 */
export const DECAL_LAYER = 1;

/**
 * Tres tonos planos por material (multiplicadores lineales del color):
 * oscuro (caras -X), medio (caras +Z), claro (caras superiores = color exacto de la paleta).
 */
const TONE = { dark: 0.64, mid: 0.87, light: 1.0 } as const;
/** Umbrales en dot(N, L): por encima de `light` → claro; por encima de `mid` → medio. */
const THRESHOLD = { mid: 0.1, light: 0.6 } as const;
const GRADIENT_TEXELS = 20;

/** Intensidad ambiente: aporta la parte fija del tono; la direccional aporta el resto. */
export const AMBIENT_INTENSITY = Math.PI * TONE.dark * 0.6;
export const DIRECTIONAL_INTENSITY = Math.PI;

let gradientMap: THREE.DataTexture | null = null;

function getGradientMap() {
  if (gradientMap) return gradientMap;
  const ambient = AMBIENT_INTENSITY / Math.PI;
  const data = new Uint8Array(GRADIENT_TEXELS);
  for (let i = 0; i < GRADIENT_TEXELS; i++) {
    // MeshToonMaterial muestrea en dot(N, L) * 0.5 + 0.5.
    const dot = ((i + 0.5) / GRADIENT_TEXELS) * 2 - 1;
    const tone = dot > THRESHOLD.light ? TONE.light : dot > THRESHOLD.mid ? TONE.mid : TONE.dark;
    data[i] = Math.round((tone - ambient) * 255);
  }
  gradientMap = shared(new THREE.DataTexture(data, GRADIENT_TEXELS, 1, THREE.RedFormat, THREE.UnsignedByteType));
  gradientMap.minFilter = THREE.NearestFilter;
  gradientMap.magFilter = THREE.NearestFilter;
  gradientMap.generateMipmaps = false;
  gradientMap.needsUpdate = true;
  return gradientMap;
}

const toonCache = new Map<string, THREE.MeshToonMaterial>();

/** Material toon compartido por color. */
export function toon(color: string): THREE.MeshToonMaterial {
  let m = toonCache.get(color);
  if (!m) {
    m = shared(new THREE.MeshToonMaterial({ color, gradientMap: getGradientMap() }));
    toonCache.set(color, m);
  }
  return m;
}

let toonVertex: THREE.MeshToonMaterial | null = null;

/**
 * Material toon cuyo color va en los vértices: las piezas fusionadas de un conjunto (`Merge`) lo
 * comparten todas, sea cual sea su color, y el conjunto entero se dibuja en una sola llamada.
 * Con blanco en el material y el color lineal de cada pieza en los vértices, el tono es el mismo.
 */
export function toonVertexColors(): THREE.MeshToonMaterial {
  return (toonVertex ??= shared(new THREE.MeshToonMaterial({ color: 0xffffff, vertexColors: true, gradientMap: getGradientMap() })));
}

const flatCache = new Map<string, THREE.MeshBasicMaterial>();

/** Material plano sin luz para pintura y calcomanías. */
export function flat(color: string, opacity = 1): THREE.MeshBasicMaterial {
  const key = `${color}|${opacity}`;
  let m = flatCache.get(key);
  if (!m) {
    m = shared(
      new THREE.MeshBasicMaterial({
        color,
        transparent: opacity < 1,
        opacity,
        depthWrite: opacity >= 1,
      }),
    );
    flatCache.set(key, m);
  }
  return m;
}

/** Versión apagada de un color de piloto (luz sin encender): se acerca al acero oscuro. */
export function dimmed(hex: string, amount = 0.72) {
  return `#${new THREE.Color(hex).lerp(new THREE.Color(palette.metalDark), amount).getHexString()}`;
}
