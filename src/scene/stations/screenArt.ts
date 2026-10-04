import * as THREE from 'three';
import { palette } from '@/config/palette';
import { READOUT } from './display/dims';
import { MARK_BOX, MARK_DOT, MARK_SYMBOL, MARK_WORD } from './ottometrixMark';

/** Lienzo de la pantalla grande (16:9). */
export const SCREEN_PX = { w: 1600, h: 900 } as const;

const FONT = '"IBM Plex Mono", ui-monospace, monospace';

function hexAlpha(hex: string, a: number) {
  const c = new THREE.Color(hex);
  return `rgba(${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)}, ${a})`;
}

function drawBase(ctx: CanvasRenderingContext2D) {
  const { w, h } = SCREEN_PX;
  ctx.fillStyle = palette.screenDeep;
  ctx.fillRect(0, 0, w, h);
  const glow = ctx.createRadialGradient(w / 2, h / 2, 40, w / 2, h / 2, w * 0.62);
  glow.addColorStop(0, 'rgba(62, 92, 86, 0.42)');
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  // Esquinas de encuadre.
  const inset = 52;
  const arm = 64;
  ctx.strokeStyle = hexAlpha(palette.screenInk, 0.4);
  ctx.lineWidth = 4;
  for (const [x, y, sx, sy] of [
    [inset, inset, 1, 1],
    [w - inset, inset, -1, 1],
    [inset, h - inset, 1, -1],
    [w - inset, h - inset, -1, -1],
  ]) {
    ctx.beginPath();
    ctx.moveTo(x, y + sy * arm);
    ctx.lineTo(x, y);
    ctx.lineTo(x + sx * arm, y);
    ctx.stroke();
  }

  // Estado.
  ctx.font = `500 28px ${FONT}`;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = palette.andonGreen;
  ctx.beginPath();
  ctx.arc(inset + 14, h - inset - 44, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = hexAlpha(palette.screenInk, 0.55);
  ctx.fillText('LIVE', inset + 36, h - inset - 43);
  ctx.textAlign = 'right';
  ctx.fillText('CH 03', w - inset - 8, h - inset - 43);
  ctx.textAlign = 'left';
}

/**
 * Lectura de la pieza (módulo central de abajo): la fórmula de la nota, una pista por factor (cada
 * uno pesa un cuarto) y la escala 0–100. Los rellenos y la marca de la nota los pinta la estación.
 */
function drawReadout(ctx: CanvasRenderingContext2D) {
  const { bar, scale, labels } = READOUT;
  const seg = (bar.x1 - bar.x0 - 3 * bar.gap) / 4;
  const mid = (bar.x0 + bar.x1) / 2;
  ctx.textAlign = 'center';
  ctx.font = `500 25px ${FONT}`;
  ctx.fillStyle = hexAlpha(palette.screenInk, 0.62);
  ctx.fillText('SCORE = ¼V + ¼Q + ¼M + ¼AG', mid, bar.y0 - 34);
  ctx.font = `500 16px ${FONT}`;
  for (let i = 0; i < 4; i++) {
    const x = bar.x0 + i * (seg + bar.gap);
    ctx.fillStyle = hexAlpha(palette.screenInk, 0.14);
    ctx.fillRect(x, bar.y0, seg, bar.y1 - bar.y0);
    ctx.fillStyle = hexAlpha(palette.screenInk, 0.5);
    ctx.fillText(labels[i], x + seg / 2, bar.y1 + 22);
  }
  // Escala de la nota con sus marcas cada 25 y los rótulos 0, 50 y 100.
  ctx.fillStyle = hexAlpha(palette.screenInk, 0.35);
  ctx.fillRect(bar.x0, scale.y - 1, bar.x1 - bar.x0, 2);
  for (let k = 0; k <= 4; k++) {
    const x = bar.x0 + (k / 4) * (bar.x1 - bar.x0);
    ctx.fillRect(x - 1, scale.y - (k % 2 ? 4 : 7), 2, k % 2 ? 8 : 14);
  }
  ctx.fillStyle = hexAlpha(palette.screenInk, 0.45);
  for (const [k, label] of [
    [0, '0'],
    [0.5, '50'],
    [1, '100'],
  ] as const) {
    ctx.fillText(label, bar.x0 + k * (bar.x1 - bar.x0), scale.y + 30);
  }
  ctx.textAlign = 'left';
}

/** Logo oficial, centrado y a un 62 % del ancho de la pantalla; el punto de la «i» en amarillo señal. */
function drawMark(ctx: CanvasRenderingContext2D) {
  const { w, h } = SCREEN_PX;
  const scale = (w * 0.62) / MARK_BOX.w;
  ctx.save();
  ctx.translate((w - MARK_BOX.w * scale) / 2, (h - MARK_BOX.h * scale) / 2 - 12);
  ctx.scale(scale, scale);
  ctx.translate(-MARK_BOX.x, -MARK_BOX.y);
  ctx.fillStyle = palette.screenInk;
  for (const d of [...MARK_SYMBOL, MARK_WORD]) ctx.fill(new Path2D(d));
  ctx.fillStyle = palette.signalYellow;
  ctx.fill(new Path2D(MARK_DOT));
  ctx.restore();
}

/**
 * Textura de la pantalla. Se dibuja al momento y se redibuja cuando carga la fuente de los
 * rótulos de estado; `onUpdate` avisa para pedir frame.
 */
export function createScreenTexture(onUpdate: () => void) {
  const canvas = document.createElement('canvas');
  canvas.width = SCREEN_PX.w;
  canvas.height = SCREEN_PX.h;
  const ctx = canvas.getContext('2d')!;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;

  const paint = () => {
    drawBase(ctx);
    drawMark(ctx);
    drawReadout(ctx);
    texture.needsUpdate = true;
    onUpdate();
  };

  paint();
  document.fonts
    ?.load(`500 28px ${FONT}`)
    .then(paint)
    .catch(() => {});
  return texture;
}
