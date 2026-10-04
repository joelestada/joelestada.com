// IndexNow: avisa a Bing (y a los demás buscadores del protocolo) de las páginas de la web, para que
// las rastreen ya. Lee el mapa del sitio publicado y envía todas sus direcciones. La clave es el
// archivo public/<clave>.txt, que tiene que estar publicado en la raíz del dominio.
// Uso, tras publicar cambios de contenido: npm run indexnow [-- --site https://joelestada.com]
import { readdir } from 'node:fs/promises';
import { args } from './lib/cli.mjs';

const site = String(args.site ?? 'https://joelestada.com').replace(/\/$/, '');
const key = (await readdir('public')).map((f) => f.match(/^([0-9a-f]{32})\.txt$/)?.[1]).find(Boolean);
if (!key) throw new Error('Falta la clave: public/<32 caracteres hexadecimales>.txt');

const sitemap = await (await fetch(`${site}/sitemap.xml`)).text();
const urlList = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: new URL(site).host, key, keyLocation: `${site}/${key}.txt`, urlList }),
});
// 200: aceptado. 202: recibido, la clave se valida después.
console.log(`${res.status} ${res.statusText}: ${urlList.length} direcciones enviadas a IndexNow`);
if (!res.ok) process.exit(1);
