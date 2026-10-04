// Escala tipográfica: recorre la interfaz (portada, panel, ficha, hojas de proyecto, CV, página
// perdida y línea en láminas) y apunta el tamaño real de cada texto visible, con su clase.
// Uso: node scripts/typescale.mjs [--url http://localhost:3000] [--json salida.json] [--check]
// --check no abre el navegador: revisa las hojas de estilo y sale con código 1 si algún tamaño de letra
// no sale de la escala (--fs-* de globals.css, clamp() entre pasos o em relativo al padre).
import { chromium } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';
import { globSync } from 'node:fs';
import { args } from './lib/cli.mjs';

const url = String(args.url ?? 'http://localhost:3000').replace(/\/$/, '');

if (args.check) {
  const bad = [];
  for (const f of globSync('src/**/*.css')) {
    (await readFile(f, 'utf8')).split('\n').forEach((l, i) => {
      if (!/font-size:|\bfont:/.test(l) || /font:\s*inherit/.test(l)) return;
      // Fuera de var(--fs-*), de los em y de los vw de un clamp() no puede quedar ningún tamaño suelto.
      const rest = l.replace(/var\(--fs-[\w-]+\)/g, '').replace(/[\d.]+(em|vw)\b/g, '');
      const sized = /\d(px|rem)\b/.test(rest.replace(/\/\s*[\d.]+(px)?\s/, ' '));
      if (sized) bad.push(`${f}:${i + 1}  ${l.trim()}`);
    });
  }
  console.log(bad.length ? `Tamaños fuera de la escala:\n${bad.join('\n')}` : 'Todos los tamaños de letra salen de la escala.');
  process.exit(bad.length ? 1 : 0);
}

/** Textos visibles de la página: tamaño, familia, peso y la clase que lo identifica. */
function collect(state) {
  const out = [];
  const seen = new Set();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.textContent.trim()) continue;
    const el = n.parentElement;
    if (!el || seen.has(el)) continue;
    seen.add(el);
    const r = el.getBoundingClientRect();
    if (r.width <= 1 || r.height <= 1) continue; // también .sr-only
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden') continue;
    let hidden = false;
    for (let p = el; p; p = p.parentElement) {
      const s = getComputedStyle(p);
      if (s.display === 'none' || Number(s.opacity) === 0) hidden = true;
    }
    if (hidden) continue;
    let who = el;
    while (who && !who.classList.length && who.parentElement) who = who.parentElement;
    const tag = el === who ? '' : ` ${el.tagName.toLowerCase()}`;
    out.push({
      state,
      size: Math.round(parseFloat(cs.fontSize) * 100) / 100,
      mono: /Mono/.test(cs.fontFamily),
      weight: cs.fontWeight,
      sel: `.${[...who.classList][0] ?? who.tagName.toLowerCase()}${tag}`,
      text: n.textContent.trim().slice(0, 28),
    });
  }
  return out;
}

const all = [];
const take = async (page, state) => all.push(...(await page.evaluate(collect, state)));
const wait = (page, ms) => page.waitForTimeout(ms);
const booted = (page) => page.waitForFunction(() => !/\bboot/.test(document.documentElement.className), null, { timeout: 25000 });

const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });

for (const vp of [
  { name: 'desk', viewport: { width: 1470, height: 956 }, deviceScaleFactor: 1 },
  { name: 'phone', viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
]) {
  const page = await browser.newPage(vp);
  const phone = vp.name === 'phone';
  await page.goto(`${url}/en`, { waitUntil: 'load' });
  await page.waitForSelector('canvas');
  await booted(page);
  await wait(page, 3000);
  await take(page, `${vp.name}/start`);
  if (!phone) {
    for (let i = 0; i < 4; i++) {
      await page.click(`.tab >> nth=${i}`);
      await wait(page, 1400);
      await take(page, `${vp.name}/panel-${i}`);
    }
    await page.keyboard.press('Escape');
    await wait(page, 900);
  } else {
    await page.tap('#menu-toggle');
    await wait(page, 1600);
    await take(page, `${vp.name}/menu`);
    await page.tap('#menu-toggle');
    await wait(page, 900);
  }
  for (const id of ['structure', 'display']) {
    await page.evaluate((s) => window.__factory.setSelected(s), id);
    await wait(page, 2400);
    await take(page, `${vp.name}/card-${id}`);
  }
  await page.evaluate(() => window.__factory.goToExit());
  await wait(page, 2400);
  await take(page, `${vp.name}/exit`);

  for (const p of ['/en/projects/display', '/en/projects/structure', '/en/cv', '/en/nowhere']) {
    await page.goto(`${url}${p}`, { waitUntil: 'load' });
    await wait(page, 1200);
    // Las hojas largas se leen enteras: se baja a saltos para que aparezca cada apartado.
    const h = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < h; y += vp.viewport.height * 0.8) {
      await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), y);
      await wait(page, 350);
      await take(page, `${vp.name}${p.replace('/en', '')}`);
    }
  }
  await page.close();
}

// La línea en láminas (sin WebGL).
const flat = await chromium.launch({ args: ['--disable-webgl', '--disable-webgl2'] });
const fp = await flat.newPage({ viewport: { width: 1470, height: 956 } });
await fp.goto(`${url}/en`, { waitUntil: 'load' });
await wait(fp, 2500);
const fh = await fp.evaluate(() => document.documentElement.scrollHeight);
for (let y = 0; y < fh; y += 700) {
  await fp.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), y);
  await wait(fp, 300);
  await take(fp, 'desk/flat');
}
await flat.close();
await browser.close();

// Un mismo texto se ve en varios estados: se cuenta una vez por (tamaño, clase).
const bySize = new Map();
for (const t of all) {
  const k = t.size;
  if (!bySize.has(k)) bySize.set(k, new Map());
  const m = bySize.get(k);
  const key = `${t.sel}${t.mono ? ' (mono)' : ''}`;
  if (!m.has(key)) m.set(key, new Set());
  m.get(key).add(t.state.split('/')[0]);
}
const sizes = [...bySize.keys()].sort((a, b) => a - b);
console.log(`${sizes.length} tamaños distintos en pantalla\n`);
for (const s of sizes) {
  const m = bySize.get(s);
  console.log(`${String(s).padStart(7)} px  ${[...m.keys()].slice(0, 9).join('  ')}${m.size > 9 ? `  (+${m.size - 9})` : ''}`);
}
if (args.json) await writeFile(String(args.json), JSON.stringify(all, null, 1));
