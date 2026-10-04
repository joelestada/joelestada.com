// Imágenes de vista previa al compartir (Open Graph, 1200×630), capturadas de la propia nave, en cada
// idioma: la portada (public/og/<idioma>/home.jpg) y una por estación con su ficha (…/<id>.jpg).
// Uso, con el servidor en marcha: node scripts/og.mjs [--url http://localhost:3000] [--lang en|es]
// Hay que volver a generarlas cuando cambie la escena o los textos de las estaciones.
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { args } from './lib/cli.mjs';

const url = (args.url ?? 'http://localhost:3000').replace(/\/$/, '');
/** JPEG: con el grano del papel un PNG pesa ~600 KB, y WhatsApp no muestra vistas previas de más de ~300 KB. */
const JPEG = { type: 'jpeg', quality: 84 };
/** Cajetín de la portada, por idioma (repite los textos de src/config/site.ts y src/i18n/ui.ts). */
const TITLE = {
  en: { kicker: 'Portfolio', fields: 'Engineering × Data × Software', status: 'Open to new projects' },
  es: { kicker: 'Portafolio', fields: 'Ingeniería × Datos × Software', status: 'Disponible para nuevos proyectos' },
};
const langs = args.lang ? [args.lang] : ['en', 'es'];

const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
// Con «reducir movimiento» no hay arranque ni animaciones de la interfaz: la captura sale quieta.
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });

for (const lang of langs) {
  const out = `public/og/${lang}`;
  await mkdir(out, { recursive: true });
  await page.goto(`${url}/${lang}`, { waitUntil: 'load' });
  await page.waitForSelector('canvas');
  await page.waitForFunction(() => !/\bboot/.test(document.documentElement.className), null, { timeout: 20000 });
  // Fuera lo que solo sirve para navegar: en una miniatura sería ruido ilegible.
  await page.addStyleTag({ content: '.cue, .tabs, .menu-btn, .lang-btn, .rail { display: none !important; }' });

  // Portada: la nave y un cajetín con el nombre, en lugar de la ficha de la presentación.
  const home = await page.addStyleTag({
    content: `
      .bar, .pcard, .balloons, .leader { display: none !important; }
      .og-title {
        position: fixed; z-index: 50; left: 40px; bottom: 40px; padding: 26px 30px 24px;
        background: var(--paper); border: 1px solid var(--ink);
        font: 500 15px/1 var(--font); letter-spacing: 0.16em; text-transform: uppercase; color: var(--ink);
      }
      .og-title small { display: block; font-size: 13px; color: var(--ink-2); margin-bottom: 18px; }
      .og-title strong { display: block; font: 600 68px/1 var(--display); letter-spacing: -0.01em; text-transform: none; margin-bottom: 18px; }
      .og-title span { display: flex; align-items: center; gap: 10px; margin-top: 16px; font-size: 13px; color: var(--ink-2); }
      .og-title span i { width: 9px; height: 9px; border-radius: 50%; background: var(--ok); }
    `,
  });
  await page.evaluate((t) => {
    const el = document.createElement('div');
    el.className = 'og-title';
    el.innerHTML = `<small>${t.kicker}</small><strong>Joel Estada</strong>${t.fields}<span><i></i>${t.status}</span>`;
    document.body.appendChild(el);
  }, TITLE[lang]);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${out}/home.jpg`, ...JPEG });
  console.log(`og/${lang}/home.jpg`);
  await page.evaluate((el) => {
    el.remove();
    document.querySelector('.og-title')?.remove();
  }, home);

  const ids = await page.evaluate(() => Object.keys(window.__factory.runtime.fx));
  for (const id of ids) {
    await page.evaluate((id) => window.__factory.goToStation(id), id);
    await page.waitForTimeout(2600);
    await page.screenshot({ path: `${out}/${id}.jpg`, ...JPEG });
    console.log(`og/${lang}/${id}.jpg`);
  }
}
await browser.close();
