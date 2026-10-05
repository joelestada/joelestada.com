// Láminas de cada máquina (public/plates/<idioma>/<id>.webp y <id>-s.webp): la estación sola, sin
// interfaz, recortada a 4:3 alrededor de su caja, una por idioma (llevan los rótulos pintados de la
// nave). Las usan el panel de proyectos, las páginas de proyecto y el paso a la estación siguiente.
// Hay que volver a generarlas cuando cambie la escena.
// Uso, con el servidor de desarrollo en marcha: node scripts/plates.mjs [--url http://localhost:3000]
//   [--only engine,exit] [--lang en|es] [--exe /ruta/a/chromium] [--angle metal|swiftshader]
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { args } from './lib/cli.mjs';

const url = (args.url ?? 'http://localhost:3000').replace(/\/$/, '');
const langs = args.lang ? [args.lang] : ['en', 'es'];
/** Tamaños de salida (px): la grande para las páginas y la pequeña para el panel. */
const SIZES = [
  { suffix: '', w: 1600, h: 1200, q: 0.8 },
  { suffix: '-s', w: 720, h: 540, q: 0.8 },
];
/** Caja de cada estación en el mundo: x0, x1, y0, y1, z0, z1 (la de scripts/station.mjs; la salida incluye la puerta). */
const BOX = {
  engine: [-3, 3, 0, 2.6, -1.4, 1.2],
  structure: [6.2, 14.2, 0, 3.7, -3.5, -1.0],
  display: [16.5, 24.5, 0, 4.6, -3.2, 1.0],
  hydraulic: [26.5, 35.0, 0, 4.0, -2.9, 1.5],
  robotic: [36.5, 43.5, 0, 2.6, -3.1, 1.3],
  exit: [42.6, 49.2, 0, 4.2, -1.8, 1.6],
};
const ids = args.only ? args.only.split(',') : Object.keys(BOX);
/** Margen alrededor de la caja, en fracción de su tamaño en pantalla. */
const PAD = 0.1;

const angle = args.angle ?? 'metal';
const browser = await chromium.launch({
  ...(args.exe ? { executablePath: args.exe } : {}),
  args: [`--use-angle=${angle}`, '--enable-gpu', '--ignore-gpu-blocklist'],
});
// Con «reducir movimiento» no hay arranque y la línea queda parada: la lámina sale quieta.
const page = await browser.newPage({ viewport: { width: 1400, height: 1050 }, deviceScaleFactor: 2, reducedMotion: 'reduce' });

/** Ventana 4:3 alrededor de la caja proyectada (px CSS), dentro de la vista. */
const frame = async (id) => {
  const b = BOX[id];
  const pts = await page.evaluate((b) => {
    const f = window.__factory;
    const pts = [];
    for (const x of [b[0], b[1]]) for (const y of [b[2], b[3]]) for (const z of [b[4], b[5]]) pts.push(f.runtime.project(x, y, z));
    return { pts, w: innerWidth, h: innerHeight };
  }, b);
  const xs = pts.pts.map((p) => p[0]);
  const ys = pts.pts.map((p) => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  let w = (Math.max(...xs) - Math.min(...xs)) * (1 + 2 * PAD);
  let h = (Math.max(...ys) - Math.min(...ys)) * (1 + 2 * PAD);
  if (w / h > 4 / 3) h = (w * 3) / 4;
  else w = (h * 4) / 3;
  w = Math.min(w, pts.w, (pts.h * 4) / 3);
  h = (w * 3) / 4;
  const x = Math.min(Math.max(0, cx - w / 2), pts.w - w);
  const y = Math.min(Math.max(0, cy - h / 2), pts.h - h);
  return { x, y, width: w, height: h };
};

/** PNG → WebP a cada tamaño, con el codificador del propio navegador (sin dependencias). */
const encode = (png, size) =>
  page.evaluate(
    async ({ data, size }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${data}`;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = size.w;
      c.height = size.h;
      const ctx = c.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, size.w, size.h);
      const blob = await new Promise((res) => c.toBlob(res, 'image/webp', size.q));
      const buf = new Uint8Array(await blob.arrayBuffer());
      let s = '';
      for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      return btoa(s);
    },
    { data: png.toString('base64'), size },
  );

for (const lang of langs) {
  const out = `public/plates/${lang}`;
  await mkdir(out, { recursive: true });
  // Con SwiftShader la portada pasaría a láminas (WebGL por software): `gl=any` dibuja la nave igual.
  await page.goto(`${url}/${lang}?hour=14&zoom=1.35${angle === 'swiftshader' ? '&gl=any' : ''}`, { waitUntil: 'load' });
  await page.waitForSelector('canvas');
  await page.waitForFunction(() => !/\bboot/.test(document.documentElement.className), null, { timeout: 30000 });
  await page.addStyleTag({
    content: '.bar, .rail, .pcard, .balloons, .balloon, .leader, .cue, .sheet, .xplode, .fps, .boot-status, .drawer, .scrim { visibility: hidden !important; }',
  });
  for (const id of ids) {
    await page.evaluate((id) => (id === 'exit' ? window.__factory.goToExit() : window.__factory.goToStation(id)), id);
    await page.waitForTimeout(3200);
    await page.evaluate(() => window.__factory.setSelected(null));
    await page.waitForTimeout(1200);
    const png = await page.screenshot({ clip: await frame(id) });
    for (const size of SIZES) {
      const file = `${out}/${id}${size.suffix}.webp`;
      await writeFile(file, Buffer.from(await encode(png, size), 'base64'));
      console.log(file);
    }
  }
}
await browser.close();
