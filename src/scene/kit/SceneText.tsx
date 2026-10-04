'use client';

import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { markFull } from '@/lib/runtime';
import { holdBoot } from '../boot';
import { loadStencil } from '../fonts';

type Vec3 = [number, number, number];

type Props = {
  children: string;
  /** Altura del cuerpo (em) en metros. */
  fontSize: number;
  position: Vec3;
  rotation?: Vec3;
  anchorX?: 'left' | 'center' | 'right';
  anchorY?: 'middle';
  /** Espacio extra entre letras, en em. */
  letterSpacing?: number;
  color: string;
  layers?: number;
};

/** Resolución del lienzo: píxeles por em según el tamaño del rótulo (≈ 2× la densidad en pantalla). */
const pxPerEm = (fontSize: number) => Math.min(512, Math.max(96, Math.round(fontSize * 300)));

/**
 * Pinta el rótulo en un lienzo 2D, letra a letra (el espaciado es el mismo en todos los navegadores),
 * con márgenes de 0,15 em. Devuelve la textura y la caja del rótulo en em: ancho del texto, y
 * ascendente y descendente de la fuente, que fijan su centro vertical.
 */
function paint(text: string, family: string, fontSize: number, spacing: number) {
  const px = pxPerEm(fontSize);
  const pad = Math.ceil(px * 0.15);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  const font = `${px}px ${family}`;
  ctx.font = font;
  const chars = [...text];
  const advances = chars.map((c) => ctx.measureText(c).width);
  const gap = spacing * px;
  const width = advances.reduce((a, b) => a + b, 0) + gap * (chars.length - 1);
  const m = ctx.measureText(text);
  const ascent = m.fontBoundingBoxAscent ?? px * 0.9;
  const descent = m.fontBoundingBoxDescent ?? px * 0.25;
  canvas.width = Math.ceil(width) + pad * 2;
  canvas.height = Math.ceil(ascent + descent) + pad * 2;
  ctx.font = font;
  ctx.fillStyle = '#fff';
  ctx.textBaseline = 'alphabetic';
  let x = pad;
  chars.forEach((c, i) => {
    ctx.fillText(c, x, pad + ascent);
    x += advances[i] + gap;
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 8;
  return { texture, w: canvas.width / px, h: canvas.height / px, padX: pad / px, textW: width / px };
}

/**
 * Rótulo pintado en la escena, en stencil: un plano con la textura del texto, tintado con su color.
 * El arranque espera a que la fuente cargue (el rótulo aparece con el color, ya listo, y no a
 * destiempo). Sustituye al texto SDF de troika (drei): el mismo resultado sin ~30 KB comprimidos de código.
 */
export function SceneText({ children, fontSize, position, rotation, anchorX = 'center', letterSpacing = 0, color, layers }: Props) {
  const [family, setFamily] = useState<string | null>(null);
  const release = useRef<() => void>(() => {});
  useLayoutEffect(() => {
    release.current = holdBoot();
    let alive = true;
    loadStencil().then((f) => {
      if (alive) setFamily(f);
    });
    return () => {
      alive = false;
      release.current();
    };
  }, []);
  const label = useMemo(() => (family ? paint(children, family, fontSize, letterSpacing) : null), [children, family, fontSize, letterSpacing]);
  const material = useMemo(
    () => (label ? new THREE.MeshBasicMaterial({ map: label.texture, color, transparent: true, depthWrite: false }) : null),
    [label, color],
  );
  useLayoutEffect(
    () => () => {
      label?.texture.dispose();
      material?.dispose();
    },
    [label, material],
  );
  // Pintado el rótulo, el arranque puede empezar. Si la escena ya estaba en pantalla (sin arranque),
  // el rótulo aparece fuera de las zonas que se repintan: el frame siguiente va entero.
  useLayoutEffect(() => {
    if (!label) return;
    release.current();
    markFull();
  }, [label]);
  if (!label || !material) return null;
  // Origen: borde izquierdo, centro o borde derecho del texto; en vertical, centro de la línea.
  const ox = (anchorX === 'left' ? label.w / 2 - label.padX : anchorX === 'right' ? -(label.w / 2 - label.padX) : 0) * fontSize;
  return (
    <group position={position} rotation={rotation}>
      <mesh position={[ox, 0, 0]} material={material} layers={layers}>
        <planeGeometry args={[label.w * fontSize, label.h * fontSize]} />
      </mesh>
    </group>
  );
}
