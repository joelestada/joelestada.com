'use client';

import { useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { Scene } from './Scene';
import { resolutionFor } from './Resolution';
import { releaseShared } from './shared';

/**
 * Sin sistema de eventos de R3F: el cursor se resuelve con un rayo propio contra los
 * volúmenes de cada estación (Interaction), y la capa HTML va aparte (ui/).
 */
const noEvents = () => ({ enabled: false, priority: 0 });

/**
 * Lienzo fijo a pantalla completa; solo se redibuja cuando algo cambia, y a menudo solo una parte:
 * conserva el fotograma anterior para que el pase de tinta pueda repintar zonas sueltas.
 * `onLost` avisa si el navegador retira el contexto WebGL (habitual en iOS al cambiar de app).
 */
export default function FactoryCanvas({ onLost }: { onLost?: (canvas: HTMLCanvasElement) => void }) {
  // Al desmontar (al entrar en un proyecto), los recursos compartidos sueltan este renderer (ver shared.ts).
  useEffect(() => releaseShared, []);
  return (
    <div className="stage" aria-hidden>
      <Canvas
        flat
        dpr={typeof window === 'undefined' ? 1 : resolutionFor(window.devicePixelRatio || 1).dpr}
        frameloop="demand"
        events={noEvents}
        gl={{ antialias: false, stencil: false, powerPreference: 'high-performance', preserveDrawingBuffer: true }}
        onCreated={({ gl }) => {
          const canvas = gl.domElement;
          canvas.addEventListener('webglcontextlost', () => onLost?.(canvas), { once: true });
        }}
      >
        <Scene />
      </Canvas>
    </div>
  );
}
