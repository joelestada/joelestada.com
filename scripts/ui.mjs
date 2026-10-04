// Capturas de la interfaz: inicio, rótulo del pie, globo al pasar, panel por apartados, ficha de
// proyecto, entrada y vuelta (con el cambio de lámina), páginas de lectura y móvil.
// Uso: node scripts/ui.mjs [--url http://localhost:3000] [--out captures] [--tag ui]
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { args, CAPTURES } from './lib/cli.mjs';

const url = args.url ?? 'http://localhost:3000';
const out = args.out ?? CAPTURES;
const tag = args.tag ? `${args.tag}-` : '';
await mkdir(out, { recursive: true });
const shot = (page, name) => page.screenshot({ path: path.join(out, `${tag}${name}.png`) });
const wait = (page, ms) => page.waitForTimeout(ms);

const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const errors = [];
const watch = (page) => {
  page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && errors.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
};

const page = await browser.newPage({ viewport: { width: 1672, height: 941 }, deviceScaleFactor: 1 });
watch(page);
await page.goto(url, { waitUntil: 'load' });
await page.waitForSelector('canvas');
// El arranque de la nave (≈4 s tras cargar) oculta la interfaz y para el scroll: se espera a que acabe.
await page.waitForFunction(() => !/\bboot/.test(document.documentElement.className), null, { timeout: 20000 });
await wait(page, 3200);
await shot(page, 'start');

// Rótulo del pie (se desliza de nodo a nodo) y globo al pasar por la máquina (su nombre ya está en la ficha).
await page.hover('.rail .node >> nth=1');
await wait(page, 500);
await page.hover('.rail .node >> nth=2');
await wait(page, 700);
await shot(page, 'rail-tip');
await page.hover('.balloon__circle >> nth=0');
await wait(page, 1600);
await shot(page, 'balloon-hover');
await page.mouse.move(10, 400);

// Panel: se abre desde la pestaña PROJECTS, se pasa por un proyecto y se cambia a CONTACT.
await page.click('.tab >> nth=0');
await wait(page, 330);
await shot(page, 'menu-unrolling');
await wait(page, 1100);
await page.hover('.plist__row >> nth=1');
await wait(page, 1200);
await shot(page, 'menu-projects');
await page.click('.tab >> nth=1');
await wait(page, 900);
await page.hover('.chip >> nth=0');
await wait(page, 500);
await shot(page, 'menu-about');
await page.click('.tab >> nth=2');
await wait(page, 900);
await page.click('.actions .btn--ghost');
await wait(page, 450);
await shot(page, 'menu-contact');
await page.click('.tab >> nth=3');
await wait(page, 900);
await shot(page, 'menu-cv');
await page.keyboard.press('Escape');
await wait(page, 900);

// Ficha: clic en el globo 02, la cámara viaja y la ficha se despliega.
await page.evaluate(() => window.__factory.goToStation('structure'));
await wait(page, 2400);
await shot(page, 'scroll-structure');
await page.click('.balloon__circle >> nth=1');
await wait(page, 2200);
await shot(page, 'card-open');
await page.hover('.pcard__enter');
await wait(page, 700);
await page.click('.pcard__enter');
await wait(page, 300);
await shot(page, 'enter-warp');
await page.waitForURL('**/projects/structure');
await wait(page, 1400);
await shot(page, 'project-page');
await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }));
await wait(page, 1200);
await shot(page, 'project-next');
await page.click('.bar__back');
// La línea vive en /en o /es (la raíz redirige al idioma).
await page.waitForURL(/\/(en|es)\/?(#.*)?$/);
await page.waitForSelector('canvas');
// El arranque de la nave (≈4 s tras cargar) oculta la interfaz y para el scroll: se espera a que acabe.
await page.waitForFunction(() => !/\bboot/.test(document.documentElement.className), null, { timeout: 20000 });
await wait(page, 3200);
await shot(page, 'back-to-line');
console.log('tras volver:', await page.evaluate(() => window.__factory.getSnapshot()));

const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
watch(mobile);
await mobile.goto(url, { waitUntil: 'load' });
await mobile.waitForSelector('canvas');
// El arranque de la nave (≈4 s tras cargar) oculta la interfaz y para el scroll: se espera a que acabe.
await mobile.waitForFunction(() => !/\bboot/.test(document.documentElement.className), null, { timeout: 20000 });
await wait(mobile, 3200);
await shot(mobile, 'mobile-start');
await mobile.tap('#menu-toggle');
await wait(mobile, 1600);
await shot(mobile, 'mobile-menu');

console.log(errors.length ? errors.join('\n') : 'console: sin errores ni avisos');
await browser.close();
