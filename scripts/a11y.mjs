// Auditoría de accesibilidad de la interfaz: tamaño de letra, contraste, encabezados, nombres
// accesibles y orden del tabulador, en la portada (inicio, panel, ficha, final) y en un proyecto.
// Uso: node scripts/a11y.mjs [--url http://localhost:3000] [--min 11] [--ratio 4.5] [--paths /ruta,/otra]
// (--paths mide además esas páginas, recorriéndolas de arriba abajo)
// Sale con código 1 si algún texto visible queda por debajo del mínimo.
import { chromium } from 'playwright';
import { args } from './lib/cli.mjs';

const url = (args.url ?? 'http://localhost:3000').replace(/\/$/, '');
const MIN = Number(args.min ?? 11);
const RATIO = Number(args.ratio ?? 4.5);

/**
 * Recorre los nodos de texto visibles y devuelve, por elemento, su tamaño y su contraste real:
 * el color del texto (con su alfa y la opacidad de sus antepasados) sobre el fondo compuesto de
 * sus antepasados. Donde no hay fondo, debajo está la escena: se toma el papel del suelo.
 */
function measure() {
  const parse = (c) => {
    let m = c.match(/^rgba?\(([^)]+)\)/);
    if (m) {
      const p = m[1]
        .split(/[\s,/]+/)
        .filter(Boolean)
        .map(Number);
      return [p[0] / 255, p[1] / 255, p[2] / 255, p[3] ?? 1];
    }
    m = c.match(/^color\(srgb ([^)]+)\)/);
    if (m) {
      const p = m[1]
        .split(/[\s/]+/)
        .filter(Boolean)
        .map(Number);
      return [p[0], p[1], p[2], p[3] ?? 1];
    }
    return null;
  };
  const over = (top, under) => {
    const a = top[3];
    return [0, 1, 2].map((i) => top[i] * a + under[i] * (1 - a)).concat(1);
  };
  const lum = (c) => {
    const f = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
  };
  const paper = parse(
    getComputedStyle(document.documentElement)
      .getPropertyValue('--paper')
      .trim()
      .replace(/^#(..)(..)(..)$/, (_, r, g, b) => `rgb(${parseInt(r, 16)}, ${parseInt(g, 16)}, ${parseInt(b, 16)})`),
  );

  const background = (el) => {
    const layers = [];
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const bg = parse(getComputedStyle(n).backgroundColor);
      if (bg && bg[3] > 0) {
        layers.push(bg);
        if (bg[3] >= 1) break;
      }
    }
    let c = paper;
    for (let i = layers.length - 1; i >= 0; i--) c = over(layers[i], c);
    return c;
  };
  const opacity = (el) => {
    let o = 1;
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) o *= Number(getComputedStyle(n).opacity);
    return o;
  };
  const visible = (el) => {
    if (el.closest('[aria-hidden="true"], [inert]')) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1 || r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) return false;
    const s = getComputedStyle(el);
    return s.visibility === 'visible' && opacity(el) > 0.05;
  };
  const label = (el) => {
    const cls = typeof el.className === 'string' ? el.className.split(' ')[0] : '';
    return `${el.tagName.toLowerCase()}${cls ? '.' + cls : ''}`;
  };

  const out = new Map();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let t = walker.nextNode(); t; t = walker.nextNode()) {
    const text = t.textContent.trim();
    const el = t.parentElement;
    if (!text || !el || out.has(el) || !visible(el) || el.closest('script, style, svg')) continue;
    const s = getComputedStyle(el);
    const bg = background(el);
    const fg = parse(s.color);
    if (!fg) continue;
    const ink = over([fg[0], fg[1], fg[2], fg[3] * opacity(el)], bg);
    const [a, b] = [lum(ink), lum(bg)].sort((x, y) => y - x);
    out.set(el, { el: label(el), text: text.slice(0, 32), size: parseFloat(s.fontSize), ratio: (a + 0.05) / (b + 0.05) });
  }
  return [...out.values()];
}

