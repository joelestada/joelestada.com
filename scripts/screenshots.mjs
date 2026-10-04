// Capturas de verificación a 1672×941 en 0/25/50/75/100 % del scroll.
// Uso: npm run shots -- [--url http://localhost:3000] [--dpr 1] [--out captures] [--tag ronda1]
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { args, CAPTURES } from './lib/cli.mjs';

const url = args.url ?? 'http://localhost:3000';
const dpr = Number(args.dpr ?? 1);
const out = args.out ?? CAPTURES;
const tag = args.tag ? `${args.tag}-` : '';
const stops = [0, 25, 50, 75, 100];

await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1672, height: 941 }, deviceScaleFactor: dpr });
const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`);
});
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));

await page.goto(url, { waitUntil: 'load' });
await page.waitForSelector('canvas');
// El arranque de la nave (≈4 s tras cargar) oculta la interfaz y para el scroll: se espera a que acabe.
await page.waitForFunction(() => !/\bboot/.test(document.documentElement.className), null, { timeout: 20000 });
await page.waitForTimeout(3500);

for (const pct of stops) {
  await page.evaluate((p) => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo(0, Math.round((max * p) / 100));
  }, pct);
  await page.waitForTimeout(3200);
  const file = path.join(out, `${tag}scroll-${String(pct).padStart(3, '0')}.png`);
  await page.screenshot({ path: file });
  console.log('saved', file);
}

const renderer = await page.evaluate(() => {
  const gl = document.createElement('canvas').getContext('webgl2');
  const ext = gl?.getExtension('WEBGL_debug_renderer_info');
  return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown';
});
console.log('renderer:', renderer);
console.log(errors.length ? errors.join('\n') : 'console: sin errores ni avisos');
await browser.close();
