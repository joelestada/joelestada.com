// Exactitud del repintado por zonas: lo que hay en el lienzo frente a un pintado completo.
// - En reposo, en cada estación: tiene que ser idéntico (0 píxeles). Si no, alguna animación mueve
//   algo fuera de las zonas que declara (animateRegions / markDirty): el script falla y dice dónde.
// - Tras un recorrido de scroll: informa. El frame anterior desplazado difiere de un pintado nuevo en
//   píxeles sueltos de aristas (la traslación de la cámara en float32, lo mismo que antes cambiaba
//   entre dos frames seguidos); la banda del refresco rodante los va rehaciendo.
// - Vista explosionada de cada máquina, abierta y montada de nuevo: informa.
// - Descarte por piezas de los pases por zonas: la misma zona repintada con y sin descarte, en el mismo
//   instante, tiene que dar los mismos bytes (franjas de borde, bandas y zonas sueltas en cada estación).
// Uso: node scripts/repaint.mjs [--engine chromium|webkit] [--url http://localhost:3000] [--headed 1] [--width 390 --height 844]
// Requiere los ganchos de desarrollo (servidor de desarrollo o `npm run build:perf`).
import { chromium, webkit } from 'playwright';
import { args } from './lib/cli.mjs';

const engine = args.engine ?? 'chromium';
const url = new URL(args.url ?? 'http://localhost:3000');
url.searchParams.set('hour', args.hour ?? '14');
const type = engine === 'webkit' ? webkit : chromium;
const browser = await type.launch({
  headless: (args.headed ?? '1') !== '1',
  ...(engine === 'chromium' ? { args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] } : {}),
});
const page = await browser.newPage({ viewport: { width: Number(args.width ?? 1470), height: Number(args.height ?? 956) }, deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(url.href, { waitUntil: 'load' });
await page.waitForFunction(() => !/\bboot/.test(document.documentElement.className), null, { timeout: 40000 });
await page.waitForTimeout(1500);
await page.mouse.move(Number(args.width ?? 1470) / 2, 30);

/**
 * Diferencias con un pintado completo: total, agrupadas (4+ vecinos distintos) y caja en px CSS.
 * Si hay zonas declaradas que el frame siguiente aún no ha pintado (la planta se mueve entre frames),
 * la comparación no vale: se espera al siguiente frame y se repite.
 */
async function check() {
  for (let i = 0; i < 20; i++) {
    const r = await page.evaluate(() => {
      const v = window.__verifyPartial();
      return { differing: v.differing, clustered: v.clustered, box: v.box, pending: v.pending };
    });
    if (!r.pending) return r;
    await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
  }
  throw new Error('siempre hay zonas pendientes');
}

let failed = false;
console.log(`${engine}: en reposo (tiene que ser 0)`);
for (const st of ['engine', 'structure', 'display', 'hydraulic', 'robotic', 'exit']) {
  await page.evaluate((s) => (s === 'exit' ? window.__factory.goToExit() : window.__factory.goToStation(s)), st);
  await page.waitForTimeout(2800);
  await check(); // el primero repinta entero: desde aquí, solo cuentan las zonas
  let worst = { differing: 0, clustered: 0, box: null };
  for (let i = 0; i < 6; i++) {
    await page.waitForTimeout(400);
    const r = await check();
    if (r.differing > worst.differing) worst = r;
  }
  const ok = worst.differing === 0;
  failed ||= !ok;
  console.log(
    `  ${ok ? 'ok ' : 'MAL'} ${st.padEnd(10)} ${worst.differing} px${ok ? '' : ` (agrupados ${worst.clustered}, caja ${JSON.stringify(worst.box)})`}`,
  );
}

console.log('descarte por piezas (tiene que ser idéntico)');
for (const st of ['engine', 'structure', 'display', 'hydraulic', 'robotic', 'exit']) {
  await page.evaluate((s) => (s === 'exit' ? window.__factory.goToExit() : window.__factory.goToStation(s)), st);
  await page.waitForTimeout(2200);
  // Todo en una sola tarea: entre los dos pintados no corre ningún frame (la planta no se mueve).
  const r = await page.evaluate(() => {
    const state = window.__r3f();
    const gl = state.gl.getContext();
    const W = gl.drawingBufferWidth;
    const H = gl.drawingBufferHeight;
    let seed = 3;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const rects = [];
    for (const w of [6, 40]) {
      rects.push({ x0: 0, y0: 0, x1: w, y1: H }, { x0: W - w, y0: 0, x1: W, y1: H }, { x0: 0, y0: 0, x1: W, y1: w }, { x0: 0, y0: H - w, x1: W, y1: H });
    }
    for (let i = 0; i < 4; i++) {
      const y = Math.floor(rnd() * (H - 22));
      rects.push({ x0: 0, y0: y, x1: W, y1: y + 21 });
    }
    for (let i = 0; i < 8; i++) {
      const w = 20 + Math.floor(rnd() * 400);
      const h = 20 + Math.floor(rnd() * 300);
      const x = Math.floor(rnd() * (W - w));
      const y = Math.floor(rnd() * (H - h));
      rects.push({ x0: x, y0: y, x1: x + w, y1: y + h });
    }
    const read = () => {
      const px = new Uint8Array(W * H * 4);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
      return px;
    };
    const runtime = window.__factory.runtime;
    let worst = 0;
    for (const rect of rects) {
      window.__drawZones(null);
      runtime.skip = {};
      window.__drawZones([rect]);
      const a = read();
      window.__drawZones(null);
      runtime.skip = { parts: true };
      window.__drawZones([rect]);
      runtime.skip = {};
      const b = read();
      let d = 0;
      for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++;
      worst = Math.max(worst, d);
    }
    window.__drawZones(null);
    return { n: rects.length, worst };
  });
  const ok = r.worst === 0;
  failed ||= !ok;
  console.log(`  ${ok ? 'ok ' : 'MAL'} ${st.padEnd(10)} ${r.n} zonas${ok ? '' : ` (peor: ${r.worst} bytes distintos)`}`);
}

console.log('tras un recorrido de scroll (informativo)');
await page.evaluate(() => window.__factory.goHome());
await page.waitForTimeout(2500);
for (let i = 0; i < 120; i++) {
  await page.mouse.wheel(0, 60);
  await page.waitForTimeout(16);
}
const mid = await check();
await page.waitForTimeout(2500);
const rest = await check();
console.log(`  en marcha ${mid.differing} px (agrupados ${mid.clustered}) · parado 2,5 s ${rest.differing} px (agrupados ${rest.clustered})`);

console.log('vista explosionada (informativo)');
for (const st of ['engine', 'structure', 'display', 'hydraulic', 'robotic']) {
  await page.evaluate((s) => window.__factory.goToStation(s, { select: true }), st);
  await page.waitForTimeout(2600);
  await page.evaluate((s) => window.__factory.toggleExplode(s), st);
  await page.waitForTimeout(2500);
  const open = await check();
  await page.evaluate((s) => window.__factory.toggleExplode(s), st);
  await page.waitForTimeout(2500);
  const closed = await check();
  console.log(`  ${st.padEnd(10)} abierta ${open.differing} px · montada ${closed.differing} px`);
}

console.log(errors.length ? errors.slice(0, 5).join('\n') : 'consola: sin errores');
await browser.close();
process.exit(failed || errors.length ? 1 : 0);
