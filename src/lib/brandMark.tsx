import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import { palette } from '@/config/palette';

/**
 * Marca de la web (favicon e icono de la pantalla de inicio): las iniciales en la sans de los
 * titulares, en papel sobre el verde de las máquinas. Se lee en pestañas claras y oscuras.
 * `px` es el lado del icono; todo lo demás escala con él. `square`: sin esquinas redondeadas (iOS
 * pone su propia máscara y pinta de negro lo transparente).
 */
export async function brandMark(px: number, { square = false } = {}) {
  const sans = await readFile(join(process.cwd(), 'node_modules/@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-600-normal.woff'));
  const k = px / 64;
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: palette.green,
        borderRadius: square ? 0 : 12 * k,
      }}
    >
      <div style={{ display: 'flex', marginTop: -2 * k, color: palette.floor, fontFamily: 'Plex', fontSize: 34 * k, letterSpacing: -1.5 * k }}>JE</div>
    </div>,
    { width: px, height: px, fonts: [{ name: 'Plex', data: sans, weight: 600 }] },
  );
}
