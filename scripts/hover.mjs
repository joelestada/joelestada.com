// Captura cada estación centrada, en reposo y con el cursor encima (foco encendido).
// Uso: node scripts/hover.mjs [--url http://localhost:3000] [--dpr 1] [--out captures] [--tag hover] [--only display]
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { args, CAPTURES } from './lib/cli.mjs';

const url = args.url ?? 'http://localhost:3000';
const dpr = Number(args.dpr ?? 1);
const out = args.out ?? CAPTURES;
const tag = args.tag ? `${args.tag}-` : '';
const ids = args.only ? args.only.split(',') : ['engine', 'structure', 'display', 'hydraulic', 'robotic'];

await mkdir(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1672, height: 941 }, deviceScaleFactor: dpr });
const errors = [];
page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && errors.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
await page.goto(url, { waitUntil: 'load' });
await page.waitForSelector('canvas');
// El arranque de la nave (≈4 s tras cargar) oculta la interfaz y para el scroll: se espera a que acabe.
await page.waitForFunction(() => !/\bboot/.test(document.documentElement.className), null, { timeout: 20000 });
await page.waitForTimeout(3000);

for (const id of ids) {
  await page.mouse.move(5, 470);
  await page.evaluate((s) => window.__factory.goToStation(s), id);
  await page.waitForTimeout(2600);
  await page.screenshot({ path: path.join(out, `${tag}${id}-rest.png`) });
  // Centro del volumen de la estación en pantalla.
  const [x, y] = await page.evaluate((s) => {
    const f = window.__factory;
    const st = { engine: [0, 1.2, 0], structure: [10, 1.6, -2.2], display: [20, 2.4, -2.5], hydraulic: [30.2, 2.0, 0], robotic: [39.6, 1.2, -1.2] }[s];
    return f.runtime.project(...st);
  }, id);
  await page.mouse.move(x, y, { steps: 6 });
  await page.waitForTimeout(1400);
  await page.screenshot({ path: path.join(out, `${tag}${id}-hover.png`) });
  console.log('saved', id, Math.round(x), Math.round(y), await page.evaluate(() => window.__factory.getSnapshot().focused));
}
console.log(errors.length ? errors.join('\n') : 'console: sin errores ni avisos');
await browser.close();
