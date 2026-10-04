// Carga en un móvil medio simulado (Chromium): CPU ×4 más lenta y red 4G lenta (150 ms, 1,6 Mbps),
// sin caché. Mide cuándo se ve algo (FCP), cuándo se pinta el primer frame de la nave, cuándo
// entra la interfaz (fin del arranque) y cuánto se descarga, por tipo.
// Uso: npm run build:perf && npm run start:perf, y luego node scripts/load.mjs [--url http://localhost:3100]
//      [--runs 3] [--cpu 4] [--net slow4g|4g|wifi] [--width 390 --height 844 --dpr 2.625]
// Necesita los ganchos de medida (__factory), que solo existen en desarrollo o en la build de medida.
import { chromium } from 'playwright';
import { args } from './lib/cli.mjs';

const url = args.url ?? 'http://localhost:3100/';
const runs = Number(args.runs ?? 3);
const cpu = Number(args.cpu ?? 4);
const NETS = {
  slow4g: { latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 },
  '4g': { latency: 40, downloadThroughput: (9 * 1024 * 1024) / 8, uploadThroughput: (3 * 1024 * 1024) / 8 },
  wifi: { latency: 5, downloadThroughput: (50 * 1024 * 1024) / 8, uploadThroughput: (20 * 1024 * 1024) / 8 },
};
const net = NETS[args.net ?? 'slow4g'];
const viewport = { width: Number(args.width ?? 390), height: Number(args.height ?? 844) };
const dpr = Number(args.dpr ?? 2.625);

/** En la página, desde el primer script: apunta cuándo se pinta el primer frame y cuándo acaba el arranque. */
function probe() {
  const marks = (window.__load = { frame: null, ui: null, fcp: null });
  new PerformanceObserver((l) => {
    for (const e of l.getEntries()) if (e.name === 'first-contentful-paint') marks.fcp = e.startTime;
  }).observe({ type: 'paint', buffered: true });
  const tick = () => {
    const f = window.__factory;
    if (marks.frame === null && f && f.runtime.drawn > 0) marks.frame = performance.now();
    if (marks.ui === null && marks.frame !== null && !document.documentElement.classList.contains('boot')) marks.ui = performance.now();
    if (marks.ui === null) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const results = [];
for (let r = 0; r < runs; r++) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: dpr, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp.send('Network.emulateNetworkConditions', { offline: false, ...net });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
  await page.addInitScript(probe);
  await page.goto(url, { waitUntil: 'commit' });
  await page.waitForFunction(() => window.__load && window.__load.ui !== null, null, { timeout: 90000, polling: 200 });
  const m = await page.evaluate(() => {
    const bytes = {};
    for (const e of performance.getEntriesByType('resource')) {
      const type =
        e.name.endsWith('.js') || e.initiatorType === 'script' ? 'js' : e.name.match(/\.css/) ? 'css' : e.name.match(/woff2?|ttf/) ? 'font' : e.initiatorType;
      bytes[type] = (bytes[type] ?? 0) + e.transferSize;
    }
    const nav = performance.getEntriesByType('navigation')[0];
    bytes.html = nav.transferSize;
    return { ...window.__load, ttfb: nav.responseStart, bytes };
  });
  results.push(m);
  await context.close();
}
await browser.close();

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};
const ms = (v) => `${(v / 1000).toFixed(2)} s`;
console.log(`${runs} cargas · CPU ×${cpu} · red ${args.net ?? 'slow4g'} · ${viewport.width}×${viewport.height} @${dpr}`);
console.log(`  primer contenido (FCP)   ${ms(median(results.map((r) => r.fcp ?? 0)))}`);
console.log(`  primer frame de la nave  ${ms(median(results.map((r) => r.frame)))}`);
console.log(`  interfaz (fin arranque)  ${ms(median(results.map((r) => r.ui)))}`);
const b = results[0].bytes;
console.log(
  `  descarga: ${Object.entries(b)
    .map(([k, v]) => `${k} ${Math.round(v / 1024)} KB`)
    .join(' · ')} · total ${Math.round(Object.values(b).reduce((a, c) => a + c, 0) / 1024)} KB`,
);
