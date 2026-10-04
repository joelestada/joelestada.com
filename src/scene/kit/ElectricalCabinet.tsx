'use client';

import type { Vec3 } from '@/config/layout';
import { palette } from '@/config/palette';
import { Block, Box } from './primitives';

/** Orientación de la cara frontal: hacia el espectador (+Z) o hacia la izquierda (-X). */
export type Facing = '+z' | '-x';

const PLINTH = 0.08;
const PANEL_INSET = 0.05;
const PANEL_PROUD = 0.012;

/**
 * Armario eléctrico: zócalo, cuerpo, puerta (con su propio contorno), maneta
 * y rejilla de ventilación opcional. `position` es el centro de la base.
 */
export function ElectricalCabinet({
  position,
  size,
  color = palette.metalLight,
  facing = '+z',
  grille = true,
  doors = 1,
}: {
  position: Vec3;
  /** Ancho (a lo largo de la cara frontal), alto, fondo. */
  size: Vec3;
  color?: string;
  facing?: Facing;
  grille?: boolean;
  doors?: number;
}) {
  const [w, h, d] = size;
  const rotation: Vec3 = facing === '+z' ? [0, 0, 0] : [0, -Math.PI / 2, 0];
  const doorW = (w - PANEL_INSET * (doors + 1)) / doors;
  const doorH = h - PLINTH - PANEL_INSET * 2;
  const front = d / 2;

  return (
    <group position={position} rotation={rotation}>
      <Block min={[-w / 2 + 0.02, 0, -d / 2 + 0.02]} max={[w / 2 - 0.02, PLINTH, d / 2 - 0.02]} c={palette.metalMid} />
      <Block min={[-w / 2, PLINTH, -d / 2]} max={[w / 2, h, d / 2]} c={color} />
      {Array.from({ length: doors }, (_, i) => {
        const x0 = -w / 2 + PANEL_INSET + i * (doorW + PANEL_INSET);
        const cx = x0 + doorW / 2;
        return (
          <group key={i}>
            <Block min={[x0, PLINTH + PANEL_INSET, front]} max={[x0 + doorW, PLINTH + PANEL_INSET + doorH, front + PANEL_PROUD]} c={color} />
            <Box p={[x0 + doorW - 0.06, PLINTH + PANEL_INSET + doorH * 0.55, front + PANEL_PROUD + 0.012]} s={[0.025, 0.14, 0.024]} c={palette.metalMid} />
            {grille &&
              Array.from({ length: 7 }, (_, k) => (
                <Box
                  key={k}
                  p={[cx - 0.02, PLINTH + PANEL_INSET + doorH * 0.12 + k * 0.045, front + PANEL_PROUD + 0.006]}
                  s={[doorW * 0.62, 0.018, 0.012]}
                  c={palette.metalMid}
                />
              ))}
          </group>
        );
      })}
    </group>
  );
}
