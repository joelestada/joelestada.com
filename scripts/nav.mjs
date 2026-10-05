// Coherencia de la navegación: tras cada salto (números del rail, flechas de la ficha y del pie,
// teclado, globos, panel de proyectos, enlace con #, cambio de idioma), la cámara, la ficha y su
// enlace hablan del mismo proyecto, y el despiece abierto es el de esa ficha. En escritorio, tableta
// vertical y móvil. Sale con código 1 si algún paso no cuadra.
// Uso, con el servidor de desarrollo en marcha: node scripts/nav.mjs [--url http://localhost:3000] [--only desktop,mobile]
import { chromium } from 'playwright';
import { args } from './lib/cli.mjs';

const url = (args.url ?? 'http://localhost:3000').replace(/\/$/, '');
const VIEWS = {
  desktop: { viewport: { width: 1470, height: 956 } },
  tablet: { viewport: { width: 768, height: 1024 }, hasTouch: true, isMobile: true },
  mobile: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true },
};
const only = args.only ? args.only.split(',') : Object.keys(VIEWS);

/** Arranque terminado (`boot-short`, la entrada corta de las visitas siguientes, se queda puesta). */
const booted = () => window.__factory && !['boot', 'boot-in'].some((c) => document.documentElement.classList.contains(c));

const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
let failures = 0;

for (const name of only) {
  const page = await browser.newPage(VIEWS[name]);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  const load = async (path) => {
    await page.goto(url + path, { waitUntil: 'load' });
    await page.waitForFunction(booted, null, { timeout: 40000 });
    await settle();
  };
  /** Espera a que la cámara llegue y la ficha termine de cambiar. */
  const settle = async () => {
    await page.waitForTimeout(250);
    await page.waitForFunction(() => !window.__factory.runtime.lenis?.isScrolling, null, { timeout: 10000 });
    await page.waitForTimeout(700);
  };
  const state = () =>
    page.evaluate(() => {
      const s = window.__factory.getSnapshot();
      return { ...s, link: document.querySelector('.pcard .pcard__enter')?.getAttribute('href') ?? null, hash: location.hash.slice(1) };
    });
  /** Lo esperado: en `id`, con su ficha abierta o recogida (null: la presentación; 'exit': el final). */
  const expect = async (label, id, open) => {
    const s = await state();
    const bad = [];
    if (id === null) {
      if (!s.intro || s.selected !== null) bad.push(`presentación esperada (intro ${s.intro}, ficha ${s.selected})`);
    } else if (id === 'exit') {
      if (!s.atExit || s.selected !== null) bad.push(`final esperado (atExit ${s.atExit}, ficha ${s.selected})`);
    } else {
      if (s.active !== id) bad.push(`cámara en ${s.active}`);
      if (s.selected !== (open ? id : null)) bad.push(`ficha ${s.selected}`);
      if (!s.link?.endsWith(`/projects/${id}`)) bad.push(`enlace ${s.link}`);
      if (s.exploded !== null && s.exploded !== s.selected) bad.push(`despiece de ${s.exploded}`);
      if (open && s.hash !== id) bad.push(`#${s.hash}`);
    }
    const where = id === null ? 'presentación' : id === 'exit' ? 'final' : `${id}${open ? ' (ficha abierta)' : ''}`;
    if (bad.length) failures++;
    console.log(`  ${bad.length ? '✗' : '✓'} ${label} → ${where}${bad.length ? `: ${bad.join(', ')}` : ''}`);
  };
  const click = async (selector) => {
    await page.locator(selector).first().click();
    await settle();
  };
  const key = async (k) => {
    await page.locator('body').focus();
    await page.keyboard.press(k);
    await settle();
  };
  const go = async (id, select = true) => {
    await page.evaluate(([i, s]) => window.__factory.goToStation(i, { select: s }), [id, select]);
    await settle();
  };
  const node = (n) => `.rail__line .rail__item:nth-child(${n}) .node`;
  /** Siguiente / anterior: la flecha de la ficha, o la del pie en las pantallas compactas. */
  const step = (dir) => (dir > 0 ? '.rail-btn--next:visible, .pcard__step:visible >> nth=-1' : '.rail-btn--prev:visible, .pcard__step:visible >> nth=0');

  console.log(`${name} (${VIEWS[name].viewport.width}×${VIEWS[name].viewport.height})`);
  await load('/es');
  await expect('al cargar', null, false);

  await go('robotic');
  await click(node(1));
  await expect('número 01 con la ficha del robot abierta', 'engine', true);
  await click(step(1));
  await expect('siguiente', 'structure', true);
  await key('ArrowRight');
  await expect('→ del teclado', 'display', true);
  await key('PageDown');
  await expect('Av Pág (solo recorre)', 'hydraulic', false);
  await click(node(5));
  await expect('número 05 sin ficha', 'robotic', false);
  await click('.balloon__circle[aria-label^="05"]');
  await expect('globo de la máquina', 'robotic', true);
  await page.evaluate(() => window.__factory.toggleExplode('robotic'));
  await settle();
  await click(node(3));
  await expect('número 03 con el robot despiezado', 'display', true);
  await click(step(-1));
  await expect('anterior', 'structure', true);
  await key('End');
  await expect('Fin', 'exit', false);
  await key('Home');
  await expect('Inicio', null, false);

  await go('hydraulic');
  await page.locator('.lang-btn').click();
  await page.waitForURL(/\/en/);
  await page.waitForFunction(booted, null, { timeout: 40000 });
  await settle();
  await expect('cambio de idioma con la ficha abierta', 'hydraulic', true);

  await load('/es#structure');
  await expect('enlace con #structure', 'structure', true);

  await load('/es?panel=projects');
  await page.locator('.plist__row').nth(3).click();
  await page.waitForTimeout(400);
  await settle();
  await expect('panel de proyectos', 'hydraulic', true);

  if (errors.length) {
    failures++;
    console.log(`  ✗ errores en la página: ${errors.join(' | ')}`);
  }
  await page.close();
}

await browser.close();
console.log(failures ? `\n${failures} fallo(s).` : '\nTodo cuadra.');
process.exit(failures ? 1 : 0);
