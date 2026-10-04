'use client';

import { useMemo } from 'react';
import * as THREE from 'three';
import type { Vec3 } from '@/config/layout';
import { DECAL_LAYER } from '../materials';
import { pathRibbon } from './ribbons';

/**
 * Material de flujo: trazos discontinuos que avanzan por `aDist`. `uOffset` (m) desplaza
 * los trazos a lo largo del recorrido y `uOpacity` los enciende.
 */
export function createFlowMaterial(color: string, dash = 0.16, duty = 0.5) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uOffset: { value: 0 },
      uOpacity: { value: 0 },
      uDash: { value: dash },
      uDuty: { value: duty },
    },
    vertexShader: /* glsl */ `
      attribute float aDist;
      varying float vDist;
      void main() {
        vDist = aDist;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOffset;
      uniform float uOpacity;
      uniform float uDash;
      uniform float uDuty;
      varying float vDist;
      void main() {
        float f = fract((vDist - uOffset) / uDash);
        float w = fwidth(vDist / uDash);
        float a = smoothstep(0.0, w, f) * (1.0 - smoothstep(uDuty - w, uDuty, f));
        if (a * uOpacity < 0.01) discard;
        gl_FragColor = vec4(uColor, a * uOpacity);
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
  });
}

/** Trazo de flujo sobre un tubo de radio `pipeRadius` que sigue `path`. */
export function FlowLine({
  path,
  material,
  width = 0.03,
  pipeRadius = 0.03,
}: {
  path: Vec3[];
  material: THREE.ShaderMaterial;
  width?: number;
  pipeRadius?: number;
}) {
  const geometry = useMemo(() => pathRibbon(path, width, pipeRadius + 0.004), [path, width, pipeRadius]);
  return <mesh geometry={geometry} material={material} layers={DECAL_LAYER} renderOrder={3} />;
}
