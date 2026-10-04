// Capturas de detalle de una estación (WebKit, 1470×956 @2x): en reposo, a media animación y en
// vista explosionada, recortadas alrededor de la máquina.
// Uso: node scripts/station.mjs --only structure [--out dir] [--tag v1] [--explode 1] [--times 0,1500]
import { webkit, chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { args, CAPTURES } from './lib/cli.mjs';

const url = args.url ?? 'http://localhost:3000';
const out = args.out ?? `${CAPTURES}/stations`;
const tag = args.tag ? `${args.tag}-` : '';
const ids = (args.only ?? 'structure').split(',');
const engine = args.engine === 'chromium' ? chromium : webkit;
const w = Number(args.w ?? 1470);
const h = Number(args.h ?? 956);
const dpr = Number(args.dpr ?? 2);
const explodeShot = args.explode !== '0';
const times = args.times ? args.times.split(',').map(Number) : [];

/** Caja de cada estación en el mundo (para recortar): x0, x1, y0, y1, z0, z1. */
const BOX = {
  engine: [-3, 3, 0, 2.6, -1.4, 1.2],
  structure: [6.2, 14.2, 0, 3.7, -3.5, -1.0],
  display: [16.5, 24.5, 0, 4.6, -3.2, 1.0],
  hydraulic: [26.5, 35.0, 0, 4.0, -2.9, 1.5],
  robotic: [36.5, 43.5, 0, 2.6, -3.1, 1.3],
  pack: [42.6, 47.4, 0, 3.6, -1.6, 1.4],
};

await mkdir(out, { recursive: true });
const browser = await engine.launch(args.engine === 'chromium' ? { args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] } : {});
const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: dpr });
const errors = [];
page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && errors.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
await page.goto(url + (args.hash ?? ''), { waitUntil: 'load' });
await page.waitForSelector('canvas');
await page.waitForFunction(() => !/\bboot/.test(document.documentElement.className), null, { timeout: 30000 });
await page.waitForTimeout(1500);
await page.addStyleTag({ content: '.bar, .pcard, .balloons, .leader, .rail, .cue, .tabs, .menu-btn, .foot, .fps { visibility: hidden !important; }' });

const clip = async (id) => {
  const b = BOX[id];
  const pts = await page.evaluate((b) => {
    const f = window.__factory;
    const out = [];
    for (const x of [b[0], b[1]]) for (const y of [b[2], b[3]]) for (const z of [b[4], b[5]]) out.push(f.runtime.project(x, y, z));
    return out;
  }, b);
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const x = Math.max(0, Math.min(...xs) - 20);
  const y = Math.max(0, Math.min(...ys) - 20);
  return { x, y, width: Math.min(w, Math.max(...xs) + 20) - x, height: Math.min(h, Math.max(...ys) + 20) - y };
};

for (const id of ids) {
  const station = id === 'pack' ? null : id;
  await page.evaluate((s) => (s ? window.__factory.goToStation(s) : window.__factory.goToExit()), station);
  await page.waitForTimeout(2800);
  if (station) await page.evaluate(() => window.__factory.setSelected(null));
  await page.waitForTimeout(600);
  const c = await clip(id);
  await page.screenshot({ path: path.join(out, `${tag}${id}-rest.png`), clip: c });
  for (const t of times) {
    await page.waitForTimeout(t);
    await page.screenshot({ path: path.join(out, `${tag}${id}-t${t}.png`), clip: await clip(id) });
  }
  if (explodeShot && station) {
    await page.evaluate((s) => {
      window.__factory.setSelected(s);
      window.__factory.toggleExplode(s);
    }, station);
    await page.waitForTimeout(4500);
    await page.screenshot({ path: path.join(out, `${tag}${id}-explode.png`), clip: await clip(id) });
    await page.evaluate((s) => window.__factory.toggleExplode(s), station);
    await page.waitForTimeout(3000);
    await page.evaluate(() => window.__factory.setSelected(null));
  }
  console.log('saved', id);
}
console.log(errors.length ? errors.slice(0, 10).join('\n') : 'console: sin errores ni avisos');
await browser.close();