const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const findings = new Map();
const record = (state, rows) => {
  for (const r of rows) {
    const bad = [r.size < MIN && `${r.size}px`, r.ratio < RATIO && `${r.ratio.toFixed(2)}:1`].filter(Boolean);
    if (!bad.length) continue;
    const key = `${r.el} «${r.text}»`;
    if (!findings.has(key)) findings.set(key, { states: new Set(), bad: bad.join(' · ') });
    findings.get(key).states.add(state);
  }
};
const ready = async (page) => {
  await page.waitForSelector('canvas');
  await page.waitForFunction(() => !/\bboot/.test(document.documentElement.className), null, { timeout: 20000 });
  await page.waitForTimeout(1500);
};

const page = await browser.newPage({ viewport: { width: 1470, height: 956 }, deviceScaleFactor: 1 });
await page.goto(url + '/', { waitUntil: 'load' });
await ready(page);

// Estructura: encabezados y nombres accesibles.
const outline = await page.evaluate(() =>
  [...document.querySelectorAll('h1, h2, h3, h4')].map(
    (h) => `${h.tagName} ${JSON.stringify(h.innerText.replace(/\n/g, '⏎'))} → ${JSON.stringify(h.textContent)}`,
  ),
);
console.log('\nEncabezados de la portada (visible → lo que lee un lector de pantalla):');
for (const l of outline) console.log('  ' + l);
if (!outline.some((l) => l.startsWith('H1'))) console.log('  ✗ sin h1');

// Orden del tabulador en reposo.
const order = [];
await page.evaluate(() => document.activeElement?.blur());
for (let i = 0; i < 24; i++) {
  await page.keyboard.press('Tab');
  const d = await page.evaluate(() => {
    const e = document.activeElement;
    if (!e || e === document.body) return null;
    return (e.getAttribute('aria-label') || e.textContent || e.tagName).trim().replace(/\s+/g, ' ').slice(0, 40);
  });
  if (!d || order.includes(d)) break;
  order.push(d);
}
console.log('\nOrden del tabulador:');
order.forEach((d, i) => console.log(`  ${String(i + 1).padStart(2)}. ${d}`));
await page.evaluate(() => document.activeElement?.blur());

record('inicio', await page.evaluate(measure));
for (const [i, name] of ['projects', 'about', 'contact', 'cv'].entries()) {
  await page.click(`.tab >> nth=${i}`);
  await page.waitForTimeout(1400);
  record(`panel:${name}`, await page.evaluate(measure));
}
await page.keyboard.press('Escape');
await page.waitForTimeout(900);
await page.evaluate(() => window.__factory.goToStation('structure', { select: true }));
await page.waitForTimeout(2400);
record('ficha', await page.evaluate(measure));
await page.evaluate(() => window.__factory.toggleExplode('structure'));
await page.waitForTimeout(2400);
record('despiece', await page.evaluate(measure));
await page.evaluate(() => window.__factory.goToExit());
await page.waitForTimeout(3000);
record('final', await page.evaluate(measure));

await page.goto(url + '/projects/structure', { waitUntil: 'load' });
await page.waitForTimeout(1200);
record('proyecto', await page.evaluate(measure));
const projOutline = await page.evaluate(() => [...document.querySelectorAll('h1, h2, h3')].map((h) => `${h.tagName} ${JSON.stringify(h.textContent)}`));
console.log('\nEncabezados de un proyecto:');
for (const l of projOutline) console.log('  ' + l);

// Páginas extra: se miden en varias alturas de scroll (lo que no está en pantalla no cuenta).
for (const extra of (args.paths ?? '').split(',').filter(Boolean)) {
  await page.goto(url + extra, { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < height; y += 700) {
    await page.evaluate((y) => window.scrollTo(0, y), y);
    await page.waitForTimeout(250);
    record(extra, await page.evaluate(measure));
  }
  const h1 = await page.evaluate(() => document.querySelectorAll('h1').length);
  if (h1 !== 1) console.log(`  ✗ ${extra}: ${h1} h1`);
}

await browser.close();

console.log(`\nTextos por debajo de ${MIN}px o de ${RATIO}:1 (${findings.size}):`);
for (const [k, v] of [...findings].sort()) console.log(`  ${k.padEnd(56)} ${v.bad.padEnd(18)} ${[...v.states].join(', ')}`);
process.exit(findings.size ? 1 : 0);
