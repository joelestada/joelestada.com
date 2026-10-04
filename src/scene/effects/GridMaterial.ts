import * as THREE from 'three';

/**
 * Retícula de líneas finas antialiasadas en espacio de pantalla (fwidth),
 * sobre UV expresadas en metros. Se usa para la malla del vallado
 * (fondo transparente) y para las células del panel solar (fondo opaco).
 */
export function createGridMaterial(opts: {
  line: string;
  background?: string;
  cell: [number, number];
  /** Grosor de línea en px del render interno. */
  lineWidth: number;
  opacity?: number;
}) {
  const opaque = opts.background !== undefined;
  return new THREE.ShaderMaterial({
    uniforms: {
      uLine: { value: new THREE.Color(opts.line) },
      uBackground: { value: new THREE.Color(opts.background ?? opts.line) },
      uCell: { value: new THREE.Vector2(...opts.cell) },
      uLineWidth: { value: opts.lineWidth },
      uOpacity: { value: opts.opacity ?? 1 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uLine;
      uniform vec3 uBackground;
      uniform vec2 uCell;
      uniform float uLineWidth;
      uniform float uOpacity;
      varying vec2 vUv;
      void main() {
        vec2 c = vUv / uCell;
        vec2 w = fwidth(c);
        vec2 d = abs(fract(c - 0.5) - 0.5) / max(w, vec2(1e-5));
        float line = 1.0 - clamp(min(d.x, d.y) - (uLineWidth * 0.5 - 0.5), 0.0, 1.0);
        ${
          opaque
            ? 'gl_FragColor = vec4(mix(uBackground, uLine, line), 1.0);'
            : 'gl_FragColor = vec4(uLine, line * uOpacity); if (gl_FragColor.a < 0.01) discard;'
        }
        #include <colorspace_fragment>
      }
    `,
    transparent: !opaque,
    depthWrite: opaque,
    side: THREE.DoubleSide,
  });
}
