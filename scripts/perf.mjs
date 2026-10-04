// Banco de fluidez: recorrido de scroll con rueda (bajando y subiendo) midiendo lo que se nota.
// - rAF: intervalos entre frames y frames perdidos (> 1,5 × el periodo).
// - Cámara: tirones de avance (un frame que no avanza entre dos que sí, o que avanza el doble) e
//   irregularidad del avance exacto frame a frame (antes de ajustarlo al píxel), respecto a su media de 9
//   frames: lo que se ve como tirón aunque no se pierda ningún frame. Era lo que fallaba en Safari, cuyo
//   reloj va en milisegundos enteros (ver src/scene/frameClock.ts); con un reloj ideal queda en décimas.
// - GPU: latencia real de cada frame (fence tras la composición, sondeada hasta que se señala).
//   Es la medida que explica los tirones a pantalla completa: si se acerca al periodo de refresco,
//   algunos frames llegan tarde a la composición del navegador aunque el rAF vaya regular.
// - CPU: tiempo del frame de la escena (todas las suscripciones de R3F y los pases de render).
// - Pintado: frames completos, parciales y desplazados, con el motivo de los completos.
// Uso: node scripts/perf.mjs [--engine webkit|chromium] [--url http://localhost:3000] [--w 1470 --h 956]
//      [--dpr 2] [--headed 1] [--hour 14] [--hover 1] [--steps 300] [--json 1]
// Por defecto: WebKit (el motor de Safari) con ventana visible a 1470×956 @2x, la pantalla completa
// de un MacBook Air de 13". Requiere el servidor de desarrollo (usa los ganchos __factory y __r3f).
import { chromium, webkit } from 'playwright';
import { args } from './lib/cli.mjs';

const engine = args.engine ?? 'webkit';
const url = new URL(args.url ?? 'http://localhost:3000');
if (args.hour) url.searchParams.set('hour', args.hour);
const W = Number(args.w ?? 1470);
const H = Number(args.h ?? 956);
const dpr = Number(args.dpr ?? 2);
const headed = (args.headed ?? '1') === '1';
const hover = (args.hover ?? '1') === '1';
const steps = Number(args.steps ?? 300);

const type = engine === 'webkit' ? webkit : chromium;
const browser = await type.launch({
  headless: !headed,
  ...(engine === 'chromium' ? { args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] } : {}),
});
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: dpr });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(url.href, { waitUntil: 'load' });
await page.waitForSelector('canvas');
// El arranque de la nave (≈4 s tras cargar) oculta la interfaz y para el scroll: se espera a que acabe.
await page.waitForFunction(() => !/\bboot/.test(document.documentElement.className), null, { timeout: 40000 });
await page.waitForTimeout(2500);
// Con el cursor sobre la escena (lo habitual) o sobre la barra superior.
await page.mouse.move(W * 0.5, hover ? H * 0.55 : 30);

// Instrumentación: fence tras la composición de cada frame y tiempo de CPU del frame de R3F.
await page.evaluate(() => {
  const get = window.__r3f;
  const state = get();
  const renderer = state.gl;
  const gl = renderer.getContext();
  const rec = (window.__perf = { lat: [], cpu: [], frames: [], cam: [], exact: [] });
  const pending = [];
  let queued = false;
  const render = renderer.render.bind(renderer);
  renderer.render = (scene, camera) => {
    render(scene, camera);
    if (renderer.getRenderTarget() !== null || queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      pending.push({ f: gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0), t: performance.now() });
      gl.flush();
    });
  };
  const store = { getState: get };
  let start = 0;
  state.internal.subscribe({ current: () => void (start = performance.now()) }, -1000, store);
  state.internal.subscribe(
    {
      current: () => {
        rec.cpu.push(performance.now() - start);
        const e = get().camera.userData.pixelExact;
        if (e) rec.exact.push(e[0]);
      },
    },
    1000,
    store,
  );
  const ch = new MessageChannel();
  ch.port1.onmessage = () => {
    const now = performance.now();
    for (let i = 0; i < pending.length; i++) {
      if (gl.getSyncParameter(pending[i].f, gl.SYNC_STATUS) !== gl.SIGNALED) continue;
      rec.lat.push(now - pending[i].t);
      gl.deleteSync(pending[i].f);
      pending.splice(i--, 1);
    }
    ch.port2.postMessage(0);
  };
  ch.port2.postMessage(0);
  const tick = (t) => {
    rec.frames.push(t);
    rec.cam.push(window.__factory.runtime.cameraX);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});

const quant = (values, digits = 1) => {
  const s = [...values].sort((a, b) => a - b);
  const q = (p) => +(s[Math.min(s.length - 1, Math.floor(p * s.length))] ?? NaN).toFixed(digits);
  return { p50: q(0.5), p90: q(0.9), p99: q(0.99), max: +(s.at(-1) ?? NaN).toFixed(digits) };
};

async function run(direction) {
  await page.evaluate(() => {
    const r = window.__perf;
    r.lat.length = r.cpu.length = r.frames.length = r.cam.length = r.exact.length = 0;
    const s = window.__factory.runtime.stats;
    window.__statsBefore = JSON.parse(JSON.stringify(s));
  });
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, direction * 60);
    await page.waitForTimeout(16);
  }
  await page.waitForTimeout(1200);
  const r = await page.evaluate(() => {
    const p = window.__perf;
    const s = window.__factory.runtime.stats;
    const b = window.__statsBefore;
    const why = {};
    for (const [k, v] of Object.entries(s.why)) if (v - (b.why[k] ?? 0)) why[k] = v - (b.why[k] ?? 0);
    return {
      lat: [...p.lat],
      cpu: [...p.cpu],
      frames: [...p.frames],
      cam: [...p.cam],
      exact: [...p.exact],
      drawn: {
        full: s.full - b.full,
        partial: s.partial - b.partial,
        shift: (s.shift ?? 0) - (b.shift ?? 0),
        relight: (s.relight ?? 0) - (b.relight ?? 0),
        why,
      },
    };
  });
  const dt = r.frames.slice(1).map((t, i) => t - r.frames[i]);
  const period = quant(dt).p50;
  const dx = r.cam.slice(1).map((x, i) => Math.abs(x - r.cam[i]));
  let stutters = 0;
  for (let i = 1; i < dx.length - 1; i++) {
    const around = (dx[i - 1] + dx[i + 1]) / 2;
    if (around > 0.004 && (dx[i] < around * 0.35 || dx[i] > around * 1.9)) stutters++;
  }
  // Irregularidad del avance exacto: |paso − media de 9 pasos| / paso medio, solo con la cámara en marcha.
  const step = r.exact.slice(1).map((x, i) => x - r.exact[i]);
  let dev = 0;
  let mag = 0;
  for (let i = 4; i < step.length - 4; i++) {
    const around = step.slice(i - 4, i + 5);
    if (around.some((v) => Math.abs(v) < 0.05)) continue;
    const mean = around.reduce((a, v) => a + v, 0) / 9;
    dev += Math.abs(step[i] - mean);
    mag += Math.abs(mean);
  }
  return {
    raf: { ...quant(dt), missed: dt.filter((d) => d > period * 1.5).length, frames: dt.length },
    cameraStutters: stutters,
    stepIrregularity: mag ? +((100 * dev) / mag).toFixed(2) : 0,
    gpuLatency: { ...quant(r.lat), over8: r.lat.filter((v) => v > 8).length, n: r.lat.length },
    cpuFrame: quant(r.cpu, 2),
    drawn: r.drawn,
  };
}

const down = await run(1);
const up = await run(-1);
const result = { engine, headed, size: `${W}x${H}@${dpr}`, hour: args.hour ?? 'now', hover, down, up, errors };
if (args.json === '1') console.log(JSON.stringify(result));
else {
  console.log(`${engine} ${result.size} hora ${result.hour} cursor ${hover ? 'escena' : 'barra'}`);
  for (const [name, r] of [
    ['bajando', down],
    ['subiendo', up],
  ]) {
    console.log(`  ${name}:`);
    console.log(`    rAF ms          ${JSON.stringify(r.raf)}`);
    console.log(`    tirones cámara  ${r.cameraStutters} · avance irregular ${r.stepIrregularity} %`);
    console.log(`    latencia GPU ms ${JSON.stringify(r.gpuLatency)}`);
    console.log(`    CPU frame ms    ${JSON.stringify(r.cpuFrame)}`);
    console.log(`    pintado         ${JSON.stringify(r.drawn)}`);
  }
  console.log(errors.length ? errors.join('\n') : '  consola: sin errores');
}
await browser.close();
